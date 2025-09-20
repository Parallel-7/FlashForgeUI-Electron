// src/windows/WindowManager.ts - Centralized window state management
import { BrowserWindow } from 'electron';

/**
 * WindowManager provides centralized management of all BrowserWindow instances
 * in the application. Uses a singleton pattern to ensure consistent state
 * across all modules while providing type-safe access to window references.
 */

export enum WindowType {
  MAIN = 'main',
  SETTINGS = 'settings',
  STATUS = 'status',
  LOG_DIALOG = 'logDialog',
  INPUT_DIALOG = 'inputDialog',
  JOB_UPLOADER = 'jobUploader',
  PRINTER_SELECTION = 'printerSelection',
  JOB_PICKER = 'jobPicker',
  SEND_COMMANDS = 'sendCommands',
  IFS_DIALOG = 'ifsDialog',
  MATERIAL_INFO_DIALOG = 'materialInfoDialog',
  MATERIAL_MATCHING_DIALOG = 'materialMatchingDialog',
  SINGLE_COLOR_CONFIRMATION_DIALOG = 'singleColorConfirmationDialog',
  AUTO_CONNECT_CHOICE_DIALOG = 'autoConnectChoiceDialog',
  CONNECT_CHOICE_DIALOG = 'connectChoiceDialog'
}

class WindowManager {
  private static instance: WindowManager;
  private readonly windows: Map<WindowType, BrowserWindow | null> = new Map();

  private constructor() {
    // Initialize all window slots as null
    Object.values(WindowType).forEach(type => {
      this.windows.set(type, null);
    });
  }

  public static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  /**
   * Get a window reference by type
   * @param type - The window type to retrieve
   * @returns The BrowserWindow instance or null if not set
   */
  public getWindow(type: WindowType): BrowserWindow | null {
    return this.windows.get(type) || null;
  }

  /**
   * Set a window reference by type
   * @param type - The window type to set
   * @param window - The BrowserWindow instance or null to clear
   */
  public setWindow(type: WindowType, window: BrowserWindow | null): void {
    this.windows.set(type, window);
  }

  /**
   * Clear a window reference by type
   * @param type - The window type to clear
   */
  public clearWindow(type: WindowType): void {
    this.windows.set(type, null);
  }

  /**
   * Check if a window of the specified type exists and is not destroyed
   * @param type - The window type to check
   * @returns True if window exists and is not destroyed
   */
  public hasWindow(type: WindowType): boolean {
    const window = this.windows.get(type);
    return window !== null && window !== undefined && !window.isDestroyed();
  }

  // Convenience methods for main window access
  public getMainWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.MAIN);
  }

  public setMainWindow(window: BrowserWindow): void {
    this.setWindow(WindowType.MAIN, window);
  }

  public hasMainWindow(): boolean {
    return this.hasWindow(WindowType.MAIN);
  }

  // Convenience methods for settings window access
  public getSettingsWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.SETTINGS);
  }

  public setSettingsWindow(window: BrowserWindow | null): void {
    this.setWindow(WindowType.SETTINGS, window);
  }

  public hasSettingsWindow(): boolean {
    return this.hasWindow(WindowType.SETTINGS);
  }

  // Convenience methods for status window access
  public getStatusWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.STATUS);
  }

  public setStatusWindow(window: BrowserWindow | null): void {
    this.setWindow(WindowType.STATUS, window);
  }

  public hasStatusWindow(): boolean {
    return this.hasWindow(WindowType.STATUS);
  }

  // Convenience methods for log dialog access
  public getLogDialog(): BrowserWindow | null {
    return this.getWindow(WindowType.LOG_DIALOG);
  }

  public setLogDialog(window: BrowserWindow | null): void {
    this.setWindow(WindowType.LOG_DIALOG, window);
  }

  public hasLogDialog(): boolean {
    return this.hasWindow(WindowType.LOG_DIALOG);
  }

  // Convenience methods for input dialog access
  public getInputDialogWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.INPUT_DIALOG);
  }

  public setInputDialogWindow(window: BrowserWindow | null): void {
    this.setWindow(WindowType.INPUT_DIALOG, window);
  }

  public hasInputDialogWindow(): boolean {
    return this.hasWindow(WindowType.INPUT_DIALOG);
  }

  // Convenience methods for job uploader access
  public getJobUploaderWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.JOB_UPLOADER);
  }

  public setJobUploaderWindow(window: BrowserWindow | null): void {
    this.setWindow(WindowType.JOB_UPLOADER, window);
  }

  public hasJobUploaderWindow(): boolean {
    return this.hasWindow(WindowType.JOB_UPLOADER);
  }

  // Convenience methods for printer selection access
  public getPrinterSelectionWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.PRINTER_SELECTION);
  }

  public setPrinterSelectionWindow(window: BrowserWindow | null): void {
    this.setWindow(WindowType.PRINTER_SELECTION, window);
  }

  public hasPrinterSelectionWindow(): boolean {
    return this.hasWindow(WindowType.PRINTER_SELECTION);
  }

  // Convenience methods for job picker access
  public getJobPickerWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.JOB_PICKER);
  }

  public setJobPickerWindow(window: BrowserWindow | null): void {
    this.setWindow(WindowType.JOB_PICKER, window);
  }

  public hasJobPickerWindow(): boolean {
    return this.hasWindow(WindowType.JOB_PICKER);
  }

  // Convenience methods for send commands access
  public getSendCommandsWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.SEND_COMMANDS);
  }

  public setSendCommandsWindow(window: BrowserWindow | null): void {
    this.setWindow(WindowType.SEND_COMMANDS, window);
  }

  public hasSendCommandsWindow(): boolean {
    return this.hasWindow(WindowType.SEND_COMMANDS);
  }

  // Convenience methods for IFS dialog access
  public getIFSDialogWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.IFS_DIALOG);
  }

  public setIFSDialogWindow(window: BrowserWindow | null): void {
    this.setWindow(WindowType.IFS_DIALOG, window);
  }

  public hasIFSDialogWindow(): boolean {
    return this.hasWindow(WindowType.IFS_DIALOG);
  }

  // Convenience methods for material info dialog access
  public getMaterialInfoDialogWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.MATERIAL_INFO_DIALOG);
  }

  public setMaterialInfoDialogWindow(window: BrowserWindow | null): void {
    this.setWindow(WindowType.MATERIAL_INFO_DIALOG, window);
  }

  public hasMaterialInfoDialogWindow(): boolean {
    return this.hasWindow(WindowType.MATERIAL_INFO_DIALOG);
  }

  // Convenience methods for material matching dialog access
  public getMaterialMatchingDialogWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.MATERIAL_MATCHING_DIALOG);
  }

  public setMaterialMatchingDialogWindow(window: BrowserWindow | null): void {
    this.setWindow(WindowType.MATERIAL_MATCHING_DIALOG, window);
  }

  public hasMaterialMatchingDialogWindow(): boolean {
    return this.hasWindow(WindowType.MATERIAL_MATCHING_DIALOG);
  }

  // Convenience methods for single color confirmation dialog access
  public getSingleColorConfirmationDialogWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.SINGLE_COLOR_CONFIRMATION_DIALOG);
  }

  public setSingleColorConfirmationDialogWindow(window: BrowserWindow | null): void {
    this.setWindow(WindowType.SINGLE_COLOR_CONFIRMATION_DIALOG, window);
  }

  public hasSingleColorConfirmationDialogWindow(): boolean {
    return this.hasWindow(WindowType.SINGLE_COLOR_CONFIRMATION_DIALOG);
  }

  // Convenience methods for auto-connect choice dialog access
  public getAutoConnectChoiceDialogWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.AUTO_CONNECT_CHOICE_DIALOG);
  }

  public setAutoConnectChoiceDialogWindow(window: BrowserWindow | null): void {
    this.setWindow(WindowType.AUTO_CONNECT_CHOICE_DIALOG, window);
  }

  public hasAutoConnectChoiceDialogWindow(): boolean {
    return this.hasWindow(WindowType.AUTO_CONNECT_CHOICE_DIALOG);
  }

  // Convenience methods for connect choice dialog access
  public getConnectChoiceDialogWindow(): BrowserWindow | null {
    return this.getWindow(WindowType.CONNECT_CHOICE_DIALOG);
  }

  public setConnectChoiceDialogWindow(window: BrowserWindow | null): void {
    this.setWindow(WindowType.CONNECT_CHOICE_DIALOG, window);
  }

  public hasConnectChoiceDialogWindow(): boolean {
    return this.hasWindow(WindowType.CONNECT_CHOICE_DIALOG);
  }

  /**
   * Get all active windows (non-null and not destroyed)
   * @returns Array of active BrowserWindow instances
   */
  public getActiveWindows(): BrowserWindow[] {
    const activeWindows: BrowserWindow[] = [];
    
    this.windows.forEach((window) => {
      if (window && !window.isDestroyed()) {
        activeWindows.push(window);
      }
    });
    
    return activeWindows;
  }

  /**
   * Close all windows except the main window
   */
  public closeAllExceptMain(): void {
    this.windows.forEach((window, type) => {
      if (type !== WindowType.MAIN && window && !window.isDestroyed()) {
        window.close();
      }
    });
  }

  /**
   * Close all windows
   */
  public closeAll(): void {
    this.windows.forEach((window) => {
      if (window && !window.isDestroyed()) {
        window.close();
      }
    });
  }
}

/**
 * Get the singleton WindowManager instance
 * @returns The WindowManager singleton instance
 */
export const getWindowManager = (): WindowManager => WindowManager.getInstance();
