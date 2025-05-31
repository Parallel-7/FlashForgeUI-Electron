// src/utils/MachineStateUtils.js
const { MachineState } = require('ff-api');

/**
 * Utility functions for handling machine state
 */

/**
 * Get human-readable text for machine state
 * This matches the logic in PrinterConnectionManager._getMachineStateText
 * @param {MachineState} state Machine state enum value
 * @returns {string} Human-readable state text
 */
function getMachineStateText(state) {
  switch (state) {
    case MachineState.Ready: return 'Ready';
    case MachineState.Busy: return 'Busy';
    case MachineState.Calibrating: return 'Calibrating';
    case MachineState.Error: return 'Error';
    case MachineState.Heating: return 'Heating';
    case MachineState.Printing: return 'Printing';
    case MachineState.Pausing: return 'Pausing';
    case MachineState.Paused: return 'Paused';
    case MachineState.Cancelled: return 'Cancelled';
    case MachineState.Completed: return 'Completed';
    case MachineState.Unknown:
    default: 
      return 'Unknown';
  }
}



module.exports = {
  getMachineStateText
};
