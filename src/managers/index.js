// src/managers/index.js
// Clean exports for all manager components

// Core managers
const ConfigManager = require('./ConfigManager');
const PrinterDetailsManager = require('./PrinterDetailsManager');
const SessionTokenManager = require('./SessionTokenManager');

// Specialized managers
const { WindowManager } = require('./window');
const { DialogManager, DialogHandlerManager } = require('./dialog');
const { IPCManager } = require('./ipc');

// Domain-specific managers
const printerComponents = require('./printer');
const cameraComponents = require('./camera');

// Base utilities
const { JSONFileManager } = require('./base/JSONFileManager');

module.exports = {
  // Core managers
  ConfigManager,
  PrinterDetailsManager,
  SessionTokenManager,
  JSONFileManager,
  
  // Specialized managers
  WindowManager,
  DialogManager,
  DialogHandlerManager,
  IPCManager,
  
  // Domain-specific components
  printer: printerComponents,
  camera: cameraComponents
};
