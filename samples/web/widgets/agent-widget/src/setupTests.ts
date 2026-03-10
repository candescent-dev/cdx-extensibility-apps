import '@testing-library/jest-dom';
import '@testing-library/react';
import nodeCrypto from 'node:crypto';

// jsdom does not implement crypto.randomUUID; agentService uses it for message IDs
if (typeof globalThis.crypto?.randomUUID !== 'function') {
  globalThis.crypto = globalThis.crypto || {};
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: nodeCrypto.randomUUID.bind(nodeCrypto),
    configurable: true,
    writable: true,
  });
}

// Fixes issue where window.matchMedia is undefined (e.g. in CssBaseline / MUI theme)
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

// jsdom does not implement scrollIntoView; ChatInterface uses it in useEffect
Element.prototype.scrollIntoView = jest.fn();
