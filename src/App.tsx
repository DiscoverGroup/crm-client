import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuthContainer from "./components/AuthContainer";
import MainPage from "./components/MainPage";
import Modal from "./components/Modal";
import OTPVerification from "./components/OTPVerification";
import { MongoDBService } from "./services/mongoDBService";
import { FileService } from "./services/fileService";

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ fullName: string; username: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [pendingUserEmail, setPendingUserEmail] = useState('');
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

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
      }
    };

    initializeAdminAccount();
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
  const saveAuthState = (loggedIn: boolean, user: { fullName: string; username: string } | null) => {
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
            setCurrentUser({ fullName: user.fullName || user.username, username: user.username });
            setIsLoggedIn(true);
            saveAuthState(true, { fullName: user.fullName || user.username, username: user.username });
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
      } catch (error) {
        console.error('Error parsing existing users:', error);
      }
    }

    // Check if email or username already exists
    const emailExists = users.some((u: any) => u.email === form.email);
    const usernameExists = users.some((u: any) => u.username === form.username);

    if (emailExists) {
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
      verificationCodeExpiry: Date.now() + (10 * 60 * 1000) // 10 minutes
    };

    users.push(newUser);
    localStorage.setItem('crm_users', JSON.stringify(users));

    // Save to MongoDB Atlas
    MongoDBService.saveUser(newUser).catch(err => {
      console.error('MongoDB sync failed:', err);
      // Continue even if MongoDB sync fails - localStorage is the primary storage for now
    });

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

  const handleOTPVerify = (code: string) => {
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
        users[userIndex] = {
          ...user,
          isVerified: true,
          verificationCode: null,
          verificationCodeExpiry: null,
          verifiedAt: new Date().toISOString()
        };
        localStorage.setItem('crm_users', JSON.stringify(users));
        
        // Update user verification status in MongoDB
        MongoDBService.updateUser(user.email, {
          isVerified: true,
          verificationCode: null,
          verificationCodeExpiry: null,
          verifiedAt: new Date().toISOString()
        }).catch(err => {
          console.error('MongoDB sync failed:', err);
        });
        
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
      />
      <div style={{ flex: 1 }}>
        {isLoggedIn ? (
          <MainPage 
            currentUser={currentUser || { fullName: '', username: '' }}
            onUpdateUser={(updatedUser) => {
              setCurrentUser(updatedUser);
              saveAuthState(true, updatedUser);
            }}
          />
        ) : (
          <AuthContainer onLogin={handleLogin} onRegister={handleRegister} />
        )}
      </div>
      <Footer />
    </div>
  );
};

export default App;