#!/bin/bash

# Post-removal script for FlashForgeUI
# This script runs after the package is removed

# Remove desktop entry
if [ -f /usr/share/applications/flashforge-ui-ts.desktop ]; then
    rm -f /usr/share/applications/flashforge-ui-ts.desktop || true
fi

# Update desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications || true
fi

# Remove symlink from /usr/local/bin
if [ -L /usr/local/bin/flashforge-ui-ts ]; then
    rm -f /usr/local/bin/flashforge-ui-ts || true
fi

# Remove any leftover configuration files (optional)
# Note: We typically don't remove user data/config files in afterRemove
# but you can uncomment the lines below if needed
# rm -rf /home/*/.config/flashforge-ui-ts || true
# rm -rf /root/.config/flashforge-ui-ts || true

exit 0 