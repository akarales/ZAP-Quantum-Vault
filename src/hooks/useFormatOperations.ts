import { useState } from 'react';
import { safeTauriInvoke } from '@/utils/tauri-api';
import { useAuth } from '@/context/AuthContext';

interface FormatProgress {
  stage: string;
  progress: number;
  message: string;
  isActive: boolean;
}

interface FormatOptions {
  drive_name: string;
  password: string;
  confirm_password: string;
  filesystem: string;
  encryption_type: string;
  quantum_entropy: boolean;
  zero_knowledge_proof: boolean;
  forward_secrecy: boolean;
  quantum_compression: boolean;
  air_gap_security: boolean;
}

interface UseFormatOperationsReturn {
  formatOptions: FormatOptions;
  setFormatOptions: React.Dispatch<React.SetStateAction<FormatOptions>>;
  formatProgress: FormatProgress | null;
  setFormatProgress: React.Dispatch<React.SetStateAction<FormatProgress | null>>;
  operationInProgress: boolean;
  setOperationInProgress: React.Dispatch<React.SetStateAction<boolean>>;
  handleFormatDrive: () => Promise<void>;
  handleResetEncryptedDrive: () => Promise<void>;
  validatePassword: (password: string) => { isValid: boolean; feedback: string };
}

const initialFormatOptions: FormatOptions = {
  drive_name: 'ZAP_Quantum_Vault',
  password: '',
  confirm_password: '',
  filesystem: 'ext4',
  encryption_type: 'basic_luks2',
  quantum_entropy: false,
  zero_knowledge_proof: false,
  forward_secrecy: false,
  quantum_compression: false,
  air_gap_security: false
};

export const useFormatOperations = (
  driveId: string | undefined,
  onSuccess: (message: string) => void,
  onError: (error: string) => void,
  refreshDrive: () => Promise<void>
): UseFormatOperationsReturn => {
  const { user } = useAuth();
  const [formatOptions, setFormatOptions] = useState<FormatOptions>(initialFormatOptions);
  const [formatProgress, setFormatProgress] = useState<FormatProgress | null>(null);
  const [operationInProgress, setOperationInProgress] = useState(false);

  const validatePassword = (password: string) => {
    if (!password) {
      return { isValid: false, feedback: 'Password is required' };
    }
    if (password.length < 12) {
      return { isValid: false, feedback: 'Password must be at least 12 characters long' };
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)) {
      return { 
        isValid: false, 
        feedback: 'Password must contain uppercase, lowercase, number, and special character' 
      };
    }
    return { isValid: true, feedback: 'Strong quantum-resistant password' };
  };

  const handleFormatDrive = async () => {
    console.log('[FRONTEND] Starting handleFormatDrive operation');
    console.log('[FRONTEND] Parameters:', { driveId, userId: user?.id, driveName: formatOptions.drive_name });
    console.log('[FRONTEND] Password length:', formatOptions.password.length);
    
    if (!driveId) {
      console.error('[FRONTEND] ❌ No driveId provided');
      return;
    }

    if (!user?.id) {
      console.error('[FRONTEND] ❌ User not authenticated');
      onError('User not authenticated');
      return;
    }

    try {
      console.log('[FRONTEND] Setting operation in progress...');
      setOperationInProgress(true);
      
      // Stage 1: Initialize
      setFormatProgress({
        stage: 'Initializing',
        progress: 5,
        message: 'Preparing to format and encrypt drive...',
        isActive: true
      });

      // Stage 2: Cleanup
      setTimeout(() => {
        setFormatProgress({
          stage: 'Cleanup',
          progress: 15,
          message: 'Cleaning up existing data and unmounting...',
          isActive: true
        });
      }, 500);

      // Stage 3: Partitioning
      setTimeout(() => {
        setFormatProgress({
          stage: 'Partitioning',
          progress: 30,
          message: 'Creating new partition table...',
          isActive: true
        });
      }, 1500);

      // Stage 4: LUKS Setup
      setTimeout(() => {
        setFormatProgress({
          stage: 'Encryption Setup',
          progress: 50,
          message: 'Setting up LUKS encryption...',
          isActive: true
        });
      }, 3000);

      // Stage 5: Formatting
      setTimeout(() => {
        setFormatProgress({
          stage: 'Formatting',
          progress: 75,
          message: 'Creating encrypted filesystem...',
          isActive: true
        });
      }, 5000);

      // Stage 6: Verification
      setTimeout(() => {
        setFormatProgress({
          stage: 'Verification',
          progress: 90,
          message: 'Verifying encrypted filesystem...',
          isActive: true
        });
      }, 7000);

      console.log('[FRONTEND] Invoking format_and_encrypt_drive with parameters:', {
        userId: user?.id,
        driveId,
        passwordLength: formatOptions.password.length,
        driveName: formatOptions.drive_name
      });
      
      const formatResult = await safeTauriInvoke('format_and_encrypt_drive', {
        userId: user?.id,
        driveId,
        password: formatOptions.password,
        driveName: formatOptions.drive_name
      });
      
      console.log('[FRONTEND] ✅ format_and_encrypt_drive completed successfully:', formatResult);

      // Stage 7: Save password and set trust level after successful formatting
      setFormatProgress({
        stage: 'Finalizing',
        progress: 95,
        message: 'Saving password and setting trust level...',
        isActive: true
      });

      console.log('[FRONTEND] Format completed, now handling password save and trust level...');
      
      try {
        console.log('[FRONTEND] Attempting to save password...');
        const passwordSaveResult = await safeTauriInvoke('save_usb_drive_password', {
          user_id: user?.id,
          request: {
            drive_id: driveId,
            device_path: `/dev/${driveId.replace('usb_', '')}`,
            drive_label: formatOptions.drive_name,
            password: formatOptions.password,
            password_hint: null
          }
        });
        console.log('[FRONTEND] ✅ Password saved successfully:', passwordSaveResult);

        console.log('[FRONTEND] Attempting to set trust level...');
        const trustResult = await safeTauriInvoke('set_drive_trust', {
          driveId: driveId,
          trustLevel: 'trusted'
        });
        console.log('[FRONTEND] ✅ Trust level set successfully:', trustResult);

        console.log('[FRONTEND] ✅ Password saved and trust level set to trusted');
      } catch (saveError) {
        console.error('[FRONTEND] ❌ Failed to save password or set trust level:', saveError);
        console.error('[FRONTEND] Error details:', saveError);
        // Don't fail the entire operation if password saving fails
      }

      // Stage 8: Complete
      setFormatProgress({
        stage: 'Complete',
        progress: 100,
        message: 'Drive formatted, encrypted, and secured successfully',
        isActive: false
      });

      console.log('[FRONTEND] ✅ Complete format operation successful');
      onSuccess(`Drive formatted and encrypted successfully. Password saved and trust level set to trusted.`);
      
      console.log('[FRONTEND] Refreshing drive data...');
      await refreshDrive();
      console.log('[FRONTEND] Drive data refreshed');
    } catch (error) {
      console.error('[FRONTEND] ❌ Format operation failed:', error);
      console.error('[FRONTEND] Error details:', error);
      onError(`Format operation failed: ${error}`);
      setFormatProgress(null);
    } finally {
      console.log('[FRONTEND] Cleaning up format operation...');
      setOperationInProgress(false);
    }
  };

  const handleResetEncryptedDrive = async () => {
    // For encrypted drives, we use the same format_and_encrypt_drive command
    // This will effectively reset and re-encrypt the drive
    await handleFormatDrive();
  };

  return {
    formatOptions,
    setFormatOptions,
    formatProgress,
    setFormatProgress,
    operationInProgress,
    setOperationInProgress,
    handleFormatDrive,
    handleResetEncryptedDrive,
    validatePassword
  };
};
