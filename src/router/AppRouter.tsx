import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AuthPage } from '@/pages/AuthPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { BitcoinKeysPage } from '@/pages/BitcoinKeysPage';
import { SecurityCenterPage } from '@/pages/SecurityCenterPage';
import { UserManagementPage } from '@/pages/UserManagementPage';
import { AdminResetPage } from '@/pages/AdminResetPage';
import { SettingsPage } from '@/pages/SettingsPage';
import VaultPage from '@/pages/VaultPage';
import VaultDetailsPage from '@/pages/VaultDetailsPage';
import KeyDetailsPage from '@/pages/KeyDetailsPage';
import { ColdStoragePage } from '@/pages/ColdStoragePage';
import UsbDriveDetailPage from '@/pages/UsbDriveDetailPage';
import { ThemeDemo } from '@/pages/ThemeDemo';
import { MainLayout } from '@/components/layout/MainLayout';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return <MainLayout>{children}</MainLayout>;
};

export const AppRouter: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Auth Route */}
        <Route 
          path="/auth" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthPage />
          } 
        />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        
        {/* Placeholder routes for future pages */}
        <Route path="/keys" element={
          <ProtectedRoute>
            <BitcoinKeysPage />
          </ProtectedRoute>
        } />
        
        <Route path="/storage" element={
          <ProtectedRoute>
            <VaultPage />
          </ProtectedRoute>
        } />
        
        <Route path="/vault/:vaultId" element={
          <ProtectedRoute>
            <VaultDetailsPage />
          </ProtectedRoute>
        } />
        
        <Route path="/key-details/:keyId" element={
          <ProtectedRoute>
            <KeyDetailsPage />
          </ProtectedRoute>
        } />
        
        <Route path="/cold-storage" element={
          <ProtectedRoute>
            <ColdStoragePage />
          </ProtectedRoute>
        } />
        
        <Route path="/cold-storage/drive/:driveId" element={
          <ProtectedRoute>
            <UsbDriveDetailPage />
          </ProtectedRoute>
        } />
        
        <Route path="/security" element={
          <ProtectedRoute>
            <SecurityCenterPage />
          </ProtectedRoute>
        } />
        
        <Route path="/organization" element={
          <ProtectedRoute>
            <div className="p-6">
              <h1 className="text-2xl font-bold">Organization</h1>
              <p className="text-muted-foreground">Coming soon...</p>
            </div>
          </ProtectedRoute>
        } />
        
        <Route path="/users" element={
          <ProtectedRoute>
            <UserManagementPage />
          </ProtectedRoute>
        } />
        
        <Route path="/airgap" element={
          <ProtectedRoute>
            <div className="p-6">
              <h1 className="text-2xl font-bold">Air Gap Mode</h1>
              <p className="text-muted-foreground">Coming soon...</p>
            </div>
          </ProtectedRoute>
        } />
        
        <Route path="/quantum" element={
          <ProtectedRoute>
            <div className="p-6">
              <h1 className="text-2xl font-bold">Quantum Safe</h1>
              <p className="text-muted-foreground">Coming soon...</p>
            </div>
          </ProtectedRoute>
        } />
        
        <Route path="/analytics" element={
          <ProtectedRoute>
            <div className="p-6">
              <h1 className="text-2xl font-bold">Analytics</h1>
              <p className="text-muted-foreground">Coming soon...</p>
            </div>
          </ProtectedRoute>
        } />
        
        <Route path="/blockchain/transactions" element={
          <ProtectedRoute>
            <div className="p-6">
              <h1 className="text-2xl font-bold">Transactions</h1>
              <p className="text-muted-foreground">Coming soon...</p>
            </div>
          </ProtectedRoute>
        } />
        
        <Route path="/blockchain/networks" element={
          <ProtectedRoute>
            <div className="p-6">
              <h1 className="text-2xl font-bold">Networks</h1>
              <p className="text-muted-foreground">Coming soon...</p>
            </div>
          </ProtectedRoute>
        } />
        
        <Route path="/blockchain/zap-chain" element={
          <ProtectedRoute>
            <div className="p-6">
              <h1 className="text-2xl font-bold">ZAP Chain</h1>
              <p className="text-muted-foreground">Coming soon...</p>
            </div>
          </ProtectedRoute>
        } />
        
        <Route path="/activity" element={
          <ProtectedRoute>
            <div className="p-6">
              <h1 className="text-2xl font-bold">Activity</h1>
              <p className="text-muted-foreground">Coming soon...</p>
            </div>
          </ProtectedRoute>
        } />
        
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />
        
        <Route path="/theme-demo" element={
          <ProtectedRoute>
            <ThemeDemo />
          </ProtectedRoute>
        } />
        
        <Route path="/help" element={
          <ProtectedRoute>
            <div className="p-6">
              <h1 className="text-2xl font-bold">Help</h1>
              <p className="text-muted-foreground">Coming soon...</p>
            </div>
          </ProtectedRoute>
        } />
        
        <Route path="/support" element={
          <ProtectedRoute>
            <div className="p-6">
              <h1 className="text-2xl font-bold">Support</h1>
              <p className="text-muted-foreground">Coming soon...</p>
            </div>
          </ProtectedRoute>
        } />
        
        {/* Admin Reset - Temporary route for clearing users */}
        <Route path="/admin-reset" element={<AdminResetPage />} />
        
        {/* Default redirect */}
        <Route path="/" element={
          <Navigate to={isAuthenticated ? "/dashboard" : "/auth"} replace />
        } />
        
        {/* Catch all */}
        <Route path="*" element={
          <Navigate to={isAuthenticated ? "/dashboard" : "/auth"} replace />
        } />
      </Routes>
    </Router>
  );
};
