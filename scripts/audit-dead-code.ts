/**
 * @fileoverview Dead code auditor that discovers entrypoints dynamically and reports unused files/exports.
 */

import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { globSync } from 'glob';
import { Project, SyntaxKind, type SourceFile, Node } from 'ts-morph';

type CliOptions = {
  json: boolean;
};

type Entrypoint = {
  path: string;
  reasons: string[];
};

type Graph = {
  files: Map<string, SourceFile>;
  adjacency: Map<string, Set<string>>;
  importUsage: Map<string, Set<string>>;
};

type UnusedFile = {
  file: string;
  reason: string;
};

type UnusedExport = {
  file: string;
  exportName: string;
  kind: string;
};

type AnalysisResult = {
  entrypoints: Entrypoint[];
  unusedFiles: UnusedFile[];
  unusedExports: UnusedExport[];
};

const PROJECT_ROOT = process.cwd();
const TS_CONFIGS = [
  path.resolve(PROJECT_ROOT, 'tsconfig.node.json'),
  path.resolve(PROJECT_ROOT, 'tsconfig.web.json'),
];
const WEBUI_TSCONFIG = path.resolve(
  PROJECT_ROOT,
  'src/main/webui/static/tsconfig.json',
);

if (existsSync(WEBUI_TSCONFIG)) {
  TS_CONFIGS.push(WEBUI_TSCONFIG);
}

const PATH_ALIAS_MAP = buildPathAliases(TS_CONFIGS);

const SCRIPT_GLOBS = [
  path.join(PROJECT_ROOT, 'scripts/**/*.ts'),
  path.join(PROJECT_ROOT, 'scripts/**/*.tsx'),
  path.join(PROJECT_ROOT, 'scripts/**/*.mts'),
  path.join(PROJECT_ROOT, 'scripts/**/*.cts'),
];

const SCRIPT_ENTRY_IGNORE = ['**/node_modules/**'];

const HTML_ROOTS = [
  path.join(PROJECT_ROOT, 'src/main/webui/static/**/*.html'),
];

const TEST_GLOB_PATTERNS = [
  'src/**/*.test.{ts,tsx,cts,mts}',
  'src/**/*.spec.{ts,tsx,cts,mts}',
  'tests/**/*.test.{ts,tsx,cts,mts}',
  'tests/**/*.spec.{ts,tsx,cts,mts}',
  'src/**/__tests__/**/*.{ts,tsx,cts,mts}',
];

const TEST_GLOB_IGNORE = ['**/node_modules/**', '**/out/**', '**/dist/**'];

const SUPPORTED_EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
];

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Dead code auditor failed: ${message}`);
  process.exit(EXIT_FAILURE);
});

async function main(): Promise<void> {
  const options = parseArgs();
  const entrypoints = await discoverEntrypoints();

  if (entrypoints.length === 0) {
    throw new Error('No entrypoints discovered. Unable to audit for dead code.');
  }

  const project = createProject();
  const graph = buildDependencyGraph(project);
  const reachable = evaluateReachability(graph, entrypoints.map((entry) => entry.path));
  const unusedFiles = findUnusedFiles(graph, reachable);
  const unusedExports = findUnusedExports(graph, reachable, new Set(unusedFiles.map((item) => item.file)));

  const result: AnalysisResult = {
    entrypoints,
    unusedFiles,
    unusedExports,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result);
  }

  if (result.unusedFiles.length > 0 || result.unusedExports.length > 0) {
    process.exit(EXIT_FAILURE);
  }

  process.exit(EXIT_SUCCESS);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let json = false;

  for (const arg of args) {
    if (arg === '--json') {
      json = true;
    }
  }

  return { json };
}

async function discoverEntrypoints(): Promise<Entrypoint[]> {
  const discovered: Entrypoint[] = [];

  const viteEntrypoints = await discoverEntrypointsFromElectronVite();
  discovered.push(...viteEntrypoints);

  const scriptEntrypoints = await discoverEntrypointsFromPackageScripts();
  discovered.push(...scriptEntrypoints);

  const htmlEntrypoints = await discoverEntrypointsFromHtml();
  discovered.push(...htmlEntrypoints);

  const testEntrypoints = await discoverEntrypointsFromTests();
  discovered.push(...testEntrypoints);

  const scriptFileEntrypoints = await discoverEntrypointsFromScriptFiles();
  discovered.push(...scriptFileEntrypoints);

  const deduped = new Map<string, Entrypoint>();
  for (const entry of discovered) {
    const normalizedPath = normalizePath(entry.path);
    const existing = deduped.get(normalizedPath);

    if (existing) {
      const mergedReasons = new Set([...existing.reasons, ...entry.reasons]);
      deduped.set(normalizedPath, { path: normalizedPath, reasons: Array.from(mergedReasons) });
    } else {
      deduped.set(normalizedPath, { path: normalizedPath, reasons: [...entry.reasons] });
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.path.localeCompare(b.path));
}

async function discoverEntrypointsFromElectronVite(): Promise<Entrypoint[]> {
  const entrypoints: Entrypoint[] = [];

  const configPath = path.resolve(PROJECT_ROOT, 'electron.vite.config.ts');
  if (existsSync(configPath)) {
    entrypoints.push({
      path: normalizePath(configPath),
      reasons: ['electron-vite config'],
    });
  }

  const mainEntry = path.resolve(PROJECT_ROOT, 'src/main/index.ts');
  if (existsSync(mainEntry)) {
    entrypoints.push({ path: normalizePath(mainEntry), reasons: ['electron main entry (mirrored)'] });
  }

  const preloadEntry = path.resolve(PROJECT_ROOT, 'src/preload/index.ts');
  if (existsSync(preloadEntry)) {
    entrypoints.push({ path: normalizePath(preloadEntry), reasons: ['electron preload entry (mirrored)'] });
  }

  const preloadGlobs = globSync('src/renderer/src/ui/**/*-preload.{ts,cts}', {
    absolute: true,
  });
  for (const filePath of preloadGlobs) {
    const tsPath = ensureTsSource(filePath);
    if (tsPath) {
      entrypoints.push({ path: tsPath, reasons: ['electron dialog preload entry'] });
    }
  }

  const rendererHtmlPaths = [
    path.resolve(PROJECT_ROOT, 'src/renderer/index.html'),
    ...globSync('src/renderer/src/ui/**/*.html', { absolute: true }),
  ];

  for (const htmlPath of rendererHtmlPaths) {
    const scripts = await extractScriptsFromHtml(htmlPath, 'electron renderer HTML');
    entrypoints.push(...scripts);
  }

  return entrypoints;
}

async function discoverEntrypointsFromPackageScripts(): Promise<Entrypoint[]> {
  const packagePath = path.resolve(PROJECT_ROOT, 'package.json');
  const raw = await readFile(packagePath, 'utf8');
  const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
  const scripts = pkg.scripts ?? {};
  const scriptEntries: Entrypoint[] = [];
  const scriptPattern = /((?:\.\/|\.\.\/)?[A-Za-z0-9@/_-][A-Za-z0-9@/_.-]*\.c?ts)/g;

  for (const [name, command] of Object.entries(scripts)) {
    if (!command) {
      continue;
    }

    const matches = command.matchAll(scriptPattern);
    for (const match of matches) {
      const [fullMatch] = match;
      if (!fullMatch) {
        continue;
      }

      const candidate = normalizePath(path.resolve(PROJECT_ROOT, fullMatch));
      const tsPath = ensureTsSource(candidate) ?? candidate;

      if (!existsSync(tsPath)) {
        continue;
      }

      scriptEntries.push({
        path: tsPath,
        reasons: [`npm script: ${name}`],
      });
    }
  }

  return scriptEntries;
}

async function discoverEntrypointsFromHtml(): Promise<Entrypoint[]> {
  const htmlEntrypoints: Entrypoint[] = [];
  const files = HTML_ROOTS.flatMap((pattern) => globSync(pattern, { nodir: true }));

  for (const file of files) {
    const scripts = await extractScriptsFromHtml(file, 'standalone HTML entry');
    htmlEntrypoints.push(...scripts);
  }

  return htmlEntrypoints;
}

async function discoverEntrypointsFromTests(): Promise<Entrypoint[]> {
  const paths = new Set<string>();

  for (const pattern of TEST_GLOB_PATTERNS) {
    const matches = globSync(pattern, {
      absolute: true,
      nodir: true,
      ignore: TEST_GLOB_IGNORE,
    });

    for (const match of matches) {
      paths.add(normalizePath(match));
    }
  }

  return Array.from(paths).map((filePath) => ({
    path: filePath,
    reasons: ['test file'],
  }));
}

async function discoverEntrypointsFromScriptFiles(): Promise<Entrypoint[]> {
  const patterns = ['scripts/**/*.ts', 'scripts/**/*.tsx', 'scripts/**/*.mts', 'scripts/**/*.cts'];
  const files = new Set<string>();

  for (const pattern of patterns) {
    const matches = globSync(pattern, {
      absolute: true,
      nodir: true,
      ignore: SCRIPT_ENTRY_IGNORE,
    });

    for (const file of matches) {
      files.add(normalizePath(file));
    }
  }

  return Array.from(files).map((filePath) => ({
    path: filePath,
    reasons: ['script entry'],
  }));
}

async function extractScriptsFromHtml(htmlPath: string, reason: string): Promise<Entrypoint[]> {
  const entrypoints: Entrypoint[] = [];

  if (!existsSync(htmlPath)) {
    return entrypoints;
  }

  const htmlContent = await readFile(htmlPath, 'utf8');
  const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    const src = match[1];

    if (!src || src.startsWith('http') || src.startsWith('//')) {
      continue;
    }

    const resolved = resolveResourcePath(htmlPath, src);
    if (!resolved) {
      continue;
    }

    const tsPath = ensureTsSource(resolved);
    if (tsPath) {
      entrypoints.push({
        path: tsPath,
        reasons: [`${reason}: ${relativeToRoot(htmlPath)}`],
      });
    }
  }

  return entrypoints;
}

function ensureTsSource(filePath: string): string | null {
  const normalizedPath = normalizePath(filePath);

  if (existsSync(normalizedPath)) {
    return normalizedPath;
  }

  const withoutExt = normalizedPath.replace(/\.[^.]+$/, '');
  for (const ext of ['.ts', '.tsx', '.mts', '.cts']) {
    const candidate = `${withoutExt}${ext}`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveResourcePath(fromHtml: string, relativeSrc: string): string | null {
  const baseDir = path.dirname(fromHtml);
  const absolutePath = normalizePath(path.resolve(baseDir, relativeSrc));

  if (existsSync(absolutePath)) {
    return absolutePath;
  }

  const withoutExt = absolutePath.replace(/\.[^.]+$/, '');
  for (const ext of ['.ts', '.tsx', '.mts', '.cts']) {
    const candidate = `${withoutExt}${ext}`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function createProject(): Project {
  const project = new Project({
    tsConfigFilePath: TS_CONFIGS[0],
    skipAddingFilesFromTsConfig: false,
  });

  for (let i = 1; i < TS_CONFIGS.length; i += 1) {
    project.addSourceFilesFromTsConfig(TS_CONFIGS[i]);
  }

  project.addSourceFilesAtPaths(SCRIPT_GLOBS);
  project.resolveSourceFileDependencies();
  return project;
}

function buildDependencyGraph(project: Project): Graph {
  const files = new Map<string, SourceFile>();
  const importUsage = new Map<string, Set<string>>();

  for (const sourceFile of project.getSourceFiles()) {
    if (shouldSkipFile(sourceFile)) {
      continue;
    }

    files.set(normalizePath(sourceFile.getFilePath()), sourceFile);
  }

  const adjacency = new Map<string, Set<string>>();
  const availableFiles = new Set(files.keys());

  for (const [filePath, sourceFile] of files) {
    const dependencies = collectDependencies(sourceFile, availableFiles, importUsage);
    adjacency.set(filePath, dependencies);
  }

  return { files, adjacency, importUsage };
}

function shouldSkipFile(sourceFile: SourceFile): boolean {
  return sourceFile.isDeclarationFile() || sourceFile.isInNodeModules();
}

function collectDependencies(
  sourceFile: SourceFile,
  availableFiles: Set<string>,
  importUsage: Map<string, Set<string>>,
): Set<string> {
  const dependencies = new Set<string>();

  const addDependency = (targetPath: string | null | undefined) => {
    if (!targetPath) {
      return;
    }

    if (availableFiles.has(targetPath)) {
      dependencies.add(targetPath);
    }
  };

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const resolved = importDecl.getModuleSpecifierSourceFile();
    if (resolved) {
      const normalized = normalizePath(resolved.getFilePath());
      addDependency(normalized);
      recordImportUsage(normalized, importDecl, importUsage);
      continue;
    }

    const manual = resolveRelativeModule(
      sourceFile,
      importDecl.getModuleSpecifierValue(),
      availableFiles,
    );

    if (manual) {
      addDependency(manual);
      recordImportUsage(manual, importDecl, importUsage);
    }
  }

  for (const exportDecl of sourceFile.getExportDeclarations()) {
    const resolved = exportDecl.getModuleSpecifierSourceFile();
    if (resolved) {
      addDependency(normalizePath(resolved.getFilePath()));
      continue;
    }

    const specifier = exportDecl.getModuleSpecifier()?.getLiteralText();
    if (!specifier) {
      continue;
    }

    const manual = resolveRelativeModule(sourceFile, specifier, availableFiles);
    if (manual) {
      addDependency(manual);
    }
  }

  for (const statement of sourceFile.getStatements()) {
    const resolved = resolveDynamicDependencies(statement, sourceFile, availableFiles);
    for (const dependency of resolved) {
      dependencies.add(dependency);
    }
  }

  return dependencies;
}

const NAMESPACE_USAGE_KEY = '__namespace__';

function recordImportUsage(
  targetPath: string,
  importDecl: import('ts-morph').ImportDeclaration,
  usageMap: Map<string, Set<string>>,
): void {
  if (importDecl.isTypeOnly()) {
    return;
  }

  const bucket = usageMap.get(targetPath) ?? new Set<string>();
  let recorded = false;

  const namespaceImport = importDecl.getNamespaceImport();
  if (namespaceImport) {
    bucket.add(NAMESPACE_USAGE_KEY);
    recorded = true;
  }

  const defaultImport = importDecl.getDefaultImport();
  if (defaultImport) {
    bucket.add('default');
    recorded = true;
  }

  importDecl.getNamedImports().forEach((namedImport) => {
    bucket.add(namedImport.getName());
    recorded = true;
  });

  if (recorded) {
    usageMap.set(targetPath, bucket);
  }
}

function resolveDynamicDependencies(
  node: Node,
  sourceFile: SourceFile,
  availableFiles: Set<string>,
): Set<string> {
  const found = new Set<string>();

  node.forEachDescendant((descendant) => {
    if (Node.isCallExpression(descendant)) {
      const expression = descendant.getExpression();
      const [argument] = descendant.getArguments();

      if (!Node.isStringLiteral(argument)) {
        return;
      }

      const spec = argument.getLiteralValue();

      if (Node.isIdentifier(expression) && expression.getText() === 'require') {
        const resolved = resolveRelativeModule(sourceFile, spec, availableFiles);
        if (resolved) {
          found.add(resolved);
        }
      }

      if (expression.getKind() === SyntaxKind.ImportKeyword) {
        const resolved = resolveRelativeModule(sourceFile, spec, availableFiles);
        if (resolved) {
          found.add(resolved);
        }
      }

      return;
    }
  });

  return found;
}

function resolveRelativeModule(
  sourceFile: SourceFile,
  specifier: string,
  availableFiles: Set<string>,
): string | null {
  const candidates: string[] = [];

  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const baseDir = path.dirname(sourceFile.getFilePath());
    const absoluteBase = path.resolve(baseDir, specifier);

    if (path.extname(specifier)) {
      candidates.push(absoluteBase);
    } else {
      for (const ext of SUPPORTED_EXTENSIONS) {
        candidates.push(`${absoluteBase}${ext}`);
        candidates.push(`${absoluteBase}/index${ext}`);
      }
    }
  } else {
    candidates.push(...resolveAliasCandidates(specifier));
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const expanded = expandWithScriptFallback(candidate);
    for (const item of expanded) {
      const normalized = normalizePath(item);
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);

      if (availableFiles.has(normalized)) {
        return normalized;
      }
    }
  }

  const rendererUiResolution = resolveRendererUiModule(sourceFile, specifier, availableFiles);
  if (rendererUiResolution) {
    return rendererUiResolution;
  }

  return null;
}

function resolveAliasCandidates(specifier: string): string[] {
  const results: string[] = [];

  for (const [alias, targets] of PATH_ALIAS_MAP.entries()) {
    if (!specifier.startsWith(alias)) {
      continue;
    }

    const remainder = specifier.slice(alias.length);
    targets.forEach((target) => {
      results.push(path.resolve(target, remainder));
    });
  }

  return results;
}

function buildPathAliases(configPaths: string[]): Map<string, string[]> {
  const aliasMap = new Map<string, string[]>();

  for (const configPath of configPaths) {
    try {
      const raw = readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw) as {
        compilerOptions?: { paths?: Record<string, string | string[]> };
      };

      const pathsConfig = parsed.compilerOptions?.paths;
      if (!pathsConfig) {
        continue;
      }

      for (const [aliasKey, targetValues] of Object.entries(pathsConfig)) {
        const aliasPrefix = aliasKey.endsWith('*')
          ? aliasKey.slice(0, -1)
          : aliasKey;

        const targets = Array.isArray(targetValues)
          ? targetValues
          : [targetValues];

        const resolvedTargets = targets.map((targetPath) => {
          const normalizedTarget = targetPath.endsWith('*')
            ? targetPath.slice(0, -1)
            : targetPath;

          return normalizePath(
            path.resolve(path.dirname(configPath), normalizedTarget),
          );
        });

        const existing = aliasMap.get(aliasPrefix) ?? [];
        aliasMap.set(aliasPrefix, [...existing, ...resolvedTargets]);
      }
    } catch (error) {
      console.warn(
        `Failed to parse tsconfig for path aliases (${configPath}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return aliasMap;
}

function resolveRendererUiModule(
  sourceFile: SourceFile,
  specifier: string,
  availableFiles: Set<string>,
): string | null {
  if (!specifier.startsWith('./ui/') && !specifier.startsWith('../ui/')) {
    return null;
  }

  const importerPath = normalizePath(sourceFile.getFilePath());
  if (!importerPath.includes('/src/preload/') && !importerPath.includes('/src/shared/')) {
    return null;
  }

  const withoutPrefix = specifier.replace(/^\.\.?\/ui\//, '');
  const rendererBase = path.resolve(PROJECT_ROOT, 'src/renderer/src/ui', withoutPrefix);
  const normalizedBase = normalizePath(rendererBase);
  const fallbackCandidates: string[] = [];

  if (path.extname(normalizedBase)) {
    fallbackCandidates.push(normalizedBase);
  } else {
    for (const ext of SUPPORTED_EXTENSIONS) {
      fallbackCandidates.push(`${normalizedBase}${ext}`);
      fallbackCandidates.push(`${normalizedBase}/index${ext}`);
    }
  }

  for (const candidate of fallbackCandidates) {
    const expanded = expandWithScriptFallback(candidate);
    for (const item of expanded) {
      const normalized = normalizePath(item);
      if (availableFiles.has(normalized)) {
        return normalized;
      }
    }
  }

  return null;
}

function expandWithScriptFallback(filePath: string): string[] {
  const normalized = normalizePath(filePath);
  const results = [normalized];
  const ext = path.extname(normalized);

  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    const withoutExt = normalized.slice(0, -ext.length);
    for (const tsExt of ['.ts', '.tsx', '.mts', '.cts']) {
      results.push(`${withoutExt}${tsExt}`);
    }
  }

  return results;
}

function evaluateReachability(graph: Graph, entrypointPaths: string[]): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [];

  for (const entrypoint of entrypointPaths) {
    if (graph.files.has(entrypoint)) {
      queue.push(entrypoint);
    } else {
      console.warn(`Entry point not part of TypeScript project: ${relativeToRoot(entrypoint)}`);
    }
  }

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current || reachable.has(current)) {
      continue;
    }

    reachable.add(current);
    const neighbors = graph.adjacency.get(current);
    if (!neighbors) {
      continue;
    }

    for (const neighbor of neighbors) {
      if (!reachable.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return reachable;
}

function findUnusedFiles(graph: Graph, reachable: Set<string>): UnusedFile[] {
  const unused: UnusedFile[] = [];

  for (const filePath of graph.files.keys()) {
    if (!reachable.has(filePath)) {
      unused.push({
        file: filePath,
        reason: 'unreachable from discovered entrypoints',
      });
    }
  }

  return unused.sort((a, b) => a.file.localeCompare(b.file));
}

function findUnusedExports(
  graph: Graph,
  reachable: Set<string>,
  unusedFileSet: Set<string>,
): UnusedExport[] {
  const unused: UnusedExport[] = [];

  for (const filePath of reachable) {
    if (unusedFileSet.has(filePath)) {
      continue;
    }

    const sourceFile = graph.files.get(filePath);
    if (!sourceFile) {
      continue;
    }

    const usageSet = graph.importUsage.get(filePath);

    if (usageSet && usageSet.has(NAMESPACE_USAGE_KEY)) {
      continue;
    }

    const exportedDeclarations = sourceFile.getExportedDeclarations();
    for (const [exportName, declarations] of exportedDeclarations.entries()) {
      const runtimeDeclarations = declarations.filter((declaration) =>
        isRuntimeDeclaration(declaration),
      );

      if (runtimeDeclarations.length === 0) {
        continue;
      }

      if (usageSet && usageSet.has(exportName)) {
        continue;
      }

      if (exportName === 'default' && usageSet && usageSet.has('default')) {
        continue;
      }

      let used = false;
      for (const declaration of runtimeDeclarations) {
        if (isDeclarationReferenced(declaration)) {
          used = true;
          break;
        }
      }

      if (!used) {
        const kindName = runtimeDeclarations[0].getKindName();
        unused.push({
          file: filePath,
          exportName,
          kind: kindName,
        });
      }
    }
  }

  return unused.sort((a, b) =>
    a.file === b.file ? a.exportName.localeCompare(b.exportName) : a.file.localeCompare(b.file),
  );
}

function isRuntimeDeclaration(declaration: Node): boolean {
  return (
    Node.isClassDeclaration(declaration) ||
    Node.isFunctionDeclaration(declaration) ||
    Node.isVariableDeclaration(declaration) ||
    Node.isEnumDeclaration(declaration)
  );
}

function isDeclarationReferenced(declaration: Node): boolean {
  const references = declaration.findReferences();

  for (const reference of references) {
    for (const refEntry of reference.getReferences()) {
      if (refEntry.isDefinition()) {
        continue;
      }

      return true;
    }
  }

  return false;
}

function printResult(result: AnalysisResult): void {
  console.log('Entrypoints discovered:');
  for (const entry of result.entrypoints) {
    console.log(
      `  - ${relativeToRoot(entry.path)} (${entry.reasons.join(', ')})`,
    );
  }

  console.log('');
  console.log(`Unused files: ${result.unusedFiles.length}`);
  for (const unused of result.unusedFiles) {
    console.log(`  • ${relativeToRoot(unused.file)} - ${unused.reason}`);
  }

  console.log('');
  console.log(`Unused exports: ${result.unusedExports.length}`);
  for (const unused of result.unusedExports) {
    console.log(
      `  • ${relativeToRoot(unused.file)} :: ${unused.exportName} (${unused.kind})`,
    );
  }
}

function normalizePath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/');
}

function relativeToRoot(filePath: string): string {
  return path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
}
