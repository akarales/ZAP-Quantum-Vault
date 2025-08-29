// Theme system types for TweakCN integration
export interface ThemeConfig {
  name: string;
  displayName?: string;
  id: string;
  colors: {
    background: string;
    foreground: string;
    card: string;
    'card-foreground': string;
    popover: string;
    'popover-foreground': string;
    primary: string;
    'primary-foreground': string;
    secondary: string;
    'secondary-foreground': string;
    muted: string;
    'muted-foreground': string;
    accent: string;
    'accent-foreground': string;
    destructive: string;
    'destructive-foreground': string;
    border: string;
    input: string;
    ring: string;
    'chart-1'?: string;
    'chart-2'?: string;
    'chart-3'?: string;
    'chart-4'?: string;
    'chart-5'?: string;
    sidebar?: string;
    'sidebar-foreground'?: string;
    'sidebar-primary'?: string;
    'sidebar-primary-foreground'?: string;
    'sidebar-accent'?: string;
    'sidebar-accent-foreground'?: string;
    'sidebar-border'?: string;
    'sidebar-ring'?: string;
  };
  radius: string;
  shadows?: {
    color?: string;
    opacity?: string;
    blur?: string;
    spread?: string;
    'offset-x'?: string;
    'offset-y'?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
  };
  metadata?: {
    author?: string;
    description?: string;
    tags?: string[];
    createdAt?: string;
    tweakcnUrl?: string;
  };
}

export interface TweakCNThemeData {
  colors: Record<string, string>;
  radius: string;
  name?: string;
  shadows?: Record<string, string>;
}

export type Theme = 'dark' | 'light' | 'system';

export interface ThemeContextType {
  theme: Theme;
  currentThemeConfig: ThemeConfig;
  availableThemes: Record<string, ThemeConfig>;
  setTheme: (theme: Theme) => void;
  setThemeConfig: (config: ThemeConfig) => void;
  importTweakCNTheme: (url: string) => Promise<void>;
  exportCurrentTheme: () => string;
  resetToDefault: () => void;
}
