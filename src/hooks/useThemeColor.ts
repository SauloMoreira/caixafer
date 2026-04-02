import { useEffect } from 'react';
import { useCompany } from '@/hooks/useCompany';

/**
 * Convert a hex color string (#rrggbb) to HSL values string "H S% L%"
 * compatible with CSS variables used by the design system.
 */
function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Derive a lighter accent HSL from the base HSL */
function deriveAccent(hsl: string): string {
  const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!parts) return hsl;
  const h = parseInt(parts[1]);
  const s = Math.max(0, parseInt(parts[2]) - 15);
  return `${h} ${s}% 94%`;
}

function deriveAccentForeground(hsl: string): string {
  const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!parts) return hsl;
  const h = parseInt(parts[1]);
  const s = parseInt(parts[2]);
  const l = Math.max(20, parseInt(parts[3]) - 10);
  return `${h} ${s}% ${l}%`;
}

/**
 * Applies the company's theme_color to CSS custom properties on :root.
 * Falls back gracefully — if no theme_color is set, nothing changes.
 */
export function useThemeColor() {
  const { company } = useCompany();

  useEffect(() => {
    const themeColor = company?.theme_color;
    if (!themeColor) return;

    const hsl = hexToHsl(themeColor);
    if (!hsl) return;

    const root = document.documentElement;
    const accent = deriveAccent(hsl);
    const accentFg = deriveAccentForeground(hsl);

    // Primary family
    root.style.setProperty('--primary', hsl);
    root.style.setProperty('--ring', hsl);

    // Accent family
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-foreground', accentFg);

    // Sidebar family
    root.style.setProperty('--sidebar-primary', hsl);
    root.style.setProperty('--sidebar-accent', accent);
    root.style.setProperty('--sidebar-accent-foreground', accentFg);
    root.style.setProperty('--sidebar-ring', hsl);

    return () => {
      // Cleanup: remove overrides so CSS defaults apply again
      const props = [
        '--primary', '--ring',
        '--accent', '--accent-foreground',
        '--sidebar-primary', '--sidebar-accent',
        '--sidebar-accent-foreground', '--sidebar-ring',
      ];
      props.forEach(p => root.style.removeProperty(p));
    };
  }, [company?.theme_color]);
}
