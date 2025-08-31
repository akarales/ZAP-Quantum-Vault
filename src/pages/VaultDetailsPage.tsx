import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Key, Eye, EyeOff, Edit, Trash2, Copy, Clock, Tag, Bitcoin, Shield } from 'lucide-react';

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

const VaultDetailsPage: React.FC = () => {
  const { vaultId } = useParams<{ vaultId: string }>();
  const navigate = useNavigate();
  const [vault, setVault] = useState<Vault | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [bitcoinKeys, setBitcoinKeys] = useState<BitcoinKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [vaultPassword, setVaultPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (vaultId) {
      loadVaultDetails();
    }
  }, [vaultId]);

  const loadVaultDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load vault details
      const vaults = await invoke<Vault[]>('get_user_vaults_offline');
      const currentVault = vaults.find((v: Vault) => v.id === vaultId);
      
      if (!currentVault) {
        setError('Vault not found');
        return;
      }
      
      setVault(currentVault);

      // Load vault items
      const vaultItems = await invoke<VaultItem[]>('get_vault_items_offline', {
        vaultId: vaultId
      });
      
      setItems(vaultItems);

      // Load Bitcoin keys for this vault
      try {
        const keys = await invoke<BitcoinKey[]>('list_bitcoin_keys', {
          vaultId: vaultId
        });
        setBitcoinKeys(keys);
      } catch (keyError) {
        console.error('Failed to load Bitcoin keys:', keyError);
        setBitcoinKeys([]);
      }

      // Load vault password if available
      try {
        const password = await invoke<string | null>('get_vault_password_offline', {
          vaultId: vaultId
        });
        setVaultPassword(password);
      } catch (passwordError) {
        console.error('Failed to load vault password:', passwordError);
        setVaultPassword(null);
      }
    } catch (err) {
      console.error('Failed to load vault details:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (itemId: string) => {
    navigate(`/key-details/${itemId}`);
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Add toast notification
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
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
              
              {/* Vault Password Section */}
              {vaultPassword && (
                <div className="mt-4">
                  <h4 className="text-md font-medium mb-2 flex items-center space-x-2">
                    <Key className="w-4 h-4" />
                    <span>Vault Password</span>
                  </h4>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-muted rounded px-3 py-2 font-mono text-sm">
                      {showPassword ? vaultPassword : '••••••••••••••••'}
                    </div>
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2 hover:bg-muted rounded transition-colors"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleCopyToClipboard(vaultPassword)}
                      className="p-2 hover:bg-muted rounded transition-colors"
                      title="Copy password"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Statistics</h3>
              <div className="space-y-1 text-gray-300">
                <div>Vault Items: {items.length}</div>
                <div>Bitcoin Keys: {bitcoinKeys.length}</div>
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
