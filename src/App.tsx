import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuthContainer from "./components/AuthContainer";
import MainPage from "./components/MainPage";

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleRegister = (form: { username: string; email: string; password: string; fullName: string; department: string; position: string }) => {
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

    // Add new user
    const newUser = {
      fullName: form.fullName,
      username: form.username,
      email: form.email,
      password: form.password, // In production, this should be hashed!
      department: form.department,
      position: form.position,
      registeredAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('crm_users', JSON.stringify(users));

    alert("Registration successful! Please login with your credentials.");
    
    // Return true to indicate successful registration
    return true;
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