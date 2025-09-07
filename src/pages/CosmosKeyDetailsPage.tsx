import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft, Copy, Eye, EyeOff, Shield, Key, Calendar, Network, Trash2, Download, AlertTriangle, CheckCircle, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface CosmosKey {
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
  description?: string;
}

export const CosmosKeyDetailsPage = () => {
  const { keyId } = useParams<{ keyId: string }>();
  const navigate = useNavigate();
  
  const [cosmosKey, setCosmosKey] = useState<CosmosKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [decryptedPrivateKey, setDecryptedPrivateKey] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadCosmosKey();
  }, [keyId]);

  const loadCosmosKey = async () => {
    if (!keyId) return;
    
    try {
      setLoading(true);
      const key = await invoke('get_cosmos_key_by_id', { keyId });
      
      // Map backend response (snake_case) to frontend format (camelCase)
      const mappedKey: CosmosKey = {
        id: (key as any).id,
        vaultId: (key as any).vault_id,
        keyType: 'secp256k1', // Default key type for Cosmos
        network: (key as any).network_name,
        encryptedPrivateKey: (key as any).encrypted_private_key,
        publicKey: (key as any).public_key,
        address: (key as any).address,
        entropySource: (key as any).entropy_source,
        quantumEnhanced: (key as any).quantum_enhanced,
        createdAt: (key as any).created_at,
        isActive: (key as any).is_active,
        encryptionPassword: (key as any).encryption_password,
        description: (key as any).description,
      };
      
      setCosmosKey(mappedKey);
      
      // Pre-fill password if stored
      if (mappedKey.encryptionPassword) {
        setPassword(mappedKey.encryptionPassword);
      }
    } catch (err) {
      setError('Failed to load Cosmos key details');
      console.error('Error loading Cosmos key:', err);
    } finally {
      setLoading(false);
    }
  };

  const decryptPrivateKey = async () => {
    if (!cosmosKey) return;
    
    // Use stored password if available, otherwise use entered password
    const passwordToUse = cosmosKey.encryptionPassword || password;
    if (!passwordToUse) {
      setError('Password is required for decryption');
      return;
    }
    
    try {
      setError('');
      const result = await invoke('decrypt_cosmos_private_key', {
        keyId: cosmosKey.id,
        password: passwordToUse
      });
      setDecryptedPrivateKey(result as string);
      setShowPrivateKey(true);
      setSuccess('Private key decrypted successfully');
    } catch (err) {
      setError('Failed to decrypt private key. Check your password.');
      console.error('Error decrypting private key:', err);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`${label} copied to clipboard`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  const moveToTrash = async () => {
    if (!cosmosKey) return;
    
    if (!confirm('Are you sure you want to move this Cosmos key to trash? You can restore it later if needed.')) {
      return;
    }
    
    try {
      await invoke('trash_cosmos_key', { keyId: cosmosKey.id });
      setSuccess('Cosmos key moved to trash successfully');
      setTimeout(() => navigate('/cosmos-keys'), 2000);
    } catch (err) {
      setError('Failed to move Cosmos key to trash');
      console.error('Error moving key to trash:', err);
    }
  };

  const exportKey = async () => {
    if (!cosmosKey) return;
    
    // Use stored password if available, otherwise use entered password
    const passwordToUse = cosmosKey.encryptionPassword || password;
    if (!passwordToUse) {
      setError('Password is required for export');
      return;
    }
    
    try {
      const exportData = await invoke('export_cosmos_key', {
        keyId: cosmosKey.id,
        password: passwordToUse
      });
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cosmos-key-${cosmosKey.address.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccess('Cosmos key exported successfully');
    } catch (err) {
      setError('Failed to export Cosmos key');
      console.error('Error exporting key:', err);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/cosmos-keys')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cosmos Keys
          </Button>
        </div>
        <div className="text-center">Loading Cosmos key details...</div>
      </div>
    );
  }

  if (!cosmosKey) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/cosmos-keys')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cosmos Keys
          </Button>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Cosmos key not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/cosmos-keys')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cosmos Keys
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Cosmos Key Details</h1>
            <p className="text-muted-foreground">
              {cosmosKey.description || `${cosmosKey.network} key`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cosmosKey.quantumEnhanced && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              <Zap className="h-3 w-3 mr-1" />
              Quantum Enhanced
            </Badge>
          )}
          <Badge variant={cosmosKey.isActive ? "default" : "secondary"}>
            {cosmosKey.isActive ? "Active" : "Inactive"}
          </Badge>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Key Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Network</Label>
              <div className="flex items-center gap-2 mt-1">
                <Network className="h-4 w-4" />
                <span className="font-mono">{cosmosKey.network}</span>
              </div>
            </div>
            
            <div>
              <Label>Address</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input 
                  value={cosmosKey.address} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(cosmosKey.address, 'Address')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>Public Key</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input 
                  value={cosmosKey.publicKey} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(cosmosKey.publicKey, 'Public Key')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>Key Type</Label>
              <p className="mt-1 font-mono text-sm">{cosmosKey.keyType}</p>
            </div>

            <div>
              <Label>Entropy Source</Label>
              <p className="mt-1 font-mono text-sm">{cosmosKey.entropySource}</p>
            </div>
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
            <div>
              <Label>Created</Label>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4" />
                <span>{new Date(cosmosKey.createdAt).toLocaleString()}</span>
              </div>
            </div>

            {cosmosKey.lastUsed && (
              <div>
                <Label>Last Used</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(cosmosKey.lastUsed).toLocaleString()}</span>
                </div>
              </div>
            )}

            {cosmosKey.encryptionPassword && (
              <div>
                <Label>Stored Encryption Password</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={cosmosKey.encryptionPassword} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(cosmosKey.encryptionPassword!, 'Encryption Password')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {!cosmosKey.encryptionPassword && (
              <div className="space-y-2">
                <Label>Password (for decryption/export)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter encryption password"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button 
                onClick={decryptPrivateKey}
                disabled={!cosmosKey.encryptionPassword && !password}
                className="w-full"
              >
                {showPrivateKey ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showPrivateKey ? 'Hide' : 'Show'} Private Key
              </Button>
              
              <Button 
                variant="outline"
                onClick={exportKey}
                disabled={!cosmosKey.encryptionPassword && !password}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Key
              </Button>
              
              <Button 
                variant="destructive"
                onClick={moveToTrash}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Move to Trash
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Private Key Display */}
      {showPrivateKey && decryptedPrivateKey && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Private Key (Keep Secure!)
            </CardTitle>
            <CardDescription>
              Never share your private key. Anyone with access to this key can control your funds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input 
                value={decryptedPrivateKey} 
                readOnly 
                className="font-mono text-sm bg-red-50 border-red-200"
                type="text"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => copyToClipboard(decryptedPrivateKey, 'Private Key')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CosmosKeyDetailsPage;
