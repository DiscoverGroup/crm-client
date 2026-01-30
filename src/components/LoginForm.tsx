import React, { useState } from "react";

interface LoginFormProps {
  onLogin: (username: string, password: string) => void;
  onSignUp?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
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
        </div>

        <div style={{
          textAlign: 'right',
          marginBottom: '24px'
        }}>
          <a href="#" style={{
            color: '#1e7bb8',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Forgot password?
          </a>
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
    </div>
  );
};

export default LoginForm;
