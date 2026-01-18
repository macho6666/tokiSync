const path = require('path');
const webpack = require('webpack');
const fs = require('fs');

// Get version from package.json or hardcoded
const VERSION = '1.1.3';

module.exports = {
  mode: 'production',
  entry: './src/core/main.js',
  output: {
    filename: 'tokiSyncCore.js',
    path: path.resolve(__dirname, 'docs'),
    library: {
      name: 'TokiSyncCore',
      type: 'window', 
      export: 'default', 
    },
    clean: false, // Don't clean root dir!
  },
  optimization: {
    minimize: false, // Keep code readable for debugging (User preference)
  },
  plugins: [
    new webpack.BannerPlugin({
        banner: `// 🚀 TokiSync Core Logic v${VERSION} (Bundled)\n// This file is generated from src/core. Do not edit directly.`,
        raw: true,
        entryOnly: true
    })
  ]
};
