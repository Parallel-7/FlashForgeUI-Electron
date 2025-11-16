#!/usr/bin/env node

/**
 * Copy WebUI static assets from source to build output directory.
 * 
 * This script copies HTML, CSS, and other static files from src/webui/static/
 * to dist/webui/static/ as part of the webui build process.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const srcDir = 'src/webui/static';
const destDir = 'dist/webui/static';
const filesToCopy = ['index.html', 'webui.css', 'gridstack-extra.min.css'];

// Vendor library to copy from node_modules
const vendorLibraries = [
  {
    src: 'node_modules/@cycjimmy/jsmpeg-player/dist/jsmpeg-player.umd.min.js',
    dest: 'jsmpeg.min.js'
  },
  {
    src: 'node_modules/gridstack/dist/gridstack-all.js',
    dest: 'gridstack-all.js'
  },
  {
    src: 'node_modules/gridstack/dist/gridstack.min.css',
    dest: 'gridstack.min.css'
  },
  {
    src: 'node_modules/lucide/dist/umd/lucide.min.js',
    dest: 'lucide.min.js'
  }
];

const GREEN = '\u001B[32m';
const YELLOW = '\u001B[33m';
const RED = '\u001B[31m';
const RESET = '\u001B[0m';
const GREEN_DOT = `${GREEN}•${RESET}`;
const YELLOW_DOT = `${YELLOW}•${RESET}`;
const RED_CROSS = `${RED}✖${RESET}`;

function logInfo(message) {
  console.log(`  ${GREEN_DOT} ${message}`);
}

function logWarn(message) {
  console.warn(`  ${YELLOW_DOT} ${message}`);
}

function logError(message) {
  console.error(`  ${RED_CROSS} ${message}`);
}

// Main function
function copyWebUIAssets() {
  try {
    // Ensure destination directory exists
    fs.mkdirSync(destDir, { recursive: true });
    logInfo(`created directory ${destDir}`);
    
    // Copy each file
    let copiedCount = 0;
    for (const fileName of filesToCopy) {
      const srcPath = path.join(srcDir, fileName);
      const destPath = path.join(destDir, fileName);
      
      // Check if source file exists
      if (!fs.existsSync(srcPath)) {
        logWarn(`source file missing ${srcPath}`);
        continue;
      }
      
      // Copy the file
      fs.copyFileSync(srcPath, destPath);
      logInfo(`copied ${fileName}`);
      copiedCount++;
    }
    
    logInfo(`webui asset copy complete ${copiedCount}/${filesToCopy.length}`);

    // Copy vendor libraries
    let vendorCount = 0;
    for (const vendor of vendorLibraries) {
      const srcPath = vendor.src;
      const destPath = path.join(destDir, vendor.dest);

      // Check if source file exists
      if (!fs.existsSync(srcPath)) {
        logWarn(`vendor library missing ${srcPath}`);
        continue;
      }

      // Copy the vendor library
      fs.copyFileSync(srcPath, destPath);
      logInfo(`copied vendor library ${vendor.dest}`);
      vendorCount++;
    }

    logInfo(`vendor library copy complete ${vendorCount}/${vendorLibraries.length}`);

  } catch (error) {
    logError(`error copying WebUI assets: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  copyWebUIAssets();
}

module.exports = { copyWebUIAssets };
