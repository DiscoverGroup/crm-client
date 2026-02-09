import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuthContainer from "./components/AuthContainer";
import MainPage from "./components/MainPage";
import Modal from "./components/Modal";
import OTPVerification from "./components/OTPVerification";
import UserDirectory from "./components/UserDirectory";
import UserProfileView from "./components/UserProfileView";
import MessagingCenter from "./components/MessagingCenter";
import { MongoDBService } from "./services/mongoDBService";
import { FileService } from "./services/fileService";
import { MessagingService } from "./services/messagingService";

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ fullName: string; username: string; id: string; email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [pendingUserEmail, setPendingUserEmail] = useState('');
  const [navigationRequest, setNavigationRequest] = useState<{
    page: 'client-form' | 'activity-log' | 'log-notes';
    params?: any;
  } | null>(null);
  const [showUserDirectory, setShowUserDirectory] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showMessaging, setShowMessaging] = useState(false);
  const [messagingTargetUser, setMessagingTargetUser] = useState<{ id: string; name: string } | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info' });
  
  // Toast notification state
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string }>>([]);

  // Check if current user is admin
  const isAdmin = () => {
    if (!currentUser) return false;
    const usersData = localStorage.getItem('crm_users');
    if (!usersData) return false;
    try {
      const users = JSON.parse(usersData);
      const user = users.find((u: any) => u.id === currentUser.id);
      return user && user.role === 'admin';
    } catch {
      return false;
    }
  };

  // Handle toast notifications
  useEffect(() => {
    const handleShowToast = (event: Event) => {
      const customEvent = event as CustomEvent<{ type: 'success' | 'error' | 'warning' | 'info'; message: string }>;
      const { type, message } = customEvent.detail;
      const id = Date.now().toString();
      setToasts(prev => [...prev, { id, type, message }]);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 5000);
    };

    window.addEventListener('showToast', handleShowToast as EventListener);
    return () => window.removeEventListener('showToast', handleShowToast as EventListener);
  }, []);

  // Handle navigation from notifications
  const handleNavigate = (page: 'client-form' | 'activity-log' | 'log-notes', params?: any) => {
    setNavigationRequest({ page, params });
  };

  // Load unread message count (admin only)
  useEffect(() => {
    if (isLoggedIn && currentUser && isAdmin()) {
      const updateUnreadCount = async () => {
        const count = await MessagingService.getUnreadCount(currentUser.id);
        setUnreadMessageCount(count);
      };
      
      updateUnreadCount();
      const interval = setInterval(updateUnreadCount, 5000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, currentUser]);

  // Handle user actions
  const handleViewProfile = (user: any) => {
    setSelectedUser(user);
    setShowUserProfile(true);
  };

  const handleMessageUser = (user: any) => {
    setMessagingTargetUser({ id: user.id, name: user.fullName });
    setShowUserDirectory(false);
    setShowUserProfile(false);
    setShowMessaging(true);
  };

  // Fix user data on app load - add IDs if missing
  useEffect(() => {
    const migrateUserData = () => {
      const usersData = localStorage.getItem('crm_users');
      if (usersData) {
        try {
          const users = JSON.parse(usersData);
          let needsUpdate = false;
          
          const updatedUsers = users.map((user: any) => {
            if (!user.id) {
              needsUpdate = true;
              return {
                ...user,
                id: user.email || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                role: user.role || 'user'
              };
            }
            return user;
          });
          
          if (needsUpdate) {
            localStorage.setItem('crm_users', JSON.stringify(updatedUsers));
            console.log('✅ User data migrated - IDs added to existing users');
          }
        } catch (error) {
          console.error('Error migrating user data:', error);
        }
      }
    };
    
    migrateUserData();
  }, []);

  // Check MongoDB and R2 connection status (only works in production with Netlify functions)
  useEffect(() => {
    // Fix any R2 URLs that were stored with incorrect domain
    FileService.fixR2URLs();
    
    const checkConnections = async () => {
      // Check if running on Netlify by checking the hostname
      const isNetlify = window.location.hostname.includes('netlify.app') || 
                        window.location.hostname.includes('netlify.com');
      
      if (!isNetlify) {
        console.log('📦 Running in development mode - using localStorage');
        return;
      }

      console.log('🚀 Running on Netlify - Production Mode');
      console.log('─────────────────────────────────────');

      // Check MongoDB Atlas connection
      try {
        const response = await fetch('/.netlify/functions/database', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection: 'users', operation: 'find', filter: {} })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.log('❌ MongoDB Atlas: Function error');
          console.log(`   • Status: ${response.status}`);
          console.log(`   • Response: ${errorText.substring(0, 200)}`);
        } else {
          const result = await response.json();
          if (result.success) {
            console.log('✅ MongoDB Atlas: Connected');
          } else {
            console.log('❌ MongoDB Atlas: Connection issue -', result.error);
          }
        }
      } catch (error) {
        console.error('❌ MongoDB Atlas: Connection failed -', error);
      }

      // Check Cloudflare R2 configuration
      const r2AccountId = import.meta.env.VITE_R2_ACCOUNT_ID;
      const r2AccessKey = import.meta.env.VITE_R2_ACCESS_KEY_ID;
      const r2SecretKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
      const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL;
      const r2Bucket = import.meta.env.VITE_R2_BUCKET_NAME;

      if (r2AccountId && r2AccessKey && r2SecretKey && r2PublicUrl && r2Bucket) {
        console.log('✅ Cloudflare R2: Configured');
        console.log(`   • Bucket: ${r2Bucket}`);
        console.log(`   • Public URL: ${r2PublicUrl}`);
      } else {
        console.log('❌ Cloudflare R2: Not configured or missing credentials');
        if (!r2AccountId) console.log('   • Missing: VITE_R2_ACCOUNT_ID');
        if (!r2AccessKey) console.log('   • Missing: VITE_R2_ACCESS_KEY_ID');
        if (!r2SecretKey) console.log('   • Missing: VITE_R2_SECRET_ACCESS_KEY');
        if (!r2PublicUrl) console.log('   • Missing: VITE_R2_PUBLIC_URL');
        if (!r2Bucket) console.log('   • Missing: VITE_R2_BUCKET_NAME');
      }
      
      console.log('─────────────────────────────────────');
    };
    checkConnections();
  }, []);

  // Initialize default admin account
  useEffect(() => {
    const initializeAdminAccount = () => {
      const usersData = localStorage.getItem('crm_users');
      let users = [];
      
      if (usersData) {
        try {
          users = JSON.parse(usersData);
        } catch (error) {
          console.error('Error parsing users:', error);
        }
      }

      // Check if admin account already exists
      const adminExists = users.some((u: any) => u.email === 'admin@discovergrp.com');
      
      if (!adminExists) {
        // Create default admin account
        const adminAccount = {
          fullName: 'System Administrator',
          username: 'admin',
          email: 'admin@discovergrp.com',
          password: 'Admin@DG2026!', // Secured password
          department: 'IT Department',
          position: 'System Administrator',
          profileImage: '',
          registeredAt: new Date().toISOString(),
          isVerified: true,
          verificationToken: null,
          verificationTokenExpiry: null,
          verifiedAt: new Date().toISOString(),
          role: 'admin'
        };

        users.push(adminAccount);
        localStorage.setItem('crm_users', JSON.stringify(users));
        
        // Save admin account to MongoDB
        MongoDBService.saveUser(adminAccount).then(result => {
          if (result.success) {
            console.log('✅ Admin account synced to MongoDB');
          }
        }).catch(err => {
          console.error('Failed to sync admin to MongoDB:', err);
        });
      }
    };

    initializeAdminAccount();
  }, []);

  // Sync all localStorage users to MongoDB
  useEffect(() => {
    const syncUsersToMongoDB = async () => {
      const usersData = localStorage.getItem('crm_users');
      if (!usersData) return;

      try {
        const users = JSON.parse(usersData);
        console.log(`🔄 Syncing ${users.length} users to MongoDB...`);

        let successCount = 0;
        let failCount = 0;

        for (const user of users) {
          try {
            // Check if user already exists in MongoDB
            const existingUser = await MongoDBService.findUser(user.email);
            
            if (!existingUser) {
              // User doesn't exist, insert it
              const result = await MongoDBService.saveUser(user);
              if (result.success) {
                successCount++;
                console.log(`✅ Synced user: ${user.fullName} (${user.email})`);
              } else {
                failCount++;
                console.warn(`⚠️ Failed to sync user: ${user.email}`);
              }
            } else {
              // User exists, update if needed
              const result = await MongoDBService.updateUser(user.email, user);
              if (result.success) {
                successCount++;
                console.log(`✅ Updated user: ${user.fullName} (${user.email})`);
              }
            }
          } catch (error) {
            failCount++;
            console.error(`❌ Error syncing user ${user.email}:`, error);
          }
        }

        console.log(`✅ MongoDB sync complete: ${successCount} successful, ${failCount} failed`);
      } catch (error) {
        console.error('Error syncing users to MongoDB:', error);
      }
    };

    // Only run sync once on mount, after a short delay to let other initialization complete
    const timer = setTimeout(() => {
      syncUsersToMongoDB();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Sync clients from MongoDB on app load
  useEffect(() => {
    const syncClientsFromMongoDB = async () => {
      try {
        console.log('🔄 Loading clients from MongoDB on app startup...');
        // Import ClientService dynamically to avoid circular dependency
        const { ClientService } = await import('./services/clientService');
        await ClientService.syncFromMongoDB();
      } catch (error) {
        console.error('Error syncing clients from MongoDB:', error);
      }
    };

    // Run sync after user sync completes
    const timer = setTimeout(() => {
      syncClientsFromMongoDB();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Check for existing authentication on app load
  useEffect(() => {
    const savedAuth = localStorage.getItem('crm_auth');
    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth);
        const now = Date.now();
        const sessionDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        // Check if session is still valid (within 24 hours)
        if (authData.isLoggedIn && authData.currentUser && authData.timestamp && (now - authData.timestamp < sessionDuration)) {
          setIsLoggedIn(true);
          setCurrentUser(authData.currentUser);
        } else {
          // Session expired, clear stored data
          localStorage.removeItem('crm_auth');
        }
      } catch (error) {
        console.error('Error parsing saved auth data:', error);
        localStorage.removeItem('crm_auth');
      }
    }
    setIsLoading(false);
  }, []);

  // Save authentication state to localStorage
  const saveAuthState = (loggedIn: boolean, user: { fullName: string; username: string; id: string; email: string } | null) => {
    const authData = {
      isLoggedIn: loggedIn,
      currentUser: user,
      timestamp: Date.now()
    };
    localStorage.setItem('crm_auth', JSON.stringify(authData));
  };

  // Logout function
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem('crm_auth');
  };

  // Handle user login with validation
  const handleLogin = (username: string, password: string) => {
    // Validate input fields
    if (!username.trim() || !password.trim()) {
      setModalConfig({
        isOpen: true,
        title: 'Missing Information',
        message: 'Please enter both username and password',
        type: 'warning'
      });
      return;
    }

    // Get registered users from localStorage
    const registeredUsers = localStorage.getItem('crm_users');
    
    if (!registeredUsers) {
      setModalConfig({
        isOpen: true,
        title: 'No Users Found',
        message: 'No registered users found. Please sign up first.',
        type: 'info'
      });
      return;
    }

    try {
      const users = JSON.parse(registeredUsers);
      
      // Find user by email (username field contains email from login form)
      const user = users.find((u: any) => 
        (u.email === username || u.username === username) && u.password === password
      );

      if (user) {
        // Check if email is verified
        if (user.isVerified === false) {
          setModalConfig({
            isOpen: true,
            title: 'Email Not Verified',
            message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
            type: 'warning'
          });
          return;
        }

        // Show success modal then login
        setModalConfig({
          isOpen: true,
          title: 'Login Successful!',
          message: `Welcome back, ${user.fullName || user.username}!`,
          type: 'success',
          onConfirm: () => {
            const userData = { 
              fullName: user.fullName || user.username, 
              username: user.username,
              id: user.id || user.email,
              email: user.email
            };
            setCurrentUser(userData);
            setIsLoggedIn(true);
            saveAuthState(true, userData);
          }
        });
      } else {
        setModalConfig({
          isOpen: true,
          title: 'Login Failed',
          message: 'Invalid email/username or password. Please try again or sign up.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
      setModalConfig({
        isOpen: true,
        title: 'Error',
        message: 'An error occurred. Please try again.',
        type: 'error'
      });
    }
  };

  const handleRegister = async (form: { username: string; email: string; password: string; fullName: string; department: string; position: string; profileImage?: string }) => {
    // Validate all required fields
    if (!form.fullName.trim() || !form.username.trim() || !form.email.trim() || !form.password.trim() || !form.department.trim() || !form.position.trim()) {
      setModalConfig({
        isOpen: true,
        title: 'Missing Information',
        message: 'Please fill in all fields',
        type: 'warning'
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setModalConfig({
        isOpen: true,
        title: 'Invalid Email',
        message: 'Please enter a valid email address',
        type: 'error'
      });
      return;
    }

    // Get existing users from localStorage
    const existingUsers = localStorage.getItem('crm_users');
    let users = [];
    
    if (existingUsers) {
      try {
        users = JSON.parse(existingUsers);
        console.log('📋 Existing users in localStorage:', users.length);
        console.log('Existing emails:', users.map((u: any) => u.email));
      } catch (error) {
        console.error('Error parsing existing users:', error);
      }
    }

    // Check if email or username already exists
    const emailExists = users.some((u: any) => u.email === form.email);
    const usernameExists = users.some((u: any) => u.username === form.username);

    console.log(`Checking registration for: ${form.email}`);
    console.log(`Email exists: ${emailExists}, Username exists: ${usernameExists}`);

    if (emailExists) {
      console.warn(`⚠️ Email ${form.email} is already registered`);
      setModalConfig({
        isOpen: true,
        title: 'Email Already Registered',
        message: 'This email is already registered. Please login or use a different email.',
        type: 'warning'
      });
      return;
    }

    if (usernameExists) {
      setModalConfig({
        isOpen: true,
        title: 'Username Taken',
        message: 'This username is already taken. Please choose a different username.',
        type: 'warning'
      });
      return;
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Add new user (unverified)
    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
      fullName: form.fullName,
      username: form.username,
      email: form.email,
      password: form.password, // In production, this should be hashed!
      department: form.department,
      position: form.position,
      profileImage: form.profileImage || '',
      registeredAt: new Date().toISOString(),
      isVerified: false,
      verificationCode: verificationCode,
      verificationCodeExpiry: Date.now() + (10 * 60 * 1000), // 10 minutes
      role: 'user' // Default role
    };

    users.push(newUser);
    localStorage.setItem('crm_users', JSON.stringify(users));
    console.log('✅ New user added to localStorage:', newUser.email);
    console.log('Total users now:', users.length);

    // Save to MongoDB Atlas
    try {
      const mongoResult = await MongoDBService.saveUser(newUser);
      if (mongoResult.success) {
        console.log('✅ User saved to MongoDB Atlas');
      } else {
        console.warn('⚠️ Failed to save user to MongoDB:', mongoResult.message);
      }
    } catch (err) {
      console.error('❌ MongoDB sync failed:', err);
      // Continue even if MongoDB sync fails - localStorage is the primary storage
    }

    // Send verification email
    try {
      const response = await fetch('/.netlify/functions/send-verification-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: form.email,
          fullName: form.fullName,
          verificationCode: verificationCode
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPendingUserEmail(form.email);
        setShowOTPVerification(true);
      } else {
        setModalConfig({
          isOpen: true,
          title: 'Registration Complete',
          message: 'Registration successful, but failed to send verification code. Please contact support.',
          type: 'warning'
        });
      }
    } catch (error) {
      console.error('Error sending verification email:', error);
      setModalConfig({
        isOpen: true,
        title: 'Registration Complete',
        message: 'Registration successful, but failed to send verification code. Please contact support.',
        type: 'warning'
      });
    }
  };

  const handleOTPVerify = async (code: string) => {
    const usersData = localStorage.getItem('crm_users');
    if (!usersData) return;

    try {
      const users = JSON.parse(usersData);
      const userIndex = users.findIndex((u: any) => u.email === pendingUserEmail);

      if (userIndex === -1) {
        setModalConfig({
          isOpen: true,
          title: 'Error',
          message: 'User not found',
          type: 'error'
        });
        return;
      }

      const user = users[userIndex];

      // Check if code is expired
      if (Date.now() > user.verificationCodeExpiry) {
        setModalConfig({
          isOpen: true,
          title: 'Code Expired',
          message: 'Verification code has expired. Please request a new one.',
          type: 'error'
        });
        setShowOTPVerification(false);
        return;
      }

      // Verify code
      if (user.verificationCode === code) {
        const updates = {
          isVerified: true,
          verificationCode: null,
          verificationCodeExpiry: null,
          verifiedAt: new Date().toISOString()
        };
        
        users[userIndex] = {
          ...user,
          ...updates
        };
        localStorage.setItem('crm_users', JSON.stringify(users));
        
        // Update user verification status in MongoDB
        try {
          const result = await MongoDBService.updateUser(user.email, updates);
          if (result.success) {
            console.log('✅ User verification synced to MongoDB');
          } else {
            console.warn('⚠️ Failed to sync verification to MongoDB:', result.message);
          }
        } catch (err) {
          console.error('❌ MongoDB sync failed:', err);
        }
        
        setShowOTPVerification(false);
        setModalConfig({
          isOpen: true,
          title: 'Email Verified!',
          message: 'Your email has been verified successfully. You can now login to your account.',
          type: 'success'
        });
      } else {
        setModalConfig({
          isOpen: true,
          title: 'Invalid Code',
          message: 'The verification code you entered is incorrect. Please try again.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setModalConfig({
        isOpen: true,
        title: 'Error',
        message: 'An error occurred during verification',
        type: 'error'
      });
    }
  };

  const handleOTPResend = async () => {
    const usersData = localStorage.getItem('crm_users');
    if (!usersData) return;

    try {
      const users = JSON.parse(usersData);
      const userIndex = users.findIndex((u: any) => u.email === pendingUserEmail);

      if (userIndex === -1) return;

      // Generate new code
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      users[userIndex].verificationCode = newCode;
      users[userIndex].verificationCodeExpiry = Date.now() + (10 * 60 * 1000);
      localStorage.setItem('crm_users', JSON.stringify(users));

      // Resend email
      const response = await fetch('/.netlify/functions/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingUserEmail,
          fullName: users[userIndex].fullName,
          verificationCode: newCode
        })
      });

      if (response.ok) {
        setModalConfig({
          isOpen: true,
          title: 'Code Resent',
          message: 'A new verification code has been sent to your email.',
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Error resending code:', error);
      setModalConfig({
        isOpen: true,
        title: 'Error',
        message: 'Failed to resend verification code',
        type: 'error'
      });
    }
  };

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      }}>
        <div style={{
          color: "white",
          fontSize: "18px",
          fontWeight: "500"
        }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {showOTPVerification && (
        <OTPVerification
          email={pendingUserEmail}
          onVerify={handleOTPVerify}
          onResend={handleOTPResend}
          onCancel={() => setShowOTPVerification(false)}
        />
      )}
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
      />
      <Navbar 
        isLoggedIn={isLoggedIn}
        currentUser={currentUser}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        onOpenUserDirectory={() => setShowUserDirectory(true)}
        onOpenMessaging={isAdmin() ? () => {
          setMessagingTargetUser(null);
          setShowMessaging(true);
        } : undefined}
        unreadMessageCount={unreadMessageCount}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      <div style={{ flex: 1 }}>
        {isLoggedIn ? (
          <>
            {/* Sidebar Overlay for mobile */}
            <div 
              className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
            />
            <MainPage 
              currentUser={currentUser || { fullName: '', username: '', id: '', email: '' }}
              onUpdateUser={(updatedUser) => {
                setCurrentUser(updatedUser);
                saveAuthState(true, updatedUser);
              }}
              navigationRequest={navigationRequest}
              onNavigationHandled={() => setNavigationRequest(null)}
              isSidebarOpen={isSidebarOpen}
              onCloseSidebar={() => setIsSidebarOpen(false)}
            />
          </>
        ) : (
          <AuthContainer onLogin={handleLogin} onRegister={handleRegister} />
        )}
      </div>
      <Footer />
      
      {/* User Directory Modal */}
      {showUserDirectory && currentUser && (
        <UserDirectory
          currentUser={currentUser}
          onViewProfile={handleViewProfile}
          onMessageUser={handleMessageUser}
          onClose={() => setShowUserDirectory(false)}
        />
      )}
      
      {/* User Profile View Modal */}
      {showUserProfile && selectedUser && currentUser && (
        <UserProfileView
          user={selectedUser}
          currentUser={currentUser}
          onClose={() => {
            setShowUserProfile(false);
            setSelectedUser(null);
          }}
          onMessage={handleMessageUser}
        />
      )}
      
      {/* Messaging Center Modal (Admin Only) */}
      {showMessaging && currentUser && isAdmin() && (
        <MessagingCenter
          currentUser={currentUser}
          selectedUserId={messagingTargetUser?.id}
          selectedUserName={messagingTargetUser?.name}
          onClose={() => {
            setShowMessaging(false);
            setMessagingTargetUser(null);
          }}
        />
      )}
      
      {/* Toast Notifications */}
      <div style={{ position: 'fixed', top: '80px', right: '20px', zIndex: 10000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              backgroundColor: toast.type === 'error' ? '#dc3545' : toast.type === 'warning' ? '#ffc107' : toast.type === 'success' ? '#28a745' : '#17a2b8',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              minWidth: '300px',
              maxWidth: '500px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            <span style={{ fontSize: '18px' }}>
              {toast.type === 'error' ? '❌' : toast.type === 'warning' ? '⚠️' : toast.type === 'success' ? '✅' : 'ℹ️'}
            </span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '0 4px'
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;