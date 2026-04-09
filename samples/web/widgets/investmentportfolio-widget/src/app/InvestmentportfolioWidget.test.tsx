import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import InvestmentportfolioWidget from './InvestmentportfolioWidget';
import { environment } from '../environments/environment';
import investment from '../__mocks__/investmentMock.json';
import { PlatformSDK } from '@cdx-extensions/di-sdk';

jest.mock('@cdx-extensions/di-sdk', () => {
  const mockGet = jest.fn();
  const mockUseUserContext = jest.fn();
  const mockUseBranding = jest.fn();
  const instance = {
    getHttpClient: () => ({
      get: mockGet,
    }),
    useUserContext: mockUseUserContext,
    useBranding: mockUseBranding,
  };
  return {
    PlatformSDK: {
      getInstance: jest.fn(() => instance),
    },
  };
});

const getSdkInstance = () => (PlatformSDK.getInstance as jest.Mock)();

const getMockGet = () => getSdkInstance().getHttpClient().get as jest.Mock;

const expectedBaseUrl =
  environment.apiUrl || 'https://investmentmock.tiiny.site/investmentMock.json';

function renderWithHostTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>,
  );
}

describe('<InvestmentportfolioWidget />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getMockGet().mockResolvedValue({ data: investment });
    getSdkInstance().useUserContext.mockReturnValue({
      data: { fullName: 'Test User', userName: 'testuser' },
    });
    getSdkInstance().useBranding.mockReturnValue({ theme: {} });
  });

  it('should render portfolio allocation and overview', () => {
    renderWithHostTheme(<InvestmentportfolioWidget />);

    expect(screen.getByText('Portfolio Allocation')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Overview')).toBeInTheDocument();
  });

  it('should render total value from mock portfolio data', () => {
    renderWithHostTheme(<InvestmentportfolioWidget />);

    expect(screen.getByText(/\$175,430\.50/)).toBeInTheDocument();
  });

  it('should render Refresh button', () => {
    renderWithHostTheme(<InvestmentportfolioWidget />);

    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
  });

  it('should render legend with holding symbols from mock data', () => {
    renderWithHostTheme(<InvestmentportfolioWidget />);

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('should render Name label and fullName from user context under Portfolio Overview', () => {
    renderWithHostTheme(<InvestmentportfolioWidget />);

    expect(screen.getByText('Portfolio Overview')).toBeInTheDocument();
    expect(screen.getByText(/Name\s*:/)).toBeInTheDocument();
    expect(screen.getByText(/Test User/)).toBeInTheDocument();
  });

  it('should show N/A for Name when user context is undefined', () => {
    getSdkInstance().useUserContext.mockReturnValue({ data: undefined });
    renderWithHostTheme(<InvestmentportfolioWidget />);

    expect(screen.getByText(/Name\s*:/)).toBeInTheDocument();
    expect(screen.getByText(/N\/A/)).toBeInTheDocument();
  });

  it('should call get with base URL when Refresh button is clicked', async () => {
    renderWithHostTheme(<InvestmentportfolioWidget />);

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(getMockGet()).toHaveBeenCalledWith(expectedBaseUrl);
    });
  });

  it('should update portfolio data when Refresh succeeds', async () => {
    const newTotal = 200000;
    getMockGet().mockResolvedValue({
      data: { ...investment, totalValue: newTotal },
    });
    renderWithHostTheme(<InvestmentportfolioWidget />);

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(screen.getByText(/\$200,000\.00/)).toBeInTheDocument();
    });
  });

  it('should call alert and keep initial data when Refresh fails', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    getMockGet().mockRejectedValue(new Error('Network error'));
    renderWithHostTheme(<InvestmentportfolioWidget />);

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(new Error('Network error'));
    });

    expect(screen.getByText(/\$175,430\.50/)).toBeInTheDocument();
    alertSpy.mockRestore();
  });

  it('should render donut center Total label and formatted total value', () => {
    renderWithHostTheme(<InvestmentportfolioWidget />);

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText(/\$175,430\.50/)).toBeInTheDocument();
  });

  it('should render legend allocation percentages from mock data', () => {
    renderWithHostTheme(<InvestmentportfolioWidget />);

    expect(screen.getByText('6.3%')).toBeInTheDocument();
    expect(screen.getByText('35.5%')).toBeInTheDocument();
  });

  it('should render all holding symbols from mock data in legend', () => {
    renderWithHostTheme(<InvestmentportfolioWidget />);

    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'SPY', 'VTI', 'BND'];
    symbols.forEach(symbol => {
      expect(screen.getByText(symbol)).toBeInTheDocument();
    });
  });

  it('should call useUserContext and useBranding on mount (embedded)', () => {
    renderWithHostTheme(<InvestmentportfolioWidget />);

    expect(getSdkInstance().useUserContext).toHaveBeenCalled();
    expect(getSdkInstance().useBranding).toHaveBeenCalledWith('branding-1');
  });

  it('should render with standalone prop and call useBranding with branding-1', () => {
    render(<InvestmentportfolioWidget standalone />);

    expect(screen.getByText('Portfolio Allocation')).toBeInTheDocument();
    expect(getSdkInstance().useBranding).toHaveBeenCalledWith('branding-1');
  });
});
