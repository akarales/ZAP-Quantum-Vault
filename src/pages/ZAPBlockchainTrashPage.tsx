import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Trash2, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ZAPBlockchainKeyInfo {
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

const ZAPBlockchainTrashPage: React.FC = () => {
  const navigate = useNavigate();
  const [trashedKeys, setTrashedKeys] = useState<ZAPBlockchainKeyInfo[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadTrashedKeys();
  }, []);

  const loadTrashedKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🗑️ TRASH PAGE: Starting to load trashed ZAP blockchain keys...');
      
      const keys = await invoke<ZAPBlockchainKeyInfo[]>('list_trashed_zap_blockchain_keys', {
        vault_id: 'default_vault'
      });
      
      console.log('✅ TRASH PAGE: Successfully loaded trashed keys:', keys);
      console.log(`📊 TRASH PAGE: Found ${keys.length} trashed keys`);
      setTrashedKeys(keys);
    } catch (err) {
      console.error('❌ TRASH PAGE: Failed to load trashed keys:', err);
      console.error('❌ TRASH PAGE: Error details:', JSON.stringify(err, null, 2));
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleKeySelection = (keyId: string, selected: boolean) => {
    const newSelection = new Set(selectedKeys);
    if (selected) {
      newSelection.add(keyId);
    } else {
      newSelection.delete(keyId);
    }
    setSelectedKeys(newSelection);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedKeys(new Set(trashedKeys.map(key => key.id)));
    } else {
      setSelectedKeys(new Set());
    }
  };

  const handleRestoreSelected = async () => {
    if (selectedKeys.size === 0) return;

    try {
      setActionLoading(true);
      setError(null);
      
      const keyArray = Array.from(selectedKeys);
      console.log('🔄 Restoring keys:', keyArray);
      
      for (const keyId of keyArray) {
        await invoke('restore_zap_blockchain_key', { keyId: keyId });
      }
      
      setSuccessMessage(`Successfully restored ${keyArray.length} key(s)`);
      setSelectedKeys(new Set());
      await loadTrashedKeys();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('❌ Failed to restore keys:', err);
      setError(err as string);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentlyDeleteSelected = async () => {
    if (selectedKeys.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${selectedKeys.size} key(s)? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError(null);
      
      const keyArray = Array.from(selectedKeys);
      console.log('💀 Permanently deleting keys:', keyArray);
      
      for (const keyId of keyArray) {
        await invoke('permanently_delete_zap_blockchain_key', { keyId: keyId });
      }
      
      setSuccessMessage(`Successfully permanently deleted ${keyArray.length} key(s)`);
      setSelectedKeys(new Set());
      await loadTrashedKeys();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('❌ Failed to permanently delete keys:', err);
      setError(err as string);
    } finally {
      setActionLoading(false);
    }
  };

  const getKeyTypeColor = (keyType: string) => {
    switch (keyType.toLowerCase()) {
      case 'genesis': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'validator': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'treasury': return 'bg-green-100 text-green-800 border-green-200';
      case 'governance': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'emergency': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/zap-blockchain-keys')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">ZAP Blockchain Trash</h1>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading trashed keys...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/zap-blockchain-keys')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ZAP Blockchain Trash</h1>
            <p className="text-gray-600 mt-1">Manage trashed ZAP blockchain keys</p>
          </div>
        </div>
        
        <div className="text-sm text-gray-500">
          {trashedKeys.length} trashed key{trashedKeys.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
          <span className="text-green-800">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Empty State */}
      {trashedKeys.length === 0 ? (
        <div className="text-center py-12">
          <Trash2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No trashed keys</h3>
          <p className="text-gray-500">All your ZAP blockchain keys are active.</p>
        </div>
      ) : (
        <>
          {/* Selection Controls */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedKeys.size === trashedKeys.length && trashedKeys.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Select All ({selectedKeys.size} selected)
                  </span>
                </label>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleRestoreSelected}
                  disabled={selectedKeys.size === 0 || actionLoading}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Selected
                </button>
                
                <button
                  onClick={handlePermanentlyDeleteSelected}
                  disabled={selectedKeys.size === 0 || actionLoading}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>

          {/* Keys List */}
          <div className="space-y-3">
            {trashedKeys.map((key) => (
              <div
                key={key.id}
                className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(key.id)}
                    onChange={(e) => handleKeySelection(key.id, e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getKeyTypeColor(key.key_type)}`}>
                        {key.key_type}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{key.key_role}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Address:</span>
                        <div className="font-mono text-xs bg-gray-100 p-1 rounded mt-1 break-all">
                          {key.address}
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-medium">Network:</span>
                        <div className="mt-1">{key.network_name}</div>
                      </div>
                      
                      <div>
                        <span className="font-medium">Created:</span>
                        <div className="mt-1">{new Date(key.created_at).toLocaleDateString()}</div>
                      </div>
                      
                      <div>
                        <span className="font-medium">Algorithm:</span>
                        <div className="mt-1">{key.algorithm}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ZAPBlockchainTrashPage;
