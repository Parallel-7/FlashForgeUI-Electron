/**
 * @fileoverview Fixes relative module specifiers to include ESM-friendly file extensions.
 *
 * Traverses every source file referenced by the root tsconfig and rewrites any relative
 * import/export specifier (including dynamic imports and import type expressions) to use
 * explicit file extensions that NodeNext/ESM resolution requires. The script relies on
 * TypeScript's own module resolver so each specifier points at the emitted runtime file
 * (.js/.mjs) or the declaration (.d.ts) when the import is type-only.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { fileURLToPath } from 'url';

interface Replacement {
  start: number;
  end: number;
  text: string;
}

type StringLiteralLike = ts.StringLiteralLike | ts.NoSubstitutionTemplateLiteral;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const moduleResolutionHost: ts.ModuleResolutionHost = {
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  realpath: ts.sys.realpath,
  directoryExists: ts.sys.directoryExists,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getDirectories: ts.sys.getDirectories,
};

const args = process.argv.slice(2);
const configTargets = args.length > 0 ? args : ['tsconfig.json'];

let totalUpdated = 0;

for (const target of configTargets) {
  const tsconfigPath = path.isAbsolute(target) ? target : path.join(projectRoot, target);
  if (!fs.existsSync(tsconfigPath)) {
    console.warn(`[fix-module-specifiers] Skipping missing config: ${tsconfigPath}`);
    continue;
  }
  totalUpdated += runForConfig(tsconfigPath);
}

console.log(totalUpdated > 0 ? `Updated ${totalUpdated} files across ${configTargets.length} config(s)` : 'All module specifiers already have explicit extensions.');

function runForConfig(tsconfigPath: string): number {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    const message = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n');
    console.error(`[fix-module-specifiers] Failed to read ${tsconfigPath}: ${message}`);
    return 0;
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigPath),
    undefined,
    tsconfigPath,
  );
  const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
  let updatedFiles = 0;

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (!sourceFile.fileName.startsWith(projectRoot)) continue;

    const replacements = collectReplacements(sourceFile, parsedConfig);
    if (replacements.length === 0) continue;

    applyReplacements(sourceFile.fileName, sourceFile.getFullText(), replacements);
    updatedFiles += 1;
  }

  if (updatedFiles > 0) {
    console.log(`[fix-module-specifiers] ${path.relative(projectRoot, tsconfigPath)}: updated ${updatedFiles} file(s)`);
  }

  return updatedFiles;
}

function collectReplacements(sourceFile: ts.SourceFile, parsedConfig: ts.ParsedCommandLine): Replacement[] {
  const replacements: Replacement[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (specifier && ts.isStringLiteralLike(specifier)) {
        maybeQueueReplacement(sourceFile, specifier, replacements, parsedConfig);
      }
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteralLike(argument)) {
        maybeQueueReplacement(sourceFile, argument, replacements, parsedConfig);
      }
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      if (ts.isLiteralTypeNode(argument) && ts.isStringLiteralLike(argument.literal)) {
        maybeQueueReplacement(sourceFile, argument.literal, replacements, parsedConfig);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return replacements.sort((a, b) => a.start - b.start);
}

function maybeQueueReplacement(
  sourceFile: ts.SourceFile,
  literal: StringLiteralLike,
  replacements: Replacement[],
  parsedConfig: ts.ParsedCommandLine,
): void {
  const specifierText = literal.text;
  if (!specifierText.startsWith('./') && !specifierText.startsWith('../')) {
    return;
  }

  const resolved = ts.resolveModuleName(specifierText, sourceFile.fileName, parsedConfig.options, moduleResolutionHost);
  const resolvedModule = resolved.resolvedModule;
  if (resolvedModule == null) {
    return;
  }

  const desiredSpecifier = computeDesiredSpecifier(sourceFile.fileName, resolvedModule.resolvedFileName);
  if (desiredSpecifier == null || desiredSpecifier === specifierText) {
    return;
  }

  const literalText = literal.getText(sourceFile);
  const quote = literalText.startsWith('`')
    ? '`'
    : literalText.startsWith('"')
      ? '"'
      : '\'';
  replacements.push({
    start: literal.getStart(sourceFile),
    end: literal.getEnd(),
    text: `${quote}${desiredSpecifier}${quote}`,
  });
}

function computeDesiredSpecifier(containingFile: string, resolvedFileName: string): string | null {
  const originalExtension = getOriginalExtension(resolvedFileName);
  const runtimeExtension = getRuntimeExtension(originalExtension);
  if (runtimeExtension == null) {
    return null;
  }

  const targetPath =
    runtimeExtension === originalExtension
      ? resolvedFileName
      : resolvedFileName.slice(0, resolvedFileName.length - originalExtension.length) + runtimeExtension;

  let relativePath = path.relative(path.dirname(containingFile), targetPath).replace(/\\/g, '/');
  if (!relativePath.startsWith('.')) {
    relativePath = `./${relativePath}`;
  }
  return relativePath;
}

function getOriginalExtension(fileName: string): string {
  if (fileName.endsWith('.d.ts')) return '.d.ts';
  if (fileName.endsWith('.d.mts')) return '.d.mts';
  if (fileName.endsWith('.d.cts')) return '.d.cts';
  return path.extname(fileName);
}

function getRuntimeExtension(extension: string): string | null {
  switch (extension) {
    case '.ts':
    case '.tsx':
    case '.cts':
    case '.js':
    case '.jsx':
    case '.cjs':
      return '.js';
    case '.mts':
    case '.mjs':
      return '.mjs';
    case '.json':
    case '.css':
    case '.node':
    case '.d.ts':
    case '.d.mts':
    case '.d.cts':
      return extension;
    default:
      return extension.length > 0 ? extension : '.js';
  }
}

function applyReplacements(fileName: string, originalText: string, replacements: Replacement[]): void {
  let cursor = 0;
  let updated = '';

  for (const replacement of replacements) {
    updated += originalText.slice(cursor, replacement.start);
    updated += replacement.text;
    cursor = replacement.end;
  }

  updated += originalText.slice(cursor);
  fs.writeFileSync(fileName, updated);
}
