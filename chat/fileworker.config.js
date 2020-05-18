const path = require('path');
const webpack = require('webpack');
const Visualizer = require('webpack-visualizer-plugin');
const BrotliPlugin = require('brotli-webpack-plugin');


module.exports = {
    entry: path.resolve(__dirname, "client/src/js/fileWorker.js"),
    output: {
        path: path.resolve(__dirname, "public/js"),
        filename: "fileWorker.js"
    },

    optimization: {
        minimize: false,

    },

 //   plugins: [
 //       new BrotliPlugin({
 //           asset: '[path].br[query]',
 //           test: /\.(js|css|html|svg)$/,
 //           treshold: 10240,
 //           minRatio: 0.8
 //       })
 //   ],

    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                [
                                    "@babel/env",
                                    {
                                        targets: {
                                            edge: "17",
                                            firefox: "60",
                                            chrome: "67",
                                            safari: "9"
                                        },
                                        useBuiltIns: "usage"
                                    }
                                ]
                            ]
                        }
                    }
                ]
            }
        ]
    }

}
