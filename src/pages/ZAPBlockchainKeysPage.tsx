import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Copy, AlertTriangle, Plus, Search, Key, Shield, RefreshCw, CheckCircle, Wallet, Activity, TrendingUp, Atom, Network, Trash2, MoreVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ZAPBlockchainKey {
  id: string;
  vaultId: string;
  keyType: string;
  networkName: string;
  keyName: string;
  description?: string;
  encryptedPrivateKey: string;
  publicKey: string;
  address: string;
  derivationPath?: string;
  entropySource: string;
  encryptionPassword: string;
  quantumEnhanced: boolean;
  metadata?: string;
  createdAt: string;
  updatedAt: string;
  lastUsed?: string;
  isActive: boolean;
}

interface ZAPKeyInfo {
  id: string;
  vault_id: string;
  key_type: string;
  key_role: string;
  network_name: string;
  algorithm: string;
  address: string;
  public_key: string;
  created_at: string;
  metadata: any;
  is_active: boolean;
}

export const ZAPBlockchainKeysPage = () => {
  const navigate = useNavigate();
  const [zapKeys, setZapKeys] = useState<ZAPBlockchainKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterNetwork, setFilterNetwork] = useState('all');
  const [filterKeyType, setFilterKeyType] = useState('all');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  useEffect(() => {
    loadZAPKeys();
  }, []);

  const loadZAPKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 ZAP KEYS: Starting loadZAPKeys function');
      console.log('🔍 About to invoke list_zap_blockchain_keys with params:', {
        vaultId: "default_vault",
        keyType: null,
      });
      
      const result = await invoke('list_zap_blockchain_keys', {
        vaultId: "default_vault",
        keyType: null,
      }) as ZAPKeyInfo[];

      console.log('✅ ZAP KEYS: Backend invoke completed successfully');
      console.log('📊 Backend returned:', result.length, 'keys');
      console.log('📋 First few keys:', result.slice(0, 3));

      const formattedKeys: ZAPBlockchainKey[] = result.map(key => ({
        id: key.id,
        vaultId: key.vault_id,
        keyType: key.key_type,
        networkName: key.network_name,
        keyName: key.key_role, // Using key_role as keyName
        description: `${key.key_type} key for ${key.network_name}`,
        encryptedPrivateKey: '', // Not returned in list for security
        publicKey: key.public_key,
        address: key.address,
        derivationPath: key.metadata?.derivation_path || '',
        entropySource: key.algorithm,
        encryptionPassword: 'Protected', // Will be fetched separately if needed
        quantumEnhanced: true, // Default for ZAP keys
        metadata: JSON.stringify(key.metadata),
        createdAt: key.created_at,
        updatedAt: key.created_at, // Use created_at as fallback
        lastUsed: undefined,
        isActive: key.is_active,
      }));

      setZapKeys(formattedKeys);
      toast.success(`Loaded ${formattedKeys.length} ZAP blockchain keys`);
    } catch (error) {
      console.error('❌ ZAP KEYS: Error loading ZAP keys:', error);
      console.error('❌ ZAP KEYS: Error details:', JSON.stringify(error, null, 2));
      setError('Failed to load ZAP blockchain keys');
    } finally {
      console.log('🏁 ZAP KEYS: loadZAPKeys function completed');
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


  const toggleKeySelection = (keyId: string) => {
    setSelectedKeys(prev => {
      const newSelection = prev.includes(keyId) 
        ? prev.filter(id => id !== keyId)
        : [...prev, keyId];
      setShowBulkActions(newSelection.length > 0);
      return newSelection;
    });
  };

  const selectAllKeys = () => {
    const allKeyIds = filteredKeys.map(key => key.id);
    setSelectedKeys(allKeyIds);
    setShowBulkActions(allKeyIds.length > 0);
  };

  const clearSelection = () => {
    setSelectedKeys([]);
    setShowBulkActions(false);
  };

  const handleBulkTrash = async () => {
    if (selectedKeys.length === 0) {
      toast.error('No keys selected');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to move ${selectedKeys.length} key(s) to trash? They can be restored later.`
    );
    
    if (!confirmed) return;

    try {
      console.log('🗑️ BULK TRASH: Starting bulk trash operation for keys:', selectedKeys);
      
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const keyId of selectedKeys) {
        try {
          console.log(`🗑️ BULK TRASH: Trashing key ${keyId}...`);
          await invoke('delete_zap_blockchain_key', { keyId: keyId });
          successCount++;
          console.log(`✅ BULK TRASH: Successfully trashed key ${keyId}`);
        } catch (error) {
          errorCount++;
          const errorMsg = `Failed to trash key ${keyId}: ${error}`;
          errors.push(errorMsg);
          console.error(`❌ BULK TRASH: ${errorMsg}`);
        }
      }

      console.log(`📊 BULK TRASH: Operation complete - Success: ${successCount}, Errors: ${errorCount}`);

      if (successCount > 0) {
        toast.success(`Successfully moved ${successCount} key(s) to trash`);
      }
      
      if (errorCount > 0) {
        toast.error(`Failed to trash ${errorCount} key(s). Check console for details.`);
        console.error('❌ BULK TRASH: Errors encountered:', errors);
      }

      clearSelection();
      await loadZAPKeys();
    } catch (error) {
      console.error('❌ BULK TRASH: Unexpected error during bulk trash operation:', error);
      toast.error('Failed to move keys to trash');
    }
  };

  const handleSingleTrash = async (keyId: string) => {
    const confirmed = window.confirm('Are you sure you want to move this key to trash? It can be restored later.');
    
    if (!confirmed) return;

    try {
      console.log(`🗑️ SINGLE TRASH: Starting trash operation for key: ${keyId}`);
      await invoke('delete_zap_blockchain_key', { keyId: keyId });
      console.log(`✅ SINGLE TRASH: Successfully trashed key: ${keyId}`);
      toast.success('Key moved to trash');
      await loadZAPKeys();
    } catch (error) {
      console.error(`❌ SINGLE TRASH: Failed to trash key ${keyId}:`, error);
      toast.error('Failed to move key to trash');
    }
  };

  const openKeyDetails = (keyId: string) => {
    console.log('Opening key details for:', keyId);
    try {
      // Find the key to determine its type
      const key = zapKeys.find((k: ZAPBlockchainKey) => k.id === keyId);
      if (key && key.keyType === 'emergency') {
        navigate(`/zap-blockchain/emergency/${keyId}`);
      } else {
        navigate(`/zap-blockchain/keys/${keyId}`);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      toast.error('Failed to navigate to key details');
    }
  };

  const filteredKeys = zapKeys.filter(key => {
    const matchesSearch = key.keyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         key.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         key.keyType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesNetwork = filterNetwork === 'all' || key.networkName === filterNetwork;
    const matchesKeyType = filterKeyType === 'all' || key.keyType === filterKeyType;
    
    return matchesSearch && matchesNetwork && matchesKeyType && key.isActive;
  });

  const networks = [...new Set(zapKeys.map(key => key.networkName))];
  const keyTypes = [...new Set(zapKeys.map(key => key.keyType))];

  const getKeyTypeIcon = (keyType: string) => {
    switch (keyType.toLowerCase()) {
      case 'validator': return <Shield className="h-4 w-4" />;
      case 'treasury': return <Wallet className="h-4 w-4" />;
      case 'governance': return <Activity className="h-4 w-4" />;
      case 'emergency': return <AlertTriangle className="h-4 w-4" />;
      default: return <Key className="h-4 w-4" />;
    }
  };

  const getKeyTypeColor = (keyType: string) => {
    switch (keyType.toLowerCase()) {
      case 'validator': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'treasury': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'governance': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'emergency': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-4 max-w-7xl">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="text-lg">Loading ZAP blockchain keys...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-7xl space-y-6">
        
        {/* Header with Statistics */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Atom className="h-10 w-10 text-blue-500" />
                ZAP Blockchain Keys
              </h1>
              <p className="text-muted-foreground text-lg">
                Manage your quantum-safe ZAP blockchain keys and addresses
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => navigate('/zap-blockchain/genesis')}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Generate Genesis Keys
              </Button>
              <Button
                onClick={() => navigate('/zap-blockchain/trash')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Manage Trash
              </Button>
              <Button
                onClick={loadZAPKeys}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Key Statistics Header */}
          {zapKeys.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {zapKeys.filter(k => k.isActive).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Active Keys</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {zapKeys.filter(k => k.quantumEnhanced).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Quantum Enhanced</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {networks.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Networks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {keyTypes.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Key Types</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters and Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="search">Search Keys</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by name, address, or type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <div className="space-y-2">
                  <Label>Network</Label>
                  <Select value={filterNetwork} onValueChange={setFilterNetwork}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="All Networks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Networks</SelectItem>
                      {Array.from(new Set(zapKeys.map(key => key.networkName))).map(network => (
                        <SelectItem key={network} value={network}>{network}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Key Type</Label>
                  <Select value={filterKeyType} onValueChange={setFilterKeyType}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {Array.from(new Set(zapKeys.map(key => key.keyType))).map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterNetwork('all');
                    setFilterKeyType('all');
                  }}
                  className="w-full sm:w-auto"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
            
            {/* Global Select All Checkbox */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={selectedKeys.length === filteredKeys.length && filteredKeys.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      selectAllKeys();
                    } else {
                      clearSelection();
                    }
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Select All ({filteredKeys.length} keys)
                </Label>
              </div>
              {selectedKeys.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedKeys.length} selected
                  </span>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {showBulkActions && (
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {selectedKeys.length} key{selectedKeys.length !== 1 ? 's' : ''} selected
                  </span>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    Clear Selection
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllKeys}
                    disabled={selectedKeys.length === filteredKeys.length}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkTrash}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Move to Trash
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Credit Card Style Keys Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredKeys.map((key) => (
            <Card 
              key={key.id} 
              className={`relative hover:shadow-lg transition-all duration-200 cursor-pointer group ${
                selectedKeys.includes(key.id) ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950' : ''
              }`}
              onClick={() => openKeyDetails(key.id)}
            >
              {/* Selection Checkbox */}
              <div className="absolute top-3 left-3 z-10">
                <input
                  type="checkbox"
                  checked={selectedKeys.includes(key.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleKeySelection(key.id);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              {/* Trash Icon */}
              <div className="absolute top-3 right-3 z-10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSingleTrash(key.id);
                  }}
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <CardHeader className="pb-2 pt-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getKeyTypeIcon(key.keyType)}
                    <Badge className={getKeyTypeColor(key.keyType)} variant="secondary">
                      {key.keyType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {key.quantumEnhanced && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>
                <CardTitle className="text-base truncate">{key.keyName}</CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Network className="h-3 w-3" />
                  {key.networkName}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-3 pb-4">
                {/* Address */}
                <div>
                  <Label className="text-xs text-muted-foreground">Address</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <code className="text-xs bg-muted p-1 rounded flex-1 truncate">
                      {key.address}
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
                </div>

                {/* Key Info */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <Label className="text-xs text-muted-foreground">Source</Label>
                    <div className="font-medium truncate">{key.entropySource}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Created</Label>
                    <div className="font-medium">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* More Details Button */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    Click for details
                  </span>
                  <MoreVertical className="h-3 w-3 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredKeys.length === 0 && !loading && (
          <Card>
            <CardContent className="text-center py-12">
              <Atom className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No ZAP Blockchain Keys Found</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchTerm || filterNetwork !== 'all' || filterKeyType !== 'all'
                  ? 'No keys match your current filters. Try adjusting your search criteria.'
                  : 'Generate your first ZAP blockchain genesis key set to get started with quantum-safe blockchain operations.'
                }
              </p>
              {(!searchTerm && filterNetwork === 'all' && filterKeyType === 'all') && (
                <Button
                  onClick={() => navigate('/zap-blockchain/genesis')}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Generate Genesis Keys
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        {zapKeys.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Key Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {zapKeys.filter(k => k.isActive).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Active Keys</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {zapKeys.filter(k => k.quantumEnhanced).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Quantum Enhanced</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {networks.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Networks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {keyTypes.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Key Types</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
