#!/usr/bin/env node
/**
 * @fileoverview Finds console.log statements in source files (TypeScript replacement for find_console_logs.ps1).
 */

import { promises as fs } from 'fs';
import path from 'path';

interface ConsoleLogMatch {
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

function findConsoleLogs(filePath: string, content: string, projectRoot: string): ConsoleLogMatch[] {
  const matches: ConsoleLogMatch[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((lineText, index) => {
    if (lineText.includes('console.log')) {
      matches.push({
        file: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
        line: index + 1,
        content: lineText.trim()
      });
    }
  });

  return matches;
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
  const allMatches: ConsoleLogMatch[] = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf-8');
    allMatches.push(...findConsoleLogs(filePath, content, projectRoot));
  }

  if (allMatches.length === 0) {
    console.log('No console.log statements found!');
    return;
  }

  const grouped = new Map<string, ConsoleLogMatch[]>();
  for (const match of allMatches) {
    if (!grouped.has(match.file)) {
      grouped.set(match.file, []);
    }
    grouped.get(match.file)?.push(match);
  }

  const sortedFiles = Array.from(grouped.keys()).sort();
  for (const file of sortedFiles) {
    console.log(`\n${file}`);
    const entries = grouped.get(file)!.sort((a, b) => a.line - b.line);
    for (const entry of entries) {
      console.log(`  ${entry.content} (line ${entry.line})`);
    }
  }

  const uniqueFiles = grouped.size;
  console.log(`\nTotal: ${allMatches.length} console.log statements in ${uniqueFiles} files`);
}

main().catch((error) => {
  console.error('Error finding console.log statements:', error);
  process.exit(1);
});
