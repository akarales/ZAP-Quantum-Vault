import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ThemeCustomizer } from '@/components/ui/theme-customizer';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useTheme } from '@/themes/ThemeManager';
import { 
  Palette, 
  Shield, 
  Zap, 
  Lock, 
  Key, 
  Database,
  Settings,
  Bell,
  User,
  Download,
  Upload,
  Trash2
} from 'lucide-react';

export function ThemeDemo() {
  const { currentThemeConfig } = useTheme();

  return (
    <div className="min-h-screen bg-background p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">ZAP Vault Theme System</h1>
          <p className="text-muted-foreground mt-1">
            Advanced theming with TweakCN integration and instant switching
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="secondary">Current: {currentThemeConfig.name}</Badge>
          <ThemeToggle />
        </div>
      </div>

      {/* Theme Customizer */}
      <ThemeCustomizer />

      {/* Component Showcase */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-foreground">Component Showcase</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Primary Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Primary Actions
              </CardTitle>
              <CardDescription>
                Main interactive elements with primary styling
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full">Primary Button</Button>
              <Button variant="secondary" className="w-full">Secondary Button</Button>
              <Button variant="outline" className="w-full">Outline Button</Button>
              <Button variant="ghost" className="w-full">Ghost Button</Button>
            </CardContent>
          </Card>

          {/* Security Features Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Features
              </CardTitle>
              <CardDescription>
                Vault security and encryption controls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <span className="text-sm">Encryption: AES-256</span>
              </div>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                <span className="text-sm">Key Derivation: PBKDF2</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <span className="text-sm">Storage: Encrypted SQLite</span>
              </div>
              <Button variant="destructive" size="sm" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Secure Wipe
              </Button>
            </CardContent>
          </Card>

          {/* Form Elements Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Form Elements
              </CardTitle>
              <CardDescription>
                Input fields and form controls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="vault-name">Vault Name</Label>
                <Input id="vault-name" placeholder="My Secure Vault" />
              </div>
              <div>
                <Label htmlFor="master-key">Master Key</Label>
                <Input id="master-key" type="password" placeholder="••••••••••••" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status & Notifications Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Status & Alerts
              </CardTitle>
              <CardDescription>
                System status and notification badges
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>Online</Badge>
                <Badge variant="secondary">Synced</Badge>
                <Badge variant="destructive">Alert</Badge>
                <Badge variant="outline">Pending</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Vault Status</span>
                  <Badge className="bg-green-500">Secure</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Last Backup</span>
                  <Badge variant="secondary">2 hours ago</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Sync Status</span>
                  <Badge variant="outline">Up to date</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Profile
              </CardTitle>
              <CardDescription>
                Account information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">John Doe</p>
                  <p className="text-sm text-muted-foreground">john@example.com</p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="text-muted-foreground">Plan:</span> Premium
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Vaults:</span> 5/10
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Storage:</span> 2.1GB/5GB
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Theme Preview Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Color Palette
              </CardTitle>
              <CardDescription>
                Current theme color scheme preview
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <div 
                    className="h-8 rounded border"
                    style={{ backgroundColor: `hsl(${currentThemeConfig.colors.primary})` }}
                  />
                  <p className="text-xs text-center">Primary</p>
                </div>
                <div className="space-y-1">
                  <div 
                    className="h-8 rounded border"
                    style={{ backgroundColor: `hsl(${currentThemeConfig.colors.secondary})` }}
                  />
                  <p className="text-xs text-center">Secondary</p>
                </div>
                <div className="space-y-1">
                  <div 
                    className="h-8 rounded border"
                    style={{ backgroundColor: `hsl(${currentThemeConfig.colors.accent})` }}
                  />
                  <p className="text-xs text-center">Accent</p>
                </div>
                <div className="space-y-1">
                  <div 
                    className="h-8 rounded border"
                    style={{ backgroundColor: `hsl(${currentThemeConfig.colors.muted})` }}
                  />
                  <p className="text-xs text-center">Muted</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Radius: {currentThemeConfig.radius}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground border-t pt-6">
        <p>ZAP Vault Theme System • Powered by TweakCN Integration</p>
      </div>
    </div>
  );
}
