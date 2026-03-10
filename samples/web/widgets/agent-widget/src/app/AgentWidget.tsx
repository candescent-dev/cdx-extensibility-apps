import React, { useEffect, useState } from 'react';
import { ThemeProvider, CssBaseline, useTheme } from '@mui/material';
import { createTheme, type Theme } from '@mui/material/styles';
import { PlatformSDK } from '@cdx-extensions/di-sdk';
import { ChatInterface } from './components/components1/ChatInterface';
import { agentService } from './components/services/agentService';
import { defaultBranding, type BrandingConfig } from './components/types/branding';

const DEFAULT_BRANDING_ID = 'branding-1';

export interface AgentWidgetProps {
  /**
   * true = standalone (e.g. local dev); widget uses SDK theme and its own ThemeProvider.
   * false or omitted = embedded in host; widget accepts host theme and does not inject ThemeProvider.
   */
  standalone?: boolean;
  [key: string]: unknown;
}

/** Build MUI theme from SDK theme; fallback to minimal theme. */
function resolveTheme(sdkTheme: unknown): Theme {
  if (sdkTheme && typeof sdkTheme === 'object' && Object.keys(sdkTheme as object).length > 0) {
    return createTheme(sdkTheme as object);
  }
  return createTheme({});
}

/** Map MUI theme to agent-widget BrandingConfig for existing UI. */
function themeToBrandingConfig(theme: Theme): BrandingConfig {
  const p = theme.palette;
  const t = theme.typography;
  return {
    colors: {
      primary: p.primary?.main ?? defaultBranding.colors.primary,
      secondary: p.secondary?.main ?? defaultBranding.colors.secondary,
      background: p.background?.default ?? defaultBranding.colors.background,
      surface: p.background?.paper ?? defaultBranding.colors.surface,
      text: p.text?.primary ?? defaultBranding.colors.text,
      textSecondary: p.text?.secondary ?? defaultBranding.colors.textSecondary,
      error: p.error?.main ?? defaultBranding.colors.error,
      warning: p.warning?.main ?? defaultBranding.colors.warning,
      success: p.success?.main ?? defaultBranding.colors.success,
    },
    fonts: {
      primary: t.fontFamily ?? defaultBranding.fonts.primary,
      secondary: t.fontFamily ?? defaultBranding.fonts.secondary,
    },
    spacing: defaultBranding.spacing,
  };
}

function ByoaWidget(props: AgentWidgetProps) {
  const standalone = props.standalone === true;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sdk = PlatformSDK.getInstance();
  const { data: userContextData } = sdk.useUserContext();
  const { theme: sdkTheme } = sdk.useBranding(DEFAULT_BRANDING_ID);
  const hostTheme = useTheme();

  // When embedded: use host theme (no ThemeProvider). When standalone: use SDK theme and wrap in ThemeProvider.
  const muiTheme = standalone ? resolveTheme(sdkTheme) : hostTheme;
  const branding = themeToBrandingConfig(muiTheme);
   // Pass user context to agent service when available
   useEffect(() => {
     if (userContextData) {
       agentService.setUserContext(userContextData);
     }
   }, [userContextData]);

   useEffect(() => {
     const initialize = async () => {
       try {
         setLoading(false);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize:', err);
        setError('Failed to load application. Please refresh the page.');
        setLoading(false);
      }
     };

     initialize();
   }, []);

  const loadingOrError = loading ? (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: branding.fonts.primary,
    }}>
      <div>Loading agent...</div>
    </div>
  ) : error ? (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: branding.fonts.primary,
      color: branding.colors.error,
    }}>
      <div>
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    </div>
  ) : null;

  if (loadingOrError) {
    return standalone ? (
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {loadingOrError}
      </ThemeProvider>
    ) : (
      loadingOrError
    );
  }

  const containerStyle: React.CSSProperties = {
    padding: branding.spacing.large,
    maxWidth: '900px',
    margin: '0 auto',
    fontFamily: branding.fonts.primary,
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: branding.spacing.large,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 600,
    color: branding.colors.text,
    marginBottom: branding.spacing.small,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '16px',
    color: branding.colors.textSecondary,
  };

  const infoBoxStyle: React.CSSProperties = {
    padding: branding.spacing.medium,
    backgroundColor: branding.colors.surface,
    borderRadius: '8px',
    marginBottom: branding.spacing.large,
  };

  const content = (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Bring Your Own Agent</h1>
        <p style={subtitleStyle}>
          AI-powered assistant integrated with your platform
        </p>
      </div>

      <div style={infoBoxStyle}>
        <div style={{ fontSize: '14px', color: branding.colors.textSecondary }}>
          <strong>Welcome, {userContextData?.fullName}!</strong>
          The agent has access to your user context and can provide personalized assistance.
        </div>
      </div>

      <ChatInterface branding={branding} />

      <div style={{
        marginTop: branding.spacing.large,
        padding: branding.spacing.medium,
        backgroundColor: branding.colors.surface,
        borderRadius: '8px',
        fontSize: '14px',
        color: branding.colors.textSecondary,
      }}>
        <h3 style={{
          margin: 0,
          marginBottom: branding.spacing.small,
          color: branding.colors.text,
        }}>
          About This Example
        </h3>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>All API calls go through the platform's httpClient for security</li>
          <li>User context is automatically passed to the agent</li>
          <li>Messages are authenticated and validated by the platform</li>
          <li>Agent responses are rendered with custom branding</li>
          <li>Supports conversation history and retry logic</li>
        </ul>
      </div>
    </div>
  );

  return standalone ? (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {content}
    </ThemeProvider>
  ) : (
    content
  );
}

export default ByoaWidget;
