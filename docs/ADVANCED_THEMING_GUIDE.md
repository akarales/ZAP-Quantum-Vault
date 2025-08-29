# ZAP Vault Advanced Theming System

## Overview

The ZAP Vault theming system provides instant theme switching, TweakCN integration, and advanced customization capabilities using CSS variables and Tailwind CSS v4.

## Features

- **Instant Theme Switching**: Zero-delay theme changes with DOM manipulation
- **TweakCN Integration**: Import/export themes from the TweakCN visual editor
- **Multiple Built-in Themes**: Professional presets for different use cases
- **Custom Theme Creation**: Full control over colors, radius, and shadows
- **Theme Persistence**: Automatic saving to localStorage
- **System Theme Detection**: Respects user's OS preference

## Architecture

### Theme Manager (`/src/themes/ThemeManager.tsx`)

The `ThemeManager` component replaces the old `ThemeContext` and provides:

```tsx
interface ThemeContextType {
  theme: Theme;
  currentThemeConfig: ThemeConfig;
  availableThemes: ThemeConfig[];
  setTheme: (theme: Theme) => void;
  setThemeConfig: (config: ThemeConfig) => void;
  importTweakCNTheme: (url: string) => Promise<void>;
  exportCurrentTheme: () => string;
  resetToDefault: () => void;
}
```

### Theme Configuration

Each theme is defined by a `ThemeConfig` object:

```tsx
interface ThemeConfig {
  name: string;
  id: string;
  colors: {
    background: string;
    foreground: string;
    card: string;
    // ... all CSS custom properties
  };
  radius: string;
  shadows?: Record<string, string>;
  metadata?: {
    author?: string;
    description?: string;
    tags?: string[];
    createdAt?: string;
    tweakcnUrl?: string;
  };
}
```

## Built-in Themes

### Dark Themes
- **Zap Dark Pro**: Enhanced dark theme with improved card contrast
- **Quantum Purple**: Deep purple with cyan highlights for futuristic aesthetics
- **Security Green**: Dark green with amber warnings for security applications
- **Bitcoin Gold**: Dark theme with gold/orange accents for crypto apps
- **Vault Blue**: Professional blue-gray theme for secure applications

### Light Themes
- **Zap Light**: Clean light theme with enhanced card contrast

## Usage

### Basic Setup

```tsx
import { ThemeManager } from '@/themes/ThemeManager';

function App() {
  return (
    <ThemeManager defaultTheme="dark" storageKey="zap-vault-theme">
      <YourApp />
    </ThemeManager>
  );
}
```

### Theme Toggle Component

```tsx
import { useTheme } from '@/themes/ThemeManager';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  
  return (
    <Button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Toggle Theme
    </Button>
  );
}
```

### Theme Customizer

The `ThemeCustomizer` component provides a full UI for:
- Selecting preset themes
- Importing from TweakCN URLs
- Exporting current theme
- Custom color editing
- Real-time preview

```tsx
import { ThemeCustomizer } from '@/components/ui/theme-customizer';

export function SettingsPage() {
  return (
    <div>
      <ThemeCustomizer />
    </div>
  );
}
```

## TweakCN Integration

### Importing Themes

1. Visit [TweakCN Editor](https://tweakcn.com/editor)
2. Create or customize a theme
3. Copy the generated URL
4. Use the Theme Customizer import feature or programmatically:

```tsx
const { importTweakCNTheme } = useTheme();
await importTweakCNTheme('https://tweakcn.com/editor/theme?config=...');
```

### Exporting Themes

```tsx
const { exportCurrentTheme } = useTheme();
const tweakcnUrl = exportCurrentTheme();
// Share the URL or save it for later use
```

## CSS Variables

The theming system uses CSS custom properties that are automatically applied:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  /* ... more variables */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 220 13% 18%;
  --card-foreground: 210 40% 98%;
  /* ... dark theme overrides */
}
```

## Instant Theme Switching

The system achieves instant theme switching by:

1. **Direct DOM Manipulation**: Applies theme classes immediately to `document.documentElement`
2. **Transition Disabling**: Temporarily adds `.theme-switching` class to disable CSS transitions
3. **CSS Variable Updates**: Applies theme colors as CSS custom properties instantly
4. **Bypass React Render**: Avoids waiting for React state updates and re-renders

```tsx
const handleSetTheme = (newTheme: Theme) => {
  const root = document.documentElement;
  
  // Instant switching with transition disable
  root.classList.add('theme-switching');
  root.classList.remove('light', 'dark');
  root.classList.add(actualTheme);
  
  // Re-enable transitions after DOM update
  requestAnimationFrame(() => {
    root.classList.remove('theme-switching');
  });
};
```

## Custom Theme Creation

### Programmatic Theme Creation

```tsx
const customTheme: ThemeConfig = {
  name: 'My Custom Theme',
  id: 'custom-theme-1',
  colors: {
    background: '210 20% 8%',
    foreground: '210 5% 96%',
    primary: '221 83% 53%',
    // ... define all required colors
  },
  radius: '0.75rem',
  metadata: {
    author: 'Your Name',
    description: 'A custom theme for my app',
    tags: ['custom', 'dark'],
  },
};

const { setThemeConfig } = useTheme();
setThemeConfig(customTheme);
```

### Color Format

Colors use HSL format without the `hsl()` wrapper:
- `221.2 83.2% 53.3%` ✅
- `hsl(221.2, 83.2%, 53.3%)` ❌

## Performance Optimizations

1. **CSS Variables**: Efficient color updates without class changes
2. **Transition Disabling**: Prevents visual lag during theme switches
3. **localStorage Caching**: Persists theme preferences
4. **Lazy Loading**: Theme configs loaded on demand
5. **Minimal Re-renders**: Direct DOM updates bypass React render cycle

## Migration from Old Theme System

### Before (ThemeContext)
```tsx
import { ThemeProvider } from '@/context/ThemeContext';
```

### After (ThemeManager)
```tsx
import { ThemeManager } from '@/themes/ThemeManager';
```

The API remains largely compatible, with additional features for theme customization.

## Best Practices

1. **Use Semantic Colors**: Stick to the defined color tokens (primary, secondary, etc.)
2. **Test Both Themes**: Ensure components work in both light and dark modes
3. **Consistent Radius**: Use the theme's radius value for consistent borders
4. **Accessibility**: Ensure sufficient contrast ratios in custom themes
5. **Performance**: Avoid inline styles; use CSS classes with theme variables

## Troubleshooting

### Theme Not Applying
- Check that `ThemeManager` wraps your app
- Verify CSS variables are properly defined
- Ensure Tailwind CSS v4 is configured correctly

### TweakCN Import Failing
- Verify the URL format is correct
- Check that all required color properties are present
- Ensure the base64 config is valid JSON

### Slow Theme Switching
- Verify `.theme-switching` class is working
- Check for CSS transitions that aren't being disabled
- Ensure direct DOM manipulation is working

## Demo Page

Visit `/theme-demo` in the application to see:
- All available themes
- Theme customizer interface
- Component showcase with current theme
- Import/export functionality
- Real-time theme switching

## API Reference

### ThemeManager Props
- `defaultTheme?: Theme` - Initial theme ('light' | 'dark' | 'system')
- `storageKey?: string` - localStorage key for persistence

### useTheme Hook
Returns the complete theme context with all methods for theme management.

### TweakCNThemeImporter
Utility class for importing/exporting TweakCN themes with validation and conversion.
