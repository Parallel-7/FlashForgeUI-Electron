#!/usr/bin/env node
/**
 * @fileoverview Downloads go2rtc binaries for all supported platforms.
 * Run with: node scripts/download-go2rtc.cjs
 *
 * Downloads go2rtc v1.9.13 binaries from GitHub releases and places them
 * in the resources/bin/{platform}-{arch}/ directories for electron-builder.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VERSION = '1.9.13';
const BASE_URL = `https://github.com/AlexxIT/go2rtc/releases/download/v${VERSION}`;

/**
 * Platform configurations mapping our electron platform-arch to go2rtc release filenames
 */
const PLATFORMS = {
  'darwin-arm64': {
    filename: 'go2rtc_mac_arm64.zip',
    binary: 'go2rtc',
    isZip: true,
  },
  'darwin-x64': {
    filename: 'go2rtc_mac_amd64.zip',
    binary: 'go2rtc',
    isZip: true,
  },
  'linux-arm64': {
    filename: 'go2rtc_linux_arm64',
    binary: 'go2rtc',
    isZip: false,
  },
  'linux-x64': {
    filename: 'go2rtc_linux_amd64',
    binary: 'go2rtc',
    isZip: false,
  },
  'win32-arm64': {
    filename: 'go2rtc_win_arm64.zip',
    binary: 'go2rtc.exe',
    isZip: true,
  },
  'win32-x64': {
    filename: 'go2rtc_win64.zip',
    binary: 'go2rtc.exe',
    isZip: true,
  },
};

/**
 * Follow redirects for HTTPS requests (GitHub uses redirects to CDN)
 */
function httpsGetWithRedirects(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const makeRequest = (currentUrl, redirectsLeft) => {
      const protocol = currentUrl.startsWith('https') ? https : http;

      protocol
        .get(currentUrl, { headers: { 'User-Agent': 'FlashForgeUI-Downloader' } }, (response) => {
          // Handle redirects
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            if (redirectsLeft <= 0) {
              reject(new Error('Too many redirects'));
              return;
            }
            makeRequest(response.headers.location, redirectsLeft - 1);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode} for ${currentUrl}`));
            return;
          }

          resolve(response);
        })
        .on('error', reject);
    };

    makeRequest(url, maxRedirects);
  });
}

/**
 * Download a file to a path
 */
async function downloadFile(url, destPath) {
  console.log(`  Downloading: ${url}`);

  const response = await httpsGetWithRedirects(url);
  const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
  let downloadedBytes = 0;

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    response.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes > 0) {
        const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
        process.stdout.write(`\r  Progress: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`);
      }
    });

    response.pipe(file);

    file.on('finish', () => {
      process.stdout.write('\n');
      file.close();
      resolve();
    });

    file.on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

/**
 * Extract a zip file using native tools
 */
function extractZip(zipPath, destDir) {
  console.log(`  Extracting: ${zipPath}`);

  if (process.platform === 'win32') {
    // Use PowerShell on Windows
    execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, {
      stdio: 'inherit',
    });
  } else {
    // Use unzip on Unix
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
  }
}

/**
 * Make a file executable (Unix only)
 */
function makeExecutable(filePath) {
  if (process.platform !== 'win32') {
    fs.chmodSync(filePath, 0o755);
    console.log(`  Made executable: ${filePath}`);
  }
}

/**
 * Download and setup go2rtc for a specific platform
 */
async function downloadPlatform(platformKey, config, resourcesDir) {
  console.log(`\n[${platformKey}]`);

  const platformDir = path.join(resourcesDir, 'bin', platformKey);
  const binaryPath = path.join(platformDir, config.binary);

  // Check if already downloaded
  if (fs.existsSync(binaryPath)) {
    const stats = fs.statSync(binaryPath);
    console.log(`  Already exists: ${binaryPath} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    return;
  }

  // Create platform directory
  fs.mkdirSync(platformDir, { recursive: true });

  const downloadUrl = `${BASE_URL}/${config.filename}`;

  if (config.isZip) {
    // Download zip, extract, cleanup
    const zipPath = path.join(platformDir, config.filename);
    await downloadFile(downloadUrl, zipPath);
    extractZip(zipPath, platformDir);
    fs.unlinkSync(zipPath); // Remove zip after extraction
  } else {
    // Download directly (Linux binaries are not zipped)
    await downloadFile(downloadUrl, binaryPath);
  }

  // Make executable
  makeExecutable(binaryPath);

  // Verify
  if (fs.existsSync(binaryPath)) {
    const stats = fs.statSync(binaryPath);
    console.log(`  Success: ${binaryPath} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    throw new Error(`Binary not found after download: ${binaryPath}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`\n=== go2rtc Binary Downloader ===`);
  console.log(`Version: v${VERSION}`);
  console.log(`Source: ${BASE_URL}`);

  const projectRoot = path.resolve(__dirname, '..');
  const resourcesDir = path.join(projectRoot, 'resources');

  console.log(`\nResources directory: ${resourcesDir}`);

  // Create resources directory if needed
  fs.mkdirSync(resourcesDir, { recursive: true });

  // Download for all platforms
  const platforms = Object.keys(PLATFORMS);
  let success = 0;
  let failed = 0;

  for (const platformKey of platforms) {
    try {
      await downloadPlatform(platformKey, PLATFORMS[platformKey], resourcesDir);
      success++;
    } catch (error) {
      console.error(`  ERROR: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Downloaded: ${success}/${platforms.length}`);
  if (failed > 0) {
    console.log(`Failed: ${failed}`);
    process.exit(1);
  }

  console.log(`\ngo2rtc binaries are ready in: ${path.join(resourcesDir, 'bin')}`);
}

main().catch((error) => {
  console.error(`\nFatal error: ${error.message}`);
  process.exit(1);
});
