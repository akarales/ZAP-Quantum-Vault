import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  HardDrive, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Loader2
} from 'lucide-react';
import { UsbDrive } from '@/types/usb';
import { getInvokeFunction } from '@/services/mockTauriService';

// Type definitions
interface FormatProgress {
  stage: string;
  progress: number;
  message: string;
  isActive: boolean;
}

// Components
const LoadingSpinner = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => (
  <Loader2 className={`animate-spin ${size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'}`} />
);

const EncryptionBadge = ({ isEncrypted }: { isEncrypted: boolean }) => (
  <Badge variant={isEncrypted ? 'default' : 'secondary'} className="flex items-center gap-1">
    {isEncrypted ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
    {isEncrypted ? 'Encrypted' : 'Unencrypted'}
  </Badge>
);

const UsbDriveDetailPage: React.FC = () => {
  const { driveId } = useParams<{ driveId: string }>();
  const navigate = useNavigate();
  
  // State management
  const [drive, setDrive] = useState<UsbDrive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [operationInProgress, setOperationInProgress] = useState(false);
  const [invoke, setInvoke] = useState<any>(null);
  
  // User info state
  const [userInfo, setUserInfo] = useState<any>(null);
  
  // Format and encryption states
  const [showFormatSection, setShowFormatSection] = useState(false);
  const [formatOptions, setFormatOptions] = useState({
    password: '',
    confirm_password: '',
    drive_name: '',
    file_system: 'ext4'
  });
  const [formatProgress, setFormatProgress] = useState<FormatProgress | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Re-encryption states
  const [showReEncryptSection, setShowReEncryptSection] = useState(false);
  const [reEncryptOptions, setReEncryptOptions] = useState({
    current_password: '',
    new_password: '',
    confirm_new_password: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  
  // Dialog states
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [showReEncryptDialog, setShowReEncryptDialog] = useState(false);
  
  // Load user info
  const loadUserInfo = async () => {
    if (!invoke) return;
    try {
      const result = await invoke('get_user_info');
      setUserInfo(result);
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  };
  
  // Load drive data
  const loadDriveData = async () => {
    if (!driveId || !invoke) return;
    
    try {
      console.log('Loading drive data for driveId:', driveId);
      console.log('Calling get_drive_details with parameter:', { drive_id: driveId });
      
      const result = await invoke('get_drive_details', { drive_id: driveId });
      console.log('Drive data loaded successfully:', result);
      setDrive(result as UsbDrive);
    } catch (error) {
      console.error('Failed to load drive data:', error);
      console.log('Error details:', error);
      setError('Failed to load drive information');
    } finally {
      setLoading(false);
    }
  };

  // Initialize invoke function
  useEffect(() => {
    const initInvoke = async () => {
      const invokeFunc = await getInvokeFunction();
      setInvoke(() => invokeFunc);
    };
    initInvoke();
  }, []);

  // Load data when invoke is available
  useEffect(() => {
    if (invoke) {
      loadUserInfo();
      loadDriveData();
    }
  }, [driveId, invoke]);

  // Event listeners for progress updates (disabled for browser compatibility)
  useEffect(() => {
    // Skip event listeners in browser environment
    if (typeof window !== 'undefined' && !(window as any).__TAURI__) {
      return;
    }
    
    // Only setup listeners in Tauri environment
    const setupEventListeners = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const unlistenFormat = await listen('format_progress', (event: any) => {
          console.log('Format progress event received:', event.payload);
          const { stage, progress, message } = event.payload;
          setFormatProgress({
            stage: stage || 'processing',
            progress: progress || 0,
            message: message || 'Processing...',
            isActive: progress < 100
          });
        });

        return () => {
          unlistenFormat();
        };
      } catch (error) {
        console.log('Event listeners not available in browser environment');
      }
    };

    const cleanup = setupEventListeners();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, []);

  const handleMountSuccess = (mountPoint: string) => {
    setSuccess(`Drive mounted successfully at ${mountPoint}`);
    setError('');
    // Optimistic update - immediately update drive state
    if (drive) {
      setDrive(prev => prev ? { ...prev, mount_point: mountPoint } : null);
    }
  };

  const handleMountError = (error: string) => {
    setError(`Mount failed: ${error}`);
    setSuccess('');
  };

  const handleUnmountSuccess = () => {
    setSuccess('Drive unmounted successfully');
    setError('');
    // Optimistic update - immediately update drive state
    if (drive) {
      setDrive(prev => prev ? { ...prev, mount_point: null } : null);
    }
  };

  const handleResetEncryptedDrive = async () => {
    console.log('Starting reset encrypted drive operation');
    if (!drive || !formatOptions.password || formatOptions.password !== formatOptions.confirm_password) {
      setError('Please ensure passwords match and all fields are filled');
      return;
    }

    setOperationInProgress(true);
    setError('');
    setSuccess('');

    try {
      setFormatProgress({
        stage: 'cleanup',
        progress: 0,
        message: 'Cleaning up existing encryption...',
        isActive: true
      });

      console.log('Invoking format_and_encrypt_drive command for reset');
      if (!invoke) {
        throw new Error('Invoke function not available');
      }
      const result = await invoke('format_and_encrypt_drive', {
        drive_id: drive.id,
        password: formatOptions.password,
        drive_name: formatOptions.drive_name
      });

      console.log('Reset operation completed:', result);
      setSuccess(result as string);
      
      // Reload drive data to reflect changes
      setTimeout(() => {
        loadDriveData();
      }, 2000);

    } catch (error) {
      console.error('Reset operation failed:', error);
      setError(`Reset operation failed: ${error}`);
    } finally {
      setOperationInProgress(false);
      setTimeout(() => {
        setFormatProgress(null);
      }, 3000);
    }
  };

  const handleFormatDrive = async () => {
    console.log('Starting format drive operation');
    if (!drive || !formatOptions.password || formatOptions.password !== formatOptions.confirm_password) {
      setError('Please ensure passwords match and all fields are filled');
      return;
    }

    setOperationInProgress(true);
    setError('');
    setSuccess('');

    try {
      setFormatProgress({
        stage: 'starting',
        progress: 0,
        message: 'Initializing encryption process...',
        isActive: true
      });

      console.log('Invoking format_and_encrypt_drive command');
      if (!invoke) {
        throw new Error('Invoke function not available');
      }
      const result = await invoke('format_and_encrypt_drive', {
        drive_id: drive.id,
        password: formatOptions.password,
        drive_name: formatOptions.drive_name
      });

      console.log('Format operation completed:', result);
      setSuccess(result as string);
      
      // Reload drive data to reflect changes
      setTimeout(() => {
        loadDriveData();
      }, 2000);

    } catch (error) {
      console.error('Format operation failed:', error);
      setError(`Format operation failed: ${error}`);
    } finally {
      setOperationInProgress(false);
      setTimeout(() => {
        setFormatProgress(prev => prev ? {
          ...prev,
          isActive: false
        } : null);
      }, 1000);
    }
  };

  const validatePassword = (password: string) => {
    const hasLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const score = [hasLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    
    if (score < 3) return { strength: 'weak', feedback: 'Password is too weak' };
    if (score < 4) return { strength: 'medium', feedback: 'Password strength: Medium' };
    return { strength: 'strong', feedback: 'Password strength: Strong' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!drive) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Drive Not Found</h2>
              <p className="text-muted-foreground mb-4">The requested USB drive could not be found.</p>
              <Button onClick={() => navigate('/cold-storage')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Drives
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-8 space-y-6 bg-background min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/cold-storage')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <HardDrive className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">{drive.id}</h1>
                <p className="text-muted-foreground">{drive.label || 'Unlabeled'}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Connected
            </Badge>
            <EncryptionBadge isEncrypted={drive.is_encrypted || false} />
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <Alert className="border-green-500/20 bg-green-500/10">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="border-destructive/20 bg-destructive/10">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Drive Information */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Drive Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Capacity</Label>
                <p className="text-lg font-medium">{drive.capacity}</p>
              </div>
              <div>
                <Label>Available Space</Label>
                <p className="text-lg font-medium">{drive.available_space}</p>
              </div>
              <div>
                <Label>Filesystem</Label>
                <p className="text-lg font-medium">{drive.filesystem}</p>
              </div>
              <div>
                <Label>Mount Point</Label>
                <p className="text-lg font-medium">
                  {drive.mount_point || 'Not mounted'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-sm text-muted-foreground">
                    {drive.mount_point ? 'Mounted and ready' : 'Not mounted'}
                  </p>
                </div>
                <MountButton
                  drive={drive}
                  userId={currentUserId || undefined}
                  onMountSuccess={handleMountSuccess}
                  onMountError={handleMountError}
                  onUnmountSuccess={handleUnmountSuccess}
                />
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Trust Level</p>
                    <p className="text-sm text-muted-foreground">Current trust level: Untrusted</p>
                  </div>
                  <Button variant="outline" onClick={() => setShowTrustDialog(true)}>
                    Manage Trust
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Encryption</p>
                    <p className="text-sm text-muted-foreground">
                      {drive.filesystem === 'LUKS Encrypted' || drive.filesystem === 'crypto_LUKS' 
                        ? 'Drive is encrypted with LUKS2' 
                        : 'Drive is not encrypted'}
                    </p>
                  </div>
                </div>
                
{/* Show different alert messages based on drive encryption status */}
                {drive.filesystem === 'LUKS Encrypted' || drive.filesystem === 'crypto_LUKS' ? (
                  <Alert className="border-orange-500/20 bg-orange-500/10">
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <AlertDescription className="text-orange-800 dark:text-orange-200">
                      This drive is already encrypted. Using this option will completely wipe the existing encryption 
                      and all data, then create a new encrypted container with the settings below.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-blue-500/20 bg-blue-500/10">
                    <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                      This will format the drive and encrypt it with LUKS2 encryption. All existing data will be permanently lost.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="drive_name">Drive Name</Label>
                    <Input
                      id="drive_name"
                      value={formatOptions.drive_name}
                      onChange={(e) => setFormatOptions(prev => ({
                        ...prev,
                        drive_name: e.target.value
                      }))}
                      placeholder="ZAP_Quantum_Vault"
                      className=""
                    />
                  </div>
                  <div>
                    <Label htmlFor="encryption_type">Encryption Type</Label>
                    <Select
                      value={formatOptions.encryption_type}
                      onValueChange={(value) => setFormatOptions(prev => ({
                        ...prev,
                        encryption_type: value
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic_luks2">Basic LUKS2 (Available)</SelectItem>
                        <SelectItem value="quantum_luks2" disabled>Quantum LUKS2 (Coming Soon)</SelectItem>
                        <SelectItem value="post_quantum_aes" disabled>Post-Quantum AES-256 (Coming Soon)</SelectItem>
                        <SelectItem value="hybrid_classical_quantum" disabled>Hybrid Classical+Quantum (Coming Soon)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Password Input Section */}
                  <div className="space-y-4 p-4 bg-card rounded-lg border">
                    <h4 className="font-medium text-sm">Encryption Password</h4>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={formatOptions.password}
                          onChange={(e) => setFormatOptions(prev => ({
                            ...prev,
                            password: e.target.value
                          }))}
                          placeholder="Enter strong quantum-resistant password"
                          className="pr-10 bg-white dark:bg-gray-700"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {validatePassword(formatOptions.password).feedback}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="confirm_password">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm_password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={formatOptions.confirm_password}
                          onChange={(e) => setFormatOptions(prev => ({
                            ...prev,
                            confirm_password: e.target.value
                          }))}
                          placeholder="Confirm password"
                          className="pr-10 bg-white dark:bg-gray-700"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Password Generator Section */}
                  <div className="p-4 bg-card rounded-lg border">
                    <PasswordGeneratorCompact
                      onPasswordGenerated={(password) => {
                        setFormatOptions(prev => ({
                          ...prev,
                          password: password,
                          confirm_password: password
                        }));
                      }}
                    />
                  </div>
                </div>

                {formatProgress?.isActive && (
                  <div className="space-y-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{formatProgress.stage}</span>
                      <span>{formatProgress.progress}%</span>
                    </div>
                    <Progress value={formatProgress.progress} className="w-full" />
                    <p className="text-sm text-muted-foreground">{formatProgress.message}</p>
                  </div>
                )}

                <div className="flex justify-end space-x-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormatProgress(null);
                    }}
                    disabled={formatProgress?.isActive}
                  >
                    Reset
                  </Button>
                  
                  {/* Show different buttons based on drive encryption status */}
                  {drive.filesystem === 'LUKS Encrypted' || drive.filesystem === 'crypto_LUKS' ? (
                    <Button
                      onClick={handleResetEncryptedDrive}
                      disabled={
                        operationInProgress ||
                        !formatOptions.password ||
                        formatOptions.password !== formatOptions.confirm_password ||
                        formatProgress?.isActive
                      }
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      {formatProgress?.isActive ? 'Resetting...' : 'Reset & Re-encrypt Drive'}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleFormatDrive}
                      disabled={
                        operationInProgress ||
                        !formatOptions.password ||
                        formatOptions.password !== formatOptions.confirm_password ||
                        formatProgress?.isActive
                      }
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                      {formatProgress?.isActive ? 'Encrypting...' : 'Format & Encrypt Drive'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Backup Management */}
            <Card>
              <CardHeader>
                <CardTitle>Backup Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Vault Backups</p>
                    <p className="text-sm text-muted-foreground">
                      {drive.backup_count || 0} backups stored on this drive
                    </p>
                  </div>
                  <Button onClick={() => setShowBackupDialog(true)}>
                    <Download className="w-4 h-4 mr-2" />
                    Create Backup
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Backup Dialog */}
        <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Backup</DialogTitle>
              <DialogDescription>
                Create a quantum-safe backup of your vault data to this USB drive.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBackupDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowBackupDialog(false)}>
                Create Backup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Trust Dialog */}
        <Dialog open={showTrustDialog} onOpenChange={setShowTrustDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage Trust Level</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTrustDialog(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
};

export default UsbDriveDetailPage;
