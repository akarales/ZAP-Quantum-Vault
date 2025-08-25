import { useState } from 'react';
import { Button } from '../ui/button';
import { HardDrive, Lock } from 'lucide-react';
import { UsbDrive } from '../../types/usb';
import { useUsbDrive } from '../../hooks/useUsbDrive';
import { useUsbPasswords } from '../../hooks/useUsbPasswords';
import { PasswordDialog } from '../password/PasswordDialog';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface MountButtonProps {
  drive: UsbDrive;
  userId?: string;
  onMountSuccess?: (mountPoint: string) => void;
  onMountError?: (error: string) => void;
  onUnmountSuccess?: () => void;
}

export const MountButton = ({
  drive,
  userId,
  onMountSuccess,
  onMountError,
  onUnmountSuccess
}: MountButtonProps) => {
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const { 
    loading: driveLoading, 
    mountDrive, 
    mountEncryptedDrive, 
    mountEncryptedDriveAuto, 
    unmountDrive 
  } = useUsbDrive();
  const { savePassword } = useUsbPasswords();

  const isMounted = !!drive.mount_point;
  const isEncrypted = drive.is_encrypted;

  const handleMount = async () => {
    if (isMounted) {
      // Unmount
      const result = await unmountDrive(drive.device_path);
      if (result.success) {
        onUnmountSuccess?.();
      } else {
        onMountError?.(result.message);
      }
      return;
    }

    if (!isEncrypted) {
      // Mount unencrypted drive
      const result = await mountDrive(drive.device_path);
      if (result.success && result.mount_point) {
        onMountSuccess?.(result.mount_point);
      } else {
        onMountError?.(result.message);
      }
      return;
    }

    // Try auto-mount with saved password first
    if (userId) {
      const autoResult = await mountEncryptedDriveAuto(drive.device_path, userId);
      if (autoResult.success && autoResult.mount_point) {
        onMountSuccess?.(autoResult.mount_point);
        return;
      }
    }

    // Show password dialog for manual entry
    setShowPasswordDialog(true);
  };

  const handlePasswordSubmit = async (
    password: string, 
    shouldSavePassword: boolean, 
    hint?: string
  ) => {
    const result = await mountEncryptedDrive(drive.device_path, password);
    
    if (result.success) {
      setShowPasswordDialog(false);
      
      // Save password if requested
      if (shouldSavePassword && userId) {
        try {
          await savePassword(userId, {
            drive_id: drive.id,
            device_path: drive.device_path,
            drive_label: drive.label,
            password,
            password_hint: hint
          });
        } catch (error) {
          console.warn('Failed to save password:', error);
        }
      }
      
      if (result.mount_point) {
        onMountSuccess?.(result.mount_point);
      }
    } else {
      onMountError?.(result.message);
    }
  };

  const getButtonText = () => {
    if (driveLoading) return '';
    if (isMounted) return 'Unmount';
    if (isEncrypted) return 'Unlock & Mount';
    return 'Mount';
  };

  const getButtonIcon = () => {
    if (driveLoading) return <LoadingSpinner size="sm" />;
    if (isEncrypted && !isMounted) return <Lock className="w-4 h-4" />;
    return <HardDrive className="w-4 h-4" />;
  };

  const getButtonVariant = () => {
    if (isMounted) return 'outline' as const;
    return 'default' as const;
  };

  const getButtonClassName = () => {
    if (isMounted) return 'border-green-500 text-green-600 hover:bg-green-50';
    return '';
  };

  return (
    <>
      <Button
        onClick={handleMount}
        disabled={driveLoading}
        variant={getButtonVariant()}
        className={`flex items-center gap-2 ${getButtonClassName()}`}
      >
        {getButtonIcon()}
        {getButtonText()}
      </Button>

      <PasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onSubmit={handlePasswordSubmit}
        title="Unlock Encrypted Drive"
        description={`Enter the password to unlock ${drive.label || drive.device_path}`}
        showSaveOption={!!userId}
        loading={driveLoading}
      />
    </>
  );
};
