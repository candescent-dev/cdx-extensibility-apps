import '@testing-library/jest-dom';
import '@testing-library/react';

// Optional: jest-axe for accessibility tests (add jest-axe to devDependencies to enable)
try {
  const { configureAxe, toHaveNoViolations } = require('jest-axe');
  expect.extend(toHaveNoViolations);
  (global as any).axe = configureAxe({
    rules: {
      region: { enabled: false },
    },
  });
} catch {
  // jest-axe not installed; skip axe setup
}

// Fixes issue in the CssVarsProvider where window.matchMedia is undefined
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
