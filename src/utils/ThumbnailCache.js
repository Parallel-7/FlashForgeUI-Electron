// src/utils/ThumbnailCache.js
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ThumbnailCache {
    constructor() {
        // Set up cache directory in user data folder
        this.cacheDir = path.join(app.getPath('userData'), 'thumbnailCache');
        
        // In-memory cache for faster access during a session
        this.memoryCache = new Map();
        
        // Initialize cache directory
        this.initializeCache();
    }
    
    initializeCache() {
        try {
            if (!fs.existsSync(this.cacheDir)) {
                fs.mkdirSync(this.cacheDir, { recursive: true });
                console.log(`Created thumbnail cache directory at ${this.cacheDir}`);
            }
        } catch (error) {
            console.error('Error initializing thumbnail cache directory:', error);
        }
    }
    
    // Generate a safe filename for the cache
    getFilename(filename) {
        // Hash the filename to ensure it's safe for filesystem
        const hash = crypto.createHash('md5').update(filename).digest('hex');
        return `${hash}.png`;
    }
    
    // Check if a thumbnail exists in cache (memory or disk)
    has(filename) {
        // First check memory cache for fastest access
        if (this.memoryCache.has(filename)) {
            return true;
        }
        
        // Then check disk cache
        const cacheFile = path.join(this.cacheDir, this.getFilename(filename));
        return fs.existsSync(cacheFile);
    }
    
    // Get a thumbnail from cache
    get(filename) {
        // First check memory cache
        if (this.memoryCache.has(filename)) {
            return this.memoryCache.get(filename);
        }
        
        // Then check disk cache
        try {
            const cacheFile = path.join(this.cacheDir, this.getFilename(filename));
            
            if (fs.existsSync(cacheFile)) {
                // Read from disk and add to memory cache
                const buffer = fs.readFileSync(cacheFile);
                const base64Data = buffer.toString('base64');
                
                // Store in memory cache for faster access next time
                this.memoryCache.set(filename, base64Data);
                
                return base64Data;
            }
        } catch (error) {
            console.error(`Error getting cached thumbnail for ${filename}:`, error);
        }
        
        return null;
    }
    
    // Save a thumbnail to cache (both memory and disk)
    set(filename, base64Data) {
        if (!base64Data) return;
        
        // Save to memory cache
        this.memoryCache.set(filename, base64Data);
        
        // Save to disk cache
        try {
            const cacheFile = path.join(this.cacheDir, this.getFilename(filename));
            
            // Convert base64 to buffer
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Write to file
            fs.writeFileSync(cacheFile, buffer);
        } catch (error) {
            console.error(`Error saving thumbnail to cache for ${filename}:`, error);
        }
    }
    
    // Clear the entire cache
    clear() {
        // Clear memory cache
        this.memoryCache.clear();
        
        // Clear disk cache
        try {
            if (fs.existsSync(this.cacheDir)) {
                const files = fs.readdirSync(this.cacheDir);
                for (const file of files) {
                    fs.unlinkSync(path.join(this.cacheDir, file));
                }
            }
        } catch (error) {
            console.error('Error clearing thumbnail cache:', error);
        }
    }
}

module.exports = new ThumbnailCache();
