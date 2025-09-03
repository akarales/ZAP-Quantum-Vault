import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Shield, HardDrive, Calendar, Info } from 'lucide-react';
import { safeTauriInvoke } from '@/utils/tauri-api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface TrustedDriveInfo {
  drive_id: string;
  device_path: string;
  drive_label: string | null;
  trust_level: string;
  created_at: string;
  updated_at: string;
  password_hint: string | null;
  password_last_used: string | null;
}

const TrustedDrivesPage: React.FC = () => {
  const [trustedDrives, setTrustedDrives] = useState<TrustedDriveInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadTrustedDrives = async () => {
    try {
      setLoading(true);
      const drives = await safeTauriInvoke<TrustedDriveInfo[]>('get_all_trusted_drives', {
        user_id: 'admin'
      });
      setTrustedDrives(drives);
    } catch (error) {
      toast.error(`Failed to load trusted drives: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDrive = async (driveId: string) => {
    try {
      setDeleting(driveId);
      await safeTauriInvoke('delete_trusted_drive', {
        user_id: 'admin',
        drive_id: driveId
      });
      toast.success('Drive removed from trusted list');
      await loadTrustedDrives();
    } catch (error) {
      toast.error(`Failed to delete drive: ${error}`);
    } finally {
      setDeleting(null);
    }
  };

  const getTrustLevelBadge = (trustLevel: string) => {
    switch (trustLevel) {
      case 'trusted':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
          <Shield className="w-3 h-3 mr-1" />
          Trusted
        </Badge>;
      case 'untrusted':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
          <Info className="w-3 h-3 mr-1" />
          Untrusted
        </Badge>;
      case 'blocked':
        return <Badge variant="destructive">
          <Shield className="w-3 h-3 mr-1" />
          Blocked
        </Badge>;
      default:
        return <Badge variant="outline">{trustLevel}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  useEffect(() => {
    loadTrustedDrives();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading trusted drives...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Trusted USB Drives</h1>
        <p className="text-muted-foreground">
          Manage your trusted USB drives. You can view all drives that have been marked as trusted and remove old or unwanted entries.
        </p>
      </div>

      {trustedDrives.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HardDrive className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Trusted Drives</h3>
            <p className="text-muted-foreground text-center max-w-md">
              You haven't trusted any USB drives yet. Format and encrypt a USB drive to automatically add it to your trusted list.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {trustedDrives.map((drive) => (
            <Card key={drive.drive_id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">
                        {drive.drive_label || drive.drive_id}
                      </CardTitle>
                      <CardDescription className="font-mono text-sm">
                        {drive.device_path}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTrustLevelBadge(drive.trust_level)}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deleting === drive.drive_id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Trusted Drive</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove "{drive.drive_label || drive.drive_id}" from your trusted drives list? 
                            This will also delete any saved passwords for this drive. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteDrive(drive.drive_id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove Drive
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Drive ID</p>
                    <p className="font-mono">{drive.drive_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Added</p>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <p>{formatDate(drive.created_at)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Last Updated</p>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <p>{formatDate(drive.updated_at)}</p>
                    </div>
                  </div>
                  {drive.password_hint && (
                    <div className="md:col-span-3">
                      <p className="text-muted-foreground mb-1">Password Hint</p>
                      <p className="text-sm bg-muted p-2 rounded">{drive.password_hint}</p>
                    </div>
                  )}
                  {drive.password_last_used && (
                    <div>
                      <p className="text-muted-foreground mb-1">Password Last Used</p>
                      <p>{formatDate(drive.password_last_used)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <Button onClick={loadTrustedDrives} variant="outline">
          Refresh List
        </Button>
      </div>
    </div>
  );
};

export default TrustedDrivesPage;
