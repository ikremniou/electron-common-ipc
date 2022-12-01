const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

const webConfig = {
    entry: './test/browser/echo-client/browser-client.ts',
    target: 'web',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: 'browser-client.bundle.js',
        path: path.join(__dirname, 'build', 'browser', 'echo-client'),
    },
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
        new CopyPlugin({
            patterns: [{
                from: './test/browser/echo-client/browser-index.html',
            }]
        })
    ],
};

const preloadConfig = {
    entry: './test/browser/echo-client/browser-preload.ts',
    target: 'electron-renderer',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: 'browser-preload.bundle.js',
        path: path.join(__dirname, 'build', 'browser', 'echo-client'),
    },
};

module.exports = [webConfig, preloadConfig];