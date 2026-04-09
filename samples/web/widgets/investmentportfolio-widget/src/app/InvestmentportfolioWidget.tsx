import React, { useState } from 'react';
import { ThemeProvider, CssBaseline, useTheme } from '@mui/material';
import { createTheme, type Theme } from '@mui/material/styles';
import { PlatformSDK } from '@cdx-extensions/di-sdk';
import { environment } from '../environments/environment';
import investment from '../__mocks__/investmentMock.json';
import type { InvestmentportfolioWidgetProps } from '../types';
import { defaultBranding, type BrandingConfig } from './components/types/branding';

/**
 * Federated module entry point component. This will be the component that is used
 * when displayed as an MFE on a page.
 */

const DEFAULT_BRANDING_ID = 'branding-1';

/** Fixed allocation colors for the donut chart (same as pre-theme sample). */
const DONUT_CHART_COLORS = [
  '#1A6CDA',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

/** Build MUI theme from SDK theme; fallback to minimal theme. */
function resolveTheme(sdkTheme: unknown): Theme {
  if (sdkTheme && typeof sdkTheme === 'object' && Object.keys(sdkTheme as object).length > 0) {
    return createTheme(sdkTheme as object);
  }
  return createTheme({});
}

/** Map MUI theme to BrandingConfig for inline UI. */
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

/** Font metrics from the active MUI theme (host when embedded, SDK when standalone). */
function typographyVariant(
  theme: Theme,
  key: 'caption' | 'body2' | 'subtitle2' | 'h6',
): React.CSSProperties {
  const v = theme.typography[key];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as React.CSSProperties;
  }
  return {};
}

function getPortfolioStyles(
  branding: BrandingConfig,
  muiTheme: Theme,
): { [key: string]: React.CSSProperties } {
  const divider = muiTheme.palette.divider;
  const t = muiTheme.typography;
  const borderRadius = Number.parseFloat(String(muiTheme.shape.borderRadius));
  return {
    container: {
      backgroundColor: branding.colors.background,
      fontFamily: branding.fonts.primary,
      padding: `${branding.spacing.medium}px`,
      borderRadius: '8px',
      border: `1px solid ${divider}`,
      boxShadow: muiTheme.shadows[1],
    },
    subtitle: {
      ...typographyVariant(muiTheme, 'caption'),
      color: branding.colors.textSecondary,
      margin: 0,
    },
    holdingsCard: {
      backgroundColor: 'transparent',
      borderRadius: '0',
      padding: '0',
      overflowX: 'auto',
    },
    viewModeButton: {
      ...typographyVariant(muiTheme, 'body2'),
      fontWeight: t.fontWeightMedium,
      padding: '8px 16px',
      borderRadius: `${Number.isNaN(borderRadius) ? 4 : borderRadius}px`,
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    viewModeButtonActive: {
      fontWeight: t.fontWeightBold,
    },
    chartsContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: `${branding.spacing.medium}px`,
    },
    chartSection: {
      backgroundColor: branding.colors.surface,
      borderRadius: '6px',
      padding: `${branding.spacing.medium}px`,
      border: `1px solid ${divider}`,
    },
    chartTitle: {
      ...typographyVariant(muiTheme, 'subtitle2'),
      color: branding.colors.text,
      margin: 0,
      marginBottom: muiTheme.spacing(1.5),
    },
    donutChartContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginBottom: `${branding.spacing.medium}px`,
    },
    donutChart: {
      margin: '0 auto',
      width: '200px',
      height: '200px',
    },
    donutCenterText: {
      ...typographyVariant(muiTheme, 'body2'),
      fontWeight: t.fontWeightMedium,
      color: branding.colors.textSecondary,
      fill: branding.colors.textSecondary,
    },
    donutCenterValue: {
      ...typographyVariant(muiTheme, 'h6'),
      color: branding.colors.text,
      fill: branding.colors.text,
    },
    legendContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '12px',
      width: '100%',
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    legendColor: {
      width: '12px',
      height: '12px',
      borderRadius: '2px',
      flexShrink: 0,
    },
    legendText: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    },
    legendSymbol: {
      ...typographyVariant(muiTheme, 'subtitle2'),
      color: branding.colors.text,
    },
    legendAllocation: {
      ...typographyVariant(muiTheme, 'caption'),
      color: branding.colors.textSecondary,
    },
  };
}

interface PortfolioData {
  totalValue: number;
  totalValueChange: number;
  totalValueChangePercent: number;
  cashBalance: number;
  investedValue: number;
  dayChange: number;
  dayChangePercent: number;
  holdings: Holding[];
  recentActivity: Activity[];
  performance: PerformanceMetrics;
}

const MOCK_PORTFOLIO_DATA = investment as PortfolioData;

interface Holding {
  symbol: string;
  name: string;
  shares: number;
  currentPrice: number;
  value: number;
  change: number;
  changePercent: number;
  allocation: number;
}

interface Activity {
  id: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'TRANSFER';
  symbol?: string;
  shares?: number;
  price?: number;
  amount?: number;
  date: string;
  time: string;
}

interface PerformanceMetrics {
  oneDay: number;
  oneWeek: number;
  oneMonth: number;
  threeMonths: number;
  sixMonths: number;
  oneYear: number;
  allTime: number;
}

interface PortfolioBodyProps extends InvestmentportfolioWidgetProps {
  muiTheme: Theme;
  userContextData: { fullName?: string } | undefined;
}

function PortfolioBody({ muiTheme, userContextData }: PortfolioBodyProps) {
  const [portfolioData, setPortfolioData] = useState<PortfolioData>(MOCK_PORTFOLIO_DATA);
  const [showHoldings] = useState(true);
  const [viewMode] = useState<'chart' | 'list'>('chart');

  const sdk = PlatformSDK.getInstance();
  const branding = themeToBrandingConfig(muiTheme);
  const styles = getPortfolioStyles(branding, muiTheme);
  const chartColors = DONUT_CHART_COLORS;
  const paperFill = muiTheme.palette.background.paper;
  const primaryContrast = muiTheme.palette.primary.contrastText;

  const baseUrl = environment.apiUrl || 'https://investmentmock.tiiny.site/investmentMock.json';

  /*
   * This function is used to trigger the refresh of the portfolio data
   * It is used to refresh the portfolio data when the user clicks the refresh button
   * For your development please remove this button and add some timer to refresh the portfolio data
   * All external api call should be use this getHttpClient() method to make the api call
   * @function triggerEffect
   * This mockdata is used for only local usage please use the getHttpClient() method to make the api call
   * @returns {void}
   * To run this example in your local machine make this changes in the node_modules/@cdx-extensions/di-sdk-web/dist/httpClient.js
   * file const isMock = false;
   * Remove this line request.headers['Authorization'] = `Bearer ${access_token}`;
   */
  const [triggerEffect, setTriggerEffect] = useState(false);
  if (triggerEffect) {
    sdk
      .getHttpClient()
      .get(baseUrl)
      .then(response => {
        setPortfolioData(response.data);
      })
      .catch(error => {
        alert(error);
        setPortfolioData(MOCK_PORTFOLIO_DATA);
      });
    setTriggerEffect(false);
  }

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const donutChartData = portfolioData.holdings.map((holding, index) => ({
    ...holding,
    color: chartColors[index % chartColors.length],
    angle: (holding.allocation / 100) * 360,
  }));

  let cumulativeAngle = -90;
  const donutSegments = donutChartData.map(item => {
    const startAngle = cumulativeAngle;
    cumulativeAngle += item.angle;
    return {
      ...item,
      startAngle,
      endAngle: cumulativeAngle,
    };
  });

  const getCoordinates = (angle: number, radius: number, center: number) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(radians),
      y: center + radius * Math.sin(radians),
    };
  };

  const createDonutPath = (
    startAngle: number,
    endAngle: number,
    innerRadius: number,
    outerRadius: number,
    center: number,
  ) => {
    const startInner = getCoordinates(startAngle, innerRadius, center);
    const startOuter = getCoordinates(startAngle, outerRadius, center);
    const endInner = getCoordinates(endAngle, innerRadius, center);
    const endOuter = getCoordinates(endAngle, outerRadius, center);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
      'Z',
    ].join(' ');
  };

  return (
    <div style={styles.container}>
      {showHoldings && (
        <div style={styles.holdingsCard}>
          {viewMode === 'chart' ? (
            <div style={styles.chartsContainer}>
              <div style={styles.chartSection}>
                <h3 style={styles.chartTitle}>Portfolio Allocation</h3>
                <p style={styles.subtitle}>Portfolio Overview</p>
                <p style={styles.subtitle}>
                  Name : {userContextData?.fullName ?? 'N/A'}
                </p>
                <div style={styles.donutChartContainer}>
                  <svg width="200" height="200" style={styles.donutChart}>
                    <g transform="translate(100, 100)">
                      {donutSegments.map(segment => (
                        <g key={segment.symbol}>
                          <path
                            d={createDonutPath(segment.startAngle, segment.endAngle, 50, 70, 0)}
                            fill={segment.color}
                            stroke={paperFill}
                            strokeWidth="2"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={e => {
                              e.currentTarget.style.opacity = '0.8';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.opacity = '1';
                            }}
                          />
                        </g>
                      ))}
                      <circle cx="0" cy="0" r="50" fill={paperFill} />
                      <text x="0" y="-10" textAnchor="middle" style={styles.donutCenterText}>
                        Total
                      </text>
                      <text x="0" y="15" textAnchor="middle" style={styles.donutCenterValue}>
                        {formatCurrency(portfolioData.totalValue)}
                      </text>
                    </g>
                  </svg>
                </div>
                <div style={styles.legendContainer}>
                  {donutSegments.map(segment => (
                    <div key={segment.symbol} style={styles.legendItem}>
                      <div
                        style={{
                          ...styles.legendColor,
                          backgroundColor: segment.color,
                        }}
                      />
                      <div style={styles.legendText}>
                        <div style={styles.legendSymbol}>{segment.symbol}</div>
                        <div style={styles.legendAllocation}>{segment.allocation.toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
      <div>
        <button
          id="refresh-button"
          style={{
            ...styles.viewModeButton,
            ...(viewMode === 'chart' ? styles.viewModeButtonActive : {}),
            backgroundColor: viewMode === 'chart' ? branding.colors.primary : branding.colors.surface,
            color: viewMode === 'chart' ? primaryContrast : branding.colors.textSecondary,
            width: '100%',
            marginBlock: '10px',
          }}
          onClick={() => setTriggerEffect(true)}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

function InvestmentportfolioWidgetStandalone(props: InvestmentportfolioWidgetProps) {
  const sdk = PlatformSDK.getInstance();
  const { data: userContextData } = sdk.useUserContext();
  const { theme: sdkTheme } = sdk.useBranding(DEFAULT_BRANDING_ID);
  const muiTheme = resolveTheme(sdkTheme);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <PortfolioBody {...props} muiTheme={muiTheme} userContextData={userContextData} />
    </ThemeProvider>
  );
}

function InvestmentportfolioWidgetEmbedded(props: InvestmentportfolioWidgetProps) {
  const sdk = PlatformSDK.getInstance();
  const { data: userContextData } = sdk.useUserContext();
  sdk.useBranding(DEFAULT_BRANDING_ID);
  const muiTheme = useTheme();

  return <PortfolioBody {...props} muiTheme={muiTheme} userContextData={userContextData} />;
}

const InvestmentportfolioWidget: React.FC<InvestmentportfolioWidgetProps> = props =>
  props.standalone === true ? (
    <InvestmentportfolioWidgetStandalone {...props} />
  ) : (
    <InvestmentportfolioWidgetEmbedded {...props} />
  );

export default InvestmentportfolioWidget;
