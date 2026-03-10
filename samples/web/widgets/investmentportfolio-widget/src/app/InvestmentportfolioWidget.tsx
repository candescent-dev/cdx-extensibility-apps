import React, { useState } from 'react';
import { PlatformSDK } from '@cdx-extensions/di-sdk';
import { environment } from '../environments/environment';
import investment from '../__mocks__/investmentMock.json';

/**
 * Federated module entry point component. This will be the component that is used
 * when displayed as an MFE on a page.
 * @returns {typeof InvestmentportfolioWidget} Main MFE entry component
 */


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

// Mock Investment Portfolio Data
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

const InvestmentportfolioWidget: React.FC = () => {
  const [portfolioData, setPortfolioData] = useState<PortfolioData>(MOCK_PORTFOLIO_DATA);
  const [showHoldings] = useState(true);
  const [viewMode] = useState<'chart' | 'list'>('chart');


  const sdk = PlatformSDK.getInstance();
  const { data: userContextData } = sdk.useUserContext();

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
    if(triggerEffect){
    sdk
      .getHttpClient()
      .get(baseUrl)
      .then((response) => {
        setPortfolioData(response.data);
      })
      .catch((error) => {
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

  // Color palette for charts
  const chartColors = [
    '#1A6CDA',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#84CC16',
  ];

  // Calculate donut chart data
  const donutChartData = portfolioData.holdings.map((holding, index) => ({
    ...holding,
    color: chartColors[index % chartColors.length],
    angle: (holding.allocation / 100) * 360,
  }));

  // Calculate cumulative angles for donut chart
  let cumulativeAngle = -90; // Start at top
  const donutSegments = donutChartData.map(item => {
    const startAngle = cumulativeAngle;
    cumulativeAngle += item.angle;
    return {
      ...item,
      startAngle,
      endAngle: cumulativeAngle,
    };
  });

  // Helper function to convert angle to coordinates
  const getCoordinates = (angle: number, radius: number, center: number) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(radians),
      y: center + radius * Math.sin(radians),
    };
  };

  // Create path for donut segment
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
       
         
      {/* Holdings Charts */}
      {showHoldings && (
        <div style={styles.holdingsCard}>
          {/* View Mode Toggle */}
          

          {viewMode === 'chart' ? (
            <div style={styles.chartsContainer}>
                 
              {/* Donut Chart for Allocation */}
              <div style={styles.chartSection}>
                <h3 style={styles.chartTitle}>Portfolio Allocation</h3>
                <p style={styles.subtitle}>Portfolio Overview</p>
                <p style={styles.subtitle}>
                  Name : {userContextData?.fullName ?? 'N/A'}
                </p>
                <div style={styles.donutChartContainer}>
                  <svg width="200" height="200" style={styles.donutChart}>
                    <g transform="translate(100, 100)">
                      {donutSegments.map((segment, index) => (
                        <g key={segment.symbol}>
                          <path
                            d={createDonutPath(segment.startAngle, segment.endAngle, 50, 70, 0)}
                            fill={segment.color}
                            stroke="#ffffff"
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
                      <circle cx="0" cy="0" r="50" fill="#ffffff" />
                      <text x="0" y="-10" textAnchor="middle" style={styles.donutCenterText}>
                        Total
                      </text>
                      <text x="0" y="15" textAnchor="middle" style={styles.donutCenterValue}>
                        {formatCurrency(portfolioData.totalValue)}
                      </text>
                    </g>
                  </svg>
                </div>
                {/* Legend */}
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
            <button id="refresh-button"
              style={{
                ...styles.viewModeButton,
                ...(viewMode === 'chart' ? styles.viewModeButtonActive : {}),
                backgroundColor:
                  viewMode === 'chart' ? '#1A6CDA' : '#f0f0f0',
                color: viewMode === 'chart' ? '#ffffff' : '#656565',
                width: '100%',
                marginBlock: '10px',
              }}
              onClick={(app) => setTriggerEffect(true)}
            >
              Refresh 
            </button>
           
          </div>
    </div>
    
  );
};



const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#ffffff',
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
  },
  subtitle: {
    fontSize: '12px',
    color: '#656565',
    margin: 0,
  },
  holdingsCard: {
    backgroundColor: 'transparent',
    borderRadius: '0',
    padding: '0',
    overflowX: 'auto',
  },
  viewModeButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  viewModeButtonActive: {
    fontWeight: 600,
  },
  chartsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  chartSection: {
    backgroundColor: '#fafafa',
    borderRadius: '6px',
    padding: '16px',
    border: '1px solid #e0e0e0',
  },
  chartTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#212121',
    margin: 0,
    marginBottom: '12px',
  },
  donutChartContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '16px',
  },
  donutChart: {
    margin: '0 auto',
    width: '200px',
    height: '200px',
  },
  donutCenterText: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#656565',
    fill: '#656565',
  },
  donutCenterValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#212121',
    fill: '#212121',
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
    fontSize: '14px',
    fontWeight: 600,
    color: '#212121',
  },
  legendAllocation: {
    fontSize: '12px',
    color: '#656565',
  },
};

export default InvestmentportfolioWidget;
