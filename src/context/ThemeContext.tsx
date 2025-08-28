import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'zap-vault-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Get theme from localStorage or use default
    const savedTheme = localStorage.getItem(storageKey) as Theme;
    return savedTheme || defaultTheme;
  });

  const [isInitialized, setIsInitialized] = useState(false);

  // Apply theme immediately on mount to prevent FOUC
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark');

    let actualTheme: 'light' | 'dark';

    if (theme === 'system') {
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } else {
      actualTheme = theme;
    }

    // Apply theme class immediately
    root.classList.add(actualTheme);
    
    // Mark as initialized after first render
    if (!isInitialized) {
      setIsInitialized(true);
    }
  }, [theme, isInitialized]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      // Apply theme immediately to DOM for instant switching
      const root = window.document.documentElement;
      
      // Temporarily disable transitions for instant switching
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
      
      // Re-enable transitions after a frame
      requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
      });
      
      // Then update state and localStorage
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
