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
      filename: 'main.js',
    },
  },
  css: {
    extract: false,
  },
};