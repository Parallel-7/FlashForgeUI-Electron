#!/usr/bin/env node
/**
 * @fileoverview Scans source files for eslint-disable directives (TypeScript replacement for scan_eslint_disable.ps1).
 */

import { promises as fs } from 'fs';
import path from 'path';

interface DisableRule {
  file: string;
  line: number;
  content: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

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

function findDisableRules(filePath: string, content: string, projectRoot: string): DisableRule[] {
  const lines = content.split(/\r?\n/);
  const matches: DisableRule[] = [];

  lines.forEach((line, index) => {
    if (line.includes('eslint-disable')) {
      matches.push({
        file: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
        line: index + 1,
        content: line.trim()
      });
    }
  });

  return matches;
}

function printTable(entries: DisableRule[]): void {
  const sorted = entries.sort((a, b) => {
    if (a.file === b.file) {
      return a.line - b.line;
    }
    return a.file.localeCompare(b.file);
  });

  const fileWidth = Math.max('File'.length, ...sorted.map((e) => e.file.length));
  const lineWidth = Math.max('Line'.length, ...sorted.map((e) => e.line.toString().length));

  console.log(`${'File'.padEnd(fileWidth)}  ${'Line'.padStart(lineWidth)}  Content`);
  console.log(`${'-'.repeat(fileWidth)}  ${'-'.repeat(lineWidth)}  -------`);

  for (const entry of sorted) {
    console.log(`${entry.file.padEnd(fileWidth)}  ${entry.line.toString().padStart(lineWidth)}  ${entry.content}`);
  }
}

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const srcDir = path.join(projectRoot, 'src');

  const stat = await fs.stat(srcDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    console.error(`Directory not found: ${srcDir}`);
    process.exit(1);
    return;
  }

  const files = await collectSourceFiles(srcDir);
  const allEntries: DisableRule[] = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    allEntries.push(...findDisableRules(file, content, projectRoot));
  }

  if (allEntries.length === 0) {
    console.log('No eslint-disable rules found!');
    return;
  }

  console.log('Found eslint-disable rules:');
  printTable(allEntries);
  const uniqueFiles = new Set(allEntries.map((entry) => entry.file)).size;
  console.log(`Total: ${allEntries.length} rules in ${uniqueFiles} files`);
}

main().catch((error) => {
  console.error('Error scanning for eslint-disable directives:', error);
  process.exit(1);
});
