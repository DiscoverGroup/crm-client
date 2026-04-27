import React, { useState } from 'react';
import Turnstile from 'react-turnstile';

interface TurnstileGateProps {
  onVerified: (token: string) => void;
}

const TurnstileGate: React.FC<TurnstileGateProps> = ({ onVerified }) => {
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(135deg, #071f55 0%, #0A2D74 60%, #28A2DC 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: "'Poppins', sans-serif",
    }}>
      {/* Logo / branding */}
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <div style={{
          width: '72px',
          height: '72px',
          background: 'rgba(255,255,255,0.12)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          backdropFilter: 'blur(8px)',
          border: '1.5px solid rgba(255,255,255,0.2)',
        }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="rgba(255,255,255,0.15)" />
            <path d="M20 8C13.37 8 8 13.37 8 20C8 26.63 13.37 32 20 32C26.63 32 32 26.63 32 20C32 13.37 26.63 8 20 8ZM20 28C15.59 28 12 24.41 12 20C12 15.59 15.59 12 20 12C24.41 12 28 15.59 28 20C28 24.41 24.41 28 20 28Z" fill="white" opacity="0.9" />
            <circle cx="20" cy="20" r="4" fill="white" />
          </svg>
        </div>
        <h1 style={{
          color: 'white',
          fontSize: '28px',
          fontWeight: '700',
          margin: '0 0 8px',
          letterSpacing: '-0.5px',
        }}>
          DG-CRM
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.65)',
          fontSize: '15px',
          margin: 0,
        }}>
          Discover Group
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '24px',
        padding: '40px 48px',
        textAlign: 'center',
        maxWidth: '420px',
        width: '90%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
      }}>
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{
            color: 'white',
            fontSize: '20px',
            fontWeight: '600',
            margin: '0 0 8px',
          }}>
            Security Verification
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: '14px',
            margin: 0,
            lineHeight: '1.6',
          }}>
            Please complete the check below to confirm you're not a bot before accessing the portal.
          </p>
        </div>

        {/* Turnstile widget */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: error ? '16px' : '0' }}>
          <Turnstile
            key={retryKey}
            sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
            onVerify={(token) => {
              setError(false);
              onVerified(token);
            }}
            onExpire={() => setError(false)}
            onError={() => setError(true)}
            theme="dark"
          />
        </div>

        {error && (
          <div style={{ marginTop: '16px' }}>
            <p style={{ color: '#fca5a5', fontSize: '13px', margin: '0 0 12px' }}>
              Verification failed. Please try again.
            </p>
            <button
              onClick={() => { setError(false); setRetryKey(k => k + 1); }}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '8px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <p style={{
        color: 'rgba(255,255,255,0.3)',
        fontSize: '12px',
        marginTop: '32px',
      }}>
        Protected by Cloudflare Turnstile
      </p>
    </div>
  );
};

export default TurnstileGate;
