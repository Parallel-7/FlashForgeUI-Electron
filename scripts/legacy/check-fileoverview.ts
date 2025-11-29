#!/usr/bin/env node
/**
 * @fileoverview Cross-platform replacement for scripts/check_fileoverview.ps1.
 * Scans source files for an @fileoverview docblock and reports any missing headers.
 */

import { promises as fs } from 'fs';
import path from 'path';

interface MissingFile {
  file: string;
  firstLine: string;
}

const DEFAULT_CHECK_LINES = 20;
const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function parseArgs(argv: string[]): { checkLines: number; debug: boolean } {
  let checkLines = DEFAULT_CHECK_LINES;
  let debug = false;

  argv.forEach((arg) => {
    if (arg.startsWith('--lines=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isNaN(value) && value > 0) {
        checkLines = value;
      }
    } else if (arg === '--debug') {
      debug = true;
    }
  });

  return { checkLines, debug };
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

    const extension = path.extname(entry.name);
    if (SUPPORTED_EXTENSIONS.has(extension)) {
      files.push(fullPath);
    }
  }

  return files;
}

function buildPatternList(): RegExp[] {
  return [
    /@fileoverview/i,
    /@\s*fileoverview/i,
    /\*\s*@fileoverview/i,
    /\/\/\s*@fileoverview/i
  ];
}

async function hasFileOverview(filePath: string, linesToCheck: number): Promise<{ found: boolean; firstLine: string }>
{
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).slice(0, linesToCheck);
  const firstLine = lines.length > 0 ? lines[0].trim() : '(empty file)';
  const snippet = lines.join('\n');
  const patterns = buildPatternList();

  const found = patterns.some((pattern) => pattern.test(snippet));
  return { found, firstLine };
}

async function main(): Promise<void> {
  const { checkLines, debug } = parseArgs(process.argv.slice(2));
  const projectRoot = process.cwd();
  const srcDir = path.join(projectRoot, 'src');

  const stats = await fs.stat(srcDir).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    console.error(`Directory not found: ${srcDir}`);
    process.exit(1);
    return;
  }

  const files = await collectSourceFiles(srcDir);
  const missingFiles: MissingFile[] = [];

  for (const filePath of files) {
    const { found, firstLine } = await hasFileOverview(filePath, checkLines);
    if (found) {
      if (debug) {
        console.log(`Found @fileoverview in: ${path.relative(projectRoot, filePath)}`);
      }
      continue;
    }

    missingFiles.push({
      file: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
      firstLine
    });
  }

  if (missingFiles.length === 0) {
    console.log('✅ All source files have @fileoverview documentation!');
    return;
  }

  console.log('📄 Files missing @fileoverview documentation:');
  const sorted = missingFiles.sort((a, b) => a.file.localeCompare(b.file));
  const maxFileLength = Math.max(...sorted.map(({ file }) => file.length), 'File'.length);

  console.log(`${'File'.padEnd(maxFileLength)}  First line`);
  console.log(`${'-'.repeat(maxFileLength)}  ----------`);
  for (const { file, firstLine } of sorted) {
    console.log(`${file.padEnd(maxFileLength)}  ${firstLine}`);
  }

  console.log(`Found ${sorted.length} files missing @fileoverview documentation.`);
}

main().catch((error) => {
  console.error('Error checking fileoverviews:', error);
  process.exit(1);
});
