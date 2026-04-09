import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';

import InvestmentportfolioWidget from './app/InvestmentportfolioWidget';
import { PlatformSDK } from '@cdx-extensions/di-sdk';
import { WebPlatform } from '@cdx-extensions/di-sdk-web';

// When running standalone, this app acts as the host and must register the platform.
PlatformSDK.init({ platform: WebPlatform.getInstance() });

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <StrictMode>
    <InvestmentportfolioWidget standalone />
  </StrictMode>
);
