import React, { useState } from 'react';
import { Shield, ShieldCheck, ShieldX, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';

interface TrustManagementProps {
  onSetTrust: (level: 'untrusted' | 'partial' | 'full') => void;
}

export const TrustManagement: React.FC<TrustManagementProps> = ({ onSetTrust }) => {
  const [selectedLevel, setSelectedLevel] = useState<'untrusted' | 'partial' | 'full' | null>(null);

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

  const handleSetTrust = () => {
    if (selectedLevel) {
      onSetTrust(selectedLevel);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Trust Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Trust levels control what operations are allowed on this drive. Changes take effect immediately.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {trustLevels.map((trust) => {
            const Icon = trust.icon;
            const isSelected = selectedLevel === trust.level;
            
            return (
              <div
                key={trust.level}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  isSelected 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setSelectedLevel(trust.level)}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 ${trust.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{trust.title}</h4>
                      <Badge variant={trust.variant} className="text-xs">
                        {trust.level}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {trust.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button 
            onClick={handleSetTrust}
            disabled={!selectedLevel}
            className="flex-1"
          >
            Apply Trust Level
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setSelectedLevel(null)}
            disabled={!selectedLevel}
          >
            Clear Selection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
