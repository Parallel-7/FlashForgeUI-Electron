# TypeScript Configuration

## Base Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020", "DOM"],
    "outDir": "./lib",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "types": ["node", "jest"]
  }
}
```

## ESM/Bundler Configuration (`tsconfig.build.json`)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "noEmit": false,
    "outDir": "./dist",
    "declaration": false,
    "sourceMap": false
  }
}
```

## Configuration Guidelines

1. **Strict Mode**: Always enable `strict` mode with all strict flags
2. **Module Resolution**: Use `"node"` for Node.js projects, `"bundler"` for bundler-based projects
3. **Target/Lib**: ES2020 provides good balance of modern features and compatibility
4. **Source Maps**: Enable for debugging, can disable for production builds
5. **Declarations**: Generate for libraries, optional for applications

## Key Compiler Options Explained

| Option | Purpose |
|--------|---------|
| `strict: true` | Enables all strict type checking options |
| `noImplicitAny` | Disallows implicit `any` types |
| `noImplicitReturns` | Reports error when not all code paths return a value |
| `strictNullChecks` | Enables strict null checking |
| `strictFunctionTypes` | Disallows bivariant parameter types |
| `esModuleInterop` | Allows import of CommonJS modules as ES modules |
| `skipLibCheck` | Skips type checking of declaration files |
| `declaration` | Generates `.d.ts` declaration files |
| `resolveJsonModule` | Allows importing JSON files |
