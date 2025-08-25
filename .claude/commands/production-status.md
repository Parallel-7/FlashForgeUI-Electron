# Production Status Check

Conducts a comprehensive production readiness audit of the FlashForgeUI-Electron codebase using the production-readiness-auditor agent.

## Task

Use the production-readiness-auditor agent to perform a thorough production readiness assessment, then present the results in a professional, terminal-friendly format with actionable remediation steps.

## Instructions

1. **Invoke Production Readiness Auditor**:
   - Use the production-readiness-auditor agent to audit the entire codebase
   - Focus on build configuration, security, code quality, dependencies, and deployment readiness

2. **Process and Format Results**:
   - Parse the agent's comprehensive report
   - Organize findings by severity (Critical, High, Medium, Low)
   - Extract specific file paths, line numbers, and remediation actions
   - Create a clean, professional summary for terminal display

3. **Terminal Output Format**:
   - Start with an executive summary and overall status
   - List critical issues first with specific file locations and line numbers
   - Provide clear, actionable remediation steps for each issue
   - Include risk assessment and priority levels
   - End with either:
     - Congratulations if no critical issues found
     - Clear next steps if issues need resolution

4. **Error Reporting Requirements**:
   For each issue found, include:
   - ❌ **Issue Type**: Brief description
   - 📁 **File**: `path/to/file:line` (if applicable)
   - ⚠️ **Risk Level**: Critical/High/Medium/Low
   - 🔧 **Action**: Specific remediation steps
   - 📋 **Details**: Additional context if needed

5. **Success Message**:
   If no critical issues are found:
   ```
   🎉 **PRODUCTION READY!**
   
   Congratulations! Your FlashForgeUI-Electron codebase has passed all production readiness checks.
   
   ✅ Build system configured correctly
   ✅ Security vulnerabilities resolved  
   ✅ Code quality standards met
   ✅ Dependencies verified
   ✅ Documentation complete
   
   You're all set to release! 🚀
   ```

6. **Issues Found Message**:
   If issues are found, provide a summary with total count by severity and immediate next steps.

## Example Output Structure

```
🔍 **PRODUCTION READINESS AUDIT**
=====================================

📊 **EXECUTIVE SUMMARY**
Status: ⚠️ NEEDS ATTENTION
Critical Issues: 2
High Priority: 3  
Medium Priority: 1
Low Priority: 2

🚨 **CRITICAL ISSUES** (Fix Immediately)

❌ **Security Vulnerability - form-data package**
📁 **Dependencies**: package.json
⚠️ **Risk Level**: CRITICAL
🔧 **Action**: Run `npm audit fix` immediately
📋 **Details**: CVE-2024-XXXX affects file upload functionality

❌ **Build Configuration Error**
📁 **File**: `webpack.config.js:46`
⚠️ **Risk Level**: CRITICAL  
🔧 **Action**: Verify tsconfig.renderer.json exists and matches webpack config
📋 **Details**: Missing renderer TypeScript configuration causes build inconsistencies

[Continue for all issues...]

📋 **NEXT STEPS**
1. Fix critical security vulnerabilities (IMMEDIATE)
2. Resolve build configuration errors (IMMEDIATE) 
3. Address high-priority issues (TODAY)
4. Plan medium/low priority improvements (THIS WEEK)

Run this command again after fixes to verify resolution.
```

## Agent Invocation

Invoke the production-readiness-auditor agent with comprehensive audit parameters focusing on all aspects of production deployment readiness.