// src/manager/PrinterDetailsManager.js
const JSONFileManager = require('./base/JSONFileManager');

class PrinterDetailsManager extends JSONFileManager {
    constructor() {
        // PrinterDetailsManager doesn't use defaults - it either has valid data or null
        super('printer_details.json', {});
        this.load();
        
        // If loaded data is incomplete, clear it
        if (this.data && !this.isValidPrinterDetails(this.data)) {
            console.warn('Loaded printer details are incomplete.');
            this.data = null;
        }
    }

    /**
     * Validate printer details structure
     */
    isValidPrinterDetails(details) {
        return details && 
               details.IPAddress && 
               details.SerialNumber && 
               details.CheckCode && 
               details.Name;
    }

    /**
     * Override to validate printer details before saving
     */
    validateBeforeSave(data) {
        if (!data) return false;
        
        if (!this.isValidPrinterDetails(data)) {
            console.error('Attempted to save incomplete printer details:', data);
            return false;
        }
        
        return true;
    }

    /**
     * Override load to handle null data case
     */
    load() {
        super.load();
        
        // For printer details, we want null if file doesn't exist or is invalid
        if (Object.keys(this.data).length === 0) {
            this.data = null;
        }
        
        return this.data;
    }

    /**
     * Save printer details
     */
    save(details) {
        if (details) {
            this.data = details;
        }
        super.save();
    }

}

module.exports = new PrinterDetailsManager();
