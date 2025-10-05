/**
 * @fileoverview Centralized loading state manager for modal loading overlays and user feedback.
 *
 * Provides comprehensive loading state management for preventing user interaction during async operations:
 * - Modal loading overlay control (show/hide/progress)
 * - Success and error state display with auto-hide functionality
 * - Progress tracking with percentage updates
 * - Cancelable operations support
 * - Event-driven state updates for renderer synchronization
 *
 * Key exports:
 * - LoadingManager class: Main loading state controller
 * - getLoadingManager(): Singleton accessor function
 * - LoadingState type: State enumeration (hidden/loading/success/error)
 * - LoadingOptions interface: Configuration for loading operations
 *
 * The manager emits events that are forwarded to the renderer process via IPC handlers,
 * enabling synchronized loading state display across the application. Supports auto-hide
 * functionality for success/error states with configurable timeout values.
 */

import { EventEmitter } from 'events';

/**
 * Loading state types for different UI states
 */
export type LoadingState = 'hidden' | 'loading' | 'success' | 'error';

/**
 * Loading operation options for customizing behavior
 */
export interface LoadingOptions {
  message: string;
  canCancel?: boolean;
  showProgress?: boolean;
  autoHideAfter?: number; // milliseconds
}

/**
 * Loading event data sent to renderer
 */
export interface LoadingEventData {
  state: LoadingState;
  message?: string;
  progress?: number;
  canCancel?: boolean;
  autoHideAfter?: number;
}

/**
 * Centralized loading manager for controlling modal loading states
 * Prevents user interaction during async operations and provides feedback
 */
export class LoadingManager extends EventEmitter {
  private currentState: LoadingState = 'hidden';
  private currentMessage: string = '';
  private currentProgress: number = 0;
  private canCancel: boolean = false;
  private autoHideTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Show loading overlay with message
   */
  public show(options: LoadingOptions): void {
    this.clearAutoHideTimeout();
    
    this.currentState = 'loading';
    this.currentMessage = options.message;
    this.currentProgress = 0;
    this.canCancel = options.canCancel || false;

    const eventData: LoadingEventData = {
      state: this.currentState,
      message: this.currentMessage,
      progress: this.currentProgress,
      canCancel: this.canCancel
    };

    this.emit('loading-state-changed', eventData);
    this.emit('loading-show', eventData);
  }

  /**
   * Hide loading overlay
   */
  public hide(): void {
    this.clearAutoHideTimeout();
    
    this.currentState = 'hidden';
    this.currentMessage = '';
    this.currentProgress = 0;
    this.canCancel = false;

    const eventData: LoadingEventData = {
      state: this.currentState
    };

    this.emit('loading-state-changed', eventData);
    this.emit('loading-hide', eventData);
  }

  /**
   * Show success state with message and optional auto-hide
   */
  public showSuccess(message: string, autoHideAfter: number = 4000): void {
    this.clearAutoHideTimeout();
    
    this.currentState = 'success';
    this.currentMessage = message; // Keep the success message visible
    this.canCancel = false;

    const eventData: LoadingEventData = {
      state: this.currentState,
      message: this.currentMessage,
      canCancel: this.canCancel,
      autoHideAfter
    };

    this.emit('loading-state-changed', eventData);
    this.emit('loading-success', eventData);

    // Auto-hide after specified time
    if (autoHideAfter > 0) {
      this.autoHideTimeout = setTimeout(() => {
        this.hide();
      }, autoHideAfter);
    }
  }

  /**
   * Show error state with optional auto-hide
   */
  public showError(message: string, autoHideAfter: number = 5000): void {
    this.clearAutoHideTimeout();
    
    this.currentState = 'error';
    this.currentMessage = message;
    this.canCancel = false;

    const eventData: LoadingEventData = {
      state: this.currentState,
      message: this.currentMessage,
      canCancel: this.canCancel,
      autoHideAfter
    };

    this.emit('loading-state-changed', eventData);
    this.emit('loading-error', eventData);

    // Auto-hide after specified time
    if (autoHideAfter > 0) {
      this.autoHideTimeout = setTimeout(() => {
        this.hide();
      }, autoHideAfter);
    }
  }

  /**
   * Update loading progress (0-100)
   */
  public setProgress(progress: number): void {
    if (this.currentState !== 'loading') {
      return; // Only update progress during loading state
    }

    this.currentProgress = Math.max(0, Math.min(100, progress));

    const eventData: LoadingEventData = {
      state: this.currentState,
      message: this.currentMessage,
      progress: this.currentProgress,
      canCancel: this.canCancel
    };

    this.emit('loading-state-changed', eventData);
    this.emit('loading-progress', eventData);
  }

  /**
   * Update loading message without changing state
   */
  public updateMessage(message: string): void {
    if (this.currentState === 'hidden') {
      return; // Don't update message when hidden
    }

    this.currentMessage = message;

    const eventData: LoadingEventData = {
      state: this.currentState,
      message: this.currentMessage,
      progress: this.currentProgress,
      canCancel: this.canCancel
    };

    this.emit('loading-state-changed', eventData);
    this.emit('loading-message-updated', eventData);
  }

  /**
   * Handle cancel request from user
   */
  public handleCancelRequest(): boolean {
    if (this.currentState === 'loading' && this.canCancel) {
      this.emit('loading-cancelled');
      this.hide();
      return true;
    }
    return false;
  }

  /**
   * Get current loading state
   */
  public getState(): LoadingState {
    return this.currentState;
  }

  /**
   * Get current loading message
   */
  public getMessage(): string {
    return this.currentMessage;
  }

  /**
   * Get current progress
   */
  public getProgress(): number {
    return this.currentProgress;
  }

  /**
   * Check if loading is currently visible
   */
  public isVisible(): boolean {
    return this.currentState !== 'hidden';
  }

  /**
   * Check if cancel is available
   */
  public isCancellable(): boolean {
    return this.canCancel && this.currentState === 'loading';
  }

  /**
   * Clear auto-hide timeout
   */
  private clearAutoHideTimeout(): void {
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = null;
    }
  }

  /**
   * Dispose of resources and clear all timeouts
   */
  public dispose(): void {
    this.clearAutoHideTimeout();
    this.removeAllListeners();
    this.currentState = 'hidden';
  }
}

// Export singleton instance
let loadingManager: LoadingManager | null = null;

export const getLoadingManager = (): LoadingManager => {
  if (!loadingManager) {
    loadingManager = new LoadingManager();
  }
  return loadingManager;
};
