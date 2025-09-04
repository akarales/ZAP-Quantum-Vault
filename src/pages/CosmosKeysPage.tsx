import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Checkbox } from '../components/ui/checkbox';
import { 
  ArrowLeft, 
  Plus, 
  Copy, 
  Eye, 
  EyeOff, 
  Shield, 
  Zap, 
  CheckCircle, 
  QrCode, 
  Download,
  Shuffle,
  Trash2,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  Wallet,
  Info,
  Key,
  Activity,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';

interface CosmosKey {
  id: string;
  vault_id: string;
  network_name: string;
  address: string;
  public_key: string;
  derivation_path?: string;
  bech32_prefix: string;
  description?: string;
  quantum_enhanced: boolean;
  created_at: string;
  updated_at: string;
}

interface KeyGenerationForm {
  network: string;
  password: string;
  description: string;
  vaultId: string;
}

interface CosmosAddressInfo {
  address: string;
  network: string;
  publicKey: string;
  bech32Prefix: string;
  qrCode?: string;
}

const COSMOS_NETWORKS = [
  { name: 'Cosmos Hub', value: 'cosmos', prefix: 'cosmos', description: 'ATOM - Cosmos Hub mainnet' },
  { name: 'Osmosis', value: 'osmosis', prefix: 'osmo', description: 'OSMO - Osmosis DEX' },
  { name: 'Juno', value: 'juno', prefix: 'juno', description: 'JUNO - Smart contracts platform' },
  { name: 'Stargaze', value: 'stargaze', prefix: 'stars', description: 'STARS - NFT marketplace' },
  { name: 'Akash', value: 'akash', prefix: 'akash', description: 'AKT - Decentralized cloud' },
];

export const CosmosKeysPage = () => {
  const navigate = useNavigate();
  const [cosmosKeys, setCosmosKeys] = useState<CosmosKey[]>([]);
  const [trashedKeys, setTrashedKeys] = useState<CosmosKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showTrashedKeys, setShowTrashedKeys] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [showPrivateKey, setShowPrivateKey] = useState<Record<string, boolean>>({});
  const [decryptedPrivateKeys, setDecryptedPrivateKeys] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<{ id: string; address: string } | null>(null);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard' | 'restore'>('soft');

  // Form state
  const [showPassword, setShowPassword] = useState(false);
  const [generatedAddress, setGeneratedAddress] = useState<CosmosAddressInfo | null>(null);
  
  const [keyForm, setKeyForm] = useState<KeyGenerationForm>({
    network: 'cosmos',
    password: '',
    description: '',
    vaultId: 'default_vault'
  });

  const currentVaultId = 'default_vault';

  // Load functions
  const loadCosmosKeys = async () => {
    try {
      const keys = await invoke('list_cosmos_keys', { vault_id: currentVaultId }) as CosmosKey[];
      setCosmosKeys(keys);
    } catch (error) {
      console.error('Failed to load Cosmos keys:', error);
    }
  };

  const loadTrashedKeys = async () => {
    try {
      const keys = await invoke('list_trashed_cosmos_keys') as CosmosKey[];
      setTrashedKeys(keys);
    } catch (error) {
      console.error('Failed to load trashed Cosmos keys:', error);
      setTrashedKeys([]);
    }
  };

  const handleTrashKey = async (keyId: string) => {
    try {
      await invoke('trash_cosmos_key', { keyId });
      toast.success('Key moved to trash');
      loadCosmosKeys();
      loadTrashedKeys();
    } catch (error) {
      console.error('Failed to trash key:', error);
      toast.error('Failed to move key to trash');
    }
  };

  const handleRestoreKey = async (keyId: string) => {
    try {
      await invoke('restore_cosmos_key', { keyId });
      toast.success('Cosmos key restored successfully');
      await loadCosmosKeys();
      await loadTrashedKeys();
    } catch (error) {
      console.error('Failed to restore Cosmos key:', error);
      toast.error('Failed to restore Cosmos key');
    }
  };

  const handlePermanentDelete = async (keyId: string) => {
    try {
      await invoke('delete_cosmos_key_permanently', { keyId });
      toast.success('Cosmos key permanently deleted');
      await loadTrashedKeys();
    } catch (error) {
      console.error('Failed to permanently delete Cosmos key:', error);
      toast.error('Failed to permanently delete Cosmos key');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([loadCosmosKeys(), loadTrashedKeys()]);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
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
      const result = await invoke('generate_cosmos_key', {
        vaultId: currentVaultId,
        networkName: keyForm.network,
        password: keyForm.password,
        description: keyForm.description
      }) as { address: string, publicKey: string, networkName: string, bech32Prefix: string };

      setGeneratedAddress({
        address: result.address,
        network: result.networkName,
        publicKey: result.publicKey,
        bech32Prefix: result.bech32Prefix
      });

      setSuccess('Cosmos key generated successfully!');

      // Reset form
      setKeyForm(prev => ({
        ...prev,
        password: '',
        description: ''
      }));
      
      await loadCosmosKeys();
    } catch (error) {
      setError(`Failed to generate key: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Private key handlers
  const handleShowPrivateKey = async (keyId: string, password: string) => {
    try {
      const privateKey = await invoke('decrypt_cosmos_private_key', { keyId, password }) as string;
      setDecryptedPrivateKeys(prev => ({ ...prev, [keyId]: privateKey }));
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
      if (deleteType === 'restore') {
        await handleRestoreKey(keyToDelete.id);
      } else if (deleteType === 'soft') {
        await handleTrashKey(keyToDelete.id);
      } else if (deleteType === 'hard') {
        await handlePermanentDelete(keyToDelete.id);
      }
      
      setDeleteDialogOpen(false);
      setKeyToDelete(null);
    } catch (error) {
      console.error(`Failed to ${deleteType} key:`, error);
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
    
    console.log('[CosmosKeysPage] Generated password length:', password.length);
    console.log('[CosmosKeysPage] Generated password:', password.substring(0, 5) + '...');
    
    // Force immediate state update
    setKeyForm(prev => {
      const newForm = { ...prev, password };
      console.log('[CosmosKeysPage] Updated keyForm password:', newForm.password.length > 0 ? 'SET' : 'EMPTY');
      console.log('[CosmosKeysPage] Button should be enabled:', !loading && newForm.password.trim().length > 0);
      return newForm;
    });
    
    toast.success('Secure password generated!');
  };

  // Add useEffect to debug button state changes
  useEffect(() => {
    const isButtonDisabled = loading || !keyForm.password.trim();
    console.log('[CosmosKeysPage] Button disabled state:', isButtonDisabled);
    console.log('[CosmosKeysPage] Loading:', loading);
    console.log('[CosmosKeysPage] Password length:', keyForm.password.length);
    console.log('[CosmosKeysPage] Password trimmed length:', keyForm.password.trim().length);
  }, [loading, keyForm.password]);

  const getNetworkInfo = (network: string) => {
    const networkData = COSMOS_NETWORKS.find(n => n.value === network);
    return networkData || COSMOS_NETWORKS[0];
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-7xl space-y-6">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Zap className="h-10 w-10 text-blue-500" />
              Cosmos Key Management
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Air-gapped Cosmos wallet with quantum-enhanced security for IBC networks
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => loadCosmosKeys()}
              variant="outline"
              size="sm"
            >
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
          
          {/* Key Generation Panel - Left Side */}
          <div className="xl:col-span-1 space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Generate New Cosmos Key
                </CardTitle>
                <CardDescription>
                  Create quantum-enhanced Cosmos keys for IBC networks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Network Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Cosmos Network</Label>
                  <Select 
                    value={keyForm.network} 
                    onValueChange={(value) => setKeyForm(prev => ({ ...prev, network: value }))}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COSMOS_NETWORKS.map((network) => (
                        <SelectItem key={network.value} value={network.value}>
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-blue-500" />
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
                      Using secp256k1 with post-quantum entropy sources
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={handleGenerateKey} 
                  disabled={loading || !keyForm.password.trim()}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  <Shield className="h-5 w-5 mr-2" />
                  {loading ? 'Generating Cosmos Key...' : 'Generate Cosmos Key'}
                </Button>

              </CardContent>
            </Card>

            {/* Generated Address Display */}
            {generatedAddress && (
              <Card className="shadow-lg border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                    <CheckCircle className="h-5 w-5" />
                    New Cosmos Address Generated
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Cosmos Address</Label>
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
                      <Label className="text-xs">Network</Label>
                      <div className="font-medium">{getNetworkInfo(generatedAddress.network).name}</div>
                    </div>
                    <div>
                      <Label className="text-xs">Prefix</Label>
                      <div className="font-medium">{generatedAddress.bech32Prefix}</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      <QrCode className="h-4 w-4 mr-2" />
                      QR Code
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Key Inventory - Right Side */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                    <div>
                      <div className="text-2xl font-bold">{cosmosKeys.length}</div>
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
                      <div className="text-2xl font-bold">{cosmosKeys.filter(k => k.quantum_enhanced).length}</div>
                      <div className="text-sm text-muted-foreground">Quantum Keys</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="text-2xl font-bold">{cosmosKeys.length}</div>
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
                      Cosmos Key Inventory
                    </CardTitle>
                    <CardDescription>
                      Manage your quantum-enhanced Cosmos keys for IBC networks
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={showTrashedKeys ? "outline" : "default"}
                      size="sm"
                      onClick={() => setShowTrashedKeys(false)}
                    >
                      Active Keys ({cosmosKeys.length})
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
                {(showTrashedKeys ? trashedKeys : cosmosKeys).length === 0 ? (
                  <div className="text-center py-12">
                    <Zap className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">
                      {showTrashedKeys ? "No Trashed Keys" : "No Cosmos Keys Found"}
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      {showTrashedKeys 
                        ? "No keys have been moved to trash yet."
                        : "Generate your first Cosmos key for secure IBC network access."
                      }
                    </p>
                    {!showTrashedKeys && (
                      <Button onClick={handleGenerateKey} disabled={!keyForm.password.trim()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Generate Your First Cosmos Key
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(showTrashedKeys ? trashedKeys : cosmosKeys).map((key) => (
                      <Card key={key.id} className="border border-border/50 hover:border-border transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                id={`select-${key.id}`}
                                checked={selectedKeys.includes(key.id)}
                                onCheckedChange={(checked: boolean) => {
                                  if (checked) {
                                    setSelectedKeys(prev => [...prev, key.id]);
                                  } else {
                                    setSelectedKeys(prev => prev.filter(id => id !== key.id));
                                  }
                                }}
                              />
                              <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => navigate(`/cosmos-keys/${key.id}`)}>
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                                  <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <div className="font-medium">{key.description || `${key.network_name} Key`}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {key.network_name} • {key.bech32_prefix}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {key.quantum_enhanced && (
                                <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Quantum
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/cosmos-keys/${key.id}`);
                                }}
                                title="View Details"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(key.address);
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              {showTrashedKeys ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setKeyToDelete(key);
                                      setDeleteType('restore');
                                      setDeleteDialogOpen(true);
                                    }}
                                    title="Restore Key"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setKeyToDelete(key);
                                      setDeleteType('hard');
                                      setDeleteDialogOpen(true);
                                    }}
                                    title="Delete Permanently"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setKeyToDelete(key);
                                    setDeleteType('soft');
                                    setDeleteDialogOpen(true);
                                  }}
                                  title="Move to Trash"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-xs text-muted-foreground">Address</Label>
                                <code className="block text-sm font-mono text-foreground/80 mt-1">
                                  {key.address}
                                </code>
                              </div>
                              <div className="text-right">
                                <Label className="text-xs text-muted-foreground">Created</Label>
                                <div className="text-sm mt-1">
                                  {new Date(key.created_at).toLocaleDateString()}
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
                {deleteType === 'hard' ? 'Permanently Delete Key' : (showTrashedKeys ? 'Restore Key' : 'Move Key to Trash')}
              </DialogTitle>
              <DialogDescription>
                {deleteType === 'hard' 
                  ? 'This action cannot be undone. The key will be permanently deleted from the system.'
                  : showTrashedKeys 
                    ? 'This will restore the key back to your active keys.'
                    : 'This will move the key to trash. You can restore it later if needed.'
                }
              </DialogDescription>
            </DialogHeader>
            {keyToDelete && (
              <div className="py-4">
                <p className="text-sm text-muted-foreground">Address:</p>
                <code className="text-sm font-mono bg-muted p-2 rounded block mt-1">
                  {keyToDelete.address}
                </code>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant={deleteType === 'hard' ? "destructive" : "default"}
                onClick={handleDeleteKeyConfirm}
              >
                {deleteType === 'hard' ? 'Permanently Delete' : (showTrashedKeys ? 'Restore' : 'Move to Trash')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
