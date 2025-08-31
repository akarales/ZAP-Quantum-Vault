import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, Eye, EyeOff, Trash2, Key } from 'lucide-react';

interface VaultPasswordInfo {
  vault_id: string;
  vault_name: string;
  password_hint: string | null;
  created_at: string;
}

interface VaultPasswordsSectionProps {
  userId: string;
}

export function VaultPasswordsSection({ userId }: VaultPasswordsSectionProps) {
  const [passwords, setPasswords] = useState<VaultPasswordInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadVaultPasswords();
  }, [userId]);

  const loadVaultPasswords = async () => {
    setLoading(true);
    setError('');
    
    try {
      const passwordList = await invoke<VaultPasswordInfo[]>('get_user_vault_passwords', { userId });
      setPasswords(passwordList);
    } catch (err) {
      setError(`Failed to load vault passwords: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const revealPassword = async (vaultId: string) => {
    if (revealedPasswords[vaultId]) {
      // Toggle visibility
      setShowPasswords(prev => ({ ...prev, [vaultId]: !prev[vaultId] }));
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const password = await invoke<string>('get_vault_password', { userId, vaultId });
      setRevealedPasswords(prev => ({ ...prev, [vaultId]: password }));
      setShowPasswords(prev => ({ ...prev, [vaultId]: true }));
    } catch (err) {
      if (err === 'NO_STORED_PASSWORD') {
        setError('No password stored for this vault');
      } else {
        setError(`Failed to retrieve password: ${err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, vaultName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`Password for ${vaultName} copied to clipboard!`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const deletePassword = async (vaultId: string, vaultName: string) => {
    if (!confirm(`Are you sure you want to delete the stored password for "${vaultName}"?`)) {
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await invoke('delete_vault_password', { userId, vaultId });
      setSuccess(`Password for ${vaultName} deleted successfully`);
      
      // Remove from local state
      setPasswords(prev => prev.filter(p => p.vault_id !== vaultId));
      setRevealedPasswords(prev => {
        const updated = { ...prev };
        delete updated[vaultId];
        return updated;
      });
      setShowPasswords(prev => {
        const updated = { ...prev };
        delete updated[vaultId];
        return updated;
      });
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to delete password: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const updateHint = async (vaultId: string, hint: string) => {
    setLoading(true);
    setError('');
    
    try {
      await invoke('update_vault_password_hint', { userId, vaultId, hint });
      setSuccess('Password hint updated successfully');
      
      // Update local state
      setPasswords(prev => prev.map(p => 
        p.vault_id === vaultId ? { ...p, password_hint: hint } : p
      ));
      
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(`Failed to update hint: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            Vault Passwords
          </h2>
          <p className="text-muted-foreground">
            Manage stored encryption passwords for your vaults
          </p>
        </div>
        <Button onClick={loadVaultPasswords} variant="outline" size="sm" disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
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

      {passwords.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No vault passwords stored</h3>
            <p className="text-muted-foreground">
              Vault passwords will appear here when you create vaults with encryption passwords.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {passwords.map((passwordInfo) => (
            <Card key={passwordInfo.vault_id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {passwordInfo.vault_name}
                      <Badge variant="outline">Encrypted</Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Created {new Date(passwordInfo.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revealPassword(passwordInfo.vault_id)}
                      disabled={loading}
                    >
                      {showPasswords[passwordInfo.vault_id] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    {revealedPasswords[passwordInfo.vault_id] && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(
                          revealedPasswords[passwordInfo.vault_id], 
                          passwordInfo.vault_name
                        )}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePassword(passwordInfo.vault_id, passwordInfo.vault_name)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {showPasswords[passwordInfo.vault_id] && revealedPasswords[passwordInfo.vault_id] && (
                    <div>
                      <Label>Password</Label>
                      <div className="font-mono text-sm bg-muted p-2 rounded border break-all">
                        {revealedPasswords[passwordInfo.vault_id]}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor={`hint-${passwordInfo.vault_id}`}>Password Hint</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id={`hint-${passwordInfo.vault_id}`}
                        value={passwordInfo.password_hint || ''}
                        onChange={(e) => {
                          const newHint = e.target.value;
                          setPasswords(prev => prev.map(p => 
                            p.vault_id === passwordInfo.vault_id 
                              ? { ...p, password_hint: newHint } 
                              : p
                          ));
                        }}
                        placeholder="Enter a hint to help remember this password"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateHint(passwordInfo.vault_id, passwordInfo.password_hint || '')}
                        disabled={loading}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
