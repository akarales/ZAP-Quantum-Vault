import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Key, 
  CheckCircle,
  Plus,
  Download
} from 'lucide-react';

interface ZAPValidatorKey {
  id: string;
  key_role: string;
  algorithm: string;
  public_key: string;
  address: string;
  created_at: string;
  metadata: any;
}

export const ZAPBlockchainValidatorPage = () => {
  const navigate = useNavigate();
  const [validatorKeys, setValidatorKeys] = useState<ZAPValidatorKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validatorCount, setValidatorCount] = useState(5);

  useEffect(() => {
    loadValidatorKeys();
  }, []);

  const loadValidatorKeys = async () => {
    try {
      console.log('🚀 VALIDATOR KEYS: Starting loadValidatorKeys function');
      setLoading(true);
      console.log('🔍 VALIDATOR KEYS: About to invoke list_zap_blockchain_keys with params:', {
        vaultId: "default_vault",
        keyType: 'validator',
      });
      const result = await invoke('list_zap_blockchain_keys', {
        vaultId: "default_vault",
        keyType: 'validator',
      }) as ZAPValidatorKey[];
      console.log('✅ VALIDATOR KEYS: Backend invoke completed successfully');
      console.log('📊 VALIDATOR KEYS: Backend returned:', result.length, 'keys');
      setValidatorKeys(result);
    } catch (error) {
      console.error('❌ VALIDATOR KEYS: Error loading validator keys:', error);
      console.error('❌ VALIDATOR KEYS: Error details:', JSON.stringify(error, null, 2));
      setError('Failed to load validator keys');
    } finally {
      console.log('🏁 VALIDATOR KEYS: loadValidatorKeys function completed');
      setLoading(false);
    }
  };

  const generateValidatorKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Generate individual validator keys
      for (let i = 0; i < validatorCount; i++) {
        await invoke('generate_zap_validator_key', {
          validatorIndex: i + 1,
          networkName: 'ZAP Mainnet'
        });
      }

      setSuccess(`Successfully generated ${validatorCount} validator keys`);
      await loadValidatorKeys();
    } catch (err) {
      console.error('Failed to generate validator keys:', err);
      setError('Failed to generate validator keys');
    } finally {
      setLoading(false);
    }
  };

  const exportValidatorConfig = async () => {
    try {
      const config = {
        validators: validatorKeys.map(key => ({
          id: key.id,
          address: key.address,
          public_key: key.public_key,
          role: key.key_role,
          algorithm: key.algorithm
        })),
        total_validators: validatorKeys.length,
        exported_at: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zap-validator-config-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess('Validator configuration exported successfully');
    } catch (err) {
      console.error('Failed to export validator config:', err);
      setError('Failed to export validator configuration');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-500" />
            ZAP Blockchain Validator Keys
          </h1>
          <p className="text-muted-foreground mt-2">
            Generate and manage quantum-safe validator keys for ZAP blockchain consensus
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="w-4 h-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generate Validator Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Generate Validator Keys
            </CardTitle>
            <CardDescription>
              Create quantum-safe validator keys for blockchain consensus
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="validatorCount">Number of Validators</Label>
              <Input
                id="validatorCount"
                type="number"
                min="1"
                max="100"
                value={validatorCount}
                onChange={(e) => setValidatorCount(parseInt(e.target.value) || 1)}
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Recommended: 5-21 validators for optimal consensus
              </p>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Validator Key Features:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• ML-DSA-87 quantum-safe signatures</li>
                <li>• Byzantine fault tolerance ready</li>
                <li>• Air-gapped key generation</li>
                <li>• Hardware security module compatible</li>
              </ul>
            </div>

            <Button 
              onClick={generateValidatorKeys}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Generating...' : `Generate ${validatorCount} Validator Keys`}
            </Button>
          </CardContent>
        </Card>

        {/* Validator Keys List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Generated Validator Keys
            </CardTitle>
            <CardDescription>
              {validatorKeys.length} validator keys available
            </CardDescription>
          </CardHeader>
          <CardContent>
            {validatorKeys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No validator keys generated yet</p>
                <p className="text-sm">Generate your first validator key set to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {validatorKeys.slice(0, 5).map((key, index) => (
                  <Card 
                    key={key.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
                    onClick={() => navigate(`/zap-blockchain/validators/${key.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Shield className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">Validator {index + 1}</h3>
                            <p className="text-sm text-muted-foreground">
                              {key.key_role || 'Consensus validator'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="mb-1">Validator</Badge>
                          <p className="text-xs text-muted-foreground">
                            {key.address.substring(0, 12)}...
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {validatorKeys.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    ... and {validatorKeys.length - 5} more validator keys
                  </p>
                )}

                <Button 
                  onClick={exportValidatorConfig}
                  variant="outline" 
                  className="w-full mt-4"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Validator Configuration
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Validator Network Info */}
      <Card>
        <CardHeader>
          <CardTitle>Validator Network Configuration</CardTitle>
          <CardDescription>
            Information about the validator consensus mechanism
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Consensus Algorithm</h4>
              <p className="text-sm text-muted-foreground">
                Tendermint BFT with quantum-safe cryptography
              </p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Fault Tolerance</h4>
              <p className="text-sm text-muted-foreground">
                Up to 1/3 of validators can be Byzantine faulty
              </p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Block Time</h4>
              <p className="text-sm text-muted-foreground">
                ~6 seconds average block production time
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
