// MongoDB Service for syncing data with MongoDB Atlas
export class MongoDBService {
  private static readonly FUNCTIONS_BASE = '/.netlify/functions';

  // Save user to MongoDB
  static async saveUser(userData: any): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.FUNCTIONS_BASE}/database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'users',
          operation: 'insertOne',
          data: userData
        })
      });

      const result = await response.json();
      return { success: result.success || response.ok, message: result.message };
    } catch (error) {
      // console.error('Error saving user to MongoDB:', error);
      return { success: false, message: 'Failed to sync with MongoDB' };
    }
  }

  // Update user in MongoDB
  static async updateUser(email: string, updates: any): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.FUNCTIONS_BASE}/database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'users',
          operation: 'updateOne',
          filter: { email },
          update: updates
        })
      });

      const result = await response.json();
      return { success: result.success || response.ok, message: result.message };
    } catch (error) {
      // console.error('Error updating user in MongoDB:', error);
      return { success: false, message: 'Failed to sync with MongoDB' };
    }
  }

  // Check if user exists in MongoDB
  static async findUser(email: string): Promise<any> {
    try {
      const response = await fetch(`${this.FUNCTIONS_BASE}/database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'users',
          operation: 'findOne',
          filter: { email }
        })
      });

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      // console.error('Error finding user in MongoDB:', error);
      return null;
    }
  }

  // Save client to MongoDB
  static async saveClient(clientData: any): Promise<{ success: boolean; message?: string }> {
    try {
      // Don't save images/files - only client information
      const { profileImage, attachments, ...clientInfo } = clientData;
      
      const response = await fetch(`${this.FUNCTIONS_BASE}/database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'clients',
          operation: 'insertOne',
          data: clientInfo
        })
      });

      const result = await response.json();
      return { success: result.success || response.ok, message: result.message };
    } catch (error) {
      // console.error('Error saving client to MongoDB:', error);
      return { success: false, message: 'Failed to sync with MongoDB' };
    }
  }

  // Update client in MongoDB
  static async updateClient(clientId: string, updates: any): Promise<{ success: boolean; message?: string }> {
    try {
      // Don't save images/files - only client information
      const { profileImage, attachments, ...clientInfo } = updates;
      
      const response = await fetch(`${this.FUNCTIONS_BASE}/database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'clients',
          operation: 'updateOne',
          filter: { id: clientId },
          update: clientInfo
        })
      });

      const result = await response.json();
      return { success: result.success || response.ok, message: result.message };
    } catch (error) {
      // console.error('Error updating client in MongoDB:', error);
      return { success: false, message: 'Failed to sync with MongoDB' };
    }
  }

  // Find client in MongoDB
  static async findClient(clientId: string): Promise<any> {
    try {
      const response = await fetch(`${this.FUNCTIONS_BASE}/database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'clients',
          operation: 'findOne',
          filter: { id: clientId }
        })
      });

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      // console.error('Error finding client in MongoDB:', error);
      return null;
    }
  }

  // Get all clients from MongoDB
  static async getAllClients(): Promise<any[]> {
    try {
      const response = await fetch(`${this.FUNCTIONS_BASE}/database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'clients',
          operation: 'find',
          filter: {}
        })
      });

      const result = await response.json();
      return result.success ? result.data : [];
    } catch (error) {
      // console.error('Error getting clients from MongoDB:', error);
      return [];
    }
  }

  // Delete client in MongoDB (soft delete)
  static async deleteClient(clientId: string, deletedBy: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.FUNCTIONS_BASE}/database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'clients',
          operation: 'updateOne',
          filter: { id: clientId },
          update: {
            isDeleted: true,
            deletedAt: new Date().toISOString(),
            deletedBy: deletedBy
          }
        })
      });

      const result = await response.json();
      return { success: result.success || response.ok, message: result.message };
    } catch (error) {
      // console.error('Error deleting client in MongoDB:', error);
      return { success: false, message: 'Failed to sync with MongoDB' };
    }
  }

  // Permanently delete client from MongoDB
  static async permanentlyDeleteClient(clientId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.FUNCTIONS_BASE}/database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'clients',
          operation: 'deleteOne',
          filter: { id: clientId }
        })
      });

      const result = await response.json();
      return { success: result.success || response.ok, message: result.message };
    } catch (error) {
      // console.error('Error permanently deleting client from MongoDB:', error);
      return { success: false, message: 'Failed to sync with MongoDB' };
    }
  }
  
  // Save payment data to MongoDB
  static async savePaymentData(clientId: string, paymentData: any): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.FUNCTIONS_BASE}/database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'payments',
          operation: 'updateOne',
          filter: { clientId },
          update: {
            clientId,
            ...paymentData,
            updatedAt: new Date().toISOString()
          },
          upsert: true // Create if doesn't exist, update if exists
        })
      });

      const result = await response.json();
      return { success: result.success || response.ok, message: result.message };
    } catch (error) {
      // console.error('Error saving payment data to MongoDB:', error);
      return { success: false, message: 'Failed to sync with MongoDB' };
    }
  }
}
