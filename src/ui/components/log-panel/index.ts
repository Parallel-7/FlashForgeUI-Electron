/**
 * @fileoverview Log Panel Component Module Exports
 * 
 * This file provides the main exports for the Log Panel component module,
 * including the component class and any related types or utilities.
 * 
 * The CSS is imported automatically when the component is imported, ensuring
 * that the styles are available when the component is used.
 */

// Import CSS to ensure styles are loaded
import './log-panel.css';

// Export the main component class
export { LogPanelComponent } from './log-panel.js';

// Re-export common types from base component for convenience
export type { ComponentUpdateData, ComponentState } from '../base/types.js';
