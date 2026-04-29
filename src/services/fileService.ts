import { uploadFileToR2, deleteFileFromR2 } from './r2UploadService';
import { ActivityLogService } from './activityLogService';
import { ClientService } from './clientService';
import { authHeaders } from '../utils/authToken';
import { realtimeSync } from './realtimeSyncService';

const DB_API = '/.netlify/functions/database';

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
  source?: 'payment-terms' | 'visa-service' | 'insurance-service' | 'eta-service' | 'booking-voucher' | 'passport-info' | 'first-payment' | 'other-payment' | 'approval-invoice' | 'booking-confirmation' | 'account-relations' | 'sc-report'; // Track upload source
  fileType?: string; // Sub-field identifier (e.g., 'international-flight', 'local-flight-1', 'passport-1-attachment')
}

export class FileService {
  private static STORAGE_KEY = 'crm_file_attachments';
  private static LAST_SYNC_KEY = 'crm_file_attachments_last_sync';
  private static R2_BUCKET = import.meta.env.VITE_R2_BUCKET_NAME || 'crm-uploads';
  private static syncInProgress = false;

  // Convert File to StoredFile with R2 upload
  static async fileToStoredFile(file: File, folder: string = 'general'): Promise<StoredFile> {
    try {
      // Upload to R2
      // console.log('🔄 Attempting R2 upload for:', file.name);
      const uploadResult = await uploadFileToR2(file, this.R2_BUCKET, folder);
      
      if (!uploadResult.success || !uploadResult.path || !uploadResult.url) {
        // console.error('❌ R2 Upload Failed:', uploadResult.error || 'Unknown error');
        throw new Error(uploadResult.error || 'Failed to upload to R2');
      }

      // console.log('✅ R2 Upload Success:', uploadResult.url);
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
      // console.error('❌ R2 Upload Error - Falling back to base64:', error);
      // console.warn('⚠️ File will be stored as base64 (not recommended for large files)');
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
    currentUser?: string,
    fileType?: string
  ): Promise<string> {
    // Determine folder based on category
    const folder = this.getFolderByCategory(category, source);
    
    const storedFile = await this.fileToStoredFile(file, folder);
    const attachment: FileAttachment = {
      file: storedFile,
      category,
      clientId,
      paymentIndex,
      paymentType,
      source,
      fileType
    };

    const existingAttachments = this.getAllFileAttachments();
    existingAttachments.push(attachment);
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingAttachments));
    
    // Fire-and-forget sync to MongoDB
    this.saveAttachmentToMongoDB(attachment).then(() => {
      realtimeSync.signalChange('file_attachments');
    }).catch(() => {});
    
    // Helper function to get current user's profile image R2 path
    const getUserProfileImagePath = (userName: string): string | undefined => {
      const users = localStorage.getItem('crm_users');
      if (users) {
        const userList = JSON.parse(users);
        const user = userList.find((u: any) => u.fullName === userName);
        return user?.profileImageR2Path;
      }
      return undefined;
    };
    
    // Log file upload activity if clientId exists
    if (clientId && currentUser) {
      const client = ClientService.getClientById(clientId);
      const fileTypeLabels: Record<string, string> = {
        'after-visa-sc-attachment': 'after-visa',
        'pre-departure-sc-attachment': 'pre-departure',
        'post-departure-sc-attachment': 'post-departure',
        'after-sales-sc-attachment': 'after-sales',
      };
      const displayCategory = (fileType && fileTypeLabels[fileType]) ? fileTypeLabels[fileType] : category;
      ActivityLogService.addLog({
        clientId,
        clientName: client?.contactName || 'Unknown',
        action: 'file_uploaded',
        performedBy: currentUser,
        performedByUser: currentUser,
        profileImageR2Path: getUserProfileImagePath(currentUser),
        details: `Uploaded file: ${file.name} (${displayCategory}${source ? ' - ' + source : ''})`
      });
    }
    
    return storedFile.id;
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
      // console.error('Error loading file attachments:', error);
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
      // console.log('🗑️ FileService.deleteFile called with fileId:', fileId);
      const attachments = this.getAllFileAttachments();
      // console.log('📦 Total attachments before deletion:', attachments.length);
      
      const attachment = attachments.find(att => att.file.id === fileId);
      // console.log('🔍 Found attachment to delete:', attachment);
      
      // Delete from localStorage immediately (don't wait for R2)
      const filteredAttachments = attachments.filter(att => att.file.id !== fileId);
      // console.log('📦 Total attachments after filtering:', filteredAttachments.length);
      // console.log('💾 Saving to localStorage...');
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredAttachments));
      // console.log('✅ localStorage updated');
      
      // Delete from MongoDB
      this.deleteAttachmentFromMongoDB(fileId).then(() => {
        realtimeSync.signalChange('file_attachments');
      }).catch(() => {});
      
      // Verify the save
      const verification = localStorage.getItem(this.STORAGE_KEY);
      JSON.parse(verification || '[]');
      // console.log('✓ Verification - attachments in storage:', verifiedAttachments.length);

      // Fire-and-forget delete from MongoDB
      if (attachment) {
        this.deleteAttachmentFromMongoDB(attachment.file.id).catch(() => {});
      }
      
      // Delete from R2 in the background (non-blocking)
      if (attachment && attachment.file.isR2 && attachment.file.r2Path) {
        // console.log('☁️ Attempting R2 deletion in background:', attachment.file.r2Path);
        deleteFileFromR2(this.R2_BUCKET, attachment.file.r2Path)
          .then(() => {
            // console.log('✅ R2 deletion successful')
          })
          .catch(() => {
            // console.error('❌ R2 deletion failed (file already removed from UI):', error)
          });
      }
      
      // Log file deletion activity if clientId exists
      if (attachment && attachment.clientId && currentUser) {
        const client = ClientService.getClientById(attachment.clientId);
        
        // Helper function to get current user's profile image R2 path
        const getUserProfileImagePath = (userName: string): string | undefined => {
          const users = localStorage.getItem('crm_users');
          if (users) {
            const userList = JSON.parse(users);
            const user = userList.find((u: any) => u.fullName === userName);
            return user?.profileImageR2Path;
          }
          return undefined;
        };
        
        ActivityLogService.addLog({
          clientId: attachment.clientId,
          clientName: client?.contactName || 'Unknown',
          action: 'file_deleted',
          performedBy: currentUser,
          performedByUser: currentUser,
          profileImageR2Path: getUserProfileImagePath(currentUser),
          details: `Deleted file: ${attachment.file.name}`
        });
      }
      
      return true;
    } catch (error) {
      // console.error('❌ Error deleting file:', error);
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
      
      // Fire-and-forget sync updated IDs to MongoDB
      this.updateClientIdInMongoDB(tempClientId, realClientId).catch(() => {});
      
      return true;
    } catch (error) {
      // console.error('Error updating client IDs:', error);
      return false;
    }
  }

  // Create download URL for file
  static createDownloadUrl(storedFile: StoredFile): string {
    return storedFile.data; // This is already a data URL
  }

  // Generate unique file ID
  private static generateFileId(): string {
    return 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
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
      const correctUrl = import.meta.env.VITE_R2_PUBLIC_URL || '';
      const incorrectPatterns = [
        'pub-39d00feda7bb94c4fa451404e2759a6b8.r2.dev',
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
      }
    } catch (error) {
      // console.error('Error fixing R2 URLs:', error);
    }
  }

  // Migrate legacy attachments that don't have fileType property
  // This tags them so they can appear in the correct UI field
  static migrateFileTypes(): number {
    try {
      const attachments = this.getAllFileAttachments();
      let migrated = 0;
      
      const updatedAttachments = attachments.map(att => {
        // Skip if already has fileType
        if (att.fileType) return att;
        // Skip if no source (can't determine field)
        if (!att.source) return att;
        
        // Try to infer fileType from r2Path which contains the folder structure
        // R2 paths look like: other-files/booking-voucher/<timestamp>_<original-filename>
        // The fileType was passed as a log label but never stored, so we can't be 100% sure
        // For legacy files, we tag them with source + '_legacy' so they appear in a legacy section
        att.fileType = `${att.source}_legacy`;
        migrated++;
        return att;
      });

      if (migrated > 0) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedAttachments));
      }
      
      return migrated;
    } catch (error) {
      return 0;
    }
  }

  // Get legacy files for a given source (files uploaded before fileType was added)
  static getLegacyFilesBySource(clientId: string, source: string): FileAttachment[] {
    const attachments = this.getFilesByClient(clientId);
    return attachments.filter(att => 
      att.source === source && 
      att.fileType === `${source}_legacy`
    );
  }

  // ─── MongoDB Sync Methods ─────────────────────────────────────────────

  // Sync from MongoDB → localStorage (call on app load)
  static async syncFromMongoDB(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const response = await fetch(DB_API, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'file_attachments',
          operation: 'find',
          filter: {}
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        const mongoAttachments: FileAttachment[] = result.data.map((d: any) => ({
          file: d.file,
          category: d.category,
          paymentIndex: d.paymentIndex,
          paymentType: d.paymentType,
          clientId: d.clientId,
          source: d.source,
          fileType: d.fileType
        }));

        // Merge: MongoDB + any local-only entries
        const mongoFileIds = new Set(mongoAttachments.map(a => a.file?.id));
        const localOnly = this.getAllFileAttachments().filter(a => a.file?.id && !mongoFileIds.has(a.file.id));

        // Re-sync local-only entries to MongoDB
        for (const att of localOnly) {
          this.saveAttachmentToMongoDB(att).catch(() => {});
        }

        const merged = [...mongoAttachments, ...localOnly];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
        localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
      }
    } catch {
      // Network error — keep using localStorage data
    } finally {
      this.syncInProgress = false;
    }
  }

  private static async saveAttachmentToMongoDB(attachment: FileAttachment): Promise<void> {
    await fetch(DB_API, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection: 'file_attachments',
        operation: 'updateOne',
        filter: { 'file.id': attachment.file.id },
        update: attachment,
        upsert: true
      })
    });
  }

  private static async deleteAttachmentFromMongoDB(fileId: string): Promise<void> {
    await fetch(DB_API, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection: 'file_attachments',
        operation: 'deleteOne',
        filter: { 'file.id': fileId }
      })
    });
  }

  private static async updateClientIdInMongoDB(oldClientId: string, newClientId: string): Promise<void> {
    await fetch(DB_API, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection: 'file_attachments',
        operation: 'updateMany',
        filter: { clientId: oldClientId },
        update: { clientId: newClientId }
      })
    });
  }

  /**
   * Strips base64 file data from attachments that have already been uploaded to R2.
   * R2 files only need the URL stored in `data`, not raw base64. Old fallback entries
   * may still contain multi-MB base64 strings that bloat localStorage unnecessarily.
   *
   * Returns { freed, base64Count } where `freed` is the approximate bytes reclaimed.
   */
  static pruneBase64DataFromStorage(): { freed: number; base64Count: number } {
    try {
      const attachments = this.getAllFileAttachments();
      let freed = 0;
      let base64Count = 0;

      const cleaned = attachments.map(att => {
        const data = att.file?.data ?? '';
        // Base64 data URLs start with "data:" — R2 URLs start with "https://"
        if (!att.file.isR2 && data.startsWith('data:')) {
          // Non-R2 file stored as base64 fallback — strip the binary data
          // but keep all metadata so the entry remains in the list.
          freed += data.length;
          base64Count++;
          return {
            ...att,
            file: { ...att.file, data: '', isR2: false }
          };
        }
        return att;
      });

      if (base64Count > 0) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cleaned));
      }

      return { freed, base64Count };
    } catch {
      return { freed: 0, base64Count: 0 };
    }
  }

  /** Returns the number of non-R2 (base64) attachment entries still in localStorage. */
  static getBase64AttachmentCount(): number {
    try {
      return this.getAllFileAttachments().filter(
        att => !att.file.isR2 && (att.file?.data ?? '').startsWith('data:')
      ).length;
    } catch {
      return 0;
    }
  }
}