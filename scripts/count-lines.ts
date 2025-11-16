/**
 * @fileoverview Cross-platform TypeScript script that mirrors scripts/count_lines.ps1.
 *
 * Recursively scans the src directory for .ts files, counts lines for each file,
 * sorts them descending, and prints a table to stdout. Designed to replace the
 * PowerShell-only version so both WSL-based agents and Windows devs can run the
 * same npm script via Node + ts-node.
 */

import { promises as fs } from 'fs';
import path from 'path';

async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectTsFiles(fullPath));
    } else if (entry.isFile() && fullPath.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function countLines(filePath: string): Promise<number> {
  const content = await fs.readFile(filePath, 'utf-8');
  return content.split(/\r?\n/).length;
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

  const tsFiles = await collectTsFiles(srcDir);
  const counts = await Promise.all(tsFiles.map(async (filePath) => {
    const lines = await countLines(filePath);
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
    return { file: relativePath, lines };
  }));

  counts.sort((a, b) => b.lines - a.lines);

  const maxFileLength = Math.max(...counts.map(({ file }) => file.length), 'File'.length);
  const maxLinesLength = Math.max(...counts.map(({ lines }) => lines.toString().length), 'Lines'.length);

  process.stdout.write(`${'File'.padEnd(maxFileLength)}  ${'Lines'.padStart(maxLinesLength)}\n`);
  process.stdout.write(`${'-'.repeat(maxFileLength)}  ${'-'.repeat(maxLinesLength)}\n`);

  for (const { file, lines } of counts) {
    process.stdout.write(`${file.padEnd(maxFileLength)}  ${lines.toString().padStart(maxLinesLength)}\n`);
  }
}

main().catch((error) => {
  console.error('Error counting lines:', error);
  process.exit(1);
});
