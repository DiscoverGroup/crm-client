import React, { useState } from "react";
import { createPortal } from "react-dom";

interface LoginFormProps {
  onLogin: (username: string, password: string) => void;
  onSignUp?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      alert('Please enter your email address');
      return;
    }

    try {
      // Get users from localStorage to send to backend
      const usersData = localStorage.getItem('crm_users') || '[]';
      
      const response = await fetch('/.netlify/functions/send-reset-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email: resetEmail,
          users: usersData
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`Password reset email sent to ${resetEmail}!\n\nPlease check your inbox and follow the instructions.`);
        setShowForgotPassword(false);
        setResetEmail('');
      } else {
        alert(`Failed to send reset email. Please try again.\n\nError: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending reset email:', error);
      alert('An error occurred. Please try again later.');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      padding: '48px 40px',
      height: '100%',
      textAlign: 'center',
      backgroundColor: '#ffffff',
      width: '100%',
      borderRadius: '20px 0 0 20px',
      boxShadow: '-5px 0 15px rgba(0,0,0,0.05)'
    }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          marginBottom: '12px',
          color: '#0d47a1',
          margin: 0,
          letterSpacing: '-0.5px'
        }}>
          Welcome Back
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#6b7280',
          margin: '8px 0 0 0'
        }}>
          Sign in to DG-CRM
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ marginBottom: '16px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            required
            onChange={e => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '10px',
              fontSize: '15px',
              backgroundColor: '#f9fafb',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'all 0.2s ease',
              color: '#1f2937'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#1e7bb8';
              e.currentTarget.style.backgroundColor = 'white';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.backgroundColor = '#f9fafb';
            }}
          />
        </div>
        
        <div style={{ marginBottom: '16px', position: 'relative' }}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            required
            onChange={e => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px',
              paddingRight: '48px',
              border: '2px solid #e5e7eb',
              borderRadius: '10px',
              fontSize: '15px',
              backgroundColor: '#f9fafb',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'all 0.2s ease',
              color: '#1f2937'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#1e7bb8';
              e.currentTarget.style.backgroundColor = 'white';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.backgroundColor = '#f9fafb';
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px 8px',
              color: '#6b7280'
            }}
          >
            {showPassword ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            color: '#6b7280',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              style={{
                marginRight: '8px',
                cursor: 'pointer'
              }}
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#1e7bb8',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              padding: 0
            }}
          >
            Forgot password?
          </button>
        </div>

        <button 
          type="submit"
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #0d47a1 0%, #1565a0 50%, #fbbf24 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: '0 4px 12px rgba(13, 71, 161, 0.3)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(13, 71, 161, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(13, 71, 161, 0.3)';
          }}
        >
          Sign In
        </button>
      </form>

      {/* Forgot Password Modal - Rendered using Portal */}
      {showForgotPassword && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }} onClick={() => setShowForgotPassword(false)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            maxHeight: '90vh',
            overflow: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{
              margin: '0 0 12px 0',
              fontSize: '24px',
              fontWeight: '700',
              color: '#0d47a1'
            }}>
              Reset Password
            </h2>
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleForgotPassword}>
              <input
                type="email"
                placeholder="Email Address"
                value={resetEmail}
                required
                onChange={e => setResetEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '15px',
                  backgroundColor: '#f9fafb',
                  boxSizing: 'border-box',
                  outline: 'none',
                  marginBottom: '20px',
                  color: '#1f2937'
                }}
              />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail('');
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textTransform: 'uppercase'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #0d47a1 0%, #1565a0 50%, #fbbf24 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textTransform: 'uppercase'
                  }}
                >
                  Send Link
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default LoginForm;
