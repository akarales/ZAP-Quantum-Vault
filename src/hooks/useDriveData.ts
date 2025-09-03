import { useState, useEffect } from 'react';
import { safeTauriInvoke } from '../utils/tauri-api';
import { UsbDrive } from '../types/usb';

interface UseDriveDataReturn {
  drive: UsbDrive | null;
  loading: boolean;
  error: string;
  success: string;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  refreshDrive: () => Promise<void>;
}

export const useDriveData = (driveId: string | undefined): UseDriveDataReturn => {
  const [drive, setDrive] = useState<UsbDrive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadDriveData = async () => {
    if (!driveId) return;
    
    try {
      setLoading(true);
      setError('');
      const driveData = await safeTauriInvoke('get_drive_details', { driveId });
      setDrive(driveData as UsbDrive);
    } catch (error) {
      console.error('Failed to load drive data:', error);
      setError(`Failed to load drive data: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshDrive = async () => {
    if (!driveId) return;
    
    try {
      setLoading(true);
      setError('');
      
      // First refresh the USB drive cache to get latest hardware state
      await safeTauriInvoke('refresh_usb_drives');
      
      // Then load the specific drive details
      const driveData = await safeTauriInvoke('get_drive_details', { driveId });
      setDrive(driveData as UsbDrive);
    } catch (error) {
      console.error('Failed to refresh drive data:', error);
      setError(`Failed to refresh drive data: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDriveData();
  }, [driveId]);

  return {
    drive,
    loading,
    error,
    success,
    setError,
    setSuccess,
    refreshDrive
  };
};
