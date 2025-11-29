import { resolve, basename } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { globSync } from 'glob'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          ...Object.fromEntries(
            globSync('src/renderer/src/ui/**/*-preload.{ts,cts}', { absolute: true })
              .map(file => [
                basename(file).replace(/\.c?ts$/, ''),
                file
              ])
          )
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
          inlineDynamicImports: false
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          ...Object.fromEntries(
            globSync('src/renderer/src/ui/**/*.html', { absolute: true })
              .map(file => [
                basename(file, '.html'),
                file
              ])
          )
        }
      }
    }
  }
})
