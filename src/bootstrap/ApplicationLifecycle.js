const { app, BrowserWindow } = require('electron');

class ApplicationLifecycle {
  constructor(bootstrapper) {
    this.bootstrapper = bootstrapper;
    this.isInitialized = false;
  }

  /**
   * Set up all application lifecycle event handlers
   */
  setupLifecycleEvents() {
    app.whenReady().then(() => this._handleAppReady());
    app.on('activate', () => this._handleActivate());
    app.on('window-all-closed', () => this._handleWindowAllClosed());
    app.on('will-quit', () => this._handleWillQuit());
  }

  /**
   * Handle app ready event - main initialization
   * @private
   */
  async _handleAppReady() {
    if (this.isInitialized) {
      return;
    }

    console.log('Application ready - starting initialization...');
    
    try {
      // Initialize all application components through bootstrapper
      await this.bootstrapper.initialize();
      const mainWindow = this.bootstrapper.createMainWindow();
      if (process.env.NODE_ENV === 'development') { mainWindow.webContents.openDevTools(); } // Open DevTools in development mode
      mainWindow.webContents.on('did-finish-load', async () => { await this.bootstrapper.startConnectionFlow(mainWindow); }); // Start connection flow after window loads
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize application:', error);
    }
  }

  /**
   * Handle activate event (macOS)
   * @private
   */
  _handleActivate() {
    // On macOS, it's common to re-create a window in the app when the dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0 && this.isInitialized) { this.bootstrapper.createMainWindow(); }
  }

  /**
   * Handle window all closed event
   * @private
   */
  _handleWindowAllClosed() {
    // Quit when all windows are closed, except on macOS.
    if (process.platform !== 'darwin') {
      this._performCleanup();
      app.quit();
    }
  }

  /**
   * Handle will quit event
   * @private
   */
  _handleWillQuit() {
    console.log('Application will quit - performing cleanup...');
    this._performCleanup();
  }

  /**
   * Perform application cleanup
   * @private
   */
  _performCleanup() {
    if (this.bootstrapper) { this.bootstrapper.dispose(); }
  }

}

module.exports = ApplicationLifecycle;
