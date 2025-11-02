/**
 * Webpack configuration for Electron renderer process
 * 
 * This configuration bundles the renderer process code and handles all module
 * resolution, including CommonJS modules from Node.js packages. It targets
 * the electron-renderer environment to enable Node.js integration features.
 */

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  
  // Entry points for renderer and standalone dialog bundles
  entry: {
    renderer: './src/renderer.ts',
    'component-dialog': './src/ui/component-dialog/component-dialog.ts',
  },
  
  // Target electron renderer to enable Node.js module support
  target: 'electron-renderer',
  
  // Output configuration
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: '[name].bundle.js',
    // Only clean in development to prevent removing assets needed for production
    clean: process.env.NODE_ENV === 'development',
    // Ensure consistent path separators across platforms
    publicPath: './'
  },
  
  // Module resolution
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    // Ensure node_modules are resolved correctly
    modules: ['node_modules', path.resolve(__dirname, 'src')]
  },
  
  // TypeScript and other loaders
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.renderer.json'
          }
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpg|gif|svg|ico)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]'
        }
      }
    ]
  },
  
  // Plugins
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
      inject: 'body',
      scriptLoading: 'defer',
      chunks: ['renderer']
    })
  ],
  
  // Development server configuration
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist/renderer')
    },
    compress: true,
    port: 9000,
    hot: true
  },
  
  // Source maps for debugging - disable in production builds for distribution
  devtool: process.env.NODE_ENV === 'production' ? false : 'inline-source-map',
  
  // Node.js polyfills - disable most as we're in electron-renderer
  node: {
    __dirname: false,
    __filename: false
  },
  
  // Externals - don't bundle electron (but DO bundle events)
  externals: {
    electron: 'commonjs electron'
  },
  
  // Optimization settings for production builds
  optimization: {
    // Don't minimize in development for better debugging
    minimize: process.env.NODE_ENV === 'production',
    // Split chunks only if beneficial for caching
    splitChunks: process.env.NODE_ENV === 'production' ? {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        }
      }
    } : false
  },
  
  // Performance hints for production
  performance: {
    hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  }
};
