import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';

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
