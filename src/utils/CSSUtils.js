// src/CSSUtils.js

/**
 * CSS Utilities for FlashForge UI
 * This module provides utility functions for managing CSS and UI styling
 */

/**
 * Applies a status class to an element
 * @param {HTMLElement} element - Element to apply class to
 * @param {string} status - Status value (printing, paused, error, completed, idle)
 */
export function applyStatusClass(element, status) {
    if (!element) return;
    
    // Remove all status classes
    element.className = '';
    
    // Add appropriate class based on status
    if (status === 'printing') {
        element.classList.add('printing');
    } else if (status === 'paused') {
        element.classList.add('paused');
    } else if (status === 'error' || status.includes('error')) {
        element.classList.add('error');
    } else if (status === 'completed') {
        element.classList.add('completed');
    } else {
        element.classList.add('idle');
    }
}

/**
 * Creates a toast notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(message, type = 'info', duration = 3000) {
    console.log(`Showing toast: ${message}, type: ${type}`);
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        console.log('Creating toast container');
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    console.log('Created toast element:', toast);
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'toast-close';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', () => {
        toastContainer.removeChild(toast);
    });
    
    toast.appendChild(closeButton);
    toastContainer.appendChild(toast);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (toastContainer.contains(toast)) {
            toastContainer.removeChild(toast);
        }
    }, duration);
}

/**
 * Adds CSS styles to the document
 * @param {string} cssText - CSS text to add
 */
export function addStyles(cssText) {
    const styleElement = document.createElement('style');
    styleElement.textContent = cssText;
    document.head.appendChild(styleElement);
}

// Add modal and toast styles
addStyles(`
    .modal-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .modal-content {
        background-color: var(--dark-bg);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 20px;
        max-width: 500px;
        width: 90%;
    }
    
    .modal-buttons {
        display: flex;
        justify-content: flex-end;
        margin-top: 20px;
    }
    
    .modal-buttons button {
        margin-left: 10px;
        padding: 5px 10px;
        border: none;
        border-radius: 2px;
        cursor: pointer;
    }
    
    .btn-confirm {
        background-color: var(--accent-color);
        color: white;
    }
    
    .btn-cancel {
        background-color: var(--dark-bg);
        border: 1px solid var(--border-color);
        color: var(--text-color);
    }
    
    .toast-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        pointer-events: none; /* Allow clicks to pass through container */
    }
    
    .toast {
        margin-top: 10px;
        padding: 10px 15px;
        border-radius: 4px;
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        pointer-events: auto; /* Make sure toast and its buttons can be clicked */
    }
    
    .toast-success {
        background-color: var(--success-color, #4caf50);
    }
    
    .toast-error {
        background-color: var(--error-color, #f44336);
    }
    
    .toast-warning {
        background-color: var(--warning-color, #ff9800);
    }
    
    .toast-info {
        background-color: var(--accent-color, #4285f4);
    }
    
    .toast-close {
        background: none;
        border: none;
        color: white;
        font-size: 16px;
        cursor: pointer;
        margin-left: 10px;
    }
`);