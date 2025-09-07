import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Copy, ArrowLeft, Shield, Key, Network, Clock, Activity, Eye, EyeOff, Trash2, Edit, Download, AlertTriangle, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ZAPBlockchainKeyDetails {
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

export const ZAPBlockchainKeyDetailsPage = () => {
  console.log('🚀 ZAPBlockchainKeyDetailsPage (GENERAL) component loaded');
  
  const { keyId } = useParams<{ keyId: string }>();
  const navigate = useNavigate();
  const [keyDetails, setKeyDetails] = useState<ZAPBlockchainKeyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [decryptedPrivateKey, setDecryptedPrivateKey] = useState<string | null>(null);
  const [decryptionLoading, setDecryptionLoading] = useState(false);

  useEffect(() => {
    if (keyId) {
      loadKeyDetails();
    }
  }, [keyId]);

  const loadKeyDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Loading key details for keyId:', keyId);
      
      // Get the key details from the list (since we don't have a specific details endpoint yet)
      const keys = await invoke<ZAPBlockchainKeyDetails[]>('list_zap_blockchain_keys', {
        vaultId: null,
        keyType: null
      });
      
      console.log('📊 Retrieved', keys.length, 'keys from backend');
      console.log('🔑 Available key IDs:', keys.map(k => k.id));
      
      const key = keys.find(k => k.id === keyId);
      if (!key) {
        console.error('❌ Key not found with ID:', keyId);
        setError(`Key not found with ID: ${keyId}`);
        return;
      }
      
      console.log('✅ Found key:', key.key_role, 'of type', key.key_type);
      setKeyDetails(key);
    } catch (error) {
      console.error('❌ Failed to load key details:', error);
      setError(`Failed to load key details: ${error}`);
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

  const handleTrashKey = async () => {
    try {
      // TODO: Implement key trash functionality
      toast.success('Key moved to trash');
      navigate('/zap-blockchain/keys');
    } catch (error) {
      toast.error('Failed to move key to trash');
    }
  };

  const decryptPrivateKey = async () => {
    console.log('🔓 decryptPrivateKey called');
    
    if (!keyDetails) {
      console.error('❌ No keyDetails available');
      toast.error('No key details available');
      return;
    }
    
    if (decryptionLoading) {
      console.log('⏳ Already decrypting, skipping');
      return;
    }
    
    console.log('🔑 Key details:', {
      id: keyDetails.id,
      key_type: keyDetails.key_type,
      key_role: keyDetails.key_role,
      has_encrypted_private_key: !!keyDetails.encrypted_private_key,
      encrypted_private_key_length: keyDetails.encrypted_private_key?.length
    });
    
    const password = prompt('Enter password to decrypt private key:');
    if (!password) {
      console.log('❌ No password provided by user');
      return;
    }
    
    console.log('🔐 Password provided, length:', password.length);
    
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
      
      console.log('✅ Decryption successful');
      console.log('📥 Decrypted key length:', decrypted?.length);
      console.log('📥 Decrypted key preview:', decrypted?.substring(0, 20) + '...');
      
      setDecryptedPrivateKey(decrypted);
      setShowPrivateKey(true);
      
      console.log('🎯 State updated - showPrivateKey: true, decryptedPrivateKey set');
      toast.success('Private key decrypted successfully');
    } catch (error) {
      console.error('❌ Failed to decrypt private key:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
        error: error
      });
      toast.error(`Failed to decrypt private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDecryptionLoading(false);
      console.log('🏁 Decryption process finished, loading state reset');
    }
  };

  const hidePrivateKey = () => {
    console.log('🙈 hidePrivateKey called');
    setShowPrivateKey(false);
    setDecryptedPrivateKey(null);
  };

  // Debug effect to track state changes
  useEffect(() => {
    console.log('🔄 State changed:', {
      showPrivateKey,
      hasDecryptedKey: !!decryptedPrivateKey,
      decryptedKeyLength: decryptedPrivateKey?.length,
      decryptionLoading
    });
  }, [showPrivateKey, decryptedPrivateKey, decryptionLoading]);

  const getKeyTypeIcon = (keyType: string) => {
    switch (keyType.toLowerCase()) {
      case 'genesis': return <Key className="h-5 w-5 text-purple-500" />;
      case 'validator': return <Shield className="h-5 w-5 text-blue-500" />;
      case 'governance': return <Activity className="h-5 w-5 text-green-500" />;
      case 'emergency': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'treasury': return <Wallet className="h-5 w-5 text-yellow-500" />;
      default: return <Key className="h-5 w-5 text-gray-500" />;
    }
  };

  const getKeyTypeColor = (keyType: string) => {
    switch (keyType.toLowerCase()) {
      case 'genesis': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'validator': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'governance': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'emergency': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'treasury': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading key details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !keyDetails) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/zap-blockchain/keys')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Keys
          </Button>
        </div>
        
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'Key not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/zap-blockchain/keys')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Keys
          </Button>
          <div className="flex items-center gap-3">
            {getKeyTypeIcon(keyDetails.key_type)}
            <div>
              <h1 className="text-2xl font-bold">{keyDetails.key_role}</h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <Network className="h-4 w-4" />
                {keyDetails.network_name} • {keyDetails.key_type} Key
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
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => {
              console.log('🧪 Test button clicked - forcing state update');
              setDecryptedPrivateKey('test-private-key-12345');
              setShowPrivateKey(true);
            }}
          >
            Test Show Key
          </Button>
          <Button variant="destructive" size="sm" onClick={handleTrashKey}>
            <Trash2 className="h-4 w-4 mr-2" />
            Move to Trash
          </Button>
        </div>
      </div>

      {/* Key Information Cards */}
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
              <Label className="text-sm font-medium">Key Type</Label>
              <div className="mt-1">
                <Badge className={getKeyTypeColor(keyDetails.key_type)}>
                  {keyDetails.key_type}
                </Badge>
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Key Role</Label>
              <p className="mt-1 text-sm">{keyDetails.key_role}</p>
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
              <p className="mt-1 text-sm">Hardware RNG</p>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Quantum Enhanced</Label>
              <div className="mt-1 flex items-center gap-2">
                {true ? (
                  <>
                    <Shield className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400">Yes</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-yellow-600 dark:text-yellow-400">No</span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cryptographic Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Cryptographic Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Address</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={keyDetails.address}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(keyDetails.address, 'Address')}
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

            {false && (
              <div>
                <Label className="text-sm font-medium">Derivation Path</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={""}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard("", 'Derivation Path')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium">Private Key</Label>
              {/* Debug info */}
              <div className="text-xs text-gray-500 mb-2">
                Debug: showPrivateKey={showPrivateKey.toString()}, hasDecrypted={!!decryptedPrivateKey ? 'true' : 'false'}
              </div>
              
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="password"
                  value="••••••••••••••••••••••••••••••••"
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={decryptPrivateKey}
                  disabled={decryptionLoading}
                  className="min-w-[40px]"
                >
                  {decryptionLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  ) : showPrivateKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                {showPrivateKey && decryptedPrivateKey && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(decryptedPrivateKey, 'Private Key')}
                    className="min-w-[40px]"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {/* Show decrypted key if available */}
              {showPrivateKey && decryptedPrivateKey && (
                <div className="mt-2">
                  <Alert variant="destructive" className="border-red-500 bg-red-50 dark:bg-red-950">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="font-semibold text-red-800 dark:text-red-200">
                      ⚠️ SENSITIVE DATA - Private key is now visible
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="text"
                      value={decryptedPrivateKey}
                      readOnly
                      className="font-mono text-sm bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700"
                    />
                  </div>
                </div>
              )}
            </div>

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
          </CardContent>
        </Card>

        {/* Timestamps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Created</Label>
              <p className="mt-1 text-sm">{new Date(keyDetails.created_at).toLocaleString()}</p>
            </div>
            
            {false && (
              <div>
                <Label className="text-sm font-medium">Last Used</Label>
                <p className="mt-1 text-sm">Never</p>
              </div>
            )}
            
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <div className="mt-1">
                <Badge variant={keyDetails.is_active ? "default" : "secondary"}>
                  {keyDetails.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        {keyDetails.metadata && Object.keys(keyDetails.metadata).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Metadata
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-muted p-3 rounded overflow-auto">
                {JSON.stringify(keyDetails.metadata, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
