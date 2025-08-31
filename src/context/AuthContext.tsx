import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Check if we're running in Tauri context
const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__;

let invoke: any;
if (isTauri) {
  import('@tauri-apps/api/core').then(module => {
    invoke = module.invoke;
  });
}

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  mfa_enabled: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthResponse {
  user: User;
  token: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  useEffect(() => {
    // Check for existing session on app start
    const savedUser = localStorage.getItem('zap_vault_user');
    const savedToken = localStorage.getItem('zap_vault_token');
    
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('zap_vault_user');
        localStorage.removeItem('zap_vault_token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    try {
      if (!isTauri) {
        // Browser fallback - simulate successful login for testing
        if (username === 'admin' && password === 'admin') {
          const mockUser: User = {
            id: 'browser-user-1',
            username: 'admin',
            email: 'admin@zapchat.org',
            role: 'admin',
            is_active: true,
            mfa_enabled: false,
            last_login: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const mockToken = 'browser-mock-token-' + Date.now();
          
          setUser(mockUser);
          setToken(mockToken);
          
          localStorage.setItem('zap_vault_user', JSON.stringify(mockUser));
          localStorage.setItem('zap_vault_token', mockToken);
          return;
        } else {
          throw new Error('Invalid credentials (use admin/admin for browser testing)');
        }
      }

      const response: AuthResponse = await invoke('login_user', {
        request: { username, password }
      });
      
      setUser(response.user);
      setToken(response.token);
      
      // Persist to localStorage
      localStorage.setItem('zap_vault_user', JSON.stringify(response.user));
      localStorage.setItem('zap_vault_token', response.token);
    } catch (error) {
      throw new Error(`Login failed: ${error}`);
    }
  };

  const register = async (username: string, email: string, password: string): Promise<void> => {
    try {
      if (!isTauri) {
        // Browser fallback - simulate successful registration for testing
        const mockUser: User = {
          id: 'browser-user-' + Date.now(),
          username,
          email,
          role: 'user',
          is_active: true,
          mfa_enabled: false,
          last_login: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const mockToken = 'browser-mock-token-' + Date.now();
        
        setUser(mockUser);
        setToken(mockToken);
        
        localStorage.setItem('zap_vault_user', JSON.stringify(mockUser));
        localStorage.setItem('zap_vault_token', mockToken);
        return;
      }

      const response: AuthResponse = await invoke('register_user', {
        request: { username, email, password }
      });
      
      setUser(response.user);
      setToken(response.token);
      
      // Persist to localStorage
      localStorage.setItem('zap_vault_user', JSON.stringify(response.user));
      localStorage.setItem('zap_vault_token', response.token);
    } catch (error) {
      throw new Error(`Registration failed: ${error}`);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('zap_vault_user');
    localStorage.removeItem('zap_vault_token');
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    login,
    register,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
