import { uploadFileToR2, deleteFileFromR2 } from './r2UploadService';
import { ActivityLogService } from './activityLogService';
import { ClientService } from './clientService';

export interface StoredFile {
  name: string;
  type: string;
  size: number;
  data: string; // R2 URL or Base64 for backward compatibility
  uploadDate: string;
  id: string;
  r2Path?: string; // R2 file path for deletion
  isR2?: boolean; // Flag to identify R2 files
}

export interface FileAttachment {
  file: StoredFile;
  category: 'deposit-slip' | 'receipt' | 'other';
  paymentIndex?: number;
  paymentType?: 'regular' | 'first' | 'second' | 'third' | 'other';
  clientId?: string; // Associate files with specific clients
  source?: 'payment-terms' | 'visa-service' | 'insurance-service' | 'eta-service'; // Track upload source
}

export class FileService {
  private static STORAGE_KEY = 'crm_file_attachments';
  private static R2_BUCKET = import.meta.env.VITE_R2_BUCKET_NAME || 'crm-uploads';

  // Convert File to StoredFile with R2 upload
  static async fileToStoredFile(file: File, folder: string = 'general'): Promise<StoredFile> {
    try {
      // Upload to R2
      const uploadResult = await uploadFileToR2(file, this.R2_BUCKET, folder);
      
      if (!uploadResult.success || !uploadResult.path || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Failed to upload to R2');
      }

      const storedFile: StoredFile = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: uploadResult.url, // Store R2 URL instead of base64
        uploadDate: new Date().toISOString(),
        id: this.generateFileId(),
        r2Path: uploadResult.path,
        isR2: true
      };
      
      return storedFile;
    } catch (error) {
      console.error('Error uploading file to R2:', error);
      // Fallback to base64 if R2 fails
      return this.fileToBase64StoredFile(file);
    }
  }

  // Fallback method for base64 storage (if R2 fails)
  private static async fileToBase64StoredFile(file: File): Promise<StoredFile> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const storedFile: StoredFile = {
          name: file.name,
          type: file.type,
          size: file.size,
          data: reader.result as string,
          uploadDate: new Date().toISOString(),
          id: this.generateFileId(),
          isR2: false
        };
        resolve(storedFile);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Save file attachment with R2 support
  static async saveFileAttachment(
    file: File, 
    category: FileAttachment['category'], 
    clientId?: string,
    paymentIndex?: number, 
    paymentType?: FileAttachment['paymentType'],
    source?: FileAttachment['source'],
    currentUser?: string
  ): Promise<string> {
    try {
      // Determine folder based on category
      const folder = this.getFolderByCategory(category, source);
      
      const storedFile = await this.fileToStoredFile(file, folder);
      const attachment: FileAttachment = {
        file: storedFile,
        category,
        clientId,
        paymentIndex,
        paymentType,
        source
      };

      const existingAttachments = this.getAllFileAttachments();
      existingAttachments.push(attachment);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingAttachments));
      
      // Log file upload activity if clientId exists
      if (clientId && currentUser) {
        const client = ClientService.getClientById(clientId);
        ActivityLogService.addLog({
          clientId,
          clientName: client?.contactName || 'Unknown',
          action: 'file_uploaded',
          performedBy: currentUser,
          performedByUser: currentUser,
          details: `Uploaded file: ${file.name} (${category}${source ? ' - ' + source : ''})`
        });
      }
      
      return storedFile.id;
    } catch (error) {
      console.error('Error saving file attachment:', error);
      throw error;
    }
  }

  // Get folder path based on category and source
  private static getFolderByCategory(
    category: FileAttachment['category'],
    source?: FileAttachment['source']
  ): string {
    const folders: Record<string, string> = {
      'deposit-slip': 'deposit-slips',
      'receipt': 'receipts',
      'other': 'other-files'
    };

    let folder = folders[category] || 'general';
    
    if (source) {
      folder = `${folder}/${source}`;
    }
    
    return folder;
  }

  // Get all file attachments
  static getAllFileAttachments(): FileAttachment[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading file attachments:', error);
      return [];
    }
  }

  // Get file by ID
  static getFileById(fileId: string): StoredFile | null {
    const attachments = this.getAllFileAttachments();
    const attachment = attachments.find(att => att.file.id === fileId);
    return attachment ? attachment.file : null;
  }

  // Get files by category and payment info
  static getFilesByPayment(category: FileAttachment['category'], paymentIndex?: number, paymentType?: FileAttachment['paymentType']): FileAttachment[] {
    const attachments = this.getAllFileAttachments();
    return attachments.filter(att => 
      att.category === category &&
      (paymentIndex === undefined || att.paymentIndex === paymentIndex) &&
      (paymentType === undefined || att.paymentType === paymentType)
    );
  }

  // Get files by client ID
  static getFilesByClient(clientId: string): FileAttachment[] {
    const attachments = this.getAllFileAttachments();
    return attachments.filter(att => att.clientId === clientId);
  }

  // Delete file by ID with R2 cleanup
  static async deleteFile(fileId: string, currentUser?: string): Promise<boolean> {
    try {
      const attachments = this.getAllFileAttachments();
      const attachment = attachments.find(att => att.file.id === fileId);
      
      // If it's an R2 file, delete from R2 first
      if (attachment && attachment.file.isR2 && attachment.file.r2Path) {
        try {
          await deleteFileFromR2(this.R2_BUCKET, attachment.file.r2Path);
        } catch (error) {
          console.error('Error deleting file from R2:', error);
          // Continue to remove from localStorage anyway
        }
      }
      
      const filteredAttachments = attachments.filter(att => att.file.id !== fileId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredAttachments));
      
      // Log file deletion activity if clientId exists
      if (attachment && attachment.clientId && currentUser) {
        const client = ClientService.getClientById(attachment.clientId);
        ActivityLogService.addLog({
          clientId: attachment.clientId,
          clientName: client?.contactName || 'Unknown',
          action: 'file_deleted',
          performedBy: currentUser,
          performedByUser: currentUser,
          details: `Deleted file: ${attachment.file.name}`
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  // Update client ID for temporary files (when a new client is saved)
  static updateClientIdForTempFiles(tempClientId: string, realClientId: string): boolean {
    try {
      const attachments = this.getAllFileAttachments();
      const updatedAttachments = attachments.map(att => {
        if (att.clientId === tempClientId) {
          return { ...att, clientId: realClientId };
        }
        return att;
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedAttachments));
      return true;
    } catch (error) {
      console.error('Error updating client IDs:', error);
      return false;
    }
  }

  // Create download URL for file
  static createDownloadUrl(storedFile: StoredFile): string {
    return storedFile.data; // This is already a data URL
  }

  // Generate unique file ID
  private static generateFileId(): string {
    return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Format file size for display
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Check if file type is supported for preview
  static isPreviewable(fileType: string): boolean {
    return fileType.startsWith('image/') || fileType === 'application/pdf';
  }

  // Fix R2 URLs that were stored with incorrect domain
  static fixR2URLs(): void {
    try {
      const attachments = this.getAllFileAttachments();
      const correctUrl = 'https://pub-39d00feda7bb94c4fa451404e2759a6b8.r2.dev';
      const incorrectPatterns = [
        'pub-394006da7bb94c4fa451404e2759a6b8.r2.dev',
        'pub-b825320c39dd07bb2ae33de95f61e4f4.r2.dev'
      ];
      
      let fixed = 0;
      const updatedAttachments = attachments.map(att => {
        if (att.file.isR2 && att.file.data) {
          for (const pattern of incorrectPatterns) {
            if (att.file.data.includes(pattern)) {
              // Extract the path after the domain
              const pathMatch = att.file.data.match(/r2\.dev\/(.+)$/);
              if (pathMatch) {
                att.file.data = `${correctUrl}/${pathMatch[1]}`;
                fixed++;
                break;
              }
            }
          }
        }
        return att;
      });

      if (fixed > 0) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedAttachments));
        console.log(`✅ Fixed ${fixed} R2 file URLs`);
      }
    } catch (error) {
      console.error('Error fixing R2 URLs:', error);
    }
  }
}