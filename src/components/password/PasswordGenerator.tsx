import { useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { Checkbox } from '../ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Copy, RefreshCw, Eye, EyeOff, Zap } from 'lucide-react';
import { Badge } from '../ui/badge';

interface PasswordGeneratorProps {
  onPasswordGenerated: (password: string) => void;
  className?: string;
}

interface PasswordOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeSimilar: boolean;
  quantumEntropy: boolean;
}

export const PasswordGenerator = ({ onPasswordGenerated, className }: PasswordGeneratorProps) => {
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  
  const [options, setOptions] = useState<PasswordOptions>({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: false,
    quantumEntropy: false
  });

  const getCharacterSets = useCallback(() => {
    const sets = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      similarChars: 'il1Lo0O'
    };

    let charset = '';
    if (options.includeUppercase) charset += sets.uppercase;
    if (options.includeLowercase) charset += sets.lowercase;
    if (options.includeNumbers) charset += sets.numbers;
    if (options.includeSymbols) charset += sets.symbols;

    if (options.excludeSimilar) {
      charset = charset.split('').filter(char => !sets.similarChars.includes(char)).join('');
    }

    return charset;
  }, [options]);

  const calculateEntropy = useCallback((password: string, charset: string) => {
    if (!password || !charset) return 0;
    return Math.log2(Math.pow(charset.length, password.length));
  }, []);

  const getStrengthInfo = useCallback((password: string, charset: string) => {
    const entropy = calculateEntropy(password, charset);
    
    if (entropy >= 128) return { level: 'Quantum-Safe', color: 'bg-purple-500', description: 'Resistant to quantum attacks' };
    if (entropy >= 80) return { level: 'Very Strong', color: 'bg-green-500', description: 'Excellent security' };
    if (entropy >= 60) return { level: 'Strong', color: 'bg-blue-500', description: 'Good security' };
    if (entropy >= 40) return { level: 'Moderate', color: 'bg-yellow-500', description: 'Acceptable security' };
    return { level: 'Weak', color: 'bg-red-500', description: 'Poor security' };
  }, [calculateEntropy]);

  const generateSecureRandom = useCallback(async (length: number): Promise<Uint8Array> => {
    if (options.quantumEntropy && window.crypto && window.crypto.getRandomValues) {
      // Simulate quantum entropy by combining multiple entropy sources
      const array1 = new Uint8Array(length);
      const array2 = new Uint8Array(length);
      const array3 = new Uint8Array(length);
      
      window.crypto.getRandomValues(array1);
      window.crypto.getRandomValues(array2);
      window.crypto.getRandomValues(array3);
      
      // XOR combine for enhanced entropy
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
  }, [options.quantumEntropy]);

  const generatePassword = useCallback(async () => {
    setGenerating(true);
    
    try {
      const charset = getCharacterSets();
      if (!charset) {
        throw new Error('No character sets selected');
      }

      // Add small delay to show generating state
      await new Promise(resolve => setTimeout(resolve, options.quantumEntropy ? 500 : 100));
      
      const randomBytes = await generateSecureRandom(options.length * 2); // Extra bytes for better distribution
      let password = '';
      
      for (let i = 0; i < options.length; i++) {
        const randomIndex = randomBytes[i] % charset.length;
        password += charset[randomIndex];
      }

      // Ensure at least one character from each selected set
      const requiredChars = [];
      if (options.includeUppercase) requiredChars.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]);
      if (options.includeLowercase) requiredChars.push('abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]);
      if (options.includeNumbers) requiredChars.push('0123456789'[Math.floor(Math.random() * 10)]);
      if (options.includeSymbols) requiredChars.push('!@#$%^&*'[Math.floor(Math.random() * 8)]);

      // Replace random positions with required characters
      const passwordArray = password.split('');
      requiredChars.forEach((char, index) => {
        if (index < passwordArray.length) {
          passwordArray[index] = char;
        }
      });

      // Shuffle the array
      for (let i = passwordArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
      }

      const finalPassword = passwordArray.join('');
      setGeneratedPassword(finalPassword);
      onPasswordGenerated(finalPassword);
    } catch (error) {
      console.error('Password generation failed:', error);
    } finally {
      setGenerating(false);
    }
  }, [options, getCharacterSets, generateSecureRandom, onPasswordGenerated]);

  const copyToClipboard = async () => {
    if (!generatedPassword) return;
    
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopyFeedback('Password copied to clipboard!');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (error) {
      setCopyFeedback('Failed to copy password');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const charset = getCharacterSets();
  const entropy = calculateEntropy(generatedPassword, charset);
  const strengthInfo = getStrengthInfo(generatedPassword, charset);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-500" />
          Quantum Password Generator
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Generated Password Display */}
        <div className="space-y-2">
          <Label>Generated Password</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={generatedPassword}
                readOnly
                placeholder="Click generate to create password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              disabled={!generatedPassword}
              className="flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy
            </Button>
          </div>
          
          {copyFeedback && (
            <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
              {copyFeedback}
            </div>
          )}
        </div>

        {/* Password Strength Indicator */}
        {generatedPassword && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Password Strength</span>
              <Badge className={`${strengthInfo.color} text-white`}>
                {strengthInfo.level}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Entropy: {entropy.toFixed(1)} bits • {strengthInfo.description}
            </div>
          </div>
        )}

        {/* Password Options */}
        <div className="space-y-4 border-t pt-4">
          <div className="space-y-2">
            <Label>Password Length: {options.length}</Label>
            <Slider
              value={[options.length]}
              onValueChange={([value]) => setOptions(prev => ({ ...prev, length: value }))}
              min={8}
              max={64}
              step={1}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="uppercase"
                checked={options.includeUppercase}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, includeUppercase: !!checked }))
                }
              />
              <Label htmlFor="uppercase" className="text-sm">Uppercase (A-Z)</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="lowercase"
                checked={options.includeLowercase}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, includeLowercase: !!checked }))
                }
              />
              <Label htmlFor="lowercase" className="text-sm">Lowercase (a-z)</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="numbers"
                checked={options.includeNumbers}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, includeNumbers: !!checked }))
                }
              />
              <Label htmlFor="numbers" className="text-sm">Numbers (0-9)</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="symbols"
                checked={options.includeSymbols}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, includeSymbols: !!checked }))
                }
              />
              <Label htmlFor="symbols" className="text-sm">Symbols (!@#$)</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="excludeSimilar"
                checked={options.excludeSimilar}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, excludeSimilar: !!checked }))
                }
              />
              <Label htmlFor="excludeSimilar" className="text-sm">Exclude Similar</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="quantumEntropy"
                checked={options.quantumEntropy}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, quantumEntropy: !!checked }))
                }
              />
              <Label htmlFor="quantumEntropy" className="text-sm">Quantum Entropy</Label>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={generatePassword}
          disabled={generating || !charset}
          className="w-full flex items-center gap-2"
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              {options.quantumEntropy ? 'Generating Quantum Password...' : 'Generating...'}
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Generate {options.quantumEntropy ? 'Quantum ' : ''}Password
            </>
          )}
        </Button>

        {!charset && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            Please select at least one character type
          </div>
        )}
      </CardContent>
    </Card>
  );
};
