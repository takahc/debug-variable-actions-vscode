const { resolve } = require('path');
const { HotModuleReplacementPlugin } = require('webpack');
// const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
// const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader')

// Base: https://github.com/tjx666/vscode-webview-webpack-hmr-example

const devServerClientOptions = {
    hot: true,
    // !: 指定构造 WebSocket 的协议是 ws
    protocol: 'ws',
    hostname: 'localhost',
    port: 3000,
    path: 'ws',
};
const devServerClientQuery = Object.entries(devServerClientOptions)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

const webpackHotDevServer = resolve(__dirname, './webpack-hot-dev-server.js');
const devEntries = [
    webpackHotDevServer,
    `webpack-dev-server/client/index.js?${devServerClientQuery}`,
];

/**@type {import('webpack').Configuration}*/
module.exports = {
    module: {
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader',
                options: {
                    // hotReload: true,
                }
            },
            // this will apply to both plain `.js` files
            // AND `<script>` blocks in `.vue` files
            {
                test: /\.js$/,
                loader: 'babel-loader'
            },
            // this will apply to both plain `.css` files
            // AND `<style>` blocks in `.vue` files
            {
                test: /\.css$/,
                use: [
                    'vue-style-loader',
                    'css-loader'
                ]
            }
        ]
    },
    optimization: {
        splitChunks: false,
        runtimeChunk: false,
        minimize: false,
        minimizer: [new TerserPlugin()],
    },
    output: {
        filename: 'main.js',
        publicPath: 'http://localhost:3000/',
        // publicPath: '../dist/',
        path: resolve(__dirname, '../dist'),
    },
    plugins: [
        new VueLoaderPlugin(),
        new HotModuleReplacementPlugin(),
        // new WebpackPublicPathPlugin("http://localhost:8080/"),
        // new ReactRefreshWebpackPlugin(),
    ],
    mode: 'development',
    entry: [
        ...devEntries,
        resolve(__dirname, '../src/main.js'),
    ],
    resolve: {
        extensions: ['.js', '.ts', '.tsx', '.json'],
    },
    devtool: 'eval-source-map',
};
