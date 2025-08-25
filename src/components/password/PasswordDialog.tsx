import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string, savePassword: boolean, hint?: string) => void;
  title?: string;
  description?: string;
  showSaveOption?: boolean;
  loading?: boolean;
}

export const PasswordDialog = ({
  open,
  onOpenChange,
  onSubmit,
  title = "Enter Password",
  description = "This drive is encrypted. Please enter the password to unlock it.",
  showSaveOption = true,
  loading = false
}: PasswordDialogProps) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savePassword, setSavePassword] = useState(false);
  const [hint, setHint] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onSubmit(password, savePassword, hint || undefined);
      // Reset form
      setPassword('');
      setHint('');
      setSavePassword(false);
      setShowPassword(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setHint('');
    setSavePassword(false);
    setShowPassword(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="pr-10"
                disabled={loading}
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {showSaveOption && (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="save-password"
                  checked={savePassword}
                  onCheckedChange={(checked) => setSavePassword(checked as boolean)}
                  disabled={loading}
                />
                <Label htmlFor="save-password" className="text-sm">
                  Save password for future use
                </Label>
              </div>

              {savePassword && (
                <div className="space-y-2">
                  <Label htmlFor="hint">Password Hint (Optional)</Label>
                  <Input
                    id="hint"
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    placeholder="e.g., Birthday + pet name"
                    disabled={loading}
                  />
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!password.trim() || loading}
            >
              {loading ? 'Unlocking...' : 'Unlock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
