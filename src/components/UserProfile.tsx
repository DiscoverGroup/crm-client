import React, { useState, useEffect } from 'react';

interface UserProfileProps {
  currentUser: string;
  onBack: () => void;
  onUpdateUser: (updatedData: UserData) => void;
}

interface UserData {
  fullName: string;
  username: string;
  email: string;
  department: string;
  position: string;
  password?: string;
}

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

const UserProfile: React.FC<UserProfileProps> = ({ currentUser, onBack, onUpdateUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState<UserData>({
    fullName: '',
    username: '',
    email: '',
    department: '',
    position: ''
  });
  const [originalData, setOriginalData] = useState<UserData>({
    fullName: '',
    username: '',
    email: '',
    department: '',
    position: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Load user data from localStorage
    const users = localStorage.getItem('crm_users');
    if (users) {
      const userList = JSON.parse(users);
      const user = userList.find((u: any) => u.fullName === currentUser);
      if (user) {
        const data = {
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          department: user.department || '',
          position: user.position || ''
        };
        setUserData(data);
        setOriginalData(data);
      }
    }
  }, [currentUser]);

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDept = e.target.value;
    setUserData(prev => ({
      ...prev,
      department: newDept,
      position: '' // Reset position when department changes
    }));
  };

  const handleSave = () => {
    // Validate password if changing
    if (newPassword && newPassword !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    // Get all users
    const users = localStorage.getItem('crm_users');
    if (users) {
      const userList = JSON.parse(users);
      const userIndex = userList.findIndex((u: any) => u.fullName === currentUser);
      
      if (userIndex !== -1) {
        // Update user data
        userList[userIndex] = {
          ...userList[userIndex],
          fullName: userData.fullName,
          username: userData.username,
          email: userData.email,
          department: userData.department,
          position: userData.position,
          ...(newPassword && { password: newPassword })
        };

        // Save to localStorage
        localStorage.setItem('crm_users', JSON.stringify(userList));

        // Update auth if name changed
        if (userData.fullName !== currentUser) {
          const authData = localStorage.getItem('crm_auth');
          if (authData) {
            const auth = JSON.parse(authData);
            auth.currentUser = userData.fullName;
            localStorage.setItem('crm_auth', JSON.stringify(auth));
          }
        }

        setOriginalData(userData);
        setIsEditing(false);
        setNewPassword('');
        setConfirmPassword('');
        onUpdateUser(userData);
        alert('Profile updated successfully!');
      }
    }
  };

  const handleCancel = () => {
    setUserData(originalData);
    setNewPassword('');
    setConfirmPassword('');
    setIsEditing(false);
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '900px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '30px',
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ margin: '0 0 5px 0', color: '#0d47a1', fontSize: '28px' }}>
              User Profile
            </h1>
            <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
              View and edit your account information
            </p>
          </div>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #0d47a1 0%, #1565a0 50%, #fbbf24 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            ✏️ Edit Profile
          </button>
        )}
      </div>

      {/* Profile Content */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        {/* Profile Picture Section */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '30px',
          paddingBottom: '30px',
          borderBottom: '2px solid #e9ecef'
        }}>
          <div style={{
            width: '100px',
            height: '100px',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            fontWeight: '700',
            color: '#0d47a1',
            boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)'
          }}>
            {userData.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: '#2c3e50', fontSize: '24px' }}>
              {userData.fullName}
            </h2>
            <p style={{ margin: '0 0 5px 0', color: '#6c757d', fontSize: '14px' }}>
              {userData.position} {userData.department && `• ${userData.department}`}
            </p>
            <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
              📧 {userData.email}
            </p>
          </div>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2c3e50',
              fontSize: '14px'
            }}>
              Full Name *
            </label>
            <input
              type="text"
              value={userData.fullName}
              onChange={(e) => setUserData({ ...userData, fullName: e.target.value })}
              disabled={!isEditing}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: isEditing ? '#fff' : '#f9fafb',
                color: '#2c3e50',
                cursor: isEditing ? 'text' : 'not-allowed',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2c3e50',
              fontSize: '14px'
            }}>
              Username *
            </label>
            <input
              type="text"
              value={userData.username}
              onChange={(e) => setUserData({ ...userData, username: e.target.value })}
              disabled={!isEditing}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: isEditing ? '#fff' : '#f9fafb',
                color: '#2c3e50',
                cursor: isEditing ? 'text' : 'not-allowed',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '600',
            color: '#2c3e50',
            fontSize: '14px'
          }}>
            Email *
          </label>
          <input
            type="email"
            value={userData.email}
            onChange={(e) => setUserData({ ...userData, email: e.target.value })}
            disabled={!isEditing}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: isEditing ? '#fff' : '#f9fafb',
              color: '#2c3e50',
              cursor: isEditing ? 'text' : 'not-allowed',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2c3e50',
              fontSize: '14px'
            }}>
              Department *
            </label>
            <select
              value={userData.department}
              onChange={handleDepartmentChange}
              disabled={!isEditing}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: isEditing ? '#fff' : '#f9fafb',
                color: '#2c3e50',
                cursor: isEditing ? 'pointer' : 'not-allowed',
                boxSizing: 'border-box'
              }}
            >
              <option value="">Select Department</option>
              {Object.keys(departmentPositions).map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2c3e50',
              fontSize: '14px'
            }}>
              Position *
            </label>
            <select
              value={userData.position}
              onChange={(e) => setUserData({ ...userData, position: e.target.value })}
              disabled={!isEditing || !userData.department}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: isEditing && userData.department ? '#fff' : '#f9fafb',
                color: '#2c3e50',
                cursor: isEditing && userData.department ? 'pointer' : 'not-allowed',
                boxSizing: 'border-box'
              }}
            >
              <option value="">
                {userData.department ? 'Select Position' : 'Select Department First'}
              </option>
              {userData.department && departmentPositions[userData.department]?.map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Password Change Section */}
        {isEditing && (
          <div style={{
            marginTop: '30px',
            paddingTop: '30px',
            borderTop: '2px solid #e9ecef'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#0d47a1', fontSize: '18px' }}>
              Change Password (Optional)
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ position: 'relative' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  New Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#fff',
                    color: '#2c3e50',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '42px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '18px',
                    color: '#6b7280'
                  }}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  Confirm New Password
                </label>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#fff',
                    color: '#2c3e50',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '42px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '18px',
                    color: '#6b7280'
                  }}
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {isEditing && (
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            marginTop: '30px',
            paddingTop: '20px',
            borderTop: '2px solid #e9ecef'
          }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #0d47a1 0%, #1565a0 50%, #fbbf24 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(13, 71, 161, 0.3)'
              }}
            >
              💾 Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
