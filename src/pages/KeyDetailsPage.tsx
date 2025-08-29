import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Key, Copy, Eye, EyeOff, Edit, Trash2, Clock, Tag, Shield } from 'lucide-react';

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

interface Vault {
  id: string;
  name: string;
  vault_type: string;
}

const KeyDetailsPage: React.FC = () => {
  const { keyId } = useParams<{ keyId: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<VaultItem | null>(null);
  const [vault, setVault] = useState<Vault | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    if (keyId) {
      loadKeyDetails();
    }
  }, [keyId]);

  const loadKeyDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load key details
      const keyDetails = await invoke<VaultItem>('get_vault_item_details_offline', {
        itemId: keyId
      });
      
      setItem(keyDetails);

      // Load vault details
      const vaults = await invoke<Vault[]>('get_user_vaults_offline');
      const keyVault = vaults.find((v: Vault) => v.id === keyDetails.vault_id);
      setVault(keyVault || null);

    } catch (err) {
      console.error('Failed to load key details:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(label);
      setTimeout(() => setCopySuccess(null), 2000);
      
      // For sensitive data, clear clipboard after 30 seconds
      if (label.toLowerCase().includes('private') || label.toLowerCase().includes('secret')) {
        setTimeout(() => {
          navigator.clipboard.writeText('');
        }, 30000);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const parseKeyData = (encryptedData: string) => {
    try {
      return JSON.parse(encryptedData);
    } catch {
      return { raw_data: encryptedData };
    }
  };

  const SecureField: React.FC<{
    label: string;
    value: string;
    sensitive?: boolean;
    copyable?: boolean;
  }> = ({ label, value, sensitive = false, copyable = true }) => {
    const [isVisible, setIsVisible] = useState(!sensitive);

    return (
      <div className="bg-card rounded-lg p-4 border">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-muted-foreground">{label}</label>
          <div className="flex items-center space-x-2">
            {sensitive && (
              <button
                onClick={() => setIsVisible(!isVisible)}
                className="p-1 hover:bg-muted rounded transition-colors"
                title={isVisible ? 'Hide' : 'Show'}
              >
                {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
            {copyable && (
              <button
                onClick={() => handleCopyToClipboard(value, label)}
                className="p-1 hover:bg-muted rounded transition-colors"
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="font-mono text-sm bg-muted rounded p-3 break-all">
          {isVisible ? value : '••••••••••••••••••••••••••••••••'}
        </div>
        {copySuccess === label && (
          <div className="text-green-500 text-xs mt-1">Copied to clipboard!</div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-6"></div>
            <div className="h-64 bg-muted rounded mb-8"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="text-destructive text-xl mb-4">Error loading key details</div>
          <div className="text-muted-foreground mb-6">{error || 'Key not found'}</div>
          <button
            onClick={() => navigate(-1)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const keyData = parseKeyData(item.encrypted_data);
  const metadata = item.metadata ? JSON.parse(item.metadata) : {};

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold flex items-center space-x-3">
                <Key className="w-8 h-8 text-primary" />
                <span>{item.title}</span>
              </h1>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                <span className="capitalize">{item.item_type}</span>
                {vault && (
                  <span 
                    className="text-primary cursor-pointer hover:underline"
                    onClick={() => navigate(`/vault/${vault.id}`)}
                  >
                    {vault.name}
                  </span>
                )}
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Created {formatDate(item.created_at)}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSensitiveData(!showSensitiveData)}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                showSensitiveData 
                  ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' 
                  : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>{showSensitiveData ? 'Hide Sensitive' : 'Show Sensitive'}</span>
            </button>
            <button className="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
            <button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Key Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card text-card-foreground rounded-lg p-6 border">
              <h2 className="text-xl font-semibold mb-4">Key Data</h2>
              <div className="space-y-4">
                {Object.entries(keyData).map(([key, value]) => {
                  const isSensitive = key.toLowerCase().includes('private') || 
                                    key.toLowerCase().includes('secret') || 
                                    key.toLowerCase().includes('seed');
                  
                  return (
                    <SecureField
                      key={key}
                      label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      value={String(value)}
                      sensitive={isSensitive && !showSensitiveData}
                    />
                  );
                })}
              </div>
            </div>

            {/* Metadata */}
            {Object.keys(metadata).length > 0 && (
              <div className="bg-card text-card-foreground rounded-lg p-6 border">
                <h2 className="text-xl font-semibold mb-4">Metadata</h2>
                <div className="space-y-4">
                  {Object.entries(metadata).map(([key, value]) => (
                    <SecureField
                      key={key}
                      label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      value={String(value)}
                      sensitive={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Key Info */}
            <div className="bg-card text-card-foreground rounded-lg p-6 border">
              <h3 className="text-lg font-semibold mb-4">Key Information</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">ID:</span>
                  <div className="font-mono text-xs bg-muted rounded p-2 mt-1 break-all">
                    {item.id}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <div className="capitalize mt-1">{item.item_type}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <div className="mt-1">{formatDate(item.created_at)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Updated:</span>
                  <div className="mt-1">{formatDate(item.updated_at)}</div>
                </div>
              </div>
            </div>

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div className="bg-card text-card-foreground rounded-lg p-6 border">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <Tag className="w-4 h-4" />
                  <span>Tags</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Security Notice */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-yellow-700 dark:text-yellow-400 mb-1">Security Notice</div>
                  <div className="text-yellow-800 dark:text-yellow-200">
                    Sensitive data is masked by default. Use the "Show Sensitive" button to reveal private keys and secrets.
                    Copied sensitive data will be automatically cleared from clipboard after 30 seconds.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyDetailsPage;
