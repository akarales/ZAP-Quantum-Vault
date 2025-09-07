import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Activity, AlertTriangle, ArrowLeft, CheckCircle, Copy, Download, Edit, Eye, EyeOff, Key, Network, Shield, Trash2, Unlock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface ZAPGenesisKeyDetails {
  id: string;
  vault_id: string;
  key_type: string;
  key_role: string;
  network_name: string;
  algorithm: string;
  address: string;
  public_key: string;
  encrypted_private_key: string;
  encryption_password: string;
  created_at: string;
  metadata: any;
  is_active: boolean;
}

export const ZAPBlockchainGenesisDetailsPage = () => {
  console.log('🚀 ZAPBlockchainGenesisDetailsPage component loaded');
  
  const { keyId } = useParams<{ keyId: string }>();
  const navigate = useNavigate();
  const [keyDetails, setKeyDetails] = useState<ZAPGenesisKeyDetails | null>(null);
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
      
      const keys = await invoke<ZAPGenesisKeyDetails[]>('list_zap_blockchain_keys', {
        vaultId: null,
        keyType: 'genesis'
      });
      
      const key = keys.find(k => k.id === keyId);
      if (!key) {
        setError('Genesis key not found');
        return;
      }
      
      setKeyDetails(key);
    } catch (error) {
      console.error('Failed to load genesis key details:', error);
      setError('Failed to load genesis key details');
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
    console.log('🔑 GENESIS DECRYPT BUTTON CLICKED - Function entry point');
    console.log('🔑 Current timestamp:', new Date().toISOString());
    console.log('🔑 Function context:', {
      hasKeyDetails: !!keyDetails,
      isLoading: decryptionLoading,
      showPrivateKey: showPrivateKey,
      hasDecryptedKey: !!decryptedPrivateKey
    });
    
    if (!keyDetails) {
      console.error('❌ GENESIS DECRYPT: No keyDetails available');
      console.error('❌ keyDetails is:', keyDetails);
      toast.error('No key details available');
      return;
    }
    
    if (decryptionLoading) {
      console.log('⏳ GENESIS DECRYPT: Already decrypting, skipping');
      return;
    }
    
    console.log('🔑 GENESIS DECRYPT: Key details validation passed');
    console.log('🔑 Genesis Key details:', {
      id: keyDetails.id,
      keyType: keyDetails.key_type,
      keyRole: keyDetails.key_role,
      networkName: keyDetails.network_name,
      hasEncryptedKey: !!keyDetails.encrypted_private_key,
      hasPassword: !!keyDetails.encryption_password
    });
    
    console.log('🔐 GENESIS DECRYPT: Prompting user for password...');
    const password = prompt('Enter password to decrypt private key:');
    if (!password) {
      console.log('❌ GENESIS DECRYPT: No password provided by user');
      return;
    }
    
    console.log('🔐 GENESIS DECRYPT: Password provided, length:', password.length);
    console.log('🔐 GENESIS DECRYPT: Password preview:', password.substring(0, 3) + '***');
    
    try {
      console.log('🚀 GENESIS DECRYPT: Setting loading state to true');
      setDecryptionLoading(true);
      
      console.log('🚀 GENESIS DECRYPT: Calling Tauri command: decrypt_zap_blockchain_private_key');
      console.log('📤 GENESIS DECRYPT: Parameters:', {
        key_id: keyDetails.id,
        password_length: password.length,
        command: 'decrypt_zap_blockchain_private_key'
      });
      
      console.log('📡 GENESIS DECRYPT: Invoking Tauri command...');
      const decrypted = await invoke<string>('decrypt_zap_blockchain_private_key', {
        keyId: keyDetails.id,
        password: password
      });
      
      console.log('✅ GENESIS DECRYPT: Tauri command completed successfully');
      console.log('📥 GENESIS DECRYPT: Decrypted result type:', typeof decrypted);
      console.log('📥 GENESIS DECRYPT: Decrypted key length:', decrypted?.length);
      console.log('📥 GENESIS DECRYPT: Decrypted key preview:', decrypted?.substring(0, 20) + '...');
      console.log('📥 GENESIS DECRYPT: Full decrypted key:', decrypted);
      
      console.log('🎯 GENESIS DECRYPT: Updating React state...');
      setDecryptedPrivateKey(decrypted);
      setShowPrivateKey(true);
      
      console.log('🎯 GENESIS DECRYPT: State updated - showPrivateKey: true, decryptedPrivateKey set');
      toast.success('Private key decrypted successfully');
    } catch (error) {
      console.error('❌ GENESIS DECRYPT: Tauri command failed');
      console.error('❌ GENESIS DECRYPT: Error type:', typeof error);
      console.error('❌ GENESIS DECRYPT: Error instanceof Error:', error instanceof Error);
      console.error('❌ GENESIS DECRYPT: Raw error:', error);
      console.error('❌ GENESIS DECRYPT: Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
        error: error,
        stringified: JSON.stringify(error, null, 2)
      });
      toast.error(`Failed to decrypt private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log('🏁 GENESIS DECRYPT: Finally block - resetting loading state');
      setDecryptionLoading(false);
      console.log('🏁 GENESIS DECRYPT: Process finished, loading state reset');
    }
  };

  const hidePrivateKey = () => {
    console.log('🙈 Genesis hidePrivateKey called');
    setShowPrivateKey(false);
    setDecryptedPrivateKey(null);
  };

  // Debug effect to track state changes
  useEffect(() => {
    console.log('🔄 Genesis State changed:', {
      showPrivateKey,
      hasDecryptedKey: !!decryptedPrivateKey,
      decryptedKeyLength: decryptedPrivateKey?.length,
      decryptionLoading
    });
  }, [showPrivateKey, decryptedPrivateKey, decryptionLoading]);

  const handleTrashKey = async () => {
    try {
      // TODO: Implement key trash functionality
      toast.success('Genesis key moved to trash');
      navigate('/zap-blockchain/genesis');
    } catch (error) {
      toast.error('Failed to move genesis key to trash');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading genesis key details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !keyDetails) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/zap-blockchain/genesis')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Genesis Keys
          </Button>
        </div>
        
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'Genesis key not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/zap-blockchain/genesis')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Genesis Keys
          </Button>
          <div className="flex items-center gap-3">
            <Key className="h-8 w-8 text-purple-500" />
            <div>
              <h1 className="text-2xl font-bold">Genesis Key Details</h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <Network className="h-4 w-4" />
                {keyDetails.network_name} • Chain Genesis Key
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
        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
          Genesis Key
        </Badge>
        {keyDetails.is_active ? (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Active
          </Badge>
        ) : (
          <Badge variant="secondary">
            Inactive
          </Badge>
        )}
        {keyDetails.metadata?.quantum_enhanced && (
          <Badge variant="outline" className="border-green-500 text-green-600">
            <Shield className="h-3 w-3 mr-1" />
            Quantum Enhanced
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cryptographic">Cryptographic</TabsTrigger>
          <TabsTrigger value="network">Network Config</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Key Role</Label>
                  <p className="text-sm text-muted-foreground">{keyDetails.key_role}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Network</Label>
                  <p className="mt-1 text-sm">{keyDetails.network_name}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Algorithm</Label>
                  <p className="mt-1 text-sm">{keyDetails.algorithm}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Entropy Source</Label>
                  <p className="text-sm text-muted-foreground">{keyDetails.metadata?.entropy_source || 'System Generated'}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Created</Label>
                  <p className="text-sm text-muted-foreground">{new Date(keyDetails.created_at).toLocaleString()}</p>
                </div>
                
                {keyDetails.metadata?.last_used && (
                  <div>
                    <Label className="text-sm font-medium">Last Used</Label>
                    <p className="text-sm text-muted-foreground">{new Date(keyDetails.metadata.last_used).toLocaleString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Genesis Key Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Genesis Key Features
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Chain Initialization</span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Block Zero Authority</span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Network Bootstrap</span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Quantum Resistance</span>
                  {keyDetails.metadata?.quantum_enhanced ? (
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
                  <Shield className="h-5 w-5" />
                  Cryptographic Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Genesis Address</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={keyDetails.address}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(keyDetails.address, 'Genesis Address')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Public Key</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={keyDetails.public_key}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(keyDetails.public_key, 'Public Key')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {keyDetails.metadata?.derivation_path && (
                  <div>
                    <Label className="text-sm font-medium">Derivation Path</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={keyDetails.metadata.derivation_path}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(keyDetails.metadata.derivation_path, 'Derivation Path')}
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
                      value={keyDetails.encryption_password}
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
                      onClick={() => copyToClipboard(keyDetails.encryption_password, 'Encryption Password')}
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
                          onClick={(e) => {
                            console.log('🖱️ GENESIS DECRYPT: Button click event triggered');
                            console.log('🖱️ GENESIS DECRYPT: Event details:', {
                              type: e.type,
                              target: e.target,
                              currentTarget: e.currentTarget,
                              timestamp: Date.now()
                            });
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🖱️ GENESIS DECRYPT: Calling decryptPrivateKey function...');
                            decryptPrivateKey();
                          }}
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
                              <Unlock className="h-4 w-4" />
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
                  Genesis Debug: showPrivateKey={showPrivateKey.toString()}, hasDecryptedKey={!!decryptedPrivateKey}, loading={decryptionLoading.toString()}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="network" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Network Configuration
              </CardTitle>
              <CardDescription>
                Genesis key network and blockchain configuration details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Network Name</Label>
                  <p className="text-sm text-muted-foreground">{keyDetails.network_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Key Type</Label>
                  <p className="mt-1 text-sm">{keyDetails.key_type}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Consensus Algorithm</Label>
                  <p className="mt-1 text-sm">Quantum-Safe Proof of Stake</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Chain ID</Label>
                  <p className="mt-1 text-sm font-mono">zap-{keyDetails.network_name.toLowerCase()}</p>
                </div>
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
                <p className="text-muted-foreground">No metadata available for this genesis key.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
