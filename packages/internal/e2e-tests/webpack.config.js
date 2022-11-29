const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

const webConfig = {
    mode: 'development',
    entry: './test/browser/echo-client/browser-client.ts',
    devtool: 'inline-source-map',
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
        fallback: {
            'buffer': require.resolve('buffer'),
            'events': require.resolve('events'),
            'path': false,
            'fs': false
        },
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
        new webpack.ProvidePlugin({
            process: 'process/browser',
        }),
        new CopyPlugin({
            patterns: [{
                from: './test/browser/echo-client/browser-index.html',
            }]
        })
    ],
};

const preloadConfig = {
    mode: 'development',
    entry: './test/browser/echo-client/browser-preload.ts',
    devtool: 'inline-source-map',
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