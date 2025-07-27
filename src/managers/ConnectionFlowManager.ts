/**
 * ConnectionFlowManager.ts - Orchestrates printer connection flow using specialized services
 * Coordinates discovery, saved printer management, auto-connect, and connection state
 */

import { EventEmitter } from 'events';
import { FiveMClient, FlashForgeClient } from 'ff-api';

import { getConfigManager } from './ConfigManager';
import { getLoadingManager } from './LoadingManager';
import { getPrinterBackendManager } from './PrinterBackendManager';
import { getPrinterDiscoveryService } from '../services/PrinterDiscoveryService';
import { getThumbnailRequestQueue } from '../services/ThumbnailRequestQueue';
import { getSavedPrinterService } from '../services/SavedPrinterService';
import { getAutoConnectService } from '../services/AutoConnectService';
import { getConnectionStateManager } from '../services/ConnectionStateManager';
import { getDialogIntegrationService } from '../services/DialogIntegrationService';
import { getConnectionEstablishmentService } from '../services/ConnectionEstablishmentService';

import {
  PrinterDetails,
  DiscoveredPrinter,
  ConnectionResult,
  PrinterConnectionState,
  ConnectionOptions
} from '../types/printer';

import {
  detectPrinterFamily,
  determineClientType,
  formatPrinterName,
  getConnectionErrorMessage,
  shouldPromptForCheckCode,
  getDefaultCheckCode,
  detectPrinterModelType
} from '../utils/PrinterUtils';

// Input dialog options interface (matching preload.ts)
interface InputDialogOptions {
  title?: string;
  message?: string;
  defaultValue?: string;
  inputType?: 'text' | 'password' | 'hidden';
  placeholder?: string;
}

/**
 * Main connection flow orchestrator
 * Coordinates all services to handle the complete printer connection workflow
 */
export class ConnectionFlowManager extends EventEmitter {
  private readonly configManager = getConfigManager();
  private readonly loadingManager = getLoadingManager();
  private readonly backendManager = getPrinterBackendManager();
  private readonly discoveryService = getPrinterDiscoveryService();
  private readonly savedPrinterService = getSavedPrinterService();
  private readonly autoConnectService = getAutoConnectService();
  private readonly connectionStateManager = getConnectionStateManager();
  private readonly dialogService = getDialogIntegrationService();
  private readonly connectionService = getConnectionEstablishmentService();
  
  private inputDialogHandler: ((options: InputDialogOptions) => Promise<string | null>) | null = null;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /** Setup internal event handlers and service event forwarding */
  private setupEventHandlers(): void {
    // Forward configuration changes
    this.configManager.on('config:ForceLegacyAPI', (newValue: boolean) => {
      this.emit('force-legacy-changed', newValue);
    });
    
    // Forward backend manager events
    this.forwardEvents(this.backendManager, [
      'backend-initialized',
      'backend-initialization-failed',
      'backend-disposed',
      'backend-error',
      'feature-updated',
      'loading-state-changed'
    ]);
    
    // Initialize thumbnail queue when backend is ready
    this.backendManager.on('backend-initialized', () => {
      const thumbnailQueue = getThumbnailRequestQueue();
      thumbnailQueue.initialize(this.backendManager);
      console.log('ThumbnailRequestQueue initialized with backend manager');
    });
    
    // Reset thumbnail queue when backend is disposed
    this.backendManager.on('backend-disposed', () => {
      const thumbnailQueue = getThumbnailRequestQueue();
      thumbnailQueue.reset();
      console.log('ThumbnailRequestQueue reset after backend disposal');
    });

    // Forward discovery service events
    this.forwardEvents(this.discoveryService, [
      'discovery-started',
      'discovery-completed',
      'discovery-failed'
    ]);

    // Forward connection state events
    this.connectionStateManager.on('state-changed', (data) => {
      this.emit('connection-state-changed', data);
    });
  }

  /** Helper to forward events from a service */
  private forwardEvents(service: EventEmitter, events: string[]): void {
    events.forEach(event => {
      service.on(event, (...args) => {
        this.emit(event, ...args);
      });
    });
  }

  /** Set input dialog handler for check code prompts */
  public setInputDialogHandler(handler: (options: InputDialogOptions) => Promise<string | null>): void {
    this.inputDialogHandler = handler;
  }

  /** Check if printer is currently connected */
  public isConnected(): boolean {
    return this.connectionStateManager.isConnected();
  }

  /** Get current connection state */
  public getConnectionState(): PrinterConnectionState {
    return this.connectionStateManager.getState();
  }

  /** Start the printer connection flow */
  public async startConnectionFlow(options: ConnectionOptions = {}): Promise<ConnectionResult> {
    try {
      // Check if already connected and warn user
      if (this.isConnected() && !options.checkForActiveConnection) {
        const currentDetails = this.connectionStateManager.getCurrentDetails();
        const shouldContinue = await this.dialogService.confirmDisconnectForScan(currentDetails?.Name);
        if (!shouldContinue) {
          return { success: false, error: 'User cancelled - connection in progress' };
        }
        
        this.loadingManager.show({ message: 'Disconnecting current printer...', canCancel: false });
        await this.disconnect();
      }

      this.emit('connection-flow-started');

      // Show loading for discovery
      this.loadingManager.show({ message: 'Scanning for printers on network...', canCancel: true });

      // Discover printers
      const discoveredPrinters = await this.discoveryService.scanNetwork();
      if (discoveredPrinters.length === 0) {
        this.loadingManager.showError('No printers found on network', 3000);
        return { success: false, error: 'No printers found on network' };
      }

      // Hide loading for user interaction
      this.loadingManager.hide();

      // Show printer selection dialog
      const selectedPrinter = await this.dialogService.showPrinterSelectionDialog(discoveredPrinters);
      if (!selectedPrinter) {
        return { success: false, error: 'No printer selected' };
      }

      // Connect to selected printer
      return await this.connectToPrinter(selectedPrinter);

    } catch (error) {
      const errorMessage = getConnectionErrorMessage(error);
      this.loadingManager.showError(`Connection failed: ${errorMessage}`, 5000);
      this.emit('connection-error', errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      this.emit('connection-flow-ended');
    }
  }

  /** Connect to a specific discovered printer */
  public async connectToDiscoveredPrinter(discoveredPrinter: DiscoveredPrinter): Promise<ConnectionResult> {
    return await this.connectToPrinter(discoveredPrinter);
  }

  /** Attempt to auto-connect based on saved printer configuration */
  public async tryAutoConnect(): Promise<ConnectionResult> {
    // Check if auto-connect should be attempted
    if (!this.autoConnectService.shouldAutoConnect()) {
      return { success: false, error: 'Auto-connect disabled' };
    }

    const savedPrinterCount = this.savedPrinterService.getSavedPrinterCount();
    
    // No saved printers - skip auto-connect
    if (savedPrinterCount === 0) {
      console.log('No saved printers found - skipping auto-connect');
      return { success: false, error: 'No saved printer details found' };
    }

    this.loadingManager.show({ message: 'Scanning for saved printers...', canCancel: false });
    this.emit('auto-connect-discovery-started');

    try {
      // Run discovery to find all printers
      const discoveredPrinters = await this.discoveryService.scanNetwork();
      
      // Find matches using saved printer service
      const matches = this.savedPrinterService.findMatchingPrinters(discoveredPrinters);
      
      // Determine auto-connect action
      const choice = this.autoConnectService.determineAutoConnectChoice(matches);
      
      switch (choice.action) {
        case 'none':
          this.loadingManager.showError(choice.reason || 'No saved printers found on network', 4000);
          return { success: false, error: choice.reason };
          
        case 'connect':
          if (choice.selectedMatch) {
            return await this.autoConnectToMatch(choice.selectedMatch);
          }
          return { success: false, error: 'No match selected' };
          
        case 'select':
          this.loadingManager.hide();
          return await this.dialogService.showSavedPrinterSelectionDialog(
            choice.matches || [],
            (serialNumber) => this.connectToSelectedSavedPrinter(serialNumber)
          );
          
        default:
          return { success: false, error: 'Unknown auto-connect action' };
      }

    } catch (error) {
      const errorMessage = getConnectionErrorMessage(error);
      this.loadingManager.showError(`Auto-connect failed: ${errorMessage}`, 4000);
      this.emit('auto-connect-failed', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /** Disconnect from current printer with proper logout */
  public async disconnect(): Promise<void> {
    const currentDetails = this.connectionStateManager.getCurrentDetails();
    
    if (!this.connectionStateManager.isConnected()) {
      return;
    }

    try {
      console.log('Starting disconnect sequence...');
      
      // Stop polling first
      this.emit('pre-disconnect');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get clients for disposal
      const primaryClient = this.connectionStateManager.getPrimaryClient();
      const secondaryClient = this.connectionStateManager.getSecondaryClient();
      
      // Dispose backend
      await this.backendManager.onConnectionLost();
      
      // Dispose clients through connection service (handles logout)
      await this.connectionService.disposeClients(
        primaryClient,
        secondaryClient,
        currentDetails?.ClientType
      );
      
      // Update state
      this.connectionStateManager.setDisconnected();
      
      // Emit disconnected event
      this.emit('disconnected', currentDetails?.Name);
      
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  }

  /** Auto-connect to a matched saved printer */
  private async autoConnectToMatch(match: import('../types/printer').SavedPrinterMatch): Promise<ConnectionResult> {
    const { savedDetails, discoveredPrinter, ipAddressChanged } = match;
    
    this.loadingManager.updateMessage(`Found ${savedDetails.Name}, connecting...`);
    this.emit('auto-connect-matched', savedDetails.Name);

    try {
      if (ipAddressChanged) {
        console.log(`IP address changed for ${savedDetails.Name}: ${savedDetails.IPAddress} -> ${discoveredPrinter.ipAddress}`);
      }

      const result = await this.connectToPrinter(discoveredPrinter);
      
      if (result.success) {
        await this.savedPrinterService.updateLastConnected(savedDetails.SerialNumber);
        this.emit('auto-connect-succeeded', savedDetails.Name);
      } else {
        this.emit('auto-connect-failed', result.error || 'Unknown error');
      }
      
      return result;

    } catch (error) {
      const errorMessage = getConnectionErrorMessage(error);
      this.loadingManager.showError(`Auto-connect failed: ${errorMessage}`, 4000);
      this.emit('auto-connect-failed', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /** Connect to a selected printer with proper type detection and pairing */
  private async connectToPrinter(discoveredPrinter: DiscoveredPrinter): Promise<ConnectionResult> {
    this.loadingManager.show({ message: `Connecting to ${discoveredPrinter.name}...`, canCancel: false });
    this.connectionStateManager.setConnecting(discoveredPrinter);
    this.emit('connecting-to-printer', discoveredPrinter.name);

    try {
      // Step 1: Temporary connection to get printer type
      this.loadingManager.updateMessage('Detecting printer type...');
      const tempResult = await this.connectionService.createTemporaryConnection(discoveredPrinter);
      if (!tempResult.success || !tempResult.typeName) {
        this.loadingManager.showError(tempResult.error || 'Failed to determine printer type', 4000);
        return { success: false, error: tempResult.error || 'Failed to determine printer type' };
      }

      // Step 2: Detect printer family and requirements
      const familyInfo = detectPrinterFamily(tempResult.typeName);
      const clientType = determineClientType(familyInfo.is5MFamily);
      const ForceLegacyAPI = this.configManager.get('ForceLegacyAPI') || false;

      this.emit('printer-type-detected', {
        typeName: tempResult.typeName,
        familyInfo,
        clientType
      });

      // Step 3: Handle check code requirements
      let checkCode = getDefaultCheckCode();
      
      // Check if this printer has a saved check code
      const savedCheckCode = this.savedPrinterService.getSavedCheckCode(discoveredPrinter.serialNumber);
      
      if (savedCheckCode) {
        console.log('Using saved check code for known printer:', discoveredPrinter.name);
        checkCode = savedCheckCode;
      } else if (shouldPromptForCheckCode(familyInfo.is5MFamily, undefined, ForceLegacyAPI)) {
        this.loadingManager.hide();
        
        const promptedCheckCode = await this.promptForCheckCode(discoveredPrinter.name);
        if (!promptedCheckCode) {
          this.loadingManager.showError('Check code required but not provided', 3000);
          return { success: false, error: 'Check code required but not provided' };
        }
        checkCode = promptedCheckCode;
        
        this.loadingManager.show({ message: 'Establishing connection with pairing code...', canCancel: false });
      }

      // Step 4: Establish final connection
      this.loadingManager.updateMessage('Establishing final connection...');
      const connectionResult = await this.connectionService.establishFinalConnection(
        discoveredPrinter,
        tempResult.typeName,
        familyInfo.is5MFamily,
        checkCode,
        ForceLegacyAPI
      );

      if (!connectionResult) {
        this.loadingManager.showError('Failed to establish final connection', 4000);
        return { success: false, error: 'Failed to establish final connection' };
      }

      // Step 5: Save printer details
      this.loadingManager.updateMessage('Saving printer details...');
      const modelType = detectPrinterModelType(tempResult.typeName);
      const printerDetails: PrinterDetails = {
        Name: formatPrinterName(discoveredPrinter.name, discoveredPrinter.serialNumber),
        IPAddress: discoveredPrinter.ipAddress,
        SerialNumber: discoveredPrinter.serialNumber,
        CheckCode: checkCode,
        ClientType: ForceLegacyAPI ? 'legacy' : clientType,
        printerModel: tempResult.typeName,
        modelType
      };

      await this.savedPrinterService.savePrinter(printerDetails);

      // Step 6: Update connection state
      this.connectionStateManager.setConnected(
        printerDetails,
        connectionResult.primaryClient,
        connectionResult.secondaryClient
      );

      // Step 7: Initialize backend manager
      await this.backendManager.onConnectionEstablished(
        printerDetails, 
        connectionResult.primaryClient,
        connectionResult.secondaryClient
      );

      this.loadingManager.showSuccess(`Connected to ${printerDetails.Name} at ${printerDetails.IPAddress}`, 4000);
      this.emit('connected', printerDetails);
      return { 
        success: true, 
        printerDetails, 
        clientInstance: connectionResult.primaryClient 
      };

    } catch (error) {
      const errorMessage = getConnectionErrorMessage(error);
      this.loadingManager.showError(`Connection failed: ${errorMessage}`, 5000);
      this.emit('connection-failed', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /** Connect to a saved printer selected from the list */
  private async connectToSelectedSavedPrinter(selectedSerial: string): Promise<ConnectionResult> {
    try {
      this.loadingManager.show({ message: 'Locating printer on network...', canCancel: false });
      const discoveredPrinters = await this.discoveryService.scanNetwork();
      
      const discoveredPrinter = discoveredPrinters.find(
        p => p.serialNumber === selectedSerial
      );
      
      if (!discoveredPrinter) {
        const savedPrinter = this.savedPrinterService.getSavedPrinter(selectedSerial);
        if (savedPrinter) {
          this.loadingManager.showError(`${savedPrinter.Name} is not available on the network`, 4000);
        }
        return { success: false, error: 'Selected printer not found on network' };
      }
      
      return await this.connectToPrinter(discoveredPrinter);
      
    } catch (error) {
      const errorMessage = getConnectionErrorMessage(error);
      this.loadingManager.showError(`Connection failed: ${errorMessage}`, 4000);
      return { success: false, error: errorMessage };
    }
  }

  /** Connect using saved printer details */
  public async connectWithSavedDetails(details: PrinterDetails): Promise<ConnectionResult> {
    try {
      const ForceLegacyAPI = this.configManager.get('ForceLegacyAPI') || false;
      const familyInfo = detectPrinterFamily(details.printerModel);

      // Create a mock discovered printer for connection establishment
      const discoveredPrinter: DiscoveredPrinter = {
        name: details.Name,
        ipAddress: details.IPAddress,
        serialNumber: details.SerialNumber,
        model: details.printerModel
      };

      // Establish connection
      const connectionResult = await this.connectionService.establishFinalConnection(
        discoveredPrinter,
        details.printerModel,
        familyInfo.is5MFamily,
        details.CheckCode,
        ForceLegacyAPI
      );

      if (!connectionResult) {
        throw new Error('Failed to establish connection');
      }

      // Update connection state
      this.connectionStateManager.setConnected(
        details,
        connectionResult.primaryClient,
        connectionResult.secondaryClient
      );
      
      // Initialize backend
      await this.backendManager.onConnectionEstablished(
        details, 
        connectionResult.primaryClient,
        connectionResult.secondaryClient
      );

      this.emit('connected', details);
      return { 
        success: true, 
        printerDetails: details, 
        clientInstance: connectionResult.primaryClient 
      };

    } catch (error) {
      const errorMessage = getConnectionErrorMessage(error);
      this.emit('auto-connect-failed', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /** Prompt user for check code using input dialog */
  private async promptForCheckCode(printerName: string): Promise<string | null> {
    if (!this.inputDialogHandler) {
      console.error('Input dialog handler not set - cannot prompt for check code');
      return null;
    }

    try {
      const checkCode = await this.inputDialogHandler({
        title: 'Printer Pairing',
        message: `Please enter the pairing code (check code) for ${printerName}:`,
        defaultValue: '',
        inputType: 'text',
        placeholder: 'Enter check code...'
      });

      return checkCode;
    } catch (error) {
      console.error('Error prompting for check code:', error);
      return null;
    }
  }

  /** Public discovery method for UI */
  public async discoverPrinters(): Promise<DiscoveredPrinter[]> {
    return await this.discoveryService.scanNetwork();
  }

  /** Get current printer client instance (primary) */
  public getCurrentClient(): FiveMClient | FlashForgeClient | null {
    return this.connectionStateManager.getPrimaryClient();
  }
  
  /** Get secondary client instance */
  public getSecondaryClient(): FlashForgeClient | null {
    return this.connectionStateManager.getSecondaryClient();
  }

  /** Get current printer details */
  public getCurrentDetails(): PrinterDetails | null {
    return this.connectionStateManager.getCurrentDetails();
  }
  
  /** Get backend manager instance */
  public getBackendManager() {
    return this.backendManager;
  }
  
  /** Check if backend is ready */
  public isBackendReady(): boolean {
    return this.backendManager.isBackendReady();
  }

  /** Clear saved printer details */
  public async clearSavedDetails(): Promise<void> {
    this.savedPrinterService.clearAllPrinters();
    this.emit('saved-details-cleared');
  }

  /** Get connection status as formatted string */
  public getConnectionStatus(): string {
    return this.connectionStateManager.getConnectionStatus();
  }

  /** Dispose of resources */
  public async dispose(): Promise<void> {
    await this.disconnect();
    await this.backendManager.cleanup();
    this.removeAllListeners();
  }
}



// Export singleton instance
let connectionFlowManager: ConnectionFlowManager | null = null;

export const getConnectionFlowManager = (): ConnectionFlowManager => {
  if (!connectionFlowManager) {
    connectionFlowManager = new ConnectionFlowManager();
  }
  return connectionFlowManager;
};

export const getPrinterConnectionManager = getConnectionFlowManager;
