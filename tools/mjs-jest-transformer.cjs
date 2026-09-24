const babelJest = require('babel-jest').default;

const transformer = babelJest.createTransformer({
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
});

module.exports = {
  process(sourceText, sourcePath, options) {
    const rewritten = sourceText.replace(
      /import\.meta\.url/g,
      `require('url').pathToFileURL(${JSON.stringify(sourcePath)}).href`,
    );
    return transformer.process(rewritten, sourcePath, options);
  },
};
