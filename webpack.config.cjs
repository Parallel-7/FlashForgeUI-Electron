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
    'settings-renderer': './src/ui/settings/settings-renderer.ts',
    'auto-connect-choice-renderer': './src/ui/auto-connect-choice/auto-connect-choice-renderer.ts',
    'connect-choice-dialog-renderer': './src/ui/connect-choice-dialog/connect-choice-dialog-renderer.ts',
    'ifs-dialog-renderer': './src/ui/ifs-dialog/ifs-dialog-renderer.ts',
    'input-dialog-renderer': './src/ui/input-dialog/input-dialog-renderer.ts',
    'job-picker-renderer': './src/ui/job-picker/job-picker-renderer.ts',
    'job-uploader-renderer': './src/ui/job-uploader/job-uploader-renderer.ts',
    'log-dialog-renderer': './src/ui/log-dialog/log-dialog-renderer.ts',
    'material-info-dialog-renderer': './src/ui/material-info-dialog/material-info-dialog-renderer.ts',
    'material-matching-dialog-renderer': './src/ui/material-matching-dialog/material-matching-dialog-renderer.ts',
    'printer-connected-warning-renderer': './src/ui/printer-connected-warning/printer-connected-warning-renderer.ts',
    'printer-selection-renderer': './src/ui/printer-selection/printer-selection-renderer.ts',
    'send-cmds-renderer': './src/ui/send-cmds/send-cmds-renderer.ts',
    'single-color-confirmation-dialog-renderer': './src/ui/single-color-confirmation-dialog/single-color-confirmation-dialog-renderer.ts',
    'spoolman-dialog-renderer': './src/ui/spoolman-dialog/spoolman-dialog-renderer.ts',
    'spoolman-offline-dialog-renderer': './src/ui/spoolman-offline-dialog/spoolman-offline-dialog-renderer.ts',
    'status-dialog-renderer': './src/ui/status-dialog/status-dialog-renderer.ts',
    'about-dialog-renderer': './src/ui/about-dialog/about-dialog-renderer.ts',
    'update-available-renderer': './src/ui/update-available/update-available-renderer.ts',
    'palette': './src/ui/palette/palette.ts',
    'shortcut-config-dialog': './src/ui/shortcut-config-dialog/shortcut-config-dialog.ts',
    'lucide': './src/ui/shared/lucide.ts',
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
    modules: ['node_modules', path.resolve(__dirname, 'src')],
    extensionAlias: {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs']
    }
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
