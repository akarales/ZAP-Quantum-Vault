import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  CheckCircle,
  Plus,
  Download,
  Vote,
  Gavel
} from 'lucide-react';

interface ZAPGovernanceKey {
  id: string;
  key_role: string;
  algorithm: string;
  public_key: string;
  address: string;
  created_at: string;
  metadata: any;
}

export const ZAPBlockchainGovernancePage = () => {
  const navigate = useNavigate();
  const [governanceKeys, setGovernanceKeys] = useState<ZAPGovernanceKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [governanceCount, setGovernanceCount] = useState(7);

  useEffect(() => {
    loadGovernanceKeys();
  }, []);

  const loadGovernanceKeys = async () => {
    try {
      console.log('🚀 GOVERNANCE KEYS: Starting loadGovernanceKeys function');
      setLoading(true);
      console.log('🔍 GOVERNANCE KEYS: About to invoke list_zap_blockchain_keys with params:', {
        vaultId: "default_vault",
        keyType: 'governance',
      });
      const result = await invoke('list_zap_blockchain_keys', {
        vaultId: "default_vault",
        keyType: 'governance',
      }) as ZAPGovernanceKey[];
      console.log('✅ GOVERNANCE KEYS: Backend invoke completed successfully');
      console.log('📊 GOVERNANCE KEYS: Backend returned:', result.length, 'keys');
      setGovernanceKeys(result);
    } catch (error) {
      console.error('❌ GOVERNANCE KEYS: Error loading governance keys:', error);
      console.error('❌ GOVERNANCE KEYS: Error details:', JSON.stringify(error, null, 2));
      setError('Failed to load governance keys');
    } finally {
      console.log('🏁 GOVERNANCE KEYS: loadGovernanceKeys function completed');
      setLoading(false);
    }
  };

  const generateGovernanceKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Generate individual governance keys
      for (let i = 0; i < governanceCount; i++) {
        await invoke('generate_zap_governance_key', {
          governanceIndex: i + 1,
          networkName: 'ZAP Mainnet'
        });
      }

      setSuccess(`Successfully generated ${governanceCount} governance keys`);
      await loadGovernanceKeys();
    } catch (err) {
      console.error('Failed to generate governance keys:', err);
      setError('Failed to generate governance keys');
    } finally {
      setLoading(false);
    }
  };

  const exportGovernanceConfig = async () => {
    try {
      const config = {
        governance_keys: governanceKeys.map(key => ({
          id: key.id,
          address: key.address,
          public_key: key.public_key,
          role: key.key_role,
          algorithm: key.algorithm
        })),
        governance_config: {
          total_members: governanceKeys.length,
          voting_threshold: Math.ceil(governanceKeys.length * 0.67), // 67% supermajority
          proposal_threshold: Math.ceil(governanceKeys.length * 0.1), // 10% to propose
          quantum_safe: true
        },
        exported_at: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zap-governance-config-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess('Governance configuration exported successfully');
    } catch (err) {
      console.error('Failed to export governance config:', err);
      setError('Failed to export governance configuration');
    }
  };

  const votingThreshold = Math.ceil(governanceKeys.length * 0.67);
  const proposalThreshold = Math.ceil(governanceKeys.length * 0.1);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8 text-purple-500" />
            ZAP Blockchain Governance Keys
          </h1>
          <p className="text-muted-foreground mt-2">
            Generate and manage quantum-safe governance keys for blockchain decision-making
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="w-4 h-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Governance Process Section - Moved to Top */}
      {governanceKeys.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              Governance Process & Rules
            </CardTitle>
            <CardDescription>
              Current governance configuration and voting procedures
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">{governanceKeys.length}</div>
                <div className="text-sm text-muted-foreground">Total Members</div>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{proposalThreshold}</div>
                <div className="text-sm text-muted-foreground">Proposal Threshold</div>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{votingThreshold}</div>
                <div className="text-sm text-muted-foreground">Votes to Pass</div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Governance Rules</h4>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <div>• Proposal Threshold: {proposalThreshold} members ({Math.round((proposalThreshold / governanceKeys.length) * 100)}%)</div>
                <div>• Voting Threshold: {votingThreshold} members (67% supermajority)</div>
                <div>• Execution Delay: 48 hours after approval</div>
                <div>• Emergency Override: 80% supermajority required</div>
                <div>• Quantum-safe ML-DSA-65 signatures</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generate Governance Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Generate Governance Keys
            </CardTitle>
            <CardDescription>
              Create quantum-safe governance keys for blockchain voting and proposals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="governanceCount">Number of Governance Members</Label>
              <Input
                id="governanceCount"
                type="number"
                min="3"
                max="21"
                value={governanceCount}
                onChange={(e) => setGovernanceCount(parseInt(e.target.value) || 3)}
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Recommended: 7-15 members for effective governance
              </p>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Governance Features:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• ML-DSA-65 quantum-safe signatures</li>
                <li>• Proposal and voting capabilities</li>
                <li>• Supermajority threshold protection</li>
                <li>• Time-locked execution delays</li>
                <li>• Emergency governance procedures</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Voting Thresholds</h4>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <div>Proposal: {Math.ceil(governanceCount * 0.1)} of {governanceCount} members</div>
                <div>Approval: {Math.ceil(governanceCount * 0.67)} of {governanceCount} members (67%)</div>
              </div>
            </div>

            <Button 
              onClick={generateGovernanceKeys}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Generating...' : `Generate ${governanceCount} Governance Keys`}
            </Button>
          </CardContent>
        </Card>

        {/* Governance Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vote className="w-5 h-5" />
              Governance Overview
            </CardTitle>
            <CardDescription>
              {governanceKeys.length} governance members configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {governanceKeys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No governance keys generated yet</p>
                <p className="text-sm">Generate governance keys to enable blockchain voting</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Button 
                  onClick={exportGovernanceConfig}
                  variant="outline" 
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Governance Configuration
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Governance Keys List */}
      {governanceKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Governance Members</CardTitle>
            <CardDescription>
              List of all governance keys with voting rights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {governanceKeys.map((key, index) => (
                <Card 
                  key={key.id}
                  className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-purple-500"
                  onClick={() => navigate(`/zap-blockchain/governance/${key.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Vote className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Member #{index + 1}</h3>
                          <p className="text-sm text-muted-foreground">
                            {key.key_role || 'Governance member'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="mb-1">Governance</Badge>
                        <p className="text-xs text-muted-foreground">
                          {key.address.substring(0, 12)}...
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Governance Process Info */}
      <Card>
        <CardHeader>
          <CardTitle>Governance Process</CardTitle>
          <CardDescription>
            How blockchain governance decisions are made
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">1</div>
              <h4 className="font-medium mb-1">Proposal</h4>
              <p className="text-xs text-muted-foreground">
                {proposalThreshold}+ members submit proposal
              </p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">2</div>
              <h4 className="font-medium mb-1">Discussion</h4>
              <p className="text-xs text-muted-foreground">
                7-day community review period
              </p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">3</div>
              <h4 className="font-medium mb-1">Voting</h4>
              <p className="text-xs text-muted-foreground">
                {votingThreshold}+ votes needed to pass
              </p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">4</div>
              <h4 className="font-medium mb-1">Execution</h4>
              <p className="text-xs text-muted-foreground">
                48-hour delay then automatic execution
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
