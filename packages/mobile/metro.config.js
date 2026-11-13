// Bundle the shared Magen SDK (../../sdk) and the web app's chain helpers into the phone app.
// Their own imports (@noble/*, @scure/*) resolve from this app's node_modules, so there is one copy of each.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
const shared = [path.resolve(__dirname, '../../sdk'), path.resolve(__dirname, '../../web/src/lib')];
config.watchFolders = shared;
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstream ?? context.resolveRequest;
  if (shared.some(d => context.originModulePath.startsWith(d + path.sep)) && !moduleName.startsWith('.'))
    return resolve({ ...context, originModulePath: path.join(__dirname, 'package.json') }, moduleName, platform);
  return resolve(context, moduleName, platform);
};
module.exports = config;
