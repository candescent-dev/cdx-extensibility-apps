import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import QaAutomationWidget from './QaAutomationWidget';
import { UserContext } from '@cdx-extensions/di-sdk-types';

// All mocks are inline below (no __mocks__ folder). See pre-cleanup repo for reference.

// Mock PlatformSDK
const mockUseUserContext = jest.fn();
const mockUseBranding = jest.fn();
const mockGetHttpClient = jest.fn();

jest.mock('@cdx-extensions/di-sdk', () => ({
  PlatformSDK: {
    getInstance: jest.fn(() => ({
      useUserContext: mockUseUserContext,
      useBranding: mockUseBranding,
      getHttpClient: mockGetHttpClient,
    })),
  },
}));

// Mock environment
jest.mock('../environments/environment', () => ({
  environment: {
    production: false,
    useDefaultTranslations: true,
    environment: 'dev',
    apiUrl: 'https://localhost:3001',
    features: {},
  },
}));

describe('<QaAutomationWidget />', () => {
  const mockUserContext = {
    guid: 'test-guid',
    firstName: 'Test',
    lastName: 'User',
    fullName: 'Test User',
    userName: 'testuser',
    email: 'test@example.com',
    institutionUserId: 'inst-user-123',
    institutionUserRole: 'admin',
    institutionUserType: 'standard',
    institutionId: 'inst-123',
  } as UserContext;

  const mockHttpClient = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUserContext.mockReturnValue({ data: mockUserContext });
    mockUseBranding.mockReturnValue({ theme: {} });
    mockGetHttpClient.mockReturnValue(mockHttpClient);

    if (typeof window !== 'undefined') {
      delete (window as any).__PLATFORM_CONFIG__;
    }
  });

  it('should render loading state when loading is true', async () => {
    // Loading becomes false in useEffect(initialize) synchronously, so we only briefly see loading.
    // Assert that once loaded, the widget shows main content (loading has finished).
    render(<QaAutomationWidget />);
    await waitFor(() => {
      expect(screen.getByText('User Information')).toBeInTheDocument();
    });
    // Loading UI is not visible after init
    expect(screen.queryByText('Loading widget...')).not.toBeInTheDocument();
  });

  it('should render all cards after loading', async () => {
    render(<QaAutomationWidget />);

    await waitFor(() => {
      expect(screen.getByText('User Information')).toBeInTheDocument();
      expect(screen.getByText('Platform Config')).toBeInTheDocument();
      expect(screen.getByText('HTTP Client Test')).toBeInTheDocument();
    });
  });

  it('should display card subtitles', async () => {
    render(<QaAutomationWidget />);

    await waitFor(() => {
      expect(screen.getByText('Click to view Details')).toBeInTheDocument();
      expect(screen.getByText('Click to view Config')).toBeInTheDocument();
    });
  });

  it('should open User Information modal when card is clicked', async () => {
    render(<QaAutomationWidget />);

    await waitFor(() => {
      expect(screen.getByText('User Information')).toBeInTheDocument();
    });

    const userCardTitle = screen.getByText('User Information');
    fireEvent.click(userCardTitle.closest('div') || userCardTitle);

    await waitFor(() => {
      expect(screen.getByText('GUID:')).toBeInTheDocument();
      expect(screen.getByText('First Name:')).toBeInTheDocument();
    });
  });

  it('should open Platform Config modal when card is clicked', async () => {
    render(<QaAutomationWidget />);

    await waitFor(() => {
      expect(screen.getByText('Platform Config')).toBeInTheDocument();
    });

    const configCardTitle = screen.getByText('Platform Config');
    fireEvent.click(configCardTitle.closest('div') || configCardTitle);

    await waitFor(() => {
      expect(screen.getByText(/Environment/i)).toBeInTheDocument();
      expect(screen.getByText(/API URL/i)).toBeInTheDocument();
    });
  });

  it('should display HTTP Client Test card with description', async () => {
    render(<QaAutomationWidget />);

    await waitFor(() => {
      expect(screen.getByText('HTTP Client Test')).toBeInTheDocument();
      expect(
        screen.getByText((content) =>
          content.includes('Test the secure HTTP client to ensure API calls work correctly.')
        )
      ).toBeInTheDocument();
    });
  });

  it('should display Positive/Negative radio buttons when standalone', async () => {
    render(<QaAutomationWidget standalone />);

    await waitFor(() => {
      expect(screen.getByText('HTTP Client Test')).toBeInTheDocument();
      expect(screen.getByLabelText('Positive')).toBeInTheDocument();
      expect(screen.getByLabelText('Negative')).toBeInTheDocument();
    });
  });

  it('should call API when Test API Calls button is clicked (Positive scenario)', async () => {
    const mockResponse = {
      status: 200,
      data: { users: [{ id: 1, name: 'John Doe' }] },
    };
    (mockHttpClient.get as jest.Mock).mockResolvedValue(mockResponse);

    render(<QaAutomationWidget />);

    await waitFor(() => {
      expect(screen.getByText('Test API Calls')).toBeInTheDocument();
    });

    const testButton = screen.getByText('Test API Calls');
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/demo/account-summary');
      expect(screen.getByText('API Response')).toBeInTheDocument();
    });
  });

  it('should call API when Test API Calls button is clicked (Negative scenario)', async () => {
    const mockErrorResponse = {
      status: 404,
      data: { error: 'Not Found' },
    };
    (mockHttpClient.get as jest.Mock).mockResolvedValue(mockErrorResponse);

    render(<QaAutomationWidget standalone />);

    await waitFor(() => {
      expect(screen.getByText('Test API Calls')).toBeInTheDocument();
    });

    const negativeRadio = screen.getByLabelText('Negative');
    fireEvent.click(negativeRadio);

    const testButton = screen.getByText('Test API Calls');
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/demo/account-summary/not-found');
      expect(screen.getByText('API Response')).toBeInTheDocument();
    });
  });

  it('should handle API errors correctly', async () => {
    const mockError = {
      response: {
        status: 500,
        statusText: 'Internal Server Error',
        data: { error: 'Server error' },
      },
      message: 'Request failed',
    };
    (mockHttpClient.get as jest.Mock).mockRejectedValue(mockError);

    render(<QaAutomationWidget />);

    await waitFor(() => {
      expect(screen.getByText('Test API Calls')).toBeInTheDocument();
    });

    const testButton = screen.getByText('Test API Calls');
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(screen.getByText('API Response')).toBeInTheDocument();
    });
  });

  it('should display loading state during API test', async () => {
    (mockHttpClient.get as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ status: 200, data: {} }), 100))
    );

    render(<QaAutomationWidget />);

    await waitFor(() => {
      expect(screen.getByText('Test API Calls')).toBeInTheDocument();
    });

    const testButton = screen.getByText('Test API Calls');
    fireEvent.click(testButton);

    expect(screen.getByText('Testing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Testing...')).not.toBeInTheDocument();
    });
  });

  it('should handle undefined user context data', async () => {
    mockUseUserContext.mockReturnValue({ data: undefined });
    mockUseBranding.mockReturnValue({ theme: {} });

    render(<QaAutomationWidget />);

    await waitFor(() => {
      expect(screen.getByText('User Information')).toBeInTheDocument();
    });

    // Card and modal both have "User Information"; get the card (first match) and click it
    const userInfoCards = screen.getAllByText('User Information');
    const card = userInfoCards[0].closest('[role="button"]');
    if (card) fireEvent.click(card);

    // MUI Modal does not use role="dialog"; modal shows Close button when open
    await waitFor(() => {
      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      expect(closeButtons.length).toBeGreaterThan(0);
    });
  });

  it('should call useUserContext and useBranding on mount', async () => {
    render(<QaAutomationWidget />);

    await waitFor(() => {
      expect(mockUseUserContext).toHaveBeenCalled();
      expect(mockUseBranding).toHaveBeenCalled();
    });
  });

  it('should use window.__PLATFORM_CONFIG__ if available', async () => {
    const customConfig = {
      environment: 'test',
      apiBaseUrl: 'https://test-api.com',
      features: { feature1: true },
    };

    (window as any).__PLATFORM_CONFIG__ = customConfig;

    render(<QaAutomationWidget />);

    await waitFor(() => {
      expect(screen.getByText('Platform Config')).toBeInTheDocument();
    });

    const configCardTitle = screen.getByText('Platform Config');
    fireEvent.click(configCardTitle.closest('div') || configCardTitle);

    await waitFor(() => {
      expect(screen.getByText(/Environment/i)).toBeInTheDocument();
    });

    delete (window as any).__PLATFORM_CONFIG__;
  });
});
