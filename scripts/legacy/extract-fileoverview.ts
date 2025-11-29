#!/usr/bin/env node
/**
 * @fileoverview Extracts @fileoverview blocks from source files and writes a Markdown report.
 *
 * This replaces the PowerShell-only extract_fileoverview.ps1 so both Windows and WSL users
 * can generate the same fileoverview summary (`fileoverview-report.md`).
 */

import { promises as fs } from 'fs';
import path from 'path';

interface FileOverviewEntry {
  file: string;
  overview: string;
}

const DEFAULT_OUTPUT = 'fileoverview-report.md';
const DEFAULT_LINES = 50;
const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

interface ScriptOptions {
  output: string;
  checkLines: number;
  debug: boolean;
}

function parseArgs(argv: string[]): ScriptOptions {
  let output = DEFAULT_OUTPUT;
  let checkLines = DEFAULT_LINES;
  let debug = false;

  for (const arg of argv) {
    if (arg.startsWith('--output=')) {
      const value = arg.split('=')[1];
      if (value) {
        output = value;
      }
    } else if (arg.startsWith('--lines=')) {
      const parsed = Number(arg.split('=')[1]);
      if (!Number.isNaN(parsed) && parsed > 0) {
        checkLines = parsed;
      }
    } else if (arg === '--debug') {
      debug = true;
    }
  }

  return { output, checkLines, debug };
}

async function collectSourceFiles(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractOverviewBlock(snippet: string): string | null {
  const blockMatch = snippet.match(/\/\*\*[\s\S]*?@fileoverview([\s\S]*?)\*\//i);
  if (!blockMatch) {
    return null;
  }

  const raw = blockMatch[1];
  const lines = raw.split(/\r?\n/).map((line) => line.replace(/^\s*\*\s?/, ''));
  const cleaned = lines.join('\n').trim();

  return cleaned.length > 0 ? cleaned : null;
}

async function buildReportEntries(files: string[], checkLines: number, debug: boolean, projectRoot: string): Promise<FileOverviewEntry[]>
{
  const entries: FileOverviewEntry[] = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf-8');
    const snippet = content.split(/\r?\n/).slice(0, checkLines).join('\n');
    const overview = extractOverviewBlock(snippet);

    if (overview) {
      const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
      if (debug) {
        console.log(`Found @fileoverview in: ${relativePath}`);
      }
      entries.push({ file: relativePath, overview });
    }
  }

  return entries;
}

function buildMarkdown(entries: FileOverviewEntry[], totalFiles: number): string {
  const lines: string[] = [];
  lines.push('# Fileoverview Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total files scanned: ${totalFiles}`);
  lines.push(`Files with @fileoverview: ${entries.length}`);
  lines.push('');

  const sorted = entries.sort((a, b) => a.file.localeCompare(b.file));
  for (const { file, overview } of sorted) {
    lines.push(`## ${file}`);
    lines.push('');
    lines.push(overview);
    lines.push('');
  }

  if (sorted.length === 0) {
    lines.push('_No @fileoverview blocks were found._');
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const projectRoot = process.cwd();
  const srcDir = path.join(projectRoot, 'src');

  const stats = await fs.stat(srcDir).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    console.error(`Directory not found: ${srcDir}`);
    process.exit(1);
    return;
  }

  const files = await collectSourceFiles(srcDir);
  const entries = await buildReportEntries(files, options.checkLines, options.debug, projectRoot);
  const markdown = buildMarkdown(entries, files.length);

  await fs.writeFile(path.join(projectRoot, options.output), markdown, 'utf-8');
  console.log(`✅ Extracted ${entries.length} @fileoverview blocks to ${options.output}`);
}

main().catch((error) => {
  console.error('Error extracting fileoverviews:', error);
  process.exit(1);
});
