#!/usr/bin/env node
/**
 * @fileoverview Lists source files that reference Lucide icons.
 */

import { promises as fs } from 'fs';
import path from 'path';

interface LucideMatch {
  file: string;
  line: number;
  content: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const MATCH_TOKEN = 'lucide';

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

function findLucideMatches(filePath: string, content: string, projectRoot: string): LucideMatch[] {
  const lines = content.split(/\r?\n/);
  const matches: LucideMatch[] = [];

  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(MATCH_TOKEN)) {
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
  const projectRoot = process.cwd();
  const srcDir = path.join(projectRoot, 'src');

  const stat = await fs.stat(srcDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    console.error(`Directory not found: ${srcDir}`);
    process.exit(1);
    return;
  }

  const files = await collectSourceFiles(srcDir);
  const allMatches: LucideMatch[] = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    allMatches.push(...findLucideMatches(file, content, projectRoot));
  }

  if (allMatches.length === 0) {
    console.log('No Lucide references found.');
    return;
  }

  const grouped = new Map<string, LucideMatch[]>();
  for (const match of allMatches) {
    if (!grouped.has(match.file)) {
      grouped.set(match.file, []);
    }
    grouped.get(match.file)?.push(match);
  }

  console.log('Lucide icon references:');
  const sortedFiles = Array.from(grouped.keys()).sort();
  for (const file of sortedFiles) {
    console.log(`\n${file}`);
    const entries = grouped.get(file)!.sort((a, b) => a.line - b.line);
    for (const entry of entries) {
      console.log(`  ${entry.content} (line ${entry.line})`);
    }
  }

  console.log(`\nTotal: ${grouped.size} files with Lucide references (${allMatches.length} matches).`);
}

main().catch((error) => {
  console.error('Error scanning for Lucide references:', error);
  process.exit(1);
});
