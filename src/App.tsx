import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
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
import { ActivityLogService } from "./services/activityLogService";
import { NotificationService } from "./services/notificationService";
import calendarService from "./services/calendarService";
import { setAuthToken, clearAuthToken, authHeaders } from "./utils/authToken";
import { realtimeSync } from './services/realtimeSyncService';

const App: React.FC = () => {
  const { loginWithPopup, getAccessTokenSilently } = useAuth0();

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
  // Auth0 profile completion — shown when a new Auth0 user hasn't set department/position
  const [pendingAuth0Profile, setPendingAuth0Profile] = useState<{
    userId: string;
    token: string;
    userData: { fullName: string; username: string; id: string; email: string };
    allUserData: any;
  } | null>(null);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info' });
  
  // Toast notification state
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string }>>([]);
  
  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'warning' | 'error' | 'info';
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'warning' });

  // Check if current user is admin
  const isAdmin = React.useCallback(() => {
    if (!currentUser) return false;
    const usersData = localStorage.getItem('crm_users');
    if (!usersData) return false;
    try {
      const users = JSON.parse(usersData);
      const user = users.find((u: any) => u.id === currentUser.id || u.email === currentUser.email);
      return user && user.role === 'admin';
    } catch {
      return false;
    }
  }, [currentUser]);

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

  // Handle confirm modal
  useEffect(() => {
    const handleShowConfirmModal = (event: Event) => {
      const customEvent = event as CustomEvent<{
        title: string;
        message: string;
        type: 'warning' | 'error' | 'info';
        onConfirm: () => void;
        onCancel: () => void;
      }>;
      const { title, message, type, onConfirm, onCancel } = customEvent.detail;
      setConfirmModal({ isOpen: true, title, message, type, onConfirm, onCancel });
    };

    window.addEventListener('showConfirmModal', handleShowConfirmModal as EventListener);
    return () => window.removeEventListener('showConfirmModal', handleShowConfirmModal as EventListener);
  }, []);

  // Handle navigation from notifications
  const handleNavigate = (page: 'client-form' | 'activity-log' | 'log-notes', params?: any) => {
    setNavigationRequest({ page, params });
  };

  // Load unread message count
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      const updateUnreadCount = async () => {
        const count = await MessagingService.getUnreadCount(currentUser.id);
        setUnreadMessageCount(count);
      };
      
      updateUnreadCount();
      const interval = setInterval(updateUnreadCount, 5000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, currentUser, isAdmin]);

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
                id: user.email || `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
                role: user.role || 'user'
              };
            }
            return user;
          });
          
          if (needsUpdate) {
            localStorage.setItem('crm_users', JSON.stringify(updatedUsers));
            // console.log('✅ User data migrated - IDs added to existing users');
          }
        } catch (error) {
          // console.error('Error migrating user data:', error);
        }
      }
    };
    
    migrateUserData();
  }, []);

  // Check MongoDB and R2 connection status (only works in production with Netlify functions)
  useEffect(() => {
    // Fix any R2 URLs that were stored with incorrect domain
    FileService.fixR2URLs();
    // Migrate legacy file attachments that don't have fileType
    FileService.migrateFileTypes();
    
    const checkConnections = async () => {
      // Check if running on Netlify by checking the hostname
      const isNetlify = window.location.hostname.includes('netlify.app') || 
                        window.location.hostname.includes('netlify.com');
      
      if (!isNetlify) {
        // console.log('📦 Running in development mode - using localStorage');
        return;
      }

      // console.log('🚀 Running on Netlify - Production Mode');
      // console.log('─────────────────────────────────────');

      // Check MongoDB Atlas connection
      try {
        const response = await fetch('/.netlify/functions/database', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection: 'users', operation: 'find', filter: {} })
        });
        
        if (!response.ok) {
          await response.text();
          // console.log('❌ MongoDB Atlas: Function error');
          // console.log(`   • Status: ${response.status}`);
          // console.log(`   • Response: ${errorText.substring(0, 200)}`);
        } else {
          const result = await response.json();
          if (result.success) {
            // console.log('✅ MongoDB Atlas: Connected');
          } else {
            // console.log('❌ MongoDB Atlas: Connection issue -', result.error);
          }
        }
      } catch (error) {
        // console.error('❌ MongoDB Atlas: Connection failed -', error);
      }

      // Check Cloudflare R2 configuration
      const r2AccountId = import.meta.env.VITE_R2_ACCOUNT_ID;
      const r2AccessKey = import.meta.env.VITE_R2_ACCESS_KEY_ID;
      const r2SecretKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
      const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL;
      const r2Bucket = import.meta.env.VITE_R2_BUCKET_NAME;

      if (r2AccountId && r2AccessKey && r2SecretKey && r2PublicUrl && r2Bucket) {
        // console.log('✅ Cloudflare R2: Configured');
        // console.log(`   • Bucket: ${r2Bucket}`);
        // console.log(`   • Public URL: ${r2PublicUrl}`);
      } else {
        // console.log('❌ Cloudflare R2: Not configured or missing credentials');
        // if (!r2AccountId) console.log('   • Missing: VITE_R2_ACCOUNT_ID');
        // if (!r2AccessKey) console.log('   • Missing: VITE_R2_ACCESS_KEY_ID');
        // if (!r2SecretKey) console.log('   • Missing: VITE_R2_SECRET_ACCESS_KEY');
        // if (!r2PublicUrl) console.log('   • Missing: VITE_R2_PUBLIC_URL');
        // if (!r2Bucket) console.log('   • Missing: VITE_R2_BUCKET_NAME');
      }
      
      // console.log('─────────────────────────────────────');
    };
    checkConnections();
  }, []);

  // Sync all localStorage users to MongoDB
  useEffect(() => {
    const syncUsersToMongoDB = async () => {
      const usersData = localStorage.getItem('crm_users');
      if (!usersData) return;

      try {
        const users = JSON.parse(usersData);
        // console.log(`🔄 Syncing ${users.length} users to MongoDB...`);

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
                // console.log(`✅ Synced user: ${user.fullName} (${user.email})`);
              } else {
                failCount++;
                // console.warn(`⚠️ Failed to sync user: ${user.email}`);
              }
            }
          } catch (error) {
            failCount++;
            // console.error(`❌ Error syncing user ${user.email}:`, error);
          }
        }

        // console.log(`✅ MongoDB sync complete: ${successCount} successful, ${failCount} failed`);
      } catch (error) {
        // console.error('Error syncing users to MongoDB:', error);
      }
    };

    // Only run sync once on mount, after a short delay to let other initialization complete
    const timer = setTimeout(() => {
      syncUsersToMongoDB();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Sync all data from MongoDB — runs when user becomes authenticated and every 60s
  useEffect(() => {
    if (!isLoggedIn) return;

    const syncAllFromMongoDB = async () => {
      try {
        const { ClientService } = await import('./services/clientService');
        await ClientService.syncFromMongoDB();
        
        // Sync activity logs, file attachments, calendar events, and notifications
        await Promise.allSettled([
          ActivityLogService.syncFromMongoDB(),
          FileService.syncFromMongoDB(),
          calendarService.syncFromMongoDB(),
          NotificationService.syncFromMongoDB()
        ]);
      } catch (error) {
        // console.error('Error syncing from MongoDB:', error);
      }
    };

    // Initial sync shortly after login is confirmed
    const timer = setTimeout(() => {
      syncAllFromMongoDB();
    }, 1500);

    // Start real-time sync polling (5-second lightweight check)
    realtimeSync.start();

    // Periodic full sync every 120 seconds as fallback
    const interval = setInterval(() => {
      syncAllFromMongoDB();
    }, 120000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      realtimeSync.stop();
    };
  }, [isLoggedIn]);

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
        // console.error('Error parsing saved auth data:', error);
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
    sessionStorage.removeItem('crm_current_view');
    clearAuthToken(); // Invalidate the JWT on the client side
  };

  // Handle user login with validation
  const handleLogin = async (username: string, password: string) => {
    
    // Validate input fields
    if (!username.trim() || !password.trim()) {
      setModalConfig({
        isOpen: true,
        title: 'Missing Information',
        message: 'Please enter both email/username and password',
        type: 'warning'
      });
      return;
    }

    try {
      // Call MongoDB login API
      const response = await fetch('/.netlify/functions/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: username.trim(),
          password: password.trim()
        })
      });

      const result = await response.json();

      if (result.success && result.user) {
        // Store the JWT returned by the login endpoint
        if (result.token) {
          setAuthToken(result.token);
        }

        // Sync user to localStorage for offline access (NO password stored)
        const usersData = localStorage.getItem('crm_users');
        let users = [];
        if (usersData) {
          try {
            users = JSON.parse(usersData);
          } catch (e) {
            users = [];
          }
        }

        // Update or add user to localStorage (password intentionally omitted)
        const userIndex = users.findIndex((u: any) => u.email === result.user.email);
        const localUser = {
          ...result.user,
          id: result.user.id || result.user.email
          // password is NOT stored in localStorage
        };

        if (userIndex >= 0) {
          users[userIndex] = localUser;
        } else {
          users.push(localUser);
        }
        localStorage.setItem('crm_users', JSON.stringify(users));

        // Show success modal then login
        const userData = { 
          fullName: result.user.fullName || result.user.username, 
          username: result.user.username,
          id: result.user.id || result.user.email,
          email: result.user.email
        };
        setCurrentUser(userData);
        setIsLoggedIn(true);
        saveAuthState(true, userData);
        
        setModalConfig({
          isOpen: true,
          title: 'Login Successful!',
          message: `Welcome back, ${result.user.fullName || result.user.username}!`,
          type: 'success'
        });
      } else if (result.needsVerification) {
        setModalConfig({
          isOpen: true,
          title: 'Email Not Verified',
          message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
          type: 'warning'
        });
      } else {
        setModalConfig({
          isOpen: true,
          title: 'Login Failed',
          message: result.error || 'Invalid email/username or password. Please try again or sign up.',
          type: 'error'
        });
      }
    } catch (error) {
      // Server unreachable — do not fall back to localStorage (passwords are bcrypt-hashed
      // server-side and are never stored locally, so a local comparison is not possible).
      setModalConfig({
        isOpen: true,
        title: 'Connection Error',
        message: 'Cannot connect to the server. Please check your internet connection and try again.',
        type: 'error'
      });
    }
  };

  // ── Auth0 (login OR signup) ────────────────────────────────────────────────
  const handleAuth0 = async (mode: 'login' | 'signup' = 'signup') => {
    try {
      // Open Auth0 Universal Login
      await loginWithPopup({
        authorizationParams: {
          ...(mode === 'signup' ? { screen_hint: 'signup' } : {}),
          scope: 'openid profile email',
        },
      });

      // Get access token to call our sync function
      const accessToken = await getAccessTokenSilently({
        authorizationParams: { scope: 'openid profile email' },
      });

      const response = await fetch('/.netlify/functions/auth0-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });

      const result = await response.json();

      if (result.success && result.user) {
        if (result.token) setAuthToken(result.token);

        const userData = {
          fullName: result.user.fullName || result.user.username,
          username: result.user.username,
          id: result.user.id,
          email: result.user.email,
        };

        // If the user has no department/position yet → show the profile-completion modal
        if (!result.user.department || !result.user.position) {
          setPendingAuth0Profile({
            userId: result.user.id,
            token: result.token,
            userData,
            allUserData: result.user,
          });
          return; // don't log-in yet
        }

        // Existing user with complete profile — log straight in
        setCurrentUser(userData);
        setIsLoggedIn(true);
        saveAuthState(true, userData);
        syncUserToLocalStorage(result.user);
      } else {
        setModalConfig({
          isOpen: true,
          title: 'Auth0 Sync Failed',
          message: result.error || 'Could not complete authentication. Please try again.',
          type: 'error',
        });
      }
    } catch (err: any) {
      if (err?.error === 'popup_closed_by_user') return;
      setModalConfig({
        isOpen: true,
        title: 'Auth0 Error',
        message: err?.message || 'Authentication failed. Please try again.',
        type: 'error',
      });
    }
  };

  const handleAuth0Register = () => handleAuth0('signup');
  const handleAuth0Login = () => handleAuth0('login');

  // Helper: sync user object to crm_users in localStorage
  const syncUserToLocalStorage = (user: any) => {
    const usersData = localStorage.getItem('crm_users');
    let users: any[] = [];
    try { users = usersData ? JSON.parse(usersData) : []; } catch { users = []; }
    const idx = users.findIndex((u: any) => u.email === user.email);
    if (idx === -1) users.push({ ...user, registeredAt: new Date().toISOString() });
    else users[idx] = { ...users[idx], ...user };
    localStorage.setItem('crm_users', JSON.stringify(users));
  };

  // Called when the new Auth0 user finishes selecting department + position
  const handleCompleteAuth0Profile = async (department: string, position: string) => {
    if (!pendingAuth0Profile) return;
    try {
      const response = await fetch('/.netlify/functions/update-profile', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: pendingAuth0Profile.userId,
          department,
          position,
          fullName: pendingAuth0Profile.userData.fullName,
          username: pendingAuth0Profile.userData.username,
          email: pendingAuth0Profile.userData.email,
        }),
      });

      if (!response.ok) throw new Error('Failed to save profile');

      const updatedUser = {
        ...pendingAuth0Profile.allUserData,
        department,
        position,
      };

      setCurrentUser(pendingAuth0Profile.userData);
      setIsLoggedIn(true);
      saveAuthState(true, pendingAuth0Profile.userData);
      syncUserToLocalStorage(updatedUser);
      setPendingAuth0Profile(null);
    } catch {
      setModalConfig({
        isOpen: true,
        title: 'Profile Update Failed',
        message: 'Could not save department and position. Please try again.',
        type: 'error',
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

    try {
      // Call MongoDB register API
      const response = await fetch('/.netlify/functions/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password.trim(),
          fullName: form.fullName.trim(),
          department: form.department.trim(),
          position: form.position.trim(),
          profileImage: form.profileImage || ''
        })
      });

      const result = await response.json();

      if (result.success && result.user) {
        // Sync user to localStorage
        const usersData = localStorage.getItem('crm_users');
        let users = [];
        if (usersData) {
          try {
            users = JSON.parse(usersData);
          } catch (e) {
            users = [];
          }
        }

        // Sync minimal user info to localStorage (NO password, NO plaintext OTP)
        const newUser = {
          ...result.user,
          id: result.user.id || result.user.email,
          registeredAt: new Date().toISOString(),
          role: 'user'
        };

        users.push(newUser);
        localStorage.setItem('crm_users', JSON.stringify(users));

        // Send verification email — server generates the OTP
        try {
          const emailResponse = await fetch('/.netlify/functions/send-verification-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: form.email,
              fullName: form.fullName
              // Do NOT send verificationCode — server generates it
            })
          });

          const emailData = await emailResponse.json();

          if (emailResponse.ok && emailData.success) {
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
          setModalConfig({
            isOpen: true,
            title: 'Registration Complete',
            message: 'Registration successful, but failed to send verification code. Please contact support.',
            type: 'warning'
          });
        }
      } else {
        setModalConfig({
          isOpen: true,
          title: result.error === 'Email already registered' ? 'Email Already Registered' : 'Registration Failed',
          message: result.error || 'Failed to register. Please try again.',
          type: 'error'
        });
      }
    } catch (error) {
      // Fallback to localStorage if API fails
      const existingUsers = localStorage.getItem('crm_users');
      let users = [];
      
      if (existingUsers) {
        try {
          users = JSON.parse(existingUsers);
        } catch (error) {
          users = [];
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

      // Add new user (unverified) — password and OTP are intentionally
      // omitted from localStorage; only non-sensitive display data is stored.
      const newUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        fullName: form.fullName,
        username: form.username,
        email: form.email,
        // password intentionally NOT stored in localStorage
        department: form.department,
        position: form.position,
        profileImage: form.profileImage || '',
        registeredAt: new Date().toISOString(),
        isVerified: false,
        // verificationCode intentionally NOT stored in localStorage
        role: 'user'
      };

      users.push(newUser);
      localStorage.setItem('crm_users', JSON.stringify(users));

      // Try to send verification email
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
            message: 'Registration successful (Offline mode). Please login.',
            type: 'success'
          });
        }
      } catch (error) {
        setModalConfig({
          isOpen: true,
          title: 'Registration Complete',
          message: 'Registration successful (Offline mode). Please login.',
          type: 'success'
        });
      }
    }
  };

  const handleOTPVerify = async (code: string) => {
    if (!pendingUserEmail) return;

    try {
      // Verify OTP server-side — never trust localStorage for security-critical checks
      const response = await fetch('/.netlify/functions/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingUserEmail, code }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update localStorage to reflect verified status (non-sensitive)
        const usersData = localStorage.getItem('crm_users');
        if (usersData) {
          try {
            const users = JSON.parse(usersData);
            const idx = users.findIndex((u: any) => u.email === pendingUserEmail);
            if (idx !== -1) {
              users[idx].isVerified = true;
              localStorage.setItem('crm_users', JSON.stringify(users));
            }
          } catch { /* ignore localStorage sync errors */ }
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
          title: result.error?.includes('expired') ? 'Code Expired' : 'Invalid Code',
          message: result.error || 'The verification code is incorrect or expired.',
          type: 'error'
        });
      }
    } catch {
      setModalConfig({
        isOpen: true,
        title: 'Error',
        message: 'An error occurred during verification. Please try again.',
        type: 'error'
      });
    }
  };

  const handleOTPResend = async () => {
    if (!pendingUserEmail) return;

    try {
      // Look up fullName from localStorage (non-sensitive display name)
      let fullName = pendingUserEmail;
      const usersData = localStorage.getItem('crm_users');
      if (usersData) {
        try {
          const users = JSON.parse(usersData);
          const user = users.find((u: any) => u.email === pendingUserEmail);
          if (user?.fullName) fullName = user.fullName;
        } catch { /* ignore */ }
      }

      // Server generates a new OTP — no code generated on client
      const response = await fetch('/.netlify/functions/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingUserEmail, fullName })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setModalConfig({
          isOpen: true,
          title: 'Code Resent',
          message: 'A new verification code has been sent to your email.',
          type: 'success'
        });
      } else {
        setModalConfig({
          isOpen: true,
          title: 'Error',
          message: result.error || 'Failed to resend verification code',
          type: 'error'
        });
      }
    } catch {
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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
          <AuthContainer onLogin={handleLogin} onRegister={handleRegister} onAuth0Register={handleAuth0Register} onAuth0Login={handleAuth0Login} />
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
      
      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => {
          if (confirmModal.onCancel) confirmModal.onCancel();
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={() => {
          if (confirmModal.onConfirm) confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        confirmText="OK"
        cancelText="Cancel"
      />
      
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

      {/* Auth0 Complete Profile Modal */}
      {pendingAuth0Profile && (
        <CompleteProfileModal
          userName={pendingAuth0Profile.userData.fullName}
          onComplete={handleCompleteAuth0Profile}
          onCancel={() => setPendingAuth0Profile(null)}
        />
      )}
    </div>
  );
};

// ── Complete Profile Modal (Auth0 new users) ────────────────────────────────
const DEPARTMENT_POSITIONS: Record<string, string[]> = {
  "Executives Department": ["Operations Manager","Division Manager","Executive Secretary","Executive Assistant"],
  "Visa Department": ["Visa Department Head","Team Lead - Visa Officer","Visa Officer","General Admin — Visa","VFS and Airport Assistance Officer","Visa Assistant Facilitator"],
  "Booking Department": ["Booking Supervisor","Booking Officer","General Admin for Booking"],
  "Marketing Department": ["Marketing Officer","Graphic Artist"],
  "Sales Department": ["Travel Sales Agent","General Admin — Sales"],
  "Customer Service Department": ["Customer Service Refund","Account Relations Manager (ARM)","Team Lead - ARM","General Admin - ARM"],
  "Human Resource Department": ["HR Assistant — Recruitment","HR Officer","General Admin - HR"],
  "Information & Technology Department": ["IT Manager","IT Systems Administrator","IT Support","Web Developer"],
  "Finance Department": ["Finance Officer"],
  "Research and Development Department": ["Research Development Officer"],
  "Intern": ["Intern — Visa","Intern — Booking","Intern — Marketing","Intern — Sales","Intern — Customer Service","Intern — HR","Intern — IT","Intern — Finance","Intern — General"],
};

const CompleteProfileModal: React.FC<{
  userName: string;
  onComplete: (department: string, position: string) => void;
  onCancel: () => void;
}> = ({ userName, onComplete, onCancel }) => {
  const [department, setDepartment] = React.useState('');
  const [position, setPosition] = React.useState('');
  const positions = department ? DEPARTMENT_POSITIONS[department] || [] : [];

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '440px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#0d47a1' }}>
          Complete Your Profile
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#6b7280' }}>
          Welcome, <strong>{userName}</strong>! Please select your department and position to continue.
        </p>

        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Department</label>
        <select
          value={department}
          onChange={e => { setDepartment(e.target.value); setPosition(''); }}
          style={{
            width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: '10px',
            fontSize: '14px', backgroundColor: '#f9fafb', marginBottom: '16px', outline: 'none',
            color: department ? '#1f2937' : '#9ca3af',
          }}
        >
          <option value="">Select Department</option>
          {Object.keys(DEPARTMENT_POSITIONS).map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Position</label>
        <select
          value={position}
          onChange={e => setPosition(e.target.value)}
          disabled={!department}
          style={{
            width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: '10px',
            fontSize: '14px', backgroundColor: department ? '#f9fafb' : '#f3f4f6', marginBottom: '24px', outline: 'none',
            color: position ? '#1f2937' : '#9ca3af',
            cursor: department ? 'pointer' : 'not-allowed',
          }}
        >
          <option value="">{department ? 'Select Position' : 'Select Department First'}</option>
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px', background: '#f3f4f6', color: '#374151',
              border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', textTransform: 'uppercase',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!department || !position}
            onClick={() => onComplete(department, position)}
            style={{
              flex: 1, padding: '12px',
              background: department && position
                ? 'linear-gradient(135deg, #0d47a1 0%, #1565a0 50%, #fbbf24 100%)'
                : '#d1d5db',
              color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
              cursor: department && position ? 'pointer' : 'not-allowed', textTransform: 'uppercase',
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;