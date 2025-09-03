import React, { useState, useEffect } from 'react';
import { HardDrive, Lock, Unlock, CheckCircle, AlertTriangle, Eye, EyeOff, Key } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { UsbDrive } from '../../types/usb';
import { getCurrentStoredPassword } from '../../utils/tauri-api';

interface DriveInfoProps {
  drive: UsbDrive;
  userId?: string;
}

export const DriveInfo: React.FC<DriveInfoProps> = ({ drive, userId = 'admin' }) => {
  const [storedPassword, setStoredPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const formatCapacity = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const getEncryptionStatus = () => {
    const isEncrypted = drive.is_encrypted || drive.filesystem === 'LUKS Encrypted' || drive.filesystem === 'crypto_LUKS';
    return {
      encrypted: isEncrypted,
      icon: isEncrypted ? Lock : Unlock,
      text: isEncrypted ? 'Encrypted' : 'Not Encrypted',
      variant: (isEncrypted ? 'default' : 'secondary') as 'default' | 'secondary' | 'destructive' | 'outline'
    };
  };

  const getMountStatus = () => {
    // Check multiple indicators for mount status
    const isMounted = !!(drive.mount_point || 
                        drive.filesystem === 'LUKS Encrypted' || 
                        drive.filesystem === 'crypto_LUKS' ||
                        drive.available_space > 0);
    return {
      mounted: isMounted,
      icon: isMounted ? CheckCircle : AlertTriangle,
      text: isMounted ? 'Mounted' : 'Not Mounted',
      variant: (isMounted ? 'default' : 'destructive') as 'default' | 'secondary' | 'destructive' | 'outline'
    };
  };

  const encryptionStatus = getEncryptionStatus();
  const mountStatus = getMountStatus();

  // Load stored password for encrypted drives
  useEffect(() => {
    const loadStoredPassword = async () => {
      if (encryptionStatus.encrypted && drive.id) {
        setLoadingPassword(true);
        try {
          const password = await getCurrentStoredPassword(userId, drive.id);
          setStoredPassword(password);
        } catch (error) {
          console.error('Failed to load stored password:', error);
          setStoredPassword(null);
        } finally {
          setLoadingPassword(false);
        }
      }
    };

    loadStoredPassword();
  }, [drive.id, encryptionStatus.encrypted, userId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="w-4 h-4" />
          Drive Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Device ID</p>
            <p className="font-medium">{drive.id}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Device Path</p>
            <p className="font-mono text-xs">{drive.device_path}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Capacity</p>
            <p className="font-medium">{formatCapacity(drive.capacity)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Available Space</p>
            <p className="font-medium">{formatCapacity(drive.available_space)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Filesystem</p>
            <p className="font-medium">{drive.filesystem}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Label</p>
            <p className="font-medium">{drive.label || 'No Label'}</p>
          </div>
          {drive.mount_point && (
            <div className="col-span-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">Mount Point</p>
              <p className="font-mono text-xs truncate">{drive.mount_point}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Trust Level</p>
            <p className="font-medium capitalize">{drive.trust_level}</p>
          </div>
        </div>

        {/* Current Password Section for Encrypted Drives */}
        {encryptionStatus.encrypted && (
          <div className="border-t pt-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <Key className="w-3 h-3 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Password</p>
              </div>
              {storedPassword && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="h-5 px-1 text-xs"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
              )}
            </div>
            <div className="bg-muted/50 rounded p-1">
              {loadingPassword ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : storedPassword ? (
                <p className="font-mono text-xs">
                  {showPassword ? storedPassword : '••••••••••••••••'}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No password stored</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1 pt-2 border-t">
          <Badge variant={encryptionStatus.variant} className="flex items-center gap-1 text-xs">
            <encryptionStatus.icon className="w-3 h-3" />
            {encryptionStatus.text}
          </Badge>
          <Badge variant={mountStatus.variant} className="flex items-center gap-1 text-xs">
            <mountStatus.icon className="w-3 h-3" />
            {mountStatus.text}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
