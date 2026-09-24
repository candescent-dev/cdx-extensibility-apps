const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const projectNodeModules = path.join(projectRoot, 'node_modules');
const workspaceNodeModules = path.join(workspaceRoot, 'node_modules');
const pnpmNodeModules = path.join(projectNodeModules, '.pnpm', 'node_modules');

function assertSafePackageName(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('Invalid package name');
  }
  if (name.includes('..') || path.isAbsolute(name) || name.includes('\0')) {
    throw new Error(`Unsafe package name: ${name}`);
  }
}

function resolvePackage(name) {
  assertSafePackageName(name);
  const candidates = [
    path.join(projectNodeModules, name),
    path.join(pnpmNodeModules, name),
    path.join(workspaceNodeModules, name),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(projectNodeModules, name);
}

const config = getDefaultConfig(projectRoot);

// Import `.svg` as react-native-svg components (SVGR + Expo transformer chain).
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== 'svg'
);
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

// Make Metro aware of the monorepo/workspace.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  projectNodeModules,
  pnpmNodeModules,
  workspaceNodeModules,
];
config.resolver.disableHierarchicalLookup = true;

// Help Metro resolve hoisted + symlinked workspace deps (including scoped packages).
config.resolver.unstable_enableSymlinks = true;
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (_, name) => {
      assertSafePackageName(name);
      if (name === '@cdx-extensions-examples/agent-feature') {
        return path.join(
          workspaceRoot,
          'samples',
          'mobile',
          'feature',
          'agent-feature'
        );
      }
      if (name === '@cdx-extensions-examples/investment-portfolio') {
        return path.join(
          workspaceRoot,
          'samples',
          'mobile',
          'widgets',
          'investment-portfolio'
        );
      }
      if (name === '@react-native/virtualized-lists') {
        const nested = path.join(
          projectNodeModules,
          'react-native',
          'node_modules',
          '@react-native',
          'virtualized-lists'
        );
        if (fs.existsSync(nested)) {
          return nested;
        }
      }

      return resolvePackage(name);
    },
  }
);

module.exports = config;
