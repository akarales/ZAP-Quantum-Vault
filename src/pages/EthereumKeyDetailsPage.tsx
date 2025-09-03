import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft, Copy, Eye, EyeOff, Shield, Key, Calendar, Network, Trash2, Download, QrCode, AlertTriangle, CheckCircle, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

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
  encryptionPassword?: string;
}

export const EthereumKeyDetailsPage = () => {
  const { keyId } = useParams<{ keyId: string }>();
  const navigate = useNavigate();
  
  const [ethereumKey, setEthereumKey] = useState<EthereumKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [decryptedPrivateKey, setDecryptedPrivateKey] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadEthereumKey();
  }, [keyId]);

  const loadEthereumKey = async () => {
    if (!keyId) return;
    
    try {
      setLoading(true);
      const key = await invoke('get_ethereum_key_details', { keyId }) as EthereumKey;
      setEthereumKey(key);
    } catch (error) {
      console.error('Failed to load Ethereum key:', error);
      setError(`Failed to load key details: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDecryptPrivateKey = async () => {
    if (!password || !keyId) {
      setError('Password is required');
      return;
    }

    try {
      const result = await invoke('decrypt_ethereum_private_key', { keyId, password }) as string;
      setDecryptedPrivateKey(result);
      setShowPrivateKey(true);
      setSuccess('Private key decrypted successfully');
      setError('');
    } catch (error) {
      console.error('Failed to decrypt private key:', error);
      setError('Failed to decrypt private key. Check your password.');
      setSuccess('');
    }
  };

  const handleHidePrivateKey = () => {
    setShowPrivateKey(false);
    setDecryptedPrivateKey('');
    setPassword('');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setSuccess(`${label} copied to clipboard!`);
    setTimeout(() => setSuccess(''), 2000);
  };

  const getNetworkInfo = (network: string) => {
    const networks = {
      mainnet: { name: 'Ethereum Mainnet', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' },
      sepolia: { name: 'Sepolia Testnet', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200' },
      goerli: { name: 'Goerli Testnet', color: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' }
    };
    return networks[network as keyof typeof networks] || networks.mainnet;
  };

  const getKeyTypeInfo = (keyType: string) => {
    const types = {
      standard: { name: 'Standard', description: 'Standard Ethereum key' },
      hd: { name: 'HD Wallet', description: 'Hierarchical Deterministic wallet' }
    };
    return types[keyType as keyof typeof types] || types.standard;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-16 w-16 mx-auto bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-2xl mb-4 animate-pulse">
            Ξ
          </div>
          <p className="text-muted-foreground">Loading Ethereum key details...</p>
        </div>
      </div>
    );
  }

  if (!ethereumKey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Key Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested Ethereum key could not be found.</p>
          <Button onClick={() => navigate('/ethereum-keys')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Keys
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-4xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/ethereum-keys')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Keys
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="h-8 w-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                Ξ
              </div>
              Ethereum Key Details
            </h1>
            <p className="text-muted-foreground mt-1">
              View and manage your quantum-enhanced Ethereum key
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

        {/* Key Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Key Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div>
                <Label className="text-sm font-medium">Ethereum Address</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted p-3 rounded-md text-sm font-mono">
                    {ethereumKey.address}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(ethereumKey.address, 'Address')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Key Type</Label>
                  <div className="mt-1">
                    <Badge variant="secondary">
                      {getKeyTypeInfo(ethereumKey.keyType).name}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Network</Label>
                  <div className="mt-1">
                    <Badge className={getNetworkInfo(ethereumKey.network).color}>
                      {getNetworkInfo(ethereumKey.network).name}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">
                    <Badge variant={ethereumKey.isActive ? "default" : "secondary"}>
                      {ethereumKey.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Security</Label>
                  <div className="mt-1">
                    {ethereumKey.quantumEnhanced && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200">
                        <Zap className="h-3 w-3 mr-1" />
                        Quantum Enhanced
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Created</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {new Date(ethereumKey.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {ethereumKey.lastUsed && (
                <div>
                  <Label className="text-sm font-medium">Last Used</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {new Date(ethereumKey.lastUsed).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {ethereumKey.encryptionPassword && (
                <div>
                  <Label className="text-sm font-medium">Encryption Password</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="relative flex-1">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={ethereumKey.encryptionPassword}
                        readOnly
                        className="pr-20 bg-muted"
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => copyToClipboard(ethereumKey.encryptionPassword!, 'Encryption password')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

          {/* Security & Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security & Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Private Key Access */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Private Key Access</Label>
                
                {!showPrivateKey ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter encryption password"
                        className="pr-12"
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
                    <Button 
                      onClick={handleDecryptPrivateKey}
                      disabled={!password}
                      className="w-full"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Decrypt & Show Private Key
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800 dark:text-red-200">
                          Private Key (Keep Secret!)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-background p-2 rounded text-xs font-mono break-all">
                          {decryptedPrivateKey}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(decryptedPrivateKey, 'Private key')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button 
                      onClick={handleHidePrivateKey}
                      variant="outline"
                      className="w-full"
                    >
                      <EyeOff className="h-4 w-4 mr-2" />
                      Hide Private Key
                    </Button>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-3 block">Actions</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm">
                    <QrCode className="h-4 w-4 mr-2" />
                    QR Code
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" className="col-span-2">
                    <Network className="h-4 w-4 mr-2" />
                    Network Info
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <Button 
                  variant="destructive" 
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (confirm('Are you sure you want to move this key to trash?')) {
                      // Handle delete
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Move to Trash
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Technical Details */}
        <Card>
          <CardHeader>
            <CardTitle>Technical Details</CardTitle>
            <CardDescription>
              Advanced information about this Ethereum key
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <Label className="text-sm font-medium">Key ID</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted p-2 rounded text-xs font-mono">
                    {ethereumKey.id}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(ethereumKey.id, 'Key ID')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Vault ID</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted p-2 rounded text-xs font-mono">
                    {ethereumKey.vaultId}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(ethereumKey.vaultId, 'Vault ID')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="md:col-span-2">
                <Label className="text-sm font-medium">Entropy Source</Label>
                <div className="mt-1">
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200">
                    <Zap className="h-3 w-3 mr-1" />
                    {ethereumKey.entropySource}
                  </Badge>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
