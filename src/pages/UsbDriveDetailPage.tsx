import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, XCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { MountButton } from '../components/mount/MountButton';
import { safeTauriInvoke } from '../utils/tauri-api';

// Custom hooks
import { useDriveData } from '../hooks/useDriveData';
import { useFormatOperations } from '../hooks/useFormatOperations';

// Components
import { DriveInfo } from '../components/drive/DriveInfo';
import { SecuritySettings } from '../components/drive/SecuritySettings';
import { FormatSection } from '../components/drive/FormatSection';
import { BackupManagement } from '../components/drive/BackupManagement';

const UsbDriveDetailPage: React.FC = () => {
  const { driveId } = useParams<{ driveId: string }>();
  const navigate = useNavigate();

  // UI state - removed hidden sections for better UX

  // Custom hooks for data and operations
  const { drive, loading, error, success, setError, setSuccess, refreshDrive } = useDriveData(driveId);
  
  const {
    formatOptions,
    setFormatOptions,
    formatProgress,
    operationInProgress,
    handleFormatDrive
  } = useFormatOperations(driveId, setSuccess, setError, refreshDrive);

  // Event handlers
  const handleTrustChange = async (level: 'untrusted' | 'partial' | 'full') => {
    if (!driveId) return;
    
    try {
      // Map frontend trust levels to backend expected values
      const backendTrustLevel = level === 'full' ? 'trusted' : 
                               level === 'partial' ? 'untrusted' :
                               'blocked';
      
      console.log('[UsbDriveDetailPage] Setting trust level:', { level, backendTrustLevel, driveId });
      
      await safeTauriInvoke('set_drive_trust', {
        driveId: driveId,
        trustLevel: backendTrustLevel
      });
      
      console.log('[UsbDriveDetailPage] Trust level set successfully, refreshing drive data...');
      setSuccess(`Trust level set to ${level}`);
      
      // Force refresh the drive data
      await refreshDrive();
      
      console.log('[UsbDriveDetailPage] Drive data refreshed');
    } catch (error) {
      console.error('Failed to set trust level:', error);
      setError(`Failed to set trust level: ${error}`);
    }
  };

  const handleBackupCreate = (options: { name: string; includeSettings: boolean; encryptBackup: boolean }) => {
    setSuccess(`Backup created: ${options.name || 'Unnamed backup'}`);
  };


  // Loading state
  if (loading) {
    return (
      <ErrorBoundary>
        <div className="h-screen flex items-center justify-center bg-background">
          <Loader2 className="animate-spin w-6 h-6" />
        </div>
      </ErrorBoundary>
    );
  }

  // Error state
  if (!drive) {
    return (
      <ErrorBoundary>
        <div className="h-screen flex flex-col bg-background">
          <div className="flex-shrink-0 border-b bg-card px-3 py-2">
            <Button variant="ghost" onClick={() => navigate('/drives')} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Drives
            </Button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <Alert className="max-w-md">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {error || 'Drive not found or could not be loaded.'}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-background">
        {/* Fixed Header */}
        <div className="flex-shrink-0 border-b bg-card px-3 py-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate('/drives')} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Drives
            </Button>
            <MountButton 
              drive={drive} 
              userId="admin"
              onMountSuccess={(mountPoint) => {
                setSuccess(`Drive mounted at: ${mountPoint}`);
                refreshDrive();
              }}
              onMountError={(error) => {
                setError(error);
              }}
              onUnmountSuccess={() => {
                setSuccess('Drive unmounted successfully');
                refreshDrive();
              }}
            />
          </div>

          {/* Status Messages - Compact */}
          {error && (
            <Alert className="mt-1 py-1">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mt-1 py-1">
              <AlertDescription className="text-sm">{success}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-3 space-y-3">
            {/* Top Row - Drive Info and Security */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <DriveInfo drive={drive} userId="admin" />
              <SecuritySettings
                drive={drive}
                onSetTrust={handleTrustChange}
              />
            </div>

            {/* Bottom Row - Format and Backup */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <FormatSection
                drive={drive}
                formatOptions={formatOptions}
                setFormatOptions={setFormatOptions}
                formatProgress={formatProgress || undefined}
                operationInProgress={operationInProgress}
                onFormatDrive={handleFormatDrive}
              />
              <BackupManagement
                drive={drive}
                onCreateBackup={handleBackupCreate}
              />
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default UsbDriveDetailPage;
