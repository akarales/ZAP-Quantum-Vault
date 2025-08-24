import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Lock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Scan,
  Settings,
  Activity,
  Clock,
  Users,
  Key,
  Database
} from 'lucide-react';

interface SecurityEvent {
  id: string;
  type: 'login' | 'key_access' | 'system' | 'threat' | 'audit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  user?: string;
  resolved: boolean;
}

interface SecuritySetting {
  id: string;
  category: 'authentication' | 'encryption' | 'access' | 'audit';
  name: string;
  description: string;
  enabled: boolean;
  level: 'basic' | 'enhanced' | 'maximum';
}

export const SecurityCenterPage: React.FC = () => {
  const [securityScore, setSecurityScore] = useState(87);
  const [scanInProgress, setScanInProgress] = useState(false);
  const [lastScanTime, setLastScanTime] = useState('2025-08-23T17:30:00Z');

  const [securityEvents] = useState<SecurityEvent[]>([
    {
      id: '1',
      type: 'login',
      severity: 'low',
      message: 'Successful login from anubix',
      timestamp: '2025-08-23T18:10:00Z',
      user: 'anubix',
      resolved: true
    },
    {
      id: '2',
      type: 'system',
      severity: 'medium',
      message: 'Database backup completed successfully',
      timestamp: '2025-08-23T17:45:00Z',
      resolved: true
    },
    {
      id: '3',
      type: 'key_access',
      severity: 'low',
      message: 'RSA key accessed for encryption operation',
      timestamp: '2025-08-23T17:30:00Z',
      user: 'anubix',
      resolved: true
    },
    {
      id: '4',
      type: 'audit',
      severity: 'high',
      message: 'Multiple failed login attempts detected',
      timestamp: '2025-08-23T16:15:00Z',
      resolved: false
    }
  ]);

  const [securitySettings, setSecuritySettings] = useState<SecuritySetting[]>([
    {
      id: '1',
      category: 'authentication',
      name: 'Multi-Factor Authentication',
      description: 'Require additional verification for login',
      enabled: false,
      level: 'enhanced'
    },
    {
      id: '2',
      category: 'authentication',
      name: 'Session Timeout',
      description: 'Automatically logout after inactivity',
      enabled: true,
      level: 'basic'
    },
    {
      id: '3',
      category: 'encryption',
      name: 'Quantum-Safe Algorithms',
      description: 'Use post-quantum cryptographic algorithms',
      enabled: true,
      level: 'maximum'
    },
    {
      id: '4',
      category: 'encryption',
      name: 'Database Encryption',
      description: 'Encrypt sensitive data at rest',
      enabled: true,
      level: 'enhanced'
    },
    {
      id: '5',
      category: 'access',
      name: 'Role-Based Access Control',
      description: 'Restrict access based on user roles',
      enabled: false,
      level: 'enhanced'
    },
    {
      id: '6',
      category: 'audit',
      name: 'Comprehensive Logging',
      description: 'Log all security-related events',
      enabled: true,
      level: 'maximum'
    }
  ]);

  const handleSecurityScan = async () => {
    setScanInProgress(true);
    // Simulate security scan
    setTimeout(() => {
      setSecurityScore(Math.floor(Math.random() * 10) + 85);
      setLastScanTime(new Date().toISOString());
      setScanInProgress(false);
    }, 3000);
  };

  const toggleSetting = (settingId: string) => {
    setSecuritySettings(prev => 
      prev.map(setting => 
        setting.id === settingId 
          ? { ...setting, enabled: !setting.enabled }
          : setting
      )
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'login': return <Users className="h-4 w-4" />;
      case 'key_access': return <Key className="h-4 w-4" />;
      case 'system': return <Settings className="h-4 w-4" />;
      case 'threat': return <AlertTriangle className="h-4 w-4" />;
      case 'audit': return <Activity className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'authentication': return <Lock className="h-4 w-4" />;
      case 'encryption': return <Shield className="h-4 w-4" />;
      case 'access': return <Users className="h-4 w-4" />;
      case 'audit': return <Activity className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const securityMetrics = [
    {
      title: 'Security Score',
      value: `${securityScore}%`,
      icon: Shield,
      description: 'Overall security rating',
      color: securityScore >= 90 ? 'text-green-600' : securityScore >= 70 ? 'text-yellow-600' : 'text-red-600'
    },
    {
      title: 'Active Threats',
      value: securityEvents.filter(e => !e.resolved && (e.severity === 'high' || e.severity === 'critical')).length,
      icon: AlertTriangle,
      description: 'Unresolved security issues',
      color: 'text-red-600'
    },
    {
      title: 'Protected Assets',
      value: '12',
      icon: Database,
      description: 'Encrypted data stores',
      color: 'text-blue-600'
    },
    {
      title: 'Access Controls',
      value: securitySettings.filter(s => s.enabled).length,
      icon: Lock,
      description: 'Active security policies',
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Security Center</h1>
        <p className="text-muted-foreground">
          Monitor and control your security settings and system status
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <Button 
          onClick={handleSecurityScan}
          disabled={scanInProgress}
          className="flex items-center space-x-2"
        >
          <Scan className={`h-4 w-4 ${scanInProgress ? 'animate-spin' : ''}`} />
          <span>{scanInProgress ? 'Scanning...' : 'Security Scan'}</span>
        </Button>
      </div>

      {/* Security Metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {securityMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <p className="text-xs text-muted-foreground">{metric.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Security Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Security Assessment</span>
          </CardTitle>
          <CardDescription>
            Current security posture and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Security Score</span>
              <span className="text-2xl font-bold">{securityScore}%</span>
            </div>
            <Progress value={securityScore} className="w-full" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Last scan: {new Date(lastScanTime).toLocaleString()}</span>
              <span className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>Next scan in 6 hours</span>
              </span>
            </div>
            
            {securityScore < 90 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Security score below optimal. Consider enabling additional security features.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Security Events</TabsTrigger>
          <TabsTrigger value="settings">Security Settings</TabsTrigger>
          <TabsTrigger value="policies">Access Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Recent Security Events</span>
              </CardTitle>
              <CardDescription>
                Monitor security-related activities and threats
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {securityEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {getEventIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{event.message}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge className={getSeverityColor(event.severity)}>
                            {event.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                          {event.user && (
                            <span className="text-xs text-muted-foreground">
                              by {event.user}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {event.resolved ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Security Configuration</span>
              </CardTitle>
              <CardDescription>
                Configure security policies and features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {['authentication', 'encryption', 'access', 'audit'].map((category) => (
                  <div key={category} className="space-y-3">
                    <h3 className="text-lg font-medium capitalize flex items-center space-x-2">
                      {getCategoryIcon(category)}
                      <span>{category}</span>
                    </h3>
                    <div className="space-y-3 pl-6">
                      {securitySettings
                        .filter(setting => setting.category === category)
                        .map((setting) => (
                          <div key={setting.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <Label htmlFor={setting.id} className="text-sm font-medium">
                                  {setting.name}
                                </Label>
                                <Badge variant="outline" className="text-xs">
                                  {setting.level}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {setting.description}
                              </p>
                            </div>
                            <Switch
                              id={setting.id}
                              checked={setting.enabled}
                              onCheckedChange={() => toggleSetting(setting.id)}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="h-5 w-5" />
                <span>Access Control Policies</span>
              </CardTitle>
              <CardDescription>
                Manage user permissions and access rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Access control policies will be available when multi-user support is enabled.
                  </AlertDescription>
                </Alert>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Users className="h-4 w-4" />
                      <span className="font-medium">User Roles</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Define roles and permissions for different user types
                    </p>
                  </Card>
                  
                  <Card className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Key className="h-4 w-4" />
                      <span className="font-medium">Key Access Rules</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Control which users can access specific cryptographic keys
                    </p>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
