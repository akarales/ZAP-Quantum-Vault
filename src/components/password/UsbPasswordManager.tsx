import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { RefreshCw, Key } from 'lucide-react';
import { UsbDrivePassword } from '../../types/usb';
import { useUsbPasswords } from '../../hooks/useUsbPasswords';
import { PasswordList } from './PasswordList';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface UsbPasswordManagerProps {
  userId: string;
}

export const UsbPasswordManager = ({ userId }: UsbPasswordManagerProps) => {
  const [passwords, setPasswords] = useState<UsbDrivePassword[]>([]);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  
  const { 
    loading, 
    error, 
    getPasswords, 
    deletePassword, 
    updatePasswordHint 
  } = useUsbPasswords();

  const loadPasswords = async () => {
    try {
      const passwordList = await getPasswords(userId);
      setPasswords(passwordList);
    } catch (error) {
      console.error('Failed to load passwords:', error);
    }
  };

  useEffect(() => {
    if (userId) {
      loadPasswords();
    }
  }, [userId]);

  const handleCopyPassword = async (passwordId: string) => {
    try {
      const password = await invoke<string>('get_usb_drive_password', {
        userId,
        driveId: passwordId
      });
      
      await navigator.clipboard.writeText(password);
      setCopyFeedback('Password copied to clipboard!');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (error) {
      setCopyFeedback('Failed to copy password');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const handleUpdateHint = async (passwordId: string, hint: string) => {
    try {
      await updatePasswordHint(userId, passwordId, hint);
      await loadPasswords(); // Refresh the list
    } catch (error) {
      console.error('Failed to update hint:', error);
    }
  };

  const handleDeletePassword = async (passwordId: string) => {
    try {
      await deletePassword(userId, passwordId);
      await loadPasswords(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete password:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            <CardTitle>Saved USB Drive Passwords</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadPasswords}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {copyFeedback && (
          <div className="mb-4 p-2 bg-green-100 text-green-800 rounded text-sm">
            {copyFeedback}
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-800 rounded text-sm">
            Error: {error}
          </div>
        )}

        <PasswordList
          passwords={passwords}
          loading={loading}
          onCopyPassword={handleCopyPassword}
          onUpdateHint={handleUpdateHint}
          onDeletePassword={handleDeletePassword}
        />
      </CardContent>
    </Card>
  );
};
