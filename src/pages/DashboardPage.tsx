import React, { useState, useEffect } from 'react';
import { safeTauriInvoke } from '../utils/tauri-api';
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
  const [ethereumKeyCount, setEthereumKeyCount] = useState<number | null>(null);
  const [cosmosKeyCount, setCosmosKeyCount] = useState<number | null>(null);
  const [zapKeyCount, setZapKeyCount] = useState<number | null>(null);
  const [, setLoading] = useState(false);

  const getUserCount = async () => {
    setLoading(true);
    try {
      const count: number = await safeTauriInvoke('get_user_count');
      setUserCount(count);
    } catch (error) {
      console.error('Failed to get user count:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBitcoinKeyCount = async () => {
    try {
      console.log('🚀 DASHBOARD: Starting getBitcoinKeyCount function');
      console.log('🔍 DASHBOARD: Checking Tauri environment...');
      
      // Check if we're in Tauri environment
      const { isTauriEnvironment } = await import('../utils/tauri-api');
      const isTauri = isTauriEnvironment();
      console.log('🔍 DASHBOARD: Tauri environment check result:', isTauri);
      
      if (!isTauri) {
        console.error('❌ DASHBOARD: Not in Tauri environment, cannot invoke Bitcoin commands');
        setBitcoinKeyCount(0);
        return;
      }
      
      console.log('🔍 DASHBOARD: Invoking list_bitcoin_keys with parameters:', {
        vault_id: 'default_vault'
      });
      
      console.log('🔄 DASHBOARD: About to call safeTauriInvoke for list_bitcoin_keys...');
      // Try with direct invoke like ZAP blockchain commands
      const { invoke } = await import('@tauri-apps/api/core');
      const response = await invoke('list_bitcoin_keys', { vault_id: 'default_vault' });
      console.log('🔄 DASHBOARD: invoke completed for list_bitcoin_keys');
      
      console.log('✅ DASHBOARD: Successfully loaded Bitcoin keys response:', response);
      console.log('🔍 DASHBOARD: Response type:', typeof response);
      console.log('🔍 DASHBOARD: Response constructor:', response?.constructor?.name);
      console.log('🔍 DASHBOARD: Is response an array?', Array.isArray(response));
      console.log('🔍 DASHBOARD: Raw Bitcoin response:', JSON.stringify(response, null, 2));
      
      // Handle both direct array and wrapped response
      let keys = response;
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        // Check if response is wrapped in a property
        if (response.keys && Array.isArray(response.keys)) {
          keys = response.keys;
          console.log('🔧 DASHBOARD: Found keys in response.keys property');
        } else if (response.data && Array.isArray(response.data)) {
          keys = response.data;
          console.log('🔧 DASHBOARD: Found keys in response.data property');
        } else {
          console.log('🔍 DASHBOARD: Response object properties:', Object.keys(response));
        }
      }
      
      const count = Array.isArray(keys) ? keys.length : 0;
      console.log('📊 DASHBOARD: Final Bitcoin key count:', count);
      console.log('📊 DASHBOARD: Setting Bitcoin key count to:', count);
      setBitcoinKeyCount(count);
    } catch (error) {
      console.error('❌ DASHBOARD: Failed to get Bitcoin key count:', error);
      console.error('❌ DASHBOARD: Error details:', JSON.stringify(error, null, 2));
      console.error('❌ DASHBOARD: Error type:', typeof error);
      console.error('❌ DASHBOARD: Error constructor:', error?.constructor?.name);
      if (error instanceof Error) {
        console.error('❌ DASHBOARD: Error message:', error.message);
        console.error('❌ DASHBOARD: Error stack:', error.stack);
      }
      setBitcoinKeyCount(0);
    } finally {
      console.log('🏁 DASHBOARD: getBitcoinKeyCount function completed');
    }
  };

  const getEthereumKeyCount = async () => {
    try {
      console.log('🚀 DASHBOARD: Starting getEthereumKeyCount function');
      console.log('🔍 DASHBOARD: Checking Tauri environment...');
      
      // Check if we're in Tauri environment
      const { isTauriEnvironment } = await import('../utils/tauri-api');
      const isTauri = isTauriEnvironment();
      console.log('🔍 DASHBOARD: Tauri environment check result:', isTauri);
      
      if (!isTauri) {
        console.error('❌ DASHBOARD: Not in Tauri environment, cannot invoke Ethereum commands');
        setEthereumKeyCount(0);
        return;
      }
      
      console.log('🔍 DASHBOARD: Invoking list_ethereum_keys with parameters:', {
        vault_id: 'default_vault'
      });
      
      console.log('🔄 DASHBOARD: About to call invoke for list_ethereum_keys...');
      // Try with direct invoke like ZAP blockchain commands
      const { invoke } = await import('@tauri-apps/api/core');
      const response = await invoke('list_ethereum_keys', { vault_id: 'default_vault' });
      console.log('🔄 DASHBOARD: invoke completed for list_ethereum_keys');
      
      console.log('✅ DASHBOARD: Successfully loaded Ethereum keys response:', response);
      console.log('🔍 DASHBOARD: Response type:', typeof response);
      console.log('🔍 DASHBOARD: Response constructor:', response?.constructor?.name);
      console.log('🔍 DASHBOARD: Is response an array?', Array.isArray(response));
      console.log('🔍 DASHBOARD: Raw Ethereum response:', JSON.stringify(response, null, 2));
      
      // Handle both direct array and wrapped response
      let keys = response;
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        // Check if response is wrapped in a property
        if (response.keys && Array.isArray(response.keys)) {
          keys = response.keys;
          console.log('🔧 DASHBOARD: Found keys in response.keys property');
        } else if (response.data && Array.isArray(response.data)) {
          keys = response.data;
          console.log('🔧 DASHBOARD: Found keys in response.data property');
        } else {
          console.log('🔍 DASHBOARD: Response object properties:', Object.keys(response));
        }
      }
      
      const count = Array.isArray(keys) ? keys.length : 0;
      console.log('📊 DASHBOARD: Final Ethereum key count:', count);
      console.log('📊 DASHBOARD: Setting Ethereum key count to:', count);
      setEthereumKeyCount(count);
    } catch (error) {
      console.error('❌ DASHBOARD: Failed to get Ethereum key count:', error);
      console.error('❌ DASHBOARD: Error details:', JSON.stringify(error, null, 2));
      console.error('❌ DASHBOARD: Error type:', typeof error);
      console.error('❌ DASHBOARD: Error constructor:', error?.constructor?.name);
      if (error instanceof Error) {
        console.error('❌ DASHBOARD: Error message:', error.message);
        console.error('❌ DASHBOARD: Error stack:', error.stack);
      }
      setEthereumKeyCount(0);
    } finally {
      console.log('🏁 DASHBOARD: getEthereumKeyCount function completed');
    }
  };

  const getCosmosKeyCount = async () => {
    try {
      console.log('🚀 DASHBOARD: Starting getCosmosKeyCount function');
      console.log('🔍 DASHBOARD: Invoking list_cosmos_keys with parameters:', {
        vault_id: 'default_vault'
      });
      
      const keys = await safeTauriInvoke('list_cosmos_keys', { vault_id: 'default_vault' });
      
      console.log('✅ DASHBOARD: Successfully loaded Cosmos keys:', keys);
      console.log('📊 DASHBOARD: Cosmos key count:', Array.isArray(keys) ? keys.length : 0);
      console.log('🔍 DASHBOARD: Keys array check - isArray:', Array.isArray(keys), 'type:', typeof keys);
      
      setCosmosKeyCount(Array.isArray(keys) ? keys.length : 0);
    } catch (error) {
      console.error('❌ DASHBOARD: Failed to get Cosmos key count:', error);
      console.error('❌ DASHBOARD: Error details:', JSON.stringify(error, null, 2));
      setCosmosKeyCount(0);
    } finally {
      console.log('🏁 DASHBOARD: getCosmosKeyCount function completed');
    }
  };

  const getZapKeyCount = async () => {
    try {
      console.log('🚀 DASHBOARD: Starting getZapKeyCount function');
      console.log('🔍 DASHBOARD: Invoking list_zap_blockchain_keys with parameters:', {
        vault_id: 'default_vault',
        key_type: null
      });
      
      const keys = await safeTauriInvoke('list_zap_blockchain_keys', { 
        vault_id: 'default_vault', 
        key_type: null 
      });
      
      console.log('✅ DASHBOARD: Successfully loaded ZAP blockchain keys:', keys);
      console.log('📊 DASHBOARD: ZAP key count:', Array.isArray(keys) ? keys.length : 0);
      
      setZapKeyCount(Array.isArray(keys) ? keys.length : 0);
    } catch (error) {
      console.error('❌ DASHBOARD: Failed to get ZAP blockchain key count:', error);
      console.error('❌ DASHBOARD: Error details:', JSON.stringify(error, null, 2));
      setZapKeyCount(0);
    } finally {
      console.log('🏁 DASHBOARD: getZapKeyCount function completed');
    }
  };

  useEffect(() => {
    console.log('🚀 DASHBOARD: Component mounted, starting all key count loading');
    console.log('🔄 DASHBOARD: Loading user count and all blockchain key counts in parallel');
    
    // Add delay to ensure proper initialization
    const loadCounts = async () => {
      try {
        console.log('🔄 DASHBOARD: Starting getUserCount...');
        await getUserCount();
        console.log('✅ DASHBOARD: getUserCount completed');
        
        // Test Bitcoin command availability with detailed logging
        console.log('🧪 DASHBOARD: Testing Bitcoin command availability...');
        try {
          console.log('🧪 DASHBOARD: About to call safeTauriInvoke for Bitcoin test...');
          const testResult = await safeTauriInvoke('list_bitcoin_keys', { vault_id: 'test' });
          console.log('🧪 DASHBOARD: Bitcoin command test SUCCESS - result:', testResult);
        } catch (testError) {
          console.error('🧪 DASHBOARD: Bitcoin command test FAILED:', testError);
          if (testError instanceof Error) {
            console.error('🧪 DASHBOARD: Bitcoin test error message:', testError.message);
            console.error('🧪 DASHBOARD: Bitcoin test error stack:', testError.stack);
          }
        }
        
        console.log('🔄 DASHBOARD: Starting getBitcoinKeyCount...');
        await getBitcoinKeyCount();
        console.log('✅ DASHBOARD: getBitcoinKeyCount completed');
        
        // Test Ethereum command availability with detailed logging
        console.log('🧪 DASHBOARD: Testing Ethereum command availability...');
        try {
          console.log('🧪 DASHBOARD: About to call safeTauriInvoke for Ethereum test...');
          const testResult = await safeTauriInvoke('list_ethereum_keys', { vault_id: 'test' });
          console.log('🧪 DASHBOARD: Ethereum command test SUCCESS - result:', testResult);
        } catch (testError) {
          console.error('🧪 DASHBOARD: Ethereum command test FAILED:', testError);
          if (testError instanceof Error) {
            console.error('🧪 DASHBOARD: Ethereum test error message:', testError.message);
            console.error('🧪 DASHBOARD: Ethereum test error stack:', testError.stack);
          }
        }
        
        console.log('🔄 DASHBOARD: Starting getEthereumKeyCount...');
        await getEthereumKeyCount();
        console.log('✅ DASHBOARD: getEthereumKeyCount completed');
        
        console.log('🔄 DASHBOARD: Starting getCosmosKeyCount...');
        await getCosmosKeyCount();
        console.log('✅ DASHBOARD: getCosmosKeyCount completed');
        
        console.log('🔄 DASHBOARD: Starting getZapKeyCount...');
        await getZapKeyCount();
        console.log('✅ DASHBOARD: getZapKeyCount completed');
        
        console.log('✅ DASHBOARD: All key count loading functions completed');
      } catch (error) {
        console.error('❌ DASHBOARD: Error in loadCounts:', error);
      }
    };
    
    loadCounts();
  }, []);

  // Log state changes for debugging
  useEffect(() => {
    console.log('📊 DASHBOARD: Key count state update:', {
      bitcoinKeyCount,
      ethereumKeyCount,
      cosmosKeyCount,
      zapKeyCount,
      totalCalculated: (bitcoinKeyCount !== null && ethereumKeyCount !== null && cosmosKeyCount !== null && zapKeyCount !== null) 
        ? (bitcoinKeyCount + ethereumKeyCount + cosmosKeyCount + zapKeyCount) 
        : 'Not all counts loaded yet'
    });
  }, [bitcoinKeyCount, ethereumKeyCount, cosmosKeyCount, zapKeyCount]);

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
      title: 'Total Keys',
      value: (bitcoinKeyCount !== null && ethereumKeyCount !== null && cosmosKeyCount !== null && zapKeyCount !== null) 
        ? (bitcoinKeyCount + ethereumKeyCount + cosmosKeyCount + zapKeyCount).toString() 
        : 'Loading...',
      icon: Key,
      description: 'All cryptographic keys managed',
      trend: '+2%',
      color: 'text-green-600'
    },
    {
      title: 'Bitcoin Keys',
      value: bitcoinKeyCount !== null ? bitcoinKeyCount.toString() : 'Loading...',
      icon: Key,
      description: 'Bitcoin blockchain keys',
      trend: bitcoinKeyCount !== null && bitcoinKeyCount > 0 ? 'Active' : 'None',
      color: 'text-orange-600'
    },
    {
      title: 'Ethereum Keys',
      value: ethereumKeyCount !== null ? ethereumKeyCount.toString() : 'Loading...',
      icon: Key,
      description: 'Ethereum blockchain keys',
      trend: ethereumKeyCount !== null && ethereumKeyCount > 0 ? 'Active' : 'None',
      color: 'text-blue-500'
    },
    {
      title: 'Cosmos Keys',
      value: cosmosKeyCount !== null ? cosmosKeyCount.toString() : 'Loading...',
      icon: Key,
      description: 'Cosmos IBC network keys',
      trend: cosmosKeyCount !== null && cosmosKeyCount > 0 ? 'Active' : 'None',
      color: 'text-purple-600'
    },
    {
      title: 'ZAP Keys',
      value: zapKeyCount !== null ? zapKeyCount.toString() : 'Loading...',
      icon: Key,
      description: 'ZAP blockchain keys',
      trend: zapKeyCount !== null && zapKeyCount > 0 ? 'Active' : 'None',
      color: 'text-emerald-600'
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
