import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    is_active: boolean;
    mfa_enabled: boolean;
    created_at: string;
    updated_at: string;
  };
  token: string;
}

function App() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [userCount, setUserCount] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<AuthResponse | null>(null);
  const [isLogin, setIsLogin] = useState(false);

  async function register() {
    try {
      if (password !== confirmPassword) {
        setMessage("Passwords do not match");
        return;
      }

      const response: AuthResponse = await invoke("register_user", {
        request: { username, email, password }
      });
      
      setCurrentUser(response);
      setMessage(`Registration successful! Welcome ${response.user.username}`);
      await getUserCount();
    } catch (error) {
      setMessage(`Registration failed: ${error}`);
    }
  }

  async function login() {
    try {
      const response: AuthResponse = await invoke("login_user", {
        request: { username: loginUsername, password: loginPassword }
      });
      
      setCurrentUser(response);
      setMessage(`Login successful! Welcome back ${response.user.username}`);
    } catch (error) {
      setMessage(`Login failed: ${error}`);
    }
  }

  async function getUserCount() {
    try {
      const count: number = await invoke("get_user_count");
      setUserCount(count);
    } catch (error) {
      setMessage(`Failed to get user count: ${error}`);
    }
  }

  async function clearAllUsers() {
    try {
      const result: string = await invoke("clear_all_users");
      setMessage(result);
      setCurrentUser(null);
      await getUserCount();
    } catch (error) {
      setMessage(`Failed to clear users: ${error}`);
    }
  }

  // Load user count on component mount
  useEffect(() => {
    getUserCount();
  }, []);

  if (currentUser) {
    return (
      <main className="container">
        <h1>ZAP Quantum Vault</h1>
        <div className="user-info">
          <h2>Welcome, {currentUser.user.username}!</h2>
          <p>Email: {currentUser.user.email}</p>
          <p>User ID: {currentUser.user.id}</p>
          <p>Account created: {new Date(currentUser.user.created_at).toLocaleString()}</p>
        </div>
        
        <div className="admin-section">
          <h3>Database Admin</h3>
          <p>Users in database: {userCount !== null ? userCount : 'Loading...'}</p>
          <button onClick={clearAllUsers} style={{backgroundColor: '#dc3545', color: 'white'}}>
            Clear All Users
          </button>
          <button onClick={() => setCurrentUser(null)} style={{marginLeft: '10px'}}>
            Logout
          </button>
        </div>
        
        {message && <p className="message">{message}</p>}
      </main>
    );
  }

  return (
    <main className="container">
      <h1>ZAP Quantum Vault</h1>
      <p>Secure cryptographic key management system</p>

      <div className="auth-toggle">
        <button 
          onClick={() => setIsLogin(false)} 
          className={!isLogin ? 'active' : ''}
        >
          Register
        </button>
        <button 
          onClick={() => setIsLogin(true)} 
          className={isLogin ? 'active' : ''}
        >
          Login
        </button>
      </div>

      {!isLogin ? (
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            register();
          }}
        >
          <h2>Create Account</h2>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm Password"
            required
          />
          <button type="submit">Create Account</button>
        </form>
      ) : (
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            login();
          }}
        >
          <h2>Sign In</h2>
          <input
            type="text"
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            placeholder="Username"
            required
          />
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="Password"
            required
          />
          <button type="submit">Sign In</button>
        </form>
      )}

      <div className="admin-section">
        <h3>Database Status</h3>
        <p>Users in database: {userCount !== null ? userCount : 'Loading...'}</p>
        <button onClick={getUserCount}>Refresh Count</button>
        <button 
          onClick={clearAllUsers} 
          style={{backgroundColor: '#dc3545', color: 'white', marginLeft: '10px'}}
        >
          Clear All Users
        </button>
      </div>

      {message && <p className="message">{message}</p>}
    </main>
  );
}

export default App;
