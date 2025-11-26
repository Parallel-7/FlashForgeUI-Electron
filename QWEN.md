# Qwen Code Tools Reference

This document provides information about the built-in and external tools available in Qwen Code, including when to use them to optimize speed and efficiency.

## Important Note for FlashForgeUI-Electron Development

**Before starting any programming work on the FlashForgeUI-Electron project, you MUST read the following documents:**
1. `@ai_reference/electron-typescript-best-practices.md`
2. `@ai_reference/typescript-best-practices.md`

These documents contain critical information about project architecture, coding standards, and best practices that must be followed to maintain consistency and quality in the codebase.

## FlashForgeUI-Electron Project Information

### Project Overview
FlashForgeUI-Electron is a cross-platform desktop application for controlling FlashForge 3D printers. It's built with Electron, TypeScript, and includes a web UI for remote access. The application supports multiple printer models including Adventurer 5X, 5M/Pro, and 3/4 series.

### Build Process
The project uses TypeScript for both main and renderer processes with separate tsconfig files. Webpack is used for bundling the renderer process. Electron-builder is used for creating distributable packages for Windows, macOS, and Linux.

### Available npm Scripts
- `start` - Build and run the application
- `dev` - Watch mode for development
- `build` - Full build process (main + renderer + webui)
- `build:main` - Build main process TypeScript files
- `build:main:watch` - Watch and build main process files
- `build:renderer` - Build renderer process with webpack
- `build:renderer:watch` - Watch and build renderer process
- `build:webui` - Build web UI TypeScript files and copy assets
- `build:webui:copy` - Copy web UI assets
- `build:linux` - Build for Linux
- `build:win` - Build for Windows
- `build:mac` - Build for macOS
- `lint` - Run ESLint on source files
- `lint:fix` - Run ESLint and automatically fix issues
- `type-check` - Run TypeScript type checking without emitting files
- `clean` - Remove build artifacts
- `docs:check` - Check file overview documentation
- `docs:combine` - Combine file overview documentation
- `docs:clean` - Clean file overview documentation
- `linecount` - Count lines of code (supports `-- --min-lines=N` to filter by minimum line count)

### Project Structure
The project follows a modular architecture with separate directories for different concerns:
- `src/` - Main source code
  - `ipc/` - Inter-process communication handlers
  - `managers/` - State management and coordination
  - `printer-backends/` - Printer-specific implementations
  - `services/` - Business logic and services
  - `ui/` - User interface components and dialogs
  - `utils/` - Utility functions
  - `validation/` - Validation schemas
  - `webui/` - Web-based user interface
  - `windows/` - Window management
- `assets/` - Static assets for packaging
- `scripts/` - Helper scripts
- `dist/` - Build output directory

### Key Configuration Files
- `electron-builder-config.js` - Packaging settings for different platforms
- `eslint.config.js` - Linting rules for TypeScript code
- `tsconfig.json` - Main process TypeScript configuration
- `tsconfig.renderer.json` - Renderer process TypeScript configuration
- `webpack.config.js` - Webpack configuration for renderer process

## Built-in Tools

### `read_many_files`
- **Purpose**: Reads content from multiple files specified by paths or glob patterns. It is particularly useful for tasks such as:
  - Getting an overview of a codebase.
  - Finding where specific functionality is implemented.
  - Reviewing documentation.
  - Gathering context from multiple configuration files.
- **When to use**:
  - When you need to read and analyze content from multiple files simultaneously.
  - When working with glob patterns to match a set of files (e.g., all `.ts` files in a directory).
  - When you need to explicitly include or exclude certain files or file types.
  - Getting an overview of a codebase or parts of it (e.g., all TypeScript files in the 'src' directory)
  - Finding where specific functionality is implemented when asked broad questions about code
  - Reviewing documentation files (e.g., all Markdown files in the 'docs' directory)
  - Gathering context from multiple configuration files
  - When the user asks to "read all files in X directory" or "show me the content of all Y files"
- **Key Features**:
  - **Text Files**: Reads and concatenates content into a single string, separated by `--- {filePath} ---`.
  - **Image/PDF Files**: Returns base64-encoded data if explicitly requested by name or extension.
  - **Binary File Handling**: Attempts to detect and skip non-image/PDF binary files.
- **Arguments**:
  - **paths** (list[string], required): Glob patterns or file paths to read (e.g., `["src/**/*.ts"]`).
  - **exclude** (list[string], optional): Patterns to exclude (e.g., `["**/*.log"]`).
  - **include** (list[string], optional): Additional patterns to include (e.g., `["*.test.ts"]`).
  - **recursive** (boolean, optional): Whether to search recursively (controlled by `**` in patterns). Defaults to `true`.
  - **useDefaultExcludes** (boolean, optional): Applies default exclusions like `node_modules`, `.git`. Defaults to `true`.
  - **respect_git_ignore** (boolean, optional): Respects `.gitignore` patterns. Defaults to `true`.
- **Usage Guidelines**:
  1. **Text Files**: The tool reads and combines text file contents with clear separators.
  2. **Image/PDF Files**: Must be explicitly targeted (e.g., `assets/logo.png` or `*.pdf`) to return base64 data.
  3. **Binary Files**: Non-image/PDF binaries are skipped by default.
  4. **Performance**: Be cautious with large numbers of files or very large files.
  5. **Path Specificity**: Ensure patterns are correctly specified relative to the target directory.
  6. **Default Excludes**: Override cautiously using `useDefaultExcludes=False` if needed.
- **Examples**:
  1. **Read all TypeScript files in `src`**:
     ```python
     read_many_files(paths=["src/**/*.ts"])
     ```
  2. **Read README, docs, and a logo, excluding a specific file**:
     ```python
     read_many_files(paths=["README.md", "docs/**/*.md", "assets/logo.png"], exclude=["docs/OLD_README.md"])
     ```
  3. **Read JavaScript files, include tests and JPEGs**:
     ```python
     read_many_files(paths=["**/*.js"], include=["**/*.test.js", "images/**/*.jpg"], useDefaultExcludes=False)
     ```

### `run_shell_command`
- **Purpose**: Allows Qwen Code to interact with the underlying system by executing shell commands. It is used for running scripts, performing command-line operations, and managing system processes.
  - On **Windows**, commands are executed with `cmd.exe /c`.
  - On other platforms, commands are executed with `bash -c`.
- **When to use**:
  - Running build systems (e.g., `npm run build`, `make`).
  - Start development servers (e.g., `npm run dev`).
  - Manage files or directories (e.g., `ls`, `mkdir`).
  - Execute scripts or third-party CLI tools (e.g., `python script.py`, `git status`).
  - Run long-running processes in the background (e.g., servers, watchers).
  - Running build commands, installation commands, git operations
  - Executing test suites
  - Starting development servers in background mode
  - File operations and system commands
- **Arguments**:
  | Argument      | Type    | Required | Description |
  |---------------|---------|----------|-------------|
  | `command`     | string  | Yes      | The exact shell command to execute. |
  | `description` | string  | No       | A brief description shown to the user. |
  | `directory`   | string  | No       | Relative directory to execute the command in. Defaults to project root. |
  | `is_background` | boolean | Yes     | Whether the command should run in the background (`true`) or foreground (`false`). |
- **Execution Modes**:
  - **Foreground Execution** (`is_background: false`): Blocks further execution until the command completes.
    - Use for: One-time tasks like builds, tests, installations, or git operations.
  - **Background Execution** (`is_background: true`): Returns immediately while the process continues running.
    - Use for: Long-running services like development servers or watchers.
  - ⚠️ You can also append `&` manually to a command, but `is_background` must still be explicitly set.
- **Examples**:
  1. **List files in current directory**:
     ```qwen
     run_shell_command(command="dir", is_background=false)
     ```
  2. **Run build command**:
     ```qwen
     run_shell_command(command="npm run build", description="Build project", is_background=false)
     ```
  3. **Start development server in background**:
     ```qwen
     run_shell_command(command="npm run dev", description="Start dev server [background]", is_background=true)
     ```
  4. **Run script in specific directory**:
     ```qwen
     run_shell_command(command="python setup.py", directory="scripts", is_background=false)
     ```
  5. **Start multiple services**:
     ```qwen
     run_shell_command(command="docker-compose up", description="Start all services [background]", is_background=true)
     ```
- **Important Usage Guidelines**:
  - **Security**: Avoid executing untrusted input directly. Sanitize or validate all dynamic commands.
  - **Error Handling**: Always check the returned `stderr`, `error`, and `exit_code` fields to verify success.
  - **Interactive Commands**: Do not use commands requiring user input (e.g., `git commit` without `-m`). Prefer non-interactive flags (e.g., `npm init -y`).
  - **Background Processes**: When using `is_background=true` or appending `&`, note the PID(s) in `background_pids` for future management.
  - **Environment Variables**: The environment variable `QWEN_CODE=1` is automatically set for detection within scripts.
- **Command Restrictions**:
  - You can control which commands are allowed via configuration.
  - Restrictions use prefix matching and are **not secure against malicious bypasses**. Use at your own risk.

### `web_fetch`
- **Purpose**: Fetches content from a specified URL and processes it using an AI model. It takes a URL and a prompt as input, fetches the URL content, converts HTML to markdown, and processes the content with the prompt using a small, fast model.
- **When to use**:
  - Extract specific information from web pages
  - Summarize articles or documentation
  - Analyze content from URLs
  - Process web content with AI-powered prompts
  - Retrieving and analyzing web content
  - Getting documentation or information from specific URLs
  - Processing online resources relevant to the task
- **Arguments**:
  - `url` (string, required): A fully-formed valid URL starting with http:// or https://
  - `prompt` (string, required): A prompt describing what information you want to extract from the page content
- **Usage Guidelines**:
  - Processes one URL at a time (make separate calls for multiple URLs)
  - Automatically upgrades HTTP URLs to HTTPS for security
  - Converts GitHub blob URLs to raw format for better content access
  - Automatically converts HTML to readable text format
  - Output quality depends on the clarity of the prompt instructions
  - If an MCP-provided web fetch tool is available (starting with "mcp__"), prefer using that tool as it may have fewer restrictions
- **Examples**:
  ```
  # Summarize an article
  web_fetch(url="https://example.com/news/latest", prompt="Can you summarize the main points of this article?")

  # Extract specific information
  web_fetch(url="https://arxiv.org/abs/2401.0001", prompt="What are the key findings and methodology described in this paper?")

  # Analyze GitHub documentation
  web_fetch(url="https://github.com/google/gemini-react/blob/main/README.md", prompt="What are the installation steps and main features?")
  ```

### `web_search`
- **Purpose**: Performs web searches using the Tavily API. It's designed to fetch concise, relevant information from the web along with source citations.
- **When to use**:
  - Look up factual information 
  - Research recent developments or news
  - Gather information on topics not covered in the codebase
  - Provide users with up-to-date information from the web
  - Get concise answers to specific questions with source links
  - When you need to find URLs for information
  - Researching libraries, frameworks, or solutions
  - Finding documentation or tutorials
- **Usage Guidelines**:
  - **Arguments**: `query` (string, required): The search query to be executed.
  - **Configuration**: The tool requires a Tavily API key configured through one of these methods:
    1. **Settings file**: Add `"tavilyApiKey": "your-key-here"` to your `settings.json`
    2. **Environment variable**: Set `TAVILY_API_KEY` in your environment or `.env` file
    3. **Command line**: Use `--tavily-api-key your-key-here` when running the CLI
  - If the API key isn't configured, the tool will be disabled.
  - **Response Format**: Returns a concise answer when available, includes a list of source links as numbered citations, source links are appended at the end of the response.
- **Examples**:
  ```python
  web_search(query="latest advancements in AI-powered code generation")
  ```
- **Important Notes**:
  - The tool directly calls the Tavily API
  - Requires internet connectivity to function
  - Will be skipped if `TAVILY_API_KEY` is not configured
  - Best for factual queries that require external information sources

### `save_memory`
- **Purpose**: Allows you to save and recall information across Qwen Code sessions. It enables the CLI to remember key details across sessions, providing personalized and directed assistance.
- **When to use**:
  - Remember user preferences and settings
  - Store project-specific details
  - Save important facts that should persist across sessions
  - Provide personalized assistance based on user history
  - When the user explicitly asks you to remember something
  - When the user states a clear, concise fact about themselves, their preferences, or environment
  - Information that should be retained for future interactions to provide personalized assistance
- **Usage Guidelines**:
  - **Arguments**: **fact** (string, required): A clear, self-contained statement written in natural language that you want the system to remember.
  - **How it Works**: 
    1. The tool appends the provided fact to your context file in the user's home directory (`~/.qwen/QWEN.md` by default)
    2. Facts are stored under a `## Qwen Added Memories` section
    3. This file is loaded as context in subsequent sessions, allowing the CLI to recall saved information
  - **Usage Syntax**: 
    ```python
    save_memory(fact="Your fact here.")
    ```
- **Examples**:
  1. Remembering a user preference:
     ```python
     save_memory(fact="My preferred programming language is Python.")
     ```
  2. Storing a project-specific detail:
     ```python
     save_memory(fact="The project I'm currently working on is called 'FlashForgeUI-Electron'.")
     ```
- **Important Notes**:
  - This tool should be used for concise, important facts. It is not intended for storing large amounts of data or conversational history.
  - The memory file is a plain text Markdown file, so you can view and edit it manually if needed.

## External MCP Tools

### `context7`
A tool that provides up-to-date documentation for various libraries with two sub-tools:

#### `get-library-docs`
- **Purpose**: Fetches up-to-date documentation for a library
- **When to use**:
  - When you need current documentation for a specific library
  - Before implementing features with unfamiliar libraries
  - When troubleshooting library-related issues

#### `resolve-library-id`
- **Purpose**: Resolves a package/product name to a Context7-compatible library ID
- **When to use**:
  - Before using `get-library-docs` to obtain the exact library ID
  - When the user mentions a library but doesn't provide the exact ID

### `sequential-thinking`
A tool for dynamic and reflective problem-solving through thoughts.

#### `sequential-thinking`
- **Purpose**: Helps analyze problems through a flexible thinking process that can adapt and evolve
- **When to use**:
  - When you are "stuck" on an issue
  - Working on something complex
  - Need deeper thoughts/reflections on the task at hand
  - Breaking down complex problems into steps
  - Planning and design with room for revision
  - When you are "stuck" on an issue, working on something complex, or need deeper thoughts/reflections on the task at hand

### `code-context-provider-mcp`
A tool for getting context about a project directory structure and code symbols.

#### `get_code_context`
- **Purpose**: Returns complete context of a given project directory, including directory tree and code symbols
- **When to use**:
  - Getting a quick overview of a project's codebase
  - Understanding project structure at the start of a new task
  - When analyzing the codebase with the `code-context-provider-mcp` tool

#### Usage Guidelines:

**For Overview Analysis**:
- Use root directory with `includeSymbols: false` and `maxDepth: 3-5` for structure overview
- This provides file counts, directory tree, and basic metrics without hitting token limits

**For Detailed Symbol Analysis**:
- Use targeted subdirectory calls with `includeSymbols: true` and `symbolType: "all"`
- Make separate calls for major directories
- This approach gets comprehensive symbol information without exceeding token limits

**Never**: Try to get all symbols from root directory - it will always exceed the 25k token limit