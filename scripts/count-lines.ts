/**
 * @fileoverview Cross-platform TypeScript script for counting lines in .ts files.
 *
 * Recursively scans the src directory for .ts files, counts lines for each file,
 * sorts them descending, and prints a table to stdout. Supports optional
 * --min-lines argument to filter output (e.g., --min-lines=50 shows only files
 * with 50+ lines). Designed to work cross-platform via tsx/ts-node.
 */

import { promises as fs } from 'fs';
import path from 'path';

interface ParsedArgs {
  minLines: number;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let minLines = 0; // Default: show all files

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    // Format: --min-lines 50
    if (arg === '--min-lines' && args[i + 1]) {
      const value = parseInt(args[i + 1], 10);
      if (!isNaN(value) && value >= 0) {
        minLines = value;
      } else {
        console.error(`Invalid value for --min-lines: ${args[i + 1]}`);
        process.exit(1);
      }
      i += 1;
      continue;
    }

    // Format: --min-lines=50
    if (arg.startsWith('--min-lines=')) {
      const value = parseInt(arg.split('=')[1], 10);
      if (!isNaN(value) && value >= 0) {
        minLines = value;
      } else {
        console.error(`Invalid value for --min-lines: ${arg.split('=')[1]}`);
        process.exit(1);
      }
      continue;
    }

    // Unknown argument
    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }

  return { minLines };
}

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
  const { minLines } = parseArgs();
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

  // Apply filter
  const filtered = counts.filter(({ lines }) => lines >= minLines);

  // Show filter info if active
  if (minLines > 0) {
    process.stdout.write(`Showing files with ${minLines}+ lines (${filtered.length} of ${counts.length} total)\n\n`);
  }

  const maxFileLength = Math.max(...filtered.map(({ file }) => file.length), 'File'.length);
  const maxLinesLength = Math.max(...filtered.map(({ lines }) => lines.toString().length), 'Lines'.length);

  process.stdout.write(`${'File'.padEnd(maxFileLength)}  ${'Lines'.padStart(maxLinesLength)}\n`);
  process.stdout.write(`${'-'.repeat(maxFileLength)}  ${'-'.repeat(maxLinesLength)}\n`);

  for (const { file, lines } of filtered) {
    process.stdout.write(`${file.padEnd(maxFileLength)}  ${lines.toString().padStart(maxLinesLength)}\n`);
  }
}

main().catch((error) => {
  console.error('Error counting lines:', error);
  process.exit(1);
});
