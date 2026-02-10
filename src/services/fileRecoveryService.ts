import { FileService } from './fileService';
import { ActivityLogService } from './activityLogService';
import { NotificationService } from './notificationService';

export interface FileRecoveryRequest {
  id: string;
  fileId: string;
  fileName: string;
  fileCategory: string;
  clientId: string;
  clientName: string;
  requestedBy: string;
  requestedByUserId: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export class FileRecoveryService {
  private static STORAGE_KEY = 'crm_file_recovery_requests';

  // Generate unique ID for recovery request
  private static generateRequestId(): string {
    return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get current user ID from localStorage
  private static getCurrentUserId(username: string): string {
    const users = localStorage.getItem('crm_users');
    if (users) {
      const userList = JSON.parse(users);
      const user = userList.find((u: any) => u.fullName === username || u.username === username);
      return user?.username || username;
    }
    return username;
  }

  // Get all recovery requests
  static getAllRequests(): FileRecoveryRequest[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      // console.error('Error loading file recovery requests:', error);
      return [];
    }
  }

  // Get pending recovery requests
  static getPendingRequests(): FileRecoveryRequest[] {
    return this.getAllRequests().filter(req => req.status === 'pending');
  }

  // Get requests by user
  static getRequestsByUser(username: string): FileRecoveryRequest[] {
    return this.getAllRequests().filter(req => req.requestedBy === username);
  }

  // Get requests by client
  static getRequestsByClient(clientId: string): FileRecoveryRequest[] {
    return this.getAllRequests().filter(req => req.clientId === clientId);
  }

  // Save all recovery requests
  private static saveRequests(requests: FileRecoveryRequest[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(requests));
    } catch (error) {
      // console.error('Error saving file recovery requests:', error);
      throw error;
    }
  }

  // Create a new recovery request
  static createRecoveryRequest(
    fileId: string,
    fileName: string,
    fileCategory: string,
    clientId: string,
    clientName: string,
    requestedBy: string,
    notes?: string
  ): FileRecoveryRequest {
    const request: FileRecoveryRequest = {
      id: this.generateRequestId(),
      fileId,
      fileName,
      fileCategory,
      clientId,
      clientName,
      requestedBy,
      requestedByUserId: this.getCurrentUserId(requestedBy),
      requestedAt: new Date().toISOString(),
      status: 'pending',
      notes
    };

    const requests = this.getAllRequests();
    requests.push(request);
    this.saveRequests(requests);

    // console.log(`📝 File recovery request created: ${fileName} by ${requestedBy}`);
    return request;
  }

  // Approve recovery request
  static approveRequest(
    requestId: string,
    reviewedBy: string,
    adminNotes?: string
  ): boolean {
    try {
      const requests = this.getAllRequests();
      const requestIndex = requests.findIndex(req => req.id === requestId);
      
      if (requestIndex === -1) {
        // console.error('Recovery request not found');
        return false;
      }

      const request = requests[requestIndex];

      // Check if file exists and is deleted
      const file = FileService.getFileById(request.fileId);
      if (!file) {
        // console.error('File not found or already recovered');
        return false;
      }

      // Update request status
      requests[requestIndex] = {
        ...request,
        status: 'approved',
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        notes: adminNotes || request.notes
      };

      this.saveRequests(requests);

      // Log the activity
      ActivityLogService.addLog({
        clientId: request.clientId,
        clientName: request.clientName,
        action: 'file_recovered',
        performedBy: reviewedBy,
        performedByUser: reviewedBy,
        details: `File "${request.fileName}" recovered (requested by ${request.requestedBy})`
      });

      // Send notification to requester
      NotificationService.addNotification({
        type: 'recovery_approved',
        title: '✅ File Recovery Approved',
        message: `Your request to recover file "${request.fileName}" for client "${request.clientName}" has been approved by ${reviewedBy}.`,
        targetUserId: request.requestedByUserId,
        targetUserName: request.requestedBy,
        fromUserId: this.getCurrentUserId(reviewedBy),
        fromUserName: reviewedBy,
        clientId: request.clientId,
        clientName: request.clientName,
        link: {
          page: 'client-form',
          clientId: request.clientId
        }
      });

      // console.log(`✅ File recovery approved: ${request.fileName} by ${reviewedBy}`);
      return true;
    } catch (error) {
      // console.error('Error approving recovery request:', error);
      return false;
    }
  }

  // Reject recovery request
  static rejectRequest(
    requestId: string,
    reviewedBy: string,
    reason?: string
  ): boolean {
    try {
      const requests = this.getAllRequests();
      const requestIndex = requests.findIndex(req => req.id === requestId);
      
      if (requestIndex === -1) {
        // console.error('Recovery request not found');
        return false;
      }

      const request = requests[requestIndex];

      // Update request status
      requests[requestIndex] = {
        ...request,
        status: 'rejected',
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        notes: reason || request.notes
      };

      this.saveRequests(requests);

      // Log the activity
      ActivityLogService.addLog({
        clientId: request.clientId,
        clientName: request.clientName,
        action: 'file_recovery_rejected',
        performedBy: reviewedBy,
        performedByUser: reviewedBy,
        details: `File recovery rejected: "${request.fileName}" (requested by ${request.requestedBy})${reason ? ` - Reason: ${reason}` : ''}`
      });

      // Send notification to requester
      NotificationService.addNotification({
        type: 'recovery_rejected',
        title: '❌ File Recovery Rejected',
        message: `Your request to recover file "${request.fileName}" for client "${request.clientName}" has been rejected by ${reviewedBy}.${reason ? ` Reason: ${reason}` : ''}`,
        targetUserId: request.requestedByUserId,
        targetUserName: request.requestedBy,
        fromUserId: this.getCurrentUserId(reviewedBy),
        fromUserName: reviewedBy,
        clientId: request.clientId,
        clientName: request.clientName
      });

      // console.log(`❌ File recovery rejected: ${request.fileName} by ${reviewedBy}`);
      return true;
    } catch (error) {
      // console.error('Error rejecting recovery request:', error);
      return false;
    }
  }

  // Cancel a pending request (by requester)
  static cancelRequest(requestId: string, username: string): boolean {
    try {
      const requests = this.getAllRequests();
      const requestIndex = requests.findIndex(req => req.id === requestId);
      
      if (requestIndex === -1) {
        // console.error('Recovery request not found');
        return false;
      }

      const request = requests[requestIndex];

      // Only requester can cancel their own pending requests
      if (request.requestedBy !== username || request.status !== 'pending') {
        // console.error('Cannot cancel this request');
        return false;
      }

      // Remove the request
      requests.splice(requestIndex, 1);
      this.saveRequests(requests);

      // console.log(`🚫 File recovery request cancelled: ${request.fileName}`);
      return true;
    } catch (error) {
      // console.error('Error cancelling recovery request:', error);
      return false;
    }
  }

  // Get statistics
  static getStatistics() {
    const requests = this.getAllRequests();
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length
    };
  }
}
