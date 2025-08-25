import { useState, useEffect } from 'react';
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
import { useAuth } from '@/context/AuthContext';

interface Vault {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  vault_type: string;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

interface VaultItem {
  id: string;
  vault_id: string;
  name: string;
  data_type: string;
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
  name: string;
  data_type: string;
  data: string;
  metadata?: string;
  tags?: string[];
}

export default function VaultPage() {
  const { user } = useAuth();
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateVault, setShowCreateVault] = useState(false);
  const [showCreateItem, setShowCreateItem] = useState(false);
  const [showItemData, setShowItemData] = useState<{ [key: string]: boolean }>({});

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
    name: '',
    data_type: 'text',
    data: '',
    metadata: '',
    tags: []
  });

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (user) {
      loadVaults();
    }
  }, [user]);

  const loadVaults = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      const userVaults = await invoke<Vault[]>('get_user_vaults', { userId: user.id });
      setVaults(userVaults);
    } catch (err) {
      setError(`Failed to load vaults: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const loadVaultItems = async (vaultId: string) => {
    setLoading(true);
    setError('');
    
    try {
      const items = await invoke<VaultItem[]>('get_vault_items', { vaultId });
      setVaultItems(items);
    } catch (err) {
      setError(`Failed to load vault items: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVault = async () => {
    if (!user || !newVault.name.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await invoke('create_vault', {
        userId: user.id,
        request: newVault
      });
      
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
    if (!selectedVault || !newItem.name.trim() || !newItem.data.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const itemData = {
        ...newItem,
        vault_id: selectedVault.id,
        tags: tagInput ? tagInput.split(',').map(tag => tag.trim()).filter(tag => tag) : []
      };

      await invoke('create_vault_item', { request: itemData });
      
      setSuccess('Item added to vault successfully!');
      setShowCreateItem(false);
      setNewItem({
        vault_id: '',
        name: '',
        data_type: 'text',
        data: '',
        metadata: '',
        tags: []
      });
      setTagInput('');
      
      await loadVaultItems(selectedVault.id);
    } catch (err) {
      setError(`Failed to create vault item: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVault = async (vault: Vault) => {
    setSelectedVault(vault);
    await loadVaultItems(vault.id);
  };

  const toggleItemDataVisibility = async (itemId: string) => {
    if (showItemData[itemId]) {
      // Hide data
      setShowItemData(prev => ({ ...prev, [itemId]: false }));
    } else {
      // Show data - decrypt first
      try {
        const decryptedData = await invoke<string>('decrypt_vault_item', { itemId });
        setVaultItems(prev => prev.map(item => 
          item.id === itemId 
            ? { ...item, encrypted_data: decryptedData }
            : item
        ));
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
      await invoke('delete_vault', { vaultId });
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
      await invoke('delete_vault_item', { itemId });
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Vault className="h-8 w-8" />
            My Vaults
          </h1>
          <p className="text-muted-foreground mt-1">
            Securely store and manage your sensitive data
          </p>
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
                Create a secure vault to store your sensitive data.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="vault-name">Vault Name *</Label>
                <Input
                  id="vault-name"
                  value={newVault.name}
                  onChange={(e) => setNewVault(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter vault name"
                />
              </div>
              
              <div>
                <Label htmlFor="vault-description">Description</Label>
                <Textarea
                  id="vault-description"
                  value={newVault.description}
                  onChange={(e) => setNewVault(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="vault-type">Vault Type</Label>
                <Select
                  value={newVault.vault_type}
                  onValueChange={(value) => setNewVault(prev => ({ ...prev, vault_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
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
          {loading && vaults.length === 0 ? (
            <div className="text-center py-8">Loading vaults...</div>
          ) : vaults.length === 0 ? (
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
                <Card key={vault.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          {vault.name}
                        </CardTitle>
                        {vault.description && (
                          <CardDescription className="mt-1">
                            {vault.description}
                          </CardDescription>
                        )}
                      </div>
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
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{vault.vault_type}</Badge>
                        {vault.is_shared && (
                          <Badge variant="outline">
                            <Share2 className="h-3 w-3 mr-1" />
                            Shared
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Created {formatDate(vault.created_at)}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          onClick={() => handleSelectVault(vault)}
                          className="flex-1"
                        >
                          View Items
                        </Button>
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
              <div>
                <h2 className="text-xl font-semibold">{selectedVault.name}</h2>
                <p className="text-muted-foreground">
                  {selectedVault.description || 'No description'}
                </p>
              </div>
              
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
                      <Label htmlFor="item-name">Item Name *</Label>
                      <Input
                        id="item-name"
                        value={newItem.name}
                        onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter item name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="item-type">Data Type</Label>
                      <Select
                        value={newItem.data_type}
                        onValueChange={(value) => setNewItem(prev => ({ ...prev, data_type: value }))}
                      >
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
                      <Label htmlFor="item-data">Data *</Label>
                      <Textarea
                        id="item-data"
                        value={newItem.data}
                        onChange={(e) => setNewItem(prev => ({ ...prev, data: e.target.value }))}
                        placeholder="Enter sensitive data"
                        rows={4}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="item-metadata">Metadata</Label>
                      <Input
                        id="item-metadata"
                        value={newItem.metadata}
                        onChange={(e) => setNewItem(prev => ({ ...prev, metadata: e.target.value }))}
                        placeholder="Optional metadata"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="item-tags">Tags</Label>
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
                      disabled={loading || !newItem.name.trim() || !newItem.data.trim()}
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
                            {item.name}
                            <Badge variant="outline">{item.data_type}</Badge>
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
                        {showItemData[item.id] && (
                          <div className="p-3 bg-muted rounded-md">
                            <Label className="text-sm font-medium">Data:</Label>
                            <pre className="text-sm mt-1 whitespace-pre-wrap break-words">
                              {item.encrypted_data}
                            </pre>
                          </div>
                        )}
                        
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {item.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Created {formatDate(item.created_at)}
                          </div>
                          {item.updated_at !== item.created_at && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Updated {formatDate(item.updated_at)}
                            </div>
                          )}
                        </div>
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
