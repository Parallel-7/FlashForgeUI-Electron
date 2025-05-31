// src/web/public/modules/ui-utils.js

/**
 * UI Utilities Module
 * Handles toast notifications, dialogs, logging, and general UI utilities
 */
class UIUtils {
  constructor(domManager) {
    this.dom = domManager;

  }

  /**
   * Show toast notification with automatic positioning for multiple toasts
   * @param {string} message Toast message
   * @param {string} type Toast type ('info', 'success', 'error', 'warning')
   * @param {number} duration Duration in milliseconds
   */
  showToast(message, type = 'info', duration = 3000) {
    // Create a unique toast element
    const elements = this.dom.getElements();
    const toast = elements.toast.cloneNode(false);
    toast.textContent = message;
    toast.className = 'toast';
    toast.classList.add(type);
    toast.classList.add('show');

    // Add to document body
    document.body.appendChild(toast);

    // Position multiple toasts
    const visibleToasts = document.querySelectorAll('.toast.show');
    const toastIndex = visibleToasts.length - 1;
    toast.style.bottom = `${20 + (toastIndex * 50)}px`;

    // Auto-remove toast
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300); // Wait for fade animation
    }, duration);
  }

  /**
   * Log message to console and optionally show toast
   * @param {string} message Message to log
   * @param {boolean} showToast Whether to show toast notification
   */
  logMessage(message, showToast = false) {
    console.log('[WebUI Log]', message);

    if (showToast) {
      this.showToast(message, 'info', 2000);
    }
  }

  /**
   * Update connection status display with automatic reconnect handling
   * @param {string} status Status message
   * @param {boolean} isConnected Whether connection is active
   */
  updateConnectionStatus(status, isConnected = false) {
    this.dom.updateText('connectionText', status);
    this.dom.updateConnectionIndicator(isConnected);

    // Handle disconnection with auto-reload timer
    if (!isConnected && status.toLowerCase().includes('disconnect')) {
      if (!window.reloadTimer) {
        console.log('Setting reload timer for 10 seconds due to disconnection');
        window.reloadTimer = setTimeout(() => {
          window.location.reload();
        }, 10000);
      }
    } else {
      // Clear reload timer if reconnected
      if (window.reloadTimer) {
        clearTimeout(window.reloadTimer);
        window.reloadTimer = null;
      }
    }
  }

  /**
   * Show input dialog and return user input as promise
   * @param {string} title Dialog title
   * @param {string} message Dialog message
   * @param {string} defaultValue Default input value
   * @returns {Promise<string|null>} User input or null if canceled
   */
  showInputDialog(title, message, defaultValue = '') {
    const elements = this.dom.getElements();
    
    elements.dialogTitle.textContent = title;
    elements.dialogMessage.textContent = message;
    elements.dialogInput.value = defaultValue;
    elements.inputDialog.classList.add('show');
    elements.dialogInput.focus();

    return new Promise(resolve => {
      window.modalResolveFunc = resolve;
    });
  }

  /**
   * Cancel input dialog
   */
  cancelInputDialog() {
    const elements = this.dom.getElements();
    elements.inputDialog.classList.remove('show');
    
    if (window.modalResolveFunc) {
      window.modalResolveFunc(null);
      window.modalResolveFunc = null;
    }
  }

  /**
   * Confirm input dialog
   */
  confirmInputDialog() {
    const elements = this.dom.getElements();
    const value = elements.dialogInput.value.trim();
    elements.inputDialog.classList.remove('show');

    if (window.modalResolveFunc) {
      window.modalResolveFunc(value);
      window.modalResolveFunc = null;
    }
  }

  /**
   * Show temperature setting dialog
   * @param {string} type Temperature type ('bed' or 'extruder')
   * @param {Function} sendCommand Function to send commands
   * @returns {Promise} Promise that resolves when dialog is handled
   */
  showTempDialog(type, sendCommand) {
    const isExtruder = type === 'extruder';
    const title = `Set ${isExtruder ? 'Extruder' : 'Bed'} Temperature`;
    const message = `Enter temperature for ${type} (°C):`;
    const defaultTemp = isExtruder ? 200 : 60;

    return this.showInputDialog(title, message, defaultTemp.toString())
      .then(temperature => {
        if (temperature !== null && temperature >= 0) {
          const command = isExtruder ? 'set-extruder-temp' : 'set-bed-temp';
          sendCommand(command, { temperature: parseInt(temperature) });
        }
      });
  }

  /**
   * Show confirmation dialog
   * @param {string} message Confirmation message
   * @returns {boolean} True if confirmed
   */
  showConfirmDialog(message) {
    return confirm(message);
  }

  /**
   * Format temperature display
   * @param {Object} tempInfo Temperature info with current and set properties
   * @param {Object} fallbackInfo Fallback temperature info for legacy printers
   * @returns {string} Formatted temperature string
   */
  formatTemperature(tempInfo, fallbackInfo = {}) {
    if (tempInfo && tempInfo.current !== undefined && tempInfo.set !== undefined) {
      const current = parseFloat(tempInfo.current).toFixed(2);
      const target = parseFloat(tempInfo.set).toFixed(2);
      return `${current}°C/${target}°C`;
    } else if (fallbackInfo.current !== undefined) {
      const current = parseFloat(fallbackInfo.current || 0).toFixed(2);
      const target = parseFloat(fallbackInfo.target || 0).toFixed(2);
      return `${current}°C/${target}°C`;
    } else {
      return '0.00°C/0.00°C';
    }
  }

  /**
   * Format filament usage display
   * @param {number|string} filament Filament usage value
   * @returns {string} Formatted filament string
   */
  formatFilament(filament) {
    if (filament !== undefined && filament !== null) {
      const filamentValue = parseFloat(filament);
      if (!isNaN(filamentValue)) {
        return filamentValue.toFixed(2) + 'm';
      }
      return filament.toString();
    }
    return '0m';
  }

  /**
   * Format weight display
   * @param {number} weight Weight value
   * @returns {string} Formatted weight string
   */
  formatWeight(weight) {
    return (weight !== undefined ? parseFloat(weight).toFixed(1) : '0') + 'g';
  }

  /**
   * Format length display
   * @param {number} length Length value
   * @returns {string} Formatted length string
   */
  formatLength(length) {
    return (length !== undefined ? parseFloat(length).toFixed(2) : '0') + 'm';
  }

  /**
   * Format nozzle size display
   * @param {number|string} size Nozzle size
   * @returns {string} Formatted nozzle size string
   */
  formatNozzleSize(size) {
    if (!size) return '0.4mm';
    
    const numSize = parseFloat(size);
    return isNaN(numSize) ? size : numSize.toFixed(1) + 'mm';
  }

  /**
   * Calculate and format ETA time
   * @param {string} etaTime Time remaining string (HH:MM format)
   * @returns {string} Formatted completion time or original string
   */
  formatETA(etaTime) {
    if (!etaTime || etaTime === '--:--') {
      return etaTime || '--:--';
    }

    const [hours, minutes] = etaTime.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      const now = new Date();
      const completionTime = new Date(now.getTime() + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000));
      return completionTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    
    return etaTime; // Fallback to original format
  }

  /**
   * Reset UI elements to default state
   */
  resetUIElements() {
    this.dom.updateText('progressPercentage', '0%');
    this.dom.setAttribute('progressBar', 'value', '0');
  }

  /**
   * Create standardized event handler for command buttons
   * @param {string} command Command to send
   * @param {Function} sendCommand Function to send commands
   * @param {string} logText Optional log text
   * @returns {Function} Event handler function
   */
  createCommandHandler(command, sendCommand, logText = null) {
    return () => {
      sendCommand(command);
      if (logText) {
        this.logMessage(`Command: ${logText}`);
      }
    };
  }

  /**
   * Handle online/offline status changes
   * @param {Function} connectWithToken Function to reconnect with token
   */
  handleOnlineStatus(connectWithToken) {
    if (navigator.onLine) {
      this.showToast('Back online', 'success');
      // Try to reconnect if needed
      if (!window.isConnected) {
        const token = localStorage.getItem(window.AUTH_TOKEN_KEY);
        if (token) {
          connectWithToken(token);
        }
      }
    } else {
      this.showToast('Device offline', 'warning');
    }
  }
}

// Export for use by other modules
window.UIUtils = UIUtils;
