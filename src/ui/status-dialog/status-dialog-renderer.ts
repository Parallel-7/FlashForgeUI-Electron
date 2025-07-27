// src/ui/status-dialog/status-dialog-renderer.ts

interface IStatusAPI {
  requestStats: () => Promise<StatusStats | null>;
  closeWindow: () => void;
  receiveStats: (callback: (stats: StatusStats) => void) => void;
  removeListeners: () => void;
}

declare global {
  interface Window {
    statusAPI?: IStatusAPI;
  }
}

// Ensure this file is treated as a module
export {};

interface PrinterInfo {
  model: string;
  machineType: string;
  firmwareVersion: string;
  serialNumber: string;
  toolCount: number;
  ipAddress: string;
  isConnected: boolean;
}

interface StatusStats {
  printerInfo: PrinterInfo;
  webuiStatus: boolean;
  webuiClients: number;
  webuiUrl: string;
  cameraStatus: boolean;
  cameraPort: number;
  cameraClients: number;
  cameraStreaming: boolean;
  cameraUrl: string;
  appUptime: number;
  memoryUsage: number;
}

let autoRefreshInterval: NodeJS.Timeout | null = null;
const AUTO_REFRESH_DELAY = 5000; // 5 seconds

async function requestStats(): Promise<void> {
  if (window.statusAPI) {
    console.log('Requesting stats...');
    try {
      const stats = await window.statusAPI.requestStats();
      if (stats) {
        console.log('Received stats:', stats);
        updateStatsDisplay(stats);
      } else {
        console.warn('No stats received');
      }
    } catch (error) {
      console.error('Error requesting stats:', error);
    }
  }
}

function startAutoRefresh(): void {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
  // Always auto-refresh
  autoRefreshInterval = setInterval(requestStats, AUTO_REFRESH_DELAY);
}

function stopAutoRefresh(): void {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}



function updatePrinterInfo(printerInfo: PrinterInfo): void {
  // Update printer model
  const printerModel = document.getElementById('printer-model');
  if (printerModel) printerModel.textContent = printerInfo.model || 'Unknown';
  
  // Update machine type
  const machineType = document.getElementById('printer-machine-type');
  if (machineType) machineType.textContent = printerInfo.machineType || 'Unknown';
  
  // Update firmware version
  const firmware = document.getElementById('printer-firmware');
  if (firmware) firmware.textContent = printerInfo.firmwareVersion || 'Unknown';
  
  // Update serial number
  const serial = document.getElementById('printer-serial');
  if (serial) serial.textContent = printerInfo.serialNumber || 'Unknown';
  
  // Update tool count
  const toolCount = document.getElementById('printer-tool-count');
  if (toolCount) toolCount.textContent = printerInfo.toolCount?.toString() || '0';
  
  // Update IP address
  const ipAddress = document.getElementById('printer-ip');
  if (ipAddress) ipAddress.textContent = printerInfo.ipAddress || 'Not Connected';
  
  // Update connection status
  const connectionStatus = document.getElementById('printer-connection-status');
  if (connectionStatus) {
    connectionStatus.innerHTML = printerInfo.isConnected 
      ? '<span class="status-indicator status-active"></span>Connected'
      : '<span class="status-indicator status-inactive"></span>Disconnected';
  }
}

function updateStatsDisplay(stats: StatusStats): void {
  // Update printer information
  updatePrinterInfo(stats.printerInfo);
  
  // Update WebUI status
  const webuiStatus = document.getElementById('webui-status');
  if (webuiStatus) {
    const indicator = webuiStatus.querySelector('.status-indicator');
    if (indicator) {
      indicator.className = `status-indicator ${stats.webuiStatus ? 'status-active' : 'status-inactive'}`;
    }
    webuiStatus.innerHTML = `<span class="status-indicator ${stats.webuiStatus ? 'status-active' : 'status-inactive'}"></span>${stats.webuiStatus ? 'Active' : 'Inactive'}`;
  }
  
  const webuiClients = document.getElementById('webui-clients');
  if (webuiClients) webuiClients.textContent = stats.webuiClients.toString();
  
  const webuiUrl = document.getElementById('webui-url');
  if (webuiUrl) webuiUrl.textContent = stats.webuiUrl || 'None';
  
  // Update Camera status
  const cameraStatus = document.getElementById('camera-status');
  if (cameraStatus) {
    const indicator = cameraStatus.querySelector('.status-indicator');
    if (indicator) {
      indicator.className = `status-indicator ${stats.cameraStatus ? 'status-active' : 'status-inactive'}`;
    }
    cameraStatus.innerHTML = `<span class="status-indicator ${stats.cameraStatus ? 'status-active' : 'status-inactive'}"></span>${stats.cameraStatus ? 'Active' : 'Inactive'}`;
  }
  
  const cameraPort = document.getElementById('camera-port');
  if (cameraPort) cameraPort.textContent = stats.cameraPort?.toString() || 'Unknown';
  
  const cameraClients = document.getElementById('camera-clients');
  if (cameraClients) cameraClients.textContent = stats.cameraClients?.toString() || '0';
  
  const cameraStreaming = document.getElementById('camera-streaming');
  if (cameraStreaming) {
    const indicator = cameraStreaming.querySelector('.status-indicator');
    if (indicator) {
      indicator.className = `status-indicator ${stats.cameraStreaming ? 'status-active' : 'status-inactive'}`;
    }
    cameraStreaming.innerHTML = `<span class="status-indicator ${stats.cameraStreaming ? 'status-active' : 'status-inactive'}"></span>${stats.cameraStreaming ? 'Yes' : 'No'}`;
  }
  
  const cameraUrl = document.getElementById('camera-url');
  if (cameraUrl) cameraUrl.textContent = stats.cameraUrl || 'None';
  
  // Update System Information
  const appUptime = document.getElementById('app-uptime');
  if (appUptime) appUptime.textContent = formatUptime(stats.appUptime || 0);
  
  const memoryUsage = document.getElementById('memory-usage');
  if (memoryUsage) memoryUsage.textContent = formatMemory(stats.memoryUsage || 0);
}

function formatUptime(uptimeSeconds: number): string {
  if (!uptimeSeconds) return 'Unknown';
  
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const secs = Math.floor(uptimeSeconds % 60);
  
  return `${hours}h ${minutes}m ${secs}s`;
}

function formatMemory(memoryBytes: number): string {
  if (!memoryBytes) return 'Unknown';
  
  const mb = (memoryBytes / (1024 * 1024)).toFixed(1);
  return `${mb} MB`;
}

function setupEventListeners(): void {
  // Close button
  const closeBtn = document.getElementById('btn-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (window.statusAPI) {
        window.statusAPI.closeWindow();
      }
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Status dialog renderer initialized');
  
  setupEventListeners();
  
  // Set up API communication if available
  if (window.statusAPI) {
    window.statusAPI.receiveStats(updateStatsDisplay);
    // Request initial stats
    void requestStats();
    // Start auto-refresh immediately
    startAutoRefresh();
  } else {
    console.warn('Status API not available');
    // Show placeholder data
    updateStatsDisplay({
      printerInfo: {
        model: 'Not Connected',
        machineType: 'Unknown',
        firmwareVersion: 'Unknown',
        serialNumber: 'Unknown',
        toolCount: 0,
        ipAddress: 'Not Connected',
        isConnected: false
      },
      webuiStatus: false,
      webuiClients: 0,
      webuiUrl: 'None',
      cameraStatus: false,
      cameraPort: 0,
      cameraClients: 0,
      cameraStreaming: false,
      cameraUrl: 'None',
      appUptime: 0,
      memoryUsage: 0
    });
  }
});

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
  if (window.statusAPI) {
    window.statusAPI.removeListeners();
  }
});