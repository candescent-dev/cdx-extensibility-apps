import { agentService } from './agentService';

// Mock httpClient from sdk
const mockPost = jest.fn();
jest.mock('../src/sdk', () => ({
  httpClient: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

describe('agentService', () => {
  const mockRandomUUID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

  beforeEach(async () => {
    jest.clearAllMocks();
    agentService.clearConversation();
    await agentService.initialize();
    agentService.setUserContext({
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
    });

    // Mock crypto.randomUUID for deterministic message IDs (globalThis.crypto for jsdom compatibility)
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(mockRandomUUID);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateMessageId (via sendMessage)', () => {
    it('should generate message IDs using crypto.randomUUID (cryptographically secure)', async () => {
      mockPost.mockResolvedValue({
        data: {
          message: 'Test response',
          conversationId: 'conv-123',
          metadata: {},
        },
        status: 200,
        statusText: 'OK',
        headers: {},
      });

      const message = await agentService.sendMessage('Hello');

      expect(globalThis.crypto.randomUUID).toHaveBeenCalled();
      expect(message.id).toMatch(/^msg_\d+_[a-f0-9]{9}$/);
      // With mocked UUID "a1b2c3d4-e5f6-4789-a012-3456789abcde", the 9-char suffix (no dashes) is "a1b2c3d4e"
      expect(message.id).toContain('a1b2c3d4e');
    });

    it('should generate unique message IDs for user and agent messages', async () => {
      mockPost.mockResolvedValue({
        data: {
          message: 'Response',
          conversationId: 'conv-123',
          metadata: {},
        },
        status: 200,
        statusText: 'OK',
        headers: {},
      });

      const agentMessage = await agentService.sendMessage('Hi');
      const history = agentService.getConversationHistory();

      const userMessage = history.find(m => m.role === 'user');
      expect(userMessage?.id).toMatch(/^msg_\d+_[a-f0-9]{9}$/);
      expect(agentMessage.id).toMatch(/^msg_\d+_[a-f0-9]{9}$/);
    });
  });
});
