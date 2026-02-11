import React, { useState } from 'react';
import type {
  Workflow,
  WorkflowTrigger,
  WorkflowAction,
  WorkflowActionType,
  WorkflowTriggerType
} from '../types/workflow';
import workflowService from '../services/workflowService';

interface WorkflowEditorProps {
  workflow: Workflow;
  onSave: (workflow: Workflow) => void;
  onCancel: () => void;
}

const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ workflow: initialWorkflow, onSave, onCancel }) => {
  const [workflow, setWorkflow] = useState<Workflow>(initialWorkflow);
  const [activeTab, setActiveTab] = useState<'trigger' | 'actions' | 'settings'>('trigger');
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [showAddAction, setShowAddAction] = useState(false);

  // Trigger types with icons
  const triggerTypes: Record<WorkflowTriggerType, { label: string; icon: string; description: string }> = {
    client_created: { label: 'Client Created', icon: '✨', description: 'Triggered when a new client is created' },
    client_updated: { label: 'Client Updated', icon: '✏️', description: 'Triggered when client info is updated' },
    client_deleted: { label: 'Client Deleted', icon: '🗑️', description: 'Triggered when a client is deleted' },
    client_status_changed: { label: 'Status Changed', icon: '🔄', description: 'Triggered when client status changes' },
    message_sent: { label: 'Message Sent', icon: '📤', description: 'Triggered when a message is sent' },
    message_received: { label: 'Message Received', icon: '📥', description: 'Triggered when a message is received' },
    file_uploaded: { label: 'File Uploaded', icon: '📎', description: 'Triggered when a file is uploaded' },
    note_added: { label: 'Note Added', icon: '📝', description: 'Triggered when a note is added' },
    user_login: { label: 'User Login', icon: '🔐', description: 'Triggered when a user logs in' },
    scheduled_time: { label: 'Scheduled Time', icon: '⏰', description: 'Triggered at specified times' },
    manual_trigger: { label: 'Manual Trigger', icon: '👆', description: 'Triggered manually by user' }
  };

  // Action types with icons
  const actionTypes: Record<WorkflowActionType, { label: string; icon: string; description: string }> = {
    send_email: { label: 'Send Email', icon: '📧', description: 'Send an email notification' },
    send_sms: { label: 'Send SMS', icon: '📱', description: 'Send an SMS message' },
    create_task: { label: 'Create Task', icon: '✓', description: 'Create a new task' },
    update_client_status: { label: 'Update Status', icon: '🔄', description: 'Change client status' },
    assign_to_user: { label: 'Assign to User', icon: '👤', description: 'Assign client to user' },
    add_note: { label: 'Add Note', icon: '📝', description: 'Add a note to the client' },
    send_notification: { label: 'Send Notification', icon: '🔔', description: 'Send in-app notification' },
    create_client: { label: 'Create Client', icon: '➕', description: 'Create a new client record' },
    update_client_field: { label: 'Update Field', icon: '✏️', description: 'Update client field value' },
    wait_delay: { label: 'Wait/Delay', icon: '⏱️', description: 'Pause workflow execution' },
    conditional_branch: { label: 'Conditional Branch', icon: '🔀', description: 'Branch based on conditions' },
    send_webhook: { label: 'Send Webhook', icon: '🌐', description: 'Send HTTP request to external service' }
  };

  const handleTriggerChange = (newTrigger: Partial<WorkflowTrigger>) => {
    setWorkflow(prev => ({
      ...prev,
      trigger: { ...prev.trigger, ...newTrigger }
    }));
  };

  const handleAddAction = (actionType: WorkflowActionType) => {
    const newAction: WorkflowAction = {
      id: Date.now().toString(),
      type: actionType,
      config: {},
      order: workflow.actions.length
    };
    setWorkflow(prev => ({
      ...prev,
      actions: [...prev.actions, newAction]
    }));
    setSelectedActionId(newAction.id);
    setShowAddAction(false);
  };

  const handleUpdateAction = (actionId: string, updates: Partial<WorkflowAction>) => {
    setWorkflow(prev => ({
      ...prev,
      actions: prev.actions.map(action => 
        action.id === actionId ? { ...action, ...updates } : action
      )
    }));
  };

  const handleDeleteAction = (actionId: string) => {
    setWorkflow(prev => ({
      ...prev,
      actions: prev.actions.filter(action => action.id !== actionId)
    }));
    setSelectedActionId(null);
  };

  const handleMoveAction = (actionId: string, direction: 'up' | 'down') => {
    const index = workflow.actions.findIndex(a => a.id === actionId);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === workflow.actions.length - 1)) return;

    const newActions = [...workflow.actions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newActions[index], newActions[targetIndex]] = [newActions[targetIndex], newActions[index]];
    newActions.forEach((action, idx) => action.order = idx);

    setWorkflow(prev => ({
      ...prev,
      actions: newActions
    }));
  };

  const handleSave = () => {
    workflowService.updateWorkflow(workflow.id, workflow);
    onSave(workflow);
  };

  const selectedAction = selectedActionId ? workflow.actions.find(a => a.id === selectedActionId) : null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '95%',
        maxWidth: '1600px',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '2px solid #e9ecef',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: 'white' }}>
              ✏️ Edit Workflow
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>
              {workflow.name}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSave}
              style={{
                padding: '10px 24px',
                background: 'rgba(255,255,255,0.2)',
                border: '2px solid white',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.color = '#667eea';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.color = 'white';
              }}
            >
              ✓ Save
            </button>
            <button
              onClick={onCancel}
              style={{
                padding: '10px 24px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              ✕ Cancel
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '16px 24px',
          borderBottom: '1px solid #e9ecef',
          background: '#f8f9fa'
        }}>
          {(['trigger', 'actions', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '8px',
                background: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? '#667eea' : '#6b7280',
                fontWeight: activeTab === tab ? '600' : '500',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: activeTab === tab ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              {tab === 'trigger' && '🔔 Trigger'}
              {tab === 'actions' && '⚡ Actions'}
              {tab === 'settings' && '⚙️ Settings'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'grid', gridTemplateColumns: selectedAction ? '1fr 400px' : '1fr', gap: '24px' }}>
          
          {/* Trigger Tab */}
          {activeTab === 'trigger' && (
            <div>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Configure Trigger</h3>
              <div style={{
                background: 'white',
                border: '2px solid #e9ecef',
                borderRadius: '12px',
                padding: '24px'
              }}>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                    When should this workflow be triggered?
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {Object.entries(triggerTypes).map(([type, { label, icon, description }]) => (
                      <button
                        key={type}
                        onClick={() => handleTriggerChange({ type: type as WorkflowTriggerType })}
                        style={{
                          padding: '16px',
                          border: workflow.trigger.type === type ? '2px solid #667eea' : '2px solid #e9ecef',
                          borderRadius: '8px',
                          background: workflow.trigger.type === type ? '#f0f4ff' : 'white',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          if (workflow.trigger.type !== type) {
                            e.currentTarget.style.borderColor = '#d0d9ff';
                            e.currentTarget.style.background = '#fafbff';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (workflow.trigger.type !== type) {
                            e.currentTarget.style.borderColor = '#e9ecef';
                            e.currentTarget.style.background = 'white';
                          }
                        }}
                      >
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', color: '#111' }}>
                          {label}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {workflow.trigger.type === 'scheduled_time' && (
                  <div style={{ marginTop: '24px', padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                      Schedule (Cron Format)
                    </label>
                    <input
                      type="text"
                      placeholder="0 9 * * * (Daily at 9 AM)"
                      value={workflow.trigger.scheduleTime || ''}
                      onChange={(e) => handleTriggerChange({ scheduleTime: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #e9ecef',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'monospace'
                      }}
                    />
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                      💡 Examples: <code>0 9 * * *</code> (daily at 9 AM), <code>0 0 * * 0</code> (weekly on Sunday)
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Workflow Actions</h3>
                <button
                  onClick={() => setShowAddAction(!showAddAction)}
                  style={{
                    padding: '10px 16px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}
                >
                  {showAddAction ? '✕' : '+'} Add Action
                </button>
              </div>

              {showAddAction && (
                <div style={{
                  background: '#f0f4ff',
                  border: '2px solid #d0d9ff',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>Select Action Type</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                    {Object.entries(actionTypes).map(([type, { label, icon }]) => (
                      <button
                        key={type}
                        onClick={() => handleAddAction(type as WorkflowActionType)}
                        style={{
                          padding: '12px',
                          border: '1px solid #d0d9ff',
                          borderRadius: '6px',
                          background: 'white',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500',
                          textAlign: 'left',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#667eea';
                          e.currentTarget.style.color = 'white';
                          e.currentTarget.style.borderColor = '#667eea';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.color = 'inherit';
                          e.currentTarget.style.borderColor = '#d0d9ff';
                        }}
                      >
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {workflow.actions.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  background: 'white',
                  border: '2px dashed #e9ecef',
                  borderRadius: '12px',
                  color: '#6b7280'
                }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚡</div>
                  <p style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>No actions yet</p>
                  <p style={{ fontSize: '13px', margin: 0 }}>Add actions to define what happens when the trigger occurs</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {workflow.actions.map((action, index) => (
                    <div
                      key={action.id}
                      onClick={() => setSelectedActionId(action.id)}
                      style={{
                        padding: '16px',
                        background: selectedActionId === action.id ? '#f0f4ff' : 'white',
                        border: selectedActionId === action.id ? '2px solid #667eea' : '2px solid #e9ecef',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        if (selectedActionId !== action.id) {
                          e.currentTarget.style.borderColor = '#d0d9ff';
                          e.currentTarget.style.background = '#fafbff';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (selectedActionId !== action.id) {
                          e.currentTarget.style.borderColor = '#e9ecef';
                          e.currentTarget.style.background = 'white';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: '#f0f4ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#667eea'
                          }}>
                            {index + 1}
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111' }}>
                              {actionTypes[action.type].icon} {actionTypes[action.type].label}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                              {actionTypes[action.type].description}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveAction(action.id, 'up');
                            }}
                            disabled={index === 0}
                            style={{
                              width: '32px',
                              height: '32px',
                              border: '1px solid #e9ecef',
                              borderRadius: '4px',
                              background: 'white',
                              cursor: index === 0 ? 'not-allowed' : 'pointer',
                              opacity: index === 0 ? 0.5 : 1
                            }}
                          >
                            ▲
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveAction(action.id, 'down');
                            }}
                            disabled={index === workflow.actions.length - 1}
                            style={{
                              width: '32px',
                              height: '32px',
                              border: '1px solid #e9ecef',
                              borderRadius: '4px',
                              background: 'white',
                              cursor: index === workflow.actions.length - 1 ? 'not-allowed' : 'pointer',
                              opacity: index === workflow.actions.length - 1 ? 0.5 : 1
                            }}
                          >
                            ▼
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAction(action.id);
                            }}
                            style={{
                              width: '32px',
                              height: '32px',
                              border: '1px solid #fee2e2',
                              borderRadius: '4px',
                              background: '#fef2f2',
                              color: '#991b1b',
                              cursor: 'pointer'
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Workflow Settings</h3>
              <div style={{
                background: 'white',
                border: '2px solid #e9ecef',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                    Workflow Name
                  </label>
                  <input
                    type="text"
                    value={workflow.name}
                    onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e9ecef',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                    Description
                  </label>
                  <textarea
                    value={workflow.description}
                    onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e9ecef',
                      borderRadius: '6px',
                      fontSize: '14px',
                      minHeight: '100px',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{
                  padding: '16px',
                  background: '#f0f4ff',
                  border: '1px solid #d0d9ff',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer'
                }}
                onClick={() => setWorkflow(prev => ({ ...prev, enabled: !prev.enabled }))}
                >
                  <input
                    type="checkbox"
                    checked={workflow.enabled}
                    onChange={() => {}}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111' }}>
                      {workflow.enabled ? 'Workflow Active' : 'Workflow Inactive'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      {workflow.enabled ? 'This workflow is active and will run when triggered' : 'This workflow is inactive and will not run'}
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '16px',
                  background: '#f8f9fa',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                    <div style={{ marginBottom: '8px' }}>📊 <strong>Execution Count:</strong> {workflow.executionCount}</div>
                    <div>⏰ <strong>Last Executed:</strong> {workflow.lastExecutedAt ? new Date(workflow.lastExecutedAt).toLocaleString() : 'Never'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Configuration Panel */}
          {selectedAction && activeTab === 'actions' && (
            <div style={{
              background: 'white',
              border: '2px solid #e9ecef',
              borderRadius: '12px',
              padding: '20px',
              position: 'sticky',
              top: 0,
              maxHeight: 'calc(90vh - 200px)',
              overflow: 'auto'
            }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600' }}>
                {actionTypes[selectedAction.type].icon} Configure {actionTypes[selectedAction.type].label}
              </h4>

              {selectedAction.type === 'send_email' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Email To</label>
                    <input
                      type="text"
                      placeholder="{{client_email}} or email@example.com"
                      value={selectedAction.config.emailTo || ''}
                      onChange={(e) => handleUpdateAction(selectedAction.id, {
                        config: { ...selectedAction.config, emailTo: e.target.value }
                      })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #e9ecef',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Subject</label>
                    <input
                      type="text"
                      value={selectedAction.config.emailSubject || ''}
                      onChange={(e) => handleUpdateAction(selectedAction.id, {
                        config: { ...selectedAction.config, emailSubject: e.target.value }
                      })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #e9ecef',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Body</label>
                    <textarea
                      value={selectedAction.config.emailBody || ''}
                      onChange={(e) => handleUpdateAction(selectedAction.id, {
                        config: { ...selectedAction.config, emailBody: e.target.value }
                      })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #e9ecef',
                        borderRadius: '4px',
                        fontSize: '12px',
                        minHeight: '80px',
                        fontFamily: 'monospace',
                        resize: 'vertical'
                      }}
                      placeholder="Use {{variable_name}} for dynamic values"
                    />
                  </div>
                </div>
              )}

              {selectedAction.type === 'add_note' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Note Content</label>
                    <textarea
                      value={selectedAction.config.noteContent || ''}
                      onChange={(e) => handleUpdateAction(selectedAction.id, {
                        config: { ...selectedAction.config, noteContent: e.target.value }
                      })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #e9ecef',
                        borderRadius: '4px',
                        fontSize: '12px',
                        minHeight: '80px',
                        fontFamily: 'monospace',
                        resize: 'vertical'
                      }}
                      placeholder="Use {{variable_name}} for dynamic values"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Note Type</label>
                    <select
                      value={selectedAction.config.noteType || 'general'}
                      onChange={(e) => handleUpdateAction(selectedAction.id, {
                        config: { ...selectedAction.config, noteType: e.target.value }
                      })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #e9ecef',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    >
                      <option value="general">General</option>
                      <option value="important">Important</option>
                      <option value="follow_up">Follow Up</option>
                      <option value="internal">Internal</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedAction.type === 'wait_delay' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Days</label>
                      <input
                        type="number"
                        min="0"
                        value={selectedAction.config.delayDays || 0}
                        onChange={(e) => handleUpdateAction(selectedAction.id, {
                          config: { ...selectedAction.config, delayDays: parseInt(e.target.value) }
                        })}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #e9ecef',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Hours</label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={selectedAction.config.delayHours || 0}
                        onChange={(e) => handleUpdateAction(selectedAction.id, {
                          config: { ...selectedAction.config, delayHours: parseInt(e.target.value) }
                        })}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #e9ecef',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Minutes</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={selectedAction.config.delayMinutes || 0}
                        onChange={(e) => handleUpdateAction(selectedAction.id, {
                          config: { ...selectedAction.config, delayMinutes: parseInt(e.target.value) }
                        })}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid #e9ecef',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedAction.type === 'create_task' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Task Title</label>
                    <input
                      type="text"
                      value={selectedAction.config.taskTitle || ''}
                      onChange={(e) => handleUpdateAction(selectedAction.id, {
                        config: { ...selectedAction.config, taskTitle: e.target.value }
                      })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #e9ecef',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Description</label>
                    <textarea
                      value={selectedAction.config.taskDescription || ''}
                      onChange={(e) => handleUpdateAction(selectedAction.id, {
                        config: { ...selectedAction.config, taskDescription: e.target.value }
                      })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #e9ecef',
                        borderRadius: '4px',
                        fontSize: '12px',
                        minHeight: '60px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Due Date</label>
                    <input
                      type="date"
                      value={selectedAction.config.taskDueDate || ''}
                      onChange={(e) => handleUpdateAction(selectedAction.id, {
                        config: { ...selectedAction.config, taskDueDate: e.target.value }
                      })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #e9ecef',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{
                padding: '12px',
                background: '#f0f4ff',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#4338ca',
                marginTop: '16px'
              }}>
                💡 <strong>Tip:</strong> Use double braces like <code>{'{{client_name}}'}</code> for dynamic values
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowEditor;
