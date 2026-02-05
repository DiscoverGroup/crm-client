import { MongoDBService } from './mongoDBService';

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

  // Load clients from MongoDB and sync to localStorage
  static async syncFromMongoDB(): Promise<void> {
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
        throw new Error('Failed to fetch clients from MongoDB');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Update localStorage with MongoDB data
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(result.data));
        localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
        console.log(`✅ Synced ${result.data.length} clients from MongoDB`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to sync from MongoDB, using localStorage:', error);
    }
  }

  // Check if sync is needed
  static shouldSync(): boolean {
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
        MongoDBService.updateClient(existingClient.id, {
          ...clientData,
          updatedAt: new Date().toISOString()
        }).catch(err => console.error('MongoDB sync failed:', err));
        
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
        MongoDBService.saveClient(newClient).catch(err => console.error('MongoDB sync failed:', err));
        
        return { clientId, isNewClient: true };
      }
    } catch (error) {
      console.error('Error saving client:', error);
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
      MongoDBService.updateClient(clientId, {
        ...clientData,
        updatedAt: new Date().toISOString()
      }).catch(err => console.error('MongoDB sync failed:', err));
      
      // Return old values for change tracking
      const oldValues: Record<string, any> = {};
      Object.keys(clientData).forEach(key => {
        if (key !== 'updatedAt') {
          oldValues[key] = oldClient[key as keyof ClientData];
        }
      });
      
      return { success: true, oldValues };
    } catch (error) {
      console.error('Error updating client:', error);
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
      console.error('Error loading clients:', error);
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
      console.error('Error loading clients:', error);
      return [];
    }
  }

  static getDeletedClients(): ClientData[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const allClients = data ? JSON.parse(data) : [];
      return allClients.filter((client: ClientData) => client.isDeleted);
    } catch (error) {
      console.error('Error loading deleted clients:', error);
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
        return false; // Client not found
      }

      // Soft delete - mark as deleted instead of removing
      clients[clientIndex] = {
        ...clients[clientIndex],
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: deletedBy || 'Unknown'
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
      
      // Soft delete in MongoDB
      MongoDBService.deleteClient(clientId, deletedBy || 'Unknown')
        .catch(err => console.error('MongoDB sync failed:', err));
      
      return true;
    } catch (error) {
      console.error('Error deleting client:', error);
      return false;
    }
  }

  static recoverClient(clientId: string): boolean {
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
      return true;
    } catch (error) {
      console.error('Error recovering client:', error);
      return false;
    }
  }

  static permanentlyDeleteClient(clientId: string): boolean {
    try {
      const clients = this.getAllClientsIncludingDeleted();
      const filteredClients = clients.filter(client => client.id !== clientId);
      
      if (filteredClients.length === clients.length) {
        return false; // Client not found
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredClients));
      return true;
    } catch (error) {
      console.error('Error permanently deleting client:', error);
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