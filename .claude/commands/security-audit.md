# Security Audit Command

## Purpose
Perform a comprehensive security analysis of the entire FlashForgeUI-Electron codebase using the electron-security-analyst agent.

## Instructions

You MUST use the Task tool to launch the electron-security-analyst agent with the following detailed prompt:

"Perform a FULL comprehensive security analysis on the ENTIRE FlashForgeUI-Electron codebase. This is an Electron-based desktop application for controlling FlashForge 3D printers with WebUI capabilities.

**CRITICAL VERIFICATION REQUIREMENTS**:

1. **Verify version control status before flagging ANY file**:
   - Use `git log --all --full-history -- <filename>` to check if file was ever committed
   - Check if file is listed in `.gitignore`
   - Use `git status --ignored` to see current ignored files
   - Only flag as 'exposed' if sensitive files are actually tracked in version control

2. **Investigate before assuming**:
   - Read actual file contents and surrounding code context
   - Understand the application's security model and intended use
   - Verify if apparent 'vulnerabilities' have mitigating controls
   - Focus on actual exploitable weaknesses, not theoretical risks

**AGENT MUST**: Investigate and understand the actual security posture rather than making assumptions. Verify claims with evidence before flagging issues.

**Analysis Scope**:
- Electron security (nodeIntegration, contextIsolation, CSP)
- IPC security between main/renderer processes
- WebUI authentication and authorization
- Secret management and exposure
- File system access patterns
- Network communication security
- Input validation and sanitization
- Dependency vulnerabilities
- Configuration security
- Process isolation
- Code injection vectors

**Expected Output Format**:

### No Issues Found
'🎉 Congratulations! The security audit has completed successfully with no security issues detected. Your FlashForgeUI-Electron codebase follows security best practices and is ready for deployment.'

### Issues Found
Present findings in this format:
```
🔒 Security Audit Results

❌ CRITICAL ISSUES FOUND: [count]
❌ HIGH PRIORITY ISSUES: [count]  
⚠️ MEDIUM PRIORITY ISSUES: [count]
ℹ️ LOW PRIORITY ISSUES: [count]

## Detailed Findings

[List each issue with file location, description, and severity]

## Resolution Plan

### Immediate Actions Required (Critical/High)
1. [Specific action item]
2. [Specific action item]

### Recommended Improvements (Medium/Low)  
1. [Specific action item]
2. [Specific action item]

Next steps: Would you like me to help implement these security fixes?
```

Focus on actual security issues that could be exploited, not theoretical concerns. Provide actionable recommendations with specific file locations and code changes needed."