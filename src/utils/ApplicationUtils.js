// src/utils/ApplicationUtils.js - Application utility functions
const os = require('os');
const NotificationUtils = require('./NotificationUtils');

class ApplicationUtils {
  /**
   * Show job uploader window via DialogManager
   * @param {DialogManager} dialogManager - Dialog manager instance
   * @returns {Promise} Dialog result
   */
  static showJobUploaderWindow(dialogManager) {
    return dialogManager.showJobUploaderDialog();
  }

  /**
   * Show send commands window with connection validation
   * @param {DialogManager} dialogManager - Dialog manager instance
   * @param {PrinterConnectionManager} printerConnectionManager - Printer connection manager
   * @param {WindowManager} windowManager - Window manager instance
   */
  static showSendCmdsWindow(dialogManager, printerConnectionManager, windowManager) {
    
    if (!printerConnectionManager.getConnectionStatus()) {
      console.log('Cannot open Send Commands window - printer not connected');
      windowManager.getMainWindow()?.webContents.send('log-message', 'Error: Printer not connected. Cannot send commands.');
      NotificationUtils.showNotification('Connection Error', 'Please connect to a printer first.');
      return;
    }
    
    return dialogManager.showCommandTerminalDialog();
  }

  /**
   * Get local IP address (prefers 192.168.x.x)
   * @returns {string} Local IP address
   */
  static getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    let serverIP = '127.0.0.1'; // Default fallback
    
    for (const key in interfaces) {
      const interfaceList = interfaces[key];
      for (const iface of interfaceList) {
        if (!iface.internal && iface.family === 'IPv4') {
          if (iface.address.startsWith('192.168.')) {
            serverIP = iface.address;
            break;
          } else if (serverIP === '127.0.0.1') {
            serverIP = iface.address;
          }
        }
      }
      if (serverIP.startsWith('192.168.')) break;
    }
    
    return serverIP;
  }

  /**
   * Collect comprehensive system statistics
   * @param {Object} configManager - Configuration manager
   * @param {Object} webUIServer - WebUI server instance
   * @param {Object} cameraService - Camera service instance
   * @returns {Object} System statistics
   */
  static collectSystemStats(configManager, webUIServer, cameraService) {
    const startTime = process.getCreationTime ? process.getCreationTime() : Date.now() - process.uptime() * 1000;
    const uptime = (Date.now() - startTime) / 1000; // in seconds
    
    // Get memory usage
    const memoryUsage = process.memoryUsage().rss;
    
    // WebUI stats  
    const localIp = ApplicationUtils.getLocalIpAddress();
    const webuiPort = configManager.getConfig().WebUIPort || 3000;
    const webuiRunning = webUIServer !== null && configManager.getConfig().WebUIEnabled !== false;
    
    let webuiUrl = 'N/A';
    if (webuiRunning) {
      webuiUrl = `http://${localIp}:${webuiPort}`;
    }
    
    const webUIStats = {
      running: webuiRunning,
      port: webuiPort,
      clients: webUIServer ? (webUIServer.websocketClients ? webUIServer.websocketClients.size : 0) : 0,
      url: webuiUrl
    };
    
    // Camera stats
    const cameraProxyPortFromConfig = configManager.getConfig().CameraProxyPort || 8181;
    const actualCameraProxyPort = cameraService && cameraService.port ? cameraService.port : cameraProxyPortFromConfig;
    
    let proxyUrl = 'N/A';
    if (cameraService && cameraService.isInitialized) {
      proxyUrl = `http://${localIp}:${actualCameraProxyPort}`;
    }

    const cameraStats = {
      running: cameraService ? cameraService.isInitialized : false,
      streaming: cameraService ? cameraService.isStreaming : false,
      port: actualCameraProxyPort, 
      clients: cameraService ? cameraService.activeClients : 0,
      url: proxyUrl 
    };
    
    return {
      webUI: webUIStats,
      camera: cameraStats,
      system: {
        uptime: uptime,
        memory: memoryUsage
      }
    };
  }
}

module.exports = ApplicationUtils;
