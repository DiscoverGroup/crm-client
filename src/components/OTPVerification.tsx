import React, { useState, useRef, type KeyboardEvent } from 'react';

interface OTPVerificationProps {
  email: string;
  onVerify: (code: string) => void;
  onResend: () => void;
  onCancel: () => void;
}

const OTPVerification: React.FC<OTPVerificationProps> = ({ email, onVerify, onResend, onCancel }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value[0]; // Only take first character
    }

    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (index === 5 && value && newOtp.every(digit => digit !== '')) {
      handleSubmit(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    
    setOtp(newOtp);
    
    if (pastedData.length === 6) {
      inputRefs[5].current?.focus();
      handleSubmit(pastedData);
    } else if (pastedData.length > 0) {
      inputRefs[Math.min(pastedData.length, 5)].current?.focus();
    }
  };

  const handleSubmit = (code?: string) => {
    const fullCode = code || otp.join('');
    if (fullCode.length === 6) {
      setIsVerifying(true);
      onVerify(fullCode);
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
      zIndex: 10000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        animation: 'modalSlideIn 0.3s ease-out'
      }}>
        <style>
          {`
            @keyframes modalSlideIn {
              from {
                opacity: 0;
                transform: translateY(-20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}
        </style>

        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            margin: '0 auto 20px'
          }}>
            🔐
          </div>
          <h2 style={{
            margin: '0 0 10px 0',
            fontSize: '24px',
            fontWeight: '600',
            color: '#1f2937'
          }}>
            Verify Your Email
          </h2>
          <p style={{
            margin: 0,
            fontSize: '15px',
            color: '#6b7280',
            lineHeight: '1.6'
          }}>
            We've sent a 6-digit code to<br />
            <strong>{email}</strong>
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          marginBottom: '30px'
        }}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={inputRefs[index]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={isVerifying}
              style={{
                width: '56px',
                height: '64px',
                fontSize: '28px',
                fontWeight: 'bold',
                textAlign: 'center',
                border: '2px solid',
                borderColor: digit ? '#1e7bb8' : '#e5e7eb',
                borderRadius: '12px',
                outline: 'none',
                transition: 'all 0.2s ease',
                backgroundColor: isVerifying ? '#f9fafb' : 'white',
                cursor: isVerifying ? 'not-allowed' : 'text'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#1e7bb8';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30, 123, 184, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = digit ? '#1e7bb8' : '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          ))}
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <button
            onClick={() => handleSubmit()}
            disabled={otp.some(digit => !digit) || isVerifying}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: otp.every(digit => digit) ? '#1e7bb8' : '#d1d5db',
              color: 'white',
              fontSize: '16px',
              fontWeight: '600',
              cursor: otp.every(digit => digit) && !isVerifying ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease'
            }}
          >
            {isVerifying ? 'Verifying...' : 'Verify Code'}
          </button>

          <div style={{
            display: 'flex',
            gap: '12px'
          }}>
            <button
              onClick={onResend}
              disabled={isVerifying}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: '2px solid #e5e7eb',
                backgroundColor: 'white',
                color: '#6b7280',
                fontSize: '15px',
                fontWeight: '500',
                cursor: isVerifying ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Resend Code
            </button>
            <button
              onClick={onCancel}
              disabled={isVerifying}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: '2px solid #e5e7eb',
                backgroundColor: 'white',
                color: '#6b7280',
                fontSize: '15px',
                fontWeight: '500',
                cursor: isVerifying ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Cancel
            </button>
          </div>
        </div>

        <p style={{
          marginTop: '20px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#9ca3af'
        }}>
          Code expires in 10 minutes
        </p>
      </div>
    </div>
  );
};

export default OTPVerification;
