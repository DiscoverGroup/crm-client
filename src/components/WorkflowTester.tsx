import React, { useState } from 'react';
import type { Workflow } from '../types/workflow';
import workflowService from '../services/workflowService';

interface WorkflowTesterProps {
  workflow: Workflow;
  onClose: () => void;
}

const WorkflowTester: React.FC<WorkflowTesterProps> = ({ workflow, onClose }) => {
  const [testData, setTestData] = useState<string>(JSON.stringify({
    client: {
      id: 'client_123',
      name: 'Test Client',
      email: 'test@example.com',
      status: 'Active'
    },
    action: 'client_created',
    timestamp: new Date().toISOString()
  }, null, 2));

  const [testResults, setTestResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunTest = async () => {
    try {
      setIsRunning(true);
      const data = JSON.parse(testData);
      
      // Simulate workflow execution
      const execution = await workflowService.executeWorkflow(
        workflow,
        data,
        'test_user'
      );

      setTestResults({
        success: execution.status === 'completed',
        execution,
        timestamp: new Date().toLocaleString()
      });
    } catch (error) {
      setTestResults({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toLocaleString()
      });
    } finally {
      setIsRunning(false);
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
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9998,
      backdropFilter: 'blur(4px)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '2px solid #e9ecef',
          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>
            🧪 Test Workflow: {workflow.name}
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
        <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Input */}
          <div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
              Test Data
            </h3>
            <textarea
              value={testData}
              onChange={(e) => setTestData(e.target.value)}
              style={{
                width: '100%',
                height: '400px',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
                resize: 'none',
                backgroundColor: '#f8fafc'
              }}
              placeholder="Enter test data as JSON..."
            />
            <button
              onClick={handleRunTest}
              disabled={isRunning}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '12px',
                background: isRunning ? '#cbd5e1' : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {isRunning ? '⏳ Running Test...' : '▶️ Run Test'}
            </button>
          </div>

          {/* Results */}
          <div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
              Results
            </h3>
            {testResults ? (
              <div style={{
                height: '400px',
                overflow: 'auto',
                padding: '12px',
                background: testResults.success ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${testResults.success ? '#bbf7d0' : '#fee2e2'}`,
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: testResults.success ? '#065f46' : '#991b1b'
              }}>
                <div style={{ marginBottom: '12px', fontWeight: '600', fontSize: '14px' }}>
                  {testResults.success ? '✅ Test Passed' : '❌ Test Failed'}
                </div>
                <div style={{ marginBottom: '12px', color: '#64748b', fontSize: '11px' }}>
                  {testResults.timestamp}
                </div>
                {testResults.error && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Error:</div>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {testResults.error}
                    </div>
                  </div>
                )}
                {testResults.execution && (
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Execution Details:</div>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {JSON.stringify(testResults.execution, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                height: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc',
                border: '1px dashed #e2e8f0',
                borderRadius: '8px',
                color: '#6b7280',
                textAlign: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧪</div>
                  <p style={{ margin: 0 }}>Run a test to see results here</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '2px solid #e9ecef',
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              border: 'none',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowTester;
