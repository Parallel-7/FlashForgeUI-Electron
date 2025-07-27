// eslint.config.js - Modern ESLint configuration for TypeScript Electron app
const eslint = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');

module.exports = [
  // Apply to all TypeScript files
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        // Node.js globals for main process and utilities
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        // NodeJS types
        NodeJS: 'readonly',
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Include recommended rules but make them less strict initially
      ...eslint.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,

      // TypeScript-specific rules - start with warnings, will escalate to errors later
      '@typescript-eslint/no-explicit-any': 'warn', // Warning for now, too many to fix at once
      '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off', // Too noisy initially
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/prefer-readonly': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-require-imports': 'off', // Allow require() in main process

      // Code quality rules
      'no-console': 'off', // Allow console for logging in Electron
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': 'error',
      'curly': 'off', // Disabled - can be fixed with IDE formatting
      'no-throw-literal': 'error',
      'no-prototype-builtins': 'off', // Disabled - can be fixed later

      // Electron-specific rules - relaxed initially
      'no-restricted-globals': 'off', // Will enable selectively later
      
      // Style consistency - indentation disabled (can be fixed with IDE formatting)
      'indent': 'off',
      'quotes': ['warn', 'single', { avoidEscape: true }], // Start with warning
      'semi': ['error', 'always'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],

      // Disable rules that are too noisy for now
      'no-undef': 'off', // TypeScript handles this better
    },
  },
  
  // Renderer-specific configuration (allows window, document, etc.)
  {
    files: ['src/**/renderer.ts', 'src/**/preload.ts', 'src/ui/**/*.ts'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLTableElement: 'readonly',
        HTMLTableRowElement: 'readonly',
        HTMLDivElement: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        File: 'readonly',
        FileList: 'readonly',
        FormData: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
      }
    },
    rules: {
      // Allow window usage in renderer processes
      'no-restricted-globals': 'off',
    }
  },

  // Test files (if any are added later)
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests
      '@typescript-eslint/no-unsafe-assignment': 'off',
    }
  },

  // Configuration files
  {
    files: ['*.config.js', '*.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        exports: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      }
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      'no-undef': 'off',
    }
  },

  // Ignore patterns
  {
    ignores: [
      'lib/**/*',
      'dist/**/*', 
      'node_modules/**/*',
      '*.js', // Ignore JS files in root (like this config)
      'src/**/*.js', // Only lint TypeScript files
    ]
  }
];
