/**
 * QA Automation Widget Example
 *
 * Demonstrates using the CDX Web Harness SDK to build a QA automation widget
 * that displays user information and makes API calls.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Typography,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import { createTheme, Theme } from '@mui/material/styles';
import { PlatformSDK } from '@cdx-extensions/di-sdk';
import { environment as env } from '../environments/environment';
import { SimpleCard, HttpClientTestCard, ApiResponseCard } from './components/Cards';
import { UserInfoModal, PlatformConfigModal } from './components/Modals';
import { BrandingSelector, type BrandingOption } from './components/BrandingSelector';
import WidgetContainer from './components/WidgetContainer';
import { PersonOutlineIcon, ManufacturingIcon } from './components/Icons';

export interface QaAutomationWidgetProps {
  label?: string;
  date?: number;
  /**
   * true = standalone widget render (e.g. local dev via bootstrap); shows theme/branding selector.
   * false = embedded in host app; must be false so widget uses host theme and hides standalone-only UI.
   * Omit or falsy when embedded; pass true only for standalone.
   */
  standalone?: boolean;
  [key: string]: unknown;
}

/**
 * Returns a valid MUI theme for standalone mode: SDK theme or minimal default.
 */
function resolveThemeStandalone(sdkTheme: any): Theme {
  if (sdkTheme && typeof sdkTheme === 'object' && Object.keys(sdkTheme).length > 0) {
    return createTheme(sdkTheme);
  }
  return createTheme({});
}

/**
 * Platform configuration interface
 * @interface PlatformConfig
 * @property {string} environment - The current environment (e.g., 'dev', 'prod')
 * @property {string} apiBaseUrl - The base URL for API calls
 * @property {Record<string, boolean>} features - Feature flags configuration
 */
interface PlatformConfig {
  environment: string;
  apiBaseUrl: string;
  features: Record<string, boolean>;
}

/**
 * Gets platform configuration from environment file or runtime override.
 * Runtime override from window.__PLATFORM_CONFIG__ takes highest priority.
 *
 * @returns {PlatformConfig} The platform configuration object
 * @example
 * const config = getConfig();
 * console.log(config.environment); // 'dev' or 'prod'
 */
const getConfig = (): PlatformConfig => {
  // Check for runtime override from parent app (highest priority)
  if (typeof window !== 'undefined' && (window as any).__PLATFORM_CONFIG__) {
    const injectedConfig = (window as any).__PLATFORM_CONFIG__;
    return {
      environment: injectedConfig.environment || env.environment,
      apiBaseUrl: injectedConfig.apiBaseUrl || env.apiUrl,
      features: injectedConfig.features || env.features,
    };
  }

  // Use environment file configuration
  return {
    environment: env.environment,
    apiBaseUrl: env.apiUrl,
    features: env.features,
  };
};

/**
 * Static branding options for the theme selector (standalone mode).
 * @returns {BrandingOption[]} Available branding options
 */
function getStaticBrandingOptions(): BrandingOption[] {
  return [
    { id: 'branding-1', name: 'Classic Blue' },
    { id: 'branding-2', name: 'Purple Elegance' },
    { id: 'branding-3', name: 'Ocean Blue' },
    { id: 'branding-4', name: 'Forest Green' },
    { id: 'branding-5', name: 'Crimson Red' },
  ];
}

/**
 * QA Automation Widget component
 *
 * Demonstrates using the CDX Web Harness SDK to build a QA automation widget
 * that displays user information, platform configuration, and makes secure
 * API calls for testing purposes.
 *
 * @component
 * @returns {JSX.Element} The QA Automation Widget
 *
 * @example
 * ```tsx
 * <QAAutomationWidget />
 * <QAAutomationWidget standalone />  // shows theme config (standalone app)
 * ```
 */
export const QAAutomationWidget: React.FC<QaAutomationWidgetProps> = (props) => {
  // true only when explicitly true (standalone render); false when embedded or omitted
  const standalone = props.standalone === true;
  const widgetRootRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<string>('');
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [testRequestUrl, setTestRequestUrl] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [scenarioType, setScenarioType] = useState<'Positive' | 'Negative'>('Positive');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPlatformConfigModal, setShowPlatformConfigModal] = useState(false);
  const [selectedBranding, setSelectedBranding] = useState<string>('branding-1');
  const [brandingOptions, setBrandingOptions] = useState<BrandingOption[]>([]);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const sdk = PlatformSDK.getInstance();
  const { data: userContextData } = sdk.useUserContext();
  const { theme: sdkTheme } = sdk.useBranding(selectedBranding);
  // When embedded: no ThemeProvider so widget and icons inherit from host. When standalone: use our ThemeProvider.
  const theme = standalone ? resolveThemeStandalone(sdkTheme) : null;

  useEffect(() => {
    initialize();
  }, []);

  /**
   * Initializes the widget by loading platform config and static branding options
   * @async
   * @function initialize
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   */
  const initialize = async () => {
    try {
      console.log('[QAAutomationWidget] Initializing...');

      const platformConfig = getConfig();
      setConfig(platformConfig);
      setBrandingOptions(getStaticBrandingOptions());
      setLoading(false);
    } catch (error) {
      console.error('[QAAutomationWidget] Initialization error:', error);
      alert('Failed to initialize widget');
      setLoading(false);
    }
  };

  /**
   * Tests the HTTP client by making a Mock API call using Mock getHttpClient().
   * Supports both positive and negative test scenarios with real mock responses.
   *
   * @async
   * @function testApiCall
   * @returns {Promise<void>}
   *
   * @description
   * - Positive scenario: Makes a successful Mock API call to /api/users and displays the response
   * - Negative scenario: Makes a call to an endpoint that returns an error (404 or 500)
   */
  const testApiCall = async () => {
    setTestLoading(true);
    setTestResult('');
    setTestResponse(null);
    setTestStatus(null);
    setTestRequestUrl(null);

    try {
      console.log('[QAAutomationWidget] Testing API call...');

      // Get the HTTP client instance from WebPlatform
      const client = sdk.getHttpClient();

      // When embedded (e.g. dbk-ui-platform), only positive API calls are allowed
      const effectiveScenario = standalone ? scenarioType : 'Positive';
      const endpoint =
        effectiveScenario === 'Negative'
          ? '/api/demo/account-summary/not-found' // Returns 404 error
          : '/api/demo/account-summary'; // Returns 200 with account summary data

      setTestRequestUrl(endpoint);
      const response = await client.get(endpoint);

      // For successful responses (Positive scenario)
      setTestStatus(response.status);
      if (response.status >= 200 && response.status < 300) {
        setTestResponse(response.data);
        setTestResult('success');
        setToast({
          open: true,
          message: `API call successful (${response.status})`,
          severity: 'success',
        });
        console.log('[QAAutomationWidget] API response:', response);
      } else {
        setTestResponse(response.data);
        setTestResult('error');
        setToast({
          open: true,
          message: `API call failed (${response.status})`,
          severity: 'error',
        });
        console.log('[QAAutomationWidget] API error response:', response);
      }
    } catch (error: any) {
      const status = error.response?.status ?? error.status ?? null;
      setTestStatus(status);
      setTestResult('error');
      setToast({
        open: true,
        message: status != null ? `API call failed (${status})` : `API call failed: ${error.message || 'Unknown error'}`,
        severity: 'error',
      });
      // Extract error details from the axios error response
      const errorResponse = error.response?.data ||
        error.data || {
          error: error.message || 'Unknown error',
          status: error.response?.status || error.status,
          statusText: error.response?.statusText || error.statusText,
        };
      setTestResponse(errorResponse);
      console.error('[QAAutomationWidget] API error:', error);
    } finally {
      setTestLoading(false);
    }
  };

  /**
   * Formats a JavaScript object or value into a formatted JSON string with indentation
   *
   * @function formatJSON
   * @param {any} obj - The object or value to format
   * @param {number} [indent=0] - The current indentation level
   * @returns {string} Formatted JSON string
   *
   * @example
   * formatJSON({ name: 'John', age: 30 })
   * // Returns:
   * // {
   * //   "name": "John",
   * //   "age": 30
   * // }
   */
  const formatJSON = (obj: any, indent = 0): string => {
    const spaces = '  '.repeat(indent);
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj === 'string') return `"${obj}"`;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      const items = obj.map((item, index) => {
        const formatted = formatJSON(item, indent + 1);
        return `${spaces}  ${formatted}${index < obj.length - 1 ? ',' : ''}`;
      });
      return `[\n${items.join('\n')}\n${spaces}]`;
    }

    // Check if obj is actually an object before calling Object.entries
    if (typeof obj !== 'object' || obj === null) {
      return String(obj);
    }

    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([key, value], index) => {
      const formatted = formatJSON(value, indent + 1);
      const comma = index < entries.length - 1 ? ',' : '';
      return `${spaces}  "${key}": ${formatted}${comma}`;
    });
    return `{\n${lines.join('\n')}\n${spaces}}`;
  };

  /**
   * Handles branding selection change
   *
   * @param brandingId - The ID of the newly selected branding
   */
  const handleBrandingChange = (brandingId: string) => {
    setSelectedBranding(brandingId);
  };

  const loadingContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <CircularProgress />
      <Typography variant="body1" sx={{ mt: 2 }} color="text.secondary">
        Loading widget...
      </Typography>
    </Box>
  );

  if (loading) {
    return theme ? (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {loadingContent}
      </ThemeProvider>
    ) : (
      loadingContent
    );
  }

  const mainContent = (
    <>
      <Box
        ref={widgetRootRef}
        sx={{
          width: '100%',
          minHeight: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          fontFamily: 'inherit',
        }}
      >
        <WidgetContainer standalone={standalone}>
          {standalone && (
            <BrandingSelector
              selectedBranding={selectedBranding}
              onBrandingChange={handleBrandingChange}
              brandingOptions={brandingOptions}
            />
          )}
        {/* User Information Card */}
        <SimpleCard
          title="User Information"
          subtitle="Click to view Details"
          icon={<PersonOutlineIcon width={24} height={24} />}
          onClick={() => setShowUserModal(true)}
        />

        {/* Platform Config Card */}
        <SimpleCard
          title="Platform Config"
          subtitle="Click to view Config"
          icon={<ManufacturingIcon width={24} height={24} />}
          onClick={() => setShowPlatformConfigModal(true)}
        />

        {/* Middle Section: HTTP Client Test Card */}
        <HttpClientTestCard
          scenarioType={scenarioType}
          onScenarioChange={setScenarioType}
          onTestClick={testApiCall}
          testLoading={testLoading}
          showNegativeScenario={standalone}
          showScenarioSelector={standalone}
        />

        {/* API Response Card - Appears after HTTP Client Test */}
        {(testResult === 'success' || testResult === 'error') && testResponse && (
          <ApiResponseCard
            testResult={testResult}
            testResponse={testResponse}
            statusCode={testStatus}
            requestUrl={testRequestUrl}
            requestMethod="GET"
            onClose={() => {
              setTestResult('');
              setTestResponse(null);
              setTestStatus(null);
              setTestRequestUrl(null);
            }}
            formatJSON={formatJSON}
          />
        )}
        </WidgetContainer>

      {/* User Information Modal - container anchors modal to widget root when embedded in host */}
      {showUserModal && (
        <UserInfoModal
          user={userContextData}
          onClose={() => setShowUserModal(false)}
          container={widgetRootRef.current}
        />
      )}

      {/* Platform Config Modal - container anchors modal to widget root when embedded in host */}
      {showPlatformConfigModal && (
        <PlatformConfigModal
          config={config}
          onClose={() => setShowPlatformConfigModal(false)}
          container={widgetRootRef.current}
        />
      )}

      {/* Success/Error toast after API test */}
      <Snackbar
        open={toast.open}
        autoHideDuration={1000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
      </Box>
    </>
  );

  return theme ? (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {mainContent}
    </ThemeProvider>
  ) : (
    mainContent
  );
};

export default QAAutomationWidget;
