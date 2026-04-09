/**
 * Branding fallbacks for agent-feature.
 *
 * Branding is consumed through PlatformSDK.getInstance().useBranding().
 * In the sandbox, BrandingContext supplies mock data; in production,
 * the host app provides real branding.
 *
 * These fallbacks ensure the UI renders sensibly when branding fields
 * are missing or the platform returns null.
 */
import type { MobileBrandingTheme } from '@cdx-extensions/di-sdk-types';

export const FALLBACK_COLORS = {
  primary: '#1976d2',
  primaryContrast: '#ffffff',
  secondary: '#dc004e',
  background: '#ffffff',
  surface: '#f5f5f5',
  text: '#111827',
  textSecondary: '#666666',
  error: '#f44336',
  warning: '#ff9800',
  success: '#4caf50',
  border: '#e5e7eb',
};

export const SPACING = {
  small: 8,
  medium: 16,
  large: 24,
} as const;

/**
 * Resolve branding-driven colors from a MobileBrandingTheme with
 * hardcoded fallbacks for resilience.
 */
export function resolveColors(theme: MobileBrandingTheme | null) {
  return {
    primary: theme?.colors?.primary?.main ?? FALLBACK_COLORS.primary,
    primaryContrast: theme?.colors?.primary?.contrastText ?? FALLBACK_COLORS.primaryContrast,
    secondary: theme?.colors?.secondary?.main ?? FALLBACK_COLORS.secondary,
    background: theme?.colors?.background?.default ?? FALLBACK_COLORS.background,
    surface: theme?.colors?.background?.paper ?? FALLBACK_COLORS.surface,
    text: theme?.colors?.text?.primary ?? FALLBACK_COLORS.text,
    textSecondary: theme?.colors?.text?.secondary ?? FALLBACK_COLORS.textSecondary,
    error: theme?.colors?.error?.main ?? FALLBACK_COLORS.error,
    warning: theme?.colors?.warning?.main ?? FALLBACK_COLORS.warning,
    success: theme?.colors?.success?.main ?? FALLBACK_COLORS.success,
    border: theme?.colors?.other?.border ?? FALLBACK_COLORS.border,
  };
}

export type ResolvedColors = ReturnType<typeof resolveColors>;
