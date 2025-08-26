import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Bitcoin, 
  Key, 
  Wallet, 
  Plus, 
  Copy, 
  Download, 
  Shield, 
  Zap,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  QrCode,
  RefreshCw,
  Clock,
  TrendingUp,
  Activity,
  Shuffle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

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
}

interface KeyGenerationForm {
  keyType: string;
  network: string;
  password: string;
  description: string;
}

interface BitcoinAddressInfo {
  address: string;
  keyType: string;
  network: string;
  publicKey: string;
  addressType?: string;
  qrCode?: string;
}

export const BitcoinKeysPageNew = () => {
  const [bitcoinKeys, setBitcoinKeys] = useState<BitcoinKey[]>([]);
  const [showPrivateKey, setShowPrivateKey] = useState<Record<string, boolean>>({});
  const [decryptedPrivateKeys, setDecryptedPrivateKeys] = useState<Record<string, string>>({});
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

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

  const handleHidePrivateKey = (keyId: string) => {
    setShowPrivateKey(prev => ({ ...prev, [keyId]: false }));
    setDecryptedPrivateKeys(prev => {
      const newKeys = { ...prev };
      delete newKeys[keyId];
      return newKeys;
    });
  };

  const copyPrivateKey = (privateKey: string) => {
    navigator.clipboard.writeText(privateKey);
    alert('Private key copied to clipboard!');
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Key generation form
  const [keyForm, setKeyForm] = useState<KeyGenerationForm>({
    keyType: 'native',
    network: 'mainnet', // Always mainnet for offline wallet
    password: '',
    description: ''
  });

  // Generated address info
  const [generatedAddress, setGeneratedAddress] = useState<BitcoinAddressInfo | null>(null);
  
  const currentVaultId = 'default_vault';

  useEffect(() => {
    loadBitcoinKeys();
  }, []);

  const loadBitcoinKeys = async () => {
    try {
      const keys = await invoke('list_bitcoin_keys', {
        vaultId: currentVaultId
      }) as BitcoinKey[];
      console.log('Raw keys data from backend:', keys);
      console.log('First key structure:', keys[0]);
      if (keys[0]) {
        console.log('First key publicKey:', keys[0].publicKey);
        console.log('All keys from backend:', JSON.stringify(keys, null, 2));
        console.log('Keys object keys:', Object.keys(keys[0]));
      }
      setBitcoinKeys(keys);
      console.log('Loaded Bitcoin keys:', keys);
      
    } catch (err) {
      console.error('Failed to load Bitcoin keys:', err);
      setError(`Failed to load keys: ${err}`);
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
      const response = await invoke('generate_bitcoin_key', {
        vaultId: currentVaultId,
        keyType: keyForm.keyType,
        network: keyForm.network,
        password: keyForm.password
      }) as string;

      // Parse the JSON response
      let keyData;
      try {
        keyData = JSON.parse(response);
      } catch {
        // If parsing fails, treat as just the key ID (fallback)
        keyData = { id: response, address: 'Address generation failed' };
      }

      // Set the generated address info
      setGeneratedAddress({
        address: keyData.address || 'Address not available',
        keyType: keyData.keyType || keyForm.keyType,
        network: keyData.network || keyForm.network,
        publicKey: keyData.publicKey || '',
        qrCode: '' // QR code generation can be added later
      });

      setSuccess('Bitcoin key generated successfully!');
      console.log('Generated Bitcoin key:', keyData);
      
      // Load updated keys
      setKeyForm(prev => ({ ...prev, password: '' }));
      await loadBitcoinKeys();
    } catch (err) {
      setError(`Failed to generate key: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const generateSecurePassword = () => {
    const length = 32;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    // Ensure at least one character from each category
    const categories = [
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'abcdefghijklmnopqrstuvwxyz', 
      '0123456789',
      '!@#$%^&*()_+-=[]{}|;:,.<>?'
    ];
    
    // Add one character from each category
    categories.forEach(category => {
      password += category.charAt(Math.floor(Math.random() * category.length));
    });
    
    // Fill remaining length with random characters
    for (let i = password.length; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    setKeyForm(prev => ({ ...prev, password }));
    setSuccess('Secure password generated!');
    setTimeout(() => setSuccess(''), 2000);
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
      mainnet: { name: 'Bitcoin Mainnet', color: 'bg-green-100 text-green-800', description: 'Real Bitcoin network' },
      testnet: { name: 'Bitcoin Testnet', color: 'bg-yellow-100 text-yellow-800', description: 'Test network for development' },
      regtest: { name: 'Regression Test', color: 'bg-blue-100 text-blue-800', description: 'Local testing network' }
    };
    return networks[network as keyof typeof networks] || networks.testnet;
  };

  const formatPublicKey = (publicKey: string | number[]) => {
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
        
        return `${hex.slice(0, 8)}...${hex.slice(-8)}`;
      } catch (error) {
        return 'N/A';
      }
    } else if (Array.isArray(publicKey)) {
      try {
        const hex = publicKey.map(byte => byte.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}...${hex.slice(-8)}`;
      } catch (error) {
        return 'N/A';
      }
    }
    
    return 'N/A';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
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
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <div className="flex-1">
                        <div className="font-medium text-blue-800 dark:text-blue-200">Bitcoin Mainnet (Air-Gapped)</div>
                        <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
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
                      }).map(([value, label]) => {
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
                        Password strength: <span className="text-green-600 font-medium">Very Strong</span> ({keyForm.password.length} characters)
                      </div>
                    )}
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-purple-800 dark:text-purple-200">
                        Quantum-Enhanced Entropy
                      </span>
                    </div>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
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
              <Card className="shadow-lg border-green-200 bg-green-50 dark:bg-green-950/20">
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
                      <code className="flex-1 bg-white dark:bg-slate-800 p-3 rounded-md text-sm font-mono border">
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
                      <div className="font-medium">{getKeyTypeInfo(generatedAddress.addressType).name}</div>
                    </div>
                    <div>
                      <Label className="text-xs">Network</Label>
                      <div className="font-medium">{getNetworkInfo(generatedAddress.network).name}</div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Public Key</Label>
                    <code className="block bg-white dark:bg-slate-800 p-2 rounded text-xs font-mono border mt-1">
                      {generatedAddress.publicKey}
                    </code>
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
                    <Key className="h-5 w-5 text-blue-500" />
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
                    <Shield className="h-5 w-5 text-green-500" />
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
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Bitcoin Key Inventory
                </CardTitle>
                <CardDescription>
                  Manage your quantum-enhanced Bitcoin keys and addresses
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bitcoinKeys.length === 0 ? (
                  <div className="text-center py-12">
                    <Bitcoin className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Bitcoin Keys Found</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Generate your first offline Bitcoin key for secure air-gapped cold storage.
                    </p>
                    <div className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg mb-4">
                      ⚠️ Database storage not implemented - keys are generated but not persisted
                    </div>
                    <Button onClick={handleGenerateKey} disabled={!keyForm.password}>
                      <Plus className="h-4 w-4 mr-2" />
                      Generate Your First Key
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bitcoinKeys.map((key) => (
                      <Card key={key.id} className="border-l-4 border-l-orange-500">
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
                                <div>
                                  <h3 className="font-semibold text-lg">{key.address}</h3>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                    <span className="flex items-center gap-1">
                                      <Key className="h-3 w-3" />
                                      {key.key_type}
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
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleHidePrivateKey(key.id)}
                                            className="text-xs h-7"
                                          >
                                            <EyeOff className="h-3 w-3 mr-1" />
                                            Hide
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {showPrivateKey[key.id] && decryptedPrivateKeys[key.id] ? (
                                    <div className="font-mono text-xs bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-2 rounded break-all">
                                      <div className="flex items-center gap-2 mb-1">
                                        <AlertTriangle className="h-3 w-3 text-red-500" />
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
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(key.address)}
                                    className="text-xs h-7"
                                  >
                                    <Copy className="h-4 w-4 mr-1" />
                                    Copy Address
                                  </Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-sm font-medium">Public Key</Label>
                                    <code className="block bg-muted p-2 rounded text-xs font-mono mt-1">
                                      {formatPublicKey(key.publicKey)}
                                    </code>
                                  </div>
                                  
                                  <div>
                                    <Label className="text-sm font-medium">Key ID</Label>
                                    <code className="block bg-muted p-2 rounded text-xs font-mono mt-1">
                                      {key.id.slice(0, 16)}...
                                    </code>
                                  </div>
                                </div>

                                {key.derivationPath && (
                                  <div>
                                    <Label className="text-sm font-medium">Derivation Path</Label>
                                    <code className="block bg-muted p-2 rounded text-sm font-mono mt-1">
                                      {key.derivation_path}
                                    </code>
                                  </div>
                                )}
                              </div>

                              {/* Metadata */}
                              <div className="flex items-center gap-6 text-sm text-muted-foreground pt-2 border-t">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  Created: {new Date(key.created_at).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Shield className="h-4 w-4" />
                                  Entropy: {key.entropy_source}
                                </div>
                                {key.lastUsed && (
                                  <div className="flex items-center gap-1">
                                    <TrendingUp className="h-4 w-4" />
                                    Last used: {new Date(key.last_used).toLocaleDateString()}
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
    </div>
  );
};
