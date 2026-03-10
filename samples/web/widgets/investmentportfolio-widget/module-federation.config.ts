import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  disableNxRuntimeLibraryControlPlugin: true,
  name: 'investmentportfolio-widget',
  exposes: {
    './InvestmentportfolioWidget': './src/app/InvestmentportfolioWidget',
  },
};

export default config;
