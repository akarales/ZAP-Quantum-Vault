import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Key, 
  Shield, 
  Users, 
  CheckCircle,
  ArrowLeft,
  Plus,
  Vote,
  AlertTriangle,
  RefreshCw,
  Atom,
  Network,
  Activity,
  Dices,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';

interface ZAPGenesisKeyResponse {
  key_set_id: string;
  network: string;
  total_keys: number;
  chain_genesis_address: string;
  validator_addresses: string[];
  treasury_address: string;
  governance_addresses: string[];
  emergency_addresses: string[];
  generated_at: string;
}

interface ZAPNetworkConfig {
  name: string;
  chain_id: string;
  bech32_prefix: string;
  coin_type: number;
  network_type: string;
  consensus_algorithm: string;
  quantum_safe: boolean;
}

interface GenesisGenerationForm {
  network: string;
  validatorCount: number;
  governanceCount: number;
  emergencyCount: number;
}

export const ZAPBlockchainGenesisPage = () => {
  const navigate = useNavigate();
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [genesisKeys, setGenesisKeys] = useState<any>(null);
  const [allKeys, setAllKeys] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [networks] = useState<ZAPNetworkConfig[]>([
    { 
      name: 'ZAP Mainnet', 
      chain_id: 'zap-mainnet-1',
      bech32_prefix: 'zap',
      coin_type: 9999,
      network_type: 'mainnet',
      consensus_algorithm: 'Tendermint',
      quantum_safe: true
    },
    { 
      name: 'ZAP Testnet', 
      chain_id: 'zap-testnet-1',
      bech32_prefix: 'zaptest',
      coin_type: 9999,
      network_type: 'testnet',
      consensus_algorithm: 'Tendermint',
      quantum_safe: true
    },
    { 
      name: 'ZAP Devnet', 
      chain_id: 'zap-devnet-1',
      bech32_prefix: 'zapdev',
      coin_type: 9999,
      network_type: 'devnet',
      consensus_algorithm: 'Tendermint',
      quantum_safe: true
    }
  ]);
  
  const [form, setForm] = useState<GenesisGenerationForm>({
    network: 'ZAP Mainnet',
    validatorCount: 5,
    governanceCount: 7,
    emergencyCount: 3,
  });

  useEffect(() => {
    loadNetworks();
    loadExistingGenesisKeys();
  }, []);

  const loadExistingGenesisKeys = async () => {
    try {
      console.log('🚀 GENESIS: Starting loadExistingGenesisKeys function');
      console.log('🔍 GENESIS: Invoking list_zap_blockchain_keys with parameters:', {
        vaultId: 'default_vault',
        keyType: null
      });
      
      const keys = await invoke('list_zap_blockchain_keys', {
        vaultId: 'default_vault',
        keyType: null
      }) as any[];
      
      console.log('✅ GENESIS: Successfully loaded ZAP blockchain keys:', keys);
      console.log('📊 GENESIS: Total keys loaded:', keys.length);
      
      // Store all keys for navigation
      setAllKeys(keys);
      
      // Filter keys by type to reconstruct genesis key set
      const genesisKey = keys.find(key => key.key_type === 'genesis');
      const validatorKeys = keys.filter(key => key.key_type === 'validator');
      const treasuryKeys = keys.filter(key => key.key_type === 'treasury');
      const governanceKeys = keys.filter(key => key.key_type === 'governance');
      const emergencyKeys = keys.filter(key => key.key_type === 'emergency');
      
      console.log('🔑 GENESIS: Key breakdown:', {
        genesis: genesisKey ? 1 : 0,
        validators: validatorKeys.length,
        treasury: treasuryKeys.length,
        governance: governanceKeys.length,
        emergency: emergencyKeys.length
      });
      
      // If we have genesis keys, reconstruct the genesis key set
      if (genesisKey && (validatorKeys.length > 0 || governanceKeys.length > 0 || emergencyKeys.length > 0)) {
        const reconstructedGenesisKeys: ZAPGenesisKeyResponse = {
          key_set_id: genesisKey.id,
          network: genesisKey.network_name || 'ZAP Mainnet',
          total_keys: keys.length,
          chain_genesis_address: genesisKey.address,
          validator_addresses: validatorKeys.map(key => key.address),
          treasury_address: treasuryKeys.find(key => key.key_role.includes('master'))?.address || treasuryKeys[0]?.address || '',
          governance_addresses: governanceKeys.map(key => key.address),
          emergency_addresses: emergencyKeys.map(key => key.address),
          generated_at: genesisKey.created_at
        };
        
        console.log('✅ GENESIS: Reconstructed genesis key set:', reconstructedGenesisKeys);
        setGenesisKeys(reconstructedGenesisKeys);
        setSuccess(`Loaded existing genesis key set with ${reconstructedGenesisKeys.total_keys} keys`);
      } else {
        console.log('ℹ️ GENESIS: No complete genesis key set found in database');
      }
      
    } catch (error) {
      console.error('❌ GENESIS: Error loading existing genesis keys:', error);
      console.error('❌ GENESIS: Error details:', JSON.stringify(error, null, 2));
      // Don't show error to user as this is just loading existing keys
    } finally {
      console.log('🏁 GENESIS: loadExistingGenesisKeys function completed');
    }
  };

  const generateSecurePassword = () => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const length = 24;
    let password = '';
    
    // Ensure at least one character from each category
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    const shuffled = password.split('').sort(() => Math.random() - 0.5).join('');
    setEncryptionPassword(shuffled);
    toast.success('Secure password generated successfully');
  };

  const copyPasswordToClipboard = async () => {
    if (!encryptionPassword) {
      toast.error('No password to copy');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(encryptionPassword);
      toast.success('Password copied to clipboard');
    } catch (error) {
      console.error('Failed to copy password:', error);
      toast.error('Failed to copy password to clipboard');
    }
  };

  const loadNetworks = async () => {
    try {
      console.log('🚀 NETWORKS: Starting loadNetworks function');
      // For now, we use the static networks defined in state
      // In the future, this could load from the backend
      console.log('Networks loaded from static configuration');
    } catch (error) {
      console.error('❌ NETWORKS: Error loading network configurations:', error);
      console.error('❌ NETWORKS: Error details:', JSON.stringify(error, null, 2));
    } finally {
      console.log('🏁 NETWORKS: loadNetworks function completed');
      setLoading(false);
    }
  };

  const handleGenerateGenesisKeys = async () => {
    if (!form.network) {
      setError('Please select a network');
      return;
    }

    if (!encryptionPassword) {
      setError('Please enter an encryption password');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setGenerationProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const result = await invoke('generate_zap_genesis_keyset', {
        networkName: form.network,
        validatorCount: form.validatorCount,
        governanceCount: form.governanceCount,
        emergencyCount: form.emergencyCount,
        encryptionPassword: encryptionPassword,
      }) as ZAPGenesisKeyResponse;

      clearInterval(progressInterval);
      setGenerationProgress(100);
      setGenesisKeys(result);
      setSuccess(`Successfully generated ${result.total_keys} genesis keys for ${result.network}`);
      toast.success('ZAP blockchain genesis keys generated successfully!');
    } catch (error) {
      setError(`Failed to generate genesis keys: ${error}`);
      toast.error('Failed to generate genesis keys');
      setGenerationProgress(0);
    } finally {
      setLoading(false);
    }
  };


  const selectedNetwork = networks.find(n => n.name === form.network);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-7xl space-y-6">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button variant="ghost" onClick={() => navigate('/dashboard')} className="p-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Atom className="h-10 w-10 text-blue-500" />
                ZAP Blockchain Genesis Keys
              </h1>
            </div>
            <p className="text-muted-foreground text-lg ml-14">
              Generate and manage the foundational keys for ZAP blockchain initialization
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={loadNetworks}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Networks
            </Button>
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

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Genesis Key Generation Panel */}
          <div className="xl:col-span-1 space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Generate Genesis Key Set
                </CardTitle>
                <CardDescription>
                  Create the complete set of quantum-safe keys for ZAP blockchain initialization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Network Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">ZAP Network</Label>
                  <Select 
                    value={form.network} 
                    onValueChange={(value) => setForm(prev => ({ ...prev, network: value }))}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {networks.map((network) => (
                        <SelectItem key={network.name} value={network.name}>
                          <div className="flex items-center gap-2">
                            <Network className="h-4 w-4 text-blue-500" />
                            <div>
                              <div className="font-medium">{network.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {network.chain_id} • {network.bech32_prefix}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedNetwork && (
                    <div className="bg-accent/30 p-3 rounded-lg border border-border">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <Label className="text-xs">Chain ID</Label>
                          <div className="font-medium">{selectedNetwork.chain_id}</div>
                        </div>
                        <div>
                          <Label className="text-xs">Consensus</Label>
                          <div className="font-medium">{selectedNetwork.consensus_algorithm}</div>
                        </div>
                      </div>
                      {selectedNetwork.quantum_safe && (
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="font-medium text-green-600 dark:text-green-400">
                            Quantum-Safe Enabled
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t my-4" />

                {/* Encryption Password */}
                <div className="space-y-3">
                  <Label htmlFor="encryptionPassword" className="text-base font-semibold">
                    Encryption Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="encryptionPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter encryption password for keys"
                      value={encryptionPassword}
                      onChange={(e) => setEncryptionPassword(e.target.value)}
                      className="h-12 pr-24"
                      required
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        className="h-8 w-8 p-0"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={copyPasswordToClipboard}
                        className="h-8 w-8 p-0"
                        title="Copy password"
                        disabled={!encryptionPassword}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateSecurePassword}
                      className="flex items-center gap-2"
                    >
                      <Dices className="h-4 w-4" />
                      Generate Secure Password
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This password will encrypt all generated private keys for secure storage. Use the generate button for a cryptographically secure 24-character password.
                  </p>
                </div>

                <div className="border-t my-4" />

                {/* Key Configuration */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Genesis Key Configuration</Label>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="validators">Initial Validators</Label>
                      <Input
                        id="validators"
                        type="number"
                        min="3"
                        max="10"
                        value={form.validatorCount}
                        onChange={(e) => setForm(prev => ({ 
                          ...prev, 
                          validatorCount: parseInt(e.target.value) || 5 
                        }))}
                        className="h-10"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Number of initial validator keys (3-10)
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="governance">Governance Council</Label>
                      <Input
                        id="governance"
                        type="number"
                        min="5"
                        max="15"
                        value={form.governanceCount}
                        onChange={(e) => setForm(prev => ({ 
                          ...prev, 
                          governanceCount: parseInt(e.target.value) || 7 
                        }))}
                        className="h-10"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Number of governance keys (5-15)
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="emergency">Emergency Recovery</Label>
                      <Input
                        id="emergency"
                        type="number"
                        min="2"
                        max="5"
                        value={form.emergencyCount}
                        onChange={(e) => setForm(prev => ({ 
                          ...prev, 
                          emergencyCount: parseInt(e.target.value) || 3 
                        }))}
                        className="h-10"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Number of emergency recovery keys (2-5)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Generation Progress */}
                {loading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Generating genesis keys...</span>
                      <span>{generationProgress}%</span>
                    </div>
                    <Progress value={generationProgress} className="h-2" />
                  </div>
                )}

                <Button 
                  onClick={handleGenerateGenesisKeys} 
                  disabled={loading || !form.network || !encryptionPassword}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  <Shield className="h-5 w-5 mr-2" />
                  {loading ? 'Generating Keys...' : 'Generate Genesis Key Set'}
                </Button>

              </CardContent>
            </Card>
          </div>

          {/* Genesis Key Results */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Key Statistics */}
            {genesisKeys && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Key className="h-5 w-5 text-blue-500" />
                      <div>
                        <div className="text-2xl font-bold">{genesisKeys.total_keys}</div>
                        <div className="text-sm text-muted-foreground">Total Keys</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-green-500" />
                      <div>
                        <div className="text-2xl font-bold">{genesisKeys.validator_addresses.length}</div>
                        <div className="text-sm text-muted-foreground">Validators</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-500" />
                      <div>
                        <div className="text-2xl font-bold">{genesisKeys.governance_addresses.length}</div>
                        <div className="text-sm text-muted-foreground">Governance</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <div>
                        <div className="text-2xl font-bold">{genesisKeys.emergency_addresses.length}</div>
                        <div className="text-sm text-muted-foreground">Emergency</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Genesis Key Details */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Genesis Key Set Details
                    </CardTitle>
                    <CardDescription>
                      Complete overview of generated ZAP blockchain genesis keys
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!genesisKeys ? (
                  <div className="text-center py-12">
                    <Atom className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Genesis Keys Generated</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Generate your first ZAP blockchain genesis key set to initialize the network.
                    </p>
                  </div>
                ) : (
                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="validators">Validators</TabsTrigger>
                      <TabsTrigger value="governance">Governance</TabsTrigger>
                      <TabsTrigger value="emergency">Emergency</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="overview" className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Network</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">{genesisKeys.network}</Badge>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Generated At</Label>
                          <div className="text-sm mt-1">
                            {new Date(genesisKeys.generated_at).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Key Set ID</Label>
                          <code className="text-sm bg-muted p-1 rounded mt-1 block">
                            {genesisKeys.key_set_id}
                          </code>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Chain Genesis</Label>
                          <code className="text-sm bg-muted p-1 rounded mt-1 block">
                            {genesisKeys.chain_genesis_address}
                          </code>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Total Keys</Label>
                          <div className="text-2xl font-bold text-primary mt-1">
                            {genesisKeys.total_keys}
                          </div>
                        </div>
                      </div>
                      
                      {/* Genesis Key Card */}
                      <div className="mt-6">
                        <Label className="text-sm font-medium mb-3 block">Genesis Key</Label>
                        <Card 
                          className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-purple-500"
                          onClick={async () => {
                            try {
                              const keys = await invoke('list_zap_blockchain_keys', {
                                vaultId: 'default_vault',
                                keyType: 'genesis'
                              }) as any[];
                              
                              if (keys.length > 0) {
                                navigate(`/zap-blockchain/genesis/${keys[0].id}`);
                              } else {
                                toast.error('Genesis key not found');
                              }
                            } catch (error) {
                              console.error('Failed to load genesis key:', error);
                              toast.error('Failed to load genesis key');
                            }
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                  <Key className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold">Chain Genesis Key</h3>
                                  <p className="text-sm text-muted-foreground">
                                    Network initialization key
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant="outline" className="mb-1">Genesis</Badge>
                                <p className="text-xs text-muted-foreground">
                                  {genesisKeys.chain_genesis_address.substring(0, 12)}...
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="validators" className="space-y-4">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          Validator Keys ({allKeys.filter((key: any) => key.key_type === 'validator').length})
                        </Label>
                        {allKeys.filter((key: any) => key.key_type === 'validator').map((key: any, index: number) => (
                          <Card 
                            key={key.id}
                            className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
                            onClick={() => navigate(`/zap-blockchain/validator/${key.id}`)}
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
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="governance" className="space-y-4">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          Governance Keys ({allKeys.filter((key: any) => key.key_type === 'governance').length})
                        </Label>
                        {allKeys.filter((key: any) => key.key_type === 'governance').map((key: any, index: number) => (
                          <Card 
                            key={key.id}
                            className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-green-500"
                            onClick={() => navigate(`/zap-blockchain/governance/${key.id}`)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-green-100 rounded-lg">
                                    <Vote className="h-5 w-5 text-green-600" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold">Governance {index + 1}</h3>
                                    <p className="text-sm text-muted-foreground">
                                      {key.key_role || 'Voting authority'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <Badge variant="outline" className="mb-1">Governance</Badge>
                                  <p className="text-xs text-muted-foreground">
                                    {key.address.substring(0, 12)}...
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="emergency" className="space-y-4">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          Emergency Keys ({allKeys.filter((key: any) => key.key_type === 'emergency').length})
                        </Label>
                        {allKeys.filter((key: any) => key.key_type === 'emergency').map((key: any, index: number) => (
                          <Card 
                            key={key.id}
                            className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-red-500"
                            onClick={() => navigate(`/zap-blockchain/emergency/${key.id}`)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-red-100 rounded-lg">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold">Emergency {index + 1}</h3>
                                    <p className="text-sm text-muted-foreground">
                                      {key.key_role || 'Recovery key'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <Badge variant="outline" className="mb-1">Emergency</Badge>
                                  <p className="text-xs text-muted-foreground">
                                    {key.address.substring(0, 12)}...
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="treasury" className="space-y-4">
                      <div className="mt-4">
                        <Label className="text-sm font-medium">Treasury Address</Label>
                        <code className="text-sm bg-muted p-2 rounded mt-1 block">
                          {genesisKeys.treasury_address}
                        </code>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
