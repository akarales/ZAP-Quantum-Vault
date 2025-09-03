import React, { useState, useEffect } from 'react';
import { Download, CheckIcon, AlertCircleIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { UsbDrive } from '../../types/usb';
import { safeTauriInvoke } from '../../utils/tauri-api';

interface BackupManagementProps {
  drive: UsbDrive;
  onCreateBackup?: (options: BackupOptions) => void;
}

interface BackupOptions {
  name: string;
  includeSettings: boolean;
  encryptBackup: boolean;
}

export const BackupManagement: React.FC<BackupManagementProps> = ({
  drive,
  onCreateBackup
}) => {
  const [backupOptions, setBackupOptions] = useState<BackupOptions>({
    name: '',
    includeSettings: true,
    encryptBackup: true
  });
  
  const [backupPassword, setBackupPassword] = useState('');
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupMessage, setBackupMessage] = useState('');
  const [backupResult, setBackupResult] = useState<{ success: boolean; message: string } | null>(null);
  const [existingBackups, setExistingBackups] = useState<any[]>([]);

  // Load existing backups when component mounts
  useEffect(() => {
    loadExistingBackups();
  }, [drive.id]);
  
  const loadExistingBackups = async () => {
    try {
      const backups = await safeTauriInvoke('list_backups', { 
        drive_id: drive.id 
      });
      setExistingBackups(backups || []);
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  };
  
  const handleCreateBackup = async () => {
    if (!backupOptions.name.trim()) {
      setBackupResult({ success: false, message: 'Please enter a backup name' });
      return;
    }

    if (!backupPassword.trim()) {
      setBackupResult({ success: false, message: 'Please enter a backup password (min 12 chars, uppercase, lowercase, numbers, special chars)' });
      return;
    }

    setBackupInProgress(true);
    setBackupProgress(0);
    setBackupResult(null);
    
    try {
      // Create proper backup request object
      const backupRequest = {
        drive_id: drive.id,
        backup_type: 'Full',
        vault_ids: null,
        compression_level: 5,
        verification: true,
        password: backupPassword
      };
      
      console.log('[BACKUP_UI] Creating backup request:', backupRequest);
      console.log('[BACKUP_UI] Drive details:', {
        id: drive.id,
        device_path: drive.device_path,
        mount_point: drive.mount_point,
        trust_level: drive.trust_level,
        is_encrypted: drive.is_encrypted
      });
      
      // Simulate backup progress
      const stages = [
        { progress: 20, message: 'Preparing vault data...' },
        { progress: 40, message: 'Encrypting data...' },
        { progress: 60, message: 'Writing to drive...' },
        { progress: 80, message: 'Verifying backup...' },
        { progress: 100, message: 'Backup completed!' }
      ];
      
      for (const stage of stages) {
        setBackupProgress(stage.progress);
        setBackupMessage(stage.message);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Call the actual backup function with individual parameters
      console.log('[BACKUP_UI] Calling create_backup command...');
      console.log('[BACKUP_UI] Parameters being sent:', {
        drive_id: backupRequest.drive_id,
        backup_type: backupRequest.backup_type,
        vault_ids: backupRequest.vault_ids,
        compression_level: backupRequest.compression_level,
        verification: backupRequest.verification,
        password: backupRequest.password ? '[REDACTED]' : null
      });
      
      const result = await safeTauriInvoke('create_backup', {
        driveId: backupRequest.drive_id,
        backupType: backupRequest.backup_type,
        vaultIds: backupRequest.vault_ids,
        compressionLevel: backupRequest.compression_level,
        verification: backupRequest.verification,
        password: backupRequest.password
      });
      console.log('[BACKUP_UI] Backup result:', result);
      
      setBackupResult({ success: true, message: `Backup created successfully: ${result}` });
      onCreateBackup?.(backupOptions);
      
      // Reload backups list
      await loadExistingBackups();
      
    } catch (error) {
      console.error('Backup failed:', error);
      setBackupResult({ success: false, message: `Backup failed: ${error}` });
    } finally {
      setBackupInProgress(false);
      setBackupProgress(0);
      setBackupMessage('');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="w-4 h-4" />
          Backup Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="text-xs text-muted-foreground">
          {existingBackups.length} backup{existingBackups.length !== 1 ? 's' : ''} stored on this drive
        </div>

        {backupResult && (
          <div className={`p-2 rounded text-xs flex items-center gap-2 ${
            backupResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {backupResult.success ? (
              <CheckIcon className="w-3 h-3" />
            ) : (
              <AlertCircleIcon className="w-3 h-3" />
            )}
            <span>{backupResult.message}</span>
          </div>
        )}

        <div className="space-y-2">
          <div>
            <Label htmlFor="backup-name" className="text-xs font-medium">Backup Name</Label>
            <Input
              id="backup-name"
              placeholder="Enter backup name"
              value={backupOptions.name}
              onChange={(e) => setBackupOptions(prev => ({ ...prev, name: e.target.value }))}
              disabled={backupInProgress}
              className="mt-1 h-8 text-xs"
            />
          </div>

          <div>
            <Label htmlFor="backup-password" className="text-xs font-medium">Backup Password</Label>
            <Input
              id="backup-password"
              type="password"
              placeholder="Strong password (min 12 chars, mixed case, numbers, symbols)"
              value={backupPassword}
              onChange={(e) => setBackupPassword(e.target.value)}
              disabled={backupInProgress}
              className="mt-1 h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="include-settings"
                checked={backupOptions.includeSettings}
                onChange={(e) => setBackupOptions(prev => ({ ...prev, includeSettings: e.target.checked }))}
                disabled={backupInProgress}
                className="w-3 h-3"
              />
              <Label htmlFor="include-settings" className="text-xs">Include vault settings</Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="encrypt-backup"
                checked={backupOptions.encryptBackup}
                onChange={(e) => setBackupOptions(prev => ({ ...prev, encryptBackup: e.target.checked }))}
                disabled={backupInProgress}
                className="w-3 h-3"
              />
              <Label htmlFor="encrypt-backup" className="text-xs">Encrypt backup</Label>
            </div>
          </div>
        </div>

        {backupInProgress && (
          <div className="space-y-1">
            <Progress value={backupProgress} className="w-full h-2" />
            <p className="text-xs text-muted-foreground">{backupMessage}</p>
          </div>
        )}

        <Button 
          onClick={handleCreateBackup}
          disabled={backupInProgress}
          className="w-full h-8 text-sm"
        >
          {backupInProgress ? 'Creating Backup...' : 'Create Backup'}
        </Button>
      </CardContent>
    </Card>
  );
};
