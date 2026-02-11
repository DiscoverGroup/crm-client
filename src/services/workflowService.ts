// Workflow Service - Execute and manage workflows

import type { 
  Workflow, 
  WorkflowExecution, 
  WorkflowExecutionStep, 
  WorkflowAction,
  WorkflowCondition,
  WorkflowTriggerType 
} from '../types/workflow';

class WorkflowService {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private readonly STORAGE_KEY = 'crm_workflows';
  private readonly EXECUTIONS_KEY = 'crm_workflow_executions';

  constructor() {
    this.loadWorkflows();
    this.loadExecutions();
  }

  // Load workflows from localStorage
  private loadWorkflows(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const workflows: Workflow[] = JSON.parse(stored);
        workflows.forEach(workflow => {
          this.workflows.set(workflow.id, workflow);
        });
      }
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  }

  // Save workflows to localStorage
  private saveWorkflows(): void {
    try {
      const workflows = Array.from(this.workflows.values());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(workflows));
    } catch (error) {
      console.error('Failed to save workflows:', error);
    }
  }

  // Load executions from localStorage
  private loadExecutions(): void {
    try {
      const stored = localStorage.getItem(this.EXECUTIONS_KEY);
      if (stored) {
        const executions: WorkflowExecution[] = JSON.parse(stored);
        executions.forEach(execution => {
          this.executions.set(execution.id, execution);
        });
      }
    } catch (error) {
      console.error('Failed to load executions:', error);
    }
  }

  // Save executions to localStorage
  private saveExecutions(): void {
    try {
      const executions = Array.from(this.executions.values());
      // Keep only last 100 executions
      const recent = executions.slice(-100);
      localStorage.setItem(this.EXECUTIONS_KEY, JSON.stringify(recent));
    } catch (error) {
      console.error('Failed to save executions:', error);
    }
  }

  // Create new workflow
  createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Workflow {
    const newWorkflow: Workflow = {
      ...workflow,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      executionCount: 0
    };

    this.workflows.set(newWorkflow.id, newWorkflow);
    this.saveWorkflows();
    return newWorkflow;
  }

  // Update workflow
  updateWorkflow(id: string, updates: Partial<Workflow>): Workflow | null {
    const workflow = this.workflows.get(id);
    if (!workflow) return null;

    const updated = {
      ...workflow,
      ...updates,
      updatedAt: new Date()
    };

    this.workflows.set(id, updated);
    this.saveWorkflows();
    return updated;
  }

  // Delete workflow
  deleteWorkflow(id: string): boolean {
    const deleted = this.workflows.delete(id);
    if (deleted) {
      this.saveWorkflows();
    }
    return deleted;
  }

  // Get workflow by ID
  getWorkflow(id: string): Workflow | null {
    return this.workflows.get(id) || null;
  }

  // Get all workflows
  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  // Get enabled workflows for a trigger type
  getWorkflowsForTrigger(triggerType: WorkflowTriggerType): Workflow[] {
    return Array.from(this.workflows.values()).filter(
      workflow => workflow.enabled && workflow.trigger.type === triggerType
    );
  }

  // Trigger workflows based on event
  async triggerWorkflows(
    triggerType: WorkflowTriggerType,
    triggerData: any,
    triggeredBy: string
  ): Promise<WorkflowExecution[]> {
    const workflows = this.getWorkflowsForTrigger(triggerType);
    const executions: WorkflowExecution[] = [];

    for (const workflow of workflows) {
      // Check if conditions are met
      if (workflow.trigger.conditions && workflow.trigger.conditions.length > 0) {
        if (!this.evaluateConditions(workflow.trigger.conditions, triggerData)) {
          continue; // Skip this workflow
        }
      }

      // Execute workflow
      const execution = await this.executeWorkflow(workflow, triggerData, triggeredBy);
      executions.push(execution);

      // Update workflow stats
      workflow.executionCount++;
      workflow.lastExecutedAt = new Date();
      this.workflows.set(workflow.id, workflow);
    }

    this.saveWorkflows();
    return executions;
  }

  // Execute a workflow
  async executeWorkflow(
    workflow: Workflow,
    triggerData: any,
    triggeredBy: string
  ): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: this.generateId(),
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'running',
      startedAt: new Date(),
      triggeredBy,
      triggerData,
      steps: []
    };

    this.executions.set(execution.id, execution);
    this.saveExecutions();

    try {
      // Execute actions in order
      for (const action of workflow.actions.sort((a, b) => a.order - b.order)) {
        const step = await this.executeAction(action, triggerData, execution);
        execution.steps.push(step);
        this.saveExecutions();

        // If action failed and it's not optional, stop execution
        if (step.status === 'failed') {
          throw new Error(`Action ${action.type} failed: ${step.error}`);
        }
      }

      execution.status = 'completed';
      execution.completedAt = new Date();
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date();
    }

    this.executions.set(execution.id, execution);
    this.saveExecutions();
    return execution;
  }

  // Execute a single action
  private async executeAction(
    action: WorkflowAction,
    context: any,
    execution: WorkflowExecution
  ): Promise<WorkflowExecutionStep> {
    const step: WorkflowExecutionStep = {
      actionId: action.id,
      actionType: action.type,
      status: 'running',
      startedAt: new Date()
    };

    try {
      // Replace variables in config
      const config = this.replaceVariables(action.config, context);

      // Execute based on action type
      switch (action.type) {
        case 'send_email':
          step.result = await this.sendEmail(config);
          break;
        case 'send_notification':
          step.result = await this.sendNotification(config);
          break;
        case 'create_task':
          step.result = await this.createTask(config);
          break;
        case 'update_client_status':
          step.result = await this.updateClientStatus(config);
          break;
        case 'assign_to_user':
          step.result = await this.assignToUser(config);
          break;
        case 'add_note':
          step.result = await this.addNote(config);
          break;
        case 'update_client_field':
          step.result = await this.updateClientField(config);
          break;
        case 'wait_delay':
          step.result = await this.waitDelay(config);
          break;
        case 'conditional_branch':
          step.result = await this.conditionalBranch(config, context, execution);
          break;
        case 'send_webhook':
          step.result = await this.sendWebhook(config);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      step.status = 'completed';
      step.completedAt = new Date();
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      step.completedAt = new Date();
    }

    return step;
  }

  // Evaluate conditions
  private evaluateConditions(conditions: WorkflowCondition[], data: any): boolean {
    let result = true;
    let currentLogic: 'AND' | 'OR' = 'AND';

    for (const condition of conditions) {
      const fieldValue = this.getNestedValue(data, condition.field);
      const conditionResult = this.evaluateCondition(condition, fieldValue);

      if (currentLogic === 'AND') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }

      currentLogic = condition.logicalOperator || 'AND';
    }

    return result;
  }

  // Evaluate single condition
  private evaluateCondition(condition: WorkflowCondition, fieldValue: any): boolean {
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'not_contains':
        return !String(fieldValue).includes(String(condition.value));
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'is_empty':
        return !fieldValue || fieldValue === '';
      case 'is_not_empty':
        return !!fieldValue && fieldValue !== '';
      case 'starts_with':
        return String(fieldValue).startsWith(String(condition.value));
      case 'ends_with':
        return String(fieldValue).endsWith(String(condition.value));
      default:
        return false;
    }
  }

  // Replace variables in config (e.g., {{client.name}})
  private replaceVariables(config: any, context: any): any {
    const json = JSON.stringify(config);
    const replaced = json.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(context, path.trim());
      return value !== undefined ? String(value) : match;
    });
    return JSON.parse(replaced);
  }

  // Get nested value from object (e.g., "client.name")
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Action implementations
  private async sendEmail(config: any): Promise<any> {
    console.log('Sending email:', config);
    // TODO: Integrate with actual email service
    return { success: true, message: 'Email sent (simulated)' };
  }

  private async sendNotification(config: any): Promise<any> {
    console.log('Sending notification:', config);
    // Create notification in localStorage
    const notifications = JSON.parse(localStorage.getItem('crm_notifications') || '[]');
    notifications.push({
      id: this.generateId(),
      title: config.notificationTitle,
      message: config.notificationMessage,
      targetUsers: config.notificationTargetUsers,
      createdAt: new Date(),
      read: false
    });
    localStorage.setItem('crm_notifications', JSON.stringify(notifications));
    return { success: true, message: 'Notification created' };
  }

  private async createTask(config: any): Promise<any> {
    console.log('Creating task:', config);
    // TODO: Integrate with task management system
    return { success: true, message: 'Task created (simulated)' };
  }

  private async updateClientStatus(config: any): Promise<any> {
    console.log('Updating client status:', config);
    // TODO: Integrate with client service
    return { success: true, message: 'Status updated (simulated)' };
  }

  private async assignToUser(config: any): Promise<any> {
    console.log('Assigning to user:', config);
    // TODO: Integrate with client service
    return { success: true, message: 'User assigned (simulated)' };
  }

  private async addNote(config: any): Promise<any> {
    console.log('Adding note:', config);
    // TODO: Integrate with activity log service
    return { success: true, message: 'Note added (simulated)' };
  }

  private async updateClientField(config: any): Promise<any> {
    console.log('Updating client field:', config);
    // TODO: Integrate with client service
    return { success: true, message: 'Field updated (simulated)' };
  }

  private async waitDelay(config: any): Promise<any> {
    const totalMs = 
      (config.delayMinutes || 0) * 60 * 1000 +
      (config.delayHours || 0) * 60 * 60 * 1000 +
      (config.delayDays || 0) * 24 * 60 * 60 * 1000;
    
    console.log(`Waiting for ${totalMs}ms`);
    // In production, this would schedule a deferred execution
    return { success: true, message: `Waited ${totalMs}ms (simulated)` };
  }

  private async conditionalBranch(config: any, context: any, execution: WorkflowExecution): Promise<any> {
    const conditionsMet = this.evaluateConditions(config.conditions || [], context);
    
    if (conditionsMet && config.trueBranchActions) {
      for (const action of config.trueBranchActions) {
        await this.executeAction(action, context, execution);
      }
    } else if (!conditionsMet && config.falseBranchActions) {
      for (const action of config.falseBranchActions) {
        await this.executeAction(action, context, execution);
      }
    }

    return { success: true, branch: conditionsMet ? 'true' : 'false' };
  }

  private async sendWebhook(config: any): Promise<any> {
    console.log('Sending webhook:', config);
    try {
      const response = await fetch(config.webhookUrl, {
        method: config.webhookMethod || 'POST',
        headers: config.webhookHeaders || {},
        body: JSON.stringify(config.webhookBody)
      });
      return { success: response.ok, status: response.status };
    } catch (error) {
      throw new Error(`Webhook failed: ${error}`);
    }
  }

  // Get execution history
  getExecutions(workflowId?: string): WorkflowExecution[] {
    const executions = Array.from(this.executions.values());
    if (workflowId) {
      return executions.filter(e => e.workflowId === workflowId);
    }
    return executions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  // Generate unique ID
  private generateId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const workflowService = new WorkflowService();
export default workflowService;
