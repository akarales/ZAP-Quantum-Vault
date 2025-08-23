import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Settings, User, Lock, Shield, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { invoke } from '@tauri-apps/api/core';

export const SettingsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    username: currentUser?.username || '',
    email: currentUser?.email || '',
  });
  
  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        username: currentUser.username,
        email: currentUser.email,
      });
    }
  }, [currentUser]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setLoading(true);
    try {
      await invoke('update_admin_profile', {
        userId: currentUser.id,
        username: profileForm.username !== currentUser.username ? profileForm.username : null,
        email: profileForm.email !== currentUser.email ? profileForm.email : null,
        currentPassword: passwordForm.currentPassword,
        newPassword: null,
      });
      
      setMessage('Profile updated successfully');
      setMessageType('success');
      setPasswordForm({ ...passwordForm, currentPassword: '' });
    } catch (error) {
      setMessage(`Failed to update profile: ${error}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage('New passwords do not match');
      setMessageType('error');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      setMessage('Password must be at least 6 characters long');
      setMessageType('error');
      return;
    }
    
    setLoading(true);
    try {
      await invoke('update_admin_profile', {
        userId: currentUser.id,
        username: null,
        email: null,
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      
      setMessage('Password changed successfully');
      setMessageType('success');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      setMessage(`Failed to change password: ${error}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-none w-full p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <CardTitle className="text-foreground">Access Denied</CardTitle>
              <CardDescription>
                You need to be logged in to access settings.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>
      </div>

      {/* Message Alert */}
      {message && (
        <Alert className={messageType === 'error' ? 'border-destructive' : 'border-green-500'}>
          <AlertDescription className={messageType === 'error' ? 'text-destructive' : 'text-green-600'}>
            {message}
          </AlertDescription>
        </Alert>
      )}

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center">
            <User className="h-5 w-5 mr-2" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Update your account information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  placeholder="Enter username"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="Enter email"
                  required
                />
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div>
              <Label htmlFor="currentPasswordProfile">Current Password</Label>
              <Input
                id="currentPasswordProfile"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                placeholder="Enter current password to confirm changes"
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                Required to save profile changes
              </p>
            </div>
            
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Profile'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center">
            <Lock className="h-5 w-5 mr-2" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label htmlFor="currentPasswordChange">Current Password</Label>
              <Input
                id="currentPasswordChange"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                placeholder="Enter current password"
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                />
              </div>
            </div>
            
            <Button type="submit" disabled={loading}>
              <Lock className="h-4 w-4 mr-2" />
              {loading ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Account Information
          </CardTitle>
          <CardDescription>
            Your account details and status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">User ID</Label>
              <p className="text-sm font-mono bg-muted p-2 rounded">{currentUser.id}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Role</Label>
              <p className="text-sm capitalize">{currentUser.role}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Account Status</Label>
              <p className="text-sm">{currentUser.is_active ? 'Active' : 'Inactive'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">MFA Status</Label>
              <p className="text-sm">{currentUser.mfa_enabled ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Last Login</Label>
              <p className="text-sm">
                {currentUser.last_login 
                  ? new Date(currentUser.last_login).toLocaleString() 
                  : 'Never'
                }
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Account Created</Label>
              <p className="text-sm">
                {new Date(currentUser.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
