import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  AlertTriangle, 
  ArrowLeft,
  RefreshCw,
  Shield,
  Key,
  Search,
  Eye,
  Copy,
  CheckCircle,
  Clock,
  Network
} from 'lucide-react';

interface ZAPEmergencyKey {
  id: string;
  key_type: string;
  key_name: string;
  algorithm: string;
  network_name: string;
  address: string;
  public_key: string;
  created_at: string;
  quantum_enhanced: boolean;
  description?: string;
  metadata?: string;
}

export const ZAPBlockchainEmergencyPage = () => {
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ZAPEmergencyKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');

  useEffect(() => {
    loadEmergencyKeys();
  }, []);

  const loadEmergencyKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 EMERGENCY: Loading emergency keys from backend');
      
      const allKeys = await invoke('list_zap_blockchain_keys', {
        vaultId: null,
        keyType: 'emergency'
      }) as ZAPEmergencyKey[];
      
      // Keys are already filtered by backend
      const emergencyKeys = allKeys;
      
      console.log('✅ EMERGENCY: Loaded emergency keys:', emergencyKeys.length);
      setKeys(emergencyKeys);
      
      if (emergencyKeys.length === 0) {
        console.log('ℹ️ EMERGENCY: No emergency keys found');
      }
      
    } catch (error) {
      console.error('❌ EMERGENCY: Error loading keys:', error);
      setError(`Failed to load emergency keys: ${error}`);
      toast.error('Failed to load emergency keys');
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
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  const filteredKeys = keys.filter(key => {
    const matchesSearch = !searchTerm || 
      (key.key_name && key.key_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (key.address && key.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (key.id && key.id.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesNetwork = selectedNetwork === 'all' || key.network_name === selectedNetwork;
    
    return matchesSearch && matchesNetwork;
  });

  const uniqueNetworks = Array.from(new Set(keys.map(key => key.network_name)));

  const getEmergencyKeyIcon = (keyName: string) => {
    if (!keyName) return '🆘';
    if (keyName.includes('emergency_1')) return '🚨';
    if (keyName.includes('emergency_2')) return '⚡';
    if (keyName.includes('emergency_3')) return '🔥';
    return '🆘';
  };

  const getEmergencyKeyDescription = (keyName: string) => {
    if (!keyName) return 'Emergency Recovery Key';
    if (keyName.includes('emergency_1')) return 'Primary Emergency Response';
    if (keyName.includes('emergency_2')) return 'Secondary Emergency Response';
    if (keyName.includes('emergency_3')) return 'Tertiary Emergency Response';
    return 'Emergency Recovery Key';
  };

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
                <AlertTriangle className="h-10 w-10 text-orange-500" />
                Emergency Keys
              </h1>
            </div>
            <p className="text-muted-foreground text-lg ml-14">
              Manage critical emergency recovery keys for ZAP blockchain network
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={loadEmergencyKeys}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Keys
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

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold">{keys.length}</div>
                  <div className="text-sm text-muted-foreground">Total Emergency Keys</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{uniqueNetworks.length}</div>
                  <div className="text-sm text-muted-foreground">Networks</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {keys.filter(key => key.quantum_enhanced).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Quantum Safe</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold">{filteredKeys.length}</div>
                  <div className="text-sm text-muted-foreground">Filtered Results</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by key name, address, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <select
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value)}
                  className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                >
                  <option value="all">All Networks</option>
                  {uniqueNetworks.map(network => (
                    <option key={network} value={network}>{network}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Keys List */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Emergency Keys ({filteredKeys.length})
                </CardTitle>
                <CardDescription>
                  Critical recovery keys for emergency blockchain operations
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground mb-4 animate-spin" />
                <p className="text-muted-foreground">Loading emergency keys...</p>
              </div>
            ) : filteredKeys.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Emergency Keys Found</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {keys.length === 0 
                    ? "No emergency keys have been generated yet. Generate a genesis key set to create emergency keys."
                    : "No emergency keys match your current search criteria."
                  }
                </p>
                {keys.length === 0 && (
                  <Button onClick={() => navigate('/zap-blockchain/genesis')} variant="outline">
                    Generate Genesis Keys
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredKeys.map((key) => (
                  <Card 
                    key={key.id}
                    className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-orange-500 hover:border-l-orange-600"
                    onClick={() => navigate(`/zap-blockchain/emergency/${key.id}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                            <div className="text-2xl">{getEmergencyKeyIcon(key.key_name || '')}</div>
                          </div>
                          <div className="space-y-1">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              {key.key_name ? key.key_name.replace('_', ' ').toUpperCase() : 'EMERGENCY KEY'}
                              {key.quantum_enhanced && (
                                <Badge variant="secondary" className="text-xs">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Quantum Safe
                                </Badge>
                              )}
                            </h3>
                            <p className="text-muted-foreground">
                              {key.description || getEmergencyKeyDescription(key.key_name || '')}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Network className="h-3 w-3" />
                                {key.network_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(key.created_at).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Key className="h-3 w-3" />
                                {key.algorithm}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right space-y-2">
                          <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/20">
                            Emergency
                          </Badge>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              {key.address.substring(0, 12)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(key.address, 'Address');
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/zap-blockchain/emergency/${key.id}`);
                              }}
                              className="h-8 px-2"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ZAPBlockchainEmergencyPage;
