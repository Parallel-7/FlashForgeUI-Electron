#!/bin/bash

# Post-removal script for FlashForgeUI
# This script runs after the package is removed

# Remove desktop entries (both old and new)
if [ -f /usr/share/applications/flashforge-ui-ts.desktop ]; then
    rm -f /usr/share/applications/flashforge-ui-ts.desktop || true
fi
if [ -f /usr/share/applications/FlashForgeUI.desktop ]; then
    rm -f /usr/share/applications/FlashForgeUI.desktop || true
fi

# Update desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications || true
fi

# Remove symlinks from /usr/local/bin (both old and new)
if [ -L /usr/local/bin/flashforge-ui-ts ]; then
    rm -f /usr/local/bin/flashforge-ui-ts || true
fi
if [ -L /usr/local/bin/FlashForgeUI ]; then
    rm -f /usr/local/bin/FlashForgeUI || true
fi

# Remove any leftover configuration files (optional)
# Note: We typically don't remove user data/config files in afterRemove
# but you can uncomment the lines below if needed
# rm -rf /home/*/.config/FlashForgeUI || true
# rm -rf /root/.config/FlashForgeUI || true

exit 0
 