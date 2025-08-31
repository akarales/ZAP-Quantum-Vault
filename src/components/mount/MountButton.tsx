import { useState } from 'react';
import { Button } from '../ui/button';
import { HardDrive, Lock, Unlock } from 'lucide-react';
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
    if (!isEncrypted) {
      // Mount unencrypted drive
      const result = await mountDrive(drive.device_path);
      if (result.success) {
        onMountSuccess?.(result.mount_point || result.message);
      } else {
        onMountError?.(result.message);
      }
      return;
    }

    // Try auto-mount with saved password first
    if (userId) {
      const autoResult = await mountEncryptedDriveAuto(drive.device_path, userId);
      if (autoResult.success) {
        onMountSuccess?.(autoResult.mount_point || autoResult.message);
        return;
      }
      // If auto-mount failed but not due to missing password, show error
      if (autoResult.error_code !== 'NO_STORED_PASSWORD') {
        onMountError?.(autoResult.message);
        return;
      }
    }

    // Show password dialog for manual entry
    setShowPasswordDialog(true);
  };

  const handleUnmount = async () => {
    const result = await unmountDrive(drive.device_path);
    if (result.success) {
      onUnmountSuccess?.();
    } else {
      onMountError?.(result.message);
    }
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
      
      onMountSuccess?.(result.mount_point || result.message);
    } else {
      onMountError?.(result.message);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {/* Mount Button */}
        <Button
          onClick={handleMount}
          disabled={driveLoading || isMounted}
          variant="default"
          size="sm"
          className={`flex items-center gap-2 ${isMounted ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
        >
          {driveLoading ? (
            <LoadingSpinner size="sm" />
          ) : isEncrypted ? (
            <Lock className="w-4 h-4" />
          ) : (
            <HardDrive className="w-4 h-4" />
          )}
          {isEncrypted ? 'Unlock & Mount' : 'Mount'}
        </Button>

        {/* Unmount Button */}
        <Button
          onClick={handleUnmount}
          disabled={driveLoading || !isMounted}
          variant="outline"
          size="sm"
          className={`flex items-center gap-2 ${!isMounted ? 'opacity-50 cursor-not-allowed' : 'border-red-500 text-red-600 hover:bg-red-50'}`}
        >
          <Unlock className="w-4 h-4" />
          Unmount
        </Button>
      </div>

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
