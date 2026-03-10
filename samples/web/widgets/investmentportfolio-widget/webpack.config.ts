import { composePlugins, withNx } from '@nx/webpack';
import { withReact } from '@nx/react';
import { withModuleFederation } from '@nx/react/module-federation';

import baseConfig from './module-federation.config';

const config = {
  ...baseConfig,
};

// Nx plugins for webpack to build config object from Nx options and context.
/**
 * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support Module Federation
 * The DTS Plugin can be enabled by setting dts: true
 * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
 */
// Exclude @cdx-extensions/di-sdk-web from source-map-loader to silence ENOENT warnings (package ships dist only)
function excludeDiSdkWebSourceMaps(webpackConfig: unknown) {
  const config = webpackConfig as { module?: { rules?: Array<{ loader?: string; exclude?: unknown }> } };
  const rules = config.module?.rules ?? [];
  for (const rule of rules) {
    if (typeof rule === 'object' && rule?.loader?.includes?.('source-map-loader')) {
      const exclude = /node_modules[/\\]@cdx-extensions[/\\]di-sdk-web/;
      rule.exclude = Array.isArray(rule.exclude)
        ? [...rule.exclude, exclude]
        : rule.exclude
          ? [rule.exclude, exclude]
          : [exclude];
      break;
    }
  }
  return webpackConfig;
}

export default composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(config, { dts: false }),
  excludeDiSdkWebSourceMaps
);
