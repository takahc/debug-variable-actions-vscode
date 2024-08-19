const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  configureWebpack: {
    optimization: {
      splitChunks: false,
      runtimeChunk: false,
      minimize: true,
      minimizer: [new TerserPlugin()],
    },
    output: {
      filename: process.env.FILENAME || '../../public/webview/main.js',
    },
  },
  css: {
    extract: false,
  },
};