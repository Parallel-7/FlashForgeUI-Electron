/**
 * Web UI Client Application
 * Handles authentication, WebSocket communication, and UI updates.
 * Written in TypeScript for type safety and better maintainability.
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface AuthResponse {
  success: boolean;
  token?: string;
  message?: string;
}

interface WebSocketMessage {
  type: 'AUTH_SUCCESS' | 'STATUS_UPDATE' | 'ERROR' | 'COMMAND_RESULT' | 'PONG';
  timestamp: string;
  status?: PrinterStatus;
  error?: string;
  clientId?: string;
  command?: string;
  success?: boolean;
}

interface WebSocketCommand {
  command: 'REQUEST_STATUS' | 'EXECUTE_GCODE' | 'PING';
  gcode?: string;
  data?: unknown;
}

interface PrinterStatus {
  printerState: string;
  bedTemperature: number;
  bedTargetTemperature: number;
  nozzleTemperature: number;
  nozzleTargetTemperature: number;
  progress: number;
  currentLayer?: number;
  totalLayers?: number;
  jobName?: string;
  timeElapsed?: number;
  timeRemaining?: number;
  filtrationMode?: 'external' | 'internal' | 'none';
  estimatedWeight?: number;
  estimatedLength?: number;
  thumbnailData?: string | null; // Base64 encoded thumbnail
  cumulativeFilament?: number; // Total lifetime filament usage in meters
  cumulativePrintTime?: number; // Total lifetime print time in minutes
}

interface PrinterFeatures {
  hasCamera: boolean;
  hasLED: boolean;
  hasFiltration: boolean;
  hasMaterialStation: boolean;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
}

interface JobFile {
  fileName: string;
  displayName: string;
  size?: number;
  lastModified?: string;
  thumbnail?: string;
}

// API Response interfaces
interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

type PrinterCommandResponse = ApiResponse;

interface PrinterFeaturesResponse extends ApiResponse {
  features?: PrinterFeatures;
}

interface CameraProxyConfigResponse extends ApiResponse {
  streamType?: 'mjpeg' | 'rtsp';
  port?: number;  // For MJPEG camera proxy
  wsPort?: number;  // For RTSP WebSocket port
  url?: string;
  wsPath?: string;
  ffmpegAvailable?: boolean;
}

interface FileListResponse extends ApiResponse {
  files?: JobFile[];
}

type PrintJobStartResponse = ApiResponse;

interface PrinterContext {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  serialNumber: string;
  isActive: boolean;
}

interface ContextsResponse extends ApiResponse {
  contexts?: PrinterContext[];
  activeContextId?: string;
}

// Extended HTMLElement for temperature dialog
interface TemperatureDialogElement extends HTMLElement {
  temperatureType?: 'bed' | 'extruder';
}

// ============================================================================
// GLOBAL STATE
// ============================================================================

class AppState {
  public isAuthenticated: boolean = false;
  public authToken: string | null = null;
  public websocket: WebSocket | null = null;
  public isConnected: boolean = false;
  public printerStatus: PrinterStatus | null = null;
  public printerFeatures: PrinterFeatures | null = null;
  public selectedFile: string | null = null;
  public reconnectAttempts: number = 0;
  public maxReconnectAttempts: number = 5;
  public reconnectDelay: number = 2000;
}

const state = new AppState();

// ============================================================================
// DOM HELPERS
// ============================================================================

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function showElement(id: string): void {
  const element = $(id);
  if (element) {
    element.classList.remove('hidden');
  }
}

function hideElement(id: string): void {
  const element = $(id);
  if (element) {
    element.classList.add('hidden');
  }
}

function setTextContent(id: string, text: string): void {
  const element = $(id);
  if (element) {
    element.textContent = text;
  }
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const toast = $('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = `toast ${type}`;
  showElement('toast');
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => hideElement('toast'), 300);
  }, 3000);
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function login(password: string, rememberMe: boolean): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password, rememberMe })
    });
    
    const result: AuthResponse = await response.json() as AuthResponse;
    
    if (result.success && result.token) {
      state.authToken = result.token;
      state.isAuthenticated = true;
      
      // Store token if remember me is checked
      if (rememberMe) {
        localStorage.setItem('webui-token', result.token);
      } else {
        sessionStorage.setItem('webui-token', result.token);
      }
      
      return true;
    } else {
      setTextContent('login-error', result.message || 'Login failed');
      return false;
    }
  } catch (error) {
    console.error('Login error:', error);
    setTextContent('login-error', 'Network error. Please try again.');
    return false;
  }
}

async function logout(): Promise<void> {
  if (state.authToken) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.authToken}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  // Clear state and storage
  state.authToken = null;
  state.isAuthenticated = false;
  localStorage.removeItem('webui-token');
  sessionStorage.removeItem('webui-token');
  
  // Disconnect WebSocket
  if (state.websocket) {
    state.websocket.close();
  }
  
  // Show login screen
  showElement('login-screen');
  hideElement('main-ui');
}

// ============================================================================
// WEBSOCKET CONNECTION
// ============================================================================

function connectWebSocket(): void {
  if (!state.authToken) {
    console.error('Cannot connect WebSocket without auth token');
    return;
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws?token=${state.authToken}`;
  
  try {
    state.websocket = new WebSocket(wsUrl);
    
    state.websocket.onopen = () => {
      console.log('WebSocket connected');
      state.isConnected = true;
      state.reconnectAttempts = 0;
      updateConnectionStatus(true);
      
      // Request initial status
      sendCommand({ command: 'REQUEST_STATUS' });
    };
    
    state.websocket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data) as WebSocketMessage;
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    state.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Don't automatically logout - let the reconnect logic handle it
    };
    
    state.websocket.onclose = () => {
      console.log('WebSocket disconnected');
      state.isConnected = false;
      state.websocket = null;
      updateConnectionStatus(false);
      
      // Attempt to reconnect
      if (state.isAuthenticated && state.reconnectAttempts < state.maxReconnectAttempts) {
        state.reconnectAttempts++;
        setTimeout(() => connectWebSocket(), state.reconnectDelay * state.reconnectAttempts);
      }
    };
  } catch (error) {
    console.error('Failed to create WebSocket:', error);
  }
}

function sendCommand(command: WebSocketCommand): void {
  if (!state.websocket || state.websocket.readyState !== WebSocket.OPEN) {
    console.error('WebSocket not connected');
    showToast('Not connected to server', 'error');
    return;
  }
  
  state.websocket.send(JSON.stringify(command));
}

function handleWebSocketMessage(message: WebSocketMessage): void {
  switch (message.type) {
    case 'AUTH_SUCCESS':
      console.log('WebSocket authenticated:', message.clientId);
      break;
      
    case 'STATUS_UPDATE':
      if (message.status) {
        updatePrinterStatus(message.status);
      }
      break;
      
    case 'ERROR':
      console.error('WebSocket error:', message.error);
      showToast(message.error || 'An error occurred', 'error');
      break;
      
    case 'COMMAND_RESULT':
      if (message.success) {
        showToast('Command executed successfully', 'success');
      } else {
        showToast(message.error || 'Command failed', 'error');
      }
      break;
      
    case 'PONG':
      // Keep-alive response
      break;
  }
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateConnectionStatus(connected: boolean): void {
  const indicator = $('connection-indicator');
  const text = $('connection-text');
  
  if (indicator) {
    if (connected) {
      indicator.classList.add('connected');
    } else {
      indicator.classList.remove('connected');
    }
  }
  
  if (text) {
    text.textContent = connected ? 'Connected' : 'Disconnected';
  }
}

function updatePrinterStatus(status: PrinterStatus | null): void {
  if (!status) {
    // Handle null status
    updatePrinterStateCard(null);
    setTextContent('bed-temp', '--°C / --°C');
    setTextContent('extruder-temp', '--°C / --°C');
    setTextContent('current-job', 'No data');
    setTextContent('progress-percentage', '0%');
    updateModelPreview(null);
    return;
  }
  
  state.printerStatus = status;
  
  // Update printer state card with lifetime statistics
  updatePrinterStateCard(status);
  
  // Update temperatures with null checks and NaN prevention
  const bedTemp = isNaN(status.bedTemperature) ? 0 : Math.round(status.bedTemperature);
  const bedTarget = isNaN(status.bedTargetTemperature) ? 0 : Math.round(status.bedTargetTemperature);
  const extruderTemp = isNaN(status.nozzleTemperature) ? 0 : Math.round(status.nozzleTemperature);
  const extruderTarget = isNaN(status.nozzleTargetTemperature) ? 0 : Math.round(status.nozzleTargetTemperature);
  
  setTextContent('bed-temp', `${bedTemp}°C / ${bedTarget}°C`);
  setTextContent('extruder-temp', `${extruderTemp}°C / ${extruderTarget}°C`);
  
  // Update job info
  if (status.jobName) {
    setTextContent('current-job', status.jobName);
    
    // Progress with null check and NaN prevention
    const progress = isNaN(status.progress) ? 0 : status.progress;
    const progressPercent = progress <= 1 ? Math.round(progress * 100) : Math.round(progress);
    setTextContent('progress-percentage', `${progressPercent}%`);
    
    const progressBar = $('progress-bar') as HTMLProgressElement;
    if (progressBar) {
      progressBar.value = progressPercent;
    }
    
    // Update layer info with null checks
    if (status.currentLayer !== undefined && status.totalLayers !== undefined && 
        !isNaN(status.currentLayer) && !isNaN(status.totalLayers)) {
      setTextContent('layer-info', `${status.currentLayer} / ${status.totalLayers}`);
    } else {
      setTextContent('layer-info', '-- / --');
    }
    
    // Update times with null checks
    if (status.timeElapsed !== undefined && !isNaN(status.timeElapsed)) {
      setTextContent('elapsed-time', formatTime(status.timeElapsed));
    } else {
      setTextContent('elapsed-time', '--:--');
    }
    
    if (status.timeRemaining !== undefined && !isNaN(status.timeRemaining)) {
      setTextContent('time-remaining', formatETA(status.timeRemaining));
    } else {
      setTextContent('time-remaining', '--:--');
    }
    
    // Update weight and length with null checks
    if (status.estimatedWeight !== undefined && !isNaN(status.estimatedWeight)) {
      setTextContent('job-weight', `${status.estimatedWeight.toFixed(1)}g`);
    } else {
      setTextContent('job-weight', '--');
    }
    
    if (status.estimatedLength !== undefined && !isNaN(status.estimatedLength)) {
      setTextContent('job-length', `${status.estimatedLength.toFixed(2)}m`);
    } else {
      setTextContent('job-length', '--');
    }
    
    // Update model preview thumbnail
    updateModelPreview(status.thumbnailData);
  } else {
    setTextContent('current-job', 'No active job');
    setTextContent('progress-percentage', '0%');
    const progressBar = $('progress-bar') as HTMLProgressElement;
    if (progressBar) {
      progressBar.value = 0;
    }
    setTextContent('layer-info', '-- / --');
    setTextContent('elapsed-time', '--:--');
    setTextContent('time-remaining', '--:--');
    setTextContent('job-weight', '--');
    setTextContent('job-length', '--');
    
    // Clear model preview when no job
    updateModelPreview(null);
  }
  
  // Update button states based on printer state
  updateButtonStates(status.printerState || 'Unknown');
  
  // Update filtration status if available
  updateFiltrationStatus(status.filtrationMode);
}

function updateButtonStates(printerState: string): void {
  const isPrintingActive = printerState === 'Printing' || 
                          printerState === 'Paused' ||
                          printerState === 'Calibrating' ||
                          printerState === 'Heating' ||
                          printerState === 'Pausing';
                          
  const isReadyForNewJob = printerState === 'Ready' || 
                          printerState === 'Completed' ||
                          printerState === 'Cancelled';
                          
  const canControlJob = printerState === 'Printing' ||
                       printerState === 'Paused' ||
                       printerState === 'Heating' ||
                       printerState === 'Calibrating';
                       
  const isBusy = printerState === 'Busy' || printerState === 'Error';
  
  // Pause/Resume buttons
  const pauseBtn = $('btn-pause') as HTMLButtonElement;
  const resumeBtn = $('btn-resume') as HTMLButtonElement;
  const cancelBtn = $('btn-cancel') as HTMLButtonElement;
  
  if (pauseBtn) pauseBtn.disabled = printerState !== 'Printing';
  if (resumeBtn) resumeBtn.disabled = printerState !== 'Paused';
  if (cancelBtn) cancelBtn.disabled = !canControlJob;
  
  // File selection buttons and Home Axes button
  const recentBtn = $('btn-start-recent') as HTMLButtonElement;
  const localBtn = $('btn-start-local') as HTMLButtonElement;
  const homeAxesBtn = $('btn-home-axes') as HTMLButtonElement;
  
  if (recentBtn) recentBtn.disabled = !isReadyForNewJob;
  if (localBtn) localBtn.disabled = !isReadyForNewJob;
  if (homeAxesBtn) homeAxesBtn.disabled = isPrintingActive;
  
  // Temperature control buttons - disable during active states or when disconnected
  const bedSetBtn = $('btn-bed-set') as HTMLButtonElement;
  const bedOffBtn = $('btn-bed-off') as HTMLButtonElement;
  const extruderSetBtn = $('btn-extruder-set') as HTMLButtonElement;
  const extruderOffBtn = $('btn-extruder-off') as HTMLButtonElement;
  
  const tempButtonsDisabled = isPrintingActive || isBusy;
  if (bedSetBtn) bedSetBtn.disabled = tempButtonsDisabled;
  if (bedOffBtn) bedOffBtn.disabled = tempButtonsDisabled;
  if (extruderSetBtn) extruderSetBtn.disabled = tempButtonsDisabled;
  if (extruderOffBtn) extruderOffBtn.disabled = tempButtonsDisabled;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }
  return `${mins}:00`;
}

function formatETA(remainingMinutes: number): string {
  // Calculate completion time by adding remaining minutes to current time
  const now = new Date();
  const completionTime = new Date(now.getTime() + remainingMinutes * 60 * 1000);
  
  // Format as 12-hour time with AM/PM
  return completionTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatLifetimePrintTime(minutes: number): string {
  if (!minutes || isNaN(minutes) || minutes <= 0) {
    return '--';
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours >= 1000) {
    // Format with comma for thousands (e.g., "1,250h 30m")
    return `${hours.toLocaleString()}h ${remainingMinutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  } else {
    return `${remainingMinutes}m`;
  }
}

function formatLifetimeFilament(meters: number): string {
  if (!meters || isNaN(meters) || meters <= 0) {
    return '--';
  }
  
  // Display in meters with 2 decimal places, matching main UI format
  return `${meters.toFixed(2)}m`;
}

function updatePrinterStateCard(status: PrinterStatus | null): void {
  // Update printer status
  if (status && status.printerState) {
    setTextContent('printer-status', status.printerState);
  } else {
    setTextContent('printer-status', 'Unknown');
  }
  
  // Update lifetime print time
  if (status && status.cumulativePrintTime !== undefined) {
    const formattedTime = formatLifetimePrintTime(status.cumulativePrintTime);
    setTextContent('lifetime-print-time', formattedTime);
  } else {
    setTextContent('lifetime-print-time', '--');
  }
  
  // Update lifetime filament usage
  if (status && status.cumulativeFilament !== undefined) {
    const formattedFilament = formatLifetimeFilament(status.cumulativeFilament);
    setTextContent('lifetime-filament', formattedFilament);
  } else {
    setTextContent('lifetime-filament', '--');
  }
}

// ============================================================================
// MULTI-PRINTER CONTEXT MANAGEMENT
// ============================================================================

async function fetchPrinterContexts(): Promise<void> {
  if (!state.authToken) {
    console.log('[Contexts] No auth token, skipping context fetch');
    return;
  }

  try {
    const response = await fetch('/api/contexts', {
      headers: {
        'Authorization': `Bearer ${state.authToken}`
      }
    });

    const result = await response.json() as ContextsResponse;

    if (result.success && result.contexts) {
      console.log('[Contexts] Fetched contexts:', result.contexts);
      updatePrinterSelector(result.contexts, result.activeContextId || '');
    } else {
      console.error('[Contexts] Failed to fetch contexts:', result.error);
    }
  } catch (error) {
    console.error('[Contexts] Error fetching contexts:', error);
  }
}

function updatePrinterSelector(contexts: PrinterContext[], activeContextId: string): void {
  const selector = $('printer-selector');
  const select = $('printer-select') as HTMLSelectElement;

  if (!selector || !select) {
    console.error('[Contexts] Printer selector elements not found');
    return;
  }

  // Show selector only if there are multiple printers
  if (contexts.length > 1) {
    showElement('printer-selector');
  } else {
    hideElement('printer-selector');
    return;
  }

  // Clear existing options
  select.innerHTML = '';

  // Populate with printer contexts
  contexts.forEach(context => {
    const option = document.createElement('option');
    option.value = context.id;
    option.textContent = `${context.name} (${context.ipAddress})`;

    if (context.isActive || context.id === activeContextId) {
      option.selected = true;
    }

    select.appendChild(option);
  });
}

async function switchPrinterContext(contextId: string): Promise<void> {
  if (!state.authToken) {
    showToast('Not authenticated', 'error');
    return;
  }

  try {
    const response = await fetch('/api/contexts/switch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contextId })
    });

    const result = await response.json() as ApiResponse;

    if (result.success) {
      console.log('[Contexts] Switched to context:', contextId);
      showToast(result.message || 'Switched printer', 'success');

      // Reload features for the new context (handles filtration visibility, etc.)
      await loadPrinterFeatures();

      // Request fresh status for the new context
      sendCommand({ command: 'REQUEST_STATUS' });

      // Reload camera stream for the new context (uses updated camera proxy port)
      await loadCameraStream();
    } else {
      showToast(result.error || 'Failed to switch printer', 'error');
    }
  } catch (error) {
    console.error('[Contexts] Error switching context:', error);
    showToast('Failed to switch printer', 'error');
  }
}

// ============================================================================
// PRINTER CONTROLS
// ============================================================================

async function sendPrinterCommand(endpoint: string, data?: unknown): Promise<void> {
  if (!state.authToken) {
    showToast('Not authenticated', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/printer/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.authToken}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    const result = await response.json() as PrinterCommandResponse;
    
    if (result.success) {
      showToast(result.message || 'Command sent', 'success');
    } else {
      showToast(result.error || 'Command failed', 'error');
    }
  } catch (error) {
    console.error('Command error:', error);
    showToast('Failed to send command', 'error');
  }
}

async function loadPrinterFeatures(): Promise<void> {
  if (!state.authToken) return;
  
  try {
    const response = await fetch('/api/printer/features', {
      headers: {
        'Authorization': `Bearer ${state.authToken}`
      }
    });
    
    const result = await response.json() as PrinterFeaturesResponse;
    
    if (result.success && result.features) {
      state.printerFeatures = result.features;
      updateFeatureVisibility();
    }
  } catch (error) {
    console.error('Failed to load printer features:', error);
  }
}

function updateFeatureVisibility(): void {
  if (!state.printerFeatures) return;
  
  // LED controls
  const ledOn = $('btn-led-on') as HTMLButtonElement;
  const ledOff = $('btn-led-off') as HTMLButtonElement;
  if (ledOn) ledOn.disabled = !state.printerFeatures.hasLED;
  if (ledOff) ledOff.disabled = !state.printerFeatures.hasLED;
  
  // Filtration controls (AD5M Pro only)
  if (state.printerFeatures.hasFiltration) {
    showElement('filtration-section');
  } else {
    hideElement('filtration-section');
  }
  
  // Camera
  if (state.printerFeatures.hasCamera) {
    void loadCameraStream();
  }
}

function updateFiltrationStatus(mode?: 'external' | 'internal' | 'none'): void {
  if (!mode) return;
  
  // Update filtration status display
  const filtrationStatusEl = $('filtration-status');
  if (filtrationStatusEl) {
    const modeLabels = {
      'external': 'External',
      'internal': 'Internal',
      'none': 'Off'
    };
    filtrationStatusEl.textContent = modeLabels[mode] || 'Off';
  }
  
  // Update button states to show which mode is active
  const externalBtn = $('btn-external-filtration') as HTMLButtonElement;
  const internalBtn = $('btn-internal-filtration') as HTMLButtonElement;
  const offBtn = $('btn-no-filtration') as HTMLButtonElement;
  
  // Remove active class from all buttons
  if (externalBtn) externalBtn.classList.remove('active');
  if (internalBtn) internalBtn.classList.remove('active');
  if (offBtn) offBtn.classList.remove('active');
  
  // Add active class to current mode button
  switch (mode) {
    case 'external':
      if (externalBtn) externalBtn.classList.add('active');
      break;
    case 'internal':
      if (internalBtn) internalBtn.classList.add('active');
      break;
    case 'none':
      if (offBtn) offBtn.classList.add('active');
      break;
  }
}

function updateModelPreview(thumbnailData?: string | null): void {
  const previewContainer = $('model-preview');
  if (!previewContainer) return;
  
  if (thumbnailData) {
    // Clear existing content
    previewContainer.innerHTML = '';
    
    // Create image element
    const img = document.createElement('img');
    
    // Check if thumbnailData already has data URL prefix
    // Backend methods may return data with or without the prefix
    let imageUrl: string;
    if (thumbnailData.startsWith('data:image/')) {
      // Data already has proper data URL prefix
      imageUrl = thumbnailData;
    } else {
      // Raw base64 data, add the prefix
      imageUrl = `data:image/png;base64,${thumbnailData}`;
    }
    
    img.src = imageUrl;
    img.alt = 'Model preview';
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';
    
    // Handle load errors
    img.onerror = () => {
      console.error('Failed to load model preview. Image URL length:', imageUrl.length);
      previewContainer.innerHTML = '<div class="no-preview">Preview load failed</div>';
    };
    
    previewContainer.appendChild(img);
  } else {
    // Show no preview message
    previewContainer.innerHTML = '<div class="no-preview">No preview available</div>';
  }
}

async function loadCameraStream(): Promise<void> {
  const cameraPlaceholder = $('camera-placeholder');
  const cameraStream = $('camera-stream') as HTMLImageElement;
  
  if (!cameraPlaceholder || !cameraStream) {
    console.error('Camera elements not found');
    return;
  }
  
  try {
    // Get camera proxy configuration from the server
    const response = await fetch('/api/camera/proxy-config', {
      headers: {
        'Authorization': `Bearer ${state.authToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get camera proxy configuration');
    }
    
    const config = await response.json() as CameraProxyConfigResponse;

    // Handle RTSP cameras with JSMpeg player
    if (config.streamType === 'rtsp') {
      console.log('RTSP camera detected - setting up JSMpeg player');

      if (config.ffmpegAvailable === false) {
        showElement('camera-placeholder');
        hideElement('camera-stream');
        if (cameraPlaceholder) {
          cameraPlaceholder.textContent = 'RTSP Camera: ffmpeg required for browser viewing';
        }
        return;
      }

      if (!config.wsPort) {
        throw new Error('No WebSocket port provided for RTSP stream');
      }

      // Setup JSMpeg player for RTSP stream
      const canvas = document.getElementById('camera-canvas') as HTMLCanvasElement;
      if (!canvas) {
        console.error('Camera canvas element not found');
        return;
      }

      // Construct WebSocket URL for node-rtsp-stream
      const wsUrl = `ws://${window.location.hostname}:${config.wsPort}`;
      console.log('Connecting to RTSP stream at:', wsUrl);

      // Hide img, show canvas
      hideElement('camera-stream');
      showElement('camera-canvas');
      hideElement('camera-placeholder');

      // Initialize JSMpeg player
      // @ts-ignore - JSMpeg loaded via CDN
      new JSMpeg.Player(wsUrl, {
        canvas: canvas,
        autoplay: true,
        audio: false,
        onSourceEstablished: () => {
          console.log('RTSP stream connected');
        },
        onSourceCompleted: () => {
          console.log('RTSP stream ended');
        }
      });

      return;
    }

    if (!config.url) {
      throw new Error('No camera URL provided by server');
    }

    const cameraUrl = config.url; // Use the URL from server response

    console.log('Loading camera stream from:', cameraUrl);

    // Set up the camera stream
    cameraStream.src = cameraUrl;
    
    // Handle successful load
    cameraStream.onload = () => {
      console.log('Camera stream connected');
      hideElement('camera-placeholder');
      showElement('camera-stream');
    };
    
    // Handle errors
    cameraStream.onerror = () => {
      console.error('Failed to load camera stream');
      showElement('camera-placeholder');
      hideElement('camera-stream');
      
      // Update placeholder text
      if (cameraPlaceholder) {
        cameraPlaceholder.textContent = 'Camera Stream Error';
      }
      
      // Retry after a delay
      setTimeout(() => {
        if (state.printerFeatures?.hasCamera) {
          console.log('Retrying camera stream...');
          cameraStream.src = cameraUrl + '?t=' + Date.now(); // Add timestamp to force reload
        }
      }, 5000);
    };
    
  } catch (error) {
    console.error('Failed to load camera proxy configuration:', error);
    showElement('camera-placeholder');
    hideElement('camera-stream');
    if (cameraPlaceholder) {
      cameraPlaceholder.textContent = 'Camera Configuration Error';
    }
  }
}

// ============================================================================
// FILE MANAGEMENT
// ============================================================================

async function loadFileList(source: 'recent' | 'local'): Promise<void> {
  if (!state.authToken) return;
  
  try {
    const response = await fetch(`/api/jobs/${source}`, {
      headers: {
        'Authorization': `Bearer ${state.authToken}`
      }
    });
    
    const result = await response.json() as FileListResponse;
    
    if (result.success && result.files) {
      showFileModal(result.files, source);
    } else {
      showToast('Failed to load files', 'error');
    }
  } catch (error) {
    console.error('Failed to load files:', error);
    showToast('Failed to load files', 'error');
  }
}

function showFileModal(files: JobFile[], source: string): void {
  const modal = $('file-modal');
  const fileList = $('file-list');
  const title = $('modal-title');
  
  if (!modal || !fileList || !title) return;
  
  // Set title
  title.textContent = source === 'recent' ? 'Recent Files' : 'Local Files';
  
  // Clear and populate file list
  fileList.innerHTML = '';
  state.selectedFile = null;
  
  files.forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `<span class="file-name">${file.displayName || file.fileName}</span>`;
    
    item.addEventListener('click', () => {
      // Remove selected class from all items
      fileList.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
      // Add selected class to clicked item
      item.classList.add('selected');
      state.selectedFile = file.fileName;
      
      // Enable print button
      const printBtn = $('print-file-btn') as HTMLButtonElement;
      if (printBtn) printBtn.disabled = false;
    });
    
    fileList.appendChild(item);
  });
  
  // Show modal
  showElement('file-modal');
}

async function startPrintJob(): Promise<void> {
  if (!state.selectedFile || !state.authToken) return;
  
  const autoLevel = ($('auto-level') as HTMLInputElement)?.checked || false;
  const startNow = ($('start-now') as HTMLInputElement)?.checked || true;
  
  try {
    const response = await fetch('/api/jobs/start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: state.selectedFile,
        leveling: autoLevel,
        startNow: startNow
      })
    });
    
    const result = await response.json() as PrintJobStartResponse;
    
    if (result.success) {
      showToast(result.message || 'Print job started', 'success');
      hideElement('file-modal');
    } else {
      showToast(result.error || 'Failed to start print', 'error');
    }
  } catch (error) {
    console.error('Failed to start print:', error);
    showToast('Failed to start print job', 'error');
  }
}

// ============================================================================
// TEMPERATURE CONTROL
// ============================================================================

function showTemperatureDialog(type: 'bed' | 'extruder'): void {
  const dialog = $('temp-dialog');
  const title = $('temp-dialog-title');
  const message = $('temp-dialog-message');
  const input = $('temp-input') as HTMLInputElement;
  
  if (!dialog || !title || !message || !input) return;
  
  // Set dialog content
  title.textContent = type === 'bed' ? 'Set Bed Temperature' : 'Set Extruder Temperature';
  message.textContent = `Enter ${type} temperature (°C):`;
  
  // Set current target temperature as default
  if (state.printerStatus) {
    const currentTarget = type === 'bed' 
      ? state.printerStatus.bedTargetTemperature 
      : state.printerStatus.nozzleTargetTemperature;
    input.value = Math.round(currentTarget).toString();
  } else {
    input.value = '0';
  }
  
  // Store type for confirm handler
  (dialog as TemperatureDialogElement).temperatureType = type;
  
  // Show dialog
  showElement('temp-dialog');
  input.focus();
  input.select();
}

async function setTemperature(): Promise<void> {
  const dialog = $('temp-dialog') as TemperatureDialogElement;
  const input = $('temp-input') as HTMLInputElement;
  
  if (!dialog || !input) return;
  
  const type = dialog.temperatureType;
  const temperature = parseInt(input.value, 10);
  
  if (isNaN(temperature) || temperature < 0 || temperature > 300) {
    showToast('Invalid temperature value', 'error');
    return;
  }
  
  await sendPrinterCommand(`temperature/${type}`, { temperature });
  hideElement('temp-dialog');
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function setupEventHandlers(): void {
  // Login form
  const loginBtn = $('login-button');
  const passwordInput = $('password-input') as HTMLInputElement;
  
  if (loginBtn && passwordInput) {
    loginBtn.addEventListener('click', async () => {
      const password = passwordInput.value;
      const rememberMe = ($('remember-me-checkbox') as HTMLInputElement)?.checked || false;
      
      if (!password) {
        setTextContent('login-error', 'Please enter a password');
        return;
      }
      
      loginBtn.textContent = 'Logging in...';
      (loginBtn as HTMLButtonElement).disabled = true;
      
      const success = await login(password, rememberMe);
      
      if (success) {
        hideElement('login-screen');
        showElement('main-ui');
        connectWebSocket();
        await loadPrinterFeatures();
        // Fetch printer contexts after successful login
        await fetchPrinterContexts();
      }
      
      loginBtn.textContent = 'Login';
      (loginBtn as HTMLButtonElement).disabled = false;
    });
    
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        loginBtn.click();
      }
    });
  }
  
  // Logout button
  const logoutBtn = $('logout-button');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
  
  // Control buttons
  const controls = [
    { id: 'btn-led-on', endpoint: 'control/led-on' },
    { id: 'btn-led-off', endpoint: 'control/led-off' },
    { id: 'btn-clear-status', endpoint: 'control/clear-status' },
    { id: 'btn-home-axes', endpoint: 'control/home' },
    { id: 'btn-pause', endpoint: 'control/pause' },
    { id: 'btn-resume', endpoint: 'control/resume' },
    { id: 'btn-cancel', endpoint: 'control/cancel' },
    { id: 'btn-bed-off', endpoint: 'temperature/bed/off' },
    { id: 'btn-extruder-off', endpoint: 'temperature/extruder/off' },
    { id: 'btn-external-filtration', endpoint: 'filtration/external' },
    { id: 'btn-internal-filtration', endpoint: 'filtration/internal' },
    { id: 'btn-no-filtration', endpoint: 'filtration/off' }
  ];
  
  controls.forEach(({ id, endpoint }) => {
    const btn = $(id);
    if (btn) {
      btn.addEventListener('click', () => sendPrinterCommand(endpoint));
    }
  });
  
  // Temperature set buttons
  const bedSetBtn = $('btn-bed-set');
  const extruderSetBtn = $('btn-extruder-set');
  
  if (bedSetBtn) {
    bedSetBtn.addEventListener('click', () => showTemperatureDialog('bed'));
  }
  if (extruderSetBtn) {
    extruderSetBtn.addEventListener('click', () => showTemperatureDialog('extruder'));
  }
  
  // File selection buttons
  const recentBtn = $('btn-start-recent');
  const localBtn = $('btn-start-local');
  
  if (recentBtn) {
    recentBtn.addEventListener('click', () => loadFileList('recent'));
  }
  if (localBtn) {
    localBtn.addEventListener('click', () => loadFileList('local'));
  }
  
  // Refresh button
  const refreshBtn = $('btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      sendCommand({ command: 'REQUEST_STATUS' });
    });
  }
  
  // File modal handlers
  const closeModalBtn = $('close-modal');
  const printFileBtn = $('print-file-btn');
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      hideElement('file-modal');
      state.selectedFile = null;
    });
  }
  
  if (printFileBtn) {
    printFileBtn.addEventListener('click', startPrintJob);
  }
  
  // Temperature dialog handlers
  const closeTempBtn = $('close-temp-dialog');
  const tempCancelBtn = $('temp-cancel');
  const tempConfirmBtn = $('temp-confirm');
  const tempInput = $('temp-input') as HTMLInputElement;
  
  if (closeTempBtn) {
    closeTempBtn.addEventListener('click', () => hideElement('temp-dialog'));
  }
  if (tempCancelBtn) {
    tempCancelBtn.addEventListener('click', () => hideElement('temp-dialog'));
  }
  if (tempConfirmBtn) {
    tempConfirmBtn.addEventListener('click', setTemperature);
  }
  if (tempInput) {
    tempInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        void setTemperature();
      }
    });
  }
  
  // Printer selector dropdown
  const printerSelect = $('printer-select') as HTMLSelectElement;
  if (printerSelect) {
    printerSelect.addEventListener('change', (e) => {
      const selectedContextId = (e.target as HTMLSelectElement).value;
      console.log('[Contexts] Printer selector changed to:', selectedContextId);
      void switchPrinterContext(selectedContextId);
    });
  }

  // Keep-alive ping
  setInterval(() => {
    if (state.isConnected && state.websocket && state.websocket.readyState === WebSocket.OPEN) {
      sendCommand({ command: 'PING' });
    }
  }, 30000);

  // Note: Status updates now come via WebSocket push, no need to poll
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function checkAuthStatus(): Promise<boolean> {
  // Check for stored token
  const storedToken = localStorage.getItem('webui-token') || sessionStorage.getItem('webui-token');
  
  if (!storedToken) {
    return false;
  }
  
  // Set the token in state first
  state.authToken = storedToken;
  state.isAuthenticated = true;
  
  // Verify token is still valid by calling a protected endpoint
  try {
    // Test with printer status endpoint which requires auth
    const response = await fetch('/api/printer/status', {
      headers: {
        'Authorization': `Bearer ${storedToken}`
      }
    });
    
    if (response.ok || response.status === 503) {
      // 503 means printer not connected but auth is valid
      return true;
    } else if (response.status === 401) {
      // Token is invalid or expired
      state.authToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem('webui-token');
      sessionStorage.removeItem('webui-token');
      return false;
    } else {
      // Other error, keep token for now
      return true;
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    // Network error, assume token might be valid
    return true;
  }
}

async function initialize(): Promise<void> {
  console.log('Initializing Web UI...');
  
  // Setup event handlers
  setupEventHandlers();
  
  // Check authentication status
  const isAuthenticated = await checkAuthStatus();
  
  if (isAuthenticated) {
    // Token exists and might be valid
    hideElement('login-screen');
    showElement('main-ui');
    
    // Try to connect and load features
    connectWebSocket();
    
    // Load features but handle auth failures gracefully
    try {
      await loadPrinterFeatures();
      // Fetch printer contexts after features are loaded
      await fetchPrinterContexts();
    } catch (error) {
      console.error('Failed to load features:', error);
      // If we get here, token might be invalid but we'll let WebSocket retry handle it
    }
  } else {
    // Show login screen
    showElement('login-screen');
    hideElement('main-ui');
    
    // Focus password input
    const passwordInput = $('password-input') as HTMLInputElement;
    if (passwordInput) {
      passwordInput.focus();
    }
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  void initialize();
}
