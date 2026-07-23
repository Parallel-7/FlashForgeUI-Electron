#!/bin/bash

# Post-removal script for FlashForgeUI (deb / rpm).
#
# As with afterInstall.sh, supplying this file REPLACES electron-builder's after-remove template
# rather than extending it - so the upstream body is reproduced here verbatim, with the
# FlashForgeUI-specific legacy cleanup appended. Diff against
# app-builder-lib/templates/linux/after-remove.tpl when bumping electron-builder.

# Delete the link to the binary
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove 'FlashForgeUI' '/usr/bin/FlashForgeUI'
else
    rm -f '/usr/bin/FlashForgeUI'
fi

APPARMOR_PROFILE_DEST='/etc/apparmor.d/FlashForgeUI'

# Remove apparmor profile.
if [ -f "$APPARMOR_PROFILE_DEST" ]; then
  rm -f "$APPARMOR_PROFILE_DEST"
fi

# --- FlashForgeUI-specific: clean up artifacts of the pre-rename flashforge-ui-ts packages ---

if [ -f /usr/share/applications/flashforge-ui-ts.desktop ]; then
    rm -f /usr/share/applications/flashforge-ui-ts.desktop || true
fi
if [ -L /usr/local/bin/flashforge-ui-ts ]; then
    rm -f /usr/local/bin/flashforge-ui-ts || true
fi
if [ -L /usr/local/bin/FlashForgeUI ]; then
    rm -f /usr/local/bin/FlashForgeUI || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications || true
fi

exit 0
