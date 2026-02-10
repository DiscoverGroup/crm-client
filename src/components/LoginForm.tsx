import React, { useState } from "react";
import { createPortal } from "react-dom";
import { showSuccessToast, showErrorToast, showWarningToast, showInfoToast } from '../utils/toast';

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
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetUserEmail, setResetUserEmail] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Check if URL has reset token or verification token
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('reset');
    const verifyToken = urlParams.get('verify');
    const emailParam = urlParams.get('email');
    
    if (resetToken && emailParam) {
      setResetUserEmail(emailParam);
      setShowResetPassword(true);
      // Clean URL
      window.history.replaceState({}, '', '/');
    } else if (verifyToken && emailParam) {
      // Handle email verification
      handleEmailVerification(verifyToken, emailParam);
      // Clean URL
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleEmailVerification = (token: string, email: string) => {
    const usersData = localStorage.getItem('crm_users');
    if (!usersData) {
      showErrorToast('Verification failed: User not found');
      return;
    }

    try {
      const users = JSON.parse(usersData);
      const userIndex = users.findIndex((u: any) => u.email === email);
      
      if (userIndex === -1) {
        showErrorToast('Verification failed: User not found');
        return;
      }

      const user = users[userIndex];

      // Check if already verified
      if (user.isVerified) {
        showInfoToast('Your email is already verified! You can now login.');
        return;
      }

      // Check if token matches
      if (user.verificationToken !== token) {
        showErrorToast('Verification failed: Invalid verification link');
        return;
      }

      // Check if token expired
      if (Date.now() > user.verificationTokenExpiry) {
        showErrorToast('Verification failed: This link has expired. Please contact support.');
        return;
      }

      // Verify the user
      users[userIndex].isVerified = true;
      users[userIndex].verificationToken = null;
      users[userIndex].verificationTokenExpiry = null;
      users[userIndex].verifiedAt = new Date().toISOString();
      
      localStorage.setItem('crm_users', JSON.stringify(users));
      
      showSuccessToast('Email verified successfully! You can now login to your account.');
    } catch (error) {
      // console.error('Error verifying email:', error);
      showErrorToast('An error occurred during verification. Please try again.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      showWarningToast('Please enter your email address');
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
      
      // console.log('Response status:', response.status);
      // console.log('Response data:', data);

      if (response.ok && data.success) {
        showSuccessToast(`Password reset email sent to ${resetEmail}! Please check your inbox and follow the instructions.`);
        setShowForgotPassword(false);
        setResetEmail('');
      } else {
        const errorDetails = data.details ? ` Details: ${data.details}` : '';
        // console.error('Failed to send email:', data);
        showErrorToast(`Failed to send reset email. Please try again. Error: ${data.error || 'Unknown error'}${errorDetails}`);
      }
    } catch (error) {
      // console.error('Error sending reset email:', error);
      showErrorToast('An error occurred. Please try again later.');
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      showWarningToast('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showWarningToast('Passwords do not match!');
      return;
    }

    if (newPassword.length < 6) {
      showWarningToast('Password must be at least 6 characters long');
      return;
    }

    // Get users from localStorage
    const usersData = localStorage.getItem('crm_users');
    if (!usersData) {
      showErrorToast('User not found');
      return;
    }

    try {
      const users = JSON.parse(usersData);
      const userIndex = users.findIndex((u: any) => u.email === resetUserEmail);
      
      if (userIndex === -1) {
        showErrorToast('User not found');
        return;
      }

      // Update password
      users[userIndex].password = newPassword;
      localStorage.setItem('crm_users', JSON.stringify(users));

      showSuccessToast('Password reset successful! Please login with your new password.');
      setShowResetPassword(false);
      setNewPassword('');
      setConfirmNewPassword('');
      setResetUserEmail('');
    } catch (error) {
      // console.error('Error resetting password:', error);
      showErrorToast('An error occurred. Please try again.');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      padding: window.innerWidth < 640 ? '24px 20px' : '48px 40px',
      height: window.innerWidth < 768 ? 'auto' : '100%',
      minHeight: window.innerWidth < 768 ? '0' : '100%',
      textAlign: 'center',
      backgroundColor: '#ffffff',
      width: '100%',
      borderRadius: window.innerWidth < 768 ? '0' : '20px 0 0 20px',
      boxShadow: window.innerWidth < 768 ? 'none' : '-5px 0 15px rgba(0,0,0,0.05)'
    }}>
      <div style={{ marginBottom: window.innerWidth < 640 ? '24px' : '40px' }}>
        <h1 style={{
          fontSize: window.innerWidth < 640 ? '26px' : '32px',
          fontWeight: '700',
          marginBottom: '12px',
          color: '#0d47a1',
          margin: 0,
          letterSpacing: '-0.5px'
        }}>
          Welcome Back
        </h1>
        <p style={{
          fontSize: window.innerWidth < 640 ? '14px' : '15px',
          color: '#6b7280',
          margin: '8px 0 0 0'
        }}>
          Sign in to DG-CRM
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: window.innerWidth < 640 ? '100%' : '360px' }}>
        <div style={{ marginBottom: '16px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            required
            onChange={e => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: window.innerWidth < 640 ? '12px 14px' : '14px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '10px',
              fontSize: window.innerWidth < 640 ? '14px' : '15px',
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
              padding: window.innerWidth < 640 ? '12px 14px' : '14px 16px',
              paddingRight: '48px',
              border: '2px solid #e5e7eb',
              borderRadius: '10px',
              fontSize: window.innerWidth < 640 ? '14px' : '15px',
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
              fontSize: window.innerWidth < 640 ? '18px' : '20px',
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
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: window.innerWidth < 640 ? '13px' : '14px',
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
            padding: window.innerWidth < 640 ? '16px' : '14px',
            background: 'linear-gradient(135deg, #0d47a1 0%, #1565a0 50%, #fbbf24 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: window.innerWidth < 640 ? '14px' : '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: '0 4px 12px rgba(13, 71, 161, 0.3)',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent'
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

      {/* Reset Password Modal */}
      {showResetPassword && createPortal(
        <div onClick={() => {
          setShowResetPassword(false);
          setNewPassword('');
          setConfirmNewPassword('');
        }} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            width: '90%',
            maxWidth: '420px',
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
              Create New Password
            </h2>
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              Enter your new password for {resetUserEmail}
            </p>
            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '16px', position: 'relative' }}>
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="New Password"
                  value={newPassword}
                  required
                  onChange={e => setNewPassword(e.target.value)}
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
                    transition: 'all 0.2s ease'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6b7280'
                  }}
                >
                  {showNewPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              <div style={{ marginBottom: '24px', position: 'relative' }}>
                <input
                  type={showConfirmNewPassword ? "text" : "password"}
                  placeholder="Confirm New Password"
                  value={confirmNewPassword}
                  required
                  onChange={e => setConfirmNewPassword(e.target.value)}
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
                    transition: 'all 0.2s ease'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6b7280'
                  }}
                >
                  {showConfirmNewPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPassword(false);
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#e5e7eb',
                    color: '#1f2937',
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
                  Reset Password
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
