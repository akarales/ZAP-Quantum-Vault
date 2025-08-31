import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { MountResult } from '../types/usb';

export const useUsbDrive = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountDrive = useCallback(async (devicePath: string): Promise<MountResult> => {
    setLoading(true);
    setError(null);
    
    try {
      // Convert device path to drive ID format expected by backend
      const driveId = devicePath.startsWith('/dev/') 
        ? `usb_${devicePath.replace('/dev/', '')}`
        : devicePath;
        
      const result = await invoke<string>('mount_drive', { 
        driveId,
        mountPoint: null 
      });
      
      // Extract mount point from success message if available
      const mountPointMatch = result.match(/mounted.*at\s+(.+)$/i);
      const mount_point = mountPointMatch ? mountPointMatch[1].trim() : undefined;
      
      return { success: true, message: result, mount_point };
    } catch (err) {
      const errorMessage = err as string;
      setError(errorMessage);
      
      // Parse error for better user feedback
      let error_code = 'UNKNOWN_ERROR';
      let details = errorMessage;
      
      if (errorMessage.includes('LUKS_ENCRYPTED_DRIVE')) {
        error_code = 'LUKS_ENCRYPTED_DRIVE';
        details = 'This drive is encrypted with LUKS. Please use the "Unlock & Mount" option with the correct password.';
      } else if (errorMessage.includes('LUKS')) {
        error_code = 'LUKS_ERROR';
      } else if (errorMessage.includes('not found')) {
        error_code = 'DRIVE_NOT_FOUND';
      } else if (errorMessage.includes('permission')) {
        error_code = 'PERMISSION_ERROR';
      } else if (errorMessage.includes('mounted')) {
        error_code = 'ALREADY_MOUNTED';
      }
      
      return { success: false, message: errorMessage, error_code, details };
    } finally {
      setLoading(false);
    }
  }, []);

  const mountEncryptedDrive = useCallback(async (
    devicePath: string, 
    password: string
  ): Promise<MountResult> => {
    setLoading(true);
    setError(null);
    
    try {
      // Convert device path to drive ID format expected by backend
      const driveId = devicePath.startsWith('/dev/') 
        ? `usb_${devicePath.replace('/dev/', '')}`
        : devicePath;
        
      const result = await invoke<string>('mount_encrypted_drive', { 
        driveId, 
        password 
      });
      
      // Extract mount point from success message if available
      const mountPointMatch = result.match(/mounted.*at\s+(.+)$/i);
      const mount_point = mountPointMatch ? mountPointMatch[1].trim() : undefined;
      
      return { success: true, message: result, mount_point };
    } catch (err) {
      const errorMessage = err as string;
      setError(errorMessage);
      
      // Parse error for better user feedback
      let error_code = 'UNKNOWN_ERROR';
      let details = errorMessage;
      
      if (errorMessage.includes('NO_STORED_PASSWORD')) {
        error_code = 'NO_STORED_PASSWORD';
        details = 'No saved password found for this drive. Please enter the password manually.';
      } else if (errorMessage.includes('DEVICE_NOT_LUKS_ENCRYPTED')) {
        error_code = 'DEVICE_NOT_LUKS_ENCRYPTED';
        details = 'This device is not LUKS encrypted. Please use the regular mount option.';
      } else if (errorMessage.includes('LUKS')) {
        error_code = 'LUKS_ERROR';
      } else if (errorMessage.includes('password')) {
        error_code = 'INVALID_PASSWORD';
      } else if (errorMessage.includes('not found')) {
        error_code = 'DRIVE_NOT_FOUND';
      } else if (errorMessage.includes('permission')) {
        error_code = 'PERMISSION_ERROR';
      }
      
      return { success: false, message: errorMessage, error_code, details };
    } finally {
      setLoading(false);
    }
  }, []);

  const mountEncryptedDriveAuto = useCallback(async (
    devicePath: string, 
    userId: string
  ): Promise<MountResult> => {
    setLoading(true);
    setError(null);
    
    try {
      // Convert device path to drive ID format expected by backend
      const driveId = devicePath.startsWith('/dev/') 
        ? `usb_${devicePath.replace('/dev/', '')}`
        : devicePath;
        
      const result = await invoke<string>('mount_encrypted_drive_auto', { 
        driveId, 
        userId 
      });
      return { success: true, message: result };
    } catch (err) {
      const errorMessage = err as string;
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const unmountDrive = useCallback(async (devicePath: string): Promise<MountResult> => {
    setLoading(true);
    setError(null);
    
    try {
      // Convert device path to drive ID format expected by backend
      const driveId = devicePath.startsWith('/dev/') 
        ? `usb_${devicePath.replace('/dev/', '')}`
        : devicePath;
        
      const result = await invoke<string>('unmount_drive', { driveId });
      return { success: true, message: result };
    } catch (err) {
      const errorMessage = err as string;
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTrustLevel = useCallback(async (
    devicePath: string, 
    trustLevel: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await invoke('update_trust_level', { devicePath, trustLevel });
    } catch (err) {
      setError(err as string);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    mountDrive,
    mountEncryptedDrive,
    mountEncryptedDriveAuto,
    unmountDrive,
    updateTrustLevel,
  };
};
