import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Key, Eye, Edit, Trash2, Copy, Clock, Tag, Bitcoin, Shield } from 'lucide-react';

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
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-1/4 mb-6"></div>
            <div className="h-32 bg-gray-700 rounded mb-8"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-700 rounded"></div>
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
          <div className="text-red-400 text-xl mb-4">Error loading vault details</div>
          <div className="text-gray-400 mb-6">{error}</div>
          <button
            onClick={() => navigate('/vaults')}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
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
          <div className="text-gray-400 text-xl mb-6">Vault not found</div>
          <button
            onClick={() => navigate('/vaults')}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
          >
            Back to Vaults
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/vaults')}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold">{vault.name}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                <span className="capitalize">{vault.vault_type}</span>
                {vault.is_default && <span className="text-blue-400">Default</span>}
                {vault.is_system_default && <span className="text-green-400">System</span>}
                {vault.is_shared && <span className="text-yellow-400">Shared</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Vault Info */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <p className="text-gray-300">{vault.description || 'No description provided'}</p>
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
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="text-sm text-gray-400">
              {filteredItems.length} of {items.length} keys
            </div>
          </div>
        </div>

        {/* Keys Section */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
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
                    className="px-6 py-4 border-b border-gray-700 last:border-b-0 hover:bg-gray-750 transition-colors group"
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
                              <span className="text-xs bg-gray-700 px-2 py-1 rounded capitalize">
                                {key.keyType}
                              </span>
                              <span className="text-xs bg-blue-600 px-2 py-1 rounded">
                                {key.network}
                              </span>
                              {key.quantumEnhanced && (
                                <span className="text-xs bg-purple-600 px-2 py-1 rounded flex items-center space-x-1">
                                  <Shield className="w-3 h-3" />
                                  <span>Quantum</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
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
                          className="p-2 hover:bg-gray-600 rounded transition-colors"
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
                <div className="p-8 text-center text-gray-400">
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
                        className="p-2 hover:bg-red-600 rounded transition-colors"
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
