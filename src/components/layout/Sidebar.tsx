import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Key,
  Shield,
  Database,
  Users,
  Settings,
  Activity,
  HardDrive,
  Zap,
  BarChart3,
  HelpCircle,
  Headphones,
  Building2,
  Atom,
  Snowflake,
  Bitcoin,
  AlertTriangle
} from 'lucide-react';

interface SidebarProps {}

const navigationItems = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Activity', href: '/activity', icon: Activity },
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    ]
  },
  {
    title: 'Security',
    items: [
      { name: 'Bitcoin Keys', href: '/bitcoin-keys', icon: Bitcoin },
      { name: 'Ethereum Keys', href: '/ethereum-keys', icon: Key },
      { name: 'Cosmos Keys', href: '/cosmos-keys', icon: Zap },
      { name: 'ZAP Keys', href: '/zap-keys', icon: Zap },
      { name: 'Secure Storage', href: '/storage', icon: Database },
      { name: 'Cold Storage', href: '/cold-storage', icon: Snowflake },
      { name: 'Trusted Drives', href: '/trusted-drives', icon: HardDrive },
      { name: 'Security Center', href: '/security', icon: Shield },
      { name: 'Air Gap Mode', href: '/airgap', icon: HardDrive },
    ]
  },
  {
    title: 'ZAP Blockchain',
    items: [
      { name: 'All Keys', href: '/zap-blockchain/keys', icon: Key },
      { name: 'Genesis Keys', href: '/zap-blockchain/genesis', icon: Atom },
      { name: 'Validator Keys', href: '/zap-blockchain/validators', icon: Shield },
      { name: 'Treasury Keys', href: '/zap-blockchain/treasury', icon: Key },
      { name: 'Governance Keys', href: '/zap-blockchain/governance', icon: Users },
      { name: 'Emergency Keys', href: '/zap-blockchain/emergency', icon: AlertTriangle },
    ]
  },
  {
    title: 'Organization',
    items: [
      { name: 'Organization', href: '/organization', icon: Building2 },
      { name: 'Users', href: '/users', icon: Users },
    ]
  },
  {
    title: 'Support',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
      { name: 'Help', href: '/help', icon: HelpCircle },
      { name: 'Support', href: '/support', icon: Headphones },
    ]
  }
];

export const Sidebar: React.FC<SidebarProps> = () => {
  const location = useLocation();

  return (
    <div className="w-64 bg-card border-r border-border hidden md:block">
      <ScrollArea className="h-full">
        <div className="space-y-4 py-4">
          {navigationItems.map((section) => (
            <div key={section.title} className="px-3 py-2">
              <h2 className="mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
                {section.title}
              </h2>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  
                  return (
                    <Button
                      key={item.name}
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start",
                        isActive && "bg-muted font-medium"
                      )}
                      asChild
                    >
                      <Link to={item.href}>
                        <Icon className="mr-2 h-4 w-4" />
                        {item.name}
                      </Link>
                    </Button>
                  );
                })}
              </div>
              {section.title !== 'Support' && (
                <Separator className="my-4" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
