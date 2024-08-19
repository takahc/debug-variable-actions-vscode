const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const { resolve } = require('path');

const devConfig = require('./webpack.config');

function start() {
    console.log("Starting the development server...\n");
    const compiler = webpack(devConfig);
    const devServerOptions = {
        hot: false,
        client: false,
        liveReload: false,
        host: 'localhost',
        port: 3000,
        open: false,
        devMiddleware: {
            stats: 'minimal',
        },
        allowedHosts: 'all',
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
        static: {
            directory: resolve(__dirname, "../dist"),
            publicPath: 'http://localhost:3000/',
        },
    };
    const server = new WebpackDevServer(devServerOptions, compiler);
    server.start();
}

start();
