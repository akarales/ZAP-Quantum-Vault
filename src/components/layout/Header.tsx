import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { MobileSidebar } from './MobileSidebar';
import { Shield } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="flex h-14 items-center px-4 md:px-6">
        <div className="flex items-center space-x-3">
          <MobileSidebar />
          <Shield className="h-6 w-6 text-blue-400" />
          <h1 className="text-lg font-semibold">ZAP Quantum Vault</h1>
        </div>
        
        <div className="ml-auto flex items-center space-x-4">
          <ThemeToggle />
          {user && (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">{user.username}</span>
                <Badge variant="secondary" className="text-xs">
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
