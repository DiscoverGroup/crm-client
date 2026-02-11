import React, { useState, useEffect } from 'react';
import territoryService from '../services/territoryService';
import type {
  Territory,
  AssignmentRule,
  TerritoryStats,
  AssignmentLog,
} from '../types/territory';
import './TerritoryManager.css';

type TabType = 'territories' | 'rules' | 'assignments' | 'performance';

interface TerritoryManagerProps {
  onClose?: () => void;
}

export const TerritoryManager: React.FC<TerritoryManagerProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('territories');
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [stats, setStats] = useState<TerritoryStats[]>([]);
  const [logs, setLogs] = useState<AssignmentLog[]>([]);
  
  const [showTerritoryModal, setShowTerritoryModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingTerritory, setEditingTerritory] = useState<Territory | null>(null);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setTerritories(territoryService.getAllTerritories());
    setRules(territoryService.getAllRules());
    setLogs(territoryService.getAssignmentLogs());
    
    const allStats = territoryService.getAllTerritories().map(t =>
      territoryService.getTerritoryStats(t.id)
    ).filter((s): s is TerritoryStats => s !== null);
    setStats(allStats);
  };

  // ==================== Territory Management ====================

  const handleCreateTerritory = (territoryData: Partial<Territory>) => {
    if (!territoryData.name) {
      alert('Territory name is required');
      return;
    }
    
    setLoading(true);
    try {
      const newTerritory = territoryService.createTerritory({
        name: territoryData.name,
        description: territoryData.description || '',
        type: territoryData.type || 'geographic',
        boundaries: territoryData.boundaries,
        teamMembers: [],
        active: true,
        createdBy: 'current-user',
        lastModifiedBy: 'current-user',
      });
      
      setTerritories([...territories, newTerritory]);
      setShowTerritoryModal(false);
      alert('Territory created successfully');
    } catch (error) {
      alert(`Error creating territory: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTerritory = (territoryData: Partial<Territory>) => {
    if (!editingTerritory || !territoryData.name) {
      alert('Territory name is required');
      return;
    }
    
    setLoading(true);
    try {
      const updated = territoryService.updateTerritory(editingTerritory.id, {
        ...territoryData,
        lastModifiedBy: 'current-user',
      });
      
      setTerritories(territories.map(t => t.id === updated.id ? updated : t));
      setEditingTerritory(null);
      setShowTerritoryModal(false);
      alert('Territory updated successfully');
    } catch (error) {
      alert(`Error updating territory: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTerritory = (id: string) => {
    if (window.confirm('Are you sure you want to delete this territory?')) {
      setLoading(true);
      try {
        if (territoryService.deleteTerritory(id)) {
          setTerritories(territories.filter(t => t.id !== id));
          alert('Territory deleted successfully');
        } else {
          alert('Territory not found');
        }
      } catch (error) {
        alert(`Error deleting territory: ${error}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // ==================== Rule Management ====================

  const handleCreateRule = (ruleData: Partial<AssignmentRule>) => {
    if (!ruleData.name) {
      alert('Rule name is required');
      return;
    }
    
    setLoading(true);
    try {
      const newRule = territoryService.createAssignmentRule({
        name: ruleData.name,
        description: ruleData.description || '',
        priority: ruleData.priority || 0,
        conditions: ruleData.conditions || [],
        logicalOperator: ruleData.logicalOperator || 'AND',
        action: ruleData.action || { type: 'load_balance' },
        active: true,
        createdBy: 'current-user',
      });
      
      setRules([...rules, newRule]);
      setShowRuleModal(false);
      alert('Rule created successfully');
    } catch (error) {
      alert(`Error creating rule: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRule = (ruleData: Partial<AssignmentRule>) => {
    if (!editingRule || !ruleData.name) {
      alert('Rule name is required');
      return;
    }
    
    setLoading(true);
    try {
      const updated = territoryService.updateAssignmentRule(editingRule.id, {
        ...ruleData,
      });
      
      setRules(rules.map(r => r.id === updated.id ? updated : r));
      setEditingRule(null);
      setShowRuleModal(false);
      alert('Rule updated successfully');
    } catch (error) {
      alert(`Error updating rule: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = (id: string) => {
    if (window.confirm('Are you sure you want to delete this rule?')) {
      setLoading(true);
      try {
        if (territoryService.deleteAssignmentRule(id)) {
          setRules(rules.filter(r => r.id !== id));
          alert('Rule deleted successfully');
        } else {
          alert('Rule not found');
        }
      } catch (error) {
        alert(`Error deleting rule: ${error}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // ==================== Render Functions ====================

  const renderTerritoryCard = (territory: Territory) => {
    const stat = stats.find(s => s.territoryId === territory.id);
    
    return (
      <div key={territory.id} className="territory-card">
        <div className="card-header">
          <h3>{territory.name}</h3>
          <span className={`badge ${territory.active ? 'active' : 'inactive'}`}>
            {territory.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        
        <p className="description">{territory.description}</p>
        
        <div className="card-stats">
          <div className="stat">
            <span className="label">Team Members:</span>
            <span className="value">{territory.teamMembers.filter(m => m.active).length}</span>
          </div>
          <div className="stat">
            <span className="label">Total Clients:</span>
            <span className="value">{stat?.totalClients || 0}</span>
          </div>
          <div className="stat">
            <span className="label">Capacity:</span>
            <span className="value">{stat ? `${stat.capacityUtilization.toFixed(1)}%` : '0%'}</span>
          </div>
        </div>
        
        <div className="card-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingTerritory(territory);
              setShowTerritoryModal(true);
            }}
          >
            ✏️ Edit
          </button>
          <button
            className="btn btn-danger"
            onClick={() => handleDeleteTerritory(territory.id)}
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    );
  };

  const renderRuleRow = (rule: AssignmentRule) => {
    return (
      <tr key={rule.id}>
        <td>{rule.name}</td>
        <td>{rule.priority}</td>
        <td>{rule.conditions.length}</td>
        <td>{rule.action.type}</td>
        <td>
          <span className={`badge ${rule.active ? 'active' : 'inactive'}`}>
            {rule.active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>
          <button
            className="btn btn-small"
            onClick={() => {
              setEditingRule(rule);
              setShowRuleModal(true);
            }}
          >
            ✏️
          </button>
          <button
            className="btn btn-small btn-danger"
            onClick={() => handleDeleteRule(rule.id)}
          >
            🗑️
          </button>
        </td>
      </tr>
    );
  };

  const renderTerritoryTab = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Territory Management</h2>
        <button
          className="btn btn-success"
          onClick={() => {
            setEditingTerritory(null);
            setShowTerritoryModal(true);
          }}
        >
          + Add Territory
        </button>
      </div>
      
      <div className="territories-grid">
        {territories.length === 0 ? (
          <p className="empty-state">No territories found. Create one to get started.</p>
        ) : (
          territories.map(renderTerritoryCard)
        )}
      </div>
    </div>
  );

  const renderRulesTab = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Assignment Rules</h2>
        <button
          className="btn btn-success"
          onClick={() => {
            setEditingRule(null);
            setShowRuleModal(true);
          }}
        >
          + Add Rule
        </button>
      </div>
      
      {rules.length === 0 ? (
        <p className="empty-state">No rules found. Create one to enable automatic assignment.</p>
      ) : (
        <table className="rules-table">
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Priority</th>
              <th>Conditions</th>
              <th>Action Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map(renderRuleRow)}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderAssignmentsTab = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Team Assignments</h2>
      </div>
      
      {territories.length === 0 ? (
        <p className="empty-state">No territories found. Create a territory first.</p>
      ) : (
        <div className="assignments-grid">
          {territories.map(territory => (
            <div key={territory.id} className="assignment-card">
              <h3>{territory.name}</h3>
              
              {territory.teamMembers.length === 0 ? (
                <p className="empty-state">No team members assigned</p>
              ) : (
                <div className="team-members">
                  {territory.teamMembers.map(member => (
                    <div key={member.userId} className="member-item">
                      <div className="member-info">
                        <strong>{member.userName}</strong>
                        <span className={`role-badge ${member.role}`}>{member.role}</span>
                      </div>
                      <div className="member-stats">
                        <span>Clients: {member.currentClientCount}/{member.maxCapacity}</span>
                        {member.specialties && member.specialties.length > 0 && (
                          <span>Specialties: {member.specialties.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderPerformanceTab = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Performance & Metrics</h2>
      </div>
      
      <div className="performance-section">
        <h3>Recent Assignments</h3>
        
        {logs.length === 0 ? (
          <p className="empty-state">No assignments yet</p>
        ) : (
          <div className="logs-list">
            {logs.slice(0, 20).map(log => (
              <div key={log.id} className={`log-item ${log.success ? 'success' : 'failed'}`}>
                <div className="log-header">
                  <span className="client">{log.clientName}</span>
                  <span className={`status ${log.success ? 'success' : 'error'}`}>
                    {log.success ? '✓ Success' : '✗ Failed'}
                  </span>
                </div>
                <div className="log-details">
                  <span>
                    Assigned to: {log.newAssignment.userName || log.newAssignment.userId}
                  </span>
                  <span>{log.reason}</span>
                  <span className="timestamp">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="performance-section">
        <h3>Capacity Utilization</h3>
        <div className="utilization-chart">
          {stats.map(stat => (
            <div key={stat.territoryId} className="utilization-item">
              <div className="territory-name">{stat.territoryName}</div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(stat.capacityUtilization, 100)}%`,
                    backgroundColor: stat.capacityUtilization > 80 ? '#ff6b6b' : 
                                     stat.capacityUtilization > 50 ? '#ffd93d' : '#6bcf7f'
                  }}
                />
              </div>
              <div className="utilization-text">
                {stat.capacityUtilization.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderModal = () => {
    if (!showTerritoryModal && !showRuleModal) {
      return null;
    }

    if (showTerritoryModal) {
      return (
        <TerritoryFormModal
          territory={editingTerritory}
          onSave={editingTerritory ? handleUpdateTerritory : handleCreateTerritory}
          onClose={() => {
            setShowTerritoryModal(false);
            setEditingTerritory(null);
          }}
          loading={loading}
        />
      );
    }

    if (showRuleModal) {
      return (
        <RuleFormModal
          rule={editingRule}
          territories={territories}
          onSave={editingRule ? handleUpdateRule : handleCreateRule}
          onClose={() => {
            setShowRuleModal(false);
            setEditingRule(null);
          }}
          loading={loading}
        />
      );
    }

    return null;
  };

  return (
    <div className="territory-manager">
      <div className="manager-header">
        <h1>🗺️ Territory Management</h1>
        {onClose && (
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'territories' ? 'active' : ''}`}
          onClick={() => setActiveTab('territories')}
        >
          Territories
        </button>
        <button
          className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          Rules
        </button>
        <button
          className={`tab-btn ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          Team Assignments
        </button>
        <button
          className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          Performance
        </button>
      </div>

      <div className="tab-container">
        {activeTab === 'territories' && renderTerritoryTab()}
        {activeTab === 'rules' && renderRulesTab()}
        {activeTab === 'assignments' && renderAssignmentsTab()}
        {activeTab === 'performance' && renderPerformanceTab()}
      </div>

      {renderModal()}
    </div>
  );
};

// ==================== Territory Form Modal ====================

interface TerritoryFormModalProps {
  territory: Territory | null;
  onSave: (data: Partial<Territory>) => void;
  onClose: () => void;
  loading: boolean;
}

const TerritoryFormModal: React.FC<TerritoryFormModalProps> = ({
  territory,
  onSave,
  onClose,
  loading,
}) => {
  const [formData, setFormData] = useState<Partial<Territory>>(
    territory || {
      name: '',
      description: '',
      type: 'geographic',
      active: true,
    }
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'active' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content territory-form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{territory ? 'Edit Territory' : 'Create Territory'}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Territory Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name || ''}
              onChange={handleChange}
              placeholder="e.g., North America, Europe West"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              placeholder="Describe the territory, coverage area, etc."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Territory Type</label>
            <select
              name="type"
              value={formData.type || 'geographic'}
              onChange={handleChange}
            >
              <option value="geographic">Geographic</option>
              <option value="regional">Regional</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                name="active"
                checked={formData.active || false}
                onChange={handleChange}
              />
              Active
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSave(formData)}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Territory'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== Rule Form Modal ====================

interface RuleFormModalProps {
  rule: AssignmentRule | null;
  territories: Territory[];
  onSave: (data: Partial<AssignmentRule>) => void;
  onClose: () => void;
  loading: boolean;
}

const RuleFormModal: React.FC<RuleFormModalProps> = ({
  rule,
  territories,
  onSave,
  onClose,
  loading,
}) => {
  const [formData, setFormData] = useState<Partial<AssignmentRule>>(
    rule || {
      name: '',
      description: '',
      priority: 0,
      conditions: [],
      logicalOperator: 'AND',
      action: { type: 'load_balance' },
      active: true,
    }
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'priority') {
      setFormData(prev => ({
        ...prev,
        priority: parseInt(value) || 0,
      }));
    } else if (name === 'active') {
      setFormData(prev => ({
        ...prev,
        active: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleActionTypeChange = (actionType: string) => {
    setFormData(prev => ({
      ...prev,
      action: { type: actionType as any },
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content rule-form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{rule ? 'Edit Rule' : 'Create Rule'}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Rule Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name || ''}
              onChange={handleChange}
              placeholder="e.g., Assign Visa Specialists"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              placeholder="Describe when this rule applies"
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>Priority (Higher = Evaluated First)</label>
            <input
              type="number"
              name="priority"
              value={formData.priority || 0}
              onChange={handleChange}
              min="0"
              max="100"
            />
          </div>

          <div className="form-group">
            <label>Logical Operator</label>
            <select
              name="logicalOperator"
              value={formData.logicalOperator || 'AND'}
              onChange={handleChange}
            >
              <option value="AND">All conditions must match (AND)</option>
              <option value="OR">Any condition matches (OR)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Assignment Action Type</label>
            <select
              value={formData.action?.type || 'load_balance'}
              onChange={e => handleActionTypeChange(e.target.value)}
            >
              <option value="load_balance">Load Balance</option>
              <option value="assign_to_territory">Assign to Territory</option>
              <option value="assign_by_specialty">Assign by Specialty</option>
              <option value="assign_to_user">Assign to User</option>
            </select>
          </div>

          {formData.action?.type === 'assign_to_territory' && territories.length > 0 && (
            <div className="form-group">
              <label>Target Territory</label>
              <select
                onChange={e => setFormData(prev => ({
                  ...prev,
                  action: { ...prev.action!, territoryId: e.target.value },
                }))}
              >
                <option value="">Select territory...</option>
                {territories.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                name="active"
                checked={formData.active || false}
                onChange={handleChange}
              />
              Active
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSave(formData)}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TerritoryManager;
