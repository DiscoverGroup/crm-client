import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

interface AuthContainerProps {
  onLogin: (username: string, password: string) => void;
  onRegister: (form: { username: string; email: string; password: string; fullName: string }) => void;
}

const AuthContainer: React.FC<AuthContainerProps> = ({ onLogin, onRegister }) => {
  const [showRegister, setShowRegister] = useState(false);

  const handleLogin = (email: string, password: string) => {
    onLogin(email, password);
  };

  const handleRegister = (userData: { username: string; email: string; password: string; fullName: string }) => {
    onRegister(userData);
  };

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        animation: 'float 20s infinite linear',
        opacity: 0.3
      }} />

      {/* Main container */}
      <div style={{
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        width: '70vw',
        height: '70vh',
        minWidth: '800px',
        minHeight: '500px',
        maxWidth: '1200px',
        maxHeight: '700px',
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
                  color: '#667eea',
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
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          padding: '2rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Animated background */}
          <div style={{
            position: 'absolute',
            width: '300%',
            height: '300%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
            animation: 'rotate 30s infinite linear',
            opacity: 0.3
          }} />

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
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  marginBottom: '1rem',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}>
                  Welcome Back!
                </h2>
                <p style={{
                  fontSize: '1.1rem',
                  marginBottom: '2rem',
                  opacity: 0.9,
                  lineHeight: '1.6'
                }}>
                  To keep connected with us please login with your personal info
                </p>
                <button
                  onClick={() => setShowRegister(true)}
                  style={{
                    background: 'transparent',
                    border: '2px solid white',
                    color: 'white',
                    padding: '12px 45px',
                    borderRadius: '25px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = '#667eea';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>
                <h2 style={{
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  marginBottom: '1rem',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}>
                  Hello, Friend!
                </h2>
                <p style={{
                  fontSize: '1.1rem',
                  marginBottom: '2rem',
                  opacity: 0.9,
                  lineHeight: '1.6'
                }}>
                  Enter your personal details and start your journey with us
                </p>
                <button
                  onClick={() => setShowRegister(false)}
                  style={{
                    background: 'transparent',
                    border: '2px solid white',
                    color: 'white',
                    padding: '12px 45px',
                    borderRadius: '25px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = '#667eea';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.transform = 'translateY(0)';
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