// src/manager/ConfigManager.js
const JSONFileManager = require('./base/JSONFileManager');

class ConfigManager extends JSONFileManager {
    constructor() {
        const defaults = {
            DiscordSync: false,
            AlwaysOnTop: false,
            AlertWhenComplete: true,
            AlertWhenCooled: true,
            AudioAlerts: true,
            VisualAlerts: true,
            DebugMode: false,
            WebhookUrl: "",
            CustomCamera: false,
            CustomCameraUrl: "",
            CustomLeds: false,
            ForceLegacyAPI: false,
            DiscordUpdateIntervalMinutes: 5,
            // Web UI specific settings
            WebUIEnabled: true,
            WebUIPort: 3000,
            WebUIPassword: 'changeme',
            // Camera proxy settings
            CameraProxyPort: 8181
        };
        
        super('config.json', defaults);
        this.load();
    }

    /**
     * Override to handle WebUi to WebUIEnabled migration
     */
    performMigration(loadedData) {
        const migratedData = { ...loadedData };
        
        // Migrate from old WebUi to WebUIEnabled
        if (migratedData.hasOwnProperty('WebUi')) {
            // If WebUIEnabled doesn't exist, use the WebUi value
            if (!migratedData.hasOwnProperty('WebUIEnabled')) {
                migratedData.WebUIEnabled = migratedData.WebUi;
            }
            // Always remove the old WebUi setting
            delete migratedData.WebUi;
        }
        
        return migratedData;
    }

    /**
     * Gets the current config object
     */
    getConfig() {
        return this.getData();
    }

    /**
     * Updates the config object (pass the whole new object)
     */
    updateConfig(newConfig) {
        // Ensure WebUi is never saved
        const cleanConfig = { ...newConfig };
        if (cleanConfig.hasOwnProperty('WebUi')) {
            delete cleanConfig.WebUi;
        }
        
        this.updateData(cleanConfig);
        // Note: updateData() is overridden below to emit 'configUpdated' instead of 'dataUpdated'
    }

    /**
     * Override base class updateData to emit configUpdated instead of dataUpdated
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
        this.emit('configUpdated', this.data); // Emit configUpdated instead of dataUpdated
    }

    /**
     * Override base class set to emit configUpdated instead of dataUpdated
     */
    set(key, value) {
        if (this.data && this.defaults.hasOwnProperty(key)) {
            this.data[key] = value;
            this.save();
            this.emit('configUpdated', this.data); // Emit configUpdated instead of dataUpdated
        } else {
            console.warn(`Attempted to set unknown key: ${key}`);
        }
    }
}

module.exports = new ConfigManager();
