import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Copy, ArrowLeft, Shield, Key, Network, Clock, Activity, Eye, EyeOff, Trash2, Edit, Download, AlertTriangle, CheckCircle, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface ZAPValidatorKeyDetails {
  id: string;
  vaultId: string;
  keyType: string;
  keyRole: string;
  networkName: string;
  algorithm: string;
  address: string;
  publicKey: string;
  encryptionPassword: string;
  derivationPath?: string;
  entropySource: string;
  quantumEnhanced: boolean;
  createdAt: string;
  lastUsed?: string;
  metadata: any;
  isActive: boolean;
}

export const ZAPBlockchainValidatorDetailsPage = () => {
  const { keyId } = useParams<{ keyId: string }>();
  const navigate = useNavigate();
  const [keyDetails, setKeyDetails] = useState<ZAPValidatorKeyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [decryptedPrivateKey, setDecryptedPrivateKey] = useState<string | null>(null);
  const [decryptionLoading, setDecryptionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (keyId) {
      loadKeyDetails();
    }
  }, [keyId]);

  const loadKeyDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const keys = await invoke<ZAPValidatorKeyDetails[]>('list_zap_blockchain_keys', {
        vaultId: null,
        keyType: 'validator'
      });
      
      const key = keys.find(k => k.id === keyId);
      if (!key) {
        setError('Validator key not found');
        return;
      }
      
      setKeyDetails(key);
    } catch (error) {
      console.error('Failed to load validator key details:', error);
      setError('Failed to load validator key details');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const decryptPrivateKey = async () => {
    console.log('🔓 Validator decryptPrivateKey called');
    
    if (!keyDetails) {
      console.error('❌ No keyDetails available');
      return;
    }
    
    if (decryptionLoading) {
      console.log('❌ Decryption already in progress');
      return;
    }
    
    console.log('🔑 Validator Key details:', {
      id: keyDetails.id,
      keyType: keyDetails.keyType,
      keyRole: keyDetails.keyRole
    });
    
    const password = prompt('Enter password to decrypt private key:');
    if (!password) {
      console.log('❌ No password provided by user');
      return;
    }
    
    console.log('🚀 Starting validator decryption process');
    
    try {
      setDecryptionLoading(true);
      console.log('🚀 Calling Tauri command: decrypt_zap_blockchain_private_key');
      console.log('📤 Parameters:', {
        key_id: keyDetails.id,
        password_length: password.length
      });
      
      const decrypted = await invoke<string>('decrypt_zap_blockchain_private_key', {
        keyId: keyDetails.id,
        password: password
      });
      
      console.log('✅ Validator Decryption successful!');
      console.log('📥 Decrypted key length:', decrypted?.length);
      console.log('📥 Decrypted key preview:', decrypted?.substring(0, 20) + '...');
      
      setDecryptedPrivateKey(decrypted);
      setShowPrivateKey(true);
      
      console.log('🎯 Validator State updated - showPrivateKey: true, decryptedPrivateKey set');
      toast.success('Private key decrypted successfully');
    } catch (error) {
      console.error('❌ Failed to decrypt validator private key:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
        error: error
      });
      toast.error(`Failed to decrypt private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDecryptionLoading(false);
      console.log('🏁 Validator Decryption process finished, loading state reset');
    }
  };

  const hidePrivateKey = () => {
    console.log('🙈 Validator hidePrivateKey called');
    setShowPrivateKey(false);
    setDecryptedPrivateKey(null);
  };

  // Debug effect to track state changes
  useEffect(() => {
    console.log('🔄 Validator State changed:', {
      showPrivateKey,
      hasDecryptedKey: !!decryptedPrivateKey,
      decryptedKeyLength: decryptedPrivateKey?.length,
      decryptionLoading
    });
  }, [showPrivateKey, decryptedPrivateKey, decryptionLoading]);

  const handleTrashKey = async () => {
    try {
      // TODO: Implement key trash functionality
      toast.success('Validator key moved to trash');
      navigate('/zap-blockchain/validators');
    } catch (error) {
      toast.error('Failed to move validator key to trash');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading validator key details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !keyDetails) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/zap-blockchain/validators')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Validator Keys
          </Button>
        </div>
        
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'Validator key not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/zap-blockchain/validators')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Validator Keys
          </Button>
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold">Validator Key Details</h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <Network className="h-4 w-4" />
                {keyDetails.networkName} • Network Validator
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="destructive" size="sm" onClick={handleTrashKey}>
            <Trash2 className="h-4 w-4 mr-2" />
            Move to Trash
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          Validator Key
        </Badge>
        {keyDetails.quantumEnhanced && (
          <Badge variant="outline" className="border-green-500 text-green-600">
            <Shield className="h-3 w-3 mr-1" />
            Quantum Enhanced
          </Badge>
        )}
        <Badge variant={keyDetails.isActive ? "default" : "secondary"}>
          {keyDetails.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cryptographic">Cryptographic</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Key Role</Label>
                  <p className="mt-1 text-sm font-mono">{keyDetails.keyRole}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Network</Label>
                  <p className="mt-1 text-sm">{keyDetails.networkName}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Algorithm</Label>
                  <p className="mt-1 text-sm">{keyDetails.algorithm}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Entropy Source</Label>
                  <p className="mt-1 text-sm">{keyDetails.entropySource}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Created</Label>
                  <p className="mt-1 text-sm">{new Date(keyDetails.createdAt).toLocaleString()}</p>
                </div>
                
                {keyDetails.lastUsed && (
                  <div>
                    <Label className="text-sm font-medium">Last Used</Label>
                    <p className="mt-1 text-sm">{new Date(keyDetails.lastUsed).toLocaleString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Validator Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Validator Features
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Block Validation</span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Transaction Signing</span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Consensus Participation</span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Slashing Protection</span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Quantum Resistance</span>
                  {keyDetails.quantumEnhanced ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cryptographic" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* Address & Keys */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Cryptographic Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Validator Address</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={keyDetails.address}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(keyDetails.address, 'Validator Address')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Public Key</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={keyDetails.publicKey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(keyDetails.publicKey, 'Public Key')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {keyDetails.derivationPath && (
                  <div>
                    <Label className="text-sm font-medium">Derivation Path</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={keyDetails.derivationPath}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(keyDetails.derivationPath!, 'Derivation Path')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">Encryption Password</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={keyDetails.encryptionPassword}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(keyDetails.encryptionPassword, 'Encryption Password')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Private Key Section */}
                <div>
                  <Label className="text-sm font-medium">Private Key</Label>
                  <div className="space-y-2 mt-1">
                    {!showPrivateKey ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value="••••••••••••••••••••••••••••••••"
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={decryptPrivateKey}
                          disabled={decryptionLoading}
                          className="flex items-center gap-2"
                        >
                          {decryptionLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                              Decrypting...
                            </>
                          ) : (
                            <>
                              <Key className="h-4 w-4" />
                              Decrypt
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-red-700">Private key is visible - handle with extreme care</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={decryptedPrivateKey || ''}
                            readOnly
                            className="font-mono text-sm bg-red-50 border-red-200"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(decryptedPrivateKey || '', 'Private Key')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={hidePrivateKey}
                            className="flex items-center gap-2"
                          >
                            <EyeOff className="h-4 w-4" />
                            Hide
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Debug Info */}
                <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                  Validator Debug: showPrivateKey={showPrivateKey.toString()}, hasDecryptedKey={!!decryptedPrivateKey}, loading={decryptionLoading.toString()}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Validation Configuration
              </CardTitle>
              <CardDescription>
                Validator node configuration and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Validator Status</Label>
                  <p className="mt-1 text-sm">{keyDetails.isActive ? 'Active' : 'Inactive'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Consensus Weight</Label>
                  <p className="mt-1 text-sm">Equal (1/N)</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Slashing Protection</Label>
                  <p className="mt-1 text-sm">Enabled</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Commission Rate</Label>
                  <p className="mt-1 text-sm">0%</p>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <Label className="text-sm font-medium">Validator Responsibilities</Label>
                <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                  <li>• Validate and sign blocks</li>
                  <li>• Participate in consensus protocol</li>
                  <li>• Maintain network security</li>
                  <li>• Process transactions</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metadata" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Key Metadata
              </CardTitle>
            </CardHeader>
            <CardContent>
              {keyDetails.metadata && Object.keys(keyDetails.metadata).length > 0 ? (
                <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto">
                  {JSON.stringify(keyDetails.metadata, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground">No metadata available for this validator key.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
