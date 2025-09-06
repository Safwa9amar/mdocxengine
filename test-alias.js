// test-alias.js
const tsConfigPaths = require('tsconfig-paths');
const baseUrl = 'src';
const cleanup = tsConfigPaths.register({
  addMatchAll : true,
  baseUrl,
  paths: {
    "@/*": ["*"]
  }
});

console.log(require.resolve('@/utils/Logger.ts'));
cleanup();
