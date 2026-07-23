#!/bin/bash

# Post-installation script for FlashForgeUI (deb / rpm).
#
# IMPORTANT: supplying this file via `deb.afterInstall` / `rpm.afterInstall` REPLACES
# electron-builder's own after-install template wholesale - it is not merged. Everything upstream
# does must therefore be reproduced here, or it silently stops happening. This script is a copy of
# app-builder-lib/templates/linux/after-install.tpl with the FlashForgeUI-specific legacy cleanup
# appended at the end. When bumping electron-builder, diff that template against this file.
#
# The two upstream behaviors that matter most, and that a previous hand-written version of this
# script dropped:
#   1. Installing the AppArmor profile. Ubuntu 23.10+ ships
#      kernel.apparmor_restrict_unprivileged_userns=1, which blocks unprivileged user namespaces
#      and therefore Chromium's namespace sandbox. Without a profile granting `userns`, the app
#      does not start at all on Ubuntu 24.04+.
#   2. Setting the SUID bit on chrome-sandbox when the kernel has no working user namespaces
#      (e.g. Debian defaults), so Chromium can fall back to the SUID sandbox.

if type update-alternatives >/dev/null 2>&1; then
    # Remove previous link if it doesn't use update-alternatives
    if [ -L '/usr/bin/FlashForgeUI' ] && [ -e '/usr/bin/FlashForgeUI' ] && [ "$(readlink '/usr/bin/FlashForgeUI')" != '/etc/alternatives/FlashForgeUI' ]; then
        rm -f '/usr/bin/FlashForgeUI'
    fi
    update-alternatives --install '/usr/bin/FlashForgeUI' 'FlashForgeUI' '/opt/FlashForgeUI/FlashForgeUI' 100 || ln -sf '/opt/FlashForgeUI/FlashForgeUI' '/usr/bin/FlashForgeUI'
else
    ln -sf '/opt/FlashForgeUI/FlashForgeUI' '/usr/bin/FlashForgeUI'
fi

# Check if user namespaces are supported by the kernel and working with a quick test:
if ! { [ -L /proc/self/ns/user ] && unshare --user true; }; then
    # Use SUID chrome-sandbox only on systems without user namespaces:
    chmod 4755 '/opt/FlashForgeUI/chrome-sandbox' || true
else
    chmod 0755 '/opt/FlashForgeUI/chrome-sandbox' || true
fi

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi

# Install apparmor profile. (Ubuntu 24+)
# First check if the version of AppArmor running on the device supports our profile.
# This is in order to keep backwards compatibility with Ubuntu 22.04 which does not support abi/4.0.
# In that case, we just skip installing the profile since the app runs fine without it on 22.04.
#
# Those apparmor_parser flags are akin to performing a dry run of loading a profile.
# https://wiki.debian.org/AppArmor/HowToUse#Dumping_profiles
if apparmor_status --enabled > /dev/null 2>&1; then
  APPARMOR_PROFILE_SOURCE='/opt/FlashForgeUI/resources/apparmor-profile'
  APPARMOR_PROFILE_TARGET='/etc/apparmor.d/FlashForgeUI'
  if apparmor_parser --skip-kernel-load --debug "$APPARMOR_PROFILE_SOURCE" > /dev/null 2>&1; then
    cp -f "$APPARMOR_PROFILE_SOURCE" "$APPARMOR_PROFILE_TARGET"

    # Updating the current AppArmor profile is not possible and probably not meaningful in a
    # chroot'ed environment (e.g. image builders for client machines).
    if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      # Extra flags taken from dh_apparmor: by using '-W -T' we ensure that any abstraction
      # updates are also pulled in.
      apparmor_parser --replace --write-cache --skip-read-cache "$APPARMOR_PROFILE_TARGET"
    fi
  else
    echo "Skipping the installation of the AppArmor profile as this version of AppArmor does not seem to support the bundled profile"
  fi
fi

# --- FlashForgeUI-specific: clean up artifacts of the pre-rename flashforge-ui-ts packages ---

if [ -f /usr/share/applications/flashforge-ui-ts.desktop ]; then
    rm -f /usr/share/applications/flashforge-ui-ts.desktop || true
fi
if [ -L /usr/local/bin/flashforge-ui-ts ]; then
    rm -f /usr/local/bin/flashforge-ui-ts || true
fi
# Older FlashForgeUI packages symlinked into /usr/local/bin; /usr/bin (handled above via
# update-alternatives) is the correct location, so drop the stale duplicate.
if [ -L /usr/local/bin/FlashForgeUI ]; then
    rm -f /usr/local/bin/FlashForgeUI || true
fi

exit 0
