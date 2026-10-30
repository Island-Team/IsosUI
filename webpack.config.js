const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = (env = {}) => {
  const target = env.target === 'hosted' ? 'hosted' : 'local';
  const host = process.env.ISOSUI_HOST || '127.0.0.1';
  const port = Number(process.env.ISOSUI_PORT || 16001);
  const apiOrigin = process.env.ISOSUI_API_ORIGIN || 'http://127.0.0.1:16000';
  const parsedApi = new URL(apiOrigin);
  if (parsedApi.protocol !== 'http:' || parsedApi.hostname !== '127.0.0.1' ||
      !parsedApi.port || parsedApi.pathname !== '/' || parsedApi.search || parsedApi.hash ||
      parsedApi.username || parsedApi.password) {
    throw new Error('ISOSUI_API_ORIGIN must be http://127.0.0.1:<port>');
  }
  if (host !== '127.0.0.1' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('ISOSUI_HOST must be 127.0.0.1 and ISOSUI_PORT must be a valid port');
  }
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
      new webpack.DefinePlugin({ ISOSUI_TARGET: JSON.stringify(target), ISOSUI_API_ORIGIN: JSON.stringify(apiOrigin) }),
      new HtmlWebpackPlugin({ template: './public/index.html', favicon: './src/assets/brand/IslandTeam.png' }),
    ],
    devServer: { historyApiFallback: true, host, port, allowedHosts: ['127.0.0.1'] },
    performance: { hints: 'warning', maxAssetSize: 350 * 1024, maxEntrypointSize: 244 * 1024 },
  };
};
