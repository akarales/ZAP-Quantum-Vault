import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Key, Eye, Edit, Trash2, Copy, Clock, Tag, Bitcoin, Shield, Zap } from 'lucide-react';

interface Vault {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  vault_type: string;
  is_shared: boolean;
  is_default: boolean;
  is_system_default: boolean;
  created_at: string;
  updated_at: string;
}

interface VaultItem {
  id: string;
  vault_id: string;
  item_type: string;
  title: string;
  encrypted_data: string;
  metadata: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface BitcoinKey {
  id: string;
  keyType: string;
  network: string;
  address: string;
  derivationPath?: string;
  entropySource: string;
  quantumEnhanced: boolean;
  createdAt: string;
  balanceSatoshis: number;
  transactionCount: number;
}

interface EthereumKey {
  id: string;
  keyType: string;
  network: string;
  address: string;
  derivationPath?: string;
  entropySource: string;
  quantumEnhanced: boolean;
  createdAt: string;
  encryptionPassword?: string;
}

interface CosmosKey {
  id: string;
  vault_id: string;
  network_name: string;
  address: string;
  public_key: string;
  derivation_path?: string;
  bech32_prefix: string;
  description?: string;
  quantum_enhanced: boolean;
  created_at: string;
  entropy_source: string;
  encryption_password?: string;
}

const VaultDetailsPage: React.FC = () => {
  const { vaultId } = useParams<{ vaultId: string }>();
  const navigate = useNavigate();
  const [vault, setVault] = useState<Vault | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [bitcoinKeys, setBitcoinKeys] = useState<BitcoinKey[]>([]);
  const [ethereumKeys, setEthereumKeys] = useState<EthereumKey[]>([]);
  const [cosmosKeys, setCosmosKeys] = useState<CosmosKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    console.log('[VaultDetailsPage] useEffect triggered with vaultId:', vaultId);
    if (vaultId) {
      loadVaultDetails();
    } else {
      console.warn('[VaultDetailsPage] No vaultId provided');
    }
  }, [vaultId]);

  const loadVaultDetails = async () => {
    console.log('[VaultDetailsPage] Starting loadVaultDetails for vaultId:', vaultId);
    try {
      setLoading(true);
      setError(null);

      // Load vault details
      console.log('[VaultDetailsPage] Loading user vaults...');
      const vaults = await invoke<Vault[]>('get_user_vaults_offline');
      console.log('[VaultDetailsPage] Loaded vaults:', vaults.length);
      
      const currentVault = vaults.find((v: Vault) => v.id === vaultId);
      console.log('[VaultDetailsPage] Found current vault:', currentVault ? 'Yes' : 'No');
      
      if (!currentVault) {
        console.error('[VaultDetailsPage] Vault not found with ID:', vaultId);
        setError('Vault not found');
        return;
      }
      
      setVault(currentVault);
      console.log('[VaultDetailsPage] Set vault:', currentVault.name);

      // Load vault items
      console.log('[VaultDetailsPage] Loading vault items...');
      const vaultItems = await invoke<VaultItem[]>('get_vault_items_offline', {
        vaultId: vaultId
      });
      console.log('[VaultDetailsPage] Loaded vault items:', vaultItems.length);
      
      setItems(vaultItems);

      // Load Bitcoin keys for this vault
      try {
        console.log('[VaultDetailsPage] Loading Bitcoin keys...');
        const keys = await invoke<BitcoinKey[]>('list_bitcoin_keys', {
          vault_id: vaultId
        });
        console.log('[VaultDetailsPage] Loaded Bitcoin keys:', keys.length);
        setBitcoinKeys(keys);
      } catch (keyError) {
        console.error('[VaultDetailsPage] Failed to load Bitcoin keys:', keyError);
        setBitcoinKeys([]);
      }

      // Load Ethereum keys for this vault
      try {
        console.log('[VaultDetailsPage] Loading Ethereum keys...');
        const ethKeys = await invoke<EthereumKey[]>('list_ethereum_keys', {
          vault_id: vaultId
        });
        console.log('[VaultDetailsPage] Loaded Ethereum keys:', ethKeys.length);
        setEthereumKeys(ethKeys);
      } catch (keyError) {
        console.error('[VaultDetailsPage] Failed to load Ethereum keys:', keyError);
        setEthereumKeys([]);
      }

      // Load Cosmos keys for this vault
      try {
        console.log('[VaultDetailsPage] Loading Cosmos keys...');
        const cosmosKeysData = await invoke<CosmosKey[]>('list_cosmos_keys', {
          vault_id: vaultId
        });
        console.log('[VaultDetailsPage] Loaded Cosmos keys:', cosmosKeysData.length);
        setCosmosKeys(cosmosKeysData);
      } catch (keyError) {
        console.error('[VaultDetailsPage] Failed to load Cosmos keys:', keyError);
        setCosmosKeys([]);
      }
    } catch (err) {
      console.error('[VaultDetailsPage] Failed to load vault details:', err);
      setError(err as string);
    } finally {
      setLoading(false);
      console.log('[VaultDetailsPage] Finished loading vault details');
    }
  };

  const handleItemClick = (itemId: string) => {
    console.log('[VaultDetailsPage] Navigating to key details:', itemId);
    navigate(`/key-details/${itemId}`);
  };

  const handleCopyToClipboard = async (text: string) => {
    console.log('[VaultDetailsPage] Copying to clipboard:', text.substring(0, 10) + '...');
    try {
      await navigator.clipboard.writeText(text);
      console.log('[VaultDetailsPage] Successfully copied to clipboard');
      // TODO: Add toast notification
    } catch (err) {
      console.error('[VaultDetailsPage] Failed to copy to clipboard:', err);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const filteredItems = items.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-6"></div>
            <div className="h-32 bg-muted rounded mb-8"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-destructive text-xl mb-4">Error loading vault details</div>
          <div className="text-muted-foreground mb-6">{error}</div>
          <button
            onClick={() => navigate('/vaults')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded transition-colors"
          >
            Back to Vaults
          </button>
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground text-xl mb-6">Vault not found</div>
          <button
            onClick={() => navigate('/vaults')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded transition-colors"
          >
            Back to Vaults
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/vaults')}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold">{vault.name}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                <span className="capitalize">{vault.vault_type}</span>
                {vault.is_default && <span className="text-primary">Default</span>}
                {vault.is_system_default && <span className="text-green-500">System</span>}
                {vault.is_shared && <span className="text-yellow-500">Shared</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Vault Info */}
        <div className="bg-card border rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <p className="text-card-foreground">{vault.description || 'No description provided'}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Statistics</h3>
              <div className="space-y-1 text-gray-300">
                <div>Vault Items: {items.length}</div>
                <div>Bitcoin Keys: {bitcoinKeys.length}</div>
                <div>Ethereum Keys: {ethereumKeys.length}</div>
                <div>Created: {formatDate(vault.created_at)}</div>
                <div>Updated: {formatDate(vault.updated_at)}</div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Key Types</h3>
              <div className="space-y-1 text-gray-300">
                {Object.entries(
                  items.reduce((acc, item) => {
                    acc[item.item_type] = (acc[item.item_type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([type, count]) => (
                  <div key={type} className="capitalize">
                    {type}: {count}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search keys..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-4 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredItems.length} of {items.length} keys
            </div>
          </div>
        </div>

        {/* Keys Section */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-semibold flex items-center space-x-2">
              <Key className="w-5 h-5" />
              <span>Keys</span>
            </h2>
          </div>

          {/* Bitcoin Keys Subsection */}
          {bitcoinKeys.length > 0 && (
            <div className="border-b border-gray-700 last:border-b-0">
              <div className="px-6 py-3 bg-gray-750 border-b border-gray-700">
                <h3 className="text-lg font-medium flex items-center space-x-2">
                  <Bitcoin className="w-4 h-4 text-orange-400" />
                  <span>Bitcoin Keys ({bitcoinKeys.length})</span>
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {bitcoinKeys.map((key) => (
                  <div
                    key={key.id}
                    className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <Bitcoin className="w-5 h-5 text-orange-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-base font-medium truncate">{key.address}</h4>
                              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded capitalize">
                                {key.keyType}
                              </span>
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                {key.network}
                              </span>
                              {key.quantumEnhanced && (
                                <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded flex items-center space-x-1">
                                  <Shield className="w-3 h-3" />
                                  <span>Quantum</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatDate(key.createdAt)}</span>
                              </div>
                              <div>Balance: {(key.balanceSatoshis / 100000000).toFixed(8)} BTC</div>
                              <div>Txs: {key.transactionCount}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopyToClipboard(key.address)}
                          className="p-2 hover:bg-muted rounded transition-colors"
                          title="Copy Address"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ethereum Keys Subsection */}
          {ethereumKeys.length > 0 && (
            <div className="border-b border-gray-700 last:border-b-0">
              <div className="px-6 py-3 bg-gray-750 border-b border-gray-700">
                <h3 className="text-lg font-medium flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span>Ethereum Keys ({ethereumKeys.length})</span>
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {ethereumKeys.map((key) => (
                  <div
                    key={key.id}
                    className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/ethereum-keys/${key.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <Zap className="w-5 h-5 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-base font-medium truncate">{key.address}</h4>
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                {key.network}
                              </span>
                              {key.quantumEnhanced && (
                                <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded flex items-center space-x-1">
                                  <Shield className="w-3 h-3" />
                                  <span>Quantum</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatDate(key.createdAt)}</span>
                              </div>
                              <div>Key Type: {key.keyType}</div>
                              <div>Source: {key.entropySource}</div>
                              {key.encryptionPassword && (
                                <div className="flex items-center space-x-1">
                                  <Key className="w-3 h-3" />
                                  <span>Password: {key.encryptionPassword}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyToClipboard(key.address);
                          }}
                          className="p-2 hover:bg-muted rounded transition-colors"
                          title="Copy Address"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cosmos Keys Subsection */}
          {cosmosKeys.length > 0 && (
            <div className="border-b border-gray-700 last:border-b-0">
              <div className="px-6 py-3 bg-gray-750 border-b border-gray-700">
                <h3 className="text-lg font-medium flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span>Cosmos Keys ({cosmosKeys.length})</span>
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {cosmosKeys.map((key) => (
                  <div
                    key={key.id}
                    className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/cosmos-keys/${key.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <Zap className="w-5 h-5 text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-base font-medium truncate">{key.address}</h4>
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                {key.network_name}
                              </span>
                              {key.quantum_enhanced && (
                                <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded flex items-center space-x-1">
                                  <Shield className="w-3 h-3" />
                                  <span>Quantum</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatDate(key.created_at)}</span>
                              </div>
                              <div>Prefix: {key.bech32_prefix}</div>
                              <div>Source: {key.entropy_source}</div>
                              {key.encryption_password && (
                                <div className="flex items-center space-x-1">
                                  <Key className="w-3 h-3" />
                                  <span>Password: {key.encryption_password}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyToClipboard(key.address);
                          }}
                          className="p-2 hover:bg-muted rounded transition-colors"
                          title="Copy Address"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vault Items Subsection */}
          {items.length > 0 && (
            <div className="border-b border-gray-700 last:border-b-0">
              <div className="px-6 py-3 bg-gray-750 border-b border-gray-700">
                <h3 className="text-lg font-medium flex items-center space-x-2">
                  <Key className="w-4 h-4" />
                  <span>Vault Items ({items.length})</span>
                </h3>
              </div>
              
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <div>No vault items match your search criteria</div>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="px-6 py-4 border-b border-gray-700 last:border-b-0 hover:bg-gray-750 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <Key className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-medium truncate">{item.title}</h3>
                            <span className="text-xs bg-gray-700 px-2 py-1 rounded capitalize">
                              {item.item_type}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(item.created_at)}</span>
                            </div>
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex items-center space-x-1">
                                <Tag className="w-3 h-3" />
                                <span>{item.tags.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleItemClick(item.id)}
                        className="p-2 hover:bg-gray-600 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCopyToClipboard(item.id)}
                        className="p-2 hover:bg-gray-600 rounded transition-colors"
                        title="Copy ID"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 hover:bg-gray-600 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 hover:bg-destructive rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state when no keys at all */}
          {bitcoinKeys.length === 0 && items.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <div className="text-lg mb-2">No keys in this vault</div>
              <div className="text-sm">Add your first key to get started</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VaultDetailsPage;
