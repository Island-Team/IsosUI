const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = (env = {}) => {
  const target = env.target === 'hosted' ? 'hosted' : 'local';
  return {
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, `dist/${target}`),
      filename: 'assets/[name].[contenthash].js',
      clean: true,
      publicPath: target === 'hosted' ? '/isosui/' : '/',
    },
    resolve: { extensions: ['.ts', '.tsx', '.js'], plugins: [new TsconfigPathsPlugin()] },
    module: { rules: [
      { test: /\.tsx?$/, use: { loader: 'ts-loader', options: { transpileOnly: true } }, exclude: /node_modules/ },
      { test: /\.(png|jpe?g|gif|webp|svg)$/i, type: 'asset/resource', generator: { filename: 'assets/[name].[contenthash][ext]' } },
      { test: /\.(woff2?|ttf|otf|eot)$/, type: 'asset/resource', generator: { filename: 'assets/fonts/[name].[contenthash][ext]' } },
      { test: /\.s?css$/, use: ['style-loader', 'css-loader', { loader: 'sass-loader', options: { sassOptions: { charset: false } } }] },
    ] },
    plugins: [
      new webpack.DefinePlugin({ ISOSUI_TARGET: JSON.stringify(target) }),
      new HtmlWebpackPlugin({ template: './public/index.html', favicon: './src/assets/brand/IslandTeam.png' }),
    ],
    devServer: { historyApiFallback: true, port: 3000 },
    performance: { hints: 'warning', maxAssetSize: 350 * 1024, maxEntrypointSize: 244 * 1024 },
  };
};
