import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Key, 
  Copy, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Plus, 
  Zap,
  Hash,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Wallet,
  QrCode,
  Bitcoin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface BitcoinKey {
  id: string;
  vaultId: string;
  keyType: string;
  network: string;
  encryptedPrivateKey: string;
  publicKey: string;
  address: string;
  derivationPath?: string;
  entropySource: string;
  quantumEnhanced: boolean;
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
  label?: string;
  description?: string;
  tags?: string;
  balanceSatoshis?: number;
  transactionCount?: number;
}

interface ReceivingAddress {
  id: string;
  keyId: string;
  address: string;
  derivationIndex: number;
  derivationPath: string;
  publicKey: string;
  addressType: string;
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
  label?: string;
  balanceSatoshis?: number;
  transactionCount?: number;
}

export const BitcoinKeyDetailsPage = () => {
  console.log('BitcoinKeyDetailsPage component loaded');
  
  const { keyId } = useParams<{ keyId: string }>();
  const navigate = useNavigate();
  
  console.log('Extracted keyId from params:', keyId);
  
  const [bitcoinKey, setBitcoinKey] = useState<BitcoinKey | null>(null);
  const [receivingAddresses, setReceivingAddresses] = useState<ReceivingAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [decryptedPrivateKey, setDecryptedPrivateKey] = useState('');
  const [generatingAddress, setGeneratingAddress] = useState(false);

  // Early return test
  if (!keyId) {
    console.log('No keyId found, rendering error message');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Key ID</h1>
          <p className="text-muted-foreground mb-4">No key ID was provided in the URL.</p>
          <Button onClick={() => navigate('/bitcoin-keys')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Keys
          </Button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    console.log('BitcoinKeyDetailsPage mounted, keyId:', keyId);
    
    const fetchKeyDetails = async () => {
      if (!keyId) {
        console.log('No keyId provided, skipping fetch');
        setLoading(false);
        return;
      }
      
      try {
        console.log('Fetching key details for keyId:', keyId);
        setLoading(true);
        const response = await invoke('get_bitcoin_key_details', { keyId });
        console.log('Key details response:', response);
        console.log('Response type:', typeof response);
        console.log('Response keys:', Object.keys(response as any));
        setBitcoinKey(response as BitcoinKey);
        console.log('BitcoinKey state set successfully');
      } catch (error) {
        console.error('Failed to fetch key details:', error);
        setError('Failed to load key details');
      } finally {
        setLoading(false);
        console.log('Loading set to false');
      }
    };

    fetchKeyDetails();
  }, [keyId]);

  useEffect(() => {
    const fetchReceivingAddresses = async () => {
      if (!keyId) return;
      
      try {
        const response = await invoke('list_receiving_addresses', { keyId });
        console.log('Receiving addresses response:', response);
        setReceivingAddresses(response as any[]);
      } catch (error) {
        console.error('Failed to fetch receiving addresses:', error);
      }
    };

    fetchReceivingAddresses();
  }, [keyId]);

  const handleShowPrivateKey = async () => {
    const password = prompt('Enter password to decrypt private key:');
    if (!password) return;

    try {
      const result = await invoke('decrypt_private_key', { keyId, password }) as string;
      setDecryptedPrivateKey(result);
      setShowPrivateKey(true);
    } catch (error) {
      setError('Failed to decrypt private key. Check your password.');
    }
  };

  const handleHidePrivateKey = () => {
    setShowPrivateKey(false);
    setDecryptedPrivateKey('');
  };

  const handleGenerateReceivingAddress = async () => {
    const label = prompt('Enter a label for this receiving address (optional):');
    
    try {
      setGeneratingAddress(true);
      const response = await invoke('generate_receiving_address', { 
        keyId, 
        label: label || null 
      });
      const newAddress = response as ReceivingAddress;
      
      setReceivingAddresses(prev => [...prev, newAddress]);
      setSuccess('Receiving address generated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to generate receiving address:', error);
      setError('Failed to generate receiving address');
      setTimeout(() => setError(''), 3000);
    } finally {
      setGeneratingAddress(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setSuccess(`${label} copied to clipboard!`);
    setTimeout(() => setSuccess(''), 2000);
  };

  const formatPublicKey = (publicKey: string, truncate: boolean = true) => {
    if (!publicKey) return 'N/A';
    
    try {
      const bytes = atob(publicKey);
      const hex = Array.from(bytes, (byte) => 
        byte.charCodeAt(0).toString(16).padStart(2, '0')
      ).join('');
      
      return truncate ? `${hex.slice(0, 8)}...${hex.slice(-8)}` : hex;
    } catch (error) {
      return 'N/A';
    }
  };

  const getKeyTypeInfo = (keyType: string) => {
    const types = {
      legacy: { name: 'Legacy (P2PKH)', icon: '🏛️', prefix: '1' },
      segwit: { name: 'SegWit (P2SH-P2WPKH)', icon: '⚡', prefix: '3' },
      native: { name: 'Native SegWit (P2WPKH)', icon: '🆕', prefix: 'bc1' },
      multisig: { name: 'MultiSig (P2SH)', icon: '🔐', prefix: '3' },
      taproot: { name: 'Taproot (P2TR)', icon: '🌳', prefix: 'bc1p' }
    };
    return types[keyType as keyof typeof types] || types.native;
  };

  const getNetworkInfo = (network: string) => {
    const networks = {
      mainnet: { name: 'Bitcoin Mainnet', color: 'bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-200' },
      testnet: { name: 'Bitcoin Testnet', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-200' },
      regtest: { name: 'Regression Test', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-200' }
    };
    return networks[network as keyof typeof networks] || networks.testnet;
  };

  console.log('Render state - loading:', loading, 'bitcoinKey:', bitcoinKey, 'error:', error);

  if (loading) {
    console.log('Rendering loading state');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading key details...</p>
        </div>
      </div>
    );
  }

  if (!bitcoinKey) {
    console.log('Rendering key not found state');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-bold mb-2">Key Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested Bitcoin key could not be found.</p>
          <Button onClick={() => navigate('/bitcoin-keys')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Keys
          </Button>
        </div>
      </div>
    );
  }

  console.log('Rendering main content with bitcoinKey:', bitcoinKey);

  const keyTypeInfo = getKeyTypeInfo(bitcoinKey.keyType);
  const networkInfo = getNetworkInfo(bitcoinKey.network);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-6xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/bitcoin-keys')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Keys
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Bitcoin className="h-8 w-8 text-orange-500" />
              Bitcoin Key Details
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage receiving addresses and key information
            </p>
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Key Information Panel */}
          <div className="xl:col-span-1 space-y-6">
            
            {/* Key Overview */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Key Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Primary Address */}
                <div>
                  <Label className="text-sm font-medium">Primary Address</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-muted p-2 rounded text-sm font-mono break-all">
                      {bitcoinKey.address}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(bitcoinKey.address, 'Address')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Key Type & Network */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Type</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg">{keyTypeInfo.icon}</span>
                      <div>
                        <div className="font-medium text-sm">{keyTypeInfo.name}</div>
                        <div className="text-xs text-muted-foreground">{keyTypeInfo.prefix}xxx</div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Network</Label>
                    <Badge className={`mt-1 ${networkInfo.color}`}>
                      {networkInfo.name}
                    </Badge>
                  </div>
                </div>

                {/* Security Info */}
                <div className="bg-accent/30 p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-medium text-sm">Quantum Enhanced</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Entropy: {bitcoinKey.entropySource} • Created: {new Date(bitcoinKey.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Public Key */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Public Key</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(formatPublicKey(bitcoinKey.publicKey, false), 'Public Key')}
                      className="text-xs h-7"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <code className="block bg-muted p-2 rounded text-xs font-mono break-all">
                    {formatPublicKey(bitcoinKey.publicKey)}
                  </code>
                </div>

                {/* Private Key */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Private Key</Label>
                    <div className="flex gap-2">
                      {!showPrivateKey ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleShowPrivateKey}
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
                            onClick={() => copyToClipboard(decryptedPrivateKey, 'Private Key')}
                            className="text-xs h-7"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleHidePrivateKey}
                            className="text-xs h-7"
                          >
                            <EyeOff className="h-3 w-3 mr-1" />
                            Hide
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {showPrivateKey && decryptedPrivateKey ? (
                    <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-2 rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                        <span className="text-red-600 dark:text-red-400 text-xs font-medium">SENSITIVE DATA</span>
                      </div>
                      <code className="font-mono text-xs break-all">
                        {decryptedPrivateKey}
                      </code>
                    </div>
                  ) : (
                    <code className="block bg-muted p-2 rounded text-xs font-mono text-muted-foreground">
                      ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
                    </code>
                  )}
                </div>

              </CardContent>
            </Card>

          </div>

          {/* Receiving Addresses Panel */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Receiving Addresses Header */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Receiving Addresses
                    </CardTitle>
                    <CardDescription>
                      Generate multiple receiving addresses from this key for enhanced privacy
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleGenerateReceivingAddress}
                    disabled={generatingAddress}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {generatingAddress ? 'Generating...' : 'New Address'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                
                {/* Primary Address (Always First) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Hash className="h-4 w-4" />
                    Primary Address (Index 0)
                  </div>
                  
                  <Card className="border-l-4 border-l-orange-500 bg-card/80 dark:bg-card/60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Bitcoin className="h-4 w-4 text-orange-500" />
                            <Badge variant="secondary">Primary</Badge>
                            <Badge variant="outline">{keyTypeInfo.name}</Badge>
                          </div>
                          <code className="text-sm font-mono break-all">
                            {bitcoinKey.address}
                          </code>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                            <span>Created: {new Date(bitcoinKey.createdAt).toLocaleDateString()}</span>
                            <span>Balance: {bitcoinKey.balanceSatoshis || 0} sats</span>
                            <span>Txs: {bitcoinKey.transactionCount || 0}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(bitcoinKey.address, 'Address')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <QrCode className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Additional Receiving Addresses */}
                {receivingAddresses.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Hash className="h-4 w-4" />
                      Additional Receiving Addresses ({receivingAddresses.length})
                    </div>
                    
                    {receivingAddresses.map((address, index) => (
                      <Card key={address.id} className="border-l-4 border-l-blue-500 bg-card/80 dark:bg-card/60">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Wallet className="h-4 w-4 text-blue-500" />
                                <Badge variant="outline">Index {address.derivationIndex}</Badge>
                                {address.label && <Badge variant="secondary">{address.label}</Badge>}
                              </div>
                              <code className="text-sm font-mono break-all">
                                {address.address}
                              </code>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                <span>Path: {address.derivationPath}</span>
                                <span>Created: {new Date(address.createdAt).toLocaleDateString()}</span>
                                <span>Balance: {address.balanceSatoshis || 0} sats</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(address.address, 'Address')}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <QrCode className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Additional Addresses</h3>
                    <p className="text-muted-foreground mb-4">
                      Generate additional receiving addresses for enhanced privacy and organization.
                    </p>
                    <Button onClick={handleGenerateReceivingAddress} disabled={generatingAddress}>
                      <Plus className="h-4 w-4 mr-2" />
                      Generate First Address
                    </Button>
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
