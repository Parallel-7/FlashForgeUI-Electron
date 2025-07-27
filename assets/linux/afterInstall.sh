#!/bin/bash

# Post-installation script for FlashForgeUI
# This script runs after the package is installed

# Set proper permissions for the application
chmod +x /opt/FlashForgeUI/flashforge-ui-ts || true

# Create desktop entry if it doesn't exist
if [ ! -f /usr/share/applications/flashforge-ui-ts.desktop ]; then
    cat > /usr/share/applications/flashforge-ui-ts.desktop << EOF
[Desktop Entry]
Name=FlashForgeUI
Comment=FlashForge 3D Printer Management Tool
Exec=/opt/FlashForgeUI/flashforge-ui-ts
Icon=/opt/FlashForgeUI/resources/app/src/icons/icon.png
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
if [ ! -f /usr/local/bin/flashforge-ui-ts ]; then
    ln -sf /opt/FlashForgeUI/flashforge-ui-ts /usr/local/bin/flashforge-ui-ts || true
fi

exit 0 