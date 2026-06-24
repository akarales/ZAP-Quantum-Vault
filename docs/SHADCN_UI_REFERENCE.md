# ZAP Quantum Vault — shadcn/ui & tweakcn Reference

## Project Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19 |
| Build Tool | Vite | 6 |
| CSS | Tailwind CSS | 4 |
| UI Library | shadcn/ui (Radix Nova) | latest |
| Theme Editor | tweakcn | web-based |
| Icons | Lucide React | latest |
| Font | Geist Variable | @fontsource-variable/geist |
| State | Zustand | 5 |
| Desktop | Tauri | 2 |

## shadcn Config (`components.json`)

- **Style**: `radix-nova` (Radix + Nova preset: Lucide icons + Geist font)
- **Base Color**: Neutral
- **CSS Variables**: oklch format
- **Path Alias**: `@/*` → `./src/*`
- **RSC**: false (Vite)

## Installed Components (55)

## shadcn CLI Commands

```bash
# Initialize
pnpm dlx shadcn@latest init

# Add components
pnpm dlx shadcn@latest add button card input

# Add all (interactive)
pnpm dlx shadcn@latest add

# Overwrite existing
pnpm dlx shadcn@latest add button --overwrite

# Migrate from Radix
pnpm dlx shadcn@latest migrate radix src/components/ui/dialog.tsx

# Check for changes
pnpm dlx shadcn@latest diff
```

## tweakcn — Visual Theme Editor

### What

Free open-source visual theme editor for shadcn/ui. Customize colors, fonts, radii, shadows with live preview, then export CSS variables.

### How to Use

1. Visit **[tweakcn.com/editor/theme](https://tweakcn.com/editor/theme)**
2. Choose a preset or customize from scratch
3. Adjust colors, fonts, spacing, radii, shadows
4. Export: select **Tailwind v4** + **oklch** format
5. Copy exported CSS
6. Paste `:root` and `.dark` blocks into `src/index.css` (replace existing)
7. Keep `@theme inline` block as-is

### Run Locally (optional)

```bash
git clone https://github.com/jnsahaj/tweakcn.git
cd tweakcn
pnpm install
pnpm dev
```

### Workflow for ZAP Quantum Vault

1. Go to tweakcn.com
2. Start dark-first, set primary to cyan/blue (quantum vault aesthetic)
3. Export as Tailwind v4 + oklch
4. Replace `:root` and `.dark` in `src/index.css`
5. Test at `http://localhost:1420`

## CSS Architecture

### Imports (`src/index.css`)

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";
@import "./styles/themes/index.css";
```

### Color System

- oklch format (perceptually uniform)
- `:root` = light theme, `.dark` = dark theme
- `@theme inline` maps CSS vars to Tailwind utilities
- Dark mode via `<html class="dark">`

### Custom Utilities

| Class | Effect |
|-------|--------|
| `.gradient-text` | Cyan-to-purple gradient text |
| `.gradient-bg` | Subtle background gradient |
| `.glass` | Glassmorphism (blur + transparency) |
| `.glow-primary` | Primary color glow |
| `.bg-grid` | Grid pattern background |
| `.animate-pulse-glow` | Pulsing glow animation |

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `radix-ui` | UI primitives |
| `@tailwindcss/vite` | Tailwind v4 Vite plugin (REQUIRED) |
| `cmdk` | Command palette |
| `recharts` | Charts |
| `vaul` | Drawer |
| `tw-animate-css` | Animations |
| `sonner` | Toast notifications |
| `react-day-picker` | Calendar |
| `react-resizable-panels` | Resizable panels |
| `embla-carousel-react` | Carousel |
| `input-otp` | OTP input |
| `date-fns` | Date utilities |

## Vite Config (Critical)

`@tailwindcss/vite` plugin MUST be in `vite.config.ts` plugins array. Without it, **zero Tailwind classes are generated**.

## Migration Checklist

- [x] Delete legacy PascalCase UI components
- [x] Update all page imports to shadcn lowercase components
- [x] Update class names: `hsl(var(--x))` → `bg-background`, `text-foreground`, `border-border`
- [x] Add `TooltipProvider` wrapper in App.tsx
- [x] Replace Toaster with shadcn sonner component
- [x] Install tweakcn theme picker (43+ themes with runtime switching)
- [x] Wire `ThemeProvider` + `ThemeSwitcher` into App and Sidebar
- [x] Update SettingsPage with `ThemeSwitcher`
- [ ] Test each page at localhost:1420
- [ ] Apply custom tweakcn theme export (optional)

## tweakcn Theme Picker — Runtime Theme Switching

### Installed Files

| File | Purpose |
|------|---------|
| `src/lib/themes-config.ts` | 43 theme definitions with metadata (name, title, primaryLight, primaryDark, fontSans) |
| `src/components/theme-provider.tsx` | React context provider with `useTheme()` hook, localStorage persistence |
| `src/components/theme-switcher.tsx` | Dropdown UI with theme color picker + light/dark mode toggle |
| `src/styles/themes/index.css` | Imports all 43 theme CSS files |
| `src/styles/themes/*.css` | Individual theme CSS files (e.g., `amber-minimal.css`, `cyberpunk.css`, etc.) |
| `src/components/ui/copy-button.tsx` | Custom copy-to-clipboard button with toast feedback |

### Installation Command

```bash
pnpm dlx shadcn@latest add https://tweakcn-picker.vercel.app/r/vite/theme-system.json
```

### Integration Points

- **`App.tsx`**: Wrapped with `<ThemeProvider>` and `<TooltipProvider>`
- **`Sidebar.tsx`**: `<ThemeSwitcher />` replaces old dark/light toggle button
- **`SettingsPage.tsx`**: `<ThemeSwitcher />` in Appearance section
- **`sonner.tsx`**: Uses `useTheme` from `@/components/theme-provider` (not `next-themes`)

### Available Themes (43)

Default, Amber Minimal, Bold Tech, Bubblegum, Caffeine, Candyland, Catppuccin, Claude, Claymorphism, Clean Slate, Cosmic Night, Cyberpunk, Doom 64, Elegant Luxury, Graphite, Kodama Grove, Midnight Bloom, Mocha Mousse, Modern Minimal, Mono, Nature, Neo Brutalism, Northern Lights, Ocean Breeze, Pastel Dreams, Perpetuity, Quantum Rose, Retro Arcade, Solar Dusk, Starry Night, Supabase, Sunset Horizon, T3 Chat, Tangerine, Twitter, Vercel, Vintage Paper, Twitch, Kick, Spotify, Stripe, GitHub, Windows 98

### How It Works

1. `ThemeProvider` stores theme string (e.g., `amber-minimal-dark`) in localStorage under `tweakcn-theme`
2. Sets `data-theme` attribute on `<html>` element
3. Theme CSS files use `[data-theme="amber-minimal-dark"]` selectors to override CSS variables
4. `ThemeSwitcher` provides dropdown with color theme selection + light/dark toggle
5. Theme persists across sessions via localStorage
