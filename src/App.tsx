import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AppRouter } from '@/router/AppRouter';
import './App.css';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="zap-vault-theme">
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
