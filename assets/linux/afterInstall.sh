#!/bin/bash

# Post-installation script for FlashForgeUI
# This script runs after the package is installed

# Set proper permissions for the application
chmod +x /opt/FlashForgeUI/FlashForgeUI || true

# Create desktop entry if it doesn't exist
if [ ! -f /usr/share/applications/FlashForgeUI.desktop ]; then
    cat > /usr/share/applications/FlashForgeUI.desktop << EOF
[Desktop Entry]
Name=FlashForgeUI
Comment=Monitoring and Control software for FlashForge printers
Exec=/opt/FlashForgeUI/FlashForgeUI
Icon=FlashForgeUI
Type=Application
Categories=Utility;
StartupNotify=true
EOF
fi

# Update desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications || true
fi

# Create symlink in /usr/local/bin for CLI access (optional)
if [ ! -f /usr/local/bin/FlashForgeUI ]; then
    ln -sf /opt/FlashForgeUI/FlashForgeUI /usr/local/bin/FlashForgeUI || true
fi

# Clean up old flashforge-ui-ts entries from previous installations
if [ -f /usr/share/applications/flashforge-ui-ts.desktop ]; then
    rm -f /usr/share/applications/flashforge-ui-ts.desktop || true
fi
if [ -L /usr/local/bin/flashforge-ui-ts ]; then
    rm -f /usr/local/bin/flashforge-ui-ts || true
fi

exit 0
 