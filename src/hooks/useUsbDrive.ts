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
      const result = await invoke<string>('mount_drive', { 
        driveId: devicePath,
        mountPoint: null 
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

  const mountEncryptedDrive = useCallback(async (
    devicePath: string, 
    password: string
  ): Promise<MountResult> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await invoke<string>('mount_encrypted_drive', { 
        driveId: devicePath, 
        password 
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

  const mountEncryptedDriveAuto = useCallback(async (
    devicePath: string, 
    userId: string
  ): Promise<MountResult> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await invoke<string>('mount_encrypted_drive_auto', { 
        driveId: devicePath, 
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
      const result = await invoke<string>('unmount_drive', { driveId: devicePath });
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
