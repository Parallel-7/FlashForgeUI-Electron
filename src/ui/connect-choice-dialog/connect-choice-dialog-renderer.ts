/**
 * @fileoverview Connect choice dialog renderer - Handles UI interactions and user choice
 * management for the connect options dialog. Provides interface for choosing between
 * manual IP entry and network scanning for printer connections.
 */

import type { ConnectChoiceOption, ConnectChoiceData } from './connect-choice-dialog-preload';

// Global state
let isHandlingChoice = false;

/**
 * Initialize the dialog when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', (): void => {
  console.log('Connect choice dialog renderer loaded');
  window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['globe', 'wifi']);
  setupEventListeners();
  
  // Listen for initialization data from main process
  window.connectChoiceAPI.onDialogInit((data: ConnectChoiceData & { responseChannel: string }) => {
    console.log('Received connect choice dialog data:', data);
    updateDialogUI(data);
  });
});

/**
 * Setup event listeners for dialog controls
 */
function setupEventListeners(): void {
  // Enter IP button
  const enterIPBtn = document.getElementById('btn-enter-ip');
  if (enterIPBtn) {
    enterIPBtn.addEventListener('click', () => void handleChoice('enter-ip'));
  }

  // Scan network button
  const scanNetworkBtn = document.getElementById('btn-scan-network');
  if (scanNetworkBtn) {
    scanNetworkBtn.addEventListener('click', () => void handleChoice('scan-network'));
  }

  // Cancel button
  const cancelBtn = document.getElementById('btn-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => void handleChoice('cancel'));
  }

  // Handle keyboard events
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      void handleChoice('cancel');
    } else if (event.key === 'Enter') {
      // Default to scan network on Enter
      void handleChoice('scan-network');
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      // Handle arrow key navigation
      handleArrowNavigation(event);
    }
  });

  // Handle window beforeunload
  window.addEventListener('beforeunload', () => {
    window.connectChoiceAPI.removeAllListeners();
  });
}

/**
 * Handle arrow key navigation between buttons
 */
function handleArrowNavigation(event: KeyboardEvent): void {
  event.preventDefault();
  
  const buttons = [
    document.getElementById('btn-enter-ip'),
    document.getElementById('btn-scan-network'),
    document.getElementById('btn-cancel')
  ].filter(btn => btn !== null) as HTMLElement[];

  const currentIndex = buttons.findIndex(btn => btn === document.activeElement);
  let newIndex: number;

  if (event.key === 'ArrowDown') {
    newIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
  } else {
    newIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
  }

  buttons[newIndex].focus();
}

/**
 * Update dialog UI based on initialization data
 */
function updateDialogUI(data: ConnectChoiceData): void {
  // For now, the dialog is static
  // This function can be expanded to show dynamic content based on data
  console.log('Dialog initialized with data:', data);
  
  // Add subtle animation to buttons
  const buttons = document.querySelectorAll('.choice-button');
  buttons.forEach((button, index) => {
    const element = button as HTMLElement;
    element.style.animationDelay = `${index * 100}ms`;
    element.style.animation = 'slideInUp 0.3s ease-out forwards';
  });

  // Add CSS for animations
  if (!document.querySelector('#dynamic-animations')) {
    const style = document.createElement('style');
    style.id = 'dynamic-animations';
    style.textContent = `
      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .choice-button {
        opacity: 0;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Handle user choice selection
 */
async function handleChoice(action: ConnectChoiceOption['action']): Promise<void> {
  if (isHandlingChoice) {
    console.log('Already handling a choice, ignoring...');
    return;
  }

  isHandlingChoice = true;
  console.log('User selected connect choice:', action);

  // Provide visual feedback
  const activeButton = document.activeElement as HTMLElement;
  if (activeButton && activeButton.classList.contains('choice-button')) {
    activeButton.style.transform = 'scale(0.95)';
    setTimeout(() => {
      activeButton.style.transform = '';
    }, 150);
  }

  try {
    const choice: ConnectChoiceOption = { action };
    await window.connectChoiceAPI.sendChoice(choice);
    console.log('Choice sent successfully');
    
    // Disable all buttons to prevent multiple selections
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.6';
    });
  } catch (error) {
    console.error('Error sending choice:', error);
    isHandlingChoice = false; // Reset flag on error
    
    // Show error feedback
    showErrorFeedback('Failed to send choice. Please try again.');
  }
}

/**
 * Show error feedback to user
 */
function showErrorFeedback(message: string): void {
  // Remove existing error message
  const existingError = document.querySelector('.error-message');
  if (existingError) {
    existingError.remove();
  }

  // Create error message
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.cssText = `
    background: #dc3545;
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    margin-top: 16px;
    text-align: center;
    font-size: 0.9rem;
    animation: fadeInShake 0.3s ease-out;
  `;
  errorDiv.textContent = message;

  // Add shake animation
  if (!document.querySelector('#error-animations')) {
    const style = document.createElement('style');
    style.id = 'error-animations';
    style.textContent = `
      @keyframes fadeInShake {
        0% { opacity: 0; transform: translateX(-10px); }
        25% { transform: translateX(10px); }
        50% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
        100% { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }

  // Insert error message
  const dialogActions = document.querySelector('.dialog-actions');
  if (dialogActions) {
    dialogActions.insertBefore(errorDiv, dialogActions.firstChild);
    
    // Auto-remove error after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 5000);
  }
}


/**
 * Export for potential testing purposes
 */
if (typeof exports !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  exports.handleChoice = handleChoice;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  exports.updateDialogUI = updateDialogUI;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  exports.handleArrowNavigation = handleArrowNavigation;
}
