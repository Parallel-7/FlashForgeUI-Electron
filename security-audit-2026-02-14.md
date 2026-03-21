# Security Audit Report for `feat/calibration-assistant` Branch

**Date:** 2026-02-14
**Branch:** feat/calibration-assistant
**Total Vulnerabilities:** 5 (4 High, 1 Low)

## Executive Summary

All 5 security warnings from GitHub are still present on the alpha branch and require fixes. None are false positives. All fixes are available and can be applied via pnpm overrides.

## Vulnerabilities That Need Fixing

| Package | Current | Required | Severity | Source | Fix Method |
|---------|---------|----------|----------|--------|------------|
| **tar** | 7.5.4 | ≥7.5.7 | High | electron-builder (dev) | Update pnpm override |
| **@isaacs/brace-expansion** | 5.0.0 | ≥5.0.1 | High | minimatch → glob/electron-builder | Add pnpm override |
| **axios** | 1.13.2 | ≥1.13.5 | High | @ghosttypes/ff-api | Add pnpm override |
| **fast-xml-parser** | 5.3.3 | ≥5.3.4 | High | @parallel-7/slicer-meta | Add pnpm override |
| **qs** | 6.14.1 | ≥6.14.2 | Low | express (body-parser) | Add pnpm override |

## Vulnerability Details

### 1. tar - Hardlink Path Traversal (CVE-2026-24842)
- **Severity:** High
- **Current Version:** 7.5.4
- **Fixed Version:** 7.5.7+
- **Path:** `.>electron-builder>app-builder-lib>tar`
- **Impact:** Arbitrary file creation/overwrite via hardlink path traversal
- **Advisory:** https://github.com/advisories/GHSA-34x7-hfp2-rc4v

### 2. @isaacs/brace-expansion - Uncontrolled Resource Consumption
- **Severity:** High
- **Current Version:** 5.0.0
- **Fixed Version:** 5.0.1+
- **Path:** `.>electron-builder>app-builder-lib>minimatch>@isaacs/brace-expansion`
- **Impact:** DoS via resource exhaustion
- **Advisory:** https://github.com/advisories/GHSA-7h2j-956f-4vf2

### 3. axios - Denial of Service via __proto__ Key
- **Severity:** High
- **Current Version:** 1.13.2
- **Fixed Version:** 1.13.5+
- **Path:** `.>@ghosttypes/ff-api>axios`
- **Impact:** DoS via prototype pollution in mergeConfig
- **Advisory:** https://github.com/advisories/GHSA-43fc-jf86-j433

### 4. fast-xml-parser - RangeError DoS
- **Severity:** High
- **Current Version:** 5.3.3
- **Fixed Version:** 5.3.4+
- **Path:** `.>@parallel-7/slicer-meta>fast-xml-parser`
- **Impact:** DoS via numeric entities bug
- **Advisory:** https://github.com/advisories/GHSA-37qj-frw5-hhjh

### 5. qs - arrayLimit Bypass DoS
- **Severity:** Low
- **Current Version:** 6.14.1
- **Fixed Version:** 6.14.2+
- **Path:** `.>express>qs`
- **Impact:** DoS via comma parsing arrayLimit bypass
- **Advisory:** https://github.com/advisories/GHSA-w7fw-mjwx-w883

## Analysis

### Good News
1. ✅ All fixes are available at the exact required versions
2. ✅ They're all transitive dependencies (none are direct dependencies)
3. ✅ We can fix them by adding/updating pnpm overrides in `package.json`
4. ✅ Most are dev-only (tar, brace-expansion) or low-risk in our use case

### Risk Assessment
- **tar, @isaacs/brace-expansion:** Dev dependencies only (electron-builder), not present in production bundle
- **axios:** Used in @ghosttypes/ff-api for printer communication (controlled internal use)
- **fast-xml-parser:** Used in @parallel-7/slicer-meta for gcode parsing (controlled internal use)
- **qs:** Used in express for WebUI query parsing (requires malicious input to exploit)

## Recommended Fix

Update the `pnpm.overrides` section in `package.json`:

```json
"pnpm": {
  "overrides": {
    "tar": "7.5.7",          // bump from 7.5.4
    "lodash": "4.17.23",     // keep existing
    "@isaacs/brace-expansion": "5.0.1",  // add new
    "axios": "1.13.5",       // add new
    "fast-xml-parser": "5.3.4",  // add new
    "qs": "6.14.2"          // add new
  }
}
```

Then run:
```bash
pnpm install
```

## Verification

After applying fixes, verify with:
```bash
pnpm audit
```

Expected result: 0 vulnerabilities

## Notes

- These vulnerabilities were reported against the `main` branch on GitHub
- The alpha branch (`feat/calibration-assistant`) has not yet merged security fixes
- All patches are backward-compatible and safe to apply
- No code changes required, only dependency version updates
