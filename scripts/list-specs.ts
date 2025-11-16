/**
 * @fileoverview Lists AI spec files for LLM agents with filters for active or completed specs.
 *
 * The script scans the ai_specs directory (active) or ai_specs/archive (completed),
 * and prints a simple bullet list of Markdown files so LLMs can quickly discover specs.
 */

import { promises as fs } from 'fs';
import path from 'path';

type SpecMode = 'active' | 'completed';

interface ParsedArgs {
  mode: SpecMode;
}

const PROJECT_ROOT = process.cwd();
const SPEC_DIR = path.join(PROJECT_ROOT, 'ai_specs');
const SPEC_ARCHIVE_DIR = path.join(SPEC_DIR, 'archive');

async function listSpecs(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let mode: SpecMode = 'active';

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--type' && args[i + 1]) {
      mode = normalizeMode(args[i + 1]);
      i += 1;
      continue;
    }

    if (arg.startsWith('--type=')) {
      mode = normalizeMode(arg.split('=')[1]);
      continue;
    }

    if (!arg.startsWith('--')) {
      mode = normalizeMode(arg);
      continue;
    }
  }

  return { mode };
}

function normalizeMode(value: string): SpecMode {
  if (value === 'completed') {
    return 'completed';
  }

  return 'active';
}

async function printSpecList(mode: SpecMode): Promise<void> {
  const targetDir = mode === 'completed' ? SPEC_ARCHIVE_DIR : SPEC_DIR;
  const label = mode === 'completed' ? 'Completed specs (archive)' : 'Active specs';
  const relativePrefix = mode === 'completed' ? 'ai_specs/archive' : 'ai_specs';

  const specs = await listSpecs(targetDir).catch((error: Error) => {
    throw new Error(`Unable to read ${targetDir}: ${error.message}`);
  });

  process.stdout.write(`${label}: ${specs.length}\n`);

  if (specs.length === 0) {
    process.stdout.write('  (none found)\n');
    return;
  }

  for (const spec of specs) {
    process.stdout.write(`  • ${path.join(relativePrefix, spec)}\n`);
  }
}

async function main(): Promise<void> {
  const { mode } = parseArgs();

  try {
    await printSpecList(mode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error listing specs: ${message}\n`);
    process.exit(1);
  }
}

void main();
