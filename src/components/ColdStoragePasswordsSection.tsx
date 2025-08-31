import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Key, Trash2, Copy, Shield, Clock, HardDrive } from 'lucide-react';
import { toast } from 'sonner';

interface UsbDrivePasswordWithPassword {
  id: string;
  user_id: string;
  drive_id: string;
  device_path: string;
  drive_label?: string;
  password: string;
  password_hint?: string;
  created_at: string;
  updated_at: string;
  last_used?: string;
}

interface ColdStoragePasswordsSectionProps {
  userId: string;
}

export const ColdStoragePasswordsSection = ({ userId }: ColdStoragePasswordsSectionProps) => {
  const [passwords, setPasswords] = useState<UsbDrivePasswordWithPassword[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPasswords();
  }, [userId]);

  const loadPasswords = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError('');
    try {
      const result = await invoke<UsbDrivePasswordWithPassword[]>(
        'get_user_usb_drive_passwords_with_passwords',
        { userId }
      );
      setPasswords(result);
    } catch (err) {
      setError(`Failed to load cold storage passwords: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (passwordId: string) => {
    const newVisible = new Set(visiblePasswords);
    if (newVisible.has(passwordId)) {
      newVisible.delete(passwordId);
    } else {
      newVisible.add(passwordId);
    }
    setVisiblePasswords(newVisible);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (err) {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  const deletePassword = async (driveId: string, driveLabel?: string) => {
    try {
      await invoke('delete_usb_drive_password', { userId, driveId });
      setPasswords(passwords.filter(p => p.drive_id !== driveId));
      toast.success(`Password for ${driveLabel || driveId} deleted successfully`);
    } catch (err) {
      toast.error(`Failed to delete password: ${err}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeSinceLastUsed = (lastUsed?: string) => {
    if (!lastUsed) return 'Never used';
    
    const now = new Date();
    const lastUsedDate = new Date(lastUsed);
    const diffMs = now.getTime() - lastUsedDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Used today';
    if (diffDays === 1) return 'Used yesterday';
    if (diffDays < 7) return `Used ${diffDays} days ago`;
    if (diffDays < 30) return `Used ${Math.floor(diffDays / 7)} weeks ago`;
    return `Used ${Math.floor(diffDays / 30)} months ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading cold storage passwords...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (passwords.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Cold Storage Passwords</h3>
          <p className="text-muted-foreground">
            No saved passwords for cold storage drives. Passwords are automatically saved when you unlock encrypted drives.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Cold Storage Drive Passwords</h3>
          <p className="text-sm text-muted-foreground">
            Saved passwords for encrypted USB drives ({passwords.length} drive{passwords.length !== 1 ? 's' : ''})
          </p>
        </div>
        <Button variant="outline" onClick={loadPasswords} disabled={loading}>
          <Shield className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {passwords.map((passwordEntry) => (
          <Card key={passwordEntry.id} className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    {passwordEntry.drive_label || passwordEntry.drive_id}
                    <Badge variant="secondary">Encrypted Drive</Badge>
                  </CardTitle>
                  <CardDescription className="mt-1 font-mono text-sm">
                    {passwordEntry.device_path}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deletePassword(passwordEntry.drive_id, passwordEntry.drive_label)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Password Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Password</label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePasswordVisibility(passwordEntry.id)}
                    >
                      {visiblePasswords.has(passwordEntry.id) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(passwordEntry.password, 'Password')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-md font-mono text-sm">
                  {visiblePasswords.has(passwordEntry.id) 
                    ? passwordEntry.password 
                    : '•'.repeat(passwordEntry.password.length)
                  }
                </div>
              </div>

              {/* Password Hint */}
              {passwordEntry.password_hint && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password Hint</label>
                  <div className="p-3 bg-muted rounded-md text-sm">
                    {passwordEntry.password_hint}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Created: {formatDate(passwordEntry.created_at)}</span>
                  </div>
                  {passwordEntry.updated_at !== passwordEntry.created_at && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Updated: {formatDate(passwordEntry.updated_at)}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    <span>{getTimeSinceLastUsed(passwordEntry.last_used)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
