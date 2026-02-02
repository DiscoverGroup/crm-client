import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuthContainer from "./components/AuthContainer";
import MainPage from "./components/MainPage";

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check MongoDB connection status
  useEffect(() => {
    const checkMongoDB = async () => {
      try {
        const response = await fetch('/.netlify/functions/database', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection: 'users', operation: 'find', filter: {} })
        });
        const result = await response.json();
        if (result.success) {
          console.log('✅ MongoDB Atlas: Connected');
        } else {
          console.warn('⚠️ MongoDB Atlas: Connection issue');
        }
      } catch (error) {
        console.error('❌ MongoDB Atlas: Not connected');
      }
    };
    checkMongoDB();
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
  const saveAuthState = (loggedIn: boolean, user: string | null) => {
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
      alert("Please enter both username and password");
      return;
    }

    // Get registered users from localStorage
    const registeredUsers = localStorage.getItem('crm_users');
    
    if (!registeredUsers) {
      alert("No registered users found. Please sign up first.");
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
          alert("Please verify your email address before logging in. Check your inbox for the verification link.");
          return;
        }

        // Login successful
        setCurrentUser(user.fullName || user.username);
        setIsLoggedIn(true);
        saveAuthState(true, user.fullName || user.username);
      } else {
        alert("Invalid email/username or password. Please try again or sign up.");
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
      alert("An error occurred. Please try again.");
    }
  };

  const handleRegister = async (form: { username: string; email: string; password: string; fullName: string; department: string; position: string; profileImage?: string }) => {
    // Validate all required fields
    if (!form.fullName.trim() || !form.username.trim() || !form.email.trim() || !form.password.trim() || !form.department.trim() || !form.position.trim()) {
      alert("Please fill in all fields");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      alert("Please enter a valid email address");
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
      alert("This email is already registered. Please login or use a different email.");
      return;
    }

    if (usernameExists) {
      alert("This username is already taken. Please choose a different username.");
      return;
    }

    // Generate verification token
    const verificationToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

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
      verificationToken: verificationToken,
      verificationTokenExpiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    users.push(newUser);
    localStorage.setItem('crm_users', JSON.stringify(users));

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
          verificationToken: verificationToken
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert("Registration successful! Please check your email to verify your account before logging in.");
      } else {
        alert("Registration successful, but failed to send verification email. Please contact support.");
      }
    } catch (error) {
      console.error('Error sending verification email:', error);
      alert("Registration successful, but failed to send verification email. Please contact support.");
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
      <Navbar 
        isLoggedIn={isLoggedIn}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <div style={{ flex: 1 }}>
        {isLoggedIn ? (
          <MainPage 
            currentUser={currentUser || ''}
            onUpdateUser={(newFullName) => {
              setCurrentUser(newFullName);
              saveAuthState(true, newFullName);
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