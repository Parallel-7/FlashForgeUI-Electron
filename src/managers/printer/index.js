// src/managers/printer/index.js
// Clean exports for printer management components

const PrinterConnectionManager = require('./PrinterConnectionManager');
const PrinterClientAdapter = require('./adapter/PrinterClientAdapter');

// Export main printer management components
module.exports = {
  PrinterConnectionManager,
  PrinterClientAdapter,
  
  // Re-export modules for convenience
  CommandForwarder: require('./modules/CommandForwarder'),
  ConnectionFlowManager: require('./modules/ConnectionFlowManager'),
  ConnectionStateManager: require('./modules/ConnectionStateManager'),
  PrinterEventHandler: require('./modules/PrinterEventHandler'),
  PrinterNotificationCoordinator: require('./modules/PrinterNotificationCoordinator')
};
