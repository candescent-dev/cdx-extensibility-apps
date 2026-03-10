import { composePlugins, withNx } from '@nx/webpack';
import { withReact } from '@nx/react';
import { withModuleFederation } from '@nx/react/module-federation';
import type { Configuration } from 'webpack';

import baseConfig from './module-federation.config';

const config = {
  ...baseConfig,
};

// Custom webpack configuration to handle SVG imports as URLs
function addSvgUrlSupport(config: Configuration): Configuration {
  if (!config.module) {
    config.module = { rules: [] };
  }
  
  const rules = config.module.rules || [];
  
  // Create a rule for SVG files with ?url query parameter
  // This must be processed before any other SVG rules
  const svgUrlRule = {
    test: /\.svg$/,
    resourceQuery: /url/,
    type: 'asset/resource',
    // Let webpack handle the filename to avoid conflicts
  };

  // Find and modify existing SVG rules to exclude ?url queries
  rules.forEach((rule: any, index: number) => {
    if (rule && typeof rule === 'object' && rule.test && rule.test.toString().includes('svg')) {
      // If rule doesn't have resourceQuery, add one to exclude ?url
      if (!rule.resourceQuery) {
        rule.resourceQuery = { not: /url/ };
      }
    }
  });

  // Add our rule at the beginning to ensure it's processed first
  rules.unshift(svgUrlRule);

  return config;
}

// Nx plugins for webpack to build config object from Nx options and context.
/**
 * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support Module Federation
 * The DTS Plugin can be enabled by setting dts: true
 * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
 */
export default composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(config, { dts: false }),
  addSvgUrlSupport
);
