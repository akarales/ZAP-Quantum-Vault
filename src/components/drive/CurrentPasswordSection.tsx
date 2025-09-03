import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EyeIcon, EyeOffIcon, CheckIcon } from 'lucide-react';
import { safeTauriInvoke } from '@/utils/tauri-api';
import { useAuth } from '@/context/AuthContext';

interface CurrentPasswordSectionProps {
  drive: any;
}

export const CurrentPasswordSection: React.FC<CurrentPasswordSectionProps> = ({ drive }) => {
  const { user } = useAuth();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [verificationInProgress, setVerificationInProgress] = useState(false);
  const [storedPassword, setStoredPassword] = useState('');
  const [loadingStoredPassword, setLoadingStoredPassword] = useState(false);

  const isEncrypted = drive.filesystem === 'LUKS Encrypted' || drive.filesystem === 'crypto_LUKS';

  // Fetch stored password for encrypted drives
  useEffect(() => {
    console.log('[CurrentPasswordSection] useEffect triggered - isEncrypted:', isEncrypted, 'drive?.id:', drive?.id, 'user?.id:', user?.id);
    
    const fetchStoredPassword = async () => {
      if (!isEncrypted || !drive?.id || !user?.id) {
        console.log('[CurrentPasswordSection] Skipping password fetch - conditions not met');
        return;
      }
      
      console.log('[CurrentPasswordSection] Starting password fetch for drive:', drive.id, 'user:', user.id);
      setLoadingStoredPassword(true);
      
      try {
        const result = await safeTauriInvoke('get_usb_drive_password', {
          user_id: user.id,
          drive_id: drive.id
        });
        console.log('[CurrentPasswordSection] Password fetch result:', result ? 'Found' : 'Not found');
        
        if (result && typeof result === 'string') {
          setStoredPassword(result);
          setCurrentPassword(result);
          console.log('[CurrentPasswordSection] Password set successfully');
        } else {
          console.log('[CurrentPasswordSection] No stored password found or invalid type:', typeof result, result);
          setStoredPassword(''); // Clear stored password state
          setCurrentPassword(''); // Ensure it's always a string
        }
      } catch (error) {
        console.error('[CurrentPasswordSection] Failed to fetch stored password:', error);
        // Don't show error to user - password might not be stored yet
      } finally {
        setLoadingStoredPassword(false);
        console.log('[CurrentPasswordSection] Password fetch completed');
      }
    };

    fetchStoredPassword();
  }, [isEncrypted, drive?.id, user?.id]);

  const handleVerifyPassword = async () => {
    console.log('[CurrentPasswordSection] Starting password verification');
    
    if (!currentPassword || typeof currentPassword !== 'string' || !currentPassword.trim()) {
      console.log('[CurrentPasswordSection] No password to verify - currentPassword:', typeof currentPassword, currentPassword);
      return;
    }

    setVerificationInProgress(true);
    try {
      console.log('[CurrentPasswordSection] Calling verify_drive_password for drive:', drive.id);
      const result = await safeTauriInvoke('verify_drive_password', {
        drive_id: drive.id,
        password: currentPassword
      });
      console.log('[CurrentPasswordSection] Password verification result:', result);
      
      setPasswordVerified(result === true);
    } catch (error) {
      console.error('[CurrentPasswordSection] Password verification failed:', error);
      setPasswordVerified(false);
    } finally {
      setVerificationInProgress(false);
      console.log('[CurrentPasswordSection] Password verification completed');
    }
  };

  // Enhanced debugging for currentPassword state changes
  useEffect(() => {
    console.log('[CurrentPasswordSection] currentPassword state changed:', {
      value: currentPassword,
      type: typeof currentPassword,
      isString: typeof currentPassword === 'string',
      hasLength: currentPassword?.length,
      canTrim: typeof currentPassword?.trim === 'function',
      timestamp: new Date().toISOString()
    });
    setPasswordVerified(false);
  }, [currentPassword]);

  if (!isEncrypted) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Drive Password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Current Password
            {loadingStoredPassword && (
              <span className="ml-2 text-xs text-muted-foreground">(Loading stored password...)</span>
            )}
            {!loadingStoredPassword && storedPassword && (
              <span className="ml-2 text-xs text-green-600">(From vault)</span>
            )}
            {!loadingStoredPassword && !storedPassword && (
              <span className="ml-2 text-xs text-blue-600">(Enter manually)</span>
            )}
          </Label>
          
          {/* Password Status Indicator */}
          <div className="text-xs text-muted-foreground mb-2">
            {loadingStoredPassword ? (
              <span className="flex items-center">
                <span className="animate-spin mr-1">🔄</span>
                Loading stored password from vault...
              </span>
            ) : storedPassword ? (
              <span className="text-green-600">
                ✅ Password automatically loaded from secure vault
              </span>
            ) : (
              <span className="text-blue-600">
                ℹ️ No stored password found - please enter the current password manually
              </span>
            )}
          </div>
          
          <div className="relative">
            <Input
              type={showCurrentPassword ? "text" : "password"}
              placeholder={loadingStoredPassword ? "Loading..." : storedPassword ? "Password loaded from vault" : "Enter current password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={`pr-20 ${passwordVerified ? 'border-green-500' : (typeof currentPassword === 'string' && currentPassword.length > 0 && !passwordVerified) ? 'border-red-500' : ''}`}
              disabled={loadingStoredPassword}
            />
            <div className="absolute right-0 top-0 h-full flex items-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-2 py-2 hover:bg-transparent"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                disabled={loadingStoredPassword}
              >
                {showCurrentPassword ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mr-1 px-2 py-1 text-xs"
                onClick={handleVerifyPassword}
                disabled={!currentPassword || typeof currentPassword !== 'string' || !currentPassword.trim() || verificationInProgress || loadingStoredPassword}
              >
                {verificationInProgress ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
          </div>
          
          {passwordVerified && (
            <p className="text-xs text-green-600 flex items-center">
              <CheckIcon className="h-3 w-3 mr-1" />
              Password verified successfully
            </p>
          )}
          
          {storedPassword && (
            <p className="text-xs text-blue-600">
              💾 Password automatically loaded from secure vault
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
