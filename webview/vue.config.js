const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');


module.exports = {
  devServer: {
    port: 8080,
    static: {
      directory: path.join(__dirname, 'dist'),
      publicPath: "http://localhost:8080/"
    },
    hot: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  configureWebpack: {
    optimization: {
      splitChunks: false,
      runtimeChunk: false,
      minimize: false,
      minimizer: [new TerserPlugin()],
    },
    output: {
      filename: '../../public/webview/main.js',
    },
  },
  css: {
    extract: false,
  },
};