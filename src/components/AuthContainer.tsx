import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

interface AuthContainerProps {
  onLogin: (username: string, password: string) => void;
  onRegister: (form: { username: string; email: string; password: string; fullName: string; department: string; position: string }) => boolean | void;
}

const AuthContainer: React.FC<AuthContainerProps> = ({ onLogin, onRegister }) => {
  const [showRegister, setShowRegister] = useState(false);

  const handleLogin = (email: string, password: string) => {
    onLogin(email, password);
  };

  const handleRegister = (userData: { username: string; email: string; password: string; fullName: string; department: string; position: string }) => {
    const success = onRegister(userData);
    // Switch back to login form after successful registration
    if (success) {
      setTimeout(() => setShowRegister(false), 300);
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      background: 'linear-gradient(135deg, #0d47a1 0%, #1565a0 40%, #1e7bb8 70%, #fbbf24 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      
      {/* Background animated elements */}
      <div style={{
        position: 'absolute',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        animation: 'float 20s infinite linear',
        opacity: 0.4
      }} />

      {/* Main container */}
      <div style={{
        background: 'white',
        borderRadius: '24px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        width: '75vw',
        height: '75vh',
        minWidth: '900px',
        minHeight: '600px',
        maxWidth: '1300px',
        maxHeight: '800px',
        position: 'relative',
        display: 'flex'
      }}>
        
        {/* Form Container */}
        <div style={{
          width: '50%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Forms Wrapper */}
          <div style={{
            width: '200%',
            height: '100%',
            display: 'flex',
            transform: showRegister ? 'translateX(-50%)' : 'translateX(0%)',
            transition: 'transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
          }}>
            {/* Login Form */}
            <div style={{
              width: '50%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '2rem 1.5rem'
            }}>
              <LoginForm 
                onLogin={handleLogin} 
                onSignUp={() => setShowRegister(true)} 
              />
            </div>

            {/* Register Form */}
            <div style={{
              width: '50%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '2rem 1.5rem'
            }}>
              <RegisterForm onRegister={handleRegister} />
              <button
                type="button"
                onClick={() => setShowRegister(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#1e7bb8',
                  fontSize: '14px',
                  cursor: 'pointer',
                  marginTop: '1rem',
                  textAlign: 'center',
                  textDecoration: 'underline'
                }}
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div style={{
          width: '50%',
          height: '100%',
          background: 'linear-gradient(135deg, #0d47a1 0%, #1565a0 40%, #1e7bb8 70%, #fbbf24 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          padding: '3rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Animated background */}
          <div style={{
            position: 'absolute',
            width: '300%',
            height: '300%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
            animation: 'rotate 30s infinite linear',
            opacity: 0.4
          }} />

          {/* DG Logo */}
          <div style={{
            position: 'absolute',
            top: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 2
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: '700',
              color: '#0d47a1',
              boxShadow: '0 4px 6px -1px rgba(251, 191, 36, 0.4)',
              border: '2px solid rgba(255,255,255,0.3)'
            }}>
              DG
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '600', letterSpacing: '0.5px' }}>DG-CRM</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Discover Group</div>
            </div>
          </div>

          {/* Content changes based on form */}
          <div style={{
            textAlign: 'center',
            zIndex: 2,
            transform: showRegister ? 'translateY(0)' : 'translateY(0)',
            transition: 'all 0.6s ease',
            opacity: 1
          }}>
            {!showRegister ? (
              <>
                <h2 style={{
                  fontSize: '40px',
                  fontWeight: '700',
                  marginBottom: '20px',
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  letterSpacing: '-0.5px'
                }}>
                  Welcome Back!
                </h2>
                <p style={{
                  fontSize: '17px',
                  marginBottom: '32px',
                  opacity: 0.95,
                  lineHeight: '1.6',
                  maxWidth: '400px',
                  margin: '0 auto 32px'
                }}>
                  To keep connected with us please login with your personal info
                </p>
                <button
                  onClick={() => setShowRegister(true)}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(10px)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    padding: '14px 48px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fbbf24';
                    e.currentTarget.style.color = '#0d47a1';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = '#fbbf24';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                  }}
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>
                <h2 style={{
                  fontSize: '40px',
                  fontWeight: '700',
                  marginBottom: '20px',
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  letterSpacing: '-0.5px'
                }}>
                  Hello, Friend!
                </h2>
                <p style={{
                  fontSize: '17px',
                  marginBottom: '32px',
                  opacity: 0.95,
                  lineHeight: '1.6',
                  maxWidth: '400px',
                  margin: '0 auto 32px'
                }}>
                  Enter your personal details and start your journey with us
                </p>
                <button
                  onClick={() => setShowRegister(false)}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(10px)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    padding: '14px 48px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fbbf24';
                    e.currentTarget.style.color = '#0d47a1';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = '#fbbf24';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                  }}
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes float {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
            100% { transform: translateY(0px) rotate(360deg); }
          }
          
          @keyframes rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default AuthContainer;



