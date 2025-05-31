// src/manager/DiscordNotificationManager.js
const axios = require('axios');
const ConfigManager = require('../../managers/ConfigManager');

class DiscordNotificationManager {
    constructor() {
        this.updateTimer = null;
        this.lastNotificationState = null;
        this.lastIdleNotificationTime = null;
        this.currentPrinterStatus = null;
        this.cameraProxyPort = ConfigManager.getConfig().CameraProxyPort || 8181;
        
        // Track Discord-specific settings to detect changes
        const config = ConfigManager.getConfig();
        this.lastDiscordSettings = {
            DiscordSync: config.DiscordSync,
            WebhookUrl: config.WebhookUrl,
            DiscordUpdateIntervalMinutes: config.DiscordUpdateIntervalMinutes
        };
    }

    /**
     * Initialize the Discord notification system
     */
    initialize() {
        const config = ConfigManager.getConfig();
        
        if (config.DiscordSync && config.WebhookUrl) {
            this.startUpdateTimer();
        }
        
        // Listen for config changes
        ConfigManager.on('configUpdated', (newConfig) => {
            this.handleConfigUpdate(newConfig);
        });
    }

    /**
     * Handle config updates
     */
    handleConfigUpdate(newConfig) {
        // Always update camera proxy port
        this.cameraProxyPort = newConfig.CameraProxyPort || 8181;
        
        // Check if Discord-specific settings have actually changed
        const newDiscordSettings = {
            DiscordSync: newConfig.DiscordSync,
            WebhookUrl: newConfig.WebhookUrl,
            DiscordUpdateIntervalMinutes: newConfig.DiscordUpdateIntervalMinutes
        };
        
        const discordSettingsChanged = (
            this.lastDiscordSettings.DiscordSync !== newDiscordSettings.DiscordSync ||
            this.lastDiscordSettings.WebhookUrl !== newDiscordSettings.WebhookUrl ||
            this.lastDiscordSettings.DiscordUpdateIntervalMinutes !== newDiscordSettings.DiscordUpdateIntervalMinutes
        );
        
        // Only restart timer if Discord settings actually changed
        if (discordSettingsChanged) {
            console.log('Discord settings changed, updating notification timer');
            
            if (newConfig.DiscordSync && newConfig.WebhookUrl) {
                this.startUpdateTimer();
            } else {
                this.stopUpdateTimer();
            }
            
            // Update our tracking of Discord settings
            this.lastDiscordSettings = newDiscordSettings;
        }
    }

    /**
     * Start the update timer
     */
    startUpdateTimer() {
        this.stopUpdateTimer(); // Clear any existing timer
        
        const config = ConfigManager.getConfig();
        const intervalMinutes = config.DiscordUpdateIntervalMinutes || 5;
        const intervalMs = intervalMinutes * 60 * 1000;
        
        // Send initial update
        this.sendStatusUpdate();
        
        // Set up recurring updates
        this.updateTimer = setInterval(() => {
            this.sendStatusUpdate();
        }, intervalMs);
        
        console.log(`Discord notification timer started with ${intervalMinutes} minute interval`);
    }

    /**
     * Stop the update timer
     */
    stopUpdateTimer() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
            console.log('Discord notification timer stopped');
        }
    }

    /**
     * Update the current printer status
     */
    updatePrinterStatus(status) {
        this.currentPrinterStatus = status;
    }

    /**
     * Send a status update to Discord
     */
    async sendStatusUpdate() {
        const config = ConfigManager.getConfig();
        
        if (!config.DiscordSync || !config.WebhookUrl) {
            return;
        }
        
        if (!this.currentPrinterStatus) {
            console.log('No printer status available for Discord notification');
            return;
        }
        
        const status = this.currentPrinterStatus;
        const isIdle = status.machineStatus === 'READY' && !status.printInfo;
        
        // Check if we should skip this notification
        if (isIdle) {
            // If it's idle and we've already sent an idle notification recently, skip
            if (this.lastNotificationState === 'idle') {
                const now = Date.now();
                const timeSinceLastIdle = now - this.lastIdleNotificationTime;
                const oneHour = 60 * 60 * 1000;
                
                // Don't send idle notifications more than once per hour
                if (timeSinceLastIdle < oneHour) {
                    console.log('Skipping idle notification (already sent recently)');
                    return;
                }
            }
        }
        
        try {
            const embed = await this.createStatusEmbed(status);
            
            await axios.post(config.WebhookUrl, {
                embeds: [embed]
            });
            
            // Update notification state
            if (isIdle) {
                this.lastNotificationState = 'idle';
                this.lastIdleNotificationTime = Date.now();
            } else {
                this.lastNotificationState = 'active';
            }
            
            console.log('Discord notification sent successfully');
        } catch (error) {
            console.error('Failed to send Discord notification:', error);
        }
    }

    /**
     * Round temperature to 2 decimal places
     * @param {number} temp Temperature value
     * @returns {string} Rounded temperature
     */
    roundTemperature(temp) {
        if (typeof temp !== 'number' || isNaN(temp)) {
            return '0.00';
        }
        return temp.toFixed(2);
    }

    /**
     * Create a Discord embed from printer status
     */
    async createStatusEmbed(status) {
        const embed = {
            title: `🖨️ ${status.printerName || 'FlashForge Printer'}`,
            color: this.getStatusColor(status),
            timestamp: new Date().toISOString(),
            fields: []
        };
        
        // Add machine status
        embed.fields.push({
            name: 'Status',
            value: this.formatMachineStatus(status.machineStatus),
            inline: true
        });
        
        // Add temperatures
        if (status.temp) {
            embed.fields.push({
                name: 'Extruder Temp',
                value: `${this.roundTemperature(status.temp.currentTemp)}°C / ${this.roundTemperature(status.temp.targetTemp)}°C`,
                inline: true
            });
        }
        
        if (status.bedTemp) {
            embed.fields.push({
                name: 'Bed Temp',
                value: `${this.roundTemperature(status.bedTemp.currentTemp)}°C / ${this.roundTemperature(status.bedTemp.targetTemp)}°C`,
                inline: true
            });
        }
        
        // Add print info if printing
        if (status.printInfo) {
            const progress = status.printInfo.progress || 0;
            const progressBar = this.createProgressBar(progress);
            
            embed.fields.push({
                name: 'Progress',
                value: `${progressBar} ${Math.round(progress * 100)}%`,
                inline: false
            });
            
            if (status.printInfo.elapsedTime) {
                embed.fields.push({
                    name: 'Print Time',
                    value: this.formatDuration(status.printInfo.elapsedTime),
                    inline: true
                });
            }
            
            if (status.printInfo.estimatedTime) {
                const remainingSeconds = status.printInfo.estimatedTime;
                const etaDate = new Date(Date.now() + remainingSeconds * 1000);
                const formattedETA = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                embed.fields.push({
                    name: 'ETA',
                    value: formattedETA,
                    inline: true
                });
            }
            
            if (status.printInfo.layer) {
                embed.fields.push({
                    name: 'Layer',
                    value: `${status.printInfo.layer.current} / ${status.printInfo.layer.total}`,
                    inline: true
                });
            }
            
            if (status.printInfo.fileName) {
                embed.fields.push({
                    name: 'File',
                    value: status.printInfo.fileName,
                    inline: false
                });
            }
        }
        
        return embed;
    }

    /**
     * Get status color based on machine state
     */
    getStatusColor(status) {
        if (status.machineStatus === 'BUILDING_FROM_SD') {
            return 0x00ff00; // Green for printing
        } else if (status.machineStatus === 'READY') {
            return 0x3498db; // Blue for ready
        } else if (status.machineStatus === 'PAUSED') {
            return 0xf39c12; // Orange for paused
        } else {
            return 0x95a5a6; // Gray for other states
        }
    }

    /**
     * Format machine status for display
     */
    formatMachineStatus(status) {
        const statusMap = {
            'READY': '✅ Ready',
            'BUILDING_FROM_SD': '🖨️ Printing',
            'PAUSED': '⏸️ Paused',
            'UNKNOWN': '❓ Unknown'
        };
        
        return statusMap[status] || status;
    }

    /**
     * Create a progress bar
     */
    createProgressBar(progress) {
        // progress is a decimal (0-1), so multiply by 100 for percentage
        const percentage = progress * 100;
        const filled = Math.floor(percentage / 10);
        const empty = 10 - filled;
        
        return '█'.repeat(filled) + '░'.repeat(empty);
    }

    /**
     * Format duration from seconds
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        return `${hours}h ${minutes}m`;
    }

    /**
     * Send a custom notification
     */
    async sendCustomNotification(title, description, color = 0x3498db) {
        const config = ConfigManager.getConfig();
        
        if (!config.DiscordSync || !config.WebhookUrl) {
            return;
        }
        
        try {
            await axios.post(config.WebhookUrl, {
                embeds: [{
                    title: title,
                    description: description,
                    color: color,
                    timestamp: new Date().toISOString()
                }]
            });
            
            console.log('Custom Discord notification sent');
        } catch (error) {
            console.error('Failed to send custom Discord notification:', error);
        }
    }

    /**
     * Notify print complete
     */
    async notifyPrintComplete(printInfo) {
        await this.sendCustomNotification(
            '✅ Print Complete!',
            `**${printInfo.fileName || 'Print'}** has finished successfully.\nTotal time: ${this.formatDuration(printInfo.elapsedTime || 0)}`,
            0x00ff00
        );
    }

    /**
     * Notify printer cooled down
     */
    async notifyPrinterCooled() {
        await this.sendCustomNotification(
            '❄️ Printer Cooled Down',
            'The printer has cooled down and is ready for the next print.',
            0x3498db
        );
    }

    /**
     * Dispose of resources and clean up timers
     */
    dispose() {
        console.log('DiscordNotificationManager: Disposing resources...');
        this.stopUpdateTimer();
        // Clear status tracking
        this.currentPrinterStatus = null;
        this.lastNotificationState = null;
        this.lastIdleNotificationTime = null;
    }
}

module.exports = new DiscordNotificationManager();
