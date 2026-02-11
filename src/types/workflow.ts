// Workflow Automation Types

export type WorkflowTriggerType = 
  | 'client_created'
  | 'client_updated'
  | 'client_deleted'
  | 'client_status_changed'
  | 'message_sent'
  | 'message_received'
  | 'file_uploaded'
  | 'note_added'
  | 'user_login'
  | 'scheduled_time'
  | 'manual_trigger';

export type WorkflowActionType =
  | 'send_email'
  | 'send_sms'
  | 'create_task'
  | 'update_client_status'
  | 'assign_to_user'
  | 'add_note'
  | 'send_notification'
  | 'create_client'
  | 'update_client_field'
  | 'wait_delay'
  | 'conditional_branch'
  | 'send_webhook';

export type WorkflowConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'starts_with'
  | 'ends_with';

export interface WorkflowCondition {
  id: string;
  field: string;
  operator: WorkflowConditionOperator;
  value: any;
  logicalOperator?: 'AND' | 'OR'; // For multiple conditions
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  conditions?: WorkflowCondition[];
  scheduleTime?: string; // For scheduled triggers (cron format)
}

export interface WorkflowActionConfig {
  // For send_email
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  
  // For send_sms
  smsTo?: string;
  smsBody?: string;
  
  // For create_task
  taskTitle?: string;
  taskDescription?: string;
  taskDueDate?: string;
  taskAssignedTo?: string;
  
  // For update_client_status
  newStatus?: string;
  
  // For assign_to_user
  userId?: string;
  
  // For add_note
  noteContent?: string;
  noteType?: string;
  
  // For send_notification
  notificationTitle?: string;
  notificationMessage?: string;
  notificationTargetUsers?: string[];
  
  // For update_client_field
  fieldName?: string;
  fieldValue?: any;
  
  // For wait_delay
  delayMinutes?: number;
  delayHours?: number;
  delayDays?: number;
  
  // For conditional_branch
  conditions?: WorkflowCondition[];
  trueBranchActions?: WorkflowAction[];
  falseBranchActions?: WorkflowAction[];
  
  // For send_webhook
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT';
  webhookHeaders?: Record<string, string>;
  webhookBody?: any;
}

export interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  config: WorkflowActionConfig;
  order: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  executionCount: number;
  lastExecutedAt?: Date;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  triggeredBy: string;
  triggerData: any;
  steps: WorkflowExecutionStep[];
  error?: string;
}

export interface WorkflowExecutionStep {
  actionId: string;
  actionType: WorkflowActionType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

// Workflow Templates
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'client_management' | 'communication' | 'tasks' | 'notifications' | 'custom';
  icon: string;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
}

// Pre-built workflow templates
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'welcome-new-client',
    name: 'Welcome New Client',
    description: 'Automatically send welcome email when a new client is created',
    category: 'client_management',
    icon: '👋',
    trigger: {
      type: 'client_created'
    },
    actions: [
      {
        id: '1',
        type: 'send_email',
        order: 1,
        config: {
          emailTo: '{{client.email}}',
          emailSubject: 'Welcome to Discover Group!',
          emailBody: 'Hi {{client.name}},\n\nWelcome to our service! We\'re excited to have you onboard.\n\nBest regards,\nDiscover Group Team'
        }
      },
      {
        id: '2',
        type: 'send_notification',
        order: 2,
        config: {
          notificationTitle: 'New Client Added',
          notificationMessage: '{{client.name}} has been added to the system',
          notificationTargetUsers: ['admin']
        }
      }
    ]
  },
  {
    id: 'follow-up-reminder',
    name: 'Follow-up Reminder',
    description: 'Create a follow-up task 3 days after client creation',
    category: 'tasks',
    icon: '📅',
    trigger: {
      type: 'client_created'
    },
    actions: [
      {
        id: '1',
        type: 'wait_delay',
        order: 1,
        config: {
          delayDays: 3
        }
      },
      {
        id: '2',
        type: 'create_task',
        order: 2,
        config: {
          taskTitle: 'Follow up with {{client.name}}',
          taskDescription: 'Check in with the client to ensure they\'re satisfied',
          taskDueDate: '{{date.addDays(7)}}',
          taskAssignedTo: '{{client.assignedTo}}'
        }
      }
    ]
  },
  {
    id: 'status-change-notification',
    name: 'Status Change Notification',
    description: 'Notify team when client status changes to "Active"',
    category: 'notifications',
    icon: '🔔',
    trigger: {
      type: 'client_status_changed',
      conditions: [
        {
          id: '1',
          field: 'status',
          operator: 'equals',
          value: 'Active'
        }
      ]
    },
    actions: [
      {
        id: '1',
        type: 'send_notification',
        order: 1,
        config: {
          notificationTitle: 'Client Status Changed',
          notificationMessage: '{{client.name}} is now Active',
          notificationTargetUsers: ['all']
        }
      },
      {
        id: '2',
        type: 'add_note',
        order: 2,
        config: {
          noteContent: 'Client status changed to Active automatically by workflow',
          noteType: 'system'
        }
      }
    ]
  },
  {
    id: 'inactive-client-reminder',
    name: 'Inactive Client Reminder',
    description: 'Send reminder for clients inactive for 30 days',
    category: 'communication',
    icon: '⏰',
    trigger: {
      type: 'scheduled_time',
      scheduleTime: '0 9 * * *' // Daily at 9 AM
    },
    actions: [
      {
        id: '1',
        type: 'conditional_branch',
        order: 1,
        config: {
          conditions: [
            {
              id: '1',
              field: 'lastContactDate',
              operator: 'greater_than',
              value: 30 // days
            }
          ],
          trueBranchActions: [
            {
              id: '1-1',
              type: 'send_email',
              order: 1,
              config: {
                emailTo: '{{client.email}}',
                emailSubject: 'We miss you!',
                emailBody: 'Hi {{client.name}},\n\nWe noticed we haven\'t heard from you in a while. How can we help?'
              }
            },
            {
              id: '1-2',
              type: 'create_task',
              order: 2,
              config: {
                taskTitle: 'Re-engage {{client.name}}',
                taskDescription: 'Client hasn\'t been contacted in 30+ days',
                taskAssignedTo: '{{client.assignedTo}}'
              }
            }
          ]
        }
      }
    ]
  },
  {
    id: 'auto-assign-new-client',
    name: 'Auto-Assign New Client',
    description: 'Automatically assign new clients to available team members',
    category: 'client_management',
    icon: '👥',
    trigger: {
      type: 'client_created'
    },
    actions: [
      {
        id: '1',
        type: 'assign_to_user',
        order: 1,
        config: {
          userId: '{{user.leastClients}}' // Assign to user with least clients
        }
      },
      {
        id: '2',
        type: 'send_notification',
        order: 2,
        config: {
          notificationTitle: 'New Client Assigned',
          notificationMessage: '{{client.name}} has been assigned to you',
          notificationTargetUsers: ['{{assignedUser.id}}']
        }
      }
    ]
  }
];
