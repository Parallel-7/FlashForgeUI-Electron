// src/index.js - Streamlined application entry point using Bootstrap architecture
const { app } = require('electron');

// Bootstrap modules
const ApplicationBootstrapper = require('./bootstrap/ApplicationBootstrapper');
const ApplicationLifecycle = require('./bootstrap/ApplicationLifecycle');
const ApplicationUtils = require('./utils/ApplicationUtils');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Set platform-specific settings
if (process.platform === 'win32') {
  app.setAppUserModelId(app.name);
}

// Create main application components
const bootstrapper = new ApplicationBootstrapper();
const lifecycle = new ApplicationLifecycle(bootstrapper);

// Initialize application lifecycle
lifecycle.setupLifecycleEvents();

// Backward compatibility exports for IPCManager and other components
// These maintain the existing API while using the new architecture
module.exports = {
  // Functions for IPC handlers
  // Manager instances for backward compatibility
  get dialogManager() {
    const managers = bootstrapper.getManagers();
    return managers.dialogManager;
  },

  get dialogHandlerManager() {
    const managers = bootstrapper.getManagers();
    return managers.dialogHandlerManager;
  }
};

