import { MongoDBService } from './mongoDBService';
import { FileService } from './fileService';

export interface ClientData {
  id: string;
  clientNo?: string;
  status?: string;
  agent?: string;
  contactNo?: string;
  contactName?: string;
  email?: string;
  dateOfBirth?: string;
  packageName?: string;
  travelDate?: string;
  numberOfPax?: number;
  bookingConfirmation?: string;
  packageLink?: string;
  companions?: Array<{
    name: string;
    dob: string;
    address: string;
    occupation: string;
  }>;
  // Visa & Additional Services
  visaService?: boolean;
  insuranceService?: boolean;
  etaService?: boolean;
  visaFiles?: string[]; // Array of file IDs
  // Booking/Tour Voucher
  bookingVoucher?: string;
  // Important Notes/Requests
  requestNotes?: Array<{
    id: string;
    note: string;
    createdAt: string;
  }>;
  // Passport Information
  passportInfo?: Array<{
    id: string;
    fullName: string;
    passportNumber: string;
    dateOfBirth: string;
    expiryDate: string;
  }>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
  isDeleted?: boolean;
}

export interface ClientSearchFilters {
  searchTerm?: string;
  status?: string;
  agent?: string;
}

export class ClientService {
  private static STORAGE_KEY = 'crm_clients_data';
  private static LAST_SYNC_KEY = 'crm_clients_last_sync';
  private static SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static syncInProgress = false;

  // Load clients from MongoDB and sync to localStorage
  static async syncFromMongoDB(): Promise<void> {
    // Prevent concurrent syncs
    if (this.syncInProgress) {
      console.log('⏳ Sync already in progress, skipping...');
      return;
    }
    
    this.syncInProgress = true;
    window.dispatchEvent(new Event('syncStart'));
    
    try {
      console.log('🔄 Syncing clients from MongoDB...');
      const response = await fetch('/.netlify/functions/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'clients',
          operation: 'find',
          filter: {}
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch clients from MongoDB: HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Update localStorage with MongoDB data
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(result.data));
        localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
        console.log(`✅ Synced ${result.data.length} clients from MongoDB`);
        window.dispatchEvent(new Event('syncSuccess'));
      } else {
        throw new Error(result.error || 'No data returned from MongoDB');
      }
    } catch (error) {
      console.warn('⚠️ Failed to sync from MongoDB, using localStorage:', error);
      window.dispatchEvent(new Event('syncError'));
    } finally {
      this.syncInProgress = false;
    }
  }

  // Check if sync is needed
  static shouldSync(): boolean {
    // Prevent concurrent syncs
    if (this.syncInProgress) return false;
    
    const lastSync = localStorage.getItem(this.LAST_SYNC_KEY);
    if (!lastSync) return true;
    
    const lastSyncTime = new Date(lastSync).getTime();
    const now = Date.now();
    return (now - lastSyncTime) > this.SYNC_INTERVAL;
  }

  static async saveClient(clientData: Omit<ClientData, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ clientId: string; isNewClient: boolean }> {
    try {
      const clients = this.getAllClientsIncludingDeleted();
      
      // Check if client already exists by clientNo
      const existingClientIndex = clients.findIndex(c => c.clientNo === clientData.clientNo);
      
      if (existingClientIndex !== -1) {
        // Update existing client
        const existingClient = clients[existingClientIndex];
        clients[existingClientIndex] = {
          ...existingClient,
          ...clientData,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
        
        // Update in MongoDB
        try {
          await MongoDBService.updateClient(existingClient.id, {
            ...clientData,
            updatedAt: new Date().toISOString()
          });
        } catch {
          // console.error('MongoDB sync failed:', err);
          window.dispatchEvent(new CustomEvent('showToast', {
            detail: {
              type: 'warning',
              message: 'Changes saved locally but failed to sync with database. Will retry automatically.'
            }
          }));
        }
        
        return { clientId: existingClient.id, isNewClient: false };
      } else {
        // Create new client
        const clientId = this.generateClientId();
        const timestamp = new Date().toISOString();

        const newClient: ClientData = {
          ...clientData,
          id: clientId,
          createdAt: timestamp,
          updatedAt: timestamp
        };

        clients.push(newClient);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
        
        // Save to MongoDB
        try {
          await MongoDBService.saveClient(newClient);
        } catch {
          // console.error('MongoDB sync failed:', err);
          window.dispatchEvent(new CustomEvent('showToast', {
            detail: {
              type: 'warning',
              message: 'Client saved locally but failed to sync with database. Will retry automatically.'
            }
          }));
        }
        
        return { clientId, isNewClient: true };
      }
    } catch (error) {
      // console.error('Error saving client:', error);
      throw new Error('Failed to save client data');
    }
  }

  static async updateClient(clientId: string, clientData: Partial<ClientData>): Promise<{ success: boolean; oldValues?: Record<string, any> }> {
    try {
      const clients = this.getAllClientsIncludingDeleted();
      const clientIndex = clients.findIndex(client => client.id === clientId);
      
      if (clientIndex === -1) {
        throw new Error('Client not found');
      }

      const oldClient = { ...clients[clientIndex] };
      
      clients[clientIndex] = {
        ...clients[clientIndex],
        ...clientData,
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
      
      // Update in MongoDB
      try {
        await MongoDBService.updateClient(clientId, {
          ...clientData,
          updatedAt: new Date().toISOString()
        });
      } catch {
        // console.error('MongoDB sync failed:', err);
        window.dispatchEvent(new CustomEvent('showToast', {
          detail: {
            type: 'warning',
            message: 'Changes saved locally but failed to sync with database. Will retry automatically.'
          }
        }));
      }
      
      // Return old values for change tracking
      const oldValues: Record<string, any> = {};
      Object.keys(clientData).forEach(key => {
        if (key !== 'updatedAt') {
          oldValues[key] = oldClient[key as keyof ClientData];
        }
      });
      
      return { success: true, oldValues };
    } catch (error) {
      // console.error('Error updating client:', error);
      throw new Error('Failed to update client data');
    }
  }

  static getAllClients(): ClientData[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const allClients = data ? JSON.parse(data) : [];
      // Filter out deleted clients by default
      return allClients.filter((client: ClientData) => !client.isDeleted);
    } catch (error) {
      // console.error('Error loading clients:', error);
      return [];
    }
  }

  // Get all clients with MongoDB sync
  static async getAllClientsWithSync(): Promise<ClientData[]> {
    // Sync from MongoDB if needed
    if (this.shouldSync()) {
      await this.syncFromMongoDB();
    }
    return this.getAllClients();
  }

  static getAllClientsIncludingDeleted(): ClientData[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      // console.error('Error loading clients:', error);
      return [];
    }
  }

  static getDeletedClients(): ClientData[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const allClients = data ? JSON.parse(data) : [];
      return allClients.filter((client: ClientData) => client.isDeleted);
    } catch (error) {
      // console.error('Error loading deleted clients:', error);
      return [];
    }
  }

  static getClientById(clientId: string): ClientData | null {
    const clients = this.getAllClients();
    return clients.find(client => client.id === clientId) || null;
  }

  static searchClients(filters: ClientSearchFilters): ClientData[] {
    const clients = this.getAllClients();
    
    return clients.filter(client => {
      // Search term filter (searches across name, email, client number)
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = 
          (client.contactName?.toLowerCase().includes(searchLower)) ||
          (client.email?.toLowerCase().includes(searchLower)) ||
          (client.clientNo?.toLowerCase().includes(searchLower));
        
        if (!matchesSearch) {
          return false;
        }
      }

      // Status filter
      if (filters.status && client.status !== filters.status) {
        return false;
      }

      // Agent filter
      if (filters.agent && client.agent !== filters.agent) {
        return false;
      }

      return true;
    });
  }

  // Search clients with MongoDB sync
  static async searchClientsWithSync(filters: ClientSearchFilters): Promise<ClientData[]> {
    // Sync from MongoDB if needed
    if (this.shouldSync()) {
      await this.syncFromMongoDB();
    }
    return this.searchClients(filters);
  }

  static deleteClient(clientId: string, deletedBy?: string): boolean {
    try {
      const clients = this.getAllClientsIncludingDeleted();
      const clientIndex = clients.findIndex(client => client.id === clientId);
      
      if (clientIndex === -1) {
        console.warn('⚠️ Client not found for deletion:', clientId);
        return false;
      }

      // Soft delete - mark as deleted instead of removing
      const deletionTime = new Date().toISOString();
      const deletedByUser = deletedBy || 'Unknown';
      
      clients[clientIndex] = {
        ...clients[clientIndex],
        isDeleted: true,
        deletedAt: deletionTime,
        deletedBy: deletedByUser
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
      console.log('✅ Client soft deleted in localStorage:', clientId);
      
      // Soft delete in MongoDB (async)
      MongoDBService.deleteClient(clientId, deletedByUser)
        .then(result => {
          if (result.success) {
            console.log('✅ Client soft deleted in MongoDB:', clientId);
          } else {
            console.error('⚠️ MongoDB soft delete failed:', result.message);
          }
        })
        .catch(error => {
          console.error('❌ MongoDB soft delete error:', error);
        });
      
      return true;
    } catch (error) {
      console.error('❌ Error deleting client:', error);
      return false;
    }
  }

  static async recoverClient(clientId: string): Promise<boolean> {
    try {
      const clients = this.getAllClientsIncludingDeleted();
      const clientIndex = clients.findIndex(client => client.id === clientId);
      
      if (clientIndex === -1) {
        return false;
      }

      // Remove deletion marks
      delete clients[clientIndex].isDeleted;
      delete clients[clientIndex].deletedAt;
      delete clients[clientIndex].deletedBy;
      clients[clientIndex].updatedAt = new Date().toISOString();

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
      
      // Sync recovery to MongoDB
      try {
        await MongoDBService.updateClient(clientId, {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          updatedAt: clients[clientIndex].updatedAt
        });
      } catch {
        // console.error('MongoDB sync failed:', err);
        window.dispatchEvent(new CustomEvent('showToast', {
          detail: {
            type: 'warning',
            message: 'Client recovered locally but failed to sync with database. Will retry automatically.'
          }
        }));
      }
      
      return true;
    } catch (error) {
      // console.error('Error recovering client:', error);
      return false;
    }
  }

  static async permanentlyDeleteClient(clientId: string): Promise<boolean> {
    try {
      const clients = this.getAllClientsIncludingDeleted();
      const filteredClients = clients.filter(client => client.id !== clientId);
      
      if (filteredClients.length === clients.length) {
        console.warn('⚠️ Client not found for permanent deletion:', clientId);
        window.dispatchEvent(new CustomEvent('showToast', {
          detail: {
            type: 'error',
            message: 'Client not found. Cannot permanently delete.'
          }
        }));
        return false;
      }

      // Save to localStorage immediately
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredClients));
      console.log('✅ Client removed from localStorage:', clientId);

      // Permanently delete from MongoDB
      try {
        const result = await MongoDBService.permanentlyDeleteClient(clientId);
        if (result.success) {
          console.log('✅ Client permanently deleted from MongoDB:', clientId);
          window.dispatchEvent(new CustomEvent('showToast', {
            detail: {
              type: 'success',
              message: 'Client permanently deleted successfully.'
            }
          }));
        } else {
          throw new Error(result.message || 'MongoDB deletion failed');
        }
      } catch (error) {
        console.error('❌ Failed to delete from MongoDB:', error);
        window.dispatchEvent(new CustomEvent('showToast', {
          detail: {
            type: 'error',
            message: 'Client deleted locally but failed to delete from database. Retrying automatically...'
          }
        }));
        
        // Retry after 3 seconds
        setTimeout(() => {
          MongoDBService.permanentlyDeleteClient(clientId).then(result => {
            if (result.success) {
              console.log('✅ Retry successful - Client deleted from MongoDB:', clientId);
              window.dispatchEvent(new CustomEvent('showToast', {
                detail: {
                  type: 'success',
                  message: 'Database sync completed.'
                }
              }));
            }
          });
        }, 3000);
      }
      
      // Clean up orphaned files
      try {
        const clientFiles = FileService.getFilesByClient?.(clientId) || [];
        if (clientFiles.length > 0) {
          clientFiles.forEach(fileAttachment => {
            if (fileAttachment.file && fileAttachment.file.id) {
              FileService.deleteFile?.(fileAttachment.file.id, 'System');
            }
          });
          console.log(`✅ Cleaned up ${clientFiles.length} orphaned files for client ${clientId}`);
        }
      } catch (error) {
        console.warn('⚠️ Failed to clean up client files:', error);
      }
      
      // Trigger sync to refresh data
      this.syncFromMongoDB().catch(() => {
        // Sync failed, but deletion already completed
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error permanently deleting client:', error);
      window.dispatchEvent(new CustomEvent('showToast', {
        detail: {
          type: 'error',
          message: 'Failed to permanently delete client.'
        }
      }));
      return false;
    }
  }

  private static generateClientId(): string {
    return 'CLT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  // Get summary statistics
  static getClientStats() {
    const clients = this.getAllClients();
    const statusCounts = clients.reduce((acc, client) => {
      const status = client.status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: clients.length,
      statusCounts,
      recentClients: clients
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    };
  }
}