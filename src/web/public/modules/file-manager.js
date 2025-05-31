// src/web/public/modules/file-manager.js

/**
 * File Management Module
 * Handles file selection, modal operations, and print job management
 */
class FileManager {
  constructor(domManager, uiUtils) {
    this.dom = domManager;
    this.ui = uiUtils;
    this.selectedFilename = null;
  }

  /**
   * Initialize file manager
   */
  initialize() {
    window.selectedFilename = null; // Global compatibility
    this.setupEventHandlers();
  }

  /**
   * Setup file management event handlers
   */
  setupEventHandlers() {
    const elements = this.dom.getElements();

    // File selection buttons
    elements.startRecentBtn.addEventListener('click', () => this.showFileSelection(true));
    elements.startLocalBtn.addEventListener('click', () => this.showFileSelection(false));

    // File modal controls
    elements.closeModal.addEventListener('click', () => this.hideFileModal());
    elements.printFileBtn.addEventListener('click', () => this.handlePrintFile());
  }

  /**
   * Show file selection modal and request file list
   * @param {boolean} isRecent Whether to show recent files (true) or all local files (false)
   * @param {Function} sendCommand Function to send commands to server
   */
  showFileSelection(isRecent, sendCommand) {
    if (!sendCommand && window.wsManager) {
      sendCommand = (cmd, data) => window.wsManager.sendCommand(cmd, data);
    }
    
    if (sendCommand) {
      sendCommand(isRecent ? 'get-recent-files' : 'get-local-files');
    } else {
      console.error('No sendCommand function available for file selection');
    }
  }

  /**
   * Handle job list response from server
   * @param {Object} message Job list message from server
   */
  handleJobList(message) {
    console.log('Received job list:', message);
    const { files, isRecent } = message;

    const processedFiles = this.processFileList(files);
    console.log('Processed file objects:', processedFiles);
    
    this.populateFileList(processedFiles);
    this.showFileModal(isRecent ? 'Recent Files' : 'Local Files');
  }

  /**
   * Process raw file list into standardized format
   * @param {Array|Object} files Raw file list from server
   * @returns {Array} Processed file objects
   */
  processFileList(files) {
    if (Array.isArray(files)) {
      return files.map(file => this.normalizeFileObject(file));
    } else if (files && typeof files === 'object') {
      // Convert object keys to array
      const fileArray = [];
      Object.keys(files).forEach(key => {
        const value = files[key];
        if (typeof value === 'string') {
          fileArray.push({ name: value, displayName: value });
        } else if (typeof value === 'object') {
          fileArray.push(this.normalizeFileObject(value, key));
        }
      });
      console.log('Converted files object to array:', fileArray);
      return fileArray;
    }
    
    return [];
  }

  /**
   * Normalize file object to standard format
   * @param {string|Object} file File data
   * @param {string} fallbackKey Fallback key for object files
   * @returns {Object} Normalized file object
   */
  normalizeFileObject(file, fallbackKey = 'Unknown file') {
    if (typeof file === 'string') {
      return { name: file, displayName: file };
    }
    
    // Extract name from various possible properties
    const name = file.name || file.fileName || file.Filename || fallbackKey;
    const displayName = file.displayName || name;
    
    return { name, displayName };
  }

  /**
   * Populate file list in modal
   * @param {Array} files Array of file objects
   */
  populateFileList(files) {
    const elements = this.dom.getElements();
    
    elements.fileList.innerHTML = '';
    this.selectedFilename = null;
    window.selectedFilename = null;
    elements.printFileBtn.disabled = true;

    console.log('Populating file list with:', files);

    if (!files || files.length === 0) {
      elements.fileList.innerHTML = '<div class="file-empty">No files available</div>';
      return;
    }

    // Create file items
    files.forEach(file => {
      const fileItem = this.createFileItem(file);
      elements.fileList.appendChild(fileItem);
    });
  }

  /**
   * Create individual file item element
   * @param {Object} file File object
   * @returns {Element} File item element
   */
  createFileItem(file) {
    console.log('Processing file:', file);
    
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.textContent = file.displayName;
    fileItem.dataset.filename = file.name;

    fileItem.addEventListener('click', () => {
      this.selectFile(fileItem);
    });

    return fileItem;
  }

  /**
   * Select a file in the list
   * @param {Element} fileItem File item element
   */
  selectFile(fileItem) {
    // Deselect all files
    document.querySelectorAll('.file-item').forEach(item => {
      item.classList.remove('selected');
    });

    // Select this file
    fileItem.classList.add('selected');
    this.selectedFilename = fileItem.dataset.filename;
    window.selectedFilename = this.selectedFilename;
    
    const elements = this.dom.getElements();
    elements.printFileBtn.disabled = false;
  }

  /**
   * Show file modal with title
   * @param {string} title Modal title
   */
  showFileModal(title = 'Select File') {
    const elements = this.dom.getElements();
    elements.modalTitle.textContent = title;
    elements.fileModal.classList.add('show');
  }

  /**
   * Hide file modal
   */
  hideFileModal() {
    const elements = this.dom.getElements();
    elements.fileModal.classList.remove('show');
  }

  /**
   * Handle print file button click
   * @param {Function} sendCommand Function to send commands to server
   */
  handlePrintFile(sendCommand) {
    if (!this.selectedFilename) return;

    if (!sendCommand && window.wsManager) {
      sendCommand = (cmd, data) => window.wsManager.sendCommand(cmd, data);
    }

    const elements = this.dom.getElements();
    const autoLevel = elements.autoLevel.checked;
    const startNow = elements.startNow.checked;

    if (sendCommand) {
      sendCommand('print-file', {
        filename: this.selectedFilename,
        leveling: autoLevel,
        startNow: startNow
      });
    }

    this.hideFileModal();

    // Log actions and show feedback
    this.ui.logMessage(`Selected job: ${this.selectedFilename}`);
    this.ui.logMessage(`Leveling: ${autoLevel ? 'Yes' : 'No'}`);
    this.ui.logMessage(`Start now: ${startNow ? 'Yes' : 'No'}`);

    const action = startNow ? 'Starting' : 'Selected';
    this.ui.showToast(`${action} job: ${this.selectedFilename}`, 'info');
  }

  /**
   * Get file manager status
   * @returns {Object} File manager status
   */
  getStatus() {
    return {
      selectedFile: this.selectedFilename,
      modalVisible: this.dom.getElement('fileModal')?.classList.contains('show') || false,
      fileCount: document.querySelectorAll('.file-item').length
    };
  }

}

// Export for use by other modules
window.FileManager = FileManager;
