// src/ui/printer-selection-renderer.js
document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('printer-table')?.querySelector('tbody');
    const noPrintersMessage = document.getElementById('no-printers-message');

    if (!tableBody || !noPrintersMessage) {
        console.error('Required table elements not found.');
        return;
    }

    window.printerSelectionApi.receivePrinters((printers) => {
        console.log('Received printers:', printers);
        tableBody.innerHTML = ''; // Clear "Scanning..." or previous list

        if (!printers || printers.length === 0) {
            noPrintersMessage.style.display = 'flex'; // Show 'no printers' message
            return;
        }

        noPrintersMessage.style.display = 'none'; // Hide 'no printers' message

        printers.forEach(printer => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = printer.name || 'Err';
            row.insertCell().textContent = printer.ipAddress || 'Err';
            row.insertCell().textContent = printer.serialNumber || 'Err';

            // Store printer data with the row for easy retrieval
            row.dataset.printer = JSON.stringify(printer);

            // Double click selection
            row.addEventListener('dblclick', () => {
                console.log('Printer selected:', printer);
                window.printerSelectionApi.selectPrinter(printer);
            });
        });
    });

    // Close/Cancel buttons
    document.getElementById('btn-close').addEventListener('click', () => {
        window.printerSelectionApi.cancelSelection();
    });
    document.getElementById('btn-cancel').addEventListener('click', () => {
        window.printerSelectionApi.cancelSelection();
    });


    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
        window.printerSelectionApi.removeListeners();
    });
});