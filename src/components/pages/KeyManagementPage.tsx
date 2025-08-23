import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Key, 
  Plus, 
  Download, 
  Upload, 
  Trash2, 
  Eye, 
  EyeOff, 
  Copy, 
  Shield, 
  Lock,
  Unlock,
  Search,
  Filter,
  MoreVertical,
  Calendar,
  User,
  FileKey
} from 'lucide-react';

interface CryptoKey {
  id: string;
  name: string;
  type: 'RSA' | 'AES' | 'ECDSA' | 'ML-DSA' | 'ML-KEM' | 'SLH-DSA';
  size: number;
  algorithm: string;
  purpose: 'encryption' | 'signing' | 'key_exchange';
  status: 'active' | 'expired' | 'revoked';
  created_at: string;
  expires_at?: string;
  owner: string;
  usage_count: number;
  quantum_safe: boolean;
}

export const KeyManagementPage: React.FC = () => {
  const [keys, setKeys] = useState<CryptoKey[]>([
    {
      id: '1',
      name: 'Primary RSA Key',
      type: 'RSA',
      size: 4096,
      algorithm: 'RSA-4096',
      purpose: 'encryption',
      status: 'active',
      created_at: '2025-08-23T10:30:00Z',
      expires_at: '2026-08-23T10:30:00Z',
      owner: 'anubix',
      usage_count: 42,
      quantum_safe: false
    },
    {
      id: '2',
      name: 'Quantum-Safe Signing Key',
      type: 'ML-DSA',
      size: 2048,
      algorithm: 'ML-DSA-65',
      purpose: 'signing',
      status: 'active',
      created_at: '2025-08-23T11:00:00Z',
      owner: 'anubix',
      usage_count: 15,
      quantum_safe: true
    },
    {
      id: '3',
      name: 'AES Encryption Key',
      type: 'AES',
      size: 256,
      algorithm: 'AES-256-GCM',
      purpose: 'encryption',
      status: 'active',
      created_at: '2025-08-23T09:15:00Z',
      owner: 'anubix',
      usage_count: 128,
      quantum_safe: false
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKey, setNewKey] = useState({
    name: '',
    type: 'RSA' as const,
    size: 2048,
    purpose: 'encryption' as const,
    expires_at: ''
  });

  const filteredKeys = keys.filter(key => {
    const matchesSearch = key.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         key.algorithm.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || key.type === filterType;
    const matchesStatus = filterStatus === 'all' || key.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-yellow-100 text-yellow-800';
      case 'revoked': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'RSA': return <Key className="h-4 w-4" />;
      case 'AES': return <Lock className="h-4 w-4" />;
      case 'ECDSA': return <Shield className="h-4 w-4" />;
      case 'ML-DSA':
      case 'ML-KEM':
      case 'SLH-DSA': return <FileKey className="h-4 w-4 text-purple-600" />;
      default: return <Key className="h-4 w-4" />;
    }
  };

  const handleCreateKey = () => {
    const key: CryptoKey = {
      id: Date.now().toString(),
      name: newKey.name,
      type: newKey.type,
      size: newKey.size,
      algorithm: `${newKey.type}-${newKey.size}`,
      purpose: newKey.purpose,
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: newKey.expires_at || undefined,
      owner: 'anubix',
      usage_count: 0,
      quantum_safe: ['ML-DSA', 'ML-KEM', 'SLH-DSA'].includes(newKey.type)
    };
    
    setKeys([...keys, key]);
    setShowCreateDialog(false);
    setNewKey({
      name: '',
      type: 'RSA',
      size: 2048,
      purpose: 'encryption',
      expires_at: ''
    });
  };

  const handleDeleteKey = (keyId: string) => {
    setKeys(keys.filter(k => k.id !== keyId));
  };

  const stats = [
    { label: 'Total Keys', value: keys.length, icon: Key },
    { label: 'Active Keys', value: keys.filter(k => k.status === 'active').length, icon: Shield },
    { label: 'Quantum-Safe', value: keys.filter(k => k.quantum_safe).length, icon: FileKey },
    { label: 'Expiring Soon', value: 0, icon: Calendar }
  ];

  return (
    <div className="w-full max-w-none space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Key Management</h1>
          <p className="text-muted-foreground">
            Manage your cryptographic keys and certificates
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Generate Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Generate New Key</DialogTitle>
              <DialogDescription>
                Create a new cryptographic key for encryption, signing, or key exchange.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Key Name</Label>
                <Input
                  id="name"
                  value={newKey.name}
                  onChange={(e) => setNewKey({...newKey, name: e.target.value})}
                  placeholder="Enter key name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Key Type</Label>
                <Select value={newKey.type} onValueChange={(value: any) => setNewKey({...newKey, type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select key type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSA">RSA (Classical)</SelectItem>
                    <SelectItem value="AES">AES (Symmetric)</SelectItem>
                    <SelectItem value="ECDSA">ECDSA (Elliptic Curve)</SelectItem>
                    <SelectItem value="ML-DSA">ML-DSA (Quantum-Safe)</SelectItem>
                    <SelectItem value="ML-KEM">ML-KEM (Quantum-Safe)</SelectItem>
                    <SelectItem value="SLH-DSA">SLH-DSA (Quantum-Safe)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="size">Key Size (bits)</Label>
                <Select value={newKey.size.toString()} onValueChange={(value) => setNewKey({...newKey, size: parseInt(value)})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select key size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1024">1024</SelectItem>
                    <SelectItem value="2048">2048</SelectItem>
                    <SelectItem value="3072">3072</SelectItem>
                    <SelectItem value="4096">4096</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="purpose">Purpose</Label>
                <Select value={newKey.purpose} onValueChange={(value: any) => setNewKey({...newKey, purpose: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="encryption">Encryption</SelectItem>
                    <SelectItem value="signing">Digital Signing</SelectItem>
                    <SelectItem value="key_exchange">Key Exchange</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expires">Expiration Date (Optional)</Label>
                <Input
                  id="expires"
                  type="date"
                  value={newKey.expires_at}
                  onChange={(e) => setNewKey({...newKey, expires_at: e.target.value})}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateKey} disabled={!newKey.name}>
                Generate Key
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Key Inventory</CardTitle>
          <CardDescription>
            Search and filter your cryptographic keys
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search keys..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 bg-background border-input text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="RSA">RSA</SelectItem>
                <SelectItem value="AES">AES</SelectItem>
                <SelectItem value="ECDSA">ECDSA</SelectItem>
                <SelectItem value="ML-DSA">ML-DSA</SelectItem>
                <SelectItem value="ML-KEM">ML-KEM</SelectItem>
                <SelectItem value="SLH-DSA">SLH-DSA</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Keys List */}
          <div className="space-y-4">
            {filteredKeys.map((key) => (
              <Card key={key.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {getTypeIcon(key.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium truncate">{key.name}</p>
                        {key.quantum_safe && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                            Quantum-Safe
                          </Badge>
                        )}
                        <Badge className={getStatusColor(key.status)}>
                          {key.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {key.algorithm} • {key.purpose} • Used {key.usage_count} times
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(key.created_at).toLocaleDateString()} • 
                        Owner: {key.owner}
                        {key.expires_at && ` • Expires: ${new Date(key.expires_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button className="w-full justify-start text-foreground" variant="outline">
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </Button>
                    <Button className="w-full justify-start text-foreground" variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Export Key
                    </Button>
                    <Button className="w-full justify-start text-foreground" variant="outline" disabled>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Key
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {filteredKeys.length === 0 && (
            <div className="text-center py-8">
              <Key className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No keys found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Get started by generating your first cryptographic key.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
