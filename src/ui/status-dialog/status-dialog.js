// status-dialog.js
let autoRefreshInterval = null;
const AUTO_REFRESH_DELAY = 5000; // 5 seconds

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Set up UI event listeners
  document.getElementById('btn-close').addEventListener('click', () => {
    window.api.send('status-dialog:close');
  });
  
  document.getElementById('btn-refresh').addEventListener('click', requestStats);
  
  // Auto-refresh checkbox
  const autoRefreshCheckbox = document.getElementById('chk-auto-refresh');
  autoRefreshCheckbox.addEventListener('change', () => {
    if (autoRefreshCheckbox.checked) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  });
  
  // Set up IPC listener for stats data
  window.api.receive('status-dialog:receive-stats', (stats) => {
    updateStatsDisplay(stats);
  });
  
  // Initial stats request
  requestStats();
  
  // Start auto-refresh if enabled
  if (autoRefreshCheckbox.checked) {
    startAutoRefresh();
  }
});

// Request fresh stats from main process
function requestStats() {
  window.api.send('status-dialog:request-stats');
}

// Start auto-refresh timer
function startAutoRefresh() {
  stopAutoRefresh(); // Clear any existing timer
  autoRefreshInterval = setInterval(requestStats, AUTO_REFRESH_DELAY);
}

// Stop auto-refresh timer
function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

// Update the status indicator
function updateStatusIndicator(elementId, isActive) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const indicator = element.querySelector('.status-indicator');
  if (indicator) {
    indicator.className = `status-indicator ${isActive ? 'status-active' : 'status-inactive'}`;
  }
}

// Update the stats display with received data
function updateStatsDisplay(stats) {
  // WebUI stats
  const webuiStatus = document.getElementById('webui-status');
  if (webuiStatus) {
    updateStatusIndicator('webui-status', stats.webUI.running);
    webuiStatus.innerHTML = `<span class="status-indicator ${stats.webUI.running ? 'status-active' : 'status-inactive'}"></span>${stats.webUI.running ? 'Running' : 'Stopped'}`;
  }
  
  document.getElementById('webui-clients').textContent = stats.webUI.clients || '0';
  document.getElementById('webui-url').textContent = stats.webUI.url || 'None';
  
  // Camera stats
  const cameraStatus = document.getElementById('camera-status');
  if (cameraStatus) {
    updateStatusIndicator('camera-status', stats.camera.running);
    cameraStatus.innerHTML = `<span class="status-indicator ${stats.camera.running ? 'status-active' : 'status-inactive'}"></span>${stats.camera.running ? 'Running' : 'Stopped'}`;
  }
  
  document.getElementById('camera-port').textContent = stats.camera.port || 'N/A';
  document.getElementById('camera-clients').textContent = stats.camera.clients || '0';
  
  const cameraStreaming = document.getElementById('camera-streaming');
  if (cameraStreaming) {
    updateStatusIndicator('camera-streaming', stats.camera.streaming);
    cameraStreaming.innerHTML = `<span class="status-indicator ${stats.camera.streaming ? 'status-active' : 'status-inactive'}"></span>${stats.camera.streaming ? 'Yes' : 'No'}`;
  }
  
  document.getElementById('camera-url').textContent = stats.camera.url || 'None';
  
  // System stats
  document.getElementById('app-uptime').textContent = formatUptime(stats.system.uptime);
  document.getElementById('memory-usage').textContent = formatMemory(stats.system.memory);
}

// Format uptime in a readable format
function formatUptime(seconds) {
  if (seconds === undefined) return 'Unknown';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours}h ${minutes}m ${secs}s`;
}

// Format memory usage in a readable format
function formatMemory(bytes) {
  if (bytes === undefined) return 'Unknown';
  
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

// Clean up when window is closed
window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
  window.api.removeListener('status-dialog:receive-stats');
});
