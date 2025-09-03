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
  console.log('[AuthContext] AuthProvider initialized');
  
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user && !!token;
  
  console.log('[AuthContext] Current state - user:', user?.id, 'token:', token ? 'Present' : 'None', 'loading:', loading, 'authenticated:', isAuthenticated);

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
    console.log('[AuthContext] Login attempt for username:', username);
    
    try {
      const response = await invoke<AuthResponse>('authenticate_user', {
        username,
        password
      });
      
      console.log('[AuthContext] Login successful for user:', response.user.id);
      
      setUser(response.user);
      setToken(response.token);
      
      // Store in localStorage for persistence
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('user_data', JSON.stringify(response.user));
      
      console.log('[AuthContext] User data stored in localStorage');
    } catch (error) {
      console.error('[AuthContext] Login failed:', error);
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string): Promise<void> => {
    console.log('[AuthContext] Registration attempt for username:', username, 'email:', email);
    
    try {
      const response = await invoke<AuthResponse>('register_user', {
        username,
        email,
        password
      });
      
      console.log('[AuthContext] Registration successful for user:', response.user.id);
      
      setUser(response.user);
      setToken(response.token);
      
      // Store in localStorage for persistence
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('user_data', JSON.stringify(response.user));
      
      console.log('[AuthContext] User data stored in localStorage after registration');
    } catch (error) {
      console.error('[AuthContext] Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    console.log('[AuthContext] Logout initiated');
    
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    
    console.log('[AuthContext] Logout completed - user data cleared');
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
