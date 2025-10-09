export interface StoredFile {
  name: string;
  type: string;
  size: number;
  data: string; // Base64 encoded file data
  uploadDate: string;
  id: string;
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

  // Convert File to StoredFile with base64 data
  static async fileToStoredFile(file: File): Promise<StoredFile> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const storedFile: StoredFile = {
          name: file.name,
          type: file.type,
          size: file.size,
          data: reader.result as string, // This will be base64
          uploadDate: new Date().toISOString(),
          id: this.generateFileId()
        };
        resolve(storedFile);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Save file attachment
  static async saveFileAttachment(
    file: File, 
    category: FileAttachment['category'], 
    clientId?: string,
    paymentIndex?: number, 
    paymentType?: FileAttachment['paymentType'],
    source?: FileAttachment['source']
  ): Promise<string> {
    try {
      const storedFile = await this.fileToStoredFile(file);
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
      return storedFile.id;
    } catch (error) {
      console.error('Error saving file attachment:', error);
      throw error;
    }
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

  // Delete file by ID
  static deleteFile(fileId: string): boolean {
    try {
      const attachments = this.getAllFileAttachments();
      const filteredAttachments = attachments.filter(att => att.file.id !== fileId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredAttachments));
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
}