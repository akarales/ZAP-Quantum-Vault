import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Theme, ThemeConfig, ThemeContextType } from './types';
import { TweakCNThemeImporter } from './utils/tweakcn-importer';
import { defaultThemes } from './configs/default-themes';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeManagerProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeManager({
  children,
  defaultTheme = 'system',
  storageKey = 'zap-vault-theme',
}: ThemeManagerProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(storageKey) as Theme;
    return saved || defaultTheme;
  });

  const [currentThemeConfig, setCurrentThemeConfig] = useState<ThemeConfig>(() => {
    const savedConfig = localStorage.getItem(`${storageKey}-config`);
    if (savedConfig) {
      try {
        return JSON.parse(savedConfig);
      } catch {
        // Fall back to default if parsing fails
      }
    }
    // Use Claude as default for light theme, Zap Dark Pro for dark
    const savedTheme = localStorage.getItem(storageKey) as Theme;
    const actualTheme = savedTheme || defaultTheme;
    if (actualTheme === 'light' || (actualTheme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      return defaultThemes['claude'];
    }
    return defaultThemes['zap-dark-pro'];
  });

  const [availableThemes] = useState<Record<string, ThemeConfig>>(() => {
    console.log('Loading themes:', Object.keys(defaultThemes));
    console.log('Available themes:', Object.values(defaultThemes).map(t => t.name));
    console.log('Theme count:', Object.keys(defaultThemes).length);
    return defaultThemes;
  });

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    
    let actualTheme: 'light' | 'dark';
    if (theme === 'system') {
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } else {
      actualTheme = theme;
    }
    
    root.classList.add(actualTheme);
  }, [theme]);

  // Apply theme configuration CSS variables
  useEffect(() => {
    TweakCNThemeImporter.applyTheme(currentThemeConfig);
    localStorage.setItem(`${storageKey}-config`, JSON.stringify(currentThemeConfig));
  }, [currentThemeConfig, storageKey]);

  const handleSetTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    
    // Instant theme switching with transition disable
    root.classList.add('theme-switching');
    root.classList.remove('light', 'dark');
    
    let actualTheme: 'light' | 'dark';
    if (newTheme === 'system') {
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } else {
      actualTheme = newTheme;
    }
    
    root.classList.add(actualTheme);
    
    // Re-enable transitions after DOM update
    requestAnimationFrame(() => {
      root.classList.remove('theme-switching');
    });
    
    localStorage.setItem(storageKey, newTheme);
    setTheme(newTheme);
  };

  const handleSetThemeConfig = (config: ThemeConfig) => {
    console.log('Setting theme config:', config.name, config.id);
    
    // Determine if this is a light or dark theme based on background lightness
    // Handle OKLCH color format: oklch(lightness chroma hue)
    let isDarkTheme = false;
    const bgColor = config.colors.background;
    
    if (bgColor.startsWith('oklch(')) {
      // Parse OKLCH: oklch(0.2747 0.0139 57.6523)
      const oklchMatch = bgColor.match(/oklch\(([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\)/);
      if (oklchMatch) {
        const lightness = parseFloat(oklchMatch[1]);
        isDarkTheme = lightness < 0.5; // OKLCH lightness is 0-1
        console.log('OKLCH Background:', bgColor, 'Lightness:', lightness, 'Is Dark:', isDarkTheme);
      }
    } else if (bgColor.startsWith('hsl(')) {
      // Parse HSL: hsl(240 10% 3.9%)
      const hslMatch = bgColor.match(/hsl\(([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%\)/);
      if (hslMatch) {
        const lightness = parseFloat(hslMatch[3]);
        isDarkTheme = lightness < 50; // HSL lightness is 0-100%
        console.log('HSL Background:', bgColor, 'Lightness:', lightness, 'Is Dark:', isDarkTheme);
      }
    } else {
      // Fallback: assume dark if background contains 'dark' or lightness appears low
      isDarkTheme = bgColor.includes('dark') || config.name.toLowerCase().includes('dark');
      console.log('Fallback detection for:', bgColor, 'Is Dark:', isDarkTheme);
    }
    
    // Set the appropriate base theme mode
    const newTheme = isDarkTheme ? 'dark' : 'light';
    const root = document.documentElement;
    
    // Apply theme class instantly
    root.classList.add('theme-switching');
    root.classList.remove('light', 'dark');
    root.classList.add(newTheme);
    
    // Apply the theme configuration CSS variables
    TweakCNThemeImporter.applyTheme(config);
    
    // Update state
    setTheme(newTheme);
    setCurrentThemeConfig(config);
    localStorage.setItem(storageKey, newTheme);
    
    console.log('Theme applied:', newTheme, 'Config:', config.name);
    
    // Re-enable transitions
    requestAnimationFrame(() => {
      root.classList.remove('theme-switching');
    });
  };

  const importTweakCNTheme = async (url: string) => {
    try {
      const importedTheme = await TweakCNThemeImporter.importTheme(url);
      
      if (!TweakCNThemeImporter.validateTheme(importedTheme)) {
        throw new Error('Invalid theme configuration');
      }
      
      setCurrentThemeConfig(importedTheme);
    } catch (error) {
      console.error('Failed to import TweakCN theme:', error);
      throw error;
    }
  };

  const exportCurrentTheme = (): string => {
    return TweakCNThemeImporter.exportToTweakCN(currentThemeConfig);
  };

  const resetToDefault = () => {
    const defaultConfig = theme === 'light' 
      ? defaultThemes['claude-light'] 
      : defaultThemes['zap-dark-pro'];
    setCurrentThemeConfig(defaultConfig);
  };

  const contextValue: ThemeContextType = {
    theme,
    currentThemeConfig,
    availableThemes,
    setTheme: handleSetTheme,
    setThemeConfig: handleSetThemeConfig,
    importTweakCNTheme,
    exportCurrentTheme,
    resetToDefault,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeManager');
  }
  return context;
};
