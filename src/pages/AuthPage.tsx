import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { invoke } from '@tauri-apps/api/core';

export const AuthPage: React.FC = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Clear users functionality
  const [clearingUsers, setClearingUsers] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      await login(loginUsername, loginPassword);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      setLoading(false);
      return;
    }
    
    try {
      await register(username, email, password);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClearUsers = async () => {
    setClearingUsers(true);
    setMessage('');
    
    try {
      await invoke<string>('clear_all_users');
      setMessage('All users cleared! Next user to register will become admin.');
    } catch (error) {
      setMessage(`Failed to clear users: ${String(error)}`);
    } finally {
      setClearingUsers(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Shield className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">ZAP Quantum Vault</h1>
          </div>
          <p className="text-muted-foreground">Secure cryptographic key management system</p>
        </div>

        <Card className="bg-card/80 border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground text-center">Authentication</CardTitle>
            <CardDescription className="text-muted-foreground text-center">
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={isLogin ? "login" : "register"} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger 
                  value="login" 
                  onClick={() => setIsLogin(true)}
                  className=""
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="register" 
                  onClick={() => setIsLogin(false)}
                  className=""
                >
                  Register
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4 mt-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Username"
                      required
                      className=""
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Password"
                      required
                      className=""
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register" className="space-y-4 mt-6">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      required
                      className=""
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      required
                      className=""
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      className=""
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm Password"
                      required
                      className=""
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {message && (
              <Alert className="mt-6">
                <AlertDescription>
                  {message}
                </AlertDescription>
              </Alert>
            )}

            {/* Clear Users Button for Development */}
            <div className="mt-6 pt-6 border-t border-border">
              <Button 
                variant="outline" 
                onClick={handleClearUsers}
                disabled={clearingUsers}
                className="w-full border-destructive text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {clearingUsers ? 'Clearing Users...' : 'Clear All Users (Dev)'}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Development tool: Next user to register becomes admin
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
