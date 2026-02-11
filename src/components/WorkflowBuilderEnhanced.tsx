import React, { useState, useEffect } from 'react';
import type { 
  Workflow, 
  WorkflowTriggerType,
  WorkflowExecution 
} from '../types/workflow';
import { WORKFLOW_TEMPLATES } from '../types/workflow';
import workflowService from '../services/workflowService';
import WorkflowEditor from './WorkflowEditor';
import WorkflowTester from './WorkflowTester';

interface WorkflowBuilderProps {
  onClose: () => void;
}

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ onClose }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [activeTab, setActiveTab] = useState<'workflows' | 'templates' | 'executions'>('workflows');
  const [showEditor, setShowEditor] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [showTester, setShowTester] = useState(false);
  const [testingWorkflow, setTestingWorkflow] = useState<Workflow | null>(null);

  useEffect(() => {
    loadWorkflows();
    loadExecutions();
  }, []);

  const loadWorkflows = () => {
    const allWorkflows = workflowService.getAllWorkflows();
    setWorkflows(allWorkflows);
  };

  const loadExecutions = () => {
    const allExecutions = workflowService.getExecutions();
    setExecutions(allExecutions);
  };

  const handleCreateFromTemplate = (templateId: string) => {
    const template = WORKFLOW_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    workflowService.createWorkflow({
      name: template.name,
      description: template.description,
      enabled: true,
      trigger: template.trigger,
      actions: template.actions,
      createdBy: 'current_user'
    });

    loadWorkflows();
  };

  const handleCreateNew = () => {
    workflowService.createWorkflow({
      name: 'New Workflow',
      description: 'Describe what this workflow does',
      enabled: false,
      trigger: { type: 'client_created' },
      actions: [],
      createdBy: 'current_user'
    });

    loadWorkflows();
  };

  const handleToggleEnabled = (workflow: Workflow) => {
    workflowService.updateWorkflow(workflow.id, { enabled: !workflow.enabled });
    loadWorkflows();
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      workflowService.deleteWorkflow(workflowId);
      loadWorkflows();
    }
  };

  const getTriggerIcon = (type: WorkflowTriggerType): string => {
    const icons: Record<WorkflowTriggerType, string> = {
      client_created: '✨',
      client_updated: '✏️',
      client_deleted: '🗑️',
      client_status_changed: '🔄',
      message_sent: '📤',
      message_received: '📥',
      file_uploaded: '📎',
      note_added: '📝',
      user_login: '🔐',
      scheduled_time: '⏰',
      manual_trigger: '👆'
    };
    return icons[type] || '🔧';
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
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '95%',
        maxWidth: '1400px',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
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
              🔄 Workflow Automation
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>
              Automate repetitive tasks and save time
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '8px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '20px',
              color: 'white',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '16px 24px',
          borderBottom: '1px solid #e9ecef',
          background: '#f8f9fa'
        }}>
          {(['workflows', 'templates', 'executions'] as const).map(tab => (
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
              {tab === 'workflows' && `📋 My Workflows (${workflows.length})`}
              {tab === 'templates' && `⭐ Templates (${WORKFLOW_TEMPLATES.length})`}
              {tab === 'executions' && `📊 Execution History (${executions.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {/* Workflows Tab */}
          {activeTab === 'workflows' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Active Workflows</h3>
                <button
                  onClick={handleCreateNew}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                    boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)'
                  }}
                >
                  + Create New Workflow
                </button>
              </div>

              {workflows.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#6b7280'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
                  <p style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>No workflows yet</p>
                  <p style={{ fontSize: '14px', margin: 0 }}>Create your first workflow or use a template to get started</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
                  {workflows.map(workflow => (
                    <div key={workflow.id} style={{
                      background: 'white',
                      border: '1px solid #e9ecef',
                      borderRadius: '12px',
                      padding: '20px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '20px' }}>{getTriggerIcon(workflow.trigger.type)}</span>
                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{workflow.name}</h4>
                          </div>
                          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{workflow.description}</p>
                        </div>
                        <div style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: workflow.enabled ? '#d1fae5' : '#fee2e2',
                          color: workflow.enabled ? '#065f46' : '#991b1b'
                        }}>
                          {workflow.enabled ? 'ACTIVE' : 'DISABLED'}
                        </div>
                      </div>

                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                        <div>📍 Trigger: {workflow.trigger.type.replace(/_/g, ' ')}</div>
                        <div>⚡ Actions: {workflow.actions.length}</div>
                        <div>▶️ Executions: {workflow.executionCount}</div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleEnabled(workflow);
                          }}
                          style={{
                            flex: 1,
                            padding: '8px',
                            border: '1px solid #e9ecef',
                            borderRadius: '6px',
                            background: 'white',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          {workflow.enabled ? '⏸️ Disable' : '▶️ Enable'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingWorkflow(workflow);
                            setShowEditor(true);
                          }}
                          style={{
                            flex: 1,
                            padding: '8px',
                            border: '1px solid #e9ecef',
                            borderRadius: '6px',
                            background: 'white',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTestingWorkflow(workflow);
                            setShowTester(true);
                          }}
                          style={{
                            flex: 1,
                            padding: '8px',
                            border: '1px solid #e9ecef',
                            borderRadius: '6px',
                            background: 'white',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          🧪 Test
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWorkflow(workflow.id);
                          }}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #fee2e2',
                            borderRadius: '6px',
                            background: '#fef2f2',
                            color: '#991b1b',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Workflow Templates</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
                {WORKFLOW_TEMPLATES.map(template => (
                  <div key={template.id} style={{
                    background: 'white',
                    border: '1px solid #e9ecef',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '32px' }}>{template.icon}</span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{template.name}</h4>
                        <span style={{
                          fontSize: '11px',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          fontWeight: '500'
                        }}>
                          {template.category.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                      {template.description}
                    </p>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
                      <div>📍 Trigger: {template.trigger.type.replace(/_/g, ' ')}</div>
                      <div>⚡ Actions: {template.actions.length} steps</div>
                    </div>
                    <button
                      onClick={() => handleCreateFromTemplate(template.id)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      Use This Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Executions Tab */}
          {activeTab === 'executions' && (
            <div>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Execution History</h3>
              {executions.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#6b7280'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                  <p style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>No executions yet</p>
                  <p style={{ fontSize: '14px', margin: 0 }}>Workflow executions will appear here</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {executions.map(execution => (
                    <div key={execution.id} style={{
                      background: 'white',
                      border: '1px solid #e9ecef',
                      borderRadius: '12px',
                      padding: '16px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>
                            {execution.workflowName}
                          </h4>
                          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                            {new Date(execution.startedAt).toLocaleString()}
                          </p>
                        </div>
                        <div style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: execution.status === 'completed' ? '#d1fae5' : '#fee2e2',
                          color: execution.status === 'completed' ? '#065f46' : '#991b1b'
                        }}>
                          {execution.status.toUpperCase()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
                        <div>Steps: {execution.steps.length}</div>
                        <div>Duration: {execution.completedAt ? 
                          Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000) + 's'
                          : 'Running...'
                        }</div>
                      </div>
                      {execution.error && (
                        <div style={{
                          marginTop: '12px',
                          padding: '8px 12px',
                          background: '#fef2f2',
                          border: '1px solid #fee2e2',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#991b1b'
                        }}>
                          ❌ {execution.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {showEditor && editingWorkflow && (
        <WorkflowEditor
          workflow={editingWorkflow}
          onSave={() => {
            setShowEditor(false);
            setEditingWorkflow(null);
            loadWorkflows();
          }}
          onCancel={() => {
            setShowEditor(false);
            setEditingWorkflow(null);
          }}
        />
      )}

      {/* Tester Modal */}
      {showTester && testingWorkflow && (
        <WorkflowTester
          workflow={testingWorkflow}
          onClose={() => {
            setShowTester(false);
            setTestingWorkflow(null);
            loadExecutions();
          }}
        />
      )}
    </div>
  );
};

export default WorkflowBuilder;
