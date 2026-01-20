---
name: vite
description: Comprehensive Vite 7.x build tool documentation for core configuration, development server, build optimization, plugin API, and HMR. Use when Claude needs to work with Vite - creating or configuring vite.config.js/ts, setting up dev server with HMR, configuring build options and optimization, writing Vite plugins, troubleshooting Vite issues, migrating to Vite, environment and mode configuration, asset handling and static deployment. This is the core Vite skill - use vite-electron or vite-react for framework-specific integration.
---

# Vite (v7.3.1)

Vite (French for "quick", pronounced `/vit/`) is a modern build tool providing fast dev server with native ES modules and optimized production builds via Rollup.

## Quick Start

```bash
# Scaffold a new project
npm create vite@latest my-app

# Or install in existing project
npm install -D vite

# Dev server
npm run dev

# Production build
npm run build

# Preview build
npm run preview
```

## Basic Config

```js
// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  // Most options have sensible defaults
  plugins: [], // Add plugins here
  server: {
    port: 3000,
    open: true
  }
})
```

## When to Read What

| Task | Reference |
|------|-----------|
| **Getting started, CLI, project setup** | `references/guide.md` |
| **Dev server features, HMR** | `references/guide_features.md`, `references/guide_api-hmr.md` |
| **Configuration options** | `references/config.md` |
| **Server options (port, proxy, https)** | `references/config_server-options.md` |
| **Build options (targets, minify)** | `references/config_build-options.md` |
| **Plugin development** | `references/guide_api-plugin.md`, `references/plugins.md` |
| **Environment variables, modes** | `references/guide_env-and-mode.md` |
| **Asset handling** | `references/guide_assets.md` |
| **Troubleshooting** | `references/guide_troubleshooting.md` |
| **Migration from other tools** | `references/guide_migration.md` |
| **Performance optimization** | `references/guide_performance.md` |
| **API: JavaScript** | `references/guide_api-javascript.md` |
| **API: Environment** | `references/guide_api-environment.md` |
| **SSR** | `references/guide_ssr.md` |
| **Static deployment** | `references/guide_static-deploy.md` |
| **Pre-bundling deps** | `references/guide_dep-pre-bundling.md` |

## Common Tasks

### Adding a Plugin

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()]
})
```

See `references/plugins.md` for official plugins, `references/guide_using-plugins.md` for usage.

### Path Aliases

```js
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
```

### Environment Variables

```js
// Access with import.meta.env.VITE_MY_VARIABLE
define: {
  'import.meta.env.VITE_API_KEY': JSON.stringify(process.env.API_KEY)
}
```

See `references/guide_env-and-mode.md` for details.

### Dev Server Proxy

```js
server: {
  proxy: {
    '/api': {
      target: 'http://backend:3000',
      changeOrigin: true
    }
  }
}
```

### Build Configuration

```js
build: {
  outDir: 'dist',
  assetsDir: 'assets',
  sourcemap: true,
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom']
      }
    }
  }
}
```

See `references/config_build-options.md` for all build options.

## File Index

All documentation files in `references/`:

**Getting Started:**
- `guide.md` - Overview, installation, scaffolding
- `guide_cli.md` - CLI commands and flags
- `guide_features.md` - Dev server features
- `guide_why.md` - Vite philosophy and rationale
- `guide_philosophy.md` - Design principles
- `guide_migration.md` - Migrating from other tools

**Configuration:**
- `config.md` - Config file setup and intellisense
- `config_shared-options.md` - Options shared across commands
- `config_server-options.md` - Dev server configuration
- `config_build-options.md` - Build configuration
- `config_preview-options.md` - Preview server configuration
- `config_dep-optimization-options.md` - Dependency optimization
- `config_ssr-options.md` - SSR configuration
- `config_worker-options.md` - Web worker configuration

**API:**
- `guide_api-javascript.md` - JavaScript API
- `guide_api-plugin.md` - Plugin API
- `guide_api-hmr.md` - Hot Module Replacement API
- `guide_api-environment.md` - Environment API overview
- `guide_api-environment-instances.md` - Environment instances
- `guide_api-environment-frameworks.md` - Framework integration
- `guide_api-environment-plugins.md` - Environment plugins
- `guide_api-environment-runtimes.md` - Custom runtimes

**Features:**
- `guide_env-and-mode.md` - Environment variables and modes
- `guide_assets.md` - Asset handling (images, CSS, etc.)
- `guide_build.md` - Production builds
- `guide_static-deploy.md` - Deploying static sites
- `guide_backend-integration.md` - Backend integration
- `guide_dep-pre-bundling.md` - Dependency pre-bundling
- `guide_ssr.md` - Server-side rendering

**Plugins:**
- `plugins.md` - Official plugins list
- `guide_using-plugins.md` - Using plugins

**Advanced:**
- `guide_performance.md` - Performance optimization
- `guide_rolldown.md` - Rolldown bundler
- `guide_troubleshooting.md` - Common issues and solutions

## Scripts

### scripts/scrape_vite_docs.py

Fetches latest documentation from vite.dev and updates `references/`. Run to refresh docs:

```bash
python vite/scripts/scrape_vite_docs.py
```
