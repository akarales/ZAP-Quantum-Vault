import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export const AdminResetPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleClearAllUsers = async () => {
    try {
      setLoading(true);
      await invoke<string>('clear_all_users');
      setMessage('All users cleared successfully! You can now register as the first admin user.');
      setMessageType('success');
      setShowConfirmDialog(false);
      
      // Redirect to auth page after a short delay
      setTimeout(() => {
        window.location.replace('/auth');
      }, 2000);
    } catch (error) {
      setMessage(`Failed to clear users: ${String(error)}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-none w-full p-6">
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle className="text-foreground">Admin Reset</CardTitle>
            <CardDescription>
              Clear all users and reset the system. The next user to register will become the admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {message && (
              <Alert className={messageType === 'error' ? 'border-destructive' : 'border-green-500'}>
                <AlertDescription className={messageType === 'error' ? 'text-destructive' : 'text-green-600'}>
                  {message}
                </AlertDescription>
              </Alert>
            )}
            
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="w-full"
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Users
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center text-destructive">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    Clear All Users
                  </DialogTitle>
                  <DialogDescription>
                    This will permanently delete all user accounts from the database. 
                    The next user to register will automatically become the admin.
                    <br /><br />
                    <strong>This action cannot be undone.</strong>
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleClearAllUsers}
                    disabled={loading}
                  >
                    {loading ? 'Clearing...' : 'Clear All Users'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <div className="text-sm text-muted-foreground text-center">
              After clearing users, you'll be redirected to the registration page.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
