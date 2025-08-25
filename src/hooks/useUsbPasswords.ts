import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { UsbDrivePassword, SavePasswordRequest } from '../types/usb';

export const useUsbPasswords = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savePassword = useCallback(async (
    userId: string,
    request: SavePasswordRequest
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await invoke('save_usb_drive_password', {
        userId,
        driveId: request.drive_id,
        devicePath: request.device_path,
        driveLabel: request.drive_label,
        password: request.password,
        passwordHint: request.password_hint,
      });
    } catch (err) {
      setError(err as string);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPasswords = useCallback(async (userId: string): Promise<UsbDrivePassword[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const passwords = await invoke<UsbDrivePassword[]>('get_usb_drive_passwords', { userId });
      return passwords;
    } catch (err) {
      setError(err as string);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePassword = useCallback(async (userId: string, driveId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await invoke('delete_usb_drive_password', { userId, driveId });
    } catch (err) {
      setError(err as string);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePasswordHint = useCallback(async (
    userId: string,
    driveId: string,
    hint: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await invoke('update_usb_drive_password_hint', { userId, driveId, hint });
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
    savePassword,
    getPasswords,
    deletePassword,
    updatePasswordHint,
  };
};
