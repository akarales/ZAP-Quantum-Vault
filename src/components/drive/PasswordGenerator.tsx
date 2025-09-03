import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { RefreshCwIcon, CopyIcon, CheckIcon } from 'lucide-react';

interface PasswordGeneratorProps {
  onPasswordGenerated: (password: string) => void;
  className?: string;
}

export const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({ 
  onPasswordGenerated, 
  className = "" 
}) => {
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [passwordLength, setPasswordLength] = useState([16]);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [copied, setCopied] = useState(false);

  const generatePassword = () => {
    let charset = '';
    
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers) charset += '0123456789';
    if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (charset === '') {
      // Fallback to at least lowercase if nothing selected
      charset = 'abcdefghijklmnopqrstuvwxyz';
    }

    let password = '';
    const length = passwordLength[0];
    
    // Use crypto.getRandomValues for secure random generation
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(array[i] % charset.length);
    }

    setGeneratedPassword(password);
    onPasswordGenerated(password);
    setCopied(false);
  };

  const copyToClipboard = async () => {
    if (generatedPassword) {
      try {
        await navigator.clipboard.writeText(generatedPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy password:', error);
      }
    }
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: 'None', color: 'bg-gray-200' };
    
    let score = 0;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    if (score <= 2) return { strength: score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 4) return { strength: score, label: 'Medium', color: 'bg-yellow-500' };
    return { strength: score, label: 'Strong', color: 'bg-green-500' };
  };

  const strength = getPasswordStrength(generatedPassword);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-3">
        <Label className="text-sm font-medium">Password Length: {passwordLength[0]}</Label>
        <Slider
          value={passwordLength}
          onValueChange={setPasswordLength}
          max={32}
          min={8}
          step={1}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="uppercase"
            checked={includeUppercase}
            onCheckedChange={(checked) => setIncludeUppercase(checked as boolean)}
          />
          <Label htmlFor="uppercase" className="text-sm">Uppercase (A-Z)</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="lowercase"
            checked={includeLowercase}
            onCheckedChange={(checked) => setIncludeLowercase(checked as boolean)}
          />
          <Label htmlFor="lowercase" className="text-sm">Lowercase (a-z)</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="numbers"
            checked={includeNumbers}
            onCheckedChange={(checked) => setIncludeNumbers(checked as boolean)}
          />
          <Label htmlFor="numbers" className="text-sm">Numbers (0-9)</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="symbols"
            checked={includeSymbols}
            onCheckedChange={(checked) => setIncludeSymbols(checked as boolean)}
          />
          <Label htmlFor="symbols" className="text-sm">Symbols (!@#$...)</Label>
        </div>
      </div>

      <Button
        type="button"
        onClick={generatePassword}
        className="w-full"
        variant="outline"
      >
        <RefreshCwIcon className="h-4 w-4 mr-2" />
        Generate Secure Password
      </Button>

      {generatedPassword && (
        <div className="space-y-2">
          <div className="relative">
            <Input
              type="text"
              value={generatedPassword}
              readOnly
              className="pr-10 font-mono text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3"
              onClick={copyToClipboard}
            >
              {copied ? (
                <CheckIcon className="h-4 w-4 text-green-600" />
              ) : (
                <CopyIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${strength.color}`}
                style={{ width: `${(strength.strength / 6) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium">{strength.label}</span>
          </div>
          
          {copied && (
            <p className="text-xs text-green-600">
              ✅ Password copied to clipboard
            </p>
          )}
        </div>
      )}
    </div>
  );
};
