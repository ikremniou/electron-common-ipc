const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

const webConfig = {
    entry: {
        ws: './test/internal/clients/browser/ws-browser-client.ts',
        wsi: './test/internal/clients/browser/wsi-browser-client.ts',
        eipc: './test/internal/clients/browser/eipc-browser-client.ts',
    },
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
        filename: '[name]-browser-client.bundle.js',
        path: path.join(__dirname, 'build', 'internal', 'clients', 'browser'),
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: './test/internal/clients/browser/eipc-browser-index.html' },
                { from: './test/internal/clients/browser/wsi-browser-index.html' },
                { from: './test/internal/clients/browser/ws-browser-index.html' }
        ]
        })
    ],
};

const preloadConfig = {
    entry: {
        ws: './test/internal/clients/browser/ws-browser-preload.ts',
        wsi: './test/internal/clients/browser/wsi-browser-preload.ts',
        eipc: './test/internal/clients/browser/eipc-browser-preload.ts',
    },
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
        fallback: {
            buffer: require.resolve('buffer'),
        }
    },
    output: {
        filename: '[name]-browser-preload.bundle.js',
        path: path.join(__dirname, 'build', 'internal', 'clients', 'browser'),
    },
};

module.exports = [webConfig, preloadConfig];