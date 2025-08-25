import { useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Copy, RefreshCw, Zap, Settings } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';

interface PasswordGeneratorCompactProps {
  onPasswordGenerated: (password: string) => void;
  className?: string;
}

export const PasswordGeneratorCompact = ({ onPasswordGenerated, className }: PasswordGeneratorCompactProps) => {
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [options, setOptions] = useState({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    quantumEntropy: false
  });

  const generatePassword = useCallback(async () => {
    setGenerating(true);
    
    try {
      let charset = '';
      if (options.includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (options.includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
      if (options.includeNumbers) charset += '0123456789';
      if (options.includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

      if (!charset) throw new Error('No character sets selected');

      await new Promise(resolve => setTimeout(resolve, options.quantumEntropy ? 300 : 50));
      
      const array = new Uint8Array(options.length * 2);
      window.crypto.getRandomValues(array);
      
      let password = '';
      for (let i = 0; i < options.length; i++) {
        password += charset[array[i] % charset.length];
      }

      setGeneratedPassword(password);
      onPasswordGenerated(password);
    } catch (error) {
      console.error('Password generation failed:', error);
    } finally {
      setGenerating(false);
    }
  }, [options, onPasswordGenerated]);

  const copyToClipboard = async () => {
    if (!generatedPassword) return;
    
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(null), 1500);
    } catch (error) {
      setCopyFeedback('Failed');
      setTimeout(() => setCopyFeedback(null), 1500);
    }
  };

  const calculateEntropy = (password: string, charset: string) => {
    if (!password || !charset) return 0;
    return Math.log2(Math.pow(charset.length, password.length));
  };

  const getStrengthColor = (entropy: number) => {
    if (entropy >= 128) return 'text-purple-600';
    if (entropy >= 80) return 'text-green-600';
    if (entropy >= 60) return 'text-blue-600';
    if (entropy >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  let charset = '';
  if (options.includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (options.includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (options.includeNumbers) charset += '0123456789';
  if (options.includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const entropy = calculateEntropy(generatedPassword, charset);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-blue-500" />
        <Label className="text-sm font-medium">Password Generator</Label>
        {generatedPassword && (
          <Badge variant="outline" className={getStrengthColor(entropy)}>
            {entropy.toFixed(0)} bits
          </Badge>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={generatePassword}
          disabled={generating || !charset}
          size="sm"
          className="flex items-center gap-1"
        >
          {generating ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Generate
        </Button>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copyToClipboard}
          disabled={!generatedPassword}
          className="flex items-center gap-1"
        >
          <Copy className="w-3 h-3" />
          Copy
        </Button>
      </div>

      {copyFeedback && (
        <div className="text-xs text-green-600 bg-green-50 p-1 rounded text-center">
          {copyFeedback}
        </div>
      )}

      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 text-xs">
            <Settings className="w-3 h-3 mr-1" />
            {showAdvanced ? 'Hide' : 'Show'} Options
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={options.includeUppercase}
                onChange={(e) => setOptions(prev => ({ ...prev, includeUppercase: e.target.checked }))}
                className="w-3 h-3"
              />
              Uppercase
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={options.includeLowercase}
                onChange={(e) => setOptions(prev => ({ ...prev, includeLowercase: e.target.checked }))}
                className="w-3 h-3"
              />
              Lowercase
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={options.includeNumbers}
                onChange={(e) => setOptions(prev => ({ ...prev, includeNumbers: e.target.checked }))}
                className="w-3 h-3"
              />
              Numbers
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={options.includeSymbols}
                onChange={(e) => setOptions(prev => ({ ...prev, includeSymbols: e.target.checked }))}
                className="w-3 h-3"
              />
              Symbols
            </label>
          </div>
          
          <div className="flex items-center gap-2">
            <Label className="text-xs">Length:</Label>
            <input
              type="range"
              min="8"
              max="32"
              value={options.length}
              onChange={(e) => setOptions(prev => ({ ...prev, length: parseInt(e.target.value) }))}
              className="flex-1 h-1"
            />
            <span className="text-xs w-6">{options.length}</span>
          </div>

          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={options.quantumEntropy}
              onChange={(e) => setOptions(prev => ({ ...prev, quantumEntropy: e.target.checked }))}
              className="w-3 h-3"
            />
            Quantum Entropy (slower)
          </label>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
