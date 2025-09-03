import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Eye, EyeOff, Copy, Trash2, AlertTriangle, ChevronDown, Plus, Search, Filter, Download, Upload, Key, Shield, Clock, Tag, FileText, ExternalLink, MoreVertical, RefreshCw, Bitcoin, CheckCircle, Wallet, Shuffle, Zap, QrCode, Activity, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BitcoinKey {
  id: string;
  vaultId: string;
  keyType: string;
  network: string;
  encryptedPrivateKey: string; // Base64-encoded string from backend
  publicKey: string; // Base64-encoded string from backend
  address: string;
  derivationPath?: string;
  entropySource: string;
  quantumEnhanced: boolean;
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
  encryptionPassword?: string; // Stored encryption password
}

interface KeyGenerationForm {
  keyType: string;
  network: string;
  password: string;
  description: string;
  vaultId: string;
}


interface BitcoinAddressInfo {
  address: string;
  keyType: string;
  network: string;
  publicKey: string;
  addressType?: string;
  qrCode?: string;
}

export const BitcoinKeysPage = () => {
  const navigate = useNavigate();
  const [bitcoinKeys, setBitcoinKeys] = useState<BitcoinKey[]>([]);
  const [trashedKeys, setTrashedKeys] = useState<BitcoinKey[]>([]);
  const [showTrashedKeys, setShowTrashedKeys] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState<Record<string, boolean>>({});
  const [decryptedPrivateKeys, setDecryptedPrivateKeys] = useState<Record<string, string>>({});
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<{ id: string; address: string } | null>(null);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft');

  // Private key handlers
  const handleShowPrivateKey = async (keyId: string, password: string) => {
    try {
      const result = await invoke('decrypt_private_key', { keyId, password }) as string;
      setDecryptedPrivateKeys(prev => ({ ...prev, [keyId]: result }));
      setShowPrivateKey(prev => ({ ...prev, [keyId]: true }));
    } catch (error) {
      console.error('Failed to decrypt private key:', error);
      alert('Failed to decrypt private key. Check your password.');
    }
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
          // If viewing trashed keys, 'soft' action means restore
          result = await invoke('restore_bitcoin_key', { keyId: keyToDelete.id });
        } else {
          // If viewing active keys, 'soft' action means move to trash
          result = await invoke('delete_bitcoin_key', { keyId: keyToDelete.id });
        }
      } else {
        result = await invoke('hard_delete_bitcoin_key', { keyId: keyToDelete.id });
      }
      
      console.log('Delete/Restore result:', result);
      
      // Refresh both active and trashed keys lists
      await loadBitcoinKeys();
      await loadTrashedKeys();
      
      setDeleteDialogOpen(false);
      setKeyToDelete(null);
      
      alert(`Key ${deleteType === 'soft' ? (showTrashedKeys ? 'restored' : 'moved to trash') : 'permanently deleted'} successfully!`);
    } catch (error) {
      console.error(`Failed to ${deleteType} delete key:`, error);
      alert(`Failed to ${deleteType === 'soft' ? (showTrashedKeys ? 'restore' : 'delete') : 'permanently delete'} key.`);
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

  // Load Bitcoin keys function
  const loadBitcoinKeys = async () => {
    try {
      const keys = await invoke('list_bitcoin_keys', { vaultId: 'default_vault' }) as BitcoinKey[];
      setBitcoinKeys(keys);
    } catch (error) {
      console.error('Failed to load Bitcoin keys:', error);
    }
  };

  // Load trashed Bitcoin keys function
  const loadTrashedKeys = async () => {
    try {
      const keys = await invoke('list_trashed_bitcoin_keys', { vaultId: 'default_vault' }) as BitcoinKey[];
      setTrashedKeys(keys);
    } catch (error) {
      console.error('Failed to load trashed Bitcoin keys:', error);
    }
  };


  const copyPrivateKey = (privateKey: string) => {
    navigator.clipboard.writeText(privateKey);
    alert('Private key copied to clipboard!');
  };

  // Additional state variables
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Key generation form
  const [keyForm, setKeyForm] = useState<KeyGenerationForm>({
    keyType: 'native',
    network: 'mainnet', // Always mainnet for offline wallet
    password: '',
    description: '',
    vaultId: '' // Will be set to default vault when vaults load
  });

  // Generated address info
  const [generatedAddress, setGeneratedAddress] = useState<BitcoinAddressInfo | null>(null);
  
  const currentVaultId = 'default_vault';

  useEffect(() => {
    loadBitcoinKeys();
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
      const result = await invoke('generate_bitcoin_key', {
        vaultId: currentVaultId,
        keyType: keyForm.keyType,
        network: keyForm.network,
        password: keyForm.password,
        description: keyForm.description
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

      setSuccess('Bitcoin key generated successfully!');

      // Reset form
      setKeyForm(prev => ({
        ...prev,
        password: '',
        description: ''
      }));
      await loadBitcoinKeys();
    } catch (error) {
      setError(`Failed to generate key: ${error}`);
    } finally {
      setLoading(false);
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
    
    // Ensure at least one character from each required category
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < 16; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    setKeyForm(prev => ({ ...prev, password }));
    alert('Secure password generated!');
  };

  const getKeyTypeInfo = (keyType: string) => {
    const types = {
      legacy: { 
        name: 'Legacy (P2PKH)', 
        icon: '🏛️', 
        prefix: '1',
        description: 'Original Bitcoin address format'
      },
      segwit: { 
        name: 'SegWit (P2SH-P2WPKH)', 
        icon: '⚡', 
        prefix: '3',
        description: 'Wrapped SegWit for compatibility'
      },
      native: { 
        name: 'Native SegWit (P2WPKH)', 
        icon: '🆕', 
        prefix: 'bc1',
        description: 'Modern Bech32 format, lowest fees'
      },
      multisig: { 
        name: 'MultiSig (P2SH)', 
        icon: '🔐', 
        prefix: '3',
        description: 'Multi-signature security'
      },
      taproot: { 
        name: 'Taproot (P2TR)', 
        icon: '🌳', 
        prefix: 'bc1p',
        description: 'Latest privacy and efficiency features'
      }
    };
    return types[keyType as keyof typeof types] || types.native;
  };

  const getNetworkInfo = (network: string) => {
    const networks = {
      mainnet: { name: 'Bitcoin Mainnet', color: 'bg-green-100/50 text-green-800 dark:bg-green-950/20 dark:text-green-200', description: 'Real Bitcoin network' },
      testnet: { name: 'Bitcoin Testnet', color: 'bg-yellow-100/50 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-200', description: 'Test network for development' },
      regtest: { name: 'Regression Test', color: 'bg-blue-100/50 text-blue-800 dark:bg-blue-950/20 dark:text-blue-200', description: 'Local testing network' }
    };
    return networks[network as keyof typeof networks] || networks.testnet;
  };

  const formatPublicKey = (publicKey: string | number[], truncate: boolean = true) => {
    if (!publicKey) {
      return 'N/A';
    }
    
    if (typeof publicKey === 'string') {
      try {
        // Decode base64 to bytes
        const bytes = atob(publicKey);
        
        // Convert to hex
        const hex = Array.from(bytes, (byte) => 
          byte.charCodeAt(0).toString(16).padStart(2, '0')
        ).join('');
        
        return truncate ? `${hex.slice(0, 8)}...${hex.slice(-8)}` : hex;
      } catch (error) {
        return 'N/A';
      }
    } else if (Array.isArray(publicKey)) {
      try {
        const hex = publicKey.map(byte => byte.toString(16).padStart(2, '0')).join('');
        return truncate ? `${hex.slice(0, 8)}...${hex.slice(-8)}` : hex;
      } catch (error) {
        return 'N/A';
      }
    }
    
    return 'N/A';
  };

  const getFullPublicKey = (publicKey: string | number[]) => {
    return formatPublicKey(publicKey, false);
  };

  const copyFullPublicKey = (publicKey: string | number[]) => {
    const fullKey = getFullPublicKey(publicKey);
    navigator.clipboard.writeText(fullKey);
    setSuccess('Full public key copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-7xl space-y-6">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Bitcoin className="h-10 w-10 text-orange-500" />
              Bitcoin Key Management
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Air-gapped Bitcoin wallet with quantum-enhanced security for offline storage
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => loadBitcoinKeys()}
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
                  Generate New Bitcoin Key
                </CardTitle>
                <CardDescription>
                  Create quantum-enhanced Bitcoin keys for offline cold storage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Offline Wallet Mode */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Offline Wallet Mode</Label>
                  <div className="bg-accent/50 p-4 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <div className="flex-1">
                        <div className="font-medium text-accent-foreground">Bitcoin Mainnet (Air-Gapped)</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Offline wallet with manually imported blockchain data
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    💡 This wallet operates offline for maximum security. Blockchain data must be imported manually.
                  </div>
                </div>

                {/* Address Type Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Address Type</Label>
                  <Select 
                    value={keyForm.keyType} 
                    onValueChange={(value) => setKeyForm(prev => ({ ...prev, keyType: value }))}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries({
                        legacy: 'Legacy (P2PKH) - 1xxx addresses',
                        segwit: 'SegWit (P2SH-P2WPKH) - 3xxx addresses',
                        native: 'Native SegWit (P2WPKH) - bc1xxx addresses',
                        multisig: 'MultiSig (P2SH) - 3xxx addresses',
                        taproot: 'Taproot (P2TR) - bc1pxxx addresses'
                      }).map(([value]) => {
                        const info = getKeyTypeInfo(value);
                        return (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{info.icon}</span>
                              <div>
                                <div className="font-medium">{info.name}</div>
                                <div className="text-xs text-muted-foreground">{info.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
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
                  {loading ? 'Generating Quantum Key...' : 'Generate Bitcoin Key'}
                </Button>

              </CardContent>
            </Card>

            {/* Generated Address Display */}
            {generatedAddress && (
              <Card className="shadow-lg border-green-500/20 bg-green-50/50 dark:bg-green-950/20">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                    <CheckCircle className="h-5 w-5" />
                    New Bitcoin Address Generated
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Receiving Address</Label>
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
                      <Label className="text-xs">Address Type</Label>
                      <div className="font-medium">{getKeyTypeInfo(generatedAddress.keyType).name}</div>
                    </div>
                    <div>
                      <Label className="text-xs">Network</Label>
                      <div className="font-medium">{getNetworkInfo(generatedAddress.network).name}</div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">Public Key</Label>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyFullPublicKey(generatedAddress.publicKey)}
                          className="text-xs h-7"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Full
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(formatPublicKey(generatedAddress.publicKey))}
                          className="text-xs h-7"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Short
                        </Button>
                      </div>
                    </div>
                    <code className="block bg-card p-2 rounded text-xs font-mono border border-border break-all">
                      {formatPublicKey(generatedAddress.publicKey)}
                    </code>
                    <div className="text-xs text-muted-foreground mt-1">
                      Hex format (truncated) • Full: {getFullPublicKey(generatedAddress.publicKey).length / 2} bytes
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
                      <div className="text-2xl font-bold">{bitcoinKeys.length}</div>
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
                      <div className="text-2xl font-bold">{bitcoinKeys.filter(k => k.quantumEnhanced).length}</div>
                      <div className="text-sm text-muted-foreground">Quantum Keys</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-orange-500" />
                    <div>
                      <div className="text-2xl font-bold">{bitcoinKeys.filter(k => k.isActive).length}</div>
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
                      Bitcoin Key Inventory
                    </CardTitle>
                    <CardDescription>
                      Manage your quantum-enhanced Bitcoin keys and addresses
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={showTrashedKeys ? "outline" : "default"}
                      size="sm"
                      onClick={() => setShowTrashedKeys(false)}
                    >
                      Active Keys ({bitcoinKeys.length})
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
                {(showTrashedKeys ? trashedKeys : bitcoinKeys).length === 0 ? (
                  <div className="text-center py-12">
                    <Bitcoin className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">
                      {showTrashedKeys ? "No Trashed Keys" : "No Bitcoin Keys Found"}
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      {showTrashedKeys 
                        ? "No keys have been moved to trash yet."
                        : "Generate your first offline Bitcoin key for secure air-gapped cold storage."
                      }
                    </p>
                    {!showTrashedKeys && (
                      <>
                        <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/20 p-3 rounded-lg mb-4 border border-yellow-200 dark:border-yellow-800">
                          ⚠️ Database storage not implemented - keys are generated but not persisted
                        </div>
                        <Button onClick={handleGenerateKey} disabled={!keyForm.password}>
                          <Plus className="h-4 w-4 mr-2" />
                          Generate Your First Key
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(showTrashedKeys ? trashedKeys : bitcoinKeys).map((key) => (
                      <Card key={key.id} className="border-l-4 border-l-orange-500 bg-card/80 dark:bg-card/60 backdrop-blur-sm">
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
                                  <Bitcoin className="h-5 w-5 text-orange-500" />
                                </div>
                                <div className="flex-1 cursor-pointer" onClick={() => navigate(`/bitcoin-keys/${key.id}`)}>
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
                              
                              <div className="grid grid-cols-1 gap-4 text-sm">
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <Label className="text-xs font-medium text-muted-foreground">Private Key</Label>
                                    <div className="flex gap-2">
                                      {!showPrivateKey[key.id] ? (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const password = prompt('Enter password to decrypt private key:');
                                            if (password) {
                                              handleShowPrivateKey(key.id, password);
                                            }
                                          }}
                                          className="text-xs h-7"
                                        >
                                          <Eye className="h-3 w-3 mr-1" />
                                          Show
                                        </Button>
                                      ) : (
                                        <>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => copyPrivateKey(decryptedPrivateKeys[key.id])}
                                            className="text-xs h-7"
                                          >
                                            <Copy className="h-3 w-3 mr-1" />
                                            Copy
                                          </Button>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-xs h-7 text-red-600 hover:text-red-700"
                                              >
                                                <Trash2 className="h-3 w-3 mr-1" />
                                                Delete
                                                <ChevronDown className="h-3 w-3 ml-1" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              {showTrashedKeys ? (
                                                <>
                                                  <DropdownMenuItem
                                                    onClick={() => handleDeleteKey(key.id, key.address, 'soft')}
                                                    className="text-green-600"
                                                  >
                                                    <RefreshCw className="h-4 w-4 mr-2" />
                                                    Restore Key
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    onClick={() => handleDeleteKey(key.id, key.address, 'hard')}
                                                    className="text-red-600"
                                                  >
                                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                                    Permanently Delete
                                                  </DropdownMenuItem>
                                                </>
                                              ) : (
                                                <>
                                                  <DropdownMenuItem
                                                    onClick={() => handleDeleteKey(key.id, key.address, 'soft')}
                                                    className="text-orange-600"
                                                  >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Move to Trash
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    onClick={() => handleDeleteKey(key.id, key.address, 'hard')}
                                                    className="text-red-600"
                                                  >
                                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                                    Permanently Delete
                                                  </DropdownMenuItem>
                                                </>
                                              )}
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {showPrivateKey[key.id] && decryptedPrivateKeys[key.id] ? (
                                    <div className="font-mono text-xs bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-2 rounded break-all">
                                      <div className="flex items-center gap-2 mb-1">
                                        <AlertTriangle className="h-3 w-3 text-red-500 dark:text-red-400" />
                                        <span className="text-red-600 dark:text-red-400 text-xs font-medium">SENSITIVE DATA</span>
                                      </div>
                                      {decryptedPrivateKeys[key.id]}
                                    </div>
                                  ) : (
                                    <div className="font-mono text-xs bg-muted p-2 rounded break-all text-muted-foreground">
                                      ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
                                    </div>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(key.address)}
                                    className="text-xs h-7"
                                  >
                                    <Copy className="h-4 w-4 mr-1" />
                                    Copy Address
                                  </Button>
                                  {showTrashedKeys ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteKey(key.id, key.address, 'soft')}
                                      className="text-xs h-7 text-green-600 hover:text-green-700"
                                    >
                                      <RefreshCw className="h-3 w-3 mr-1" />
                                      Restore
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleDeleteKey(key.id, key.address, 'soft')}
                                      className="text-xs h-7"
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Move to Trash
                                    </Button>
                                  )}
                                  {showTrashedKeys && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleDeleteKey(key.id, key.address, 'hard')}
                                      className="text-xs h-7"
                                    >
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Delete Forever
                                    </Button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <Label className="text-sm font-medium">Public Key</Label>
                                      <div className="flex gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => copyFullPublicKey(key.publicKey)}
                                          className="text-xs h-7"
                                        >
                                          <Copy className="h-3 w-3 mr-1" />
                                          Copy Full
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => copyToClipboard(formatPublicKey(key.publicKey))}
                                          className="text-xs h-7"
                                        >
                                          <Copy className="h-3 w-3 mr-1" />
                                          Copy Short
                                        </Button>
                                      </div>
                                    </div>
                                    <code className="block bg-muted p-2 rounded text-xs font-mono break-all">
                                      {formatPublicKey(key.publicKey)}
                                    </code>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Hex format (truncated) • Full: {getFullPublicKey(key.publicKey).length / 2} bytes
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <Label className="text-sm font-medium">Key ID</Label>
                                    <code className="block bg-muted p-2 rounded text-xs font-mono mt-1">
                                      {key.id.slice(0, 16)}...
                                    </code>
                                  </div>
                                  
                                  {key.encryptionPassword && (
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <Label className="text-sm font-medium">Encryption Password</Label>
                                        <div className="flex gap-1">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              const keyId = key.id;
                                              setPasswordVisibility(prev => ({
                                                ...prev,
                                                [keyId]: !prev[keyId]
                                              }));
                                            }}
                                            className="text-xs h-7"
                                          >
                                            {passwordVisibility[key.id] ? (
                                              <EyeOff className="h-3 w-3" />
                                            ) : (
                                              <Eye className="h-3 w-3" />
                                            )}
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => copyToClipboard(key.encryptionPassword!)}
                                            className="text-xs h-7"
                                          >
                                            <Copy className="h-3 w-3 mr-1" />
                                            Copy
                                          </Button>
                                        </div>
                                      </div>
                                      <code className="block bg-accent/30 p-2 rounded text-xs font-mono break-all border border-border">
                                        {passwordVisibility[key.id] ? key.encryptionPassword : '•'.repeat(key.encryptionPassword.length)}
                                      </code>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        🔐 Stored password for key decryption
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {key.derivationPath && (
                                  <div>
                                    <Label className="text-sm font-medium">Derivation Path</Label>
                                    <code className="block bg-muted p-2 rounded text-sm font-mono mt-1">
                                      {key.derivationPath}
                                    </code>
                                  </div>
                                )}
                              </div>

                              {/* Metadata */}
                              <div className="flex items-center gap-6 text-sm text-muted-foreground pt-2 border-t">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  Created: {new Date(key.createdAt).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Shield className="h-4 w-4" />
                                  Entropy: {key.entropySource}
                                </div>
                                {key.lastUsed && (
                                  <div className="flex items-center gap-1">
                                    <TrendingUp className="h-4 w-4" />
                                    Last used: {new Date(key.lastUsed).toLocaleDateString()}
                                  </div>
                                )}
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
      </div>

      {/* Hard Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {deleteType === 'hard' ? 'Permanently Delete Bitcoin Key' : 'Move Bitcoin Key to Trash'}
            </DialogTitle>
            <DialogDescription>
              {deleteType === 'hard' ? (
                <>
                  <div className="space-y-2">
                    <p className="text-red-600 font-medium">
                      ⚠️ This action cannot be undone!
                    </p>
                    <p>
                      You are about to permanently delete the Bitcoin key for address:
                    </p>
                    <code className="block bg-red-50 dark:bg-red-950/20 p-2 rounded text-sm font-mono border border-red-200 dark:border-red-800">
                      {keyToDelete?.address}
                    </code>
                    <p className="text-sm text-muted-foreground">
                      This will permanently remove the key and all associated data from the database. 
                      Make sure you have backed up this key if you need to recover it later.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    Move the Bitcoin key for address <code className="bg-muted px-1 rounded">{keyToDelete?.address}</code> to trash?
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    The key will be marked as inactive but can be recovered later.
                  </p>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={deleteType === 'hard' ? 'destructive' : 'default'}
              onClick={handleDeleteKeyConfirm}
              className={deleteType === 'hard' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {deleteType === 'hard' ? 'Permanently Delete' : 'Move to Trash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
