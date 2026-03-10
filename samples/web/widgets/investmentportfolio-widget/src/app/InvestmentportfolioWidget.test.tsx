import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InvestmentportfolioWidget from './InvestmentportfolioWidget';
import { environment } from '../environments/environment';
import investment from '../__mocks__/investmentMock.json';

const mockGet = jest.fn();
const mockUseUserContext = jest.fn().mockReturnValue({
  data: { fullName: 'Test User', userName: 'testuser' },
});

jest.mock('@cdx-extensions/di-sdk', () => ({
  PlatformSDK: {
    getInstance: () => ({
      getHttpClient: () => ({
        get: mockGet,
      }),
      useUserContext: mockUseUserContext,
    }),
  },
}));

const expectedBaseUrl =
  environment.apiUrl || 'https://investmentmock.tiiny.site/investmentMock.json';

describe('<InvestmentportfolioWidget />', () => {
  beforeEach(() => {
    mockGet.mockClear();
    mockGet.mockResolvedValue({ data: investment });
    mockUseUserContext.mockReturnValue({
      data: { fullName: 'Test User', userName: 'testuser' },
    });
  });

  it('should render portfolio allocation and overview', () => {
    render(<InvestmentportfolioWidget />);

    expect(screen.getByText('Portfolio Allocation')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Overview')).toBeInTheDocument();
  });

  it('should render total value from mock portfolio data', () => {
    render(<InvestmentportfolioWidget />);

    // Mock data has totalValue 175430.5 -> formatted as currency
    expect(screen.getByText(/\$175,430\.50/)).toBeInTheDocument();
  });

  it('should render Refresh button', () => {
    render(<InvestmentportfolioWidget />);

    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
  });

  it('should render legend with holding symbols from mock data', () => {
    render(<InvestmentportfolioWidget />);

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('should render Name label and fullName from user context under Portfolio Overview', () => {
    render(<InvestmentportfolioWidget />);

    expect(screen.getByText('Portfolio Overview')).toBeInTheDocument();
    expect(screen.getByText(/Name\s*:/)).toBeInTheDocument();
    expect(screen.getByText(/Test User/)).toBeInTheDocument();
  });

  it('should show N/A for Name when user context is undefined', () => {
    mockUseUserContext.mockReturnValue({ data: undefined });
    render(<InvestmentportfolioWidget />);

    expect(screen.getByText(/Name\s*:/)).toBeInTheDocument();
    expect(screen.getByText(/N\/A/)).toBeInTheDocument();
  });

  it('should call get with base URL when Refresh button is clicked', async () => {
    render(<InvestmentportfolioWidget />);

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(expectedBaseUrl);
    });
  });

  it('should update portfolio data when Refresh succeeds', async () => {
    const newTotal = 200000;
    mockGet.mockResolvedValue({
      data: { ...investment, totalValue: newTotal },
    });
    render(<InvestmentportfolioWidget />);

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(screen.getByText(/\$200,000\.00/)).toBeInTheDocument();
    });
  });

  it('should call alert and keep initial data when Refresh fails', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    mockGet.mockRejectedValue(new Error('Network error'));
    render(<InvestmentportfolioWidget />);

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(new Error('Network error'));
    });

    expect(screen.getByText(/\$175,430\.50/)).toBeInTheDocument();
    alertSpy.mockRestore();
  });

  it('should render donut center Total label and formatted total value', () => {
    render(<InvestmentportfolioWidget />);

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText(/\$175,430\.50/)).toBeInTheDocument();
  });

  it('should render legend allocation percentages from mock data', () => {
    render(<InvestmentportfolioWidget />);

    // AAPL allocation 6.29 -> toFixed(1) = "6.3%"
    expect(screen.getByText('6.3%')).toBeInTheDocument();
    // SPY allocation 35.52 -> "35.5%"
    expect(screen.getByText('35.5%')).toBeInTheDocument();
  });

  it('should render all holding symbols from mock data in legend', () => {
    render(<InvestmentportfolioWidget />);

    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'SPY', 'VTI', 'BND'];
    symbols.forEach((symbol) => {
      expect(screen.getByText(symbol)).toBeInTheDocument();
    });
  });
});
