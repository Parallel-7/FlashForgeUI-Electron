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
const filesToCopy = [
  'index.html',
  'webui.css',
  'gridstack-extra.min.css',
  'manifest.json',
  'sw.js',
  'icon-notification.png',
  'icon-192.png',
  'icon-512.png'
];

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

// Main function
function copyWebUIAssets() {
  try {
    // Ensure destination directory exists
    fs.mkdirSync(destDir, { recursive: true });
    console.log(`Created directory: ${destDir}`);
    
    // Copy each file
    let copiedCount = 0;
    for (const fileName of filesToCopy) {
      const srcPath = path.join(srcDir, fileName);
      const destPath = path.join(destDir, fileName);
      
      // Check if source file exists
      if (!fs.existsSync(srcPath)) {
        console.warn(`Warning: Source file does not exist: ${srcPath}`);
        continue;
      }
      
      // Copy the file
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${fileName}`);
      copiedCount++;
    }
    
    console.log(`✅ WebUI asset copy complete: ${copiedCount}/${filesToCopy.length} files copied`);

    // Copy vendor libraries
    let vendorCount = 0;
    for (const vendor of vendorLibraries) {
      const srcPath = vendor.src;
      const destPath = path.join(destDir, vendor.dest);

      // Check if source file exists
      if (!fs.existsSync(srcPath)) {
        console.warn(`Warning: Vendor library not found: ${srcPath}`);
        continue;
      }

      // Copy the vendor library
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied vendor library: ${vendor.dest}`);
      vendorCount++;
    }

    console.log(`✅ Vendor library copy complete: ${vendorCount}/${vendorLibraries.length} libraries copied`);

  } catch (error) {
    console.error('❌ Error copying WebUI assets:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  copyWebUIAssets();
}

module.exports = { copyWebUIAssets };
