import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  disableNxRuntimeLibraryControlPlugin: true,
  name: 'qa-automation-widget',
  exposes: {
    './QaAutomationWidget': './src/app/QaAutomationWidget',
  },
};

export default config;
