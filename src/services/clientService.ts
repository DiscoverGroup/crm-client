import { MongoDBService } from './mongoDBService';
import { FileService } from './fileService';
import { authHeaders } from '../utils/authToken';
import { realtimeSync } from './realtimeSyncService';

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
  travelDate?: string; // legacy — kept for backward compat
  travelStartDate?: string;
  travelEndDate?: string;
  numberOfPax?: number;
  bookingConfirmation?: string;
  bookingConfirmations?: string[];
  packageLink?: string;
  clientRequest?: string;
  companions?: Array<{
    firstName?: string;
    lastName?: string;
    name?: string; // legacy field — kept for backward compat
    dob?: string;
    email?: string;
    contactNo?: string;
    address?: string; // legacy
    occupation?: string; // legacy
  }>;
  passportNames?: string[];
  // Visa & Additional Services
  visaService?: boolean;
  insuranceService?: boolean;
  etaService?: boolean;
  visaFiles?: string[]; // Array of file IDs
  // Embassy Information
  embassyName?: string;
  embassyAddress?: string;
  // Visa Officer
  visaOfficerAppointed?: string;
  // Account Relations
  arm?: string;
  afterSalesSCDate?: string;
  afterSalesSCReport?: string;
  afterSalesSCReportBy?: string;
  // Visa SC Reports
  afterVisaSCDate?: string;
  afterVisaSCReport?: string;
  afterVisaSCReportBy?: string;
  preDepartureSCDate?: string;
  preDepartureSCReport?: string;
  preDepartureSCReportBy?: string;
  postDepartureSCDate?: string;
  postDepartureSCReport?: string;
  postDepartureSCReportBy?: string;
  // Travel Funds (when status === "Travel Funds")
  travelFundRequestDate?: string;
  travelFundApprovalDate?: string;
  travelFundReleasedAmount?: string;
  travelFundTotalAmount?: string;
  travelFundPayments?: Array<{ date: string; amount: string }>;
  // Booking/Tour Voucher
  bookingVoucher?: string;
  bookingVoucherLinks?: {
    intlFlight?: string;
    localFlight1?: string;
    localFlight2?: string;
    localFlight3?: string;
    localFlight4?: string;
    localFlights?: string[];
    tourVoucher?: string;
    hotelVoucher?: string;
    otherFiles?: string;
  };
  // Important Notes/Requests
  requestNotes?: Array<{
    department: string;
    request: string;
    date: string;
    agent: string;
  }>;
  // Notes/Requests thread (right-panel)
  noteThreads?: any[];
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
  isArchived?: boolean;
  isTestRecord?: boolean;
  archivedAt?: string;
  archivedBy?: string;
}

export interface ClientSearchFilters {
  searchTerm?: string;
  status?: string;
  agent?: string;
}

export class ClientService {
  private static STORAGE_KEY = 'crm_clients_data';
  private static LAST_SYNC_KEY = 'crm_clients_last_sync';
  private static SYNC_INTERVAL = 60 * 1000; // 1 minute
  private static syncInProgress = false;

  // Load clients from MongoDB and sync to localStorage
  private static syncPromise: Promise<void> | null = null;

  static async syncFromMongoDB(): Promise<void> {
    // If a sync is already in progress, wait for it instead of skipping.
    // This ensures callers always get fresh data after the promise resolves.
    if (this.syncInProgress && this.syncPromise) {
      return this.syncPromise;
    }
    
    this.syncInProgress = true;
    window.dispatchEvent(new Event('syncStart'));

    this.syncPromise = (async () => {
      try {
        const response = await fetch('/.netlify/functions/database', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
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
          // Strip MongoDB _id before storing — _id in localStorage would leak
          // into subsequent $set operations and cause MongoDB update failures.
          const cleanData = (result.data as any[]).map(({ _id, ...rest }: any) => rest);
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cleanData));
          localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
          window.dispatchEvent(new Event('syncSuccess'));
        } else {
          throw new Error(result.error || 'No data returned from MongoDB');
        }
      } catch {
        window.dispatchEvent(new Event('syncError'));
      } finally {
        this.syncInProgress = false;
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
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

  /** Free localStorage space by trimming non-critical monitoring/log data */
  private static freeStorageSpace() {
    const keysToTrim = ['crm_monitoring_data', 'crm_activity_logs', 'crm_performance_metrics'];
    for (const key of keysToTrim) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) {
          localStorage.setItem(key, JSON.stringify(arr.slice(0, Math.max(1, Math.floor(arr.length / 4)))));
        } else {
          localStorage.removeItem(key);
        }
      } catch { /* ignore */ }
    }
  }

  /** Safe localStorage.setItem — on QuotaExceededError frees space and retries once */
  private static safeSetClients(payload: string) {
    try {
      localStorage.setItem(this.STORAGE_KEY, payload);
    } catch (e: any) {
      if (e && e.name === 'QuotaExceededError') {
        this.freeStorageSpace();
        try {
          localStorage.setItem(this.STORAGE_KEY, payload);
        } catch {
          // Local cache write failed even after trimming — MongoDB save will still proceed
        }
      }
      // Any other error is also silently skipped; MongoDB is the source of truth
    }
  }

  static async saveClient(clientData: Omit<ClientData, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ clientId: string; isNewClient: boolean }> {
    try {
      const clients = this.getAllClientsIncludingDeleted();
      
      // Check if client already exists by clientNo
      // Guard: only match on clientNo when it is a non-empty string to prevent
      // two clients with no clientNo being treated as the same record.
      const existingClientIndex =
        clientData.clientNo && clientData.clientNo.trim() !== ''
          ? clients.findIndex(c => c.clientNo === clientData.clientNo)
          : -1;
      
      if (existingClientIndex !== -1) {
        // Update existing client
        const existingClient = clients[existingClientIndex];
        clients[existingClientIndex] = {
          ...existingClient,
          ...clientData,
          updatedAt: new Date().toISOString()
        };
        this.safeSetClients(JSON.stringify(clients));
        
        // Update in MongoDB
        try {
          await MongoDBService.updateClient(existingClient.id, {
            ...clientData,
            updatedAt: new Date().toISOString()
          });
          realtimeSync.signalChange('clients');
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
        this.safeSetClients(JSON.stringify(clients));
        
        // Save to MongoDB
        try {
          await MongoDBService.saveClient(newClient);
          realtimeSync.signalChange('clients');
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

      this.safeSetClients(JSON.stringify(clients));
      
      // Update in MongoDB
      try {
        await MongoDBService.updateClient(clientId, {
          ...clientData,
          updatedAt: new Date().toISOString()
        });
        realtimeSync.signalChange('clients');
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
      // Filter out deleted, archived, and test records by default
      return allClients.filter((client: ClientData) => !client.isDeleted && !client.isArchived && !client.isTestRecord);
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

  static getTestRecords(): ClientData[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const allClients = data ? JSON.parse(data) : [];
      return allClients.filter((client: ClientData) => client.isTestRecord && !client.isDeleted);
    } catch (error) {
      return [];
    }
  }

  static getArchivedClients(): ClientData[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const allClients = data ? JSON.parse(data) : [];
      return allClients.filter((client: ClientData) => client.isArchived && !client.isDeleted);
    } catch (error) {
      return [];
    }
  }

  static archiveClient(clientId: string, archivedBy?: string): boolean {
    try {
      const clients = this.getAllClientsIncludingDeleted();
      const clientIndex = clients.findIndex(client => client.id === clientId);
      if (clientIndex === -1) return false;

      const archivedByUser = archivedBy || 'Unknown';
      clients[clientIndex] = {
        ...clients[clientIndex],
        isArchived: true,
        archivedAt: new Date().toISOString(),
        archivedBy: archivedByUser
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));

      MongoDBService.updateClient(clientId, {
        isArchived: true,
        archivedAt: clients[clientIndex].archivedAt,
        archivedBy: archivedByUser,
        updatedAt: clients[clientIndex].updatedAt
      }).then(() => {
        realtimeSync.signalChange('clients');
      }).catch(() => {});

      return true;
    } catch {
      return false;
    }
  }

  static async unarchiveClient(clientId: string): Promise<boolean> {
    try {
      const clients = this.getAllClientsIncludingDeleted();
      const clientIndex = clients.findIndex(client => client.id === clientId);
      if (clientIndex === -1) return false;

      delete clients[clientIndex].isArchived;
      delete clients[clientIndex].archivedAt;
      delete clients[clientIndex].archivedBy;
      clients[clientIndex].updatedAt = new Date().toISOString();

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));

      await MongoDBService.updateClient(clientId, {
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        updatedAt: clients[clientIndex].updatedAt
      });
      realtimeSync.signalChange('clients');

      return true;
    } catch {
      return false;
    }
  }

  static getClientById(clientId: string): ClientData | null {
    const clients = this.getAllClients();
    return clients.find(client => client.id === clientId) || null;
  }

  static searchClients(filters: ClientSearchFilters): ClientData[] {
    const clients = this.getAllClients();
    
    return clients.filter(client => {
      // Search term filter (searches across name, email, client number, phone)
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = 
          (client.contactName?.toLowerCase().includes(searchLower)) ||
          (client.email?.toLowerCase().includes(searchLower)) ||
          (client.clientNo?.toLowerCase().includes(searchLower)) ||
          (client.contactNo?.toLowerCase().includes(searchLower)) ||
          (client.agent?.toLowerCase().includes(searchLower)) ||
          (client.packageName?.toLowerCase().includes(searchLower));
        
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
      
      // Soft delete in MongoDB (async, fire-and-forget)
      MongoDBService.deleteClient(clientId, deletedByUser).then(() => {
        realtimeSync.signalChange('clients');
      }).catch(() => {
        // Sync failure is non-critical; localStorage is already updated
      });
      
      return true;
    } catch (error) {
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
        realtimeSync.signalChange('clients');
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

      // Permanently delete from MongoDB
      try {
        const result = await MongoDBService.permanentlyDeleteClient(clientId);
        if (!result.success) {
          throw new Error(result.message || 'MongoDB deletion failed');
        }
      } catch (error) {
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
        }
      } catch {
        // Non-critical: file cleanup failure doesn't affect client deletion
      }
      
      // Do NOT call syncFromMongoDB here — it would re-fetch from MongoDB
      // before the deletion propagates, restoring the deleted record in localStorage.
      // The next scheduled sync will pick up the correct state.
      
      return true;
    } catch (error) {
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
    return 'CLT-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
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
