#!/usr/bin/env node
/**
 * @fileoverview Finds console.<level> statements in source files.
 */

import { promises as fs } from 'fs';
import path from 'path';

interface ConsoleMatch {
  file: string;
  line: number;
  content: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const DEFAULT_LEVEL = 'log';
const VALID_LEVELS = new Set(['log', 'debug', 'info', 'warn', 'error']);

function parseLevelArg(argv: string[]): string {
  for (const arg of argv) {
    if (arg.startsWith('--level=')) {
      const value = arg.split('=')[1];
      if (VALID_LEVELS.has(value)) {
        return value;
      }
      console.warn(`Unknown level "${value}", falling back to ${DEFAULT_LEVEL}.`);
      break;
    }
  }
  return DEFAULT_LEVEL;
}

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(fullPath));
    } else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function findConsoleUsage(filePath: string, content: string, level: string, projectRoot: string): ConsoleMatch[] {
  const lines = content.split(/\r?\n/);
  const target = `console.${level}`;
  const matches: ConsoleMatch[] = [];

  lines.forEach((line, index) => {
    if (line.includes(target)) {
      matches.push({
        file: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
        line: index + 1,
        content: line.trim()
      });
    }
  });

  return matches;
}

async function main(): Promise<void> {
  const level = parseLevelArg(process.argv.slice(2));
  const projectRoot = process.cwd();
  const srcDir = path.join(projectRoot, 'src');

  const stat = await fs.stat(srcDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    console.error(`Directory not found: ${srcDir}`);
    process.exit(1);
    return;
  }

  const files = await collectSourceFiles(srcDir);
  const allMatches: ConsoleMatch[] = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf-8');
    allMatches.push(...findConsoleUsage(filePath, content, level, projectRoot));
  }

  if (allMatches.length === 0) {
    console.log(`No console.${level} statements found!`);
    return;
  }

  const grouped = new Map<string, ConsoleMatch[]>();
  for (const match of allMatches) {
    if (!grouped.has(match.file)) {
      grouped.set(match.file, []);
    }
    grouped.get(match.file)?.push(match);
  }

  console.log(`console.${level} usage:`);
  const sortedFiles = Array.from(grouped.keys()).sort();
  for (const file of sortedFiles) {
    console.log(`\n${file}`);
    const entries = grouped.get(file)!.sort((a, b) => a.line - b.line);
    for (const entry of entries) {
      console.log(`  ${entry.content} (line ${entry.line})`);
    }
  }

  console.log(`\nTotal: ${allMatches.length} console.${level} statements in ${grouped.size} files`);
}

main().catch((error) => {
  console.error('Error finding console usage:', error);
  process.exit(1);
});
