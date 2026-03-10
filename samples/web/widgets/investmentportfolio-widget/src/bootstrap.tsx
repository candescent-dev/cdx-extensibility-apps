import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';

import InvestmentportfolioWidget from './app/InvestmentportfolioWidget';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <StrictMode>
    <InvestmentportfolioWidget />
  </StrictMode>
);
