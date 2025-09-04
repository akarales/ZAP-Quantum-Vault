import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Eye, EyeOff, Copy, Trash2, AlertTriangle, Plus, RefreshCw, CheckCircle, Zap, Shield, Key, Wallet, Activity, QrCode, Download, Shuffle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ZAPKey {
  id: string;
  vaultId: string;
  network: string;
  address: string;
  encryptedPrivateKey: string;
  publicKey: string;
  derivationPath?: string;
  quantumEnhanced: boolean;
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

interface KeyGenerationForm {
  network: string;
  password: string;
  description: string;
  vaultId: string;
}

interface ZAPAddressInfo {
  address: string;
  network: string;
  publicKey: string;
  qrCode?: string;
}

const ZAP_NETWORKS = [
  { name: 'ZAP Mainnet', value: 'mainnet', description: 'ZAP - Production network' },
  { name: 'ZAP Testnet', value: 'testnet', description: 'ZAP - Test network' },
  { name: 'ZAP Devnet', value: 'devnet', description: 'ZAP - Development network' },
];

export function ZAPKeysPage() {
  const navigate = useNavigate();
  const [zapKeys, setZapKeys] = useState<ZAPKey[]>([]);
  const [trashedKeys, setTrashedKeys] = useState<ZAPKey[]>([]);
  const [showTrashedKeys, setShowTrashedKeys] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState<Record<string, boolean>>({});
  const [decryptedPrivateKeys, setDecryptedPrivateKeys] = useState<Record<string, string>>({});
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<{ id: string; address: string } | null>(null);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatedAddress, setGeneratedAddress] = useState<ZAPAddressInfo | null>(null);

  // Key generation form state
  const [keyForm, setKeyForm] = useState<KeyGenerationForm>({
    network: 'mainnet',
    password: '',
    description: '',
    vaultId: '1'
  });

  // Mock current vault ID - replace with actual vault context
  const currentVaultId = '1';

  // Load ZAP keys on component mount
  useEffect(() => {
    loadZAPKeys();
  }, []);

  const loadZAPKeys = async () => {
    try {
      // Mock data - replace with actual Tauri command
      const mockKeys: ZAPKey[] = [];
      setZapKeys(mockKeys);
    } catch (error) {
      console.error('Failed to load ZAP keys:', error);
      setError('Failed to load ZAP keys');
    }
  };

  const handleGenerateKey = async () => {
    if (!keyForm.password) {
      setError('Password is required');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    setGeneratedAddress(null);

    try {
      // Mock key generation - replace with actual Tauri command
      const mockResult: ZAPAddressInfo = {
        address: 'zap1qwertyuiopasdfghjklzxcvbnm1234567890',
        network: keyForm.network,
        publicKey: '0x1234567890abcdef...',
      };
      
      setGeneratedAddress(mockResult);
      setSuccess('ZAP key generated successfully!');
      setKeyForm(prev => ({ ...prev, password: '', description: '' }));
      await loadZAPKeys();
    } catch (error) {
      setError(`Failed to generate key: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setKeyForm(prev => ({ ...prev, password }));
  };

  const selectedNetwork = ZAP_NETWORKS.find(n => n.value === keyForm.network);

  const getNetworkInfo = (network: string) => {
    const networkData = ZAP_NETWORKS.find(n => n.value === network);
    return networkData || ZAP_NETWORKS[0];
  };

  const handleShowPrivateKey = async (keyId: string, password: string) => {
    try {
      // Mock private key decryption - replace with actual Tauri command
      const mockPrivateKey = 'zap_private_key_mock_1234567890abcdef';
      setDecryptedPrivateKeys(prev => ({ ...prev, [keyId]: mockPrivateKey }));
      setShowPrivateKey(prev => ({ ...prev, [keyId]: true }));
    } catch (error) {
      setError(`Failed to decrypt private key: ${error}`);
    }
  };

  const handleHidePrivateKey = (keyId: string) => {
    setShowPrivateKey(prev => ({ ...prev, [keyId]: false }));
    setDecryptedPrivateKeys(prev => {
      const newKeys = { ...prev };
      delete newKeys[keyId];
      return newKeys;
    });
  };

  const handleDeleteKey = (keyId: string, address: string, type: 'soft' | 'hard' = 'soft') => {
    setKeyToDelete({ id: keyId, address });
    setDeleteType(type);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteKey = async () => {
    if (!keyToDelete) return;

    try {
      // Mock key deletion - replace with actual Tauri command
      setSuccess(`Key ${deleteType === 'soft' ? 'moved to trash' : 'permanently deleted'}`);
      await loadZAPKeys();
      setDeleteDialogOpen(false);
      setKeyToDelete(null);
    } catch (error) {
      setError(`Failed to delete key: ${error}`);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Copied to clipboard');
    } catch (error) {
      setError('Failed to copy to clipboard');
    }
  };

  const getNetworkDisplayInfo = (network: string) => {
    const networkData = ZAP_NETWORKS.find(n => n.value === network);
    return networkData || ZAP_NETWORKS[0];
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-7xl space-y-6">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">ZAP Keys</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Air-gapped ZAP wallet with quantum-safe cryptography
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => loadZAPKeys()}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Key Generation Panel - Left Side */}
          <div className="xl:col-span-1 space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Generate New ZAP Key
                </CardTitle>
                <CardDescription>
                  Generate a new quantum-safe key for the ZAP network
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Network Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">ZAP Network</Label>
                  <Select 
                    value={keyForm.network} 
                    onValueChange={(value) => setKeyForm(prev => ({ ...prev, network: value }))}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select ZAP network" />
                    </SelectTrigger>
                    <SelectContent>
                      {ZAP_NETWORKS.map((network) => (
                        <SelectItem key={network.value} value={network.value}>
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-purple-500" />
                            <div>
                              <div className="font-medium">{network.name}</div>
                              <div className="text-xs text-muted-foreground">{network.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Password Input */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Encryption Password</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Enter secure password"
                      value={keyForm.password}
                      onChange={(e) => setKeyForm(prev => ({ ...prev, password: e.target.value }))}
                      className="h-12"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateSecurePassword}
                      className="px-3"
                    >
                      <Shuffle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Description Input */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Description (Optional)</Label>
                  <Input
                    placeholder="Key description or label"
                    value={keyForm.description}
                    onChange={(e) => setKeyForm(prev => ({ ...prev, description: e.target.value }))}
                    className="h-12"
                  />
                </div>

                {/* Quantum Enhancement Info */}
                <div className="bg-muted/50 p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-green-500" />
                    <span className="font-medium text-sm">Quantum-Enhanced Entropy</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Keys are generated using quantum-enhanced random number generation for maximum security.
                  </p>
                </div>

                {/* Generate Button */}
                <Button 
                  onClick={handleGenerateKey} 
                  disabled={loading || !keyForm.password}
                  className="w-full h-12"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Generate ZAP Key
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Generated Address Display */}
            {generatedAddress && (
              <Card className="shadow-lg border-green-200 bg-green-50/50">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    Key Generated Successfully
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">ZAP Address</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={generatedAddress.address}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(generatedAddress.address)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Network</Label>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">{getNetworkInfo(generatedAddress.network).name}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <QrCode className="h-4 w-4 mr-2" />
                      QR Code
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Download className="h-4 w-4 mr-2" />
                      Backup
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Statistics and Key Management - Right Side */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Statistics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="text-center">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-purple-600">{zapKeys.length}</div>
                  <div className="text-sm text-muted-foreground">Total Keys</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">{zapKeys.filter(k => k.quantumEnhanced).length}</div>
                  <div className="text-sm text-muted-foreground">Quantum Keys</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600">{zapKeys.filter(k => k.isActive).length}</div>
                  <div className="text-sm text-muted-foreground">Active Keys</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-600">{selectedKeys.length}</div>
                  <div className="text-sm text-muted-foreground">Selected</div>
                </CardContent>
              </Card>
            </div>

            {/* Key Inventory */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      ZAP Key Inventory
                    </CardTitle>
                    <CardDescription>
                      Manage your ZAP quantum-safe keys
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={showTrashedKeys ? "outline" : "default"}
                      size="sm"
                      onClick={() => setShowTrashedKeys(false)}
                    >
                      Active Keys ({zapKeys.length})
                    </Button>
                    <Button
                      variant={showTrashedKeys ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowTrashedKeys(true)}
                    >
                      Trash ({trashedKeys.length})
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {zapKeys.length === 0 && !showTrashedKeys && (
                  <div className="text-center py-12">
                    <Zap className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No ZAP Keys Found</h3>
                    <p className="text-muted-foreground mb-6">
                      Generate your first ZAP key for the quantum-safe ZAP ecosystem.
                    </p>
                    <Button onClick={handleGenerateKey} disabled={!keyForm.password}>
                      <Plus className="h-4 w-4 mr-2" />
                      Generate Your First ZAP Key
                    </Button>
                  </div>
                )}

                {trashedKeys.length === 0 && showTrashedKeys && (
                  <div className="text-center py-12">
                    <Zap className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Trashed Keys</h3>
                    <p className="text-muted-foreground">
                      No keys have been moved to trash yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {deleteType === 'soft' ? 'Move Key to Trash' : 'Permanently Delete Key'}
              </DialogTitle>
              <DialogDescription>
                {deleteType === 'soft' 
                  ? 'This key will be moved to trash and can be restored later.'
                  : 'This action cannot be undone. The key will be permanently deleted.'
                }
              </DialogDescription>
            </DialogHeader>
            
            {keyToDelete && (
              <div className="py-4">
                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm font-medium">Address:</div>
                  <div className="font-mono text-sm break-all">{keyToDelete.address}</div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant={deleteType === 'soft' ? 'default' : 'destructive'} 
                onClick={confirmDeleteKey}
              >
                {deleteType === 'soft' ? 'Move to Trash' : 'Delete Permanently'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
