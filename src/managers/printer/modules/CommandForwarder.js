/**
 * CommandForwarder handles dynamic method forwarding for printer commands
 * Provides a clean interface for forwarding printer client methods to the parent class
 */
class CommandForwarder {
  /**
   * Create a new CommandForwarder
   * @param {Array<string>} commandMethods Array of method names to forward
   */
  constructor(commandMethods = []) {
    this.commandMethods = commandMethods;
  }
  
  /**
   * Setup method forwarding for printer commands
   * @param {Object} target The target object to add forwarded methods to
   * @param {Object} printerClient The printer client to forward methods from
   */
  setupMethodForwarding(target, printerClient) {
    if (!target || !printerClient) {
      throw new Error('Target and printerClient are required for method forwarding');
    }
    
    // Clear any existing forwarded methods first
    this.clearForwardedMethods(target);
    
    // Set up new method forwarding with the current printer client
    this.commandMethods.forEach(method => {
      if (typeof printerClient[method] === 'function') {
        target[method] = async (...args) => {
          if (!printerClient || !target.isConnected) {
            throw new Error('Printer not connected');
          }
          
          return await printerClient[method](...args);
        };
        
        // Mark this method as forwarded for future cleanup
        target[method]._isForwarded = true;
      }
    });
  }
  
  /**
   * Clear all forwarded methods from the target object
   * @param {Object} target The target object to clear forwarded methods from
   */
  clearForwardedMethods(target) {
    if (!target) return;
    
    this.commandMethods.forEach(method => {
      if (typeof target[method] === 'function' && target[method]._isForwarded) {
        delete target[method];
      }
    });
  }

}

module.exports = CommandForwarder;
