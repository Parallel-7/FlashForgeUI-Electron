// src/ui/settings-renderer.js
document.addEventListener('DOMContentLoaded', () => {
    const inputs = {
        webUi: document.getElementById('web-ui'),
        webUiPort: document.getElementById('web-ui-port'),
        webUiPassword: document.getElementById('web-ui-password'),
        cameraProxyPort: document.getElementById('camera-proxy-port'),
        discordSync: document.getElementById('discord-sync'),
        alwaysOnTop: document.getElementById('always-on-top'),
        alertWhenComplete: document.getElementById('alert-when-complete'),
        alertWhenCooled: document.getElementById('alert-when-cooled'),
        audioAlerts: document.getElementById('audio-alerts'),
        visualAlerts: document.getElementById('visual-alerts'),
        debugMode: document.getElementById('debug-mode'),
        webhookUrl: document.getElementById('webhook-url'),
        customCamera: document.getElementById('custom-camera'),
        customCameraUrl: document.getElementById('custom-camera-url'),
        customLeds: document.getElementById('custom-leds'),
        forceLegacyAPI: document.getElementById('force-legacy-api'),
        discordUpdateInterval: document.getElementById('discord-update-interval')
    };

    const saveStatusElement = document.getElementById('save-status');
    let statusTimeout;

    // --- Populate Form ---
    window.settingsApi.receiveConfig((config) => {
        console.log("Received config:", config);
        inputs.webUi.checked = config.WebUIEnabled !== false; // Default to true if undefined
        inputs.webUiPort.value = config.WebUIPort || 3000;
        inputs.webUiPassword.value = config.WebUIPassword || 'changeme';
        inputs.cameraProxyPort.value = config.CameraProxyPort || 8181;
        inputs.discordSync.checked = config.DiscordSync;
        inputs.alwaysOnTop.checked = config.AlwaysOnTop;
        inputs.alertWhenComplete.checked = config.AlertWhenComplete;
        inputs.alertWhenCooled.checked = config.AlertWhenCooled;
        inputs.audioAlerts.checked = config.AudioAlerts;
        inputs.visualAlerts.checked = config.VisualAlerts;
        inputs.debugMode.checked = config.DebugMode;
        inputs.webhookUrl.value = config.WebhookUrl || '';
        inputs.customCamera.checked = config.CustomCamera;
        inputs.customCameraUrl.value = config.CustomCameraUrl || '';
        inputs.customLeds.checked = config.CustomLeds;
        inputs.forceLegacyAPI.checked = config.ForceLegacyAPI || false;
        inputs.discordUpdateInterval.value = config.DiscordUpdateIntervalMinutes || 5;

        // Enable/disable text inputs based on checkboxes
        toggleInputState();
    });

    // --- Event Listeners ---
    Object.values(inputs).forEach(input => {
        input.addEventListener('change', handleInputChange); // 'change' for checkboxes, text input blur
        if (input.type === 'text') {
            input.addEventListener('input', handleInputChange); // also listen to 'input' for immediate text changes
        }
    });

    document.getElementById('btn-close').addEventListener('click', () => {
        window.settingsApi.closeWindow();
    });
    document.getElementById('btn-cancel').addEventListener('click', () => {
        window.settingsApi.closeWindow();
    });

    // Add listeners to checkboxes that control text inputs
    inputs.customCamera.addEventListener('change', toggleInputState);
    inputs.discordSync.addEventListener('change', toggleInputState);
    inputs.webUi.addEventListener('change', toggleInputState);

    // --- Helper Functions ---
    function handleInputChange() {
        const currentConfig = {};
        // Read all current values from the form (but not adding WebUi, only WebUIEnabled)
        currentConfig.WebUIEnabled = inputs.webUi.checked;
        currentConfig.WebUIPort = parseInt(inputs.webUiPort.value) || 3000;
        currentConfig.WebUIPassword = inputs.webUiPassword.value || 'changeme';
        currentConfig.CameraProxyPort = parseInt(inputs.cameraProxyPort.value) || 8181;
        // Removed redundant WebUi setting
        currentConfig.DiscordSync = inputs.discordSync.checked;
        currentConfig.AlwaysOnTop = inputs.alwaysOnTop.checked;
        currentConfig.AlertWhenComplete = inputs.alertWhenComplete.checked;
        currentConfig.AlertWhenCooled = inputs.alertWhenCooled.checked;
        currentConfig.AudioAlerts = inputs.audioAlerts.checked;
        currentConfig.VisualAlerts = inputs.visualAlerts.checked;
        currentConfig.DebugMode = inputs.debugMode.checked;
        currentConfig.WebhookUrl = inputs.webhookUrl.value;
        currentConfig.CustomCamera = inputs.customCamera.checked;
        currentConfig.CustomCameraUrl = inputs.customCameraUrl.value;
        currentConfig.CustomLeds = inputs.customLeds.checked;
        currentConfig.ForceLegacyAPI = inputs.forceLegacyAPI.checked;
        currentConfig.DiscordUpdateIntervalMinutes = parseInt(inputs.discordUpdateInterval.value) || 5;

        console.log("Sending updated config:", currentConfig);
        window.settingsApi.saveConfig(currentConfig);

        // Show 'Saved' indicator
        showSaveStatus();

        // Update enabled/disabled state of text inputs
        toggleInputState();
    }

    function toggleInputState() {
        // Custom camera settings
        inputs.customCameraUrl.disabled = !inputs.customCamera.checked;
        inputs.customCameraUrl.style.opacity = inputs.customCameraUrl.disabled ? 0.5 : 1;
        
        // Discord webhook settings
        inputs.webhookUrl.disabled = !inputs.discordSync.checked;
        inputs.webhookUrl.style.opacity = inputs.webhookUrl.disabled ? 0.5 : 1;
        inputs.discordUpdateInterval.disabled = !inputs.discordSync.checked;
        inputs.discordUpdateInterval.style.opacity = inputs.discordUpdateInterval.disabled ? 0.5 : 1;
        
        // Web UI settings
        inputs.webUiPort.disabled = !inputs.webUi.checked;
        inputs.webUiPassword.disabled = !inputs.webUi.checked;
        inputs.webUiPort.style.opacity = inputs.webUiPort.disabled ? 0.5 : 1;
        inputs.webUiPassword.style.opacity = inputs.webUiPassword.disabled ? 0.5 : 1;
    }

    function showSaveStatus() {
        if (statusTimeout) clearTimeout(statusTimeout); // Clear previous timeout
        saveStatusElement.textContent = 'Saved';
        saveStatusElement.classList.add('visible');
        statusTimeout = setTimeout(() => {
            saveStatusElement.classList.remove('visible');
        }, 1500); // Hide after 1.5 seconds
    }


    // --- Initial Request ---
    // Request the config when the window is ready
    window.settingsApi.requestConfig();

    // Clean up IPC listeners when the window is unloaded
    window.addEventListener('beforeunload', () => {
        window.settingsApi.removeListeners();
    });
});