/* eslint-disable */
import type { Config } from 'jest';

const config: Config = {
  displayName: 'mobile-generator-scripts',
  preset: '../jest.preset.js',
  testEnvironment: 'node',
  roots: ['<rootDir>/scripts', '<rootDir>/../templates/mobile/tools/lib'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
    '^.+\\.mjs$': '<rootDir>/mjs-jest-transformer.cjs',
  },
  moduleFileExtensions: ['ts', 'js', 'mjs'],
};

export default config;
