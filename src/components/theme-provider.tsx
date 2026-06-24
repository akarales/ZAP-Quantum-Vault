import { createContext, useContext, useEffect, useState } from "react";
import { allThemeValues, DEFAULT_THEME } from "@/lib/themes-config";

type Theme = string;

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
  theme: DEFAULT_THEME,
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  storageKey = "tweakcn-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () =>
      (typeof window !== "undefined"
        ? localStorage.getItem(storageKey)
        : null) || defaultTheme,
  );

  useEffect(() => {
    const root = window.document.documentElement;

    // Set the active theme attribute (drives the CSS variables).
    root.setAttribute("data-theme", theme);

    // Toggle the `dark` class so Tailwind `dark:` variants and any
    // shadcn components that key off `.dark` behave consistently.
    root.classList.toggle("dark", theme.endsWith("-dark"));
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
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
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};

// Re-export theme values for convenience
export { allThemeValues, DEFAULT_THEME };
