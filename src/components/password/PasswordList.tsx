import { useState } from 'react';
import { Copy, Edit2, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { UsbDrivePassword } from '../../types/usb';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface PasswordListProps {
  passwords: UsbDrivePassword[];
  loading?: boolean;
  onCopyPassword: (passwordId: string) => void;
  onUpdateHint: (passwordId: string, hint: string) => void;
  onDeletePassword: (passwordId: string) => void;
}

export const PasswordList = ({
  passwords,
  loading = false,
  onCopyPassword,
  onUpdateHint,
  onDeletePassword
}: PasswordListProps) => {
  const [editingHint, setEditingHint] = useState<string | null>(null);
  const [newHint, setNewHint] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);

  const handleEditHint = (password: UsbDrivePassword) => {
    setEditingHint(password.id);
    setNewHint(password.password_hint || '');
  };

  const handleSaveHint = () => {
    if (editingHint) {
      onUpdateHint(editingHint, newHint);
      setEditingHint(null);
      setNewHint('');
    }
  };

  const handleCancelEdit = () => {
    setEditingHint(null);
    setNewHint('');
  };

  const handleDeleteConfirm = (passwordId: string) => {
    onDeletePassword(passwordId);
    setShowDeleteDialog(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="md" />
        <span className="ml-2 text-muted-foreground">Loading passwords...</span>
      </div>
    );
  }

  if (passwords.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No saved passwords found.</p>
        <p className="text-sm mt-1">Passwords will appear here when you save them during drive mounting.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {passwords.map((password) => (
        <Card key={password.id} className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium">
                    {password.drive_label || 'Unlabeled Drive'}
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {password.device_path}
                  </Badge>
                </div>
                
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Created: {formatDate(password.created_at)}</p>
                  {password.last_used && (
                    <p>Last used: {formatDate(password.last_used)}</p>
                  )}
                  
                  {editingHint === password.id ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        value={newHint}
                        onChange={(e) => setNewHint(e.target.value)}
                        placeholder="Enter password hint"
                        className="text-sm"
                      />
                      <Button size="sm" onClick={handleSaveHint}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs">
                        Hint: {password.password_hint || 'No hint provided'}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditHint(password)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCopyPassword(password.id)}
                  className="h-8 w-8 p-0"
                  title="Copy password"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteDialog(password.id)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  title="Delete password"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Password</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this saved password? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteDialog && handleDeleteConfirm(showDeleteDialog)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
