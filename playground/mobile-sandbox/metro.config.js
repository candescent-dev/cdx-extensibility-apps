const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Make Metro aware of the monorepo/workspace.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Help Metro resolve hoisted + symlinked workspace deps (including scoped packages).
config.resolver.unstable_enableSymlinks = true;
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (_, name) => {
      // Explicit mapping for our local publishable library (works even if a stale
      // workspace symlink exists after moving folders).
      if (name === '@cdx-extensions-examples/agent-feature') {
        return path.join(
          workspaceRoot,
          'samples',
          'mobile',
          'feature',
          'agent-feature'
        );
      }
      // @react-native/virtualized-lists is nested inside react-native/node_modules;
      // Metro with disableHierarchicalLookup cannot resolve it otherwise.
      if (name === '@react-native/virtualized-lists') {
        return path.join(
          workspaceRoot,
          'node_modules',
          'react-native',
          'node_modules',
          '@react-native',
          'virtualized-lists'
        );
      }

      return path.join(workspaceRoot, 'node_modules', name);
    },
  }
);

module.exports = config;

