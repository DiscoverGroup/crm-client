import type {
  Territory,
  AssignmentRule,
  ClientAssignmentRequest,
  AssignmentResult,
  TeamMemberAssignment,
  TerritoryStats,
  AssignmentLog,
  RuleCondition,
} from '../types/territory';

const TERRITORY_STORAGE_KEY = 'crm_territories';
const ASSIGNMENT_RULES_STORAGE_KEY = 'crm_assignment_rules';
const ASSIGNMENT_LOGS_STORAGE_KEY = 'crm_assignment_logs';

class TerritoryService {
  // ==================== Territory CRUD ====================
  
  createTerritory(territory: Omit<Territory, 'id' | 'createdAt' | 'updatedAt'>): Territory {
    const newTerritory: Territory = {
      ...territory,
      id: `territory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const territories = this.getAllTerritories();
    territories.push(newTerritory);
    localStorage.setItem(TERRITORY_STORAGE_KEY, JSON.stringify(territories));
    
    return newTerritory;
  }
  
  updateTerritory(id: string, updates: Partial<Territory>): Territory {
    const territories = this.getAllTerritories();
    const index = territories.findIndex(t => t.id === id);
    
    if (index === -1) {
      throw new Error(`Territory with id ${id} not found`);
    }
    
    territories[index] = {
      ...territories[index],
      ...updates,
      id: territories[index].id, // Prevent id change
      createdAt: territories[index].createdAt, // Prevent creation date change
      updatedAt: new Date(),
    };
    
    localStorage.setItem(TERRITORY_STORAGE_KEY, JSON.stringify(territories));
    return territories[index];
  }
  
  deleteTerritory(id: string): boolean {
    const territories = this.getAllTerritories();
    const filtered = territories.filter(t => t.id !== id);
    
    if (filtered.length === territories.length) {
      return false; // Territory not found
    }
    
    localStorage.setItem(TERRITORY_STORAGE_KEY, JSON.stringify(filtered));
    
    // Also remove associated rules
    const rules = this.getAllRules();
    const updatedRules = rules.filter(r => r.id !== id);
    localStorage.setItem(ASSIGNMENT_RULES_STORAGE_KEY, JSON.stringify(updatedRules));
    
    return true;
  }
  
  getTerritory(id: string): Territory | null {
    const territories = this.getAllTerritories();
    return territories.find(t => t.id === id) || null;
  }
  
  getAllTerritories(): Territory[] {
    try {
      const data = localStorage.getItem(TERRITORY_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      console.error('Error parsing territories from storage');
      return [];
    }
  }
  
  getTerritoryByMember(userId: string): Territory[] {
    return this.getAllTerritories().filter(t =>
      t.teamMembers.some(m => m.userId === userId)
    );
  }
  
  // ==================== Team Member Management ====================
  
  addTeamMemberToTerritory(territoryId: string, member: TeamMemberAssignment): Territory {
    const territory = this.getTerritory(territoryId);
    if (!territory) {
      throw new Error(`Territory ${territoryId} not found`);
    }
    
    // Check if member already exists
    if (territory.teamMembers.some(m => m.userId === member.userId)) {
      throw new Error(`User ${member.userId} already assigned to this territory`);
    }
    
    territory.teamMembers.push(member);
    return this.updateTerritory(territoryId, territory);
  }
  
  removeTeamMemberFromTerritory(territoryId: string, userId: string): Territory {
    const territory = this.getTerritory(territoryId);
    if (!territory) {
      throw new Error(`Territory ${territoryId} not found`);
    }
    
    territory.teamMembers = territory.teamMembers.filter(m => m.userId !== userId);
    return this.updateTerritory(territoryId, territory);
  }
  
  updateTeamMemberAssignment(
    territoryId: string,
    userId: string,
    updates: Partial<TeamMemberAssignment>
  ): Territory {
    const territory = this.getTerritory(territoryId);
    if (!territory) {
      throw new Error(`Territory ${territoryId} not found`);
    }
    
    const memberIndex = territory.teamMembers.findIndex(m => m.userId === userId);
    if (memberIndex === -1) {
      throw new Error(`User ${userId} not found in territory`);
    }
    
    territory.teamMembers[memberIndex] = {
      ...territory.teamMembers[memberIndex],
      ...updates,
    };
    
    return this.updateTerritory(territoryId, territory);
  }
  
  // ==================== Assignment Rules ====================
  
  createAssignmentRule(rule: Omit<AssignmentRule, 'id' | 'createdAt' | 'updatedAt'>): AssignmentRule {
    const newRule: AssignmentRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const rules = this.getAllRules();
    rules.push(newRule);
    localStorage.setItem(ASSIGNMENT_RULES_STORAGE_KEY, JSON.stringify(rules));
    
    return newRule;
  }
  
  updateAssignmentRule(id: string, updates: Partial<AssignmentRule>): AssignmentRule {
    const rules = this.getAllRules();
    const index = rules.findIndex(r => r.id === id);
    
    if (index === -1) {
      throw new Error(`Rule with id ${id} not found`);
    }
    
    rules[index] = {
      ...rules[index],
      ...updates,
      id: rules[index].id,
      createdAt: rules[index].createdAt,
      updatedAt: new Date(),
    };
    
    localStorage.setItem(ASSIGNMENT_RULES_STORAGE_KEY, JSON.stringify(rules));
    return rules[index];
  }
  
  deleteAssignmentRule(id: string): boolean {
    const rules = this.getAllRules();
    const filtered = rules.filter(r => r.id !== id);
    
    if (filtered.length === rules.length) {
      return false;
    }
    
    localStorage.setItem(ASSIGNMENT_RULES_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  }
  
  getAllRules(): AssignmentRule[] {
    try {
      const data = localStorage.getItem(ASSIGNMENT_RULES_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      console.error('Error parsing rules from storage');
      return [];
    }
  }
  
  getActiveRules(): AssignmentRule[] {
    return this.getAllRules().filter(r => r.active).sort((a, b) => b.priority - a.priority);
  }
  
  // ==================== Rule Evaluation ====================
  
  private evaluateCondition(condition: RuleCondition, client: ClientAssignmentRequest): boolean {
    const fieldValue = this.getClientFieldValue(client, condition.field);
    
    if (!fieldValue) {
      return false;
    }
    
    const compareValue = Array.isArray(condition.value) ? condition.value : [condition.value];
    const caseSensitive = condition.caseSensitive !== false;
    
    const normalize = (val: string) => caseSensitive ? val : val.toLowerCase();
    const normalizedField = normalize(String(fieldValue));
    const normalizedCompare = compareValue.map(v => normalize(v));
    
    switch (condition.operator) {
      case 'equals':
        return normalizedCompare.includes(normalizedField);
      case 'contains':
        return normalizedCompare.some(v => normalizedField.includes(v));
      case 'startsWith':
        return normalizedCompare.some(v => normalizedField.startsWith(v));
      case 'in':
        return normalizedCompare.includes(normalizedField);
      case 'range':
        // For numeric ranges like postal codes
        return true; // Simplified for now
      default:
        return false;
    }
  }
  
  private getClientFieldValue(client: ClientAssignmentRequest, field: string): string | undefined {
    switch (field) {
      case 'location':
        return client.location || client.city || client.region;
      case 'packageType':
        return client.packageType;
      case 'clientType':
        return client.clientType;
      case 'specialty':
        return client.specialRequirements?.join(',');
      case 'language':
        return client.preferredLanguage;
      default:
        return undefined;
    }
  }
  
  evaluateRulesForClient(client: ClientAssignmentRequest, rules: AssignmentRule[]): AssignmentRule | null {
    for (const rule of rules) {
      let matches = false;
      
      if (rule.logicalOperator === 'AND') {
        matches = rule.conditions.every(cond => this.evaluateCondition(cond, client));
      } else {
        matches = rule.conditions.some(cond => this.evaluateCondition(cond, client));
      }
      
      if (matches) {
        return rule;
      }
    }
    
    return null;
  }
  
  // ==================== Auto-Assignment ====================
  
  assignClientToTerritory(
    client: ClientAssignmentRequest,
    userId?: string
  ): AssignmentResult {
    // If manual override is provided
    if (userId) {
      const territory = this.findTerritoryWithMember(userId);
      if (territory) {
        const member = territory.teamMembers.find(m => m.userId === userId);
        if (member && member.currentClientCount < member.maxCapacity) {
          const result: AssignmentResult = {
            success: true,
            clientId: client.clientId,
            assignedToUserId: userId,
            assignedToUserName: member.userName,
            territoryId: territory.id,
            territoryName: territory.name,
            reason: 'Manual assignment',
            timestamp: new Date(),
          };
          
          this.logAssignment(result, userId);
          return result;
        } else {
          return {
            success: false,
            clientId: client.clientId,
            reason: 'Selected member is at capacity',
            timestamp: new Date(),
            conflict: {
              type: 'capacity_exceeded',
              message: `Member ${member?.userName || userId} has reached maximum capacity`,
              suggestions: ['Choose another team member', 'Increase team member capacity'],
            },
          };
        }
      }
    }
    
    // Evaluate rules
    const activeRules = this.getActiveRules();
    const matchedRule = this.evaluateRulesForClient(client, activeRules);
    
    if (matchedRule) {
      return this.executeAssignmentAction(client, matchedRule);
    }
    
    // No rule matched, try load balancing
    return this.assignByLoadBalance(client);
  }
  
  private executeAssignmentAction(
    client: ClientAssignmentRequest,
    rule: AssignmentRule
  ): AssignmentResult {
    const action = rule.action;
    
    switch (action.type) {
      case 'assign_to_user': {
        if (!action.userId) {
          return this.createFailureResult(client, 'Rule missing user assignment', rule.id);
        }
        
        const territory = this.findTerritoryWithMember(action.userId);
        if (!territory) {
          return this.createFailureResult(client, 'User not found in territories', rule.id);
        }
        
        const member = territory.teamMembers.find(m => m.userId === action.userId);
        if (member && member.currentClientCount >= member.maxCapacity) {
          return this.createFailureResult(
            client,
            `User ${member.userName} is at capacity`,
            rule.id,
            'capacity_exceeded'
          );
        }
        
        const result: AssignmentResult = {
          success: true,
          clientId: client.clientId,
          assignedToUserId: action.userId,
          assignedToUserName: member?.userName,
          territoryId: territory.id,
          territoryName: territory.name,
          reason: `Matched rule: ${rule.name}`,
          appliedRuleId: rule.id,
          timestamp: new Date(),
        };
        
        this.logAssignment(result, rule.createdBy);
        return result;
      }
      
      case 'assign_to_territory': {
        if (!action.territoryId) {
          return this.createFailureResult(client, 'Rule missing territory assignment', rule.id);
        }
        
        const territory = this.getTerritory(action.territoryId);
        if (!territory) {
          return this.createFailureResult(client, 'Territory not found', rule.id);
        }
        
        // Find member with lowest load in territory
        const availableMember = territory.teamMembers
          .filter(m => m.active && m.currentClientCount < m.maxCapacity)
          .sort((a, b) => a.currentClientCount - b.currentClientCount)[0];
        
        if (!availableMember) {
          return this.createFailureResult(
            client,
            `No available members in territory ${territory.name}`,
            rule.id,
            'capacity_exceeded'
          );
        }
        
        const result: AssignmentResult = {
          success: true,
          clientId: client.clientId,
          assignedToUserId: availableMember.userId,
          assignedToUserName: availableMember.userName,
          territoryId: territory.id,
          territoryName: territory.name,
          reason: `Matched rule: ${rule.name} (Territory: ${territory.name})`,
          appliedRuleId: rule.id,
          timestamp: new Date(),
        };
        
        this.logAssignment(result, rule.createdBy);
        return result;
      }
      
      case 'assign_by_specialty': {
        if (!action.requiredSpecialties || action.requiredSpecialties.length === 0) {
          return this.assignByLoadBalance(client);
        }
        
        // Find members with required specialties
        const territories = this.getAllTerritories();
        const specializedMembers = territories
          .flatMap(t => t.teamMembers.map(m => ({ ...m, territoryId: t.id, territoryName: t.name })))
          .filter(m => m.active && m.specialties && 
            action.requiredSpecialties!.some(spec => m.specialties!.includes(spec)) &&
            m.currentClientCount < m.maxCapacity);
        
        if (specializedMembers.length === 0) {
          return this.createFailureResult(
            client,
            'No specialists available for required specialties',
            rule.id,
            'specialty_mismatch'
          );
        }
        
        // Select member with lowest load
        const selected = specializedMembers.sort((a, b) => a.currentClientCount - b.currentClientCount)[0];
        
        const result: AssignmentResult = {
          success: true,
          clientId: client.clientId,
          assignedToUserId: selected.userId,
          assignedToUserName: selected.userName,
          territoryId: selected.territoryId,
          territoryName: selected.territoryName,
          reason: `Matched rule: ${rule.name} (Specialty: ${action.requiredSpecialties.join(', ')})`,
          appliedRuleId: rule.id,
          timestamp: new Date(),
        };
        
        this.logAssignment(result, rule.createdBy);
        return result;
      }
      
      case 'load_balance':
      default:
        return this.assignByLoadBalance(client);
    }
  }
  
  private assignByLoadBalance(client: ClientAssignmentRequest): AssignmentResult {
    const territories = this.getAllTerritories().filter(t => t.active && t.teamMembers.length > 0);
    
    if (territories.length === 0) {
      return this.createFailureResult(client, 'No active territories available', undefined, 'no_match');
    }
    
    // Find member with lowest current load across all territories
    let bestMember: any = null;
    let bestTerritory: Territory | null = null;
    
    for (const territory of territories) {
      const availableMembers = territory.teamMembers.filter(
        m => m.active && m.currentClientCount < m.maxCapacity
      );
      
      for (const member of availableMembers) {
        if (!bestMember || member.currentClientCount < bestMember.currentClientCount) {
          bestMember = member;
          bestTerritory = territory;
        }
      }
    }
    
    if (!bestMember || !bestTerritory) {
      return this.createFailureResult(
        client,
        'No team members with available capacity',
        undefined,
        'capacity_exceeded'
      );
    }
    
    const result: AssignmentResult = {
      success: true,
      clientId: client.clientId,
      assignedToUserId: bestMember.userId,
      assignedToUserName: bestMember.userName,
      territoryId: bestTerritory.id,
      territoryName: bestTerritory.name,
      reason: `Load balanced to ${bestMember.userName} (${bestMember.currentClientCount}/${bestMember.maxCapacity} clients)`,
      timestamp: new Date(),
    };
    
    this.logAssignment(result, 'system');
    return result;
  }
  
  private createFailureResult(
    client: ClientAssignmentRequest,
    reason: string,
    ruleId?: string,
    conflictType?: 'multiple_territories' | 'capacity_exceeded' | 'no_match' | 'specialty_mismatch'
  ): AssignmentResult {
    return {
      success: false,
      clientId: client.clientId,
      reason,
      appliedRuleId: ruleId,
      timestamp: new Date(),
      conflict: conflictType ? {
        type: conflictType,
        message: reason,
        suggestions: [
          'Review territory configuration',
          'Increase team capacity',
          'Adjust assignment rules',
        ],
      } : undefined,
    };
  }
  
  private findTerritoryWithMember(userId: string): Territory | null {
    const territories = this.getAllTerritories();
    return territories.find(t => t.teamMembers.some(m => m.userId === userId)) || null;
  }
  
  // ==================== Statistics & Reporting ====================
  
  getTerritoryStats(territoryId: string): TerritoryStats | null {
    const territory = this.getTerritory(territoryId);
    if (!territory) {
      return null;
    }
    
    const totalClients = territory.teamMembers.reduce((sum, m) => sum + m.currentClientCount, 0);
    const totalCapacity = territory.teamMembers.reduce((sum, m) => sum + m.maxCapacity, 0);
    
    const rules = this.getAllRules().filter(r => r.active);
    
    return {
      territoryId: territory.id,
      territoryName: territory.name,
      totalMembers: territory.teamMembers.filter(m => m.active).length,
      totalClients,
      averageClientsPerMember: territory.teamMembers.length > 0 ? totalClients / territory.teamMembers.length : 0,
      capacityUtilization: totalCapacity > 0 ? (totalClients / totalCapacity) * 100 : 0,
      activeRules: rules.length,
      unassignedClients: 0, // To be calculated from client service
      lastAssignmentTime: this.getLastAssignmentForTerritory(territoryId),
    };
  }
  
  private getLastAssignmentForTerritory(territoryId: string): Date | undefined {
    const logs = this.getAssignmentLogs();
    const territoryLogs = logs.filter(l => l.newAssignment.territoryId === territoryId);
    
    if (territoryLogs.length === 0) {
      return undefined;
    }
    
    return new Date(Math.max(...territoryLogs.map(l => new Date(l.timestamp).getTime())));
  }
  
  getCapacityUtilization(): { territoryName: string; utilization: number }[] {
    return this.getAllTerritories()
      .filter(t => t.active)
      .map(t => {
        const stats = this.getTerritoryStats(t.id);
        return {
          territoryName: t.name,
          utilization: stats?.capacityUtilization || 0,
        };
      })
      .sort((a, b) => b.utilization - a.utilization);
  }
  
  // ==================== Assignment Logging ====================
  
  private logAssignment(result: AssignmentResult, performedBy: string): void {
    const logs = this.getAssignmentLogs();
    
    const log: AssignmentLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      clientId: result.clientId,
      clientName: result.clientId, // This could be enhanced with actual client name
      newAssignment: {
        userId: result.assignedToUserId,
        userName: result.assignedToUserName,
        territoryId: result.territoryId,
        territoryName: result.territoryName,
      },
      reason: result.reason,
      appliedRuleId: result.appliedRuleId,
      assignedBy: performedBy,
      timestamp: result.timestamp,
      success: result.success,
      errorMessage: result.success ? undefined : result.reason,
    };
    
    logs.push(log);
    localStorage.setItem(ASSIGNMENT_LOGS_STORAGE_KEY, JSON.stringify(logs));
  }
  
  getAssignmentLogs(limit: number = 100): AssignmentLog[] {
    try {
      const data = localStorage.getItem(ASSIGNMENT_LOGS_STORAGE_KEY);
      const logs = data ? JSON.parse(data) : [];
      return logs.slice(-limit).reverse(); // Most recent first
    } catch {
      console.error('Error parsing assignment logs');
      return [];
    }
  }
  
  clearAssignmentLogs(): void {
    localStorage.setItem(ASSIGNMENT_LOGS_STORAGE_KEY, JSON.stringify([]));
  }
}

export default new TerritoryService();
