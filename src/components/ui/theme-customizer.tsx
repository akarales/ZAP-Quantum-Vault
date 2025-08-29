import React, { useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Badge } from './badge';
import { useTheme } from '../../themes/ThemeManager';
import { Download, Upload, Palette, RotateCcw, Copy, Check } from 'lucide-react';
import { defaultThemes } from '../../themes/configs/default-themes';

export function ThemeCustomizer() {
  const {
    currentThemeConfig,
    availableThemes,
    setThemeConfig,
    importTweakCNTheme,
    exportCurrentTheme,
    resetToDefault,
  } = useTheme();

  const [tweakcnUrl, setTweakcnUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleImportTweakCN = async () => {
    if (!tweakcnUrl.trim()) return;
    
    setIsImporting(true);
    setImportError('');
    
    try {
      await importTweakCNTheme(tweakcnUrl);
      setTweakcnUrl('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    const exportUrl = exportCurrentTheme();
    await navigator.clipboard.writeText(exportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePresetSelect = (themeId: string) => {
    const theme = defaultThemes[themeId];
    if (theme) {
      setThemeConfig(theme);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Theme Customizer
        </CardTitle>
        <CardDescription>
          Customize your theme with presets, import from TweakCN, or create your own
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="presets" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="presets">Presets</TabsTrigger>
            <TabsTrigger value="import">Import/Export</TabsTrigger>
            <TabsTrigger value="customize">Customize</TabsTrigger>
          </TabsList>

          <TabsContent value="presets" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableThemes.map((theme) => (
                <Card
                  key={theme.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    currentThemeConfig.id === theme.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handlePresetSelect(theme.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{theme.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {theme.metadata?.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1 mb-3">
                      {theme.metadata?.tags?.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-1 h-4">
                      <div
                        className="flex-1 rounded-sm"
                        style={{ backgroundColor: `hsl(${theme.colors.primary})` }}
                      />
                      <div
                        className="flex-1 rounded-sm"
                        style={{ backgroundColor: `hsl(${theme.colors.secondary})` }}
                      />
                      <div
                        className="flex-1 rounded-sm"
                        style={{ backgroundColor: `hsl(${theme.colors.accent})` }}
                      />
                      <div
                        className="flex-1 rounded-sm"
                        style={{ backgroundColor: `hsl(${theme.colors.muted})` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="tweakcn-url">Import from TweakCN</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="tweakcn-url"
                    placeholder="https://tweakcn.com/editor/theme?config=..."
                    value={tweakcnUrl}
                    onChange={(e) => setTweakcnUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleImportTweakCN}
                    disabled={!tweakcnUrl.trim() || isImporting}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isImporting ? 'Importing...' : 'Import'}
                  </Button>
                </div>
                {importError && (
                  <p className="text-sm text-destructive mt-1">{importError}</p>
                )}
              </div>

              <div className="border-t pt-4">
                <Label>Export Current Theme</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Share your current theme configuration with others
                </p>
                <Button onClick={handleExport} variant="outline">
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy TweakCN URL
                    </>
                  )}
                </Button>
              </div>

              <div className="border-t pt-4">
                <Label>Reset to Default</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Reset to the default theme configuration
                </p>
                <Button onClick={resetToDefault} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Theme
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="customize" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="theme-name">Theme Name</Label>
                <Input
                  id="theme-name"
                  value={currentThemeConfig.name}
                  onChange={(e) =>
                    setThemeConfig({
                      ...currentThemeConfig,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="border-radius">Border Radius</Label>
                <Input
                  id="border-radius"
                  value={currentThemeConfig.radius}
                  onChange={(e) =>
                    setThemeConfig({
                      ...currentThemeConfig,
                      radius: e.target.value,
                    })
                  }
                  placeholder="0.5rem"
                />
              </div>
            </div>

            <div>
              <Label className="text-base font-semibold">Colors</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                {Object.entries(currentThemeConfig.colors).map(([key, value]) => (
                  <div key={key}>
                    <Label htmlFor={key} className="text-sm capitalize">
                      {key.replace('-', ' ')}
                    </Label>
                    <Input
                      id={key}
                      value={value}
                      onChange={(e) =>
                        setThemeConfig({
                          ...currentThemeConfig,
                          colors: {
                            ...currentThemeConfig.colors,
                            [key]: e.target.value,
                          },
                        })
                      }
                      placeholder="HSL values (e.g., 221.2 83.2% 53.3%)"
                      className="text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
