// Utility to convert OKLCH colors to HSL format for our theme system
export class OKLCHConverter {
  /**
   * Convert OKLCH color string to HSL format
   * This is a simplified conversion for theme compatibility
   */
  static oklchToHsl(oklchString: string): string {
    // Extract OKLCH values from string like "oklch(0.9818 0.0054 95.0986)"
    const match = oklchString.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
    if (!match) {
      // Fallback for simple values
      if (oklchString === 'oklch(1.0000 0 0)') return '0 0% 100%';
      if (oklchString === 'oklch(0 0 0)') return '0 0% 0%';
      return '0 0% 50%'; // Default fallback
    }

    const [, l, c, h] = match;
    const lightness = parseFloat(l);
    const chroma = parseFloat(c);
    const hue = parseFloat(h);

    // Convert to HSL approximation
    const hslLightness = Math.round(lightness * 100);
    const hslSaturation = Math.round(chroma * 100);
    const hslHue = Math.round(hue);

    return `${hslHue} ${hslSaturation}% ${hslLightness}%`;
  }

  /**
   * Convert Claude theme OKLCH colors to HSL theme config
   */
  static convertClaudeTheme(claudeData: any) {
    const lightColors = claudeData.cssVars.light;
    const darkColors = claudeData.cssVars.dark;

    return {
      light: {
        background: this.oklchToHsl(lightColors.background),
        foreground: this.oklchToHsl(lightColors.foreground),
        card: this.oklchToHsl(lightColors.card),
        'card-foreground': this.oklchToHsl(lightColors['card-foreground']),
        popover: this.oklchToHsl(lightColors.popover),
        'popover-foreground': this.oklchToHsl(lightColors['popover-foreground']),
        primary: this.oklchToHsl(lightColors.primary),
        'primary-foreground': this.oklchToHsl(lightColors['primary-foreground']),
        secondary: this.oklchToHsl(lightColors.secondary),
        'secondary-foreground': this.oklchToHsl(lightColors['secondary-foreground']),
        muted: this.oklchToHsl(lightColors.muted),
        'muted-foreground': this.oklchToHsl(lightColors['muted-foreground']),
        accent: this.oklchToHsl(lightColors.accent),
        'accent-foreground': this.oklchToHsl(lightColors['accent-foreground']),
        destructive: this.oklchToHsl(lightColors.destructive),
        'destructive-foreground': this.oklchToHsl(lightColors['destructive-foreground']),
        border: this.oklchToHsl(lightColors.border),
        input: this.oklchToHsl(lightColors.input),
        ring: this.oklchToHsl(lightColors.ring),
      },
      dark: {
        background: this.oklchToHsl(darkColors.background),
        foreground: this.oklchToHsl(darkColors.foreground),
        card: this.oklchToHsl(darkColors.card),
        'card-foreground': this.oklchToHsl(darkColors['card-foreground']),
        popover: this.oklchToHsl(darkColors.popover),
        'popover-foreground': this.oklchToHsl(darkColors['popover-foreground']),
        primary: this.oklchToHsl(darkColors.primary),
        'primary-foreground': this.oklchToHsl(darkColors['primary-foreground']),
        secondary: this.oklchToHsl(darkColors.secondary),
        'secondary-foreground': this.oklchToHsl(darkColors['secondary-foreground']),
        muted: this.oklchToHsl(darkColors.muted),
        'muted-foreground': this.oklchToHsl(darkColors['muted-foreground']),
        accent: this.oklchToHsl(darkColors.accent),
        'accent-foreground': this.oklchToHsl(darkColors['accent-foreground']),
        destructive: this.oklchToHsl(darkColors.destructive),
        'destructive-foreground': this.oklchToHsl(darkColors['destructive-foreground']),
        border: this.oklchToHsl(darkColors.border),
        input: this.oklchToHsl(darkColors.input),
        ring: this.oklchToHsl(darkColors.ring),
      },
      radius: lightColors.radius || '0.5rem',
    };
  }
}
