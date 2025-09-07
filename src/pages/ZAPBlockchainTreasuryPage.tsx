import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Key, 
  CheckCircle,
  Plus,
  Download,
  Lock,
  Users
} from 'lucide-react';

interface ZAPTreasuryKey {
  id: string;
  key_role: string;
  algorithm: string;
  public_key: string;
  address: string;
  created_at: string;
  metadata: any;
}

export const ZAPBlockchainTreasuryPage = () => {
  const navigate = useNavigate();
  const [treasuryKeys, setTreasuryKeys] = useState<ZAPTreasuryKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadTreasuryKeys();
  }, []);

  const loadTreasuryKeys = async () => {
    try {
      console.log('🚀 TREASURY KEYS: Starting loadTreasuryKeys function');
      setLoading(true);
      console.log('🔍 TREASURY KEYS: About to invoke list_zap_blockchain_keys with params:', {
        vaultId: "default_vault",
        keyType: 'treasury',
      });
      const result = await invoke('list_zap_blockchain_keys', {
        vaultId: "default_vault",
        keyType: 'treasury',
      }) as ZAPTreasuryKey[];
      console.log('✅ TREASURY KEYS: Backend invoke completed successfully');
      console.log('📊 TREASURY KEYS: Backend returned:', result.length, 'keys');
      setTreasuryKeys(result);
    } catch (error) {
      console.error('❌ TREASURY KEYS: Error loading treasury keys:', error);
      console.error('❌ TREASURY KEYS: Error details:', JSON.stringify(error, null, 2));
      setError('Failed to load treasury keys');
    } finally {
      console.log('🏁 TREASURY KEYS: loadTreasuryKeys function completed');
      setLoading(false);
    }
  };

  const generateTreasuryKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await invoke('generate_zap_treasury_keyset', {
        networkName: 'ZAP Mainnet'
      });

      setSuccess('Successfully generated treasury key set with multi-sig configuration');
      await loadTreasuryKeys();
    } catch (err) {
      console.error('Failed to generate treasury keys:', err);
      setError('Failed to generate treasury keys');
    } finally {
      setLoading(false);
    }
  };

  const exportTreasuryConfig = async () => {
    try {
      const config = {
        treasury_keys: treasuryKeys.map(key => ({
          id: key.id,
          address: key.address,
          public_key: key.public_key,
          role: key.key_role,
          algorithm: key.algorithm
        })),
        multi_sig_config: {
          threshold: 3,
          total_signers: 5,
          quantum_safe: true
        },
        exported_at: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zap-treasury-config-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess('Treasury configuration exported successfully');
    } catch (err) {
      console.error('Failed to export treasury config:', err);
      setError('Failed to export treasury configuration');
    }
  };

  const masterKeys = treasuryKeys.filter(key => key.key_role.includes('master'));
  const operationalKeys = treasuryKeys.filter(key => key.key_role.includes('operational'));
  const backupKeys = treasuryKeys.filter(key => key.key_role.includes('backup'));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="w-8 h-8 text-green-500" />
            ZAP Blockchain Treasury Keys
          </h1>
          <p className="text-muted-foreground mt-2">
            Generate and manage quantum-safe treasury keys with multi-signature security
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
        {/* Generate Treasury Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Generate Treasury Keys
            </CardTitle>
            <CardDescription>
              Create quantum-safe treasury keys with multi-signature protection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Treasury Key Features:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• ML-KEM-1024 quantum-safe encryption</li>
                <li>• 3-of-5 multi-signature requirement</li>
                <li>• Geographic distribution support</li>
                <li>• Time-locked spending controls</li>
                <li>• Hardware security module ready</li>
              </ul>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">Security Notice</h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Treasury keys control blockchain funds. Store backup keys in separate secure locations 
                and ensure proper key ceremony procedures are followed.
              </p>
            </div>

            <Button 
              onClick={generateTreasuryKeys}
              disabled={loading || treasuryKeys.length > 0}
              className="w-full"
            >
              {loading ? 'Generating...' : 'Generate Treasury Key Set'}
            </Button>

            {treasuryKeys.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Treasury keys already generated. Only one set per network is recommended.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Treasury Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Treasury Overview
            </CardTitle>
            <CardDescription>
              Multi-signature treasury configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            {treasuryKeys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No treasury keys generated yet</p>
                <p className="text-sm">Generate treasury keys to secure blockchain funds</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{masterKeys.length}</div>
                    <div className="text-sm text-muted-foreground">Master Keys</div>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{operationalKeys.length}</div>
                    <div className="text-sm text-muted-foreground">Operational</div>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{backupKeys.length}</div>
                    <div className="text-sm text-muted-foreground">Backup Keys</div>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Multi-Sig Configuration
                  </h4>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <div>Threshold: 3 of 5 signatures required</div>
                    <div>Algorithm: ML-KEM-1024 + ML-DSA-87</div>
                    <div>Status: {treasuryKeys.length >= 5 ? 'Ready' : 'Incomplete'}</div>
                  </div>
                </div>

                <Button 
                  onClick={exportTreasuryConfig}
                  variant="outline" 
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Treasury Configuration
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Treasury Keys Details */}
      {treasuryKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Treasury Key Details</CardTitle>
            <CardDescription>
              Detailed view of generated treasury keys by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="master" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="master">Master Keys ({masterKeys.length})</TabsTrigger>
                <TabsTrigger value="operational">Operational ({operationalKeys.length})</TabsTrigger>
                <TabsTrigger value="backup">Backup ({backupKeys.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="master" className="space-y-3 mt-4">
                {masterKeys.map((key, index) => (
                  <Card 
                    key={key.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-green-500"
                    onClick={() => navigate(`/zap-blockchain/treasury/${key.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Lock className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">Master Key {index + 1}</h3>
                            <p className="text-sm text-muted-foreground">
                              {key.key_role || 'Treasury master'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="mb-1">Master</Badge>
                          <p className="text-xs text-muted-foreground">
                            {key.address.substring(0, 12)}...
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
              
              <TabsContent value="operational" className="space-y-3 mt-4">
                {operationalKeys.map((key, index) => (
                  <Card 
                    key={key.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
                    onClick={() => navigate(`/zap-blockchain/treasury/${key.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Key className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">Operational Key {index + 1}</h3>
                            <p className="text-sm text-muted-foreground">
                              {key.key_role || 'Treasury operational'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="mb-1">Operational</Badge>
                          <p className="text-xs text-muted-foreground">
                            {key.address.substring(0, 12)}...
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
              
              <TabsContent value="backup" className="space-y-3 mt-4">
                {backupKeys.map((key, index) => (
                  <Card 
                    key={key.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-purple-500"
                    onClick={() => navigate(`/zap-blockchain/treasury/${key.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Users className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">Backup Key {index + 1}</h3>
                            <p className="text-sm text-muted-foreground">
                              {key.key_role || 'Treasury backup'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="mb-1">Backup</Badge>
                          <p className="text-xs text-muted-foreground">
                            {key.address.substring(0, 12)}...
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
