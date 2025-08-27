import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Vault, Lock, Share2, Calendar, Trash2, Eye, EyeOff } from 'lucide-react';

interface Vault {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  vault_type: string;
  is_shared: boolean;
  is_default: boolean;
  is_system_default: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}

interface VaultItem {
  id: string;
  vault_id: string;
  title: string;
  item_type: string;
  encrypted_data: string;
  metadata?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

interface CreateVaultRequest {
  name: string;
  description?: string;
  vault_type: string;
  is_shared: boolean;
}

interface CreateVaultItemRequest {
  vault_id: string;
  title: string;
  item_type: string;
  data: string;
  metadata?: string;
  tags?: string[];
}

export default function VaultPage() {
  const navigate = useNavigate();
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateVault, setShowCreateVault] = useState(false);
  const [showCreateItem, setShowCreateItem] = useState(false);
  const [showItemData, setShowItemData] = useState<Record<string, boolean>>({});

  // Create vault form state
  const [newVault, setNewVault] = useState<CreateVaultRequest>({
    name: '',
    description: '',
    vault_type: 'personal',
    is_shared: false
  });

  // Create item form state
  const [newItem, setNewItem] = useState<CreateVaultItemRequest>({
    vault_id: '',
    title: '',
    item_type: 'text',
    data: '',
    metadata: '',
    tags: []
  });

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    loadVaults();
  }, []);

  const loadVaults = async () => {
    setLoading(true);
    setError(''); // Clear previous errors
    console.log('🔍 VaultPage: Starting to load vaults...');
    try {
      console.log('🔧 VaultPage: Invoking get_user_vaults_offline command...');
      const vaultList = await invoke('get_user_vaults_offline') as Vault[];
      console.log('📦 VaultPage: Raw response from backend:', JSON.stringify(vaultList, null, 2));
      console.log(`📊 VaultPage: Total vaults loaded: ${vaultList ? vaultList.length : 'null/undefined'}`);
      
      if (vaultList && Array.isArray(vaultList)) {
        vaultList.forEach((vault, index) => {
          console.log(`  📁 Vault ${index + 1}: ${vault.name} (${vault.id}) - Default: ${vault.is_default}, System: ${vault.is_system_default}`);
        });
        
        setVaults(vaultList);
        console.log('✅ VaultPage: Vaults successfully set in state');
      } else {
        console.warn('⚠️ VaultPage: Received invalid vault data:', vaultList);
        setVaults([]);
        setError('Received invalid vault data from backend');
      }
    } catch (err) {
      console.error('❌ VaultPage: Failed to load vaults:', err);
      console.error('❌ VaultPage: Error details:', JSON.stringify(err, null, 2));
      setError(`Failed to load vaults: ${err}`);
      setVaults([]); // Ensure vaults is empty on error
    } finally {
      setLoading(false);
    }
  };

  const debugDatabase = async () => {
    console.log('🔍 VaultPage: Running database debug...');
    try {
      const dbState = await invoke('debug_database_state') as string;
      console.log('📊 Database State:', dbState);
      
      const vaultQuery = await invoke('debug_vault_query') as string;
      console.log('📦 Vault Query Result:', vaultQuery);
      
      alert(`Database Debug Results:\n\n${dbState}\n\n${vaultQuery}`);
    } catch (err) {
      console.error('❌ Debug failed:', err);
      alert(`Debug failed: ${err}`);
    }
  };

  const loadVaultItems = async (vaultId: string) => {
    setLoading(true);
    setError('');
    
    try {
      const items = await invoke<VaultItem[]>('get_vault_items_offline', { vaultId });
      setVaultItems(items);
    } catch (err) {
      setError(`Failed to load vault items: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVault = async () => {
    if (!newVault.name.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await invoke('create_vault_offline', { request: newVault });
      setSuccess('Vault created successfully!');
      setShowCreateVault(false);
      setNewVault({
        name: '',
        description: '',
        vault_type: 'personal',
        is_shared: false
      });
      
      await loadVaults();
    } catch (err) {
      setError(`Failed to create vault: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async () => {
    if (!selectedVault || !newItem.title.trim() || !newItem.data.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const itemData = {
        ...newItem,
        vault_id: selectedVault.id,
        tags: tagInput ? tagInput.split(',').map(tag => tag.trim()).filter(tag => tag) : []
      };

      await invoke('create_vault_item_offline', { request: itemData });
      
      setSuccess('Item added to vault successfully!');
      setTagInput('');
      
      await loadVaultItems(selectedVault.id);
    } catch (err) {
      setError(`Failed to create vault item: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVault = async (vault: Vault) => {
    // Navigate to vault details page instead of loading items inline
    navigate(`/vault/${vault.id}`);
  };

  const toggleItemDataVisibility = async (itemId: string) => {
    if (showItemData[itemId]) {
      setShowItemData(prev => ({ ...prev, [itemId]: false }));
    } else {
      try {
        await invoke('decrypt_vault_item_offline', { itemId });
        setShowItemData(prev => ({ ...prev, [itemId]: true }));
      } catch (err) {
        setError(`Failed to decrypt item: ${err}`);
      }
    }
  };

  const handleDeleteVault = async (vaultId: string) => {
    if (!confirm('Are you sure you want to delete this vault? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await invoke('delete_vault_offline', { vaultId });
      setSuccess('Vault deleted successfully!');
      
      if (selectedVault?.id === vaultId) {
        setSelectedVault(null);
        setVaultItems([]);
      }
      
      await loadVaults();
    } catch (err) {
      setError(`Failed to delete vault: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await invoke('delete_vault_item_offline', { itemId });
      setSuccess('Item deleted successfully!');
      
      if (selectedVault) {
        await loadVaultItems(selectedVault.id);
      }
    } catch (err) {
      setError(`Failed to delete item: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Vaults</h1>
          <p className="text-muted-foreground">Securely store and manage your sensitive data</p>
        </div>
        
        <Dialog open={showCreateVault} onOpenChange={setShowCreateVault}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Vault
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Vault</DialogTitle>
              <DialogDescription>
                Create a secure vault to store your sensitive information.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="vault-name">Name</Label>
                <Input
                  id="vault-name"
                  value={newVault.name}
                  onChange={(e) => setNewVault({ ...newVault, name: e.target.value })}
                  placeholder="Enter vault name"
                />
              </div>
              
              <div>
                <Label htmlFor="vault-description">Description</Label>
                <Textarea
                  id="vault-description"
                  value={newVault.description}
                  onChange={(e) => setNewVault({ ...newVault, description: e.target.value })}
                  placeholder="Enter vault description (optional)"
                />
              </div>
              
              <div>
                <Label htmlFor="vault-type">Type</Label>
                <Select value={newVault.vault_type} onValueChange={(value) => setNewVault({ ...newVault, vault_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="shared">Shared</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is-shared"
                  checked={newVault.is_shared}
                  onChange={(e) => setNewVault(prev => ({ ...prev, is_shared: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="is-shared">Allow sharing</Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateVault(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateVault} disabled={loading || !newVault.name.trim()}>
                {loading ? 'Creating...' : 'Create Vault'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="mb-4">
        <Button onClick={debugDatabase} variant="outline" size="sm">
          🔍 Debug Database
        </Button>
      </div>

      <Tabs defaultValue="vaults" className="w-full">
        <TabsList>
          <TabsTrigger value="vaults">My Vaults ({vaults.length})</TabsTrigger>
          {selectedVault && (
            <TabsTrigger value="items">
              {selectedVault.name} Items ({vaultItems.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="vaults" className="space-y-4">
          {vaults.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Vault className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No vaults yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first vault to start storing secure data.
                </p>
                <Button onClick={() => setShowCreateVault(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Vault
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vaults.map((vault) => (
                <Card key={vault.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleSelectVault(vault)}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Vault className="h-5 w-5" />
                          {vault.name}
                          <Badge variant="outline">{vault.vault_type}</Badge>
                          {vault.is_default && <Badge variant="secondary">Default</Badge>}
                          {vault.is_system_default && <Badge variant="destructive">System</Badge>}
                        </CardTitle>
                        {vault.description && (
                          <CardDescription className="mt-1">
                            {vault.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {vault.is_shared && <Share2 className="h-4 w-4 text-muted-foreground" />}
                        {!vault.is_system_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVault(vault.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Created {new Date(vault.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {selectedVault && (
          <TabsContent value="items" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Items in {selectedVault.name}</h2>
              <Dialog open={showCreateItem} onOpenChange={setShowCreateItem}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Item to Vault</DialogTitle>
                    <DialogDescription>
                      Add a new secure item to {selectedVault.name}.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="item-title">Title</Label>
                      <Input
                        id="item-title"
                        value={newItem.title}
                        onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                        placeholder="Enter item title"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="item-type">Type</Label>
                      <Select value={newItem.item_type} onValueChange={(value) => setNewItem({ ...newItem, item_type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="password">Password</SelectItem>
                          <SelectItem value="note">Note</SelectItem>
                          <SelectItem value="key">API Key</SelectItem>
                          <SelectItem value="document">Document</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="item-data">Data</Label>
                      <Textarea
                        id="item-data"
                        value={newItem.data}
                        onChange={(e) => setNewItem({ ...newItem, data: e.target.value })}
                        placeholder="Enter the data to encrypt and store"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="item-metadata">Metadata (Optional)</Label>
                      <Input
                        id="item-metadata"
                        value={newItem.metadata}
                        onChange={(e) => setNewItem({ ...newItem, metadata: e.target.value })}
                        placeholder="Additional information about this item"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="item-tags">Tags (Optional)</Label>
                      <Input
                        id="item-tags"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="Enter tags separated by commas"
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCreateItem(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateItem} 
                      disabled={loading || !newItem.title.trim() || !newItem.data.trim()}
                    >
                      {loading ? 'Adding...' : 'Add Item'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {vaultItems.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No items in this vault</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your first secure item to this vault.
                  </p>
                  <Button onClick={() => setShowCreateItem(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Item
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {vaultItems.map((item) => (
                  <Card key={item.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            {item.title}
                            <Badge variant="outline">{item.item_type}</Badge>
                          </CardTitle>
                          {item.metadata && (
                            <CardDescription className="mt-1">
                              {item.metadata}
                            </CardDescription>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleItemDataVisibility(item.id)}
                          >
                            {showItemData[item.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Created {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {item.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
