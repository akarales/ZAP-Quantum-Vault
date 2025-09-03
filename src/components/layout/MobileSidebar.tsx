import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Menu } from 'lucide-react';
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
  Network,
  BarChart3,
  HelpCircle,
  Headphones,
  Building2,
  Atom,
  Bitcoin,
  Snowflake
} from 'lucide-react';

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
      { name: 'Secure Storage', href: '/storage', icon: Database },
      { name: 'Cold Storage', href: '/cold-storage', icon: Snowflake },
      { name: 'Security Center', href: '/security', icon: Shield },
      { name: 'Air Gap Mode', href: '/airgap', icon: HardDrive },
    ]
  },
  {
    title: 'Quantum & Blockchain',
    items: [
      { name: 'Quantum Safe', href: '/quantum', icon: Atom },
      { name: 'Transactions', href: '/blockchain/transactions', icon: Zap },
      { name: 'Networks', href: '/blockchain/networks', icon: Network },
      { name: 'ZAP Chain', href: '/blockchain/zap-chain', icon: Zap },
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

export const MobileSidebar: React.FC = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
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
                      key={item.href}
                      variant={isActive ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full justify-start text-foreground hover:text-foreground hover:bg-accent',
                        isActive && 'bg-secondary text-secondary-foreground'
                      )}
                      asChild
                      onClick={() => setOpen(false)}
                    >
                      <Link to={item.href} className="text-foreground hover:text-foreground">
                        <Icon className="mr-2 h-4 w-4" />
                        <span className="text-foreground">{item.name}</span>
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
      </SheetContent>
    </Sheet>
  );
};
