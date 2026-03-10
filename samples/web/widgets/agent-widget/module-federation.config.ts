import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  disableNxRuntimeLibraryControlPlugin: true,
  name: 'agent-widget',
  exposes: {
    './AgentWidget': './src/app/AgentWidget',
  },
};

export default config;
