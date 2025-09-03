import React, { useState, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Copy, Shield, Zap, Lock, Eye, EyeOff, RefreshCw, Settings } from 'lucide-react';

interface FormatSectionProps {
  drive: any;
  formatOptions: any;
  setFormatOptions: (options: any) => void;
  onFormatDrive: () => void;
  operationInProgress: boolean;
  formatProgress?: {
    isActive: boolean;
    progress: number;
    message: string;
  };
}

// Helper function to determine if drive is encrypted
const isEncryptedDrive = (drive: any): boolean => {
  return (
    drive?.filesystem === 'LUKS Encrypted' ||
    drive?.filesystem === 'crypto_LUKS' ||
    drive?.device_path?.includes('/dev/mapper/')
  );
};

export const FormatSection: React.FC<FormatSectionProps> = ({
  drive,
  formatOptions,
  setFormatOptions,
  onFormatDrive,
  operationInProgress,
  formatProgress
}) => {
  console.log('[FormatSection] Component rendered with drive:', drive?.id, 'filesystem:', drive?.filesystem);
  
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showGeneratedPassword, setShowGeneratedPassword] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  
  // Password generation options
  const [passwordOptions, setPasswordOptions] = useState({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: false,
    quantumEntropy: false
  });
  
  const driveIsEncrypted = isEncryptedDrive(drive);

  const getCharacterSets = useCallback(() => {
    const sets = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      similarChars: 'il1Lo0O'
    };

    let charset = '';
    if (passwordOptions.includeUppercase) charset += sets.uppercase;
    if (passwordOptions.includeLowercase) charset += sets.lowercase;
    if (passwordOptions.includeNumbers) charset += sets.numbers;
    if (passwordOptions.includeSymbols) charset += sets.symbols;

    if (passwordOptions.excludeSimilar) {
      charset = charset.split('').filter(char => !sets.similarChars.includes(char)).join('');
    }

    return charset;
  }, [
    passwordOptions.includeUppercase,
    passwordOptions.includeLowercase,
    passwordOptions.includeNumbers,
    passwordOptions.includeSymbols,
    passwordOptions.excludeSimilar
  ]);

  const generateSecureRandom = useCallback(async (length: number): Promise<Uint8Array> => {
    if (passwordOptions.quantumEntropy && window.crypto && window.crypto.getRandomValues) {
      const array1 = new Uint8Array(length);
      const array2 = new Uint8Array(length);
      const array3 = new Uint8Array(length);
      
      window.crypto.getRandomValues(array1);
      window.crypto.getRandomValues(array2);
      window.crypto.getRandomValues(array3);
      
      const result = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        result[i] = array1[i] ^ array2[i] ^ array3[i];
      }
      return result;
    } else {
      const array = new Uint8Array(length);
      window.crypto.getRandomValues(array);
      return array;
    }
  }, [passwordOptions.quantumEntropy]);

  const generatePassword = useCallback(async () => {
    setGenerating(true);
    
    try {
      const charset = getCharacterSets();
      if (!charset) {
        throw new Error('No character sets selected');
      }

      // Reduced delay for better performance
      await new Promise(resolve => setTimeout(resolve, passwordOptions.quantumEntropy ? 200 : 50));
      
      const randomBytes = await generateSecureRandom(passwordOptions.length * 2);
      let password = '';
      
      for (let i = 0; i < passwordOptions.length; i++) {
        const randomIndex = randomBytes[i] % charset.length;
        password += charset[randomIndex];
      }

      const requiredChars = [];
      if (passwordOptions.includeUppercase) requiredChars.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]);
      if (passwordOptions.includeLowercase) requiredChars.push('abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]);
      if (passwordOptions.includeNumbers) requiredChars.push('0123456789'[Math.floor(Math.random() * 10)]);
      if (passwordOptions.includeSymbols) requiredChars.push('!@#$%^&*'[Math.floor(Math.random() * 8)]);

      const passwordArray = password.split('');
      requiredChars.forEach((char, index) => {
        if (index < passwordArray.length) {
          passwordArray[index] = char;
        }
      });

      for (let i = passwordArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
      }

      const finalPassword = passwordArray.join('');
      setGeneratedPassword(finalPassword);
      
      // Update format options with generated password
      setFormatOptions((prev: typeof formatOptions) => ({ 
        ...prev, 
        password: finalPassword, 
        confirm_password: finalPassword 
      }));
      
      // Save password to database (non-blocking)
      invoke('save_usb_drive_password', {
        user_id: 'admin',
        request: {
          drive_id: drive.id,
          device_path: drive.device_path,
          drive_label: drive.label,
          password: finalPassword,
          password_hint: 'Generated password'
        }
      }).catch((error: any) => {
        console.error('Failed to save password to database:', error);
      });
    } catch (error) {
      console.error('Password generation failed:', error);
    } finally {
      setGenerating(false);
    }
  }, [passwordOptions.length, passwordOptions.quantumEntropy, passwordOptions.includeUppercase, passwordOptions.includeLowercase, passwordOptions.includeNumbers, passwordOptions.includeSymbols, getCharacterSets, generateSecureRandom, setFormatOptions, drive]);

  const copyToClipboard = async () => {
    if (!generatedPassword) return;
    
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopyFeedback('Password copied!');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (error) {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const passwordStrength = useMemo(() => {
    if (!generatedPassword) return { entropy: 0, strength: 'Very Weak', color: 'text-red-500' };

    const charset = getCharacterSets();
    const entropy = Math.log2(Math.pow(charset.length, generatedPassword.length));
    
    let strength = 'Very Weak';
    let color = 'text-red-500';
    
    if (entropy >= 128) {
      strength = passwordOptions.quantumEntropy ? 'Quantum-Safe' : 'Very Strong';
      color = passwordOptions.quantumEntropy ? 'text-purple-500' : 'text-green-500';
    } else if (entropy >= 80) {
      strength = 'Strong';
      color = 'text-blue-500';
    } else if (entropy >= 60) {
      strength = 'Moderate';
      color = 'text-yellow-500';
    } else if (entropy >= 40) {
      strength = 'Weak';
      color = 'text-orange-500';
    }

    return { entropy: Math.round(entropy), strength, color };
  }, [generatedPassword, getCharacterSets, passwordOptions.quantumEntropy]);


  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="w-4 h-4" />
          Format & Encryption
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Compact Drive Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1">Drive Name</Label>
            <Input
              placeholder="ZAP Quantum Vault"
              value={formatOptions.driveName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormatOptions((prev: any) => ({ ...prev, drive_name: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1">Filesystem</Label>
            <Select 
              value={formatOptions.filesystem} 
              onValueChange={(value: string) => setFormatOptions((prev: any) => ({ ...prev, filesystem: value }))}
            >
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue placeholder="Select filesystem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ext4">ext4 (Recommended)</SelectItem>
                <SelectItem value="ntfs">NTFS (Windows Compatible)</SelectItem>
                <SelectItem value="exfat">exFAT (Cross-Platform)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="encryption-type" className="text-xs font-medium">Encryption Type</Label>
          <Select
            value={formatOptions.encryption_type}
            onValueChange={(value: string) => {setFormatOptions({ ...formatOptions, encryption_type: value })}}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="basic_luks2">Basic LUKS2 (Available)</SelectItem>
              <SelectItem value="quantum_luks2" disabled>Quantum LUKS2 (Coming Soon)</SelectItem>
              <SelectItem value="post_quantum_aes" disabled>Post-Quantum AES-256 (Coming Soon)</SelectItem>
              <SelectItem value="hybrid_classical_quantum" disabled>Hybrid Classical+Quantum (Coming Soon)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Password Section with Always-Visible Generator */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">
            {driveIsEncrypted ? 'New Re-encryption Password' : 'New Encryption Password'}
          </h4>
          
          {/* Always-Visible Password Generator */}
          <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Password Generator</span>
              {passwordOptions.quantumEntropy && (
                <Badge variant="secondary" className="text-xs">
                  <Zap className="w-3 h-3 mr-1" />
                  Quantum
                </Badge>
              )}
            </div>
            
            {/* Generator Options */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Length: {passwordOptions.length}</Label>
                <Slider
                  value={[passwordOptions.length]}
                  onValueChange={(value: number[]) => setPasswordOptions(prev => ({ ...prev, length: value[0] }))}
                  min={8}
                  max={64}
                  step={1}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="uppercase"
                    checked={passwordOptions.includeUppercase}
                    onCheckedChange={(checked: boolean) => setPasswordOptions(prev => ({ ...prev, includeUppercase: !!checked }))}
                  />
                  <Label htmlFor="filesystem" className="text-xs font-medium">Filesystem</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="lowercase"
                    checked={passwordOptions.includeLowercase}
                    onCheckedChange={(checked: boolean) => setPasswordOptions(prev => ({ ...prev, includeLowercase: !!checked }))}
                  />
                  <Label htmlFor="drive-name" className="text-xs font-medium">Drive Name</Label>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="numbers"
                    checked={passwordOptions.includeNumbers}
                    onCheckedChange={(checked: boolean) => setPasswordOptions(prev => ({ ...prev, includeNumbers: !!checked }))}
                  />
                  <Label htmlFor="numbers" className="text-xs">0-9</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="symbols"
                    checked={passwordOptions.includeSymbols}
                    onCheckedChange={(checked: boolean) => setPasswordOptions(prev => ({ ...prev, includeSymbols: !!checked }))}
                  />
                  <Label htmlFor="symbols" className="text-xs">!@#$</Label>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="excludeSimilar"
                    checked={passwordOptions.excludeSimilar}
                    onCheckedChange={(checked: boolean) => setPasswordOptions(prev => ({ ...prev, excludeSimilar: !!checked }))}
                  />
                  <Label htmlFor="excludeSimilar" className="text-xs">No Similar</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="quantumEntropy"
                    checked={passwordOptions.quantumEntropy}
                    onCheckedChange={(checked: boolean) => setPasswordOptions(prev => ({ ...prev, quantumEntropy: !!checked }))}
                  />
                  <Label htmlFor="quantumEntropy" className="text-xs">Quantum</Label>
                </div>
              </div>
            </div>
            
            {/* Generate Button and Generated Password Display */}
            <div className="space-y-2">
              <Button
                onClick={generatePassword}
                disabled={generating}
                className="w-full h-8 text-xs"
                variant="default"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2" />
                    Generate Password
                  </>
                )}
              </Button>
              
              {generatedPassword && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showGeneratedPassword ? "text" : "password"}
                        value={generatedPassword}
                        readOnly
                        className="h-8 text-xs font-mono pr-16"
                      />
                      <div className="absolute right-1 top-0 h-8 flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setShowGeneratedPassword(!showGeneratedPassword)}
                        >
                          {showGeneratedPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={copyToClipboard}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {copyFeedback && (
                    <div className="text-xs text-green-600 font-medium">
                      {copyFeedback}
                    </div>
                  )}
                  
                  {/* Password Strength Indicator */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Strength:</span>
                      <Badge variant="secondary" className={`text-xs ${passwordStrength.color} text-white`}>
                        {passwordStrength.strength}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {passwordStrength.entropy} bits entropy
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1">New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={formatOptions.password || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormatOptions((prev: any) => ({ ...prev, password: e.target.value }))}
                  className="h-8 text-sm pr-8"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-8 w-8 p-0"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1">Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={formatOptions.confirm_password || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormatOptions((prev: any) => ({ ...prev, confirm_password: e.target.value }))}
                  className="h-8 text-sm pr-8"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-8 w-8 p-0"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
        </div>

          {/* Compact Protection Level */}
        <div className="bg-blue-50/50 border border-blue-200 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-blue-600" />
            <h5 className="text-sm font-medium text-blue-900">Protection Level</h5>
          </div>
          <p className="text-xs text-blue-700 mb-2">
            {formatOptions.encryption_type === 'basic_luks2'
              ? "Basic LUKS2: AES-256 encryption with industry-standard security"
              : formatOptions.quantum_entropy && formatOptions.zero_knowledge_proof
              ? "Maximum Quantum Resistance: Protected against quantum computer attacks"
              : formatOptions.quantum_entropy || formatOptions.zero_knowledge_proof
              ? "High Quantum Resistance: Strong protection with quantum features"
              : "Basic Protection: Consider enabling quantum features for future-proofing"
            }
          </p>
          <div className="flex flex-wrap gap-1 text-xs text-blue-600">
            {formatOptions.encryption_type === 'basic_luks2' && (
              <>
                <Badge variant="outline" className="text-xs px-1 py-0">Industry Standard</Badge>
                <Badge variant="outline" className="text-xs px-1 py-0">Cross-Platform</Badge>
                <Badge variant="outline" className="text-xs px-1 py-0">High Performance</Badge>
              </>
            )}
            {(formatOptions.quantum_entropy && formatOptions.zero_knowledge_proof) && (
              <>
                <Badge variant="outline" className="text-xs px-1 py-0">Maximum Security</Badge>
                <Badge variant="outline" className="text-xs px-1 py-0">Quantum Resistant</Badge>
              </>
            )}
            {(formatOptions.quantum_entropy || formatOptions.zero_knowledge_proof) && (
              <>
                <Badge variant="outline" className="text-xs px-1 py-0">High Security</Badge>
                <Badge variant="outline" className="text-xs px-1 py-0">Quantum Features</Badge>
              </>
            )}
          </div>
        </div>

        {formatProgress?.isActive && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Format Progress</span>
              <span>{formatProgress.progress}%</span>
            </div>
            <Progress value={formatProgress.progress} className="w-full" />
            <p className="text-xs text-muted-foreground">{formatProgress.message}</p>
          </div>
        )}

        <div className="flex justify-end space-x-4 pt-4 border-t">

          {/* Format Buttons */}
          <div className="flex gap-2">
            {driveIsEncrypted ? (
              <Button
                onClick={onFormatDrive}
                disabled={
                  operationInProgress ||
                  !formatOptions.password ||
                  formatOptions.password !== formatOptions.confirm_password ||
                  formatProgress?.isActive
                }
                className="bg-orange-600 hover:bg-orange-700 text-white font-medium"
              >
                {formatProgress?.isActive ? 'Processing...' : 'Format & Re-encrypt'}
              </Button>
            ) : (
              <Button
                onClick={onFormatDrive}
                disabled={
                  operationInProgress ||
                  !formatOptions.password ||
                  formatOptions.password !== formatOptions.confirm_password ||
                  formatProgress?.isActive
                }
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium"
              >
                {formatProgress?.isActive ? 'Processing...' : 'Format & Encrypt'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
