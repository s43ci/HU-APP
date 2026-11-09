const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// pdf-lib depends on tslib; its ESM wrapper ("import" condition) breaks in the web bundle
// ("Cannot destructure property '__extends'"). Always use tslib's plain ES build.
const tslib = path.join(__dirname, 'node_modules/tslib/tslib.es6.js');
const resolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') return { type: 'sourceFile', filePath: tslib };
  return (resolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
