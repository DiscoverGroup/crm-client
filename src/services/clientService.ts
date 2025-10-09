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
  createdAt: string;
  updatedAt: string;
}

export interface ClientSearchFilters {
  searchTerm?: string;
  status?: string;
  agent?: string;
}

export class ClientService {
  private static STORAGE_KEY = 'crm_clients_data';

  static async saveClient(clientData: Omit<ClientData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const clients = this.getAllClients();
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
      
      return clientId;
    } catch (error) {
      console.error('Error saving client:', error);
      throw new Error('Failed to save client data');
    }
  }

  static async updateClient(clientId: string, clientData: Partial<ClientData>): Promise<boolean> {
    try {
      const clients = this.getAllClients();
      const clientIndex = clients.findIndex(client => client.id === clientId);
      
      if (clientIndex === -1) {
        throw new Error('Client not found');
      }

      clients[clientIndex] = {
        ...clients[clientIndex],
        ...clientData,
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
      return true;
    } catch (error) {
      console.error('Error updating client:', error);
      throw new Error('Failed to update client data');
    }
  }

  static getAllClients(): ClientData[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading clients:', error);
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
          client.contactName?.toLowerCase().includes(searchLower) ||
          client.email?.toLowerCase().includes(searchLower) ||
          client.clientNo?.toLowerCase().includes(searchLower) ||
          client.contactNo?.includes(filters.searchTerm);
        
        if (!matchesSearch) return false;
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

  static deleteClient(clientId: string): boolean {
    try {
      const clients = this.getAllClients();
      const filteredClients = clients.filter(client => client.id !== clientId);
      
      if (filteredClients.length === clients.length) {
        return false; // Client not found
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredClients));
      return true;
    } catch (error) {
      console.error('Error deleting client:', error);
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