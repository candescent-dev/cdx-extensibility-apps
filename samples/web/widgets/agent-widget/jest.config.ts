/* eslint-disable */
export default {
  displayName: 'agent-widget',
  preset: '../../../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../../coverage/samples/web/widgets/agent-widget',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
};
