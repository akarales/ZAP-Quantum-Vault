import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  HardDrive,
  Usb,
  RefreshCw,
  Lock,
  Unlock
} from 'lucide-react';

interface BitcoinKey {
  id: string;
  keyType: string;
  network: string;
  address: string;
  derivationPath?: string;
  entropySource: string;
  quantumEnhanced: boolean;
  createdAt: string;
  lastUsed?: string;
  label?: string;
  description?: string;
  tags?: string[];
  balanceSatoshis: number;
  transactionCount: number;
  backupCount: number;
}

interface HDWallet {
  id: string;
  name: string;
  network: string;
  masterXpub: string;
  derivationCount: number;
  quantumEnhanced: boolean;
  createdAt: string;
  lastDerived?: string;
}

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
}

export const BitcoinKeysPage = () => {
  const [bitcoinKeys, setBitcoinKeys] = useState<BitcoinKey[]>([]);
  const [hdWallets, setHdWallets] = useState<HDWallet[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('keys');
  
  // USB Drive and Export state
  const [usbDrives, setUsbDrives] = useState<UsbDrive[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<string>('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [detectingDrives, setDetectingDrives] = useState(false);
  
  // Key generation form state
  const [keyType, setKeyType] = useState('native');
  const [network, setNetwork] = useState('testnet');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // HD wallet form state
  const [walletName, setWalletName] = useState('');
  const [entropyBits, setEntropyBits] = useState('256');
  
  // HD derivation state
  const [selectedWallet, setSelectedWallet] = useState('');
  const [derivationPath, setDerivationPath] = useState("m/44'/0'/0'/0/0");
  
  const currentVaultId = 'default_vault'; // This should come from context/state

  useEffect(() => {
    loadBitcoinKeys();
    loadHdWallets();
  }, []);

  const detectUsbDrives = async () => {
    setDetectingDrives(true);
    setError('');
    try {
      const drives = await invoke<UsbDrive[]>('detect_usb_drives');
      setUsbDrives(drives);
      // Auto-select first trusted drive if available
      const trustedDrive = drives.find(d => d.trust_level === 'trusted');
      if (trustedDrive && !selectedDrive) {
        setSelectedDrive(trustedDrive.id);
      }
    } catch (err) {
      setError(`Failed to detect USB drives: ${err}`);
    } finally {
      setDetectingDrives(false);
    }
  };

  const loadBitcoinKeys = async () => {
    try {
      const keys = await invoke<BitcoinKey[]>('list_bitcoin_keys', { vaultId: currentVaultId });
      setBitcoinKeys(keys);
    } catch (err) {
      setError(`Failed to load Bitcoin keys: ${err}`);
    }
  };

  const loadHdWallets = async () => {
    try {
      const wallets = await invoke<HDWallet[]>('list_hd_wallets', { vaultId: currentVaultId });
      setHdWallets(wallets);
    } catch (err) {
      setError(`Failed to load HD wallets: ${err}`);
    }
  };

  const handleGenerateKey = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const keyId = await invoke<string>('generate_bitcoin_key', {
        vaultId: currentVaultId,
        keyType,
        network,
        password
      });
      
      setSuccess(`Bitcoin key generated successfully! ID: ${keyId}`);
      setPassword('');
      await loadBitcoinKeys();
    } catch (err) {
      setError(`Failed to generate key: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateHdWallet = async () => {
    if (!walletName || !password) {
      setError('Wallet name and password are required');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const walletId = await invoke<string>('generate_hd_wallet', {
        vaultId: currentVaultId,
        name: walletName,
        network,
        entropyBits: parseInt(entropyBits),
        password
      });
      
      setSuccess(`HD wallet created successfully! ID: ${walletId}`);
      setWalletName('');
      setPassword('');
      await loadHdWallets();
    } catch (err) {
      setError(`Failed to generate HD wallet: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeriveKey = async () => {
    if (!selectedWallet || !derivationPath || !password) {
      setError('Wallet, derivation path, and password are required');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const keyId = await invoke<string>('derive_hd_key', {
        walletId: selectedWallet,
        derivationPath,
        password
      });
      
      setSuccess(`Key derived successfully! ID: ${keyId}`);
      setPassword('');
      await loadBitcoinKeys();
      await loadHdWallets();
    } catch (err) {
      setError(`Failed to derive key: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportKeys = async () => {
    if (selectedKeys.length === 0) {
      setError('Please select keys to export');
      return;
    }

    if (!selectedDrive) {
      setError('Please select a USB drive for export');
      return;
    }

    if (!password) {
      setError('Password is required for export');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const backupId = await invoke<string>('export_keys_to_usb', {
        keyIds: selectedKeys,
        driveId: selectedDrive,
        password
      });
      
      setSuccess(`Keys exported successfully! Backup ID: ${backupId}`);
      setSelectedKeys([]);
      setPassword('');
      setExportDialogOpen(false);
      await loadBitcoinKeys();
    } catch (err) {
      setError(`Failed to export keys: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const openExportDialog = () => {
    if (selectedKeys.length === 0) {
      setError('Please select keys to export');
      return;
    }
    setExportDialogOpen(true);
    detectUsbDrives();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const formatSatoshis = (satoshis: number) => {
    return (satoshis / 100000000).toFixed(8) + ' BTC';
  };

  const getKeyTypeIcon = (keyType: string) => {
    switch (keyType) {
      case 'legacy': return '🏛️';
      case 'segwit': return '⚡';
      case 'native': return '🆕';
      case 'multisig': return '🔐';
      case 'taproot': return '🌳';
      default: return '🔑';
    }
  };

  const getNetworkColor = (network: string) => {
    switch (network) {
      case 'mainnet': return 'bg-green-100 text-green-800';
      case 'testnet': return 'bg-yellow-100 text-yellow-800';
      case 'regtest': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bitcoin className="h-8 w-8 text-orange-500" />
            Bitcoin Keys
          </h1>
          <p className="text-muted-foreground mt-1">
            Quantum-enhanced Bitcoin key generation and management
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={openExportDialog}
            disabled={selectedKeys.length === 0 || loading}
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Selected ({selectedKeys.length})
          </Button>
        </div>
      </div>

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="keys">Bitcoin Keys</TabsTrigger>
          <TabsTrigger value="wallets">HD Wallets</TabsTrigger>
          <TabsTrigger value="generate">Generate New</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Bitcoin Keys ({bitcoinKeys.length})
              </CardTitle>
              <CardDescription>
                Manage your quantum-enhanced Bitcoin keys
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bitcoinKeys.length === 0 ? (
                <div className="text-center py-8">
                  <Bitcoin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Bitcoin keys found</h3>
                  <p className="text-muted-foreground mb-4">
                    Generate your first quantum-enhanced Bitcoin key to get started.
                  </p>
                  <Button onClick={() => setActiveTab('generate')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Key
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {bitcoinKeys.map((key) => (
                    <Card key={key.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedKeys.includes(key.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedKeys([...selectedKeys, key.id]);
                              } else {
                                setSelectedKeys(selectedKeys.filter(id => id !== key.id));
                              }
                            }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl">{getKeyTypeIcon(key.keyType)}</span>
                              <h3 className="font-semibold">
                                {key.label || `${key.keyType.charAt(0).toUpperCase() + key.keyType.slice(1)} Key`}
                              </h3>
                              <Badge className={getNetworkColor(key.network)}>
                                {key.network}
                              </Badge>
                              {key.quantumEnhanced && (
                                <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                                  <Zap className="h-3 w-3 mr-1" />
                                  Quantum
                                </Badge>
                              )}
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Address:</span>
                                <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                                  {key.address}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(key.address)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                              
                              {key.derivationPath && (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">Path:</span>
                                  <code className="bg-muted px-2 py-1 rounded text-xs">
                                    {key.derivationPath}
                                  </code>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-4 text-muted-foreground">
                                <span>Balance: {formatSatoshis(key.balanceSatoshis)}</span>
                                <span>Transactions: {key.transactionCount}</span>
                                <span>Backups: {key.backupCount}</span>
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                                <span>•</span>
                                <span>Entropy: {key.entropySource}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                HD Wallets ({hdWallets.length})
              </CardTitle>
              <CardDescription>
                Hierarchical Deterministic wallets with quantum-enhanced entropy
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hdWallets.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No HD wallets found</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first HD wallet to generate multiple keys from a single seed.
                  </p>
                  <Button onClick={() => setActiveTab('generate')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create HD Wallet
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {hdWallets.map((wallet) => (
                    <Card key={wallet.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Wallet className="h-5 w-5" />
                            <h3 className="font-semibold">{wallet.name}</h3>
                            <Badge className={getNetworkColor(wallet.network)}>
                              {wallet.network}
                            </Badge>
                            {wallet.quantumEnhanced && (
                              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                                <Zap className="h-3 w-3 mr-1" />
                                Quantum
                              </Badge>
                            )}
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Master xPub:</span>
                              <code className="bg-muted px-2 py-1 rounded text-xs font-mono truncate max-w-md">
                                {wallet.masterXpub}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(wallet.masterXpub)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            <div className="flex items-center gap-4 text-muted-foreground">
                              <span>Keys derived: {wallet.derivationCount}</span>
                              <span>Created: {new Date(wallet.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          
                          <div className="mt-4">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Key className="h-4 w-4 mr-2" />
                                  Derive Key
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Derive Key from {wallet.name}</DialogTitle>
                                  <DialogDescription>
                                    Generate a new key from this HD wallet using a derivation path.
                                  </DialogDescription>
                                </DialogHeader>
                                
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="derivationPath">Derivation Path</Label>
                                    <Input
                                      id="derivationPath"
                                      value={derivationPath}
                                      onChange={(e) => setDerivationPath(e.target.value)}
                                      placeholder="m/44'/0'/0'/0/0"
                                    />
                                  </div>
                                  
                                  <div>
                                    <Label htmlFor="password">Password</Label>
                                    <div className="relative">
                                      <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
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
                                  </div>
                                </div>
                                
                                <DialogFooter>
                                  <Button
                                    onClick={() => {
                                      setSelectedWallet(wallet.id);
                                      handleDeriveKey();
                                    }}
                                    disabled={loading}
                                  >
                                    {loading ? 'Deriving...' : 'Derive Key'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Generate Single Key
                </CardTitle>
                <CardDescription>
                  Create a single Bitcoin key with quantum-enhanced entropy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="keyType">Key Type</Label>
                  <Select value={keyType} onValueChange={setKeyType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="legacy">Legacy (P2PKH)</SelectItem>
                      <SelectItem value="segwit">SegWit (P2WPKH)</SelectItem>
                      <SelectItem value="native">Native Bech32 (P2WPKH)</SelectItem>
                      <SelectItem value="multisig">MultiSig (P2SH)</SelectItem>
                      <SelectItem value="taproot">Taproot (P2TR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="network">Network</Label>
                  <Select value={network} onValueChange={setNetwork}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mainnet">Mainnet</SelectItem>
                      <SelectItem value="testnet">Testnet</SelectItem>
                      <SelectItem value="regtest">Regtest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
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
                </div>
                
                <Button 
                  onClick={handleGenerateKey} 
                  disabled={loading || !password}
                  className="w-full"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {loading ? 'Generating...' : 'Generate Quantum Key'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Create HD Wallet
                </CardTitle>
                <CardDescription>
                  Create a hierarchical deterministic wallet for multiple keys
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="walletName">Wallet Name</Label>
                  <Input
                    id="walletName"
                    value={walletName}
                    onChange={(e) => setWalletName(e.target.value)}
                    placeholder="My Quantum Wallet"
                  />
                </div>
                
                <div>
                  <Label htmlFor="network">Network</Label>
                  <Select value={network} onValueChange={setNetwork}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mainnet">Mainnet</SelectItem>
                      <SelectItem value="testnet">Testnet</SelectItem>
                      <SelectItem value="regtest">Regtest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="entropyBits">Entropy Bits</Label>
                  <Select value={entropyBits} onValueChange={setEntropyBits}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="128">128 bits (12 words)</SelectItem>
                      <SelectItem value="160">160 bits (15 words)</SelectItem>
                      <SelectItem value="192">192 bits (18 words)</SelectItem>
                      <SelectItem value="224">224 bits (21 words)</SelectItem>
                      <SelectItem value="256">256 bits (24 words)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
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
                </div>
                
                <Button 
                  onClick={handleGenerateHdWallet} 
                  disabled={loading || !walletName || !password}
                  className="w-full"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {loading ? 'Creating...' : 'Create Quantum HD Wallet'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Enhanced Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Export Keys to Cold Storage
            </DialogTitle>
            <DialogDescription>
              Export {selectedKeys.length} selected Bitcoin keys to an encrypted USB drive for cold storage backup.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Selected Keys Summary */}
            <div>
              <Label className="text-base font-semibold">Selected Keys ({selectedKeys.length})</Label>
              <div className="mt-2 max-h-32 overflow-y-auto border rounded-md p-3 bg-muted/50">
                {selectedKeys.map(keyId => {
                  const key = bitcoinKeys.find(k => k.id === keyId);
                  return key ? (
                    <div key={keyId} className="flex items-center gap-2 text-sm py-1">
                      <span className="text-lg">{getKeyTypeIcon(key.keyType)}</span>
                      <span className="font-mono text-xs">{key.address}</span>
                      <Badge className={getNetworkColor(key.network)} variant="outline">
                        {key.network}
                      </Badge>
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            {/* USB Drive Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">USB Drive Selection</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={detectUsbDrives}
                  disabled={detectingDrives}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${detectingDrives ? 'animate-spin' : ''}`} />
                  {detectingDrives ? 'Detecting...' : 'Refresh'}
                </Button>
              </div>
              
              {usbDrives.length === 0 ? (
                <div className="text-center py-8 border rounded-md bg-muted/50">
                  <Usb className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No USB drives detected. Connect a drive and refresh.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {usbDrives.map((drive) => (
                    <Card 
                      key={drive.id} 
                      className={`cursor-pointer transition-all ${
                        selectedDrive === drive.id 
                          ? 'ring-2 ring-primary border-primary' 
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => setSelectedDrive(drive.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Usb className="h-4 w-4" />
                              <span className="font-semibold">
                                {drive.label || 'USB Drive'}
                              </span>
                              <Badge 
                                variant={drive.trust_level === 'trusted' ? 'default' : 
                                        drive.trust_level === 'blocked' ? 'destructive' : 'secondary'}
                              >
                                {drive.trust_level}
                              </Badge>
                              {drive.is_encrypted && (
                                <Badge variant="outline" className="text-green-600">
                                  <Lock className="h-3 w-3 mr-1" />
                                  Encrypted
                                </Badge>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                              <div>
                                <span className="font-medium">Capacity:</span> {formatBytes(drive.capacity)}
                              </div>
                              <div>
                                <span className="font-medium">Available:</span> {formatBytes(drive.available_space)}
                              </div>
                              <div>
                                <span className="font-medium">Backups:</span> {drive.backup_count}
                              </div>
                              <div>
                                <span className="font-medium">Health:</span> {drive.health_status}
                              </div>
                            </div>
                            
                            <div className="mt-2 text-xs text-muted-foreground">
                              {drive.device_path}
                            </div>
                          </div>
                          
                          {selectedDrive === drive.id && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Export Password */}
            <div>
              <Label htmlFor="exportPassword" className="text-base font-semibold">
                Export Password
              </Label>
              <div className="relative mt-2">
                <Input
                  id="exportPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to encrypt the backup"
                  className="pr-10"
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
              <p className="text-xs text-muted-foreground mt-1">
                This password will be used to encrypt your private keys in the backup.
              </p>
            </div>

            {/* Export Options */}
            <div>
              <Label className="text-base font-semibold">Export Information</Label>
              <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium">Keys to export:</span> {selectedKeys.length}
                  </div>
                  <div>
                    <span className="font-medium">Target drive:</span> {
                      selectedDrive ? 
                        usbDrives.find(d => d.id === selectedDrive)?.label || 'Selected USB' :
                        'None selected'
                    }
                  </div>
                  <div>
                    <span className="font-medium">Encryption:</span> AES-256-GCM
                  </div>
                  <div>
                    <span className="font-medium">Quantum enhanced:</span> Yes
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExportKeys}
              disabled={loading || !selectedDrive || !password || selectedKeys.length === 0}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Export to Cold Storage
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
