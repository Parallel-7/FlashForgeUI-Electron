const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Base class for managing JSON file persistence
 * Provides common functionality for loading, saving, and validating JSON data
 */
class JSONFileManager extends EventEmitter {
    constructor(fileName, defaults = {}) {
        super();
        this.fileName = fileName;
        this.filePath = path.join(app.getPath('userData'), fileName);
        this.defaults = defaults;
        this.data = null;
    }

    /**
     * Load data from JSON file
     * @returns {Object} Loaded data or defaults
     */
    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const jsonData = fs.readFileSync(this.filePath, 'utf-8');
                const loadedData = JSON.parse(jsonData);
                
                // Allow subclasses to perform migration
                const migratedData = this.performMigration(loadedData);
                
                // Merge with defaults to ensure all keys exist
                this.data = { ...this.defaults, ...migratedData };
                console.log(`Data loaded from ${this.filePath}`);
                
                // Save if migration occurred
                if (this.shouldSaveAfterMigration(loadedData, migratedData)) {
                    this.save();
                }
            } else {
                console.log(`File not found at ${this.filePath}. Using defaults and saving.`);
                this.data = { ...this.defaults };
                this.save();
            }
        } catch (error) {
            console.error(`Error loading data from ${this.filePath}:`, error);
            this.data = { ...this.defaults };
        }
        return this.data;
    }

    /**
     * Save current data to JSON file
     */
    save() {
        try {
            // Allow subclasses to validate before saving
            if (!this.validateBeforeSave(this.data)) {
                console.error('Validation failed, not saving data');
                return;
            }
            
            const jsonData = JSON.stringify(this.data, null, 2);
            fs.writeFileSync(this.filePath, jsonData, 'utf-8');
            console.log(`Data saved to ${this.filePath}`);
        } catch (error) {
            console.error(`Error saving data to ${this.filePath}:`, error);
        }
    }

    /**
     * Get current data
     * @returns {Object} Current data
     */
    getData() {
        return this.data;
    }

    /**
     * Update data with new values
     * @param {Object} newData New data to merge
     */
    updateData(newData) {
        // Ensure we only save known keys (prevent pollution)
        const validData = {};
        for (const key in this.defaults) {
            if (newData.hasOwnProperty(key)) {
                validData[key] = newData[key];
            } else {
                validData[key] = this.defaults[key];
            }
        }
        
        this.data = validData;
        this.save();
        this.emit('dataUpdated', this.data);
    }

    /**
     * Get a specific value
     * @param {string} key Key to retrieve
     * @returns {*} Value for the key
     */
    get(key) {
        return this.data ? this.data[key] : this.defaults[key];
    }

    /**
     * Set a specific value
     * @param {string} key Key to set
     * @param {*} value Value to set
     */
    set(key, value) {
        if (this.data && this.defaults.hasOwnProperty(key)) {
            this.data[key] = value;
            this.save();
            this.emit('dataUpdated', this.data);
        } else {
            console.warn(`Attempted to set unknown key: ${key}`);
        }
    }

    /**
     * Clear all data and delete the file
     */
    clear() {
        this.data = null;
        try {
            if (fs.existsSync(this.filePath)) {
                fs.unlinkSync(this.filePath);
                console.log(`File deleted: ${this.filePath}`);
            }
        } catch (error) {
            console.error(`Error deleting file ${this.filePath}:`, error);
        }
    }

    // Virtual methods for subclasses to override

    /**
     * Perform any necessary data migration
     * @param {Object} loadedData Data loaded from file
     * @returns {Object} Migrated data
     */
    performMigration(loadedData) {
        return loadedData;
    }

    /**
     * Determine if save should occur after migration
     * @param {Object} originalData Original loaded data
     * @param {Object} migratedData Data after migration
     * @returns {boolean} True if should save
     */
    shouldSaveAfterMigration(originalData, migratedData) {
        return JSON.stringify(originalData) !== JSON.stringify(migratedData);
    }

    /**
     * Validate data before saving
     * @param {Object} data Data to validate
     * @returns {boolean} True if valid
     */
    validateBeforeSave(data) {
        return data !== null && typeof data === 'object';
    }
}

module.exports = JSONFileManager;
