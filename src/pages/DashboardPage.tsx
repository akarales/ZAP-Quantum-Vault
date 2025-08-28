import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import { 
  Users, 
  Key, 
  Shield, 
  Database, 
  Activity, 
  RefreshCw,
  TrendingUp,
  Lock,
  Zap
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [userCount, setUserCount] = useState<number | null>(null);
  const [bitcoinKeyCount, setBitcoinKeyCount] = useState<number | null>(null);
  const [, setLoading] = useState(false);

  const getUserCount = async () => {
    setLoading(true);
    try {
      const count: number = await invoke('get_user_count');
      setUserCount(count);
    } catch (error) {
      console.error('Failed to get user count:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBitcoinKeyCount = async () => {
    try {
      const keys = await invoke('list_bitcoin_keys', { vaultId: 'default_vault' });
      setBitcoinKeyCount(Array.isArray(keys) ? keys.length : 0);
    } catch (error) {
      console.error('Failed to get Bitcoin key count:', error);
      setBitcoinKeyCount(0);
    }
  };

  useEffect(() => {
    getUserCount();
    getBitcoinKeyCount();
  }, []);

  const stats = [
    {
      title: 'Total Users',
      value: userCount !== null ? userCount.toString() : 'Loading...',
      icon: Users,
      description: 'Registered users in the system',
      trend: '+12%',
      color: 'text-blue-600'
    },
    {
      title: 'Active Keys',
      value: bitcoinKeyCount !== null ? bitcoinKeyCount.toString() : 'Loading...',
      icon: Key,
      description: 'Cryptographic keys managed',
      trend: '+2%',
      color: 'text-green-600'
    },
    {
      title: 'Security Score',
      value: '98%',
      icon: Shield,
      description: 'Overall security rating',
      trend: '+2%',
      color: 'text-emerald-600'
    },
    {
      title: 'Storage Used',
      value: '0 MB',
      icon: Database,
      description: 'Encrypted storage utilized',
      trend: 'N/A',
      color: 'text-purple-600'
    }
  ];

  const recentActivity = [
    {
      action: 'User Login',
      user: user?.username || 'Unknown',
      time: 'Just now',
      status: 'success'
    },
    {
      action: 'Database Initialized',
      user: 'System',
      time: '1 minute ago',
      status: 'success'
    },
    {
      action: 'Security Scan',
      user: 'System',
      time: '5 minutes ago',
      status: 'success'
    }
  ];

  return (
    <div className="w-full max-w-none space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.username}! Here's your security overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
                {stat.trend !== 'N/A' && (
                  <div className="flex items-center pt-1">
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                    <span className="text-xs text-green-500">{stat.trend}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">
        {/* Recent Activity */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-foreground">
              <Activity className="h-5 w-5" />
              <span>Recent Activity</span>
            </CardTitle>
            <CardDescription>Latest security and system events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.status === 'success' ? 'bg-green-500' : 
                    activity.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">by {activity.user} • {activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-foreground">
              <Zap className="h-5 w-5" />
              <span>Quick Actions</span>
            </CardTitle>
            <CardDescription>Common security operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button className="w-full justify-start text-foreground" variant="outline">
                <Key className="mr-2 h-4 w-4" />
                Generate New Key
              </Button>
              <Button className="w-full justify-start text-foreground" variant="outline">
                <Lock className="mr-2 h-4 w-4" />
                Encrypt Data
              </Button>
              <Button className="w-full justify-start text-foreground" variant="outline">
                <Shield className="mr-2 h-4 w-4" />
                Security Scan
              </Button>
              <Button className="w-full justify-start text-foreground" variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Stats
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-foreground">
            <Database className="h-5 w-5" />
            <span>System Status</span>
          </CardTitle>
          <CardDescription>Current system health and performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Database</span>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Online</Badge>
              </div>
              <Progress value={95} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Encryption</span>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Active</Badge>
              </div>
              <Progress value={100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Backup</span>
                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Pending</Badge>
              </div>
              <Progress value={60} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Security</span>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Secure</Badge>
              </div>
              <Progress value={98} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
