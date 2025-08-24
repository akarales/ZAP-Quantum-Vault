import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  HardDrive, 
  Usb, 
  Shield, 
  Download, 
  Upload, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Lock, 
  Unlock,
  Key,
  Archive,
  Clock,
  Database,
  Eject
} from 'lucide-react';

interface UsbDrive {
  id: string;
  device_path: string;
  mount_point?: string;
  capacity: number;
  available_space: number;
  filesystem: string;
  is_encrypted: boolean;
  label?: string;
  is_removable: boolean;
  trust_level: 'Trusted' | 'Untrusted' | 'Blocked';
  last_seen: string;
}

interface BackupMetadata {
  id: string;
  drive_id: string;
  backup_type: 'Full' | 'Incremental' | 'Selective';
  backup_path: string;
  vault_ids: string[];
  created_at: string;
  size_bytes: number;
  checksum: string;
  encryption_method: string;
  item_count: number;
  vault_count: number;
}

interface BackupRequest {
  drive_id: string;
  backup_type: 'Full' | 'Incremental' | 'Selective';
  vault_ids?: string[];
  compression: boolean;
  verification: boolean;
  password?: string;
}

export default function ColdStoragePage() {
  const [usbDrives, setUsbDrives] = useState<UsbDrive[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<UsbDrive | null>(null);
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Dialog states
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  
  // Operation states
  const [backupProgress, setBackupProgress] = useState(0);
  const [operationInProgress, setOperationInProgress] = useState(false);
  
  // Form states
  const [formatOptions, setFormatOptions] = useState({
    encryption_type: 'luks',
    password: '',
    confirm_password: ''
  });
  
  const [backupOptions, setBackupOptions] = useState<BackupRequest>({
    drive_id: '',
    backup_type: 'Full',
    vault_ids: [],
    compression: true,
    verification: true,
    password: ''
  });

  const [recoveryPhrase, setRecoveryPhrase] = useState('');

  useEffect(() => {
    detectDrives();
  }, []);

  useEffect(() => {
    if (selectedDrive) {
      loadBackups(selectedDrive.id);
    }
  }, [selectedDrive]);

  const detectDrives = async () => {
    setRefreshing(true);
    setError('');
    
    try {
      const drives = await invoke<UsbDrive[]>('detect_usb_drives');
      setUsbDrives(drives);
      
      // If we had a selected drive, try to find it in the new list
      if (selectedDrive) {
        const updatedDrive = drives.find(d => d.id === selectedDrive.id);
        setSelectedDrive(updatedDrive || null);
      }
    } catch (err) {
      setError(`Failed to detect USB drives: ${err}`);
    } finally {
      setRefreshing(false);
    }
  };

  const loadBackups = async (driveId: string) => {
    setLoading(true);
    setError('');
    
    try {
      const driveBackups = await invoke<BackupMetadata[]>('list_backups', { driveId });
      setBackups(driveBackups);
    } catch (err) {
      setError(`Failed to load backups: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetTrust = async (driveId: string, trustLevel: string) => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await invoke('set_drive_trust', { driveId, trustLevel });
      setSuccess(`Drive trust level set to ${trustLevel}`);
      await detectDrives();
    } catch (err) {
      setError(`Failed to set trust level: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFormatDrive = async () => {
    if (formatOptions.password !== formatOptions.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    
    if (!selectedDrive) return;
    
    setOperationInProgress(true);
    setError('');
    setSuccess('');
    
    try {
      await invoke('format_drive', {
        driveId: selectedDrive.id,
        encryptionType: formatOptions.encryption_type,
        password: formatOptions.password
      });
      
      setSuccess('Drive formatted and encrypted successfully');
      setShowFormatDialog(false);
      setFormatOptions({ encryption_type: 'luks', password: '', confirm_password: '' });
      await detectDrives();
    } catch (err) {
      setError(`Failed to format drive: ${err}`);
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!selectedDrive) return;
    
    setOperationInProgress(true);
    setError('');
    setSuccess('');
    setBackupProgress(0);
    
    try {
      const request = {
        ...backupOptions,
        drive_id: selectedDrive.id
      };
      
      // Simulate progress (in real implementation, this would come from the backend)
      const progressInterval = setInterval(() => {
        setBackupProgress(prev => Math.min(prev + 10, 90));
      }, 500);
      
      await invoke('create_backup', { request });
      
      clearInterval(progressInterval);
      setBackupProgress(100);
      
      setSuccess('Backup created successfully');
      setShowBackupDialog(false);
      await loadBackups(selectedDrive.id);
    } catch (err) {
      setError(`Failed to create backup: ${err}`);
    } finally {
      setOperationInProgress(false);
      setBackupProgress(0);
    }
  };

  const handleEjectDrive = async (driveId: string) => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await invoke('eject_drive', { driveId });
      setSuccess('Drive ejected safely');
      await detectDrives();
      
      if (selectedDrive?.id === driveId) {
        setSelectedDrive(null);
        setBackups([]);
      }
    } catch (err) {
      setError(`Failed to eject drive: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRecoveryPhrase = async () => {
    setLoading(true);
    setError('');
    
    try {
      const phrase = await invoke<string>('generate_recovery_phrase');
      setRecoveryPhrase(phrase);
    } catch (err) {
      setError(`Failed to generate recovery phrase: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTrustBadgeVariant = (trustLevel: string) => {
    switch (trustLevel) {
      case 'Trusted': return 'default';
      case 'Untrusted': return 'secondary';
      case 'Blocked': return 'destructive';
      default: return 'secondary';
    }
  };

  const getTrustIcon = (trustLevel: string) => {
    switch (trustLevel) {
      case 'Trusted': return <CheckCircle className="h-3 w-3" />;
      case 'Untrusted': return <AlertTriangle className="h-3 w-3" />;
      case 'Blocked': return <Trash2 className="h-3 w-3" />;
      default: return <AlertTriangle className="h-3 w-3" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HardDrive className="h-8 w-8" />
            Cold Storage
          </h1>
          <p className="text-muted-foreground mt-1">
            Air-gapped backup and recovery using encrypted USB drives
          </p>
        </div>
        
        <Button onClick={detectDrives} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Detecting...' : 'Refresh Drives'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="drives" className="w-full">
        <TabsList>
          <TabsTrigger value="drives">USB Drives ({usbDrives.length})</TabsTrigger>
          {selectedDrive && (
            <TabsTrigger value="backups">
              {selectedDrive.label || 'Drive'} Backups ({backups.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="recovery">Recovery Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="drives" className="space-y-4">
          {usbDrives.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Usb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No USB drives detected</h3>
                <p className="text-muted-foreground mb-4">
                  Connect a USB drive to create encrypted backups of your vaults.
                </p>
                <Button onClick={detectDrives}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Scan for Drives
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {usbDrives.map((drive) => (
                <Card 
                  key={drive.id} 
                  className={`cursor-pointer transition-all ${
                    selectedDrive?.id === drive.id ? 'ring-2 ring-primary' : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedDrive(drive)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Usb className="h-4 w-4" />
                          {drive.label || 'USB Drive'}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {drive.device_path}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant={getTrustBadgeVariant(drive.trust_level)}>
                          {getTrustIcon(drive.trust_level)}
                          <span className="ml-1">{drive.trust_level}</span>
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Capacity:</span>
                        <span className="font-medium">{formatBytes(drive.capacity)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Available:</span>
                        <span className="font-medium">{formatBytes(drive.available_space)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Filesystem:</span>
                        <span className="font-medium">{drive.filesystem}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Encryption:</span>
                        <div className="flex items-center gap-1">
                          {drive.is_encrypted ? (
                            <Lock className="h-3 w-3 text-green-600" />
                          ) : (
                            <Unlock className="h-3 w-3 text-orange-600" />
                          )}
                          <span className="font-medium">
                            {drive.is_encrypted ? 'Encrypted' : 'Not Encrypted'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-4">
                        <Select
                          value={drive.trust_level.toLowerCase()}
                          onValueChange={(value) => handleSetTrust(drive.id, value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trusted">Trusted</SelectItem>
                            <SelectItem value="untrusted">Untrusted</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEjectDrive(drive.id);
                          }}
                        >
                          <Eject className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {selectedDrive && (
          <TabsContent value="backups" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {selectedDrive.label || 'USB Drive'} Backups
                </h2>
                <p className="text-muted-foreground">
                  Manage backups on {selectedDrive.device_path}
                </p>
              </div>
              
              <div className="flex gap-2">
                <Dialog open={showFormatDialog} onOpenChange={setShowFormatDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Shield className="h-4 w-4 mr-2" />
                      Format & Encrypt
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Format and Encrypt Drive</DialogTitle>
                      <DialogDescription>
                        This will erase all data on the drive and set up encryption.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div>
                        <Label>Encryption Type</Label>
                        <Select
                          value={formatOptions.encryption_type}
                          onValueChange={(value) => setFormatOptions(prev => ({ ...prev, encryption_type: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="luks">LUKS (Linux)</SelectItem>
                            <SelectItem value="veracrypt">VeraCrypt</SelectItem>
                            <SelectItem value="zap_native">ZAP Native</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Encryption Password</Label>
                        <Input
                          type="password"
                          value={formatOptions.password}
                          onChange={(e) => setFormatOptions(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="Enter strong password"
                        />
                      </div>
                      
                      <div>
                        <Label>Confirm Password</Label>
                        <Input
                          type="password"
                          value={formatOptions.confirm_password}
                          onChange={(e) => setFormatOptions(prev => ({ ...prev, confirm_password: e.target.value }))}
                          placeholder="Confirm password"
                        />
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowFormatDialog(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleFormatDrive} 
                        disabled={operationInProgress || !formatOptions.password}
                        variant="destructive"
                      >
                        {operationInProgress ? 'Formatting...' : 'Format Drive'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
                  <DialogTrigger asChild>
                    <Button disabled={selectedDrive.trust_level !== 'Trusted'}>
                      <Upload className="h-4 w-4 mr-2" />
                      Create Backup
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Backup</DialogTitle>
                      <DialogDescription>
                        Create an encrypted backup of your vaults.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div>
                        <Label>Backup Type</Label>
                        <Select
                          value={backupOptions.backup_type}
                          onValueChange={(value: 'Full' | 'Incremental' | 'Selective') => 
                            setBackupOptions(prev => ({ ...prev, backup_type: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Full">Full Backup</SelectItem>
                            <SelectItem value="Incremental">Incremental</SelectItem>
                            <SelectItem value="Selective">Selective</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="compression"
                          checked={backupOptions.compression}
                          onChange={(e) => setBackupOptions(prev => ({ ...prev, compression: e.target.checked }))}
                        />
                        <Label htmlFor="compression">Enable compression</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="verification"
                          checked={backupOptions.verification}
                          onChange={(e) => setBackupOptions(prev => ({ ...prev, verification: e.target.checked }))}
                        />
                        <Label htmlFor="verification">Verify backup integrity</Label>
                      </div>
                      
                      {operationInProgress && (
                        <div className="space-y-2">
                          <Label>Backup Progress</Label>
                          <Progress value={backupProgress} />
                          <p className="text-sm text-muted-foreground">{backupProgress}% complete</p>
                        </div>
                      )}
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowBackupDialog(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreateBackup} 
                        disabled={operationInProgress}
                      >
                        {operationInProgress ? 'Creating...' : 'Create Backup'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {backups.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No backups found</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first backup to secure your vault data.
                  </p>
                  {selectedDrive.trust_level === 'Trusted' ? (
                    <Button onClick={() => setShowBackupDialog(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Create First Backup
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Set drive trust level to "Trusted" to create backups.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {backups.map((backup) => (
                  <Card key={backup.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            <Archive className="h-4 w-4" />
                            {backup.backup_type} Backup
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {formatDate(backup.created_at)}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">{backup.encryption_method}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Size:</span>
                          <p className="font-medium">{formatBytes(backup.size_bytes)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Vaults:</span>
                          <p className="font-medium">{backup.vault_count}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Items:</span>
                          <p className="font-medium">{backup.item_count}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Checksum:</span>
                          <p className="font-mono text-xs">{backup.checksum.slice(0, 8)}...</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Restore
                        </Button>
                        <Button variant="outline" size="sm">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Verify
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="recovery" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Recovery Phrase Generator
                </CardTitle>
                <CardDescription>
                  Generate BIP39 recovery phrases for key backup
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleGenerateRecoveryPhrase} disabled={loading}>
                  <Key className="h-4 w-4 mr-2" />
                  Generate Recovery Phrase
                </Button>
                
                {recoveryPhrase && (
                  <div className="space-y-2">
                    <Label>Recovery Phrase (Store Safely)</Label>
                    <Textarea
                      value={recoveryPhrase}
                      readOnly
                      rows={4}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Write this phrase down and store it in a secure location. 
                      It can be used to recover your encryption keys.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  System Recovery
                </CardTitle>
                <CardDescription>
                  Emergency recovery and system restoration tools
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Recovery Phrase</Label>
                  <Textarea
                    placeholder="Enter your 24-word recovery phrase..."
                    rows={3}
                    className="font-mono text-sm"
                  />
                </div>
                
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Recover from Phrase
                </Button>
                
                <Button variant="outline" className="w-full">
                  <Archive className="h-4 w-4 mr-2" />
                  Emergency Backup Export
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
