// Territory Management Types

export type TerritoryType = 'geographic' | 'regional' | 'custom';
export type RuleOperator = 'equals' | 'contains' | 'startsWith' | 'in' | 'range';
export type AssignmentMethod = 'round_robin' | 'load_balance' | 'skill_based' | 'manual';

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface Territory {
  id: string;
  name: string;
  description: string;
  type: TerritoryType;
  
  // Geographic boundaries
  boundaries?: {
    cities?: string[];
    regions?: string[];
    postalCodes?: string[];
    countries?: string[];
  };
  
  // Geographic coordinates (for map visualization)
  coordinates?: GeoLocation[];
  radius?: number; // radius in km from center point
  
  // Team assignments
  teamMembers: TeamMemberAssignment[];
  leadId?: string; // Territory lead
  
  // Capacity and rules
  maxClientsPerMember?: number;
  targetLoadPercentage?: number;
  
  // Status and metadata
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
}

export interface TeamMemberAssignment {
  userId: string;
  userName: string;
  email?: string;
  role: 'lead' | 'member' | 'junior';
  specialties?: string[]; // e.g., visa services, travel insurance, etc.
  currentClientCount: number;
  maxCapacity: number;
  active: boolean;
  joinedAt: Date;
}

export interface AssignmentRule {
  id: string;
  name: string;
  description: string;
  priority: number; // Higher = evaluated first
  
  // Rule conditions
  conditions: RuleCondition[];
  logicalOperator: 'AND' | 'OR';
  
  // Assignment action
  action: AssignmentAction;
  
  // Metadata
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface RuleCondition {
  id: string;
  field: 'location' | 'packageType' | 'clientType' | 'specialty' | 'language' | 'custom';
  operator: RuleOperator;
  value: string | string[];
  caseSensitive?: boolean;
}

export interface AssignmentAction {
  type: 'assign_to_user' | 'assign_to_territory' | 'assign_by_specialty' | 'load_balance';
  
  // For assign_to_user
  userId?: string;
  
  // For assign_to_territory
  territoryId?: string;
  
  // For assign_by_specialty
  requiredSpecialties?: string[];
  
  // For load_balance
  method?: AssignmentMethod;
  
  // Notification settings
  notifyAssignee?: boolean;
  notificationMessage?: string;
}

export interface ClientAssignmentRequest {
  clientId: string;
  clientName: string;
  location?: string;
  postalCode?: string;
  city?: string;
  region?: string;
  country?: string;
  packageType?: string;
  clientType?: 'individual' | 'group' | 'corporate';
  specialRequirements?: string[];
  preferredLanguage?: string;
}

export interface AssignmentResult {
  success: boolean;
  clientId: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  territoryId?: string;
  territoryName?: string;
  reason: string; // e.g., "Matched rule: Visa specialists", "Load balanced", "Manual override"
  appliedRuleId?: string;
  timestamp: Date;
  conflict?: AssignmentConflict;
}

export interface AssignmentConflict {
  type: 'multiple_territories' | 'capacity_exceeded' | 'no_match' | 'specialty_mismatch';
  message: string;
  suggestions: string[];
}

export interface TerritoryStats {
  territoryId: string;
  territoryName: string;
  totalMembers: number;
  totalClients: number;
  averageClientsPerMember: number;
  capacityUtilization: number; // percentage
  activeRules: number;
  unassignedClients: number;
  lastAssignmentTime?: Date;
}

export interface AssignmentLog {
  id: string;
  clientId: string;
  clientName: string;
  previousAssignment?: {
    userId?: string;
    userName?: string;
    territoryId?: string;
    territoryName?: string;
  };
  newAssignment: {
    userId?: string;
    userName?: string;
    territoryId?: string;
    territoryName?: string;
  };
  reason: string;
  appliedRuleId?: string;
  assignedBy: string; // userId who performed the assignment
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}
