import React, { useState } from "react";

interface RegisterFormProps {
  onRegister: (form: { 
    username: string; 
    email: string; 
    password: string; 
    fullName: string;
    department: string;
    position: string;
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

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDept = e.target.value;
    setDepartment(selectedDept);
    setPosition(""); // Reset position when department changes
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      alert("Passwords do not match.");
      return;
    }
    if (!department) {
      alert("Please select a department.");
      return;
    }
    if (!position) {
      alert("Please select a position.");
      return;
    }
    onRegister({ username, email, password, fullName, department, position });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      padding: '40px 32px',
      height: '100%',
      textAlign: 'center',
      backgroundColor: '#ffffff',
      width: '100%',
      borderRadius: '0 20px 20px 0',
      boxShadow: '5px 0 15px rgba(0,0,0,0.05)'
    }}>
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          marginBottom: '12px',
          color: '#1e3a8a',
          margin: 0,
          letterSpacing: '-0.5px'
        }}>
          Create Account
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#6b7280',
          margin: '8px 0 0 0'
        }}>
          Join DG-CRM today
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '340px' }}>
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            required
            onChange={e => setFullName(e.target.value)}
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
          <input
            type="text"
            placeholder="Username"
            value={username}
            required
            onChange={e => setUsername(e.target.value)}
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
        
        <div style={{ marginBottom: '12px', position: 'relative' }}>
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

        <div style={{ marginBottom: '20px' }}>
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
          Sign Up
        </button>
      </form>
    </div>
  );
};

export default RegisterForm;

