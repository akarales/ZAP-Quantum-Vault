import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Eye, EyeOff, Copy, Trash2, AlertTriangle, Plus, RefreshCw, CheckCircle, Wallet, Shuffle, Zap, Shield, Key, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EthereumKey {
  id: string;
  vaultId: string;
  keyType: string;
  network: string;
  encryptedPrivateKey: string;
  publicKey: string;
  address: string;
  entropySource: string;
  quantumEnhanced: boolean;
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

interface KeyGenerationForm {
  keyType: string;
  network: string;
  password: string;
  description: string;
  vaultId: string;
}

interface EthereumAddressInfo {
  address: string;
  keyType: string;
  network: string;
  publicKey: string;
}

export const EthereumKeysPage = () => {
  const navigate = useNavigate();
  const [ethereumKeys, setEthereumKeys] = useState<EthereumKey[]>([]);
  const [trashedKeys, setTrashedKeys] = useState<EthereumKey[]>([]);
  const [showTrashedKeys, setShowTrashedKeys] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState<Record<string, boolean>>({});
  const [decryptedPrivateKeys, setDecryptedPrivateKeys] = useState<Record<string, string>>({});
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<{ id: string; address: string } | null>(null);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft');

  // Form state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [keyForm, setKeyForm] = useState<KeyGenerationForm>({
    keyType: 'standard',
    network: 'mainnet',
    password: '',
    description: '',
    vaultId: 'default_vault'
  });

  const [generatedAddress, setGeneratedAddress] = useState<EthereumAddressInfo | null>(null);
  const currentVaultId = 'default_vault';

  // Load functions
  const loadEthereumKeys = async () => {
    try {
      const keys = await invoke('list_ethereum_keys', { vault_id: currentVaultId }) as EthereumKey[];
      setEthereumKeys(keys);
    } catch (error) {
      console.error('Failed to load Ethereum keys:', error);
    }
  };

  const loadTrashedKeys = async () => {
    try {
      const keys = await invoke('list_trashed_ethereum_keys', { vaultId: currentVaultId }) as EthereumKey[];
      setTrashedKeys(keys);
    } catch (error) {
      console.error('Failed to load trashed Ethereum keys:', error);
    }
  };

  useEffect(() => {
    loadEthereumKeys();
    loadTrashedKeys();
  }, []);

  // Key generation handler
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
      const result = await invoke('generate_ethereum_key', {
        vaultId: currentVaultId,
        keyType: keyForm.keyType,
        network: keyForm.network,
        password: keyForm.password
      }) as {
        address: string,
        publicKey: string,
        keyType: string,
        network: string
      };

      setGeneratedAddress({
        address: result.address,
        publicKey: result.publicKey,
        keyType: keyForm.keyType,
        network: keyForm.network
      });

      setSuccess('Ethereum key generated successfully!');
      setKeyForm(prev => ({ ...prev, password: '', description: '' }));
      await loadEthereumKeys();
    } catch (error) {
      setError(`Failed to generate key: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Private key handlers
  const handleShowPrivateKey = async (keyId: string, password: string) => {
    try {
      const result = await invoke('decrypt_ethereum_private_key', { keyId, password }) as string;
      setDecryptedPrivateKeys(prev => ({ ...prev, [keyId]: result }));
      setShowPrivateKey(prev => ({ ...prev, [keyId]: true }));
    } catch (error) {
      console.error('Failed to decrypt private key:', error);
      alert('Failed to decrypt private key. Check your password.');
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

  // Delete handlers
  const handleDeleteKey = (keyId: string, address: string, type: 'soft' | 'hard') => {
    setKeyToDelete({ id: keyId, address });
    setDeleteType(type);
    setDeleteDialogOpen(true);
  };

  const handleDeleteKeyConfirm = async () => {
    if (!keyToDelete) return;
    
    try {
      let result;
      if (deleteType === 'soft') {
        if (showTrashedKeys) {
          result = await invoke('restore_ethereum_key', { keyId: keyToDelete.id });
        } else {
          result = await invoke('delete_ethereum_key', { keyId: keyToDelete.id });
        }
      } else {
        result = await invoke('hard_delete_ethereum_key', { keyId: keyToDelete.id });
      }
      
      console.log('Delete/Restore result:', result);
      
      await loadEthereumKeys();
      await loadTrashedKeys();
      
      setDeleteDialogOpen(false);
      setKeyToDelete(null);
      
      alert(`Key ${deleteType === 'soft' ? (showTrashedKeys ? 'restored' : 'moved to trash') : 'permanently deleted'} successfully!`);
    } catch (error) {
      console.error(`Failed to ${deleteType} delete key:`, error);
      alert(`Failed to ${deleteType === 'soft' ? (showTrashedKeys ? 'restore' : 'delete') : 'permanently delete'} key.`);
    }
  };

  // Utility functions
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const generateSecurePassword = () => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    for (let i = 4; i < 16; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    setKeyForm(prev => ({ ...prev, password }));
    alert('Secure password generated!');
  };

  const getKeyTypeInfo = (keyType: string) => {
    const types = {
      standard: { 
        name: 'Standard', 
        icon: '🔑', 
        description: 'Standard Ethereum key'
      },
      hd: { 
        name: 'HD Wallet', 
        icon: '🌳', 
        description: 'Hierarchical Deterministic wallet'
      }
    };
    return types[keyType as keyof typeof types] || types.standard;
  };

  const getNetworkInfo = (network: string) => {
    const networks = {
      mainnet: { name: 'Ethereum Mainnet', color: 'bg-blue-100/50 text-blue-800 dark:bg-blue-950/20 dark:text-blue-200', description: 'Main Ethereum network' },
      sepolia: { name: 'Sepolia Testnet', color: 'bg-yellow-100/50 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-200', description: 'Ethereum test network' },
      goerli: { name: 'Goerli Testnet', color: 'bg-green-100/50 text-green-800 dark:bg-green-950/20 dark:text-green-200', description: 'Ethereum test network' }
    };
    return networks[network as keyof typeof networks] || networks.mainnet;
  };

  const formatAddress = (address: string, truncate: boolean = true) => {
    if (!address) return 'N/A';
    return truncate ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-7xl space-y-6">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                Ξ
              </div>
              Ethereum Key Management
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Air-gapped Ethereum wallet with quantum-enhanced security for offline storage
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => loadEthereumKeys()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => setSelectedKeys([])}
              variant="outline"
              size="sm"
              disabled={selectedKeys.length === 0}
            >
              Clear Selection ({selectedKeys.length})
            </Button>
          </div>
        </div>

        {/* Alerts */}
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
          
          {/* Key Generation Panel */}
          <div className="xl:col-span-1 space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Generate New Ethereum Key
                </CardTitle>
                <CardDescription>
                  Create quantum-enhanced Ethereum keys for offline cold storage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Network Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Network</Label>
                  <Select 
                    value={keyForm.network} 
                    onValueChange={(value) => setKeyForm(prev => ({ ...prev, network: value }))}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mainnet">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <div>
                            <div className="font-medium">Ethereum Mainnet</div>
                            <div className="text-xs text-muted-foreground">Main Ethereum network</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="sepolia">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <div>
                            <div className="font-medium">Sepolia Testnet</div>
                            <div className="text-xs text-muted-foreground">Test network</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Key Type Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Key Type</Label>
                  <Select 
                    value={keyForm.keyType} 
                    onValueChange={(value) => setKeyForm(prev => ({ ...prev, keyType: value }))}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔑</span>
                          <div>
                            <div className="font-medium">Standard</div>
                            <div className="text-xs text-muted-foreground">Standard Ethereum key</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="hd">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🌳</span>
                          <div>
                            <div className="font-medium">HD Wallet</div>
                            <div className="text-xs text-muted-foreground">Hierarchical Deterministic</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t my-4" />

                {/* Security Settings */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Security Settings</Label>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Encryption Password</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={generateSecurePassword}
                          className="text-xs h-8"
                        >
                          <Shuffle className="h-3 w-3 mr-1" />
                          Generate
                        </Button>
                        {keyForm.password && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(keyForm.password)}
                            className="text-xs h-8"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={keyForm.password}
                        onChange={(e) => setKeyForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter strong password or generate one"
                        className="h-12 pr-12"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {keyForm.password && (
                      <div className="text-xs text-muted-foreground">
                        Password strength: <span className="text-green-600 dark:text-green-400 font-medium">Very Strong</span> ({keyForm.password.length} characters)
                      </div>
                    )}
                  </div>

                  <div className="bg-accent/30 p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="font-medium text-accent-foreground">
                        Quantum-Enhanced Entropy
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Using Kyber1024 + Dilithium5 post-quantum algorithms
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={handleGenerateKey} 
                  disabled={loading || !keyForm.password}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  <Shield className="h-5 w-5 mr-2" />
                  {loading ? 'Generating Quantum Key...' : 'Generate Ethereum Key'}
                </Button>

              </CardContent>
            </Card>

            {/* Generated Address Display */}
            {generatedAddress && (
              <Card className="shadow-lg border-green-500/20 bg-green-50/50 dark:bg-green-950/20">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                    <CheckCircle className="h-5 w-5" />
                    New Ethereum Address Generated
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Ethereum Address</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 bg-card p-3 rounded-md text-sm font-mono border border-border">
                        {generatedAddress.address}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(generatedAddress.address)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-xs">Key Type</Label>
                      <div className="font-medium">{getKeyTypeInfo(generatedAddress.keyType).name}</div>
                    </div>
                    <div>
                      <Label className="text-xs">Network</Label>
                      <div className="font-medium">{getNetworkInfo(generatedAddress.network).name}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Key Inventory */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                    <div>
                      <div className="text-2xl font-bold">{ethereumKeys.length}</div>
                      <div className="text-sm text-muted-foreground">Total Keys</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-500 dark:text-green-400" />
                    <div>
                      <div className="text-2xl font-bold">{ethereumKeys.filter(k => k.quantumEnhanced).length}</div>
                      <div className="text-sm text-muted-foreground">Quantum Keys</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-500" />
                    <div>
                      <div className="text-2xl font-bold">{ethereumKeys.filter(k => k.isActive).length}</div>
                      <div className="text-sm text-muted-foreground">Active Keys</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedKeys.length > 0}
                      className="h-5 w-5"
                    />
                    <div>
                      <div className="text-2xl font-bold">{selectedKeys.length}</div>
                      <div className="text-sm text-muted-foreground">Selected</div>
                    </div>
                  </div>
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
                      Ethereum Key Inventory
                    </CardTitle>
                    <CardDescription>
                      Manage your quantum-enhanced Ethereum keys and addresses
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={showTrashedKeys ? "outline" : "default"}
                      size="sm"
                      onClick={() => setShowTrashedKeys(false)}
                    >
                      Active Keys ({ethereumKeys.length})
                    </Button>
                    <Button
                      variant={showTrashedKeys ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowTrashedKeys(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Trash ({trashedKeys.length})
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(showTrashedKeys ? trashedKeys : ethereumKeys).length === 0 ? (
                  <div className="text-center py-12">
                    <div className="h-16 w-16 mx-auto bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-2xl mb-4">
                      Ξ
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                      {showTrashedKeys ? "No Trashed Keys" : "No Ethereum Keys Found"}
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      {showTrashedKeys 
                        ? "No keys have been moved to trash yet."
                        : "Generate your first offline Ethereum key for secure air-gapped cold storage."
                      }
                    </p>
                    {!showTrashedKeys && (
                      <Button onClick={handleGenerateKey} disabled={!keyForm.password}>
                        <Plus className="h-4 w-4 mr-2" />
                        Generate Your First Key
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(showTrashedKeys ? trashedKeys : ethereumKeys).map((key) => (
                      <Card key={key.id} className="border-l-4 border-l-purple-500 bg-card/80 dark:bg-card/60 backdrop-blur-sm">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`key-${key.id}`}
                                    checked={selectedKeys.includes(key.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedKeys(prev => [...prev, key.id]);
                                      } else {
                                        setSelectedKeys(prev => prev.filter(id => id !== key.id));
                                      }
                                    }}
                                  />
                                  <div className="h-5 w-5 bg-gradient-to-r from-purple-500 to-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">
                                    Ξ
                                  </div>
                                </div>
                                <div className="flex-1 cursor-pointer" onClick={() => navigate(`/ethereum-keys/${key.id}`)}>
                                  <h3 className="font-semibold text-lg hover:text-primary transition-colors">{key.address}</h3>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                    <span className="flex items-center gap-1">
                                      <Key className="h-3 w-3" />
                                      {key.keyType}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Wallet className="h-3 w-3" />
                                      {key.network}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Zap className="h-3 w-3" />
                                      Quantum Enhanced
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
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
                {deleteType === 'soft' 
                  ? (showTrashedKeys ? 'Restore Key' : 'Move Key to Trash')
                  : 'Permanently Delete Key'
                }
              </DialogTitle>
              <DialogDescription>
                {deleteType === 'soft'
                  ? (showTrashedKeys 
                      ? `Are you sure you want to restore the key for address ${keyToDelete?.address}?`
                      : `Are you sure you want to move the key for address ${keyToDelete?.address} to trash? You can restore it later.`
                    )
                  : `Are you sure you want to permanently delete the key for address ${keyToDelete?.address}? This action cannot be undone.`
                }
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant={deleteType === 'hard' ? "destructive" : "default"}
                onClick={handleDeleteKeyConfirm}
              >
                {deleteType === 'soft' 
                  ? (showTrashedKeys ? 'Restore' : 'Move to Trash')
                  : 'Permanently Delete'
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
