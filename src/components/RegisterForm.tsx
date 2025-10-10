import React, { useState } from "react";

interface RegisterFormProps {
  onRegister: (form: { username: string; email: string; password: string; fullName: string }) => void;
  onSignIn?: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onRegister }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      alert("Passwords do not match.");
      return;
    }
    onRegister({ username, email, password, fullName });
  };

  const handleSocialLogin = (provider: string) => {
    console.log(`Register with ${provider}`);
    // Implement social registration logic here
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
        fontSize: '1.5rem',
        fontWeight: 'bold',
        marginBottom: '0.5rem',
        color: '#333',
        margin: 0
      }}>
        Create Account
      </h1>

      <div style={{
        display: 'flex',
        gap: '0.8rem',
        marginBottom: '1rem',
        marginTop: '1rem',
        justifyContent: 'center'
      }}>
        <button
          onClick={() => handleSocialLogin('facebook')}
          style={{
            width: '35px',
            height: '35px',
            borderRadius: '50%',
            border: '1px solid #ddd',
            backgroundColor: 'transparent',
            color: '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            transition: 'all 0.3s ease'
          }}
        >
          f
        </button>
        <button
          onClick={() => handleSocialLogin('google')}
          style={{
            width: '35px',
            height: '35px',
            borderRadius: '50%',
            border: '1px solid #ddd',
            backgroundColor: 'transparent',
            color: '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            transition: 'all 0.3s ease'
          }}
        >
          G
        </button>
        <button
          onClick={() => handleSocialLogin('github')}
          style={{
            width: '35px',
            height: '35px',
            borderRadius: '50%',
            border: '1px solid #ddd',
            backgroundColor: 'transparent',
            color: '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            transition: 'all 0.3s ease'
          }}
        >
          @
        </button>
      </div>

      <p style={{
        color: '#666',
        marginBottom: '1rem',
        fontSize: '0.8rem'
      }}>
        or use your email for registration
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '280px' }}>
        <div style={{ marginBottom: '0.6rem' }}>
          <input
            type="text"
            placeholder="Name"
            value={fullName}
            required
            onChange={e => setFullName(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.9rem',
              backgroundColor: '#eee',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '0.6rem' }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            required
            onChange={e => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.9rem',
              backgroundColor: '#eee',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '0.6rem' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            required
            onChange={e => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.9rem',
              backgroundColor: '#eee',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '0.6rem' }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            required
            onChange={e => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.9rem',
              backgroundColor: '#eee',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirm}
            required
            onChange={e => setConfirm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.9rem',
              backgroundColor: '#eee',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>

        <button 
          type="submit"
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          Sign Up
        </button>
      </form>
    </div>
  );
};

export default RegisterForm;
