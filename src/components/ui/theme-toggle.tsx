import { Moon, Sun, Monitor, Palette } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/themes/ThemeManager"

export function ThemeToggle() {
  const { setTheme, availableThemes, setThemeConfig, currentThemeConfig } = useTheme()

  // Organize themes by category for better UX
  const lightThemes = Object.values(availableThemes || {}).filter(theme => {
    const bgColor = theme.colors.background;
    if (bgColor.startsWith('oklch(')) {
      const oklchMatch = bgColor.match(/oklch\(([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\)/);
      if (oklchMatch) {
        const lightness = parseFloat(oklchMatch[1]);
        return lightness >= 0.5; // Light themes
      }
    }
    return theme.name.toLowerCase().includes('light') || theme.id.includes('light');
  });

  const darkThemes = Object.values(availableThemes || {}).filter(theme => {
    const bgColor = theme.colors.background;
    if (bgColor.startsWith('oklch(')) {
      const oklchMatch = bgColor.match(/oklch\(([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\)/);
      if (oklchMatch) {
        const lightness = parseFloat(oklchMatch[1]);
        return lightness < 0.5; // Dark themes
      }
    }
    return theme.name.toLowerCase().includes('dark') || theme.id.includes('dark');
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-popover border border-border shadow-lg">
        {/* System Theme Options */}
        <DropdownMenuItem 
          onClick={() => setTheme("system")}
          className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
        >
          <Monitor className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Light Themes */}
        {lightThemes.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
              Light Themes
            </div>
            {lightThemes.map((themeConfig) => (
              <DropdownMenuItem
                key={themeConfig.id}
                onClick={() => {
                  console.log('Selecting light theme:', themeConfig.name, themeConfig.id);
                  setThemeConfig(themeConfig);
                }}
                className={`cursor-pointer hover:bg-accent hover:text-accent-foreground ${
                  currentThemeConfig?.id === themeConfig.id ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                <Sun className="mr-2 h-4 w-4" />
                <span>{themeConfig.displayName || themeConfig.name}</span>
                {currentThemeConfig?.id === themeConfig.id && (
                  <span className="ml-auto text-xs">✓</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        
        {/* Dark Themes */}
        {darkThemes.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
              Dark Themes
            </div>
            {darkThemes.map((themeConfig) => (
              <DropdownMenuItem
                key={themeConfig.id}
                onClick={() => {
                  console.log('Selecting dark theme:', themeConfig.name, themeConfig.id);
                  setThemeConfig(themeConfig);
                }}
                className={`cursor-pointer hover:bg-accent hover:text-accent-foreground ${
                  currentThemeConfig?.id === themeConfig.id ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                <Moon className="mr-2 h-4 w-4" />
                <span>{themeConfig.displayName || themeConfig.name}</span>
                {currentThemeConfig?.id === themeConfig.id && (
                  <span className="ml-auto text-xs">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
