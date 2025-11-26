#!/usr/bin/env node
/**
 * @fileoverview Reports window.* usages with contextual snippets across the repo.
 *
 * Recursively scans source directories (default: src) for JavaScript/TypeScript files,
 * finds lines referencing `window.`/`window?.`/`window[` patterns, and prints the file path,
 * line number, and a configurable amount of surrounding code for each match.
 */

import { promises as fs } from 'fs';
import path from 'path';

interface CliOptions {
  context: number;
  roots: string[];
  pattern: RegExp | null;
}

interface WindowUsageMatch {
  line: number;
  snippet: string[];
  identifiers: string[];
}

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.cts',
  '.mts',
  '.cjs',
  '.mjs'
]);

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'out',
  'build',
  'coverage',
  '.git',
  '.idea',
  '.vscode',
  'lib',
  'debug_logs'
]);

const WINDOW_PROPERTY_REGEX = /\bwindow\s*(?:\?\.|\.)[A-Za-z_$]/;
const WINDOW_BRACKET_REGEX = /\bwindow\s*\[/;
const WINDOW_PROPERTY_CAPTURE_REGEX = /\bwindow\s*(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)/g;
const WINDOW_BRACKET_CAPTURE_REGEX = /\bwindow\s*\[\s*['"]([^'"]+)['"]\s*\]/g;

function isCommentOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return true;
  }
  return trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*/');
}

function parseCliOptions(argv: string[]): CliOptions {
  let context = 2;
  const roots: string[] = [];
  let pattern: RegExp | null = null;

  for (const arg of argv) {
    if (arg.startsWith('--context=')) {
      const value = Number.parseInt(arg.split('=')[1] ?? '', 10);
      if (!Number.isNaN(value) && value >= 0) {
        context = value;
      }
      continue;
    }

    if (arg.startsWith('--root=')) {
      const value = arg.split('=')[1];
      if (value) {
        value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
          .forEach((entry) => roots.push(entry));
      }
      continue;
    }

    if (arg.startsWith('--pattern=')) {
      const value = arg.split('=')[1];
      if (value) {
        try {
          pattern = new RegExp(value, 'i');
        } catch (error) {
          console.warn(`Invalid pattern "${value}":`, error);
        }
      }
    }
  }

  if (roots.length === 0) {
    roots.push('src');
  }

  return { context, roots, pattern };
}

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      files.push(...await collectSourceFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (SUPPORTED_EXTENSIONS.has(extension)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function gatherFiles(roots: string[], projectRoot: string): Promise<string[]> {
  const files = new Set<string>();

  for (const root of roots) {
    const absoluteRoot = path.resolve(projectRoot, root);
    const stat = await fs.stat(absoluteRoot).catch(() => null);

    if (!stat) {
      console.warn(`Skipping missing path: ${root}`);
      continue;
    }

    if (stat.isDirectory()) {
      const rootFiles = await collectSourceFiles(absoluteRoot);
      rootFiles.forEach((file) => files.add(file));
      continue;
    }

    if (stat.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(absoluteRoot).toLowerCase())) {
      files.add(absoluteRoot);
    }
  }

  return Array.from(files);
}

function createSnippet(lines: string[], index: number, context: number): string[] {
  const start = Math.max(0, index - context);
  const end = Math.min(lines.length - 1, index + context);
  const lineNumberWidth = (end + 1).toString().length;
  const snippet: string[] = [];

  for (let lineIndex = start; lineIndex <= end; lineIndex += 1) {
    const prefix = lineIndex === index ? '>' : ' ';
    const lineNumber = (lineIndex + 1).toString().padStart(lineNumberWidth, ' ');
    snippet.push(`${prefix} ${lineNumber} | ${lines[lineIndex]}`);
  }

  return snippet;
}

function extractIdentifiers(line: string): string[] {
  const identifiers = new Set<string>();

  WINDOW_PROPERTY_CAPTURE_REGEX.lastIndex = 0;
  WINDOW_BRACKET_CAPTURE_REGEX.lastIndex = 0;

  let propertyMatch: RegExpExecArray | null;
  let bracketMatch: RegExpExecArray | null;

  while ((propertyMatch = WINDOW_PROPERTY_CAPTURE_REGEX.exec(line)) !== null) {
    const identifier = propertyMatch[1]?.trim();
    if (identifier) {
      identifiers.add(identifier);
    }
  }

  while ((bracketMatch = WINDOW_BRACKET_CAPTURE_REGEX.exec(line)) !== null) {
    const identifier = bracketMatch[1]?.trim();
    if (identifier) {
      identifiers.add(identifier);
    }
  }

  return Array.from(identifiers);
}

function collectWindowUsage(content: string, context: number, pattern: RegExp | null): WindowUsageMatch[] {
  const lines = content.split(/\r?\n/);
  const matches: WindowUsageMatch[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isCommentOnlyLine(line)) {
      continue;
    }
    if (!WINDOW_PROPERTY_REGEX.test(line) && !WINDOW_BRACKET_REGEX.test(line)) {
      continue;
    }
    if (pattern && !pattern.test(line)) {
      continue;
    }

    matches.push({
      line: index + 1,
      snippet: createSnippet(lines, index, context),
      identifiers: extractIdentifiers(line)
    });
  }

  return matches;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const projectRoot = process.cwd();
  const allFiles = await gatherFiles(options.roots, projectRoot);

  if (allFiles.length === 0) {
    console.log('No files found to scan.');
    return;
  }

  const matchesByFile = new Map<string, WindowUsageMatch[]>();
  const identifierCounts = new Map<string, number>();

  for (const filePath of allFiles) {
    const content = await fs.readFile(filePath, 'utf-8');
    const matches = collectWindowUsage(content, options.context, options.pattern);
    if (matches.length === 0) {
      continue;
    }
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
    matchesByFile.set(relativePath, matches);

    for (const match of matches) {
      for (const identifier of match.identifiers) {
        identifierCounts.set(identifier, (identifierCounts.get(identifier) ?? 0) + 1);
      }
    }
  }

  if (matchesByFile.size === 0) {
    console.log('No window usages found.');
    return;
  }

  console.log(`Scanning complete. Displaying window usages with ±${options.context} lines of context.`);
  const sortedFiles = Array.from(matchesByFile.keys()).sort();

  let totalMatches = 0;
  for (const file of sortedFiles) {
    const matches = matchesByFile.get(file)!;
    totalMatches += matches.length;
    console.log(`\n${file}`);
    for (const match of matches) {
      console.log(`  Line ${match.line}`);
      match.snippet.forEach((line) => {
        console.log(`  ${line}`);
      });
      console.log('');
    }
  }

  console.log(`Found ${totalMatches} window usages across ${matchesByFile.size} files.`);

  if (identifierCounts.size > 0) {
    console.log('\nTop window identifiers:');
    const sortedIdentifiers = Array.from(identifierCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    const limit = Math.min(sortedIdentifiers.length, 20);
    for (let index = 0; index < limit; index += 1) {
      const [identifier, count] = sortedIdentifiers[index]!;
      console.log(`  ${identifier.padEnd(20, ' ')} ${count}`);
    }
  }
}

main().catch((error) => {
  console.error('Error scanning for window usage:', error);
  process.exit(1);
});
