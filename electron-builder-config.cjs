/**
 * Electron Builder Configuration
 *
 * Auto-Update Channel Detection:
 * Extracts the prerelease channel from package.json version to generate
 * the correct update manifest files (e.g., alpha.yml for alpha releases,
 * latest.yml for stable releases). This ensures electron-updater properly
 * separates update channels and prevents alpha users from seeing stable updates.
 */

const packageJson = require('./package.json');

/**
 * Parse prerelease channel from version string.
 * Examples:
 *   "1.0.3"         → null (stable, uses "latest")
 *   "1.0.3-alpha.2" → "alpha"
 *   "1.0.3-beta.1"  → "beta"
 *   "1.0.3-rc.1"    → "rc"
 */
function getUpdateChannel(version) {
  // Match prerelease pattern: major.minor.patch-channel.number
  const prereleaseMatch = version.match(/-([a-zA-Z]+)/);
  if (prereleaseMatch) {
    return prereleaseMatch[1].toLowerCase();
  }
  return null; // Stable release uses default "latest" channel
}

const version = packageJson.version;
const channel = getUpdateChannel(version);
const isPrerelease = channel !== null;

// Log for build debugging
console.log(`[electron-builder] Version: ${version}`);
console.log(`[electron-builder] Channel: ${channel || 'latest'} (prerelease: ${isPrerelease})`);

module.exports = {
  appId: 'com.ghosttypes.flashforgeui',
  productName: 'FlashForgeUI',
  executableName: 'FlashForgeUI',
  copyright: `Copyright © ${new Date().getFullYear()} GhostTypes`,

  // Shared configurations
  directories: {
    output: 'dist',
    buildResources: 'assets',
  },
  asar: true,

  // Optimize web UI assets - only include essential files
  extraResources: [
    {
      from: 'out/webui',
      to: 'webui',
      filter: ['**/*'],
    },
  ],

  files: [
    'out/main/**/*.js',
    'out/preload/**/*.js',
    'out/renderer/**/*',

    // Include icons for platform builds
    'src/icons/**/*',

    'package.json',

    // Exclude (same as JS project)
    '!**/elevate.exe',
    '!**/.git/**',
    '!**/.vscode/**',
    '!**/.idea/**',
    '!**/node_modules/**/{README,CHANGELOG,AUTHORS,CONTRIBUTING}*',
    '!**/node_modules/**/{test,__tests__,tests,powered-test,example,examples}/**',
    '!**/node_modules/**/*.{ts,tsx,d.ts,map}',
    '!**/node_modules/**/.*',
    '!**/node_modules/**/.bin/**',
    '!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}',
    '!**/.*', // Exclude all dot files/folders
    '!**/*.md',
    '!**/docs/**',
    '!**/samples/**',
    '!**/demo/**',
    '!**/*.yml',
    '!**/*.yaml',
    '!**/*.blockmap',

    // Exclude source TypeScript files from the bundle (keep compiled JS)
    '!**/*.ts',
    '!**/tsconfig.json',

    // Exclude test files
    '!**/__tests__/**',
    '!**/*.test.*',
    '!**/*.spec.*',
  ],

  // Publish configuration with dynamic channel
  // - Stable releases (1.0.3): generates latest.yml, latest-mac.yml, latest-linux.yml
  // - Alpha releases (1.0.3-alpha.2): generates alpha.yml, alpha-mac.yml, alpha-linux.yml
  // This allows electron-updater to correctly separate update channels
  publish: [
    {
      provider: 'github',
      owner: 'Parallel-7',
      repo: 'FlashForgeUI-Electron',
      // Channel determines the yml filename (alpha.yml vs latest.yml)
      // null/undefined uses default "latest" channel
      ...(channel && { channel: channel }),
    },
  ],

  // Native module handling
  npmRebuild: false,
  nodeGypRebuild: false,

  // Windows configuration
  win: {
    icon: 'src/icons/icon.ico',

    signAndEditExecutable: true,
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
      {
        target: 'portable',
        arch: ['x64'],
      },
    ],

    // Bundle go2rtc binary for Windows x64
    extraResources: [
      {
        from: 'resources/bin/win32-x64',
        to: 'bin/win32-x64',
        filter: ['go2rtc.exe'],
      },
    ],
  },

  portable: {
    // This ensures the portable executable gets the proper treatment
    requestExecutionLevel: 'user',
  },

  // macOS configuration
  // Note: Using separate x64 and arm64 builds instead of universal to avoid binary
  // merging issues with architecture-specific go2rtc binaries. electron-updater
  // automatically selects the correct architecture from the release manifest.
  mac: {
    icon: 'src/icons/icon.icns',
    category: 'public.app-category.utilities',
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    // Ensure macOS prompts for local network permission (required for Sequoia 15.0+)
    // This triggers the system permission dialog when the app attempts to discover/connect to printers
    extendInfo: {
      NSLocalNetworkUsageDescription:
        'FlashForgeUI requires access to your local network to discover and communicate with FlashForge 3D printers on your network.',
    },

    // Bundle go2rtc binary for current architecture (${arch} is resolved by electron-builder)
    extraResources: [
      {
        from: 'resources/bin/darwin-${arch}',
        to: 'bin/darwin-${arch}',
        filter: ['go2rtc'],
      },
    ],
  },

  // Linux configuration
  linux: {
    icon: 'src/icons/icon.png',
    category: 'Utility',
    target: [
      {
        target: 'AppImage',
        arch: ['x64'],
      },
      {
        target: 'deb',
        arch: ['x64'],
      },
      {
        target: 'rpm',
        arch: ['x64', 'arm64'], // Support both x64 and ARM64 for RPM
      },
    ],
    maintainer: 'GhostTypes',
    vendor: 'GhostTypes',

    // Bundle go2rtc binaries for Linux (x64 and arm64 for RPM)
    extraResources: [
      {
        from: 'resources/bin/linux-x64',
        to: 'bin/linux-x64',
        filter: ['go2rtc'],
      },
      {
        from: 'resources/bin/linux-arm64',
        to: 'bin/linux-arm64',
        filter: ['go2rtc'],
      },
    ],
  },

  // NSIS Windows installer configuration (EXACT same as JS project)
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: true,

    // Ensure shortcuts are created for Windows notification support
    createDesktopShortcut: true,
    createStartMenuShortcut: true,

    // Force standard hyphen-based naming for electron-updater compatibility
    artifactName: '${productName}-Setup-${version}.${ext}',
  },

  // DMG configuration
  dmg: {
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
  },

  // DEB configuration
  deb: {
    afterInstall: 'assets/linux/afterInstall.sh',
    afterRemove: 'assets/linux/afterRemove.sh',
  },

  // RPM configuration
  rpm: {
    afterInstall: 'assets/linux/afterInstall.sh',
    afterRemove: 'assets/linux/afterRemove.sh',
  },
};
