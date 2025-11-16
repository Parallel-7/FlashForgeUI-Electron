/**
 * @fileoverview Connection flow orchestrator for managing printer discovery and connection workflows.
 *
 * Provides high-level coordination of printer connection operations in multi-context environment:
 * - Network discovery flow management with printer selection
 * - Direct IP connection support with check code prompts
 * - Auto-connect functionality for previously connected printers
 * - Saved printer management and connection restoration
 * - Connection state tracking and event forwarding
 * - Multi-context connection flow tracking for concurrent connections
 *
 * Key exports:
 * - ConnectionFlowManager class: Main connection orchestrator
 * - getPrinterConnectionManager(): Singleton accessor function
 *
 * The manager coordinates multiple specialized services:
 * - PrinterDiscoveryService: Network scanning and printer detection
 * - SavedPrinterService: Persistent printer storage
 * - AutoConnectService: Automatic connection on startup
 * - ConnectionStateManager: Connection state tracking
 * - DialogIntegrationService: User interaction dialogs
 * - ConnectionEstablishmentService: Low-level connection setup
 *
 * Supports concurrent connection flows with unique flow IDs and context tracking,
 * enabling multi-printer connections while maintaining proper state isolation.
 */

import { EventEmitter } from 'events';
import { FiveMClient, FlashForgeClient } from '@ghosttypes/ff-api';

import { getConfigManager } from './ConfigManager';
import { getLoadingManager } from './LoadingManager';
import { getPrinterBackendManager } from './PrinterBackendManager';
import { getPrinterContextManager } from './PrinterContextManager';
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
/**
 * Connection flow state for tracking multiple concurrent flows
 */
interface ConnectionFlowState {
  flowId: string;
  contextId: string | null;
  startTime: Date;
}

export class ConnectionFlowManager extends EventEmitter {
  private readonly configManager = getConfigManager();
  private readonly loadingManager = getLoadingManager();
  private readonly backendManager = getPrinterBackendManager();
  private readonly contextManager = getPrinterContextManager();
  private readonly discoveryService = getPrinterDiscoveryService();
  private readonly savedPrinterService = getSavedPrinterService();
  private readonly autoConnectService = getAutoConnectService();
  private readonly connectionStateManager = getConnectionStateManager();
  private readonly dialogService = getDialogIntegrationService();
  private readonly connectionService = getConnectionEstablishmentService();

  private inputDialogHandler: ((options: InputDialogOptions) => Promise<string | null>) | null = null;

  /** Map of active connection flows for tracking concurrent connections */
  private readonly activeFlows = new Map<string, ConnectionFlowState>();

  /** Counter for generating unique flow IDs */
  private flowIdCounter = 0;

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

  /** Generate unique flow ID */
  private generateFlowId(): string {
    this.flowIdCounter++;
    return `flow-${this.flowIdCounter}-${Date.now()}`;
  }

  /** Start tracking a new connection flow */
  private startFlow(contextId: string | null = null): string {
    const flowId = this.generateFlowId();
    const flowState: ConnectionFlowState = {
      flowId,
      contextId,
      startTime: new Date()
    };
    this.activeFlows.set(flowId, flowState);
    return flowId;
  }

  /** Update flow with context ID */
  private updateFlowContext(flowId: string, contextId: string): void {
    const flow = this.activeFlows.get(flowId);
    if (flow) {
      flow.contextId = contextId;
    }
  }

  /** End flow tracking */
  private endFlow(flowId: string): void {
    this.activeFlows.delete(flowId);
  }

  /** Check if printer is currently connected */
  public isConnected(): boolean {
    const activeContextId = this.contextManager.getActiveContextId();
    if (!activeContextId) {
      return false;
    }
    return this.connectionStateManager.isConnected(activeContextId);
  }

  /** Get current connection state */
  public getConnectionState(): PrinterConnectionState {
    const activeContextId = this.contextManager.getActiveContextId();
    if (!activeContextId) {
      return {
        isConnected: false,
        printerName: undefined,
        ipAddress: undefined,
        clientType: undefined,
        isPrinting: false,
        lastConnected: new Date()
      };
    }
    return this.connectionStateManager.getState(activeContextId);
  }

  /** Start the printer connection flow */
  public async startConnectionFlow(options: ConnectionOptions = {}): Promise<ConnectionResult> {
    try {
      // Check if already connected and warn user
      if (this.isConnected() && options.checkForActiveConnection !== false) {
        const activeContextId = this.contextManager.getActiveContextId();
        const currentDetails = activeContextId
          ? this.connectionStateManager.getCurrentDetails(activeContextId)
          : null;
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
        // Check if we have saved printers for enhanced fallback
        const savedPrinterCount = this.savedPrinterService.getSavedPrinterCount();
        
        if (savedPrinterCount > 0) {
          // Hide discovery loading and show enhanced choice dialog
          this.loadingManager.hide();
          console.log('No printers discovered - showing enhanced fallback options');
          
          // Use the same enhanced fallback as auto-connect
          const lastUsedPrinter = this.savedPrinterService.getLastUsedPrinter();
          const userChoice = await this.dialogService.showAutoConnectChoiceDialog(
            lastUsedPrinter,
            savedPrinterCount
          );
          
          if (!userChoice) {
            return { success: false, error: 'Connection cancelled by user' };
          }
          
          // Handle user choice
          switch (userChoice) {
            case 'connect-last-used':
              if (lastUsedPrinter) {
                return await this.connectToOfflineSavedPrinter(lastUsedPrinter.SerialNumber);
              }
              return { success: false, error: 'No last used printer available' };
              
            case 'show-saved-printers':
              return await this.showSavedPrintersForSelection();
              
            case 'manual-ip':
              return await this.offerManualIPEntry();
              
            default:
              return { success: false, error: 'Unknown choice' };
          }
        } else {
          // No saved printers - go directly to manual IP entry
          this.loadingManager.hide();
          console.log('No printers discovered and no saved printers - offering manual IP entry');
          return await this.offerManualIPEntry();
        }
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
      
      // If no matches found but we have saved printers, show auto-connect choice dialog
      if (matches.length === 0) {
        console.log('No saved printers found on network - showing auto-connect choice dialog');
        const lastUsedPrinter = this.savedPrinterService.getLastUsedPrinter();
        const savedPrinterCount = this.savedPrinterService.getSavedPrinterCount();
        
        this.loadingManager.hide();
        
        // Show auto-connect choice dialog
        const userChoice = await this.dialogService.showAutoConnectChoiceDialog(
          lastUsedPrinter,
          savedPrinterCount
        );
        
        if (!userChoice) {
          return { success: false, error: 'Auto-connect cancelled by user' };
        }
        
        // Handle user choice
        switch (userChoice) {
          case 'connect-last-used':
            if (lastUsedPrinter) {
              this.loadingManager.show({ message: `Attempting direct connection to ${lastUsedPrinter.Name}...`, canCancel: false });
              try {
                const result = await this.connectWithSavedDetails(lastUsedPrinter);
                if (result.success) {
                  console.log(`Successfully connected directly to ${lastUsedPrinter.Name}`);
                  return result;
                }
                console.log(`Direct connection to ${lastUsedPrinter.Name} failed: ${result.error}`);
                this.loadingManager.showError(`Direct connection to ${lastUsedPrinter.Name} failed: ${result.error}`, 4000);
                return result;
              } catch (error) {
                const errorMessage = `Direct connection to ${lastUsedPrinter.Name} failed: ${error}`;
                console.log(errorMessage);
                this.loadingManager.showError(errorMessage, 4000);
                return { success: false, error: errorMessage };
              }
            }
            return { success: false, error: 'No last used printer available' };
            
          case 'show-saved-printers': {
            // Create mock matches for all saved printers (they're offline)
            const allSavedPrinters = this.savedPrinterService.getSavedPrinters();
            const savedMatches = allSavedPrinters.map((savedPrinter: import('../types/printer').StoredPrinterDetails) => ({
              savedDetails: savedPrinter,
              discoveredPrinter: null, // Not discovered online
              ipAddressChanged: false
            }));
            
            return await this.dialogService.showSavedPrinterSelectionDialog(
              savedMatches,
              (serialNumber) => this.connectToOfflineSavedPrinter(serialNumber)
            );
          }
            
          case 'manual-ip':
            return await this.offerManualIPEntry();
            
          case 'cancel':
          default:
            return { success: false, error: 'Auto-connect cancelled by user' };
        }
      }
      
      // Determine auto-connect action for matched printers
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

  /** Disconnect from current printer with proper logout (uses active context) */
  public async disconnect(): Promise<void> {
    const activeContextId = this.contextManager.getActiveContextId();
    if (!activeContextId) {
      console.log('No active context to disconnect');
      return;
    }

    await this.disconnectContext(activeContextId);
  }

  /** Disconnect a specific printer context with proper cleanup */
  public async disconnectContext(contextId: string): Promise<void> {
    const context = this.contextManager.getContext(contextId);
    if (!context) {
      console.warn(`Cannot disconnect - context ${contextId} not found`);
      return;
    }

    const currentDetails = context.printerDetails;

    try {
      console.log(`Starting disconnect sequence for context ${contextId}...`);

      // Stop polling first
      this.emit('pre-disconnect', contextId);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get clients for disposal from connection state
      const primaryClient = this.connectionStateManager.getPrimaryClient(contextId);
      const secondaryClient = this.connectionStateManager.getSecondaryClient(contextId);

      // Dispose backend for this context
      await this.backendManager.disposeContext(contextId);

      // Dispose clients through connection service (handles logout)
      await this.connectionService.disposeClients(
        primaryClient,
        secondaryClient,
        currentDetails?.ClientType
      );

      // Update connection state
      this.connectionStateManager.setDisconnected(contextId);

      // Remove context from manager
      this.contextManager.removeContext(contextId);

      // Emit disconnected event
      this.emit('disconnected', currentDetails?.Name);

    } catch (error) {
      console.error(`Error during disconnect for context ${contextId}:`, error);
    }
  }

  /** Auto-connect to a matched saved printer */
  private async autoConnectToMatch(match: import('../types/printer').SavedPrinterMatch): Promise<ConnectionResult> {
    const { savedDetails, discoveredPrinter, ipAddressChanged } = match;
    
    // If discoveredPrinter is null, this printer is offline
    if (!discoveredPrinter) {
      return { success: false, error: `${savedDetails.Name} is not available on the network` };
    }
    
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
    // Start tracking this connection flow
    const flowId = this.startFlow();

    this.loadingManager.show({ message: `Connecting to ${discoveredPrinter.name}...`, canCancel: false });
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

      // Extract printer name early for better user experience in dialogs
      const realPrinterName = tempResult.printerInfo?.Name && typeof tempResult.printerInfo.Name === 'string' 
        ? tempResult.printerInfo.Name 
        : discoveredPrinter.name;

      // Step 3: Handle check code requirements
      let checkCode = getDefaultCheckCode();
      
      // Check if this printer has a saved check code
      const savedCheckCode = this.savedPrinterService.getSavedCheckCode(discoveredPrinter.serialNumber);
      
      if (savedCheckCode) {
        console.log('Using saved check code for known printer:', realPrinterName);
        checkCode = savedCheckCode;
      } else if (shouldPromptForCheckCode(familyInfo.is5MFamily, undefined, ForceLegacyAPI)) {
        this.loadingManager.hide();
        
        const promptedCheckCode = await this.promptForCheckCode(realPrinterName);
        if (!promptedCheckCode) {
          this.loadingManager.showError('Printer pairing cancelled', 2000);
          return { success: false, error: 'Connection cancelled by user' };
        }
        checkCode = promptedCheckCode;
        
        this.loadingManager.show({ message: 'Establishing connection with pairing code...', canCancel: false });
      }

      // Step 4: Extract and validate printer information
      this.loadingManager.updateMessage('Processing printer details...');
      const modelType = detectPrinterModelType(tempResult.typeName);
      
      // Extract serial number from temporary connection if not already present
      let serialNumber = discoveredPrinter.serialNumber;
      if (!serialNumber && tempResult.printerInfo?.SerialNumber) {
        serialNumber = tempResult.printerInfo.SerialNumber as string;
        console.log('Extracted serial number from temporary connection:', serialNumber);
      }
      
      // Use the real printer name we extracted earlier
      const printerName = realPrinterName;
      if (printerName !== discoveredPrinter.name) {
        console.log('Using real printer name from temporary connection:', printerName);
      }
      
      // Fallback for serial number if still missing
      if (!serialNumber || serialNumber.trim() === '') {
        console.warn('No serial number available, generating fallback');
        serialNumber = `Unknown-${Date.now()}`;
      }
      
      // Update the discoveredPrinter object with the correct information for connection establishment
      const updatedDiscoveredPrinter: DiscoveredPrinter = {
        ...discoveredPrinter,
        name: printerName,
        serialNumber: serialNumber
      };
      
      console.log('Final printer details for connection:', {
        originalName: discoveredPrinter.name,
        finalName: printerName,
        originalSerial: discoveredPrinter.serialNumber,
        finalSerial: serialNumber,
        ipAddress: discoveredPrinter.ipAddress
      });

      // Step 5: Establish final connection using updated printer information
      this.loadingManager.updateMessage('Establishing final connection...');
      const connectionResult = await this.connectionService.establishFinalConnection(
        updatedDiscoveredPrinter, // Use the updated printer info with correct serial number
        tempResult.typeName,
        familyInfo.is5MFamily,
        checkCode,
        ForceLegacyAPI
      );

      if (!connectionResult) {
        this.loadingManager.showError('Failed to establish final connection', 4000);
        return { success: false, error: 'Failed to establish final connection' };
      }

      // Step 6: Save printer details
      this.loadingManager.updateMessage('Saving printer details...');

      // Check if printer already exists to preserve per-printer settings
      const existingPrinter = this.savedPrinterService.getSavedPrinter(serialNumber);
      console.log('[ConnectionFlow] Existing printer check for', serialNumber, ':', existingPrinter);
      console.log('[ConnectionFlow] Existing settings:', {
        customCameraEnabled: existingPrinter?.customCameraEnabled,
        customCameraUrl: existingPrinter?.customCameraUrl,
        customLedsEnabled: existingPrinter?.customLedsEnabled,
        forceLegacyMode: existingPrinter?.forceLegacyMode
      });

      const printerDetails: PrinterDetails = {
        Name: formatPrinterName(printerName, serialNumber),
        IPAddress: discoveredPrinter.ipAddress,
        SerialNumber: serialNumber,
        CheckCode: checkCode,
        ClientType: ForceLegacyAPI ? 'legacy' : clientType,
        printerModel: tempResult.typeName,
        modelType,
        // Preserve existing per-printer settings or use defaults for new printers
        customCameraEnabled: existingPrinter?.customCameraEnabled ?? false,
        customCameraUrl: existingPrinter?.customCameraUrl ?? '',
        customLedsEnabled: existingPrinter?.customLedsEnabled ?? false,
        forceLegacyMode: existingPrinter?.forceLegacyMode ?? false,
        activeSpoolData: existingPrinter?.activeSpoolData ?? null
      };

      console.log('[ConnectionFlow] Final printer details to save:', printerDetails);

      await this.savedPrinterService.savePrinter(printerDetails);

      // Update last connected timestamp
      await this.savedPrinterService.updateLastConnected(printerDetails.SerialNumber);

      // Step 7: Create printer context
      this.loadingManager.updateMessage('Creating printer context...');
      const contextId = this.contextManager.createContext(printerDetails);
      this.updateFlowContext(flowId, contextId);
      console.log(`Created context ${contextId} for printer ${printerDetails.Name}`);

      // Step 8: Update connection state for this context
      this.connectionStateManager.setConnected(
        contextId,
        printerDetails,
        connectionResult.primaryClient,
        connectionResult.secondaryClient
      );

      // Step 9: Initialize backend for this context
      await this.backendManager.initializeBackend(contextId, {
        printerDetails,
        primaryClient: connectionResult.primaryClient,
        secondaryClient: connectionResult.secondaryClient
      });

      // Step 10: Switch to the new context
      this.contextManager.switchContext(contextId);
      console.log(`Switched to context ${contextId}`);

      this.loadingManager.showSuccess(`Connected to ${printerDetails.Name} at ${printerDetails.IPAddress}`, 4000);
      this.emit('connected', printerDetails);

      // End flow tracking
      this.endFlow(flowId);

      return {
        success: true,
        printerDetails,
        clientInstance: connectionResult.primaryClient
      };

    } catch (error) {
      const errorMessage = getConnectionErrorMessage(error);
      this.loadingManager.showError(`Connection failed: ${errorMessage}`, 5000);
      this.emit('connection-failed', errorMessage);

      // End flow tracking on error
      this.endFlow(flowId);

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

  /** Connect to an offline saved printer using saved details directly */
  private async connectToOfflineSavedPrinter(selectedSerial: string): Promise<ConnectionResult> {
    try {
      const savedPrinter = this.savedPrinterService.getSavedPrinter(selectedSerial);
      if (!savedPrinter) {
        return { success: false, error: 'Saved printer not found' };
      }

      this.loadingManager.show({ message: `Connecting to ${savedPrinter.Name} at ${savedPrinter.IPAddress}...`, canCancel: false });
      
      // Try to connect using saved details
      const result = await this.connectWithSavedDetails(savedPrinter);
      
      if (result.success) {
        await this.savedPrinterService.updateLastConnected(selectedSerial);
      }
      
      return result;
      
    } catch (error) {
      const errorMessage = getConnectionErrorMessage(error);
      this.loadingManager.showError(`Connection failed: ${errorMessage}`, 4000);
      return { success: false, error: errorMessage };
    }
  }

  /** Offer manual IP entry to user */
  private async offerManualIPEntry(): Promise<ConnectionResult> {
    if (!this.inputDialogHandler) {
      return { success: false, error: 'Manual IP entry not available - input dialog handler not set' };
    }

    try {
      const ipAddress = await this.inputDialogHandler({
        title: 'Manual Printer Connection',
        message: 'No printers found on network. Enter printer IP address manually:',
        defaultValue: '',
        inputType: 'text',
        placeholder: 'e.g., 192.168.1.100'
      });

      if (!ipAddress) {
        return { success: false, error: 'No IP address provided' };
      }

      // Validate IP address format
      const { IPAddressSchema } = await import('../utils/validation.utils');
      const validation = IPAddressSchema.safeParse(ipAddress.trim());
      if (!validation.success) {
        this.loadingManager.showError('Invalid IP address format', 3000);
        return { success: false, error: 'Invalid IP address format' };
      }

      return await this.connectDirectlyToIP(validation.data);
      
    } catch (error) {
      const errorMessage = getConnectionErrorMessage(error);
      this.loadingManager.showError(`Manual connection failed: ${errorMessage}`, 4000);
      return { success: false, error: errorMessage };
    }
  }

  /** Connect directly to an IP address */
  public async connectDirectlyToIP(ipAddress: string): Promise<ConnectionResult> {
    try {
      this.loadingManager.show({ message: `Connecting to printer at ${ipAddress}...`, canCancel: false });
      
      // Create a mock discovered printer for the connection process
      // The actual name and serial will be determined during temporary connection
      const mockDiscoveredPrinter: DiscoveredPrinter = {
        name: `Printer at ${ipAddress}`, // Temporary name, will be updated
        ipAddress: ipAddress,
        serialNumber: '', // Will be determined during connection
        model: undefined // Will be determined during connection
      };

      console.log('Starting direct IP connection to:', ipAddress);
      
      // Use the standard connection flow which will:
      // 1. Create temporary connection to get printer info
      // 2. Extract proper name and serial number
      // 3. Establish final connection with correct details
      return await this.connectToPrinter(mockDiscoveredPrinter);
      
    } catch (error) {
      const errorMessage = getConnectionErrorMessage(error);
      console.error('Direct IP connection failed:', error);
      this.loadingManager.showError(`Direct connection failed: ${errorMessage}`, 4000);
      return { success: false, error: errorMessage };
    }
  }

  /** Show saved printers for manual selection */
  private async showSavedPrintersForSelection(): Promise<ConnectionResult> {
    try {
      // Find all saved printers and create mock matches (they're not online)
      const allSavedPrinters = this.savedPrinterService.getSavedPrinters();
      const savedMatches = allSavedPrinters.map((savedPrinter: import('../types/printer').StoredPrinterDetails) => ({
        savedDetails: savedPrinter,
        discoveredPrinter: null, // Not discovered online
        ipAddressChanged: false
      }));
      
      return await this.dialogService.showSavedPrinterSelectionDialog(
        savedMatches,
        (serialNumber) => this.connectToOfflineSavedPrinter(serialNumber)
      );
    } catch (error) {
      const errorMessage = getConnectionErrorMessage(error);
      this.loadingManager.showError(`Failed to show saved printers: ${errorMessage}`, 4000);
      return { success: false, error: errorMessage };
    }
  }

  /** Connect using saved printer details */
  public async connectWithSavedDetails(details: PrinterDetails): Promise<ConnectionResult> {
    // Start tracking this connection flow
    const flowId = this.startFlow();

    try {
      // Ensure per-printer settings have defaults if not set
      const detailsWithDefaults: PrinterDetails = {
        ...details,
        customCameraEnabled: details.customCameraEnabled ?? false,
        customCameraUrl: details.customCameraUrl ?? '',
        customLedsEnabled: details.customLedsEnabled ?? false,
        forceLegacyMode: details.forceLegacyMode ?? false
      };

      // If we added defaults, save them back to printer_details.json
      if (details.customCameraEnabled === undefined ||
          details.customCameraUrl === undefined ||
          details.customLedsEnabled === undefined ||
          details.forceLegacyMode === undefined) {
        await this.savedPrinterService.savePrinter(detailsWithDefaults);
        console.log(`Initialized default per-printer settings for ${detailsWithDefaults.Name}`);
      }

      const ForceLegacyAPI = this.configManager.get('ForceLegacyAPI') || false;
      const familyInfo = detectPrinterFamily(detailsWithDefaults.printerModel);

      // Create a mock discovered printer for connection establishment
      const discoveredPrinter: DiscoveredPrinter = {
        name: detailsWithDefaults.Name,
        ipAddress: detailsWithDefaults.IPAddress,
        serialNumber: detailsWithDefaults.SerialNumber,
        model: detailsWithDefaults.printerModel
      };

      // Establish connection
      const connectionResult = await this.connectionService.establishFinalConnection(
        discoveredPrinter,
        detailsWithDefaults.printerModel,
        familyInfo.is5MFamily,
        detailsWithDefaults.CheckCode,
        ForceLegacyAPI
      );

      if (!connectionResult) {
        throw new Error('Failed to establish connection');
      }

      // Create printer context
      const contextId = this.contextManager.createContext(detailsWithDefaults);
      this.updateFlowContext(flowId, contextId);
      console.log(`Created context ${contextId} for saved printer ${details.Name}`);

      // Update connection state for this context
      this.connectionStateManager.setConnected(
        contextId,
        detailsWithDefaults,
        connectionResult.primaryClient,
        connectionResult.secondaryClient
      );

      // Initialize backend for this context
      await this.backendManager.initializeBackend(contextId, {
        printerDetails: detailsWithDefaults,
        primaryClient: connectionResult.primaryClient,
        secondaryClient: connectionResult.secondaryClient
      });

      // Switch to the new context
      this.contextManager.switchContext(contextId);
      console.log(`Switched to context ${contextId}`);

      this.emit('connected', detailsWithDefaults);

      // End flow tracking
      this.endFlow(flowId);

      return {
        success: true,
        printerDetails: detailsWithDefaults,
        clientInstance: connectionResult.primaryClient
      };

    } catch (error) {
      const errorMessage = getConnectionErrorMessage(error);
      this.emit('auto-connect-failed', errorMessage);

      // End flow tracking on error
      this.endFlow(flowId);

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
    const activeContextId = this.contextManager.getActiveContextId();
    if (!activeContextId) {
      return null;
    }
    return this.connectionStateManager.getPrimaryClient(activeContextId);
  }

  /** Get secondary client instance */
  public getSecondaryClient(): FlashForgeClient | null {
    const activeContextId = this.contextManager.getActiveContextId();
    if (!activeContextId) {
      return null;
    }
    return this.connectionStateManager.getSecondaryClient(activeContextId);
  }

  /** Get current printer details */
  public getCurrentDetails(): PrinterDetails | null {
    const activeContextId = this.contextManager.getActiveContextId();
    if (!activeContextId) {
      return null;
    }
    return this.connectionStateManager.getCurrentDetails(activeContextId);
  }
  
  /** Get backend manager instance */
  public getBackendManager() {
    return this.backendManager;
  }
  
  /** Check if backend is ready */
  public isBackendReady(): boolean {
    const activeContextId = this.contextManager.getActiveContextId();
    if (!activeContextId) {
      return false;
    }
    return this.backendManager.isBackendReady(activeContextId);
  }

  /** Clear saved printer details */
  public async clearSavedDetails(): Promise<void> {
    this.savedPrinterService.clearAllPrinters();
    this.emit('saved-details-cleared');
  }

  /** Get connection status as formatted string */
  public getConnectionStatus(): string {
    const activeContextId = this.contextManager.getActiveContextId();
    if (!activeContextId) {
      return 'Disconnected';
    }
    return this.connectionStateManager.getConnectionStatus(activeContextId);
  }

  /**
   * Connect to printers using saved printer details with discovery-based IP update
   *
   * For headless mode: Discovers printers on network, matches by serial number,
   * updates IPs if changed, connects with saved check codes.
   *
   * @param savedPrinters Array of saved printer details to connect to
   * @returns Array of successfully connected contexts with their IDs and printer details
   */
  public async connectHeadlessFromSaved(
    savedPrinters: PrinterDetails[]
  ): Promise<{ contextId: string; printer: PrinterDetails }[]> {
    const connectedContexts: { contextId: string; printer: PrinterDetails }[] = [];

    try {
      // Step 1: Discover all printers on network
      console.log('[Headless] Scanning network for printers...');
      const discoveredPrinters = await this.discoveryService.scanNetwork();
      console.log(`[Headless] Found ${discoveredPrinters.length} printer(s) on network`);

      // Step 2: Match each saved printer against discovered printers by serial number
      for (const savedPrinter of savedPrinters) {
        try {
          console.log(`[Headless] Attempting to connect to ${savedPrinter.Name} (${savedPrinter.SerialNumber})`);

          // Find matching discovered printer by serial number
          const discoveredMatch = discoveredPrinters.find(
            (dp) => dp.serialNumber === savedPrinter.SerialNumber
          );

          let updatedPrinterDetails = savedPrinter;

          // Step 3: Update IP address if discovered printer has different IP
          if (discoveredMatch && discoveredMatch.ipAddress !== savedPrinter.IPAddress) {
            console.log(
              `[Headless] IP changed for ${savedPrinter.Name}: ${savedPrinter.IPAddress} → ${discoveredMatch.ipAddress}`
            );
            updatedPrinterDetails = {
              ...savedPrinter,
              IPAddress: discoveredMatch.ipAddress
            };
            // Save updated IP
            await this.savedPrinterService.savePrinter(updatedPrinterDetails);
          }

          // Step 4: Connect using saved details (or updated IP)
          const result = await this.connectWithSavedDetails(updatedPrinterDetails);

          if (result.success && result.printerDetails) {
            // Update last connected timestamp
            await this.savedPrinterService.updateLastConnected(result.printerDetails.SerialNumber);

            // Get the active context ID (connectWithSavedDetails switches to the new context)
            const contextId = this.contextManager.getActiveContextId();
            if (contextId) {
              connectedContexts.push({
                contextId,
                printer: result.printerDetails
              });
              console.log(`[Headless] Successfully connected to ${result.printerDetails.Name}`);
            } else {
              console.error(`[Headless] Connection succeeded but no active context found for ${savedPrinter.Name}`);
            }
          } else {
            console.error(`[Headless] Failed to connect to ${savedPrinter.Name}: ${result.error}`);
          }
        } catch (error) {
          console.error(`[Headless] Error connecting to ${savedPrinter.Name}:`, error);
        }
      }

      return connectedContexts;
    } catch (error) {
      console.error('[Headless] Discovery or connection failed:', error);
      return connectedContexts;
    }
  }

  /**
   * Connect directly to printers using explicit IP, type, and check code
   *
   * For headless mode: Bypasses discovery, connects directly with provided specifications.
   *
   * @param printerSpecs Array of printer specifications (IP, type, check code)
   * @returns Array of successfully connected contexts with their IDs
   */
  public async connectHeadlessDirect(
    printerSpecs: Array<{ ip: string; type: import('../types/printer').PrinterClientType; checkCode?: string }>
  ): Promise<{ contextId: string; ip: string }[]> {
    const connectedContexts: { contextId: string; ip: string }[] = [];

    for (const spec of printerSpecs) {
      try {
        console.log(`[Headless] Connecting directly to ${spec.ip} (${spec.type})`);

        const flowId = this.startFlow();

        // Create mock discovered printer
        const mockDiscoveredPrinter: DiscoveredPrinter = {
          name: `Printer at ${spec.ip}`,
          ipAddress: spec.ip,
          serialNumber: '', // Will be determined during connection
          model: undefined
        };

        // Determine if this is a 5M family printer
        const is5MFamily = spec.type === 'new';

        // Create temporary connection to get printer info
        const tempResult = await this.connectionService.createTemporaryConnection(mockDiscoveredPrinter);
        if (!tempResult.success || !tempResult.typeName) {
          console.error(`[Headless] Failed to connect to ${spec.ip}: ${tempResult.error}`);
          this.endFlow(flowId);
          continue;
        }

        // Extract printer information
        const printerName =
          tempResult.printerInfo?.Name && typeof tempResult.printerInfo.Name === 'string'
            ? tempResult.printerInfo.Name
            : `Printer at ${spec.ip}`;

        const serialNumber =
          tempResult.printerInfo?.SerialNumber && typeof tempResult.printerInfo.SerialNumber === 'string'
            ? tempResult.printerInfo.SerialNumber
            : `Unknown-${Date.now()}`;

        const modelType = detectPrinterModelType(tempResult.typeName);

        // Preserve existing saved printer settings if available
        const existingPrinter = this.savedPrinterService.getSavedPrinter(serialNumber);

        // Use explicit check code, fallback to saved value, then default
        const checkCode = spec.checkCode || existingPrinter?.CheckCode || getDefaultCheckCode();

        // Update discovered printer with real info
        const updatedDiscoveredPrinter: DiscoveredPrinter = {
          name: printerName,
          ipAddress: spec.ip,
          serialNumber: serialNumber,
          model: tempResult.typeName
        };

        // Establish final connection
        const ForceLegacyAPI = this.configManager.get('ForceLegacyAPI') || false;
        const connectionResult = await this.connectionService.establishFinalConnection(
          updatedDiscoveredPrinter,
          tempResult.typeName,
          is5MFamily,
          checkCode,
          ForceLegacyAPI
        );

        if (!connectionResult) {
          console.error(`[Headless] Failed to establish connection to ${spec.ip}`);
          this.endFlow(flowId);
          continue;
        }

        // Save printer details
        const printerDetails: PrinterDetails = {
          Name: formatPrinterName(printerName, serialNumber),
          IPAddress: spec.ip,
          SerialNumber: serialNumber,
          CheckCode: checkCode,
          ClientType: spec.type,
          printerModel: tempResult.typeName,
          modelType,
          // Preserve previously configured per-printer overrides when present
          customCameraEnabled: existingPrinter?.customCameraEnabled ?? false,
          customCameraUrl: existingPrinter?.customCameraUrl ?? '',
          customLedsEnabled: existingPrinter?.customLedsEnabled ?? false,
          forceLegacyMode: existingPrinter?.forceLegacyMode ?? false
        };

        await this.savedPrinterService.savePrinter(printerDetails);
        await this.savedPrinterService.updateLastConnected(serialNumber);

        // Create printer context
        const contextId = this.contextManager.createContext(printerDetails);
        this.updateFlowContext(flowId, contextId);

        // Update connection state
        this.connectionStateManager.setConnected(
          contextId,
          printerDetails,
          connectionResult.primaryClient,
          connectionResult.secondaryClient
        );

        // Initialize backend
        await this.backendManager.initializeBackend(contextId, {
          printerDetails,
          primaryClient: connectionResult.primaryClient,
          secondaryClient: connectionResult.secondaryClient
        });

        // Ensure this context becomes active so WebUI routes operate correctly
        this.contextManager.switchContext(contextId);
        console.log(`[Headless] Switched active context to ${contextId}`);

        connectedContexts.push({ contextId, ip: spec.ip });
        console.log(`[Headless] Successfully connected to ${printerName} at ${spec.ip}`);

        this.endFlow(flowId);
      } catch (error) {
        console.error(`[Headless] Error connecting to ${spec.ip}:`, error);
      }
    }

    return connectedContexts;
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

