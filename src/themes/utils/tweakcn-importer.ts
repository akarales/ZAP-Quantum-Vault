import type { ThemeConfig, TweakCNThemeData } from '../types';

export class TweakCNThemeImporter {
  /**
   * Import theme from TweakCN URL
   * Example: https://tweakcn.com/editor/theme?config=eyJ0aGVtZSI6ImRhcmsiLCJjb2xvcnMiOnt9fQ==
   */
  static async importTheme(themeUrl: string): Promise<ThemeConfig> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch theme: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // TweakCN now provides OKLCH format natively
      if (data.styles && data.styles.light) {
        return this.convertTweakCNTheme(data);
      }
      
      // Handle direct OKLCH theme format
      if (data.colors) {
        return data as ThemeConfig;
      }
      
      throw new Error('Unsupported theme format');
    } catch (error) {
      console.error('Error importing theme:', error);
      throw error;
    }
  }

  /**
   * Import theme from shadcn UI theme generator (native OKLCH)
   */
  static async importFromShadcnGenerator(themeId: string): Promise<ThemeConfig> {
    try {
      // Example API call to shadcn theme generator
      const response = await fetch(`https://shadcn.rlabs.art/api/themes/${themeId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch theme: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data as ThemeConfig;
    } catch (error) {
      console.error('Error importing from shadcn generator:', error);
      throw error;
    }
  }

  /**
   * Convert TweakCN theme data to our ThemeConfig format
   */
  static convertTweakCNToConfig(
    tweakcnData: TweakCNThemeData, 
    sourceUrl?: string
  ): ThemeConfig {
    const timestamp = new Date().toISOString();
    const themeId = `tweakcn-${Date.now()}`;
    
    return {
      name: tweakcnData.name || 'Imported Theme',
      id: themeId,
      colors: {
        background: tweakcnData.colors.background || '0 0% 100%',
        foreground: tweakcnData.colors.foreground || '222.2 84% 4.9%',
        card: tweakcnData.colors.card || '0 0% 100%',
        'card-foreground': tweakcnData.colors['card-foreground'] || '222.2 84% 4.9%',
        popover: tweakcnData.colors.popover || '0 0% 100%',
        'popover-foreground': tweakcnData.colors['popover-foreground'] || '222.2 84% 4.9%',
        primary: tweakcnData.colors.primary || '221.2 83.2% 53.3%',
        'primary-foreground': tweakcnData.colors['primary-foreground'] || '210 40% 98%',
        secondary: tweakcnData.colors.secondary || '210 40% 96%',
        'secondary-foreground': tweakcnData.colors['secondary-foreground'] || '222.2 84% 4.9%',
        muted: tweakcnData.colors.muted || '210 40% 96%',
        'muted-foreground': tweakcnData.colors['muted-foreground'] || '215.4 16.3% 46.9%',
        accent: tweakcnData.colors.accent || '210 40% 96%',
        'accent-foreground': tweakcnData.colors['accent-foreground'] || '222.2 84% 4.9%',
        destructive: tweakcnData.colors.destructive || '0 84.2% 60.2%',
        'destructive-foreground': tweakcnData.colors['destructive-foreground'] || '210 40% 98%',
        border: tweakcnData.colors.border || '214.3 31.8% 91.4%',
        input: tweakcnData.colors.input || '214.3 31.8% 91.4%',
        ring: tweakcnData.colors.ring || '221.2 83.2% 53.3%',
      },
      radius: tweakcnData.radius || '0.5rem',
      shadows: tweakcnData.shadows as { sm: string; md: string; lg: string; xl: string; } | undefined,
      metadata: {
        author: 'TweakCN Import',
        description: 'Theme imported from TweakCN editor',
        tags: ['imported', 'tweakcn'],
        createdAt: timestamp,
        tweakcnUrl: sourceUrl,
      },
    };
  }

  /**
   * Apply theme configuration to DOM
   */
  static applyTheme(theme: ThemeConfig): void {
    const root = document.documentElement;
    
    console.log('Applying theme:', theme.name, theme.id);
    console.log('Theme colors:', theme.colors);
    
    // Temporarily disable transitions for instant switching
    root.classList.add('theme-switching');
    
    // Apply CSS custom properties
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--${key}`;
      console.log(`Setting ${cssVar}: ${value}`);
      
      // Handle CSS variable references (var(--variable)) vs direct values
      if (value.startsWith('var(')) {
        // For var() references, we need to get the actual computed value
        const varName = value.match(/var\((--[^)]+)\)/)?.[1];
        if (varName) {
          const computedValue = getComputedStyle(root).getPropertyValue(varName);
          if (computedValue) {
            root.style.setProperty(cssVar, computedValue);
            console.log(`Resolved ${cssVar}: ${value} -> ${computedValue}`);
          } else {
            // Keep the var() reference if no computed value found
            root.style.setProperty(cssVar, value);
          }
        }
      } else {
        // Direct value - set as is
        root.style.setProperty(cssVar, value);
      }
    });
    
    // Apply radius
    const radiusValue = theme.radius.startsWith('var(') 
      ? getComputedStyle(root).getPropertyValue(theme.radius.match(/var\((--[^)]+)\)/)?.[1] || '--radius') || theme.radius
      : theme.radius;
    root.style.setProperty('--radius', radiusValue);
    console.log('Set radius:', radiusValue);
    
    // Apply shadows if available
    if (theme.shadows) {
      Object.entries(theme.shadows).forEach(([key, value]) => {
        if (value) {
          const shadowValue = value.startsWith('var(')
            ? getComputedStyle(root).getPropertyValue(value.match(/var\((--[^)]+)\)/)?.[1] || `--shadow-${key}`) || value
            : value;
          root.style.setProperty(`--shadow-${key}`, shadowValue);
        }
      });
    }
    
    // Log current CSS variables for debugging
    console.log('Current CSS variables after apply:');
    console.log('--background:', getComputedStyle(root).getPropertyValue('--background'));
    console.log('--foreground:', getComputedStyle(root).getPropertyValue('--foreground'));
    console.log('--primary:', getComputedStyle(root).getPropertyValue('--primary'));
    
    // Re-enable transitions after DOM update
    requestAnimationFrame(() => {
      root.classList.remove('theme-switching');
    });
  }

  /**
   * Export current theme configuration to TweakCN format
   */
  static exportToTweakCN(theme: ThemeConfig): string {
    const tweakcnData: TweakCNThemeData = {
      name: theme.name,
      colors: theme.colors,
      radius: theme.radius,
      shadows: theme.shadows,
    };
    
    const configString = btoa(JSON.stringify(tweakcnData));
    return `https://tweakcn.com/editor/theme?config=${configString}`;
  }

  /**
   * Validate theme configuration
   */
  static validateTheme(theme: ThemeConfig): boolean {
    const requiredColors = [
      'background', 'foreground', 'card', 'card-foreground',
      'primary', 'primary-foreground', 'secondary', 'secondary-foreground',
      'muted', 'muted-foreground', 'accent', 'accent-foreground',
      'destructive', 'destructive-foreground', 'border', 'input', 'ring'
    ];
    
    // Check all required colors exist
    const hasAllColors = requiredColors.every(color => 
      theme.colors[color as keyof typeof theme.colors] !== undefined
    );
    
    if (!hasAllColors) return false;
    
    // Validate HSL format for each color
    return Object.values(theme.colors).every(color => 
      this.validateHSLFormat(color)
    );
  }

  /**
   * Validate HSL color format
   */
  static validateHSLFormat(color: string): boolean {
    // HSL format: "hue saturation% lightness%" or "hue saturation lightness"
    const hslRegex = /^\d+(\.\d+)?\s+\d+(\.\d+)?%?\s+\d+(\.\d+)?%?$/;
    return hslRegex.test(color.trim());
  }
}
