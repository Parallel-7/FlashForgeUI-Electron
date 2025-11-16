/**
 * @fileoverview Controls Grid Component
 * 
 * This component provides the main control interface with a 6x2 grid of buttons
 * for printer control operations. It extends the BaseComponent class and implements
 * sophisticated button state management, IPC communication handling, and logging
 * integration that was previously part of the monolithic UI.
 * 
 * Key features:
 * - 6x2 grid of control buttons with proper ID mapping
 * - Dynamic button state management based on printer state and connection status  
 * - Mixed IPC communication (invoke for commands, send for dialogs)
 * - Complex state-based enable/disable logic
 * - Integration with existing logging system
 * - Support for legacy printer limitations
 * - Special button styling for different action types
 * 
 * Button Mapping:
 * Row 1: LED On, Clear Status
 * Row 2: LED Off, Home Axes
 * Row 3: Pause, Upload Job
 * Row 4: Resume, Start Recent
 * Row 5: Stop, Start Local
 * Row 6: Swap Filament, Send Cmds
 * 
 * Usage:
 *   const controlsGrid = new ControlsGridComponent(parentElement);
 *   await controlsGrid.initialize();
 *   controlsGrid.update({ printerState: 'Printing', connectionState: true });
 */

import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import './controls-grid.css';

/**
 * Interface for button mapping configuration
 */
interface ButtonMapping {
  /** Button element ID */
  id: string;
  /** IPC action type - 'send' for dialogs, 'invoke' for commands */
  action: 'send' | 'invoke';
  /** IPC channel name */
  channel: string;
  /** Additional data to send with the IPC call */
  data?: unknown;
  /** Whether this button requires an active connection */
  requiresConnection: boolean;
  /** Whether this button should be disabled during active printing */
  disableDuringPrint: boolean;
  /** Whether this button is supported on legacy printers */
  legacySupported: boolean;
}

/**
 * Response interface for IPC invoke operations
 */
interface IPCResponse {
  success: boolean;
  error?: string;
  data?: unknown;
}

/**
 * Controls Grid Component class that handles the 6x2 button grid interface
 */
export class ControlsGridComponent extends BaseComponent {
  /** Component identifier for the controls grid */
  public readonly componentId: string = 'controls-grid';

  /** HTML template loaded from external file */
  public readonly templateHTML: string = `
    <!-- Controls Grid HTML Template -->
    <!-- 6x2 grid of control buttons extracted from main UI -->
    <div class="controls-grid-container">
      <div class="panel-header">Controls</div>
      <div class="panel-content">
        <!-- Row 1: LED On, Clear Status -->
        <div class="btn-row">
          <button id="btn-led-on" data-action="invoke" data-channel="led-on">LED On</button>
          <button id="btn-clear-status" data-action="invoke" data-channel="clear-status">Clear Status</button>
        </div>

        <!-- Row 2: LED Off, Home Axes -->
        <div class="btn-row">
          <button id="btn-led-off" data-action="invoke" data-channel="led-off">LED Off</button>
          <button id="btn-home-axes" data-action="invoke" data-channel="home-axes">Home Axes</button>
        </div>

        <!-- Row 3: Pause, Upload Job -->
        <div class="btn-row">
          <button id="btn-pause" data-action="invoke" data-channel="pause-print">Pause</button>
          <button id="btn-upload-job" data-action="send" data-channel="open-job-uploader">Upload Job</button>
        </div>

        <!-- Row 4: Resume, Start Recent -->
        <div class="btn-row">
          <button id="btn-resume" data-action="invoke" data-channel="resume-print">Resume</button>
          <button id="btn-start-recent" data-action="send" data-channel="show-recent-files">Start Recent</button>
        </div>

        <!-- Row 5: Stop, Start Local -->
        <div class="btn-row">
          <button id="btn-stop" data-action="invoke" data-channel="cancel-print">Stop</button>
          <button id="btn-start-local" data-action="send" data-channel="show-local-files">Start Local</button>
        </div>

        <!-- Row 6: Swap Filament, Send Cmds -->
        <div class="btn-row">
          <button id="btn-swap-filament" data-action="invoke" data-channel="swap-filament">Swap Filament</button>
        <button id="btn-send-cmds" data-action="send" data-channel="open-send-commands">Send Cmds</button>
      </div>
    </div>
  `;

  /** Button mapping configuration for all 12 control buttons */
  private readonly buttonMappings: ReadonlyArray<ButtonMapping> = [
    // Row 1: LED controls and status
    {
      id: 'btn-led-on',
      action: 'invoke',
      channel: 'led-on',
      requiresConnection: true,
      disableDuringPrint: false,
      legacySupported: false
    },
    {
      id: 'btn-clear-status',
      action: 'invoke',
      channel: 'clear-status',
      requiresConnection: true,
      disableDuringPrint: true,
      legacySupported: false // Not supported on legacy printers
    },

    // Row 2: LED off and homing
    {
      id: 'btn-led-off',
      action: 'invoke',
      channel: 'led-off',
      requiresConnection: true,
      disableDuringPrint: false,
      legacySupported: false
    },
    {
      id: 'btn-home-axes',
      action: 'invoke',
      channel: 'home-axes',
      requiresConnection: true,
      disableDuringPrint: true, // Dangerous during printing
      legacySupported: true
    },

    // Row 3: Print control and job upload
    {
      id: 'btn-pause',
      action: 'invoke',
      channel: 'pause-print',
      requiresConnection: true,
      disableDuringPrint: false, // Only enabled during printing
      legacySupported: true
    },
    {
      id: 'btn-upload-job',
      action: 'send',
      channel: 'open-job-uploader',
      requiresConnection: false, // Can upload without connection
      disableDuringPrint: true, // Disabled during active jobs
      legacySupported: false // Not supported on legacy printers
    },

    // Row 4: Resume and recent files
    {
      id: 'btn-resume',
      action: 'invoke',
      channel: 'resume-print',
      requiresConnection: true,
      disableDuringPrint: false, // Only enabled when paused
      legacySupported: true
    },
    {
      id: 'btn-start-recent',
      action: 'send',
      channel: 'show-recent-files',
      requiresConnection: false,
      disableDuringPrint: true, // Disabled during active jobs
      legacySupported: true
    },

    // Row 5: Stop and local files
    {
      id: 'btn-stop',
      action: 'invoke',
      channel: 'cancel-print',
      requiresConnection: true,
      disableDuringPrint: false, // Only enabled during active jobs
      legacySupported: true
    },
    {
      id: 'btn-start-local',
      action: 'send',
      channel: 'show-local-files',
      requiresConnection: false,
      disableDuringPrint: true, // Disabled during active jobs
      legacySupported: true // Supported on legacy printers
    },

    // Row 6: Filament and commands
    {
      id: 'btn-swap-filament',
      action: 'invoke',
      channel: 'swap-filament',
      requiresConnection: true,
      disableDuringPrint: true, // Dangerous during printing
      legacySupported: true
    },
    {
      id: 'btn-send-cmds',
      action: 'send',
      channel: 'open-send-commands',
      requiresConnection: false, // Always available
      disableDuringPrint: false, // Always available
      legacySupported: true
    }
  ];

  /** Current component state tracking */
  private currentState: {
    printerState?: string;
    connectionState?: boolean;
    isLegacyPrinter?: boolean;
    isActiveJob?: boolean;
    canControlPrint?: boolean;
  } = {};

  /**
   * Creates a new ControlsGridComponent instance
   * @param parentElement - The parent DOM element where this component will be rendered
   */
  constructor(parentElement: HTMLElement) {
    super(parentElement);
  }

  /**
   * Called after component is initialized to set up button references and state
   */
  protected async onInitialized(): Promise<void> {
    // Validate all buttons exist in the DOM
    const missingButtons: string[] = [];
    for (const mapping of this.buttonMappings) {
      const button = this.findElementById(mapping.id);
      if (!button) {
        missingButtons.push(mapping.id);
      }
    }

    if (missingButtons.length > 0) {
      const error = `Controls Grid Component: Missing buttons: ${missingButtons.join(', ')}`;
      console.error(error);
      throw new Error(error);
    }

    console.log('Controls Grid Component: Successfully initialized with 12 control buttons');
  }

  /**
   * Setup event listeners for all control buttons
   */
  protected async setupEventListeners(): Promise<void> {
    try {
      // Set up click listeners for all mapped buttons
      for (const mapping of this.buttonMappings) {
        const button = this.findElementById(mapping.id);
        if (button) {
          this.addEventListener(button, 'click', async (event) => {
            await this.handleButtonClick(event, mapping);
          });
        }
      }

      console.log(`Controls Grid Component: Set up event listeners for ${this.buttonMappings.length} buttons`);
      
    } catch (error) {
      console.error('Controls Grid Component: Failed to setup event listeners:', error);
      throw error;
    }
  }

  /**
   * Update component with new data and refresh button states
   * @param data - Component update data containing printer state and connection info
   */
  public update(data: ComponentUpdateData): void {
    this.assertInitialized();

    try {
      // Extract relevant state from update data
      const newState = {
        printerState: data.printerState,
        connectionState: data.connectionState,
        isLegacyPrinter: data.backendCapabilities?.isLegacy as boolean ?? false,
        isActiveJob: this.determineActiveJobState(data.printerState),
        canControlPrint: this.determineControlPrintCapability(data.printerState)
      };

      // Update internal state
      this.currentState = newState;

      // Update button states
      this.updateButtonStates();

      // Update component state tracking
      this.updateState(data);

    } catch (error) {
      console.error('Controls Grid Component: Failed to update component:', error);
    }
  }

  /**
   * Handle button click events with proper IPC routing and error handling
   * @param event - Click event
   * @param mapping - Button mapping configuration
   */
  private async handleButtonClick(event: Event, mapping: ButtonMapping): Promise<void> {
    const button = event.target as HTMLButtonElement;
    
    // Prevent action if button is disabled
    if (button.disabled || button.classList.contains('disabled')) {
      console.log(`Controls Grid Component: Button ${mapping.id} is disabled, ignoring click`);
      return;
    }

    try {
      // Add visual feedback
      button.classList.add('state-changing');
      
      // Log the action
      this.logAction(`Executing ${mapping.action} command: ${mapping.channel}`);

      if (mapping.action === 'invoke') {
        // Handle invoke commands (printer operations)
        await this.handleInvokeCommand(mapping);
      } else {
        // Handle send commands (dialog opening)
        this.handleSendCommand(mapping);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logAction(`Command ${mapping.channel} failed: ${errorMessage}`, 'error');
      console.error(`Controls Grid Component: Button ${mapping.id} command failed:`, error);
    } finally {
      // Remove visual feedback
      setTimeout(() => {
        button.classList.remove('state-changing');
      }, 300);
    }
  }

  /**
   * Handle IPC invoke commands that return responses
   * @param mapping - Button mapping configuration
   */
  private async handleInvokeCommand(mapping: ButtonMapping): Promise<void> {
    try {
      // Use properly typed window.api from global definitions
      if (!window.api || !window.api.invoke) {
        throw new Error('IPC API not available');
      }

      const response = await window.api.invoke(mapping.channel, mapping.data) as IPCResponse;
      
      if (response.success) {
        this.logAction(`Command ${mapping.channel} executed successfully`);
      } else {
        this.logAction(`Command ${mapping.channel} failed: ${response.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logAction(`IPC invoke failed for ${mapping.channel}: ${errorMessage}`, 'error');
      throw error;
    }
  }

  /**
   * Handle IPC send commands (typically for opening dialogs)
   * @param mapping - Button mapping configuration
   */
  private handleSendCommand(mapping: ButtonMapping): void {
    try {
      // Use properly typed window.api from global definitions
      if (!window.api || !window.api.send) {
        throw new Error('IPC API not available');
      }

      if (mapping.data !== undefined) {
        window.api.send(mapping.channel, mapping.data);
      } else {
        window.api.send(mapping.channel);
      }
      
      this.logAction(`Dialog command ${mapping.channel} sent`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logAction(`IPC send failed for ${mapping.channel}: ${errorMessage}`, 'error');
      throw error;
    }
  }

  /**
   * Update all button states based on current printer state and connection status
   */
  private updateButtonStates(): void {
    const { printerState, connectionState, isLegacyPrinter } = this.currentState;
    const isConnected = connectionState === true;
    const isActiveJob = this.currentState.isActiveJob;
    const canControlPrint = this.currentState.canControlPrint;

    for (const mapping of this.buttonMappings) {
      const button = this.findElementById<HTMLButtonElement>(mapping.id);
      if (!button) {
        continue;
      }

      let shouldDisable = false;
      let reason = '';

      // Check connection requirement
      if (mapping.requiresConnection && !isConnected) {
        shouldDisable = true;
        reason = 'No connection';
      }

      // Check legacy printer support
      if (isLegacyPrinter && !mapping.legacySupported) {
        shouldDisable = true;
        reason = 'Legacy unsupported';
        button.classList.add('legacy-unsupported');
      } else {
        button.classList.remove('legacy-unsupported');
      }

      // Check active job restrictions
      if (mapping.disableDuringPrint && isActiveJob) {
        shouldDisable = true;
        reason = 'Active job';
      }

      // Special logic for print control buttons
      if (mapping.id === 'btn-pause') {
        // Pause only enabled during printing states
        shouldDisable = printerState !== 'Printing';
        reason = shouldDisable ? 'Not printing' : '';
      } else if (mapping.id === 'btn-resume') {
        // Resume only enabled during paused state
        shouldDisable = printerState !== 'Paused';
        reason = shouldDisable ? 'Not paused' : '';
      } else if (mapping.id === 'btn-stop') {
        // Stop only enabled during controllable print states
        shouldDisable = !canControlPrint;
        reason = shouldDisable ? 'Cannot control print' : '';
      }

      // Apply button state
      if (shouldDisable) {
        button.classList.add('disabled');
        button.setAttribute('disabled', 'true');
        button.disabled = true;
        button.title = `Disabled: ${reason}`;
      } else {
        button.classList.remove('disabled');
        button.removeAttribute('disabled');
        button.disabled = false;
        button.title = '';
      }
    }
  }

  /**
   * Determine if there's an active job based on printer state
   * @param printerState - Current printer state
   * @returns True if there's an active job
   */
  private determineActiveJobState(printerState?: string): boolean {
    if (!printerState) return false;
    
    const activeStates = ['Printing', 'Paused', 'Resuming', 'Starting'];
    return activeStates.includes(printerState);
  }

  /**
   * Determine if print can be controlled (stopped/paused) based on printer state
   * @param printerState - Current printer state
   * @returns True if print can be controlled
   */
  private determineControlPrintCapability(printerState?: string): boolean {
    if (!printerState) return false;
    
    const controllableStates = ['Printing', 'Paused', 'Resuming'];
    return controllableStates.includes(printerState);
  }

  /**
   * Log action to the global log system (integration with existing logMessage function)
   * @param message - Log message
   * @param type - Message type for styling
   */
  private logAction(message: string, type: 'info' | 'error' = 'info'): void {
    try {
      // Use the existing global logMessage function from renderer.ts
      // This maintains compatibility with the existing logging system
      const logMessage = (globalThis as { logMessage?: (msg: string) => void }).logMessage ||
                        (window as { logMessage?: (msg: string) => void }).logMessage;

      if (typeof logMessage === 'function') {
        const prefix = type === 'error' ? '[ERROR] ' : '';
        logMessage(`${prefix}${message}`);
      } else {
        // Fallback to console if global logMessage not available
        console.log(`Controls Grid: ${message}`);
      }
    } catch (error) {
      console.warn('Controls Grid Component: Failed to log message:', error);
    }
  }

  /**
   * Get current button states for debugging
   * @returns Object mapping button IDs to their current states
   */
  public getButtonStates(): Record<string, { disabled: boolean; reason: string }> {
    this.assertInitialized();

    const states: Record<string, { disabled: boolean; reason: string }> = {};
    
    for (const mapping of this.buttonMappings) {
      const button = this.findElementById<HTMLButtonElement>(mapping.id);
      if (button) {
        states[mapping.id] = {
          disabled: button.disabled,
          reason: button.title || 'No reason'
        };
      }
    }

    return states;
  }

  /**
   * Component-specific cleanup logic
   */
  protected cleanup(): void {
    // Clear current state
    this.currentState = {};
    
    console.log('Controls Grid Component: Cleanup completed');
  }
}
