/**
 * @fileoverview Printer Selection Dialog renderer process implementation supporting dual-mode operation
 * for both network-discovered printers and saved printer connections. Manages UI state, printer discovery
 * events, table rendering, and user interaction for printer selection workflows. Implements auto-discovery
 * timeout handling, connection status feedback, and supports printer reconnection from saved configurations.
 *
 * Key Features:
 * - Dual-mode selection: discovered printers (network scan) or saved printers (from history)
 * - Real-time printer discovery with 15-second timeout and retry capability
 * - Auto-selection of last-used printer when viewing saved printers
 * - IP address change detection for saved printers with visual indicators
 * - Connection status feedback (connecting, success, failure)
 * - Double-click selection with visual row highlighting
 * - Comprehensive error handling for discovery failures
 *
 * Dialog Modes:
 * - Discovered Mode: Shows printers found via network discovery scan
 * - Saved Mode: Shows previously connected printers with online status filtering
 *
 * IPC Events:
 * - receiveMode: Sets dialog mode (discovered/saved)
 * - receivePrinters: Updates discovered printer list
 * - receiveSavedPrinters: Updates saved printer list with last-used info
 * - onDiscoveryStarted: Triggers discovery timeout timer
 * - onDiscoveryError: Handles discovery failures with user feedback
 * - onConnecting/onConnectionFailed: Connection status updates
 */

// Ensure this file is treated as a module
export {};

// Interface for discovered printer information (matches preload)
interface PrinterInfo {
    readonly name: string;
    readonly ipAddress: string;
    readonly serialNumber: string;
    readonly model?: string;
    readonly status?: string;
    readonly firmwareVersion?: string;
}

// Interface for saved printer information (matches preload)
interface SavedPrinterInfo {
    readonly name: string;
    readonly ipAddress: string;
    readonly serialNumber: string;
    readonly lastConnected: string;
    readonly isOnline: boolean;
    readonly ipAddressChanged: boolean;
    readonly currentIpAddress?: string;
}

// Selection dialog mode
type SelectionMode = 'discovered' | 'saved';

// Extend Window interface to include our printer selection API
declare global {
    interface Window {
        printerSelectionAPI?: {
            selectPrinter: (printer: PrinterInfo | SavedPrinterInfo) => void;
            cancelSelection: () => void;
            receivePrinters: (func: (printers: PrinterInfo[]) => void) => void;
            receiveSavedPrinters: (func: (printers: SavedPrinterInfo[], lastUsedSerial: string | null) => void) => void;
            receiveMode: (func: (mode: SelectionMode) => void) => void;
            onConnecting?: (func: (printerName: string) => void) => void;
            onConnectionFailed?: (func: (error: string) => void) => void;
            onDiscoveryStarted?: (func: () => void) => void;
            onDiscoveryError?: (func: (data: { error: string; message: string }) => void) => void;
            removeListeners: () => void;
        };
    }
}

// DOM element references with proper typing
interface DialogElements {
    table: HTMLTableElement | null;
    tableHeader: HTMLTableSectionElement | null;
    headerRow: HTMLTableRowElement | null;
    tableBody: HTMLTableSectionElement | null;
    noPrintersMessage: HTMLElement | null;
    closeButton: HTMLButtonElement | null;
    cancelButton: HTMLButtonElement | null;
    dialogTitle: HTMLElement | null;
    footerInstructions: HTMLElement | null;
}

// Current UI state
interface UIState {
    mode: SelectionMode;
    isLoading: boolean;
    selectedPrinter: PrinterInfo | SavedPrinterInfo | null;
    discoveredPrinters: readonly PrinterInfo[];
    savedPrinters: readonly SavedPrinterInfo[];
    lastUsedSerial: string | null;
    discoveryTimeout: NodeJS.Timeout | null;
    discoveryStartTime: number | null;
}

let currentState: UIState = {
    mode: 'discovered',
    isLoading: true,
    selectedPrinter: null,
    discoveredPrinters: [],
    savedPrinters: [],
    lastUsedSerial: null,
    discoveryTimeout: null,
    discoveryStartTime: null
};

// Get DOM elements with proper error handling
const getDialogElements = (): DialogElements => {
    const table = document.getElementById('printer-table') as HTMLTableElement | null;
    
    return {
        table,
        tableHeader: table?.querySelector('thead') || null,
        headerRow: document.getElementById('header-row') as HTMLTableRowElement | null,
        tableBody: table?.querySelector('tbody') || null,
        noPrintersMessage: document.getElementById('no-printers-message'),
        closeButton: document.getElementById('btn-close') as HTMLButtonElement | null,
        cancelButton: document.getElementById('btn-cancel') as HTMLButtonElement | null,
        dialogTitle: document.getElementById('dialog-title'),
        footerInstructions: document.getElementById('footer-instructions')
    };
};

// Update dialog UI based on current mode
const updateDialogForMode = (mode: SelectionMode): void => {
    const elements = getDialogElements();
    
    // Update dialog title
    if (elements.dialogTitle) {
        elements.dialogTitle.textContent = mode === 'saved' 
            ? 'Select a Saved Printer' 
            : 'Select a Printer';
    }
    
    // Update footer instructions
    if (elements.footerInstructions) {
        elements.footerInstructions.textContent = mode === 'saved'
            ? 'Double-click a saved printer to connect'
            : 'Double-click a printer to select';
    }
    
    // Update table CSS class for column width adjustments
    if (elements.table) {
        elements.table.className = `${mode}-mode`;
    }
    
    // Update table headers
    updateTableHeaders(mode);
};

// Update table headers based on mode
const updateTableHeaders = (mode: SelectionMode): void => {
    const elements = getDialogElements();
    if (!elements.headerRow) {
        console.error('Header row not found');
        return;
    }
    
    // Clear existing headers
    elements.headerRow.innerHTML = '';
    
    if (mode === 'discovered') {
        // Original discovered printer headers
        const headers = ['Printer Name', 'IP Address', 'Serial Number'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            elements.headerRow!.appendChild(th);
        });
    } else {
        // Saved printer headers without status column (only online printers shown)
        const headers = ['Printer Name', 'IP Address', 'Serial Number', 'Last Connected'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            elements.headerRow!.appendChild(th);
        });
    }
};

// Format date for display
const formatDate = (isoString: string): string => {
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    } catch (error) {
        console.warn('Error formatting date:', error);
        return 'Unknown';
    }
};



// Create a printer table row for discovered printers
const createDiscoveredPrinterRow = (printer: PrinterInfo): HTMLTableRowElement => {
    const row = document.createElement('tr');
    
    // Printer Name
    const nameCell = document.createElement('td');
    nameCell.textContent = printer.name || 'Unknown';
    row.appendChild(nameCell);
    
    // IP Address
    const ipCell = document.createElement('td');
    ipCell.textContent = printer.ipAddress || 'Unknown';
    row.appendChild(ipCell);
    
    // Serial Number
    const serialCell = document.createElement('td');
    serialCell.textContent = printer.serialNumber || 'Unknown';
    row.appendChild(serialCell);
    
    // Store printer data with the row for easy retrieval
    row.dataset.printer = JSON.stringify(printer);
    row.dataset.printerType = 'discovered';
    
    // Add event listeners
    addRowEventListeners(row, printer);
    
    return row;
};

// Create a printer table row for saved printers
const createSavedPrinterRow = (savedPrinter: SavedPrinterInfo): HTMLTableRowElement => {
    const row = document.createElement('tr');
    
    // Mark as last used if applicable
    if (currentState.lastUsedSerial && savedPrinter.serialNumber === currentState.lastUsedSerial) {
        row.classList.add('last-used');
    }
    
    // Printer Name
    const nameCell = document.createElement('td');
    nameCell.textContent = savedPrinter.name || 'Unknown';
    row.appendChild(nameCell);
    
    // IP Address (show current if changed)
    const ipCell = document.createElement('td');
    if (savedPrinter.ipAddressChanged && savedPrinter.currentIpAddress) {
        ipCell.innerHTML = `<span class="ip-changed">${savedPrinter.currentIpAddress}</span>`;
        ipCell.title = `Was: ${savedPrinter.ipAddress}`;
    } else {
        ipCell.textContent = savedPrinter.ipAddress;
    }
    row.appendChild(ipCell);
    
    // Serial Number
    const serialCell = document.createElement('td');
    serialCell.textContent = savedPrinter.serialNumber || 'Unknown';
    row.appendChild(serialCell);
    
    // Last Connected
    const lastConnectedCell = document.createElement('td');
    lastConnectedCell.className = 'date-cell';
    lastConnectedCell.textContent = formatDate(savedPrinter.lastConnected);
    lastConnectedCell.title = new Date(savedPrinter.lastConnected).toLocaleString();
    row.appendChild(lastConnectedCell);
    
    // No status column - we only show online printers
    
    // Store printer data with the row for easy retrieval
    row.dataset.printer = JSON.stringify(savedPrinter);
    row.dataset.printerType = 'saved';
    
    // Add event listeners
    addRowEventListeners(row, savedPrinter);
    
    return row;
};

// Add event listeners to a table row
const addRowEventListeners = (row: HTMLTableRowElement, printer: PrinterInfo | SavedPrinterInfo): void => {
    // Double-click for selection
    row.addEventListener('dblclick', () => {
        handlePrinterSelection(printer);
    });
    
    // Single click for visual selection
    row.addEventListener('click', () => {
        selectTableRow(row);
    });
};

// Handle printer selection via double-click
const handlePrinterSelection = (printer: PrinterInfo | SavedPrinterInfo): void => {
    if (!window.printerSelectionAPI) {
        console.error('Printer selection API not available');
        return;
    }
    
    console.log('Printer selected via double-click:', printer);
    currentState.selectedPrinter = printer;
    
    // Both saved and discovered printers use the same selection method
    window.printerSelectionAPI.selectPrinter(printer);
};

// Visual row selection (highlight selected row)
const selectTableRow = (selectedRow: HTMLTableRowElement): void => {
    const elements = getDialogElements();
    if (!elements.tableBody) {
        console.warn('Table body not found for row selection');
        return;
    }
    
    // Remove previous selection
    const previouslySelected = elements.tableBody.querySelector('tr.selected');
    if (previouslySelected) {
        previouslySelected.classList.remove('selected');
    }
    
    // Add selection to new row
    selectedRow.classList.add('selected');
};

// Auto-select last used printer in saved mode
const autoSelectLastUsedPrinter = (): void => {
    if (currentState.mode !== 'saved' || !currentState.lastUsedSerial) {
        return;
    }
    
    const elements = getDialogElements();
    if (!elements.tableBody) {
        return;
    }
    
    // Find the row with the last used printer
    const rows = elements.tableBody.querySelectorAll('tr[data-printer-type="saved"]');
    Array.from(rows).forEach((row) => {
        try {
            const tableRow = row as HTMLTableRowElement;
            const printerData = JSON.parse(tableRow.dataset.printer || '{}') as SavedPrinterInfo;
            if (printerData.serialNumber === currentState.lastUsedSerial) {
                selectTableRow(tableRow);
                return; // Exit forEach early
            }
        } catch (error) {
            console.warn('Error parsing printer data for auto-selection:', error);
        }
    });
};

// Clear discovery timeout if active
const clearDiscoveryTimeout = (): void => {
    if (currentState.discoveryTimeout) {
        clearTimeout(currentState.discoveryTimeout);
        currentState.discoveryTimeout = null;
    }
};

// Show discovery timeout error
const showDiscoveryTimeout = (): void => {
    const elements = getDialogElements();
    if (!elements.noPrintersMessage) return;
    
    currentState.isLoading = false;
    clearDiscoveryTimeout();
    
    elements.noPrintersMessage.style.display = 'flex';
    elements.noPrintersMessage.innerHTML = `
        <div style="text-align: center;">
            <p style="margin-bottom: 10px;">Discovery timed out after 15 seconds.</p>
            <p style="font-size: 0.9em; color: #666;">Please check your network connection and ensure LAN mode is enabled on your printer.</p>
            <button onclick="window.location.reload()" style="margin-top: 10px; padding: 5px 15px; cursor: pointer;">Retry</button>
        </div>
    `;
};

// Update the printer table with discovered printers
const updateDiscoveredPrinterTable = (printers: readonly PrinterInfo[]): void => {
    const elements = getDialogElements();
    if (!elements.tableBody || !elements.noPrintersMessage) {
        console.error('Required table elements not found');
        return;
    }
    
    // Clear discovery timeout since we got results
    clearDiscoveryTimeout();
    
    // Clear existing content
    elements.tableBody.innerHTML = '';
    currentState.discoveredPrinters = printers;
    currentState.isLoading = false;
    
    if (printers.length === 0) {
        // Show no printers found message
        elements.noPrintersMessage.style.display = 'flex';
        elements.noPrintersMessage.textContent = 'No printers found on the network. Ensure LAN mode is enabled.';
        console.log('No discovered printers found to display');
        return;
    }
    
    // Hide no printers message and populate table
    elements.noPrintersMessage.style.display = 'none';
    
    printers.forEach(printer => {
        const row = createDiscoveredPrinterRow(printer);
        elements.tableBody!.appendChild(row);
    });
    
    console.log(`Updated discovered printer table with ${printers.length} printer(s)`);
};

// Update the printer table with saved printers
const updateSavedPrinterTable = (printers: readonly SavedPrinterInfo[], lastUsedSerial: string | null): void => {
    const elements = getDialogElements();
    if (!elements.tableBody || !elements.noPrintersMessage) {
        console.error('Required table elements not found');
        return;
    }
    
    // Clear existing content
    elements.tableBody.innerHTML = '';
    currentState.savedPrinters = printers;
    currentState.lastUsedSerial = lastUsedSerial;
    currentState.isLoading = false;
    
    if (printers.length === 0) {
        // Show no printers found message
        elements.noPrintersMessage.style.display = 'flex';
        elements.noPrintersMessage.textContent = 'No saved printers found.';
        console.log('No saved printers found to display');
        return;
    }
    
    // Hide no printers message and populate table
    elements.noPrintersMessage.style.display = 'none';
    
    // Sort printers: online first, then by last connected (most recent first)
    const sortedPrinters = [...printers].sort((a, b) => {
        // Online printers first
        if (a.isOnline !== b.isOnline) {
            return a.isOnline ? -1 : 1;
        }
        
        // Then by last connected (most recent first)
        return new Date(b.lastConnected).getTime() - new Date(a.lastConnected).getTime();
    });
    
    sortedPrinters.forEach(printer => {
        const row = createSavedPrinterRow(printer);
        elements.tableBody!.appendChild(row);
    });
    
    // Auto-select last used printer
    setTimeout(() => autoSelectLastUsedPrinter(), 100);
    
    console.log(`Updated saved printer table with ${printers.length} printer(s)`);
};

// Handle cancel/close actions
const handleCancel = (): void => {
    if (!window.printerSelectionAPI) {
        console.error('Printer selection API not available');
        return;
    }
    
    console.log('Printer selection cancelled');
    window.printerSelectionAPI.cancelSelection();
};

// Setup event listeners for dialog controls
const setupEventListeners = (): void => {
    const elements = getDialogElements();
    
    // Close button (X)
    if (elements.closeButton) {
        elements.closeButton.addEventListener('click', handleCancel);
    } else {
        console.warn('Close button not found');
    }
    
    // Cancel button
    if (elements.cancelButton) {
        elements.cancelButton.addEventListener('click', handleCancel);
    } else {
        console.warn('Cancel button not found');
    }
    
    console.log('Event listeners set up successfully');
};

// Setup IPC communication
const setupIPCListeners = (): void => {
    if (!window.printerSelectionAPI) {
        console.error('Printer selection API not available - some features may not work');
        return;
    }
    
    // Listen for mode changes
    window.printerSelectionAPI.receiveMode((mode: SelectionMode) => {
        console.log('Received mode:', mode);
        currentState.mode = mode;
        updateDialogForMode(mode);
    });
    
    // Listen for discovery started event
    window.printerSelectionAPI.onDiscoveryStarted?.(() => {
        console.log('Discovery started');
        currentState.isLoading = true;
        currentState.discoveryStartTime = Date.now();
        
        // Clear any existing timeout
        clearDiscoveryTimeout();
        
        // Set a 15 second timeout for discovery
        currentState.discoveryTimeout = setTimeout(() => {
            if (currentState.isLoading && currentState.mode === 'discovered') {
                console.warn('Discovery timeout - no response after 15 seconds');
                showDiscoveryTimeout();
            }
        }, 15000);
        
        // Update UI to show we're actively scanning
        const elements = getDialogElements();
        if (elements.noPrintersMessage) {
            elements.noPrintersMessage.style.display = 'flex';
            elements.noPrintersMessage.innerHTML = '<div class="scanning-animation">Scanning for printers...</div>';
        }
    });
    
    // Listen for discovery errors
    window.printerSelectionAPI.onDiscoveryError?.((data: { error: string; message: string }) => {
        console.error('Discovery error:', data);
        clearDiscoveryTimeout();
        currentState.isLoading = false;
        
        const elements = getDialogElements();
        if (elements.noPrintersMessage) {
            elements.noPrintersMessage.style.display = 'flex';
            elements.noPrintersMessage.innerHTML = `
                <div style="text-align: center; color: #d32f2f;">
                    <p style="margin-bottom: 10px; font-weight: bold;">Discovery Error</p>
                    <p style="font-size: 0.9em;">${data.message}</p>
                    <p style="font-size: 0.8em; color: #666; margin-top: 10px;">Error: ${data.error}</p>
                    <button onclick="window.location.reload()" style="margin-top: 15px; padding: 5px 15px; cursor: pointer;">Retry</button>
                </div>
            `;
        }
    });
    
    // Listen for discovered printer data
    window.printerSelectionAPI.receivePrinters((printers: PrinterInfo[]) => {
        console.log('Received discovered printers from main process:', printers);
        if (currentState.mode === 'discovered') {
            updateDiscoveredPrinterTable(printers);
        }
    });
    
    // Listen for saved printer data
    window.printerSelectionAPI.receiveSavedPrinters((printers: SavedPrinterInfo[], lastUsedSerial: string | null) => {
        console.log('Received saved printers from main process:', printers, 'Last used:', lastUsedSerial);
        if (currentState.mode === 'saved') {
            updateSavedPrinterTable(printers, lastUsedSerial);
        }
    });
    
    // Listen for connection status updates
    window.printerSelectionAPI.onConnecting?.((printerName: string) => {
        console.log('Connecting to printer:', printerName);
        showConnectingMessage(printerName);
    });
    
    window.printerSelectionAPI.onConnectionFailed?.((error: string) => {
        console.log('Connection failed:', error);
        hideConnectingMessage();
        showErrorMessage(error);
    });
    
    console.log('IPC listeners set up successfully');
};

// Show connecting message
const showConnectingMessage = (printerName: string): void => {
    const elements = getDialogElements();
    if (elements.noPrintersMessage) {
        elements.noPrintersMessage.innerHTML = `<div class="connecting-message">Connecting to ${printerName}...</div>`;
        elements.noPrintersMessage.style.display = 'flex';
    }
};

// Hide connecting message
const hideConnectingMessage = (): void => {
    const elements = getDialogElements();
    if (elements.noPrintersMessage) {
        elements.noPrintersMessage.style.display = 'none';
    }
};

// Show error message
const showErrorMessage = (error: string): void => {
    // Could show this in a more sophisticated way, for now just log it
    console.error('Connection error:', error);
    // The main process will show a dialog, so we don't need to do much here
};

// Initialize the dialog
const initializeDialog = (): void => {
    console.log('Initializing printer selection dialog');
    
    // Verify API availability
    if (!window.printerSelectionAPI) {
        console.error('ERROR: Printer selection API not available - preload script may not be loaded correctly');
    } else {
        console.log('Printer selection API available - ready for IPC communication');
    }
    
    // Setup UI components
    setupEventListeners();
    setupIPCListeners();
    
    // Initialize with default mode
    updateDialogForMode(currentState.mode);
    
    console.log('Printer selection dialog initialized - waiting for mode and printer data');
};

// Cleanup resources
const cleanup = (): void => {
    console.log('Cleaning up printer selection dialog resources');
    
    // Clear any active timeout
    clearDiscoveryTimeout();
    
    if (window.printerSelectionAPI) {
        window.printerSelectionAPI.removeListeners();
    }
    
    // Reset state
    currentState = {
        mode: 'discovered',
        isLoading: true,
        selectedPrinter: null,
        discoveredPrinters: [],
        savedPrinters: [],
        lastUsedSerial: null,
        discoveryTimeout: null,
        discoveryStartTime: null
    };
};

// DOM Content Loaded event handler
document.addEventListener('DOMContentLoaded', () => {
    console.log('Printer selection renderer - DOM loaded');
    window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['x']);
    initializeDialog();
});

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
    cleanup();
});

