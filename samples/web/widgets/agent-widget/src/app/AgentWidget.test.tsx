import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PlatformSDK } from '@cdx-extensions/di-sdk';
import AgentWidget from './AgentWidget';
import { agentService } from './components/services/agentService';

// Mock PlatformSDK: define instance inside factory so it exists when mock runs (jest.mock is hoisted)
jest.mock('@cdx-extensions/di-sdk', () => {
  const instance = {
    useUserContext: jest.fn(),
    useBranding: jest.fn(),
    getHttpClient: jest.fn(),
  };
  return {
    PlatformSDK: {
      getInstance: jest.fn(() => instance),
    },
  };
});

// Mock agentService inside factory so no "before initialization" error (jest.mock is hoisted)
jest.mock('./components/services/agentService', () => ({
  agentService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue({
      id: 'msg-1',
      role: 'agent',
      content: 'Mocked agent response',
      timestamp: new Date(),
    }),
    setUserContext: jest.fn(),
    clearConversation: jest.fn(),
    retryLastMessage: jest.fn(),
  },
}));

describe('<AgentWidget />', () => {
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
  };

  const getSdkInstance = () => (PlatformSDK.getInstance as jest.Mock)();

  beforeEach(() => {
    jest.clearAllMocks();
    const sdk = getSdkInstance();
    sdk.useUserContext.mockReturnValue({ data: mockUserContext });
    sdk.useBranding.mockReturnValue({ theme: {} });
    sdk.getHttpClient.mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    });
    jest.mocked(agentService.initialize).mockResolvedValue(undefined);
    jest.mocked(agentService.sendMessage).mockResolvedValue({
      id: 'msg-1',
      role: 'agent',
      content: 'Mocked agent response',
      timestamp: new Date(),
    });
  });

  it('should render loading state then main content after init', async () => {
    render(<AgentWidget />);

    await waitFor(() => {
      expect(screen.getByText('Bring Your Own Agent')).toBeInTheDocument();
    });
    expect(screen.queryByText('Loading agent...')).not.toBeInTheDocument();
  });

  it('should render title and subtitle after loading', async () => {
    render(<AgentWidget />);

    await waitFor(() => {
      expect(screen.getByText('Bring Your Own Agent')).toBeInTheDocument();
      expect(
        screen.getByText('AI-powered assistant integrated with your platform')
      ).toBeInTheDocument();
    });
  });

  it('should display welcome message with user full name when user context is set', async () => {
    render(<AgentWidget />);

    await waitFor(() => {
      expect(screen.getByText(/Welcome, Test User!/)).toBeInTheDocument();
      expect(
        screen.getByText(/The agent has access to your user context/)
      ).toBeInTheDocument();
    });
  });

  it('should render About This Example section', async () => {
    render(<AgentWidget />);

    await waitFor(() => {
      expect(screen.getByText('About This Example')).toBeInTheDocument();
      expect(
        screen.getByText(/All API calls go through the platform's httpClient for security/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/User context is automatically passed to the agent/)
      ).toBeInTheDocument();
    });
  });

  it('should render chat interface with AI Assistant header and welcome message', async () => {
    render(<AgentWidget />);

    await waitFor(() => {
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(
        screen.getByText("Hello! I'm your AI assistant. How can I help you today?")
      ).toBeInTheDocument();
    });
  });

  it('should render chat input and Send button', async () => {
    render(<AgentWidget />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    });
  });

  it('should call useUserContext and useBranding on mount', async () => {
    render(<AgentWidget />);

    await waitFor(() => {
      expect(getSdkInstance().useUserContext).toHaveBeenCalled();
      expect(getSdkInstance().useBranding).toHaveBeenCalledWith('branding-1');
    });
  });

  it('should call agentService.setUserContext when user context is available', async () => {
    render(<AgentWidget />);

    await waitFor(() => {
      expect(screen.getByText('Bring Your Own Agent')).toBeInTheDocument();
    });
    expect(agentService.setUserContext).toHaveBeenCalledWith(mockUserContext);
  });

  it('should call agentService.initialize via ChatInterface', async () => {
    render(<AgentWidget />);

    await waitFor(() => {
      expect(agentService.initialize).toHaveBeenCalled();
    });
  });

  it('should handle undefined user context', async () => {
    getSdkInstance().useUserContext.mockReturnValue({ data: undefined });

    render(<AgentWidget />);

    await waitFor(() => {
      expect(screen.getByText('Bring Your Own Agent')).toBeInTheDocument();
    });
    expect(screen.getByText(/Welcome, !/)).toBeInTheDocument();
  });

  it('should render Clear Chat button in chat header', async () => {
    render(<AgentWidget />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clear Chat' })).toBeInTheDocument();
    });
  });

  it('should send message when user types and clicks Send', async () => {
    render(<AgentWidget />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(agentService.sendMessage).toHaveBeenCalledWith('Hello');
    });

    await waitFor(() => {
      expect(screen.getByText('Mocked agent response')).toBeInTheDocument();
    });
  });

  it('should render with standalone prop (SDK theme path)', async () => {
    render(<AgentWidget standalone />);

    await waitFor(() => {
      expect(screen.getByText('Bring Your Own Agent')).toBeInTheDocument();
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });
    expect(getSdkInstance().useBranding).toHaveBeenCalledWith('branding-1');
  });

  it('should show chat error when agentService.initialize fails', async () => {
    jest.mocked(agentService.initialize).mockRejectedValueOnce(new Error('Init failed'));

    render(<AgentWidget />);

    await waitFor(() => {
      expect(screen.getByText('Failed to initialize agent service')).toBeInTheDocument();
    });
  });
});
