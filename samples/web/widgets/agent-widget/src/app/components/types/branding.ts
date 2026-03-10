/**
 * Custom Branding Configuration
 * 
 * Defines the branding structure for the agent widget
 */

export interface BrandingConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    error: string;
    warning: string;
    success: string;
  };
  fonts: {
    primary: string;
    secondary: string;
  };
  spacing: {
    small: number;
    medium: number;
    large: number;
  };
}

export const defaultBranding: BrandingConfig = {
  colors: {
    primary: '#1976d2',
    secondary: '#dc004e',
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#000000',
    textSecondary: '#666666',
    error: '#f44336',
    warning: '#ff9800',
    success: '#4caf50',
  },
  fonts: {
    primary: 'Arial, sans-serif',
    secondary: 'Georgia, serif',
  },
  spacing: {
    small: 8,
    medium: 16,
    large: 24,
  },
};

