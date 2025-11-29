/**
 * @fileoverview Renderer-side UI updater service.
 *
 * This service provides utility functions that safely update DOM elements
 * with printer data from polling responses. It handles data formatting, element validation,
 * and visual state management to ensure smooth UI updates without flickering or errors.
 *
 * Note: This is a simplified version for the renderer process, mirroring key functionality
 * from the main process service but adapted for direct DOM manipulation in the renderer.
 */

import type {
  PollingData,
  PrinterStatus,
  MaterialStationStatus
} from '@shared/types/polling.js';
import {
  formatTemperature,
  formatWeight,
  formatLength
} from '@shared/types/polling.js';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely get DOM element by ID
 */
function getElement(id: string): HTMLElement | null {
  try {
    return document.getElementById(id);
  } catch (error) {
    console.warn(`Element not found: ${id}`, error);
    return null;
  }
}

/**
 * Safely set text content of element
 */
function setElementText(id: string, text: string): void {
  const element = getElement(id);
  if (element) {
    element.textContent = text;
  }
}

/**
 * Safely set element attribute
 */
function setElementAttribute(id: string, attribute: string, value: string | number): void {
  const element = getElement(id);
  if (element) {
    element.setAttribute(attribute, value.toString());
  }
}

/**
 * Safely add/remove CSS class
 */
function setElementClass(id: string, className: string, add: boolean): void {
  const element = getElement(id);
  if (element) {
    if (add) {
      element.classList.add(className);
    } else {
      element.classList.remove(className);
    }
  }
}

/**
 * Reset UI to default state
 */
export function resetUI(): void {
  console.log('Resetting UI to default state');
  // Basic reset logic for legacy UI elements if needed
  const statusElement = getElement('printer-status');
  if (statusElement) {
    statusElement.textContent = 'Disconnected';
    statusElement.classList.remove('connected', 'printing', 'error');
    statusElement.classList.add('disconnected');
  }
}

/**
 * Handle UI update errors gracefully
 */
export function handleUIError(error: unknown, context: string): void {
  console.error(`UI update error in ${context}:`, error);
}

/**
 * Initialize UI animations
 */
export function initializeUIAnimations(): void {
  // Animations are handled by CSS or specific component logic
}
