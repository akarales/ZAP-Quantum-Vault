import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvokeFunction } from '../services/mockTauriService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MountButton } from '../components/mount/MountButton';
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
  const [invoke, setInvoke] = useState<any>(null);

  useEffect(() => {
    getInvokeFunction().then(invokeFunc => {
      setInvoke(() => invokeFunc);
    });
  }, []);

  useEffect(() => {
    if (invoke) {
      detectDrives();
    }
  }, [invoke]);

  const detectDrives = async () => {
    if (!invoke) return;
    
    setRefreshing(true);
    setError('');
    try {
      const drives = await invoke('detect_usb_drives');
      setUsbDrives(drives);
    } catch (err) {
      setError(`Failed to detect USB drives: ${err}`);
    } finally {
      setRefreshing(false);
    }
  };


  const handleSetTrust = async (driveId: string, trustLevel: string) => {
    if (!invoke) return;
    
    try {
      await invoke('set_drive_trust', { drive_id: driveId, trust_level: trustLevel });
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
    if (!invoke) return;
    
    try {
      await invoke('eject_drive', { drive_id: driveId });
      setUsbDrives(drives => drives.filter(drive => drive.id !== driveId));
      setSuccess('Drive ejected safely');
    } catch (err) {
      setError(`Failed to eject drive: ${err}`);
    }
  };

  const handleRecoverFromPhrase = async () => {
    if (!invoke) return;
    
    if (!recoveryPhrase.trim()) {
      setError('Please enter a recovery phrase');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const recoveredData = await invoke('recover_from_phrase', {
        phrase: recoveryPhrase.trim()
      });
      setSuccess(`Recovery successful! Recovered ${recoveredData.length} bytes of data`);
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
                  className="cursor-pointer transition-all hover:shadow-md"
                  onClick={() => {
                    console.log('Navigating to drive:', drive.id);
                    navigate(`/cold-storage/drive/${encodeURIComponent(drive.id)}`);
                  }}
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
                        <span>Encrypted:</span>
                        <div className="flex items-center gap-1">
                          {drive.is_encrypted ? (
                            <Lock className="h-3 w-3 text-green-500" />
                          ) : (
                            <Unlock className="h-3 w-3 text-red-500" />
                          )}
                          <span className={drive.is_encrypted ? 'text-green-500' : 'text-red-500'}>
                            {drive.is_encrypted ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Mount Point:</span>
                        <span className="font-medium text-xs">
                          {drive.mount_point ? drive.mount_point : 'Not mounted'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Backups:</span>
                        <span className="font-medium">{drive.backup_count}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-2">
                        <Select
                          value={drive.trust_level.toLowerCase()}
                          onValueChange={(value) => {
                            // Prevent event bubbling to card click
                            handleSetTrust(drive.id, value);
                          }}
                        >
                          <SelectTrigger 
                            className="flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trusted">Trusted</SelectItem>
                            <SelectItem value="untrusted">Untrusted</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <div onClick={(e) => e.stopPropagation()}>
                          <MountButton
                            drive={drive}
                            onMountSuccess={(mountPoint) => handleMountSuccess(`Drive mounted at ${mountPoint}`)}
                            onMountError={handleMountError}
                            onUnmountSuccess={() => {
                              handleMountSuccess('Drive unmounted successfully');
                              detectDrives();
                            }}
                          />
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEjectDrive(drive.id);
                          }}
                          title="Eject Drive"
                        >
                          <LogOut className="h-4 w-4" />
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
