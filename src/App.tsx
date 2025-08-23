import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Users, Database, LogOut } from "lucide-react";

interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    is_active: boolean;
    mfa_enabled: boolean;
    created_at: string;
    updated_at: string;
  };
  token: string;
}

function App() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [userCount, setUserCount] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<AuthResponse | null>(null);
  const [isLogin, setIsLogin] = useState(false);

  async function register() {
    try {
      if (password !== confirmPassword) {
        setMessage("Passwords do not match");
        return;
      }

      const response: AuthResponse = await invoke("register_user", {
        request: { username, email, password }
      });
      
      setCurrentUser(response);
      setMessage(`Registration successful! Welcome ${response.user.username}`);
      await getUserCount();
    } catch (error) {
      setMessage(`Registration failed: ${error}`);
    }
  }

  async function login() {
    try {
      const response: AuthResponse = await invoke("login_user", {
        request: { username: loginUsername, password: loginPassword }
      });
      
      setCurrentUser(response);
      setMessage(`Login successful! Welcome back ${response.user.username}`);
    } catch (error) {
      setMessage(`Login failed: ${error}`);
    }
  }

  async function getUserCount() {
    try {
      const count: number = await invoke("get_user_count");
      setUserCount(count);
    } catch (error) {
      setMessage(`Failed to get user count: ${error}`);
    }
  }

  async function clearAllUsers() {
    try {
      const result: string = await invoke("clear_all_users");
      setMessage(result);
      setCurrentUser(null);
      await getUserCount();
    } catch (error) {
      setMessage(`Failed to clear users: ${error}`);
    }
  }

  // Load user count on component mount
  useEffect(() => {
    getUserCount();
  }, []);

  if (currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-blue-400" />
              <h1 className="text-3xl font-bold text-white">ZAP Quantum Vault</h1>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setCurrentUser(null)}
              className="text-white border-white hover:bg-white hover:text-slate-900"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>

          <Card className="mb-6 bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Welcome, {currentUser.user.username}!</span>
              </CardTitle>
              <CardDescription className="text-slate-300">
                Account Information
              </CardDescription>
            </CardHeader>
            <CardContent className="text-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p><strong>Email:</strong> {currentUser.user.email}</p>
                  <p><strong>User ID:</strong> {currentUser.user.id}</p>
                </div>
                <div>
                  <p><strong>Account created:</strong> {new Date(currentUser.user.created_at).toLocaleString()}</p>
                  <Badge variant="secondary" className="mt-2">
                    {currentUser.user.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Database Administration</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-200">
                  Users in database: <Badge variant="outline">{userCount !== null ? userCount : 'Loading...'}</Badge>
                </span>
              </div>
              <div className="flex space-x-3">
                <Button 
                  variant="destructive" 
                  onClick={clearAllUsers}
                >
                  Clear All Users
                </Button>
                <Button 
                  variant="outline" 
                  onClick={getUserCount}
                  className="text-white border-slate-600 hover:bg-slate-700"
                >
                  Refresh Count
                </Button>
              </div>
            </CardContent>
          </Card>

          {message && (
            <Alert className="mt-6 bg-blue-900/50 border-blue-700">
              <AlertDescription className="text-blue-200">
                {message}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Shield className="h-10 w-10 text-blue-400" />
            <h1 className="text-4xl font-bold text-white">ZAP Quantum Vault</h1>
          </div>
          <p className="text-slate-300">Secure cryptographic key management system</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-center">Authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={isLogin ? "login" : "register"} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-700">
                <TabsTrigger 
                  value="register" 
                  onClick={() => setIsLogin(false)}
                  className="text-slate-200 data-[state=active]:bg-slate-600 data-[state=active]:text-white"
                >
                  Register
                </TabsTrigger>
                <TabsTrigger 
                  value="login" 
                  onClick={() => setIsLogin(true)}
                  className="text-slate-200 data-[state=active]:bg-slate-600 data-[state=active]:text-white"
                >
                  Login
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="register" className="space-y-4 mt-6">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    register();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      required
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      required
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm Password"
                      required
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                    Create Account
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="login" className="space-y-4 mt-6">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    login();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Username"
                      required
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Password"
                      required
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                    Sign In
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Separator className="my-6 bg-slate-600" />

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Database Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-200">
                Users in database: <Badge variant="outline">{userCount !== null ? userCount : 'Loading...'}</Badge>
              </span>
            </div>
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={getUserCount}
                className="text-white border-slate-600 hover:bg-slate-700"
              >
                Refresh Count
              </Button>
              <Button 
                variant="destructive" 
                onClick={clearAllUsers}
              >
                Clear All Users
              </Button>
            </div>
          </CardContent>
        </Card>

        {message && (
          <Alert className="mt-6 bg-blue-900/50 border-blue-700">
            <AlertDescription className="text-blue-200">
              {message}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

export default App;
