// src/web/public/modules/dom-manager.js

/**
 * DOM Manager Module
 * Handles DOM element caching and basic DOM operations
 */
class DOMManager {
  constructor() {
    this.elements = {};
    this.cached = false;
  }

  /**
   * Cache all DOM elements for efficient access
   */
  cacheElements() {
    if (this.cached) return this.elements;

    // Login elements
    this.elements.loginScreen = document.getElementById('login-screen');
    this.elements.passwordInput = document.getElementById('password-input');
    this.elements.rememberMeCheckbox = document.getElementById('remember-me-checkbox');
    this.elements.loginButton = document.getElementById('login-button');
    this.elements.loginError = document.getElementById('login-error');
    this.elements.mainUI = document.getElementById('main-ui');

    // Connection status
    this.elements.connectionText = document.getElementById('connection-text');

    // Camera view
    this.elements.cameraPlaceholder = document.getElementById('camera-placeholder');

    // Job info
    this.elements.currentJob = document.getElementById('current-job');
    this.elements.progressPercentage = document.getElementById('progress-percentage');
    this.elements.progressBar = document.getElementById('progress-bar');
    this.elements.layerInfo = document.getElementById('layer-info');
    this.elements.eta = document.getElementById('eta');
    this.elements.jobTime = document.getElementById('job-time');
    this.elements.weight = document.getElementById('weight');
    this.elements.length = document.getElementById('length');

    // Model preview
    this.elements.modelPreview = document.getElementById('model-preview');

    // Status info
    this.elements.printerStatus = document.getElementById('printer-status');
    this.elements.runTime = document.getElementById('run-time');
    this.elements.filamentUsed = document.getElementById('filament-used');
    this.elements.bedTemp = document.getElementById('bed-temp');
    this.elements.extruderTemp = document.getElementById('extruder-temp');
    this.elements.filtrationStatus = document.getElementById('filtration-status');
    this.elements.tvocLevel = document.getElementById('tvoc-level');
    this.elements.nozzleSize = document.getElementById('nozzle-size');
    this.elements.filamentType = document.getElementById('filament-type');
    this.elements.speedOffset = document.getElementById('speed-offset');
    this.elements.zOffset = document.getElementById('z-offset');

    // Control buttons
    this.elements.previewBtn = document.getElementById('btn-preview');
    this.elements.ledOnBtn = document.getElementById('btn-led-on');
    this.elements.ledOffBtn = document.getElementById('btn-led-off');
    this.elements.clearStatusBtn = document.getElementById('btn-clear-status');
    this.elements.homeAxesBtn = document.getElementById('btn-home-axes');
    this.elements.pauseBtn = document.getElementById('btn-pause');
    this.elements.resumeBtn = document.getElementById('btn-resume');
    this.elements.stopBtn = document.getElementById('btn-stop');
    this.elements.startRecentBtn = document.getElementById('btn-start-recent');
    this.elements.startLocalBtn = document.getElementById('btn-start-local');

    // Temperature buttons
    this.elements.bedSetBtn = document.getElementById('btn-bed-set');
    this.elements.bedOffBtn = document.getElementById('btn-bed-off');
    this.elements.extruderSetBtn = document.getElementById('btn-extruder-set');
    this.elements.extruderOffBtn = document.getElementById('btn-extruder-off');

    // Filtration buttons
    this.elements.externalFiltrationBtn = document.getElementById('btn-external-filtration');
    this.elements.internalFiltrationBtn = document.getElementById('btn-internal-filtration');
    this.elements.noFiltrationBtn = document.getElementById('btn-no-filtration');

    // Filtration section
    this.elements.filtrationSection = document.getElementById('filtration-section');
    this.elements.printerInfoSection = document.getElementById('printer-info-section');
    this.elements.coolingFan = document.getElementById('cooling-fan');
    this.elements.chamberFan = document.getElementById('chamber-fan');

    // Cache commonly used child elements for optimization
    this.elements.coolingFanSpan = this.elements.coolingFan?.querySelector('span');
    this.elements.chamberFanSpan = this.elements.chamberFan?.querySelector('span');

    // Log output
    this.elements.logOutput = document.getElementById('log-output');

    // File modal
    this.elements.fileModal = document.getElementById('file-modal');
    this.elements.modalTitle = document.getElementById('modal-title');
    this.elements.closeModal = document.getElementById('close-modal');
    this.elements.fileList = document.getElementById('file-list');
    this.elements.autoLevel = document.getElementById('auto-level');
    this.elements.startNow = document.getElementById('start-now');
    this.elements.printFileBtn = document.getElementById('print-file-btn');

    // Input dialog
    this.elements.inputDialog = document.getElementById('input-dialog');
    this.elements.dialogTitle = document.getElementById('dialog-title');
    this.elements.dialogMessage = document.getElementById('dialog-message');
    this.elements.dialogInput = document.getElementById('dialog-input');
    this.elements.closeDialog = document.getElementById('close-dialog');
    this.elements.dialogCancel = document.getElementById('dialog-cancel');
    this.elements.dialogConfirm = document.getElementById('dialog-confirm');

    // Toast notification
    this.elements.toast = document.getElementById('toast');

    this.cached = true;
    return this.elements;
  }

  /**
   * Get cached elements
   * @returns {Object} Cached DOM elements
   */
  getElements() {
    return this.cached ? this.elements : this.cacheElements();
  }

  /**
   * Get a specific element by key
   * @param {string} key Element key
   * @returns {Element|null} DOM element
   */
  getElement(key) {
    const elements = this.getElements();
    return elements[key] || null;
  }

  /**
   * Update text content of an element
   * @param {string} key Element key
   * @param {string} text Text content
   */
  updateText(key, text) {
    const element = this.getElement(key);
    if (element) element.textContent = text;
  }

  /**
   * Update HTML content of an element
   * @param {string} key Element key
   * @param {string} html HTML content
   */
  updateHTML(key, html) {
    const element = this.getElement(key);
    if (element) element.innerHTML = html;
  }

  /**
   * Toggle element visibility
   * @param {string} key Element key
   * @param {boolean} visible Whether element should be visible
   */
  toggleVisibility(key, visible) {
    const element = this.getElement(key);
    if (element) {
      element.style.display = visible ? 'block' : 'none';
    }
  }

  /**
   * Add or remove CSS class
   * @param {string} key Element key
   * @param {string} className CSS class name
   * @param {boolean} add Whether to add (true) or remove (false) class
   */
  toggleClass(key, className, add) {
    const element = this.getElement(key);
    if (element) {
      if (add) {
        element.classList.add(className);
      } else {
        element.classList.remove(className);
      }
    }
  }

  /**
   * Set element attribute
   * @param {string} key Element key
   * @param {string} attribute Attribute name
   * @param {string} value Attribute value
   */
  setAttribute(key, attribute, value) {
    const element = this.getElement(key);
    if (element) element.setAttribute(attribute, value);
  }

  /**
   * Update connection indicator status
   * @param {boolean} connected Whether printer is connected
   */
  updateConnectionIndicator(connected) {
    const indicator = document.querySelector('.connection-indicator');
    if (indicator) {
      this.toggleClass.call({ getElement: () => indicator }, '', 'connected', connected);
    }
  }
}

// Export singleton instance
window.domManager = new DOMManager();
