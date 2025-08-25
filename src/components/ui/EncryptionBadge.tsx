import { Shield, Lock } from 'lucide-react';
import { Badge } from './badge';

interface EncryptionBadgeProps {
  isEncrypted: boolean;
  className?: string;
}

export const EncryptionBadge = ({ isEncrypted, className = '' }: EncryptionBadgeProps) => {
  if (isEncrypted) {
    return (
      <Badge variant="secondary" className={`bg-green-100 text-green-800 ${className}`}>
        <Lock className="w-3 h-3 mr-1" />
        Encrypted
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={`text-orange-600 border-orange-300 ${className}`}>
      <Shield className="w-3 h-3 mr-1" />
      Unencrypted
    </Badge>
  );
};
