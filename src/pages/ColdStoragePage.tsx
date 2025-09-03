import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MountButton } from '../components/mount/MountButton';
import { setDriveTrust } from '../utils/tauri-api';
import { 
  HardDrive, 
  Usb, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  LogOut,
  Download,
  Archive
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
  trust_level: 'trusted' | 'untrusted' | 'blocked';
  last_backup?: string;
  backup_count: number;
  health_status: string;
  temperature?: number;
  write_cycles?: number;
}


export const ColdStoragePage = () => {
  const navigate = useNavigate();
  const [usbDrives, setUsbDrives] = useState<UsbDrive[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [activeTab, setActiveTab] = useState('drives');
  

  // Load cached drives on component mount, but no automatic scanning
  useEffect(() => {
    detectDrives();
  }, []);

  const detectDrives = async () => {
    setRefreshing(true);
    setError('');
    try {
      // Use cached drives for initial load
      const drives = await invoke<UsbDrive[]>('detect_usb_drives');
      setUsbDrives(drives);
    } catch (err) {
      setError(`Failed to detect USB drives: ${err}`);
    } finally {
      setRefreshing(false);
    }
  };

  const refreshDrives = async () => {
    setRefreshing(true);
    setError('');
    try {
      // Force refresh from hardware
      const drives = await invoke<UsbDrive[]>('refresh_usb_drives');
      setUsbDrives(drives);
      setSuccess('USB drives refreshed successfully');
    } catch (err) {
      setError(`Failed to refresh USB drives: ${err}`);
    } finally {
      setRefreshing(false);
    }
  };


  const handleSetTrust = async (driveId: string, trustLevel: string) => {
    try {
      await setDriveTrust(driveId, trustLevel);
      setUsbDrives(drives => 
        drives.map(drive => 
          drive.id === driveId 
            ? { ...drive, trust_level: trustLevel as 'trusted' | 'untrusted' | 'blocked' }
            : drive
        )
      );
      setSuccess(`Drive trust level updated to ${trustLevel}`);
    } catch (err) {
      setError(`Failed to update trust level: ${err}`);
    }
  };

  const handleMountSuccess = (message: string) => {
    setSuccess(message);
    detectDrives();
  };

  const handleMountError = (error: string) => {
    setError(error);
  };

  const handleEjectDrive = async (driveId: string) => {
    try {
      await invoke('eject_drive', { driveId });
      setUsbDrives(drives => drives.filter(drive => drive.id !== driveId));
      setSuccess('Drive ejected safely');
    } catch (err) {
      setError(`Failed to eject drive: ${err}`);
    }
  };

  const handleRecoverFromPhrase = async () => {
    if (!recoveryPhrase.trim()) {
      setError('Please enter a recovery phrase');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await invoke('recover_from_phrase', { phrase: recoveryPhrase });
      setSuccess('Recovery completed successfully');
      setRecoveryPhrase('');
    } catch (err) {
      setError(`Recovery failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyExport = async () => {
    setLoading(true);
    setError('');
    
    try {
      const exportPath = await invoke<string>('emergency_backup_export');
      setSuccess(`Emergency backup exported to: ${exportPath}`);
    } catch (err) {
      setError(`Export failed: ${err}`);
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
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="h-6 w-6" />
            Cold Storage
          </h1>
          <p className="text-muted-foreground text-sm">
            Air-gapped backup and recovery using encrypted USB drives
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={detectDrives} disabled={refreshing} variant="outline">
            <Usb className={`h-4 w-4 mr-2`} />
            Load Drives
          </Button>
          <Button onClick={refreshDrives} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Scanning...' : 'Refresh'}
          </Button>
        </div>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="drives">Drive Management</TabsTrigger>
          <TabsTrigger value="recovery">Recovery Options</TabsTrigger>
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
                <div className="flex gap-2 justify-center">
                  <Button onClick={detectDrives} variant="outline">
                    <Usb className="h-4 w-4 mr-2" />
                    Load Drives
                  </Button>
                  <Button onClick={refreshDrives}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Scan Hardware
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {usbDrives.map((drive) => (
                <Card 
                  key={drive.id} 
                  className="cursor-pointer transition-all hover:shadow-md"
                  onClick={() => navigate(`/cold-storage/drive/${encodeURIComponent(drive.id)}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Usb className="h-4 w-4" />
                        {drive.label || 'USB Drive'}
                      </CardTitle>
                      <Badge variant={getTrustBadgeVariant(drive.trust_level)} className="text-xs">
                        {getTrustIcon(drive.trust_level)}
                        <span className="ml-1">{drive.trust_level}</span>
                      </Badge>
                    </div>
                    <CardDescription className="text-xs truncate">
                      {drive.device_path}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Size:</span>
                          <span className="font-medium">{formatBytes(drive.capacity)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Free:</span>
                          <span className="font-medium">{formatBytes(drive.available_space)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Encrypted:</span>
                          <div className="flex items-center gap-1">
                            {drive.is_encrypted ? (
                              <Lock className="h-3 w-3 text-green-500" />
                            ) : (
                              <Unlock className="h-3 w-3 text-red-500" />
                            )}
                            <span className={`text-xs ${drive.is_encrypted ? 'text-green-500' : 'text-red-500'}`}>
                              {drive.is_encrypted ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Backups:</span>
                          <span className="font-medium">{drive.backup_count}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 pt-2">
                        <Select
                          value={drive.trust_level.toLowerCase()}
                          onValueChange={(value: string) => handleSetTrust(drive.id, value)}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trusted">Trusted</SelectItem>
                            <SelectItem value="untrusted">Untrusted</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <MountButton
                          drive={drive}
                          userId="admin"
                          onMountSuccess={(mountPoint) => {
                            handleMountSuccess(`Drive mounted at ${mountPoint}`);
                          }}
                          onMountError={handleMountError}
                          onUnmountSuccess={() => {
                            handleMountSuccess('Drive unmounted successfully');
                          }}
                        />
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEjectDrive(drive.id);
                          }}
                          title="Eject Drive"
                        >
                          <LogOut className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

        </TabsContent>

        <TabsContent value="recovery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recovery Options</CardTitle>
              <CardDescription>
                Recover your vault using backup methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Recovery Phrase</Label>
                <Textarea
                  placeholder="Enter your 24-word recovery phrase..."
                  rows={3}
                  className="font-mono text-sm"
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                />
              </div>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleRecoverFromPhrase}
                disabled={loading}
              >
                <Download className="h-4 w-4 mr-2" />
                Recover from Phrase
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleEmergencyExport}
                disabled={loading}
              >
                <Archive className="h-4 w-4 mr-2" />
                Emergency Backup Export
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
};
