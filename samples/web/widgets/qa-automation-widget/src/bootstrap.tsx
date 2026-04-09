import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/QaAutomationWidget';
import { StrictMode } from 'react';
import { PlatformSDK } from '@cdx-extensions/di-sdk';
import { WebPlatform } from '@cdx-extensions/di-sdk-web';

/**
 * This file is only used for local development (standalone app).
 * Theme configuration is shown in standalone mode only.
 * When running standalone, this app acts as the host and must register the platform.
 */
PlatformSDK.init({ platform: WebPlatform.getInstance() });

const StandaloneQaAutomationWidget = () => <App standalone />;

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <StrictMode>
    <StandaloneQaAutomationWidget />
  </StrictMode>
);