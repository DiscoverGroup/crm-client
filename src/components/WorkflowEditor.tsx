import React, { useState } from 'react';
import type { Workflow, WorkflowAction, WorkflowTriggerType } from '../types/workflow';
import workflowService from '../services/workflowService';

interface WorkflowEditorProps {
  workflow: Workflow | null;
  onSave: (workflow: Workflow) => void;
  onClose: () => void;
}

const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ workflow, onSave, onClose }) => {
  const [name, setName] = useState(workflow?.name || 'New Workflow');
  const [description, setDescription] = useState(workflow?.description || '');
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>(workflow?.trigger.type || 'client_created');
  const [actions, setActions] = useState<WorkflowAction[]>(workflow?.actions || []);
  const [enabled, setEnabled] = useState(workflow?.enabled || false);

  const TRIGGER_OPTIONS: { value: WorkflowTriggerType; label: string; icon: string }[] = [
    { value: 'client_created', label: 'Client Created', icon: '✨' },
    { value: 'client_updated', label: 'Client Updated', icon: '✏️' },
    { value: 'client_deleted', label: 'Client Deleted', icon: '🗑️' },
    { value: 'client_status_changed', label: 'Status Changed', icon: '🔄' },
    { value: 'message_sent', label: 'Message Sent', icon: '📤' },
    { value: 'message_received', label: 'Message Received', icon: '📥' },
    { value: 'file_uploaded', label: 'File Uploaded', icon: '📎' },
    { value: 'note_added', label: 'Note Added', icon: '📝' },
    { value: 'user_login', label: 'User Login', icon: '🔐' },
    { value: 'scheduled_time', label: 'Scheduled Time', icon: '⏰' },
    { value: 'manual_trigger', label: 'Manual Trigger', icon: '👆' }
  ];

  const ACTION_OPTIONS = [
    { value: 'send_email', label: 'Send Email', icon: '📧', color: '#3b82f6' },
    { value: 'send_notification', label: 'Send Notification', icon: '🔔', color: '#f59e0b' },
    { value: 'create_task', label: 'Create Task', icon: '✅', color: '#10b981' },
    { value: 'send_sms', label: 'Send SMS', icon: '📱', color: '#8b5cf6' },
    { value: 'update_client_status', label: 'Update Status', icon: '🔄', color: '#06b6d4' },
    { value: 'assign_to_user', label: 'Assign to User', icon: '👤', color: '#ec4899' },
    { value: 'add_note', label: 'Add Note', icon: '📝', color: '#6366f1' },
    { value: 'wait_delay', label: 'Wait/Delay', icon: '⏱️', color: '#64748b' },
    { value: 'conditional_branch', label: 'Conditional', icon: '🔀', color: '#14b8a6' },
    { value: 'send_webhook', label: 'Send Webhook', icon: '🌐', color: '#f97316' }
  ];

  const handleAddAction = (actionType: string) => {
    const newAction: WorkflowAction = {
      id: `action_${Date.now()}`,
      type: actionType as any,
      order: actions.length + 1,
      config: {}
    };
    setActions([...actions, newAction]);
  };

  const handleRemoveAction = (actionId: string) => {
    setActions(actions.filter(a => a.id !== actionId));
  };

  const handleSaveWorkflow = () => {
    if (!name.trim()) {
      alert('Please enter a workflow name');
      return;
    }

    const savedWorkflow = workflow
      ? workflowService.updateWorkflow(workflow.id, {
          name,
          description,
          trigger: { ...workflow.trigger, type: triggerType },
          actions,
          enabled
        })
      : workflowService.createWorkflow({
          name,
          description,
          trigger: { type: triggerType },
          actions,
          enabled,
          createdBy: 'current_user'
        });

    if (savedWorkflow) {
      onSave(savedWorkflow);
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      zIndex: 9999,
      backdropFilter: 'blur(4px)',
      overflow: 'auto'
    }}>
      <div style={{
        background: 'white',
        width: '100%',
        maxWidth: '900px',
        margin: 'auto',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '2px solid #e9ecef',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
            {workflow ? '✏️ Edit Workflow' : '✨ Create New Workflow'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '8px',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              fontSize: '20px',
              color: 'white'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {/* Basic Info */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Basic Information</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Workflow Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
                placeholder="e.g., Welcome New Clients"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
                placeholder="Describe what this workflow does..."
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="checkbox"
                id="enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="enabled" style={{ fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                Enable this workflow
              </label>
            </div>
          </div>

          {/* Trigger Selection */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Trigger</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
              {TRIGGER_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => setTriggerType(option.value)}
                  style={{
                    padding: '12px',
                    border: triggerType === option.value ? '2px solid #667eea' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: triggerType === option.value ? '#f0f4ff' : 'white',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>{option.icon}</div>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Actions</h3>
            
            {/* Current Actions */}
            {actions.length > 0 && (
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {actions.map((action, index) => {
                  const actionOption = ACTION_OPTIONS.find(opt => opt.value === action.type);
                  return (
                    <div key={action.id} style={{
                      padding: '16px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: actionOption?.color || '#6b7280',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px'
                      }}>
                        {actionOption?.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                          {index + 1}. {actionOption?.label}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                          {action.type}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveAction(action.id)}
                        style={{
                          background: '#fee2e2',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          color: '#991b1b',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
              {ACTION_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleAddAction(option.value)}
                  style={{
                    padding: '12px',
                    border: '2px dashed #d1d5db',
                    borderRadius: '8px',
                    background: 'white',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = option.color;
                    e.currentTarget.style.background = option.color + '08';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  <div style={{ fontSize: '18px', marginBottom: '6px' }}>{option.icon}</div>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '2px solid #e9ecef',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          background: '#f8fafc'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              color: '#475569'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveWorkflow}
            style={{
              padding: '10px 24px',
              border: 'none',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)'
            }}
          >
            💾 Save Workflow
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowEditor;
