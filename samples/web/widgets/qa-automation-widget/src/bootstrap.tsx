import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/QaAutomationWidget';
import { StrictMode } from 'react';

/**
 * This file is only used for local development (standalone app).
 * Theme configuration is shown in standalone mode only.
 */
const StandaloneQaAutomationWidget = () => <App standalone />;

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <StrictMode>
    <StandaloneQaAutomationWidget />
  </StrictMode>
);