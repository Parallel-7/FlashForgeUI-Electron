Automatically document source files missing @fileoverview blocks

Document files missing proper documentation headers with optional focus: #$ARGUMENTS

**Step 1: Quick Discovery (One Command)**
Use the built-in npm script to instantly find all files missing @fileoverview:
```bash
npm run docs:check
```

This PowerShell script will:
- Check all TypeScript/JavaScript files (*.ts, *.js, *.tsx, *.jsx) in the src directory
- Look for @fileoverview in the first 10 lines of each file
- Display files missing documentation with their first line for context
- Show a summary count and success/failure status

**Optional Parameters:**
You can customize the number of lines to check:
```bash
powershell -ExecutionPolicy Bypass -File check_fileoverview.ps1 -CheckLines 15
```

This approach is much more efficient than manual file checking and gives you complete results in one command.

A proper @fileoverview block should look like:
```
/**
 * @fileoverview Brief description of what this file does - focus on functionality and purpose.
 * 
 * Detailed explanation of the file's role, key features, and what it provides:
 * - Key functionality bullet points
 * - Important exports or classes
 * - Notable integrations or dependencies
 */
```

For any files missing this documentation:
1. Read the entire file to understand its purpose, exports, and functionality
2. Use the `code-documenter` sub-agent to generate comprehensive documentation headers
3. The sub-agent should create optimized @fileoverview blocks that include:
   - Clear, concise description focusing on what this file does
   - Detailed explanation of the file's purpose and key features
   - Bullet points highlighting important functionality, exports, or integrations
   - Any important usage notes or architectural context

Present a summary of files that need documentation and delegate the actual documentation generation to the `code-documenter` sub-agent. The sub-agent should focus on creating consistent, professional documentation that follows the project's established documentation patterns.

Important: Only document source files (.ts, .js, .tsx, .jsx) and avoid configuration files, build files, or generated files unless specifically requested.