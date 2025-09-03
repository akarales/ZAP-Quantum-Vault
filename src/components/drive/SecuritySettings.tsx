import React, { useState } from 'react';
import { Shield, ShieldCheck, ShieldX, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { UsbDrive } from '../../types/usb';

interface SecuritySettingsProps {
  drive: UsbDrive;
  onSetTrust: (level: 'untrusted' | 'partial' | 'full') => void;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  drive,
  onSetTrust
}) => {
  const [selectedLevel, setSelectedLevel] = useState<'untrusted' | 'partial' | 'full' | null>(null);
  
  // Debug: Log drive data whenever it changes
  React.useEffect(() => {
    console.log('[SecuritySettings] Drive data updated:', {
      id: drive.id,
      trust_level: drive.trust_level,
      device_path: drive.device_path
    });
  }, [drive]);
  
  // Map backend trust levels to frontend display
  const getCurrentTrustLevel = () => {
    console.log('[SecuritySettings] Drive trust_level:', drive.trust_level);
    const mapped = (() => {
      switch (drive.trust_level.toLowerCase()) {
        case 'trusted': return 'full';
        case 'untrusted': return 'untrusted';
        case 'blocked': return 'untrusted';
        default: return 'untrusted';
      }
    })();
    console.log('[SecuritySettings] Mapped to:', mapped);
    return mapped;
  };

  const trustLevels = [
    {
      level: 'untrusted' as const,
      icon: ShieldX,
      title: 'Untrusted',
      description: 'Block all operations on this drive',
      variant: 'destructive' as const,
      color: 'text-red-600'
    },
    {
      level: 'partial' as const,
      icon: Shield,
      title: 'Partial Trust',
      description: 'Allow read operations, require confirmation for writes',
      variant: 'secondary' as const,
      color: 'text-yellow-600'
    },
    {
      level: 'full' as const,
      icon: ShieldCheck,
      title: 'Full Trust',
      description: 'Allow all operations without additional confirmation',
      variant: 'default' as const,
      color: 'text-green-600'
    }
  ];

  const handleSetTrust = async () => {
    if (selectedLevel) {
      try {
        await onSetTrust(selectedLevel);
        // Clear selection after successful update
        setSelectedLevel(null);
      } catch (error) {
        console.error('Failed to set trust level:', error);
      }
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="w-4 h-4" />
          Security & Trust Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="font-medium text-xs">Current Trust Level</p>
            <p className="text-xs text-muted-foreground capitalize">
              {getCurrentTrustLevel() === 'full' ? 'Full Trust' : 'Untrusted'}
            </p>
          </div>
          <div>
            <p className="font-medium text-xs">Encryption</p>
            <p className="text-xs text-muted-foreground">
              {drive.is_encrypted || drive.filesystem === 'LUKS Encrypted' || drive.filesystem === 'crypto_LUKS' 
                ? 'LUKS2 Encrypted' 
                : 'Not Encrypted'}
            </p>
          </div>
        </div>
        
        <Alert className="py-2">
          <AlertTriangle className="h-3 w-3" />
          <AlertDescription className="text-xs">
            Trust levels control operations. Changes take effect immediately.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          {trustLevels.map((trust) => {
            const Icon = trust.icon;
            const isSelected = selectedLevel === trust.level;
            const isCurrent = getCurrentTrustLevel() === trust.level;
            
            return (
              <div
                key={trust.level}
                className={`p-2 border rounded cursor-pointer transition-colors ${
                  isSelected 
                    ? 'border-primary bg-primary/5' 
                    : isCurrent
                    ? 'border-green-500 bg-green-50'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setSelectedLevel(trust.level)}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-3 h-3 mt-0.5 ${trust.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-xs">{trust.title}</h4>
                      <Badge variant={trust.variant} className="text-xs">
                        {trust.level}
                      </Badge>
                      {isCurrent && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-tight">
                      {trust.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-3 h-3 rounded-full bg-primary flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button 
            onClick={handleSetTrust}
            disabled={!selectedLevel}
            className="flex-1"
            size="sm"
          >
            Apply Trust Level
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setSelectedLevel(null)}
            disabled={!selectedLevel}
            size="sm"
          >
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
