// MongoDB Database Service for CRM
// This service handles all database operations through Netlify functions

class DatabaseService {
  private static readonly API_BASE = '/.netlify/functions';

  static async query(collection: string, operation: string, params: any = {}) {
    try {
      const response = await fetch(`${this.API_BASE}/database`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection,
          operation,
          ...params
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Database operation failed');
      }

      return result.data;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // Users collection
  static async getUsers(filter: any = {}) {
    return await this.query('users', 'find', { filter });
  }

  static async getUser(filter: any) {
    return await this.query('users', 'findOne', { filter });
  }

  static async createUser(userData: any) {
    return await this.query('users', 'insertOne', { data: userData });
  }

  static async updateUser(filter: any, update: any) {
    return await this.query('users', 'updateOne', { filter, update });
  }

  static async deleteUser(filter: any) {
    return await this.query('users', 'deleteOne', { filter });
  }

  // Clients collection
  static async getClients(filter: any = {}) {
    return await this.query('clients', 'find', { filter });
  }

  static async getClient(filter: any) {
    return await this.query('clients', 'findOne', { filter });
  }

  static async createClient(clientData: any) {
    return await this.query('clients', 'insertOne', { data: clientData });
  }

  static async updateClient(filter: any, update: any) {
    return await this.query('clients', 'updateOne', { filter, update });
  }

  static async deleteClient(filter: any) {
    return await this.query('clients', 'deleteOne', { filter });
  }

  // Activity logs collection
  static async getActivityLogs(filter: any = {}) {
    return await this.query('activity_logs', 'find', { filter });
  }

  static async createActivityLog(logData: any) {
    return await this.query('activity_logs', 'insertOne', { data: logData });
  }

  // File attachments collection
  static async getFileAttachments(filter: any = {}) {
    return await this.query('file_attachments', 'find', { filter });
  }

  static async createFileAttachment(fileData: any) {
    return await this.query('file_attachments', 'insertOne', { data: fileData });
  }

  static async deleteFileAttachment(filter: any) {
    return await this.query('file_attachments', 'deleteOne', { filter });
  }

  // Payments collection
  static async getPayments(filter: any = {}) {
    return await this.query('payments', 'find', { filter });
  }

  static async createPayment(paymentData: any) {
    return await this.query('payments', 'insertOne', { data: paymentData });
  }

  // Migration helper
  static async migrateFromLocalStorage() {
    const localStorageData: any = {};
    
    // Collect all localStorage data
    const keys = ['crm_users', 'crm_clients', 'crm_activity_logs', 'crm_file_attachments', 'crm_payments', 'crm_log_notes'];
    
    keys.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        localStorageData[key] = data;
      }
    });

    try {
      const response = await fetch(`${this.API_BASE}/migrate-to-mongodb`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ localStorageData })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Data successfully migrated to MongoDB');
        return true;
      } else {
        console.error('❌ Migration failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Migration error:', error);
      return false;
    }
  }
}

export default DatabaseService;
