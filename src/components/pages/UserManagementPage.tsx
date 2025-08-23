import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserPlus, Shield, ShieldCheck, Eye, EyeOff, Trash2, AlertTriangle, Key, RotateCcw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
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

export const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  
  // Create user form state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  });
  
  
  // Delete confirmation
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Password reset
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const userList = await invoke<User[]>('get_all_users');
      setUsers(userList);
    } catch (error) {
      setMessage(`Failed to fetch users: ${error}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (createForm.password !== createForm.confirmPassword) {
      setMessage('Passwords do not match');
      setMessageType('error');
      return;
    }
    
    try {
      await invoke('register_user', {
        request: {
          username: createForm.username,
          email: createForm.email,
          password: createForm.password
        }
      });
      
      // Update role if not default user
      if (createForm.role !== 'user') {
        const newUsers = await invoke<User[]>('get_all_users');
        const newUser = newUsers.find((u: User) => u.username === createForm.username);
        if (newUser) {
          await invoke('update_user_role', {
            userId: newUser.id,
            newRole: createForm.role
          });
        }
      }
      
      setMessage('User created successfully');
      setMessageType('success');
      setShowCreateDialog(false);
      setCreateForm({ username: '', email: '', password: '', confirmPassword: '', role: 'user' });
      fetchUsers();
    } catch (error) {
      setMessage(`Failed to create user: ${error}`);
      setMessageType('error');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await invoke('update_user_role', { userId, newRole });
      setMessage('User role updated successfully');
      setMessageType('success');
      fetchUsers();
    } catch (error) {
      setMessage(`Failed to update user role: ${error}`);
      setMessageType('error');
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      await invoke('toggle_user_status', { userId });
      setMessage('User status updated successfully');
      setMessageType('success');
      fetchUsers();
    } catch (error) {
      setMessage(`Failed to update user status: ${error}`);
      setMessageType('error');
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    
    try {
      await invoke('delete_user', { userId: deletingUser.id });
      setMessage('User deleted successfully');
      setMessageType('success');
      setShowDeleteDialog(false);
      setDeletingUser(null);
      fetchUsers();
    } catch (error) {
      setMessage(`Failed to delete user: ${error}`);
      setMessageType('error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    
    if (newPassword !== confirmNewPassword) {
      setMessage('Passwords do not match');
      setMessageType('error');
      return;
    }
    
    if (newPassword.length < 6) {
      setMessage('Password must be at least 6 characters long');
      setMessageType('error');
      return;
    }
    
    try {
      await invoke('reset_user_password', {
        userId: resetPasswordUser.id,
        newPassword: newPassword
      });
      setMessage(`Password reset successfully for ${resetPasswordUser.username}`);
      setMessageType('success');
      setShowPasswordResetDialog(false);
      setResetPasswordUser(null);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      setMessage(`Failed to reset password: ${error}`);
      setMessageType('error');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isCurrentUserAdmin = currentUser?.role === 'admin';

  if (!isCurrentUserAdmin) {
    return (
      <div className="max-w-none w-full p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <CardTitle className="text-foreground">Access Denied</CardTitle>
              <CardDescription>
                You need administrator privileges to access user management.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-none w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage system users and their permissions</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system. They will receive standard user privileges by default.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={createForm.role} onValueChange={(value) => setCreateForm({ ...createForm, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={createForm.confirmPassword}
                    onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create User</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Message Alert */}
      {message && (
        <Alert className={messageType === 'error' ? 'border-destructive' : 'border-green-500'}>
          <AlertDescription className={messageType === 'error' ? 'text-destructive' : 'text-green-600'}>
            {message}
          </AlertDescription>
        </Alert>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center">
            <Users className="h-5 w-5 mr-2" />
            System Users ({users.length})
          </CardTitle>
          <CardDescription>
            Manage user accounts, roles, and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">User</TableHead>
                  <TableHead className="text-foreground">Role</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-foreground">Last Login</TableHead>
                  <TableHead className="text-foreground">Created</TableHead>
                  <TableHead className="text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-foreground">{user.username}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleUpdateRole(user.id, value)}
                        disabled={user.id === currentUser?.id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {user.mfa_enabled && (
                          <Badge variant="outline">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            MFA
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.last_login ? formatDate(user.last_login) : 'Never'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setResetPasswordUser(user);
                            setShowPasswordResetDialog(true);
                          }}
                          title="Reset Password"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(user.id)}
                          disabled={user.id === currentUser?.id}
                          title={user.is_active ? "Disable User" : "Enable User"}
                        >
                          {user.is_active ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDeletingUser(user);
                            setShowDeleteDialog(true);
                          }}
                          disabled={user.id === currentUser?.id}
                          title="Delete User"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordResetDialog} onOpenChange={setShowPasswordResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Key className="h-5 w-5 mr-2" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Reset password for user "{resetPasswordUser?.username}". The user will need to use the new password to login.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={6}
              />
            </div>
            <div>
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowPasswordResetDialog(false);
                setNewPassword('');
                setConfirmNewPassword('');
              }}>
                Cancel
              </Button>
              <Button type="submit">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user "{deletingUser?.username}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
