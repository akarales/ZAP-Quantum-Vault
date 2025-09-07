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
  Activity,
  Shield,
  AlertTriangle,
  Zap,
  Network,
  Edit,
  Download,
  Trash2,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface ZAPEmergencyKeyDetails {
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
  derivationPath?: string;
  entropySource: string;
  quantumEnhanced: boolean;
  created_at: string;
  lastUsed?: string;
  metadata: any;
  is_active: boolean;
}

export const ZAPBlockchainEmergencyDetailsPage = () => {
  console.log('🚀 ZAPBlockchainEmergencyDetailsPage component loaded');
  
  const { keyId } = useParams<{ keyId: string }>();
  const navigate = useNavigate();
  const [keyDetails, setKeyDetails] = useState<ZAPEmergencyKeyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [decryptedPrivateKey, setDecryptedPrivateKey] = useState<string | null>(null);
  const [decryptionLoading, setDecryptionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    console.log('🔄 useEffect triggered - keyId:', keyId);
    if (keyId) {
      loadKeyDetails();
    }
  }, [keyId]);

  const loadKeyDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Loading key details for keyId:', keyId);
      
      const keys = await invoke<ZAPEmergencyKeyDetails[]>('list_zap_blockchain_keys', {
        vaultId: null,
        keyType: 'emergency'
      });
      
      console.log('📋 All emergency keys loaded:', keys.length);
      console.log('📋 Keys data:', keys.map(k => ({ id: k.id, hasEncryptedKey: !!k.encrypted_private_key, passwordLength: k.encryption_password?.length })));
      
      const key = keys.find(k => k.id === keyId);
      console.log('🎯 Found target key:', !!key);
      
      if (key) {
        console.log('🔑 Key details:', {
          id: key.id,
          hasEncryptedPrivateKey: !!key.encrypted_private_key,
          encryptedKeyLength: key.encrypted_private_key?.length,
          hasPassword: !!key.encryption_password,
          passwordLength: key.encryption_password?.length,
          algorithm: key.algorithm,
          isActive: key.is_active
        });
      }
      if (!key) {
        setError('Emergency key not found');
        return;
      }
      
      setKeyDetails(key);
    } catch (error) {
      console.error('Failed to load emergency key details:', error);
      setError('Failed to load emergency key details');
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
      toast.success('Emergency key moved to trash');
      navigate('/zap-blockchain/emergency');
    } catch (error) {
      toast.error('Failed to move emergency key to trash');
    }
  };

  const decryptPrivateKey = async () => {
    console.log('🚀🔐 DECRYPT BUTTON CLICKED - Emergency decryptPrivateKey function called');
    console.log('🔍 Current component state:', {
      hasKeyDetails: !!keyDetails,
      keyId: keyDetails?.id,
      showPrivateKey,
      hasDecryptedKey: !!decryptedPrivateKey,
      decryptionLoading
    });
    
    if (!keyDetails) {
      console.error('❌ Emergency No keyDetails available');
      alert('No key details available');
      return;
    }
    
    if (decryptionLoading) {
      console.log('⏳ Already decrypting, skipping');
      return;
    }
    
    console.log('🔑 Key details available:', {
      id: keyDetails.id,
      hasEncryptedKey: !!keyDetails.encrypted_private_key,
      hasPassword: !!keyDetails.encryption_password,
      passwordLength: keyDetails.encryption_password?.length
    });
    
    const password = prompt('Enter password to decrypt private key:');
    if (!password) {
      console.log('❌ Emergency No password provided by user');
      return;
    }
    
    console.log('🔐 Password provided by user, length:', password.length);
    console.log('🔐 Stored password length:', keyDetails.encryption_password?.length);
    
    try {
      setDecryptionLoading(true);
      console.log('🚀 CALLING TAURI COMMAND: decrypt_zap_blockchain_private_key');
      console.log('📤 TAURI PARAMETERS:', {
        keyId: keyDetails.id,
        password: password.substring(0, 3) + '***',
        password_length: password.length
      });
      
      // Add a delay to ensure logs are visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const decrypted = await invoke<string>('decrypt_zap_blockchain_private_key', {
        keyId: keyDetails.id,
        password: password
      });
      
      console.log('✅ Emergency Decryption successful');
      console.log('📥 Decrypted key length:', decrypted?.length);
      console.log('📥 Decrypted key preview:', decrypted?.substring(0, 20) + '...');
      console.log('📥 Full decrypted key:', decrypted);
      console.log('📥 Key character codes:', decrypted?.split('').slice(0, 10).map(c => c.charCodeAt(0)));
      
      // Try multiple format detection approaches
      let finalKey = decrypted;
      
      // Check if it's already a valid hex key
      const isHex64 = /^[0-9a-fA-F]{64}$/.test(decrypted || '');
      const isHexWithPrefix = /^0x[0-9a-fA-F]{64}$/.test(decrypted || '');
      
      console.log('📥 Format analysis:', {
        isHex64,
        isHexWithPrefix,
        length: decrypted?.length,
        firstChars: decrypted?.substring(0, 10),
        lastChars: decrypted?.substring(-10)
      });
      
      if (isHex64 || isHexWithPrefix) {
        finalKey = isHexWithPrefix ? decrypted.substring(2) : decrypted;
        console.log('✅ Already valid hex format');
      } else {
        // Try base64 decode
        const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(decrypted || '');
        console.log('📥 Appears to be base64:', isBase64);
        
        if (isBase64 && decrypted) {
          try {
            const decoded = atob(decrypted);
            console.log('📥 Base64 decoded length:', decoded.length);
            
            // Convert to hex
            const hexKey = Array.from(decoded)
              .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
              .join('');
            console.log('📥 Hex conversion:', hexKey.substring(0, 20) + '...');
            console.log('📥 Hex length:', hexKey.length);
            
            if (hexKey.length === 64) {
              finalKey = hexKey;
              console.log('✅ Successfully converted base64 to 64-char hex key');
            } else {
              console.log('⚠️ Hex conversion resulted in', hexKey.length, 'chars, expected 64');
            }
          } catch (e) {
            console.log('❌ Base64 decode failed:', e);
          }
        } else {
          // Try WIF (Wallet Import Format) or other common formats
          if (decrypted?.length === 88) {
            console.log('📥 88-char format detected - might be WIF or custom encoding');
            
            // Try removing common prefixes/suffixes
            const trimmed = decrypted.replace(/^0x/, '').replace(/\s+/g, '');
            console.log('📥 Trimmed version:', trimmed.substring(0, 20) + '...');
            console.log('📥 Trimmed length:', trimmed.length);
            
            if (trimmed.length === 64 && /^[0-9a-fA-F]{64}$/.test(trimmed)) {
              finalKey = trimmed;
              console.log('✅ Successfully extracted 64-char hex from 88-char format');
            }
          }
          
          // Try direct hex conversion of string as fallback
          if (finalKey === decrypted) {
            try {
              const hexKey = Array.from(decrypted || '')
                .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('');
              console.log('📥 Direct hex conversion:', hexKey.substring(0, 20) + '...');
              console.log('📥 Direct hex length:', hexKey.length);
              
              if (hexKey.length === 64) {
                finalKey = hexKey;
                console.log('✅ Successfully converted string to 64-char hex key');
              }
            } catch (e) {
              console.log('❌ Direct hex conversion failed:', e);
            }
          }
        }
      }
      
      console.log('🔄 Setting state - final key:', finalKey?.substring(0, 10) + '...');
      
      // Set states synchronously
      setDecryptedPrivateKey(finalKey);
      setShowPrivateKey(true);
      
      console.log('🎯 Emergency State updated - showPrivateKey: true, decryptedPrivateKey set');
      console.log('🔍 Immediate state check - decrypted length:', decrypted?.length);
      
      toast.success('Private key decrypted successfully');
    } catch (error) {
      console.error('❌ Failed to decrypt emergency private key:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
        error: error
      });
      toast.error(`Failed to decrypt private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDecryptionLoading(false);
      console.log('🏁 Emergency Decryption process finished, loading state reset');
    }
  };

  const handleTogglePrivateKey = async () => {
    if (showPrivateKey) {
      console.log('🙈 HIDE PRIVATE KEY - Hiding private key');
      setShowPrivateKey(false);
      setDecryptedPrivateKey(null);
    } else {
      console.log('🔓 SHOW PRIVATE KEY - Starting decrypt process');
      await decryptPrivateKey();
    }
  };


  // Test function to verify state and directly test decrypt
  const testState = async () => {
    console.log('🧪 TEST STATE:', {
      showPrivateKey,
      hasDecryptedKey: !!decryptedPrivateKey,
      decryptedKeyLength: decryptedPrivateKey?.length,
      decryptedKeyPreview: decryptedPrivateKey?.substring(0, 20)
    });
    
    // Test direct decrypt call
    if (keyDetails) {
      try {
        console.log('🧪 Testing direct decrypt call...');
        const testDecrypted = await invoke<string>('decrypt_zap_blockchain_private_key', {
          keyId: keyDetails.id,
          password: keyDetails.encryption_password
        });
        console.log('🧪 Direct decrypt result:', testDecrypted?.substring(0, 20) + '...');
        alert(`Direct decrypt successful! Length: ${testDecrypted?.length}\nState: showPrivateKey=${showPrivateKey}, hasKey=${!!decryptedPrivateKey}`);
      } catch (error) {
        console.error('🧪 Direct decrypt failed:', error);
        alert(`Direct decrypt failed: ${error}`);
      }
    }
  };

  // Debug effect to track state changes
  useEffect(() => {
    console.log('🔄 Emergency State changed:', {
      showPrivateKey,
      hasDecryptedKey: !!decryptedPrivateKey,
      decryptedKeyLength: decryptedPrivateKey?.length,
      decryptionLoading
    });
  }, [showPrivateKey, decryptedPrivateKey, decryptionLoading]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading emergency key details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !keyDetails) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/zap-blockchain/emergency')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Emergency Keys
          </Button>
        </div>
        
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'Emergency key not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/zap-blockchain/emergency')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Emergency Keys
          </Button>
          <div className="flex items-center gap-3">
            <Zap className="h-8 w-8 text-red-500" />
            <div>
              <h1 className="text-2xl font-bold">Emergency Key Details</h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <Network className="h-4 w-4" />
                {keyDetails.network_name} • Emergency Response
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
              console.log('🧪 Emergency Test button clicked - forcing state update');
              setDecryptedPrivateKey('test-emergency-private-key-12345');
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

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          Emergency Key
        </Badge>
        {keyDetails.quantumEnhanced && (
          <Badge variant="outline" className="border-green-500 text-green-600">
            <Shield className="h-3 w-3 mr-1" />
            Quantum Enhanced
          </Badge>
        )}
        <Badge variant="outline">{keyDetails.key_role}</Badge>
        <Badge variant={keyDetails.is_active ? "default" : "secondary"}>
          {keyDetails.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cryptographic">Cryptographic</TabsTrigger>
          <TabsTrigger value="emergency">Emergency</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Key Role</Label>
                  <p className="mt-1 text-sm font-mono">{keyDetails.key_role}</p>
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
                  <p className="mt-1 text-sm">{keyDetails.entropySource}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Created</Label>
                  <p className="mt-1 text-sm">{new Date(keyDetails.created_at).toLocaleString()}</p>
                </div>
                
                {keyDetails.lastUsed && (
                  <div>
                    <Label className="text-sm font-medium">Last Used</Label>
                    <p className="mt-1 text-sm">{new Date(keyDetails.lastUsed).toLocaleString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Emergency Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Emergency Features
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Network Halt Authority</span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Emergency Upgrades</span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Critical Parameter Override</span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Incident Response</span>
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

        <TabsContent value="cryptographic" className="space-y-6 max-h-none overflow-visible">
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
                  <Label className="text-sm font-medium">Emergency Address</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={keyDetails.address}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(keyDetails.address, 'Emergency Address')}
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

                {/* Private Key - Decrypt Section - FORCED RENDER */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Private Key</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTogglePrivateKey}
                        disabled={decryptionLoading}
                        className="text-xs h-7"
                      >
                        {decryptionLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>
                            Decrypting...
                          </>
                        ) : showPrivateKey ? (
                          <>
                            <EyeOff className="h-3 w-3 mr-1" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3 mr-1" />
                            Show
                          </>
                        )}
                      </Button>
                      {showPrivateKey && decryptedPrivateKey && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(decryptedPrivateKey, 'Private Key')}
                          className="text-xs h-7"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Debug info */}
                  <div className="text-xs text-gray-500 mb-2">
                    Debug: showPrivateKey={showPrivateKey.toString()}, hasDecrypted={!!decryptedPrivateKey ? 'true' : 'false'}
                    <Button onClick={testState} size="sm" variant="outline" className="ml-2 h-6 text-xs">Test State</Button>
                  </div>
                  
                  {/* Detailed conditional rendering with debug */}
                  {(() => {
                    console.log('🎨 Rendering private key section:', {
                      showPrivateKey,
                      hasDecryptedKey: !!decryptedPrivateKey,
                      decryptedKeyLength: decryptedPrivateKey?.length,
                      condition: showPrivateKey && decryptedPrivateKey
                    });
                    
                    if (showPrivateKey && decryptedPrivateKey) {
                      return (
                        <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-2 rounded">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                            <span className="text-red-600 dark:text-red-400 text-xs font-medium">SENSITIVE DATA</span>
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs text-gray-600">
                              Length: {decryptedPrivateKey.length} characters
                            </div>
                            <code className="font-mono text-xs break-all block bg-gray-100 dark:bg-gray-800 p-2 rounded">
                              {decryptedPrivateKey}
                            </code>
                            {/* Check if it looks like a valid private key format */}
                            {!decryptedPrivateKey.match(/^[0-9a-fA-F]{64}$/) && !decryptedPrivateKey.startsWith('0x') && (
                              <div className="text-xs text-orange-600 bg-orange-50 p-1 rounded">
                                ⚠️ This doesn't appear to be a standard hex private key format
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div>
                          <code className="block bg-muted p-2 rounded text-xs font-mono text-muted-foreground">
                            ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
                          </code>
                          <div className="text-xs text-red-500 mt-1">
                            Debug: showPrivateKey={showPrivateKey.toString()}, hasKey={!!decryptedPrivateKey ? 'true' : 'false'}
                          </div>
                        </div>
                      );
                    }
                  })()}
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
          </div>
        </TabsContent>

        <TabsContent value="emergency" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Emergency Configuration
              </CardTitle>
              <CardDescription>
                Emergency response protocols and activation procedures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Emergency Status</Label>
                  <p className="mt-1 text-sm">{keyDetails.is_active ? 'Active' : 'Inactive'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Last Activated</Label>
                  <p className="mt-1 text-sm">{keyDetails.lastUsed || 'Never'}</p>
                </div>
              </div>
              
              <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Emergency keys should only be used in critical situations that threaten network security or stability. Misuse may result in network disruption.
                </AlertDescription>
              </Alert>
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
                <p className="text-muted-foreground">No metadata available for this emergency key.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
