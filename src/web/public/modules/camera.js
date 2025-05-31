// src/web/public/modules/camera.js

/**
 * Camera Management Module
 * Handles camera preview, streaming, and related functionality
 */
class CameraManager {
  constructor(domManager, uiUtils) {
    this.dom = domManager;
    this.ui = uiUtils;
    this.previewEnabled = false;
    this.previewPlayer = null;
    this.cameraStreamUrl = null;
  }

  /**
   * Initialize camera manager
   */
  initialize() {
    // Store global references for compatibility
    window.previewEnabled = false;
    window.previewPlayer = null;
    window.cameraStreamUrl = null;
    window.cameraManager = this;
    
    this.setupEventHandlers();
  }

  /**
   * Setup camera-related event handlers
   */
  setupEventHandlers() {
    const elements = this.dom.getElements();
    elements.previewBtn.addEventListener('click', () => this.togglePreview());
  }

  /**
   * Toggle camera preview on/off
   */
  togglePreview() {
    this.previewEnabled = !this.previewEnabled;
    window.previewEnabled = this.previewEnabled; // Update global reference
    
    const elements = this.dom.getElements();
    elements.previewBtn.textContent = this.previewEnabled ? 'Preview Off' : 'Preview On';

    this.updateCameraView();

    // Show feedback
    this.ui.showToast(`Preview ${this.previewEnabled ? 'enabled' : 'disabled'}`, 'info');
    this.ui.logMessage(`Preview ${this.previewEnabled ? 'On' : 'Off'}`);
  }

  /**
   * Update camera view based on current state
   */
  updateCameraView() {
    const cameraView = document.querySelector('.camera-view');
    if (!cameraView) return;

    // Clean up existing preview player
    this.cleanupPreviewPlayer(cameraView);

    if (!this.previewEnabled) {
      this.showCameraMessage(cameraView, 'Preview Disabled');
      return;
    }

    if (!this.cameraStreamUrl && !window.cameraStreamUrl) {
      this.showCameraMessage(cameraView, 'Camera feed not available');
      return;
    }

    // Create new camera stream
    this.createCameraStream(cameraView);
  }

  /**
   * Cleanup existing preview player
   * @param {Element} cameraView Camera view container
   */
  cleanupPreviewPlayer(cameraView) {
    if (this.previewPlayer && this.previewPlayer.parentNode === cameraView) {
      console.log('[Camera] Clearing old preview image src and removing from DOM.');
      this.previewPlayer.src = ''; // Clear src to close connection
      cameraView.removeChild(this.previewPlayer);
      this.previewPlayer = null;
      window.previewPlayer = null;
    } else {
      cameraView.innerHTML = ''; // Fallback cleanup
      if (this.previewPlayer) {
        this.previewPlayer = null;
        window.previewPlayer = null;
      }
    }
  }

  /**
   * Show camera status message
   * @param {Element} cameraView Camera view container
   * @param {string} message Message to display
   */
  showCameraMessage(cameraView, message) {
    const messageDiv = document.createElement('div');
    messageDiv.id = 'camera-placeholder';
    messageDiv.className = 'no-camera';
    messageDiv.textContent = message;
    cameraView.appendChild(messageDiv);
  }

  /**
   * Create new camera stream
   * @param {Element} cameraView Camera view container
   */
  createCameraStream(cameraView) {
    const streamUrl = this.cameraStreamUrl || window.cameraStreamUrl;
    let finalStreamUrl = streamUrl;

    // Handle proxy token replacement
    if (streamUrl && streamUrl.includes('token=PROXY')) {
      const authToken = localStorage.getItem(window.AUTH_TOKEN_KEY);
      finalStreamUrl = streamUrl.replace('token=PROXY', `token=${authToken}`);
    }

    // Create image element
    const imgElement = document.createElement('img');
    imgElement.style.width = '100%';
    imgElement.style.height = '100%';
    imgElement.style.objectFit = 'contain';

    // Setup error handling
    imgElement.onerror = () => {
      console.error('[Camera] Image error for src:', imgElement.src);
      if (this.previewPlayer === imgElement && cameraView.contains(imgElement)) {
        cameraView.innerHTML = '';
        this.showCameraMessage(cameraView, 'Error loading camera feed');
      }
      if (this.previewPlayer === imgElement) {
        this.previewPlayer = null;
        window.previewPlayer = null;
      }
    };

    imgElement.onload = () => {
      console.log('[Camera] Feed loaded successfully');
    };

    // Set source and add to DOM
    console.log(`[Camera] Setting new image src: ${finalStreamUrl}`);
    imgElement.src = finalStreamUrl;
    cameraView.appendChild(imgElement);
    
    // Update references
    this.previewPlayer = imgElement;
    window.previewPlayer = imgElement;
  }

  /**
   * Cleanup camera resources
   */
  cleanup() {
    if (this.previewPlayer) {
      try {
        if (this.previewPlayer.destroy) {
          this.previewPlayer.destroy();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      this.previewPlayer = null;
      window.previewPlayer = null;
    }

    this.cameraStreamUrl = null;
    window.cameraStreamUrl = null;
    this.previewEnabled = false;
    window.previewEnabled = false;
    
    // Update UI
    const elements = this.dom.getElements();
    if (elements.previewBtn) {
      elements.previewBtn.textContent = 'Preview On';
    }
    
    if (elements.cameraPlaceholder) {
      elements.cameraPlaceholder.textContent = 'Preview Disabled';
      elements.cameraPlaceholder.style.display = 'flex';
    }
  }

  /**
   * Get camera status
   * @returns {Object} Camera status information
   */
  getStatus() {
    return {
      previewEnabled: this.previewEnabled,
      hasStreamUrl: !!this.cameraStreamUrl,
      hasPlayer: !!this.previewPlayer
    };
  }

}

// Export for use by other modules
window.CameraManager = CameraManager;
