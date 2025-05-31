// src/ui/send-cmds/send-cmds-renderer.js
document.addEventListener('DOMContentLoaded', () => {
    const logOutput = document.getElementById('log-output');
    const commandInput = document.getElementById('command-input');
    const sendButton = document.getElementById('btn-send');
    const closeButton = document.getElementById('btn-close');
    
    // Function to append log messages
    function appendLog(message, type = 'info') {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        
        // Add timestamp to message
        const timestamp = new Date().toLocaleTimeString();
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        // Append to log output
        logOutput.appendChild(logEntry);
        
        // Auto-scroll to bottom
        logOutput.scrollTop = logOutput.scrollHeight;
    }
    
    // Initialize the log - we now have the initial message in HTML
    // appendLog('Command terminal ready. Enter G/M code commands below.', 'info');
    
    // Function to send command
    async function sendCommand() {
        let command = commandInput.value.trim();
        if (!command) return;
        // add ~ if the user does not
        if (!command.startsWith("~")) command = "~" + command;
        
        // Disable button and input while command is being processed
        sendButton.disabled = true;
        commandInput.disabled = true;
        
        // Log the command
        appendLog(`Sending: ${command}`, 'command');
        
        try {
            // Send command to main process via preload bridge
            const result = await window.sendCmdsApi.sendCommand(command);
            
            // Check result
            if (result.success) {
                appendLog(`Response: ${result.response || 'OK'}`, 'response');
            } else {
                appendLog(`Error: ${result.error || 'Command failed'}`, 'error');
            }
        } catch (error) {
            // Handle error
            appendLog(`Error: ${error.message || 'Failed to send command'}`, 'error');
        } finally {
            // Re-enable button and input, clear input
            sendButton.disabled = false;
            commandInput.disabled = false;
            commandInput.value = '';
            commandInput.focus();
        }
    }
    
    // Event listeners
    sendButton.addEventListener('click', sendCommand);
    
    // Submit on enter key
    commandInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission
            sendCommand();
        }
    });
    
    // Close button
    closeButton.addEventListener('click', () => {
        window.sendCmdsApi.close();
    });
    
    // Set focus to input on load
    commandInput.focus();
    
    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
        window.sendCmdsApi.removeListeners();
    });
});
