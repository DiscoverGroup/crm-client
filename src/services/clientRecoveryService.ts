import { ClientService } from './clientService';
import { ActivityLogService } from './activityLogService';
import { NotificationService } from './notificationService';

export interface ClientRecoveryRequest {
  id: string;
  clientId: string;
  clientName: string;
  clientNo?: string;
  requestedBy: string;
  requestedByUserId: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export class ClientRecoveryService {
  private static STORAGE_KEY = 'crm_client_recovery_requests';

  // Generate unique ID for recovery request
  private static generateRequestId(): string {
    return `client_recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
  static getAllRequests(): ClientRecoveryRequest[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      // console.error('Error loading client recovery requests:', error);
      return [];
    }
  }

  // Get pending recovery requests
  static getPendingRequests(): ClientRecoveryRequest[] {
    return this.getAllRequests().filter(req => req.status === 'pending');
  }

  // Get requests by user
  static getRequestsByUser(username: string): ClientRecoveryRequest[] {
    return this.getAllRequests().filter(req => req.requestedBy === username);
  }

  // Save all recovery requests
  private static saveRequests(requests: ClientRecoveryRequest[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(requests));
    } catch (error) {
      // console.error('Error saving client recovery requests:', error);
      throw error;
    }
  }

  // Create a new recovery request
  static createRecoveryRequest(
    clientId: string,
    clientName: string,
    clientNo: string | undefined,
    requestedBy: string,
    notes?: string
  ): ClientRecoveryRequest {
    const request: ClientRecoveryRequest = {
      id: this.generateRequestId(),
      clientId,
      clientName,
      clientNo,
      requestedBy,
      requestedByUserId: this.getCurrentUserId(requestedBy),
      requestedAt: new Date().toISOString(),
      status: 'pending',
      notes
    };

    const requests = this.getAllRequests();
    requests.push(request);
    this.saveRequests(requests);

    // console.log(`📝 Client recovery request created: ${clientName} by ${requestedBy}`);
    return request;
  }

  // Approve recovery request
  static async approveRequest(
    requestId: string,
    reviewedBy: string
  ): Promise<boolean> {
    try {
      const requests = this.getAllRequests();
      const requestIndex = requests.findIndex(req => req.id === requestId);
      
      if (requestIndex === -1) {
        // console.error('Recovery request not found');
        return false;
      }

      const request = requests[requestIndex];

      // Recover the client
      const success = await ClientService.recoverClient(request.clientId);
      if (!success) {
        // console.error('Failed to recover client');
        return false;
      }

      // Update request status
      requests[requestIndex] = {
        ...request,
        status: 'approved',
        reviewedBy,
        reviewedAt: new Date().toISOString()
      };

      this.saveRequests(requests);

      // Log the activity
      ActivityLogService.addLog({
        clientId: request.clientId,
        clientName: request.clientName,
        action: 'recovered',
        performedBy: reviewedBy,
        performedByUser: reviewedBy,
        details: `Client recovered by admin (requested by ${request.requestedBy})`
      });

      // Send notification to requester
      NotificationService.addNotification({
        type: 'recovery_approved',
        title: '✅ Client Recovery Approved',
        message: `Your request to recover client "${request.clientName}" has been approved by ${reviewedBy}.`,
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

      // console.log(`✅ Client recovery approved: ${request.clientName} by ${reviewedBy}`);
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
        action: 'client_recovery_rejected',
        performedBy: reviewedBy,
        performedByUser: reviewedBy,
        details: `Client recovery rejected by admin (requested by ${request.requestedBy})${reason ? ` - Reason: ${reason}` : ''}`
      });

      // Send notification to requester
      NotificationService.addNotification({
        type: 'recovery_rejected',
        title: '❌ Client Recovery Rejected',
        message: `Your request to recover client "${request.clientName}" has been rejected by ${reviewedBy}.${reason ? ` Reason: ${reason}` : ''}`,
        targetUserId: request.requestedByUserId,
        targetUserName: request.requestedBy,
        fromUserId: this.getCurrentUserId(reviewedBy),
        fromUserName: reviewedBy,
        clientId: request.clientId,
        clientName: request.clientName
      });

      // console.log(`❌ Client recovery rejected: ${request.clientName} by ${reviewedBy}`);
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

      // console.log(`🚫 Client recovery request cancelled: ${request.clientName}`);
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
