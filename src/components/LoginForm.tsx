import React, { useState } from "react";

interface LoginFormProps {
  onLogin: (username: string, password: string) => void;
  onSignUp?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  const handleSocialLogin = (provider: string) => {
    console.log(`Login with ${provider}`);
    // Implement social login logic here
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      padding: '0 20px',
      height: '100%',
      textAlign: 'center',
      backgroundColor: '#ffffff',
      width: '100%'
    }}>
      <h1 style={{
        fontSize: '1.8rem',
        fontWeight: 'bold',
        marginBottom: '1rem',
        color: '#333',
        margin: 0
      }}>
        Sign In
      </h1>

      {/* Social Login Buttons */}
      <div style={{
        display: 'flex',
        gap: '0.8rem',
        marginBottom: '1.2rem',
        marginTop: '1.2rem',
        justifyContent: 'center'
      }}>
        <button
          onClick={() => handleSocialLogin('facebook')}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '1px solid #ddd',
            backgroundColor: 'transparent',
            color: '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#1877f2';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.borderColor = '#1877f2';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#333';
            e.currentTarget.style.borderColor = '#ddd';
          }}
        >
          f
        </button>
        <button
          onClick={() => handleSocialLogin('google')}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '1px solid #ddd',
            backgroundColor: 'transparent',
            color: '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#db4437';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.borderColor = '#db4437';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#333';
            e.currentTarget.style.borderColor = '#ddd';
          }}
        >
          G
        </button>
        <button
          onClick={() => handleSocialLogin('github')}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '1px solid #ddd',
            backgroundColor: 'transparent',
            color: '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#333';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.borderColor = '#333';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#333';
            e.currentTarget.style.borderColor = '#ddd';
          }}
        >
          @
        </button>
      </div>

      <p style={{
        color: '#666',
        marginBottom: '1.5rem',
        fontSize: '0.9rem'
      }}>
        or use your email account
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '300px' }}>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            required
            onChange={e => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 15px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              backgroundColor: '#eee',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            required
            onChange={e => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 15px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              backgroundColor: '#eee',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>

        <div style={{
          textAlign: 'center',
          marginBottom: '1.5rem'
        }}>
          <a href="#" style={{
            color: '#666',
            textDecoration: 'none',
            fontSize: '0.9rem'
          }}>
            Forgot password?
          </a>
        </div>

        <button 
          type="submit"
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a359a'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6f42c1'}
        >
          Sign In
        </button>
      </form>
    </div>
  );
};

export default LoginForm;