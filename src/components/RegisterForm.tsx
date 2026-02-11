import React, { useState } from "react";
import { uploadFileToR2 } from '../services/r2UploadService';
import Modal from './Modal';

interface RegisterFormProps {
  onRegister: (form: { 
    username: string; 
    email: string; 
    password: string; 
    fullName: string;
    department: string;
    position: string;
    profileImage?: string;
  }) => void;
  onSignIn?: () => void;
}

// Department and Position mapping
const departmentPositions: Record<string, string[]> = {
  "Executives Department": [
    "Operations Manager",
    "Division Manager",
    "Executive Secretary",
    "Executive Assistant"
  ],
  "Visa Department": [
    "Visa Department Head",
    "Team Lead - Visa Officer",
    "Visa Officer",
    "General Admin — Visa",
    "VFS and Airport Assistance Officer",
    "Visa Assistant Facilitator"
  ],
  "Booking Department": [
    "Booking Supervisor",
    "Booking Officer",
    "General Admin for Booking"
  ],
  "Marketing Department": [
    "Marketing Officer",
    "Graphic Artist"
  ],
  "Sales Department": [
    "Travel Sales Agent",
    "General Admin — Sales"
  ],
  "Customer Service Department": [
    "Customer Service Refund",
    "Account Relations Manager (ARM)",
    "Team Lead - ARM",
    "General Admin - ARM"
  ],
  "Human Resource Department": [
    "HR Assistant — Recruitment",
    "HR Officer",
    "General Admin - HR"
  ],
  "Information & Technology Department": [
    "IT Manager",
    "IT Systems Administrator",
    "IT Support",
    "Web Developer"
  ],
  "Finance Department": [
    "Finance Officer"
  ],
  "Research and Development Department": [
    "Research Development Officer"
  ]
};

const RegisterForm: React.FC<RegisterFormProps> = ({ onRegister }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileImage, setProfileImage] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const generateStrongPassword = (): string => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
    const allChars = uppercase + lowercase + numbers + symbols;
    
    let pwd = '';
    pwd += uppercase[Math.floor(Math.random() * uppercase.length)];
    pwd += lowercase[Math.floor(Math.random() * lowercase.length)];
    pwd += numbers[Math.floor(Math.random() * numbers.length)];
    pwd += symbols[Math.floor(Math.random() * symbols.length)];
    
    for (let i = pwd.length; i < 16; i++) {
      pwd += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleGeneratePassword = () => {
    const newPassword = generateStrongPassword();
    setPassword(newPassword);
    setConfirm(newPassword);
  };

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDept = e.target.value;
    setDepartment(selectedDept);
    setPosition(""); // Reset position when department changes
  };

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // console.log('Profile image selected:', file.name, file.type, file.size);
    setUploading(true);
    try {
      const bucket = import.meta.env.VITE_R2_BUCKET_NAME || 'crm-uploads';
      // console.log('Uploading to bucket:', bucket, 'folder: profile-images');
      const result = await uploadFileToR2(file, bucket, 'profile-images');
      
      // console.log('Upload result:', result);
      
      if (result.success && result.url) {
        setProfileImage(result.url);
        // console.log('Profile image URL set:', result.url);
      } else {
        // console.error('Upload failed:', result.error);
        setModalConfig({
          isOpen: true,
          title: 'Upload Failed',
          message: 'Failed to upload profile image. Make sure R2.dev subdomain is enabled in Cloudflare bucket settings.',
          type: 'error'
        });
      }
    } catch (error) {
      // console.error('Error uploading profile image:', error);
      setModalConfig({
        isOpen: true,
        title: 'Upload Error',
        message: 'Error uploading profile image: ' + (error instanceof Error ? error.message : String(error)),
        type: 'error'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setModalConfig({
        isOpen: true,
        title: 'Password Mismatch',
        message: 'Passwords do not match.',
        type: 'error'
      });
      return;
    }
    if (!department) {
      setModalConfig({
        isOpen: true,
        title: 'Missing Department',
        message: 'Please select a department.',
        type: 'warning'
      });
      return;
    }
    if (!position) {
      setModalConfig({
        isOpen: true,
        title: 'Missing Position',
        message: 'Please select a position.',
        type: 'warning'
      });
      return;
    }
    onRegister({ username, email, password, fullName, department, position, profileImage });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexDirection: 'column',
      padding: window.innerWidth < 640 ? '24px 20px' : '40px 32px',
      height: window.innerWidth < 768 ? 'auto' : '100%',
      minHeight: window.innerWidth < 768 ? '0' : '100%',
      textAlign: 'center',
      backgroundColor: '#ffffff',
      width: '100%',
      borderRadius: window.innerWidth < 768 ? '0' : '0 20px 20px 0',
      boxShadow: window.innerWidth < 768 ? 'none' : '5px 0 15px rgba(0,0,0,0.05)',
      overflowY: window.innerWidth < 768 ? 'visible' : 'auto'
    }}>
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
      <div style={{ marginBottom: window.innerWidth < 640 ? '24px' : '36px' }}>
        <h1 style={{
          fontSize: window.innerWidth < 640 ? '26px' : '32px',
          fontWeight: '700',
          marginBottom: '12px',
          color: '#1e3a8a',
          margin: 0,
          letterSpacing: '-0.5px'
        }}>
          Create Account
        </h1>
        <p style={{
          fontSize: window.innerWidth < 640 ? '14px' : '15px',
          color: '#6b7280',
          margin: '8px 0 0 0'
        }}>
          Join DG-CRM today
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: window.innerWidth < 640 ? '100%' : '340px' }}>
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            required
            onChange={e => setFullName(e.target.value)}
            style={{
              width: '100%',
              padding: window.innerWidth < 640 ? '10px 12px' : '12px 14px',
              border: '2px solid #e5e7eb',
              borderRadius: '10px',
              fontSize: window.innerWidth < 640 ? '13px' : '14px',
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
        
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            required
            onChange={e => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: window.innerWidth < 640 ? '10px 12px' : '12px 14px',
              border: '2px solid #e5e7eb',
              borderRadius: '10px',
              fontSize: '14px',
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
        
        <div style={{ marginBottom: '12px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            required
            onChange={e => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '2px solid #e5e7eb',
              borderRadius: '10px',
              fontSize: '14px',
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
        
        <div style={{ marginBottom: '12px' }}>
          <div style={{ marginBottom: '8px', position: 'relative' }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              required
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                paddingRight: '48px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '14px',
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
                fontSize: '18px',
                color: '#6b7280',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#1e7bb8'}
              onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleGeneratePassword}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#f0f9ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              color: '#1e7bb8',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#e0f2fe';
              e.currentTarget.style.borderColor = '#7dd3fc';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f9ff';
              e.currentTarget.style.borderColor = '#bfdbfe';
            }}
          >
            🔐 Generate Strong Password
          </button>
        </div>

        <div style={{ marginBottom: '12px', position: 'relative' }}>
          <input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm Password"
            value={confirm}
            required
            onChange={e => setConfirm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              paddingRight: '48px',
              border: '2px solid #e5e7eb',
              borderRadius: '10px',
              fontSize: '14px',
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
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#6b7280',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = '#1e7bb8'}
            onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
          >
            {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <select
            value={department}
            required
            onChange={handleDepartmentChange}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '2px solid #e5e7eb',
              borderRadius: '10px',
              fontSize: '14px',
              backgroundColor: '#f9fafb',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'all 0.2s ease',
              color: department ? '#1f2937' : '#9ca3af',
              cursor: 'pointer'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#1e7bb8';
              e.currentTarget.style.backgroundColor = 'white';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.backgroundColor = '#f9fafb';
            }}
          >
            <option value="" disabled>Select Department</option>
            {Object.keys(departmentPositions).map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <select
            value={position}
            required
            onChange={e => setPosition(e.target.value)}
            disabled={!department}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '2px solid #e5e7eb',
              borderRadius: '10px',
              fontSize: '14px',
              backgroundColor: department ? '#f9fafb' : '#e5e7eb',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'all 0.2s ease',
              color: position ? '#1f2937' : '#9ca3af',
              cursor: department ? 'pointer' : 'not-allowed'
            }}
            onFocus={(e) => {
              if (department) {
                e.currentTarget.style.borderColor = '#1e7bb8';
                e.currentTarget.style.backgroundColor = 'white';
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.backgroundColor = department ? '#f9fafb' : '#e5e7eb';
            }}
          >
            <option value="" disabled>
              {department ? 'Select Position' : 'Select Department First'}
            </option>
            {department && departmentPositions[department]?.map((pos) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151'
          }}>
            Profile Image (Optional)
          </label>
          {profileImage && (
            <div style={{ marginBottom: '12px', textAlign: 'center' }}>
              <img 
                src={profileImage} 
                alt="Profile Preview" 
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #1e7bb8'
                }}
              />
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleProfileImageUpload}
            disabled={uploading}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '2px solid #e5e7eb',
              borderRadius: '10px',
              fontSize: '14px',
              backgroundColor: '#f9fafb',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'all 0.2s ease',
              color: '#1f2937',
              cursor: uploading ? 'not-allowed' : 'pointer'
            }}
          />
          {uploading && (
            <p style={{ fontSize: '12px', color: '#1e7bb8', marginTop: '8px' }}>
              Uploading image...
            </p>
          )}
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
          Sign Up
        </button>
      </form>
    </div>
  );
};

export default RegisterForm;

