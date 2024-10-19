const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  configureWebpack: {
    plugins: [
      new webpack.DefinePlugin({
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: true,
      }),
    ],
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