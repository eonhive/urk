#!/usr/bin/env node
/**
 * Company: EonHive Inc.
 * Title: URK CLI Entry
 * Purpose: Route top-level CLI arguments to the small v0 URK command set.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-05
 * Notes: Vibe coded with Codex.
 */

import { readFileSync } from 'node:fs';
import { runAddCommand } from './commands/add.js';
import { runCheckCommand } from './commands/check.js';
import { runCreateCommand } from './commands/create.js';
import { runCreateProofCommand } from './commands/create-proof.js';
import { runExportCommand } from './commands/export.js';
import { runEmbedCommand } from './commands/embed.js';
import { runInspectCommand } from './commands/inspect.js';
import { runPackCommand } from './commands/pack.js';
import { runUnpackCommand } from './commands/unpack.js';
import { error, warn } from './utils/logger.js';

type CommandHandler = (args: string[]) => Promise<number>;

const HELP_TEXT = `URK CLI

Usage:
  urk <command> [options]

Commands:
  create         Scaffold a standalone URK browser runtime app
  create-proof   Scaffold a repo-only URK proof route
  export         Build a portable static web experience
  embed          Generate a static Player host for an already-hosted export
  pack           Package exported web files into one .urkpkg archive
  unpack         Validate and extract a .urkpkg archive for HTTP hosting
  add            Add a supported DOM adapter to a URK project
  check          Run static URK project checks
  inspect        Inspect a project or .urkpkg archive (no live browser inspection)

Examples:
  urk create my-runtime
  urk export my-runtime
  urk embed https://experiences.example.com/demo/ --out-dir embed
  urk create controller loading-flow
  urk create-proof loading-flow
  urk add adapter pointer
  urk inspect

Options:
  -h, --help     Show this help text
  --version      Print the @urk/cli package version
`;

const COMMANDS: Record<string, CommandHandler> = {
  create: runCreateCommand,
  'create-proof': runCreateProofCommand,
  export: runExportCommand,
  embed: runEmbedCommand,
  pack: runPackCommand,
  unpack: runUnpackCommand,
  add: runAddCommand,
  check: runCheckCommand,
  inspect: runInspectCommand,
};

function getPackageVersion(): string {
  const packageJsonPath = new URL('../package.json', import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };

  return packageJson.version ?? '0.0.0';
}

function printHelp(): void {
  process.stdout.write(`${HELP_TEXT}\n`);
}

export async function runCli(argv: string[]): Promise<number> {
  const [command, ...args] = argv;

  if (!command || command === '-h' || command === '--help') {
    printHelp();
    return 0;
  }

  if (command === '--version') {
    process.stdout.write(`${getPackageVersion()}\n`);
    return 0;
  }

  const handler = COMMANDS[command];

  if (!handler) {
    warn(`Unknown command: ${command}`);
    printHelp();
    return 1;
  }

  return handler(args);
}

async function main(): Promise<void> {
  try {
    const exitCode = await runCli(process.argv.slice(2));
    process.exitCode = exitCode;
  } catch (runtimeError) {
    const message =
      runtimeError instanceof Error ? runtimeError.message : 'Unexpected CLI failure';
    error(message);
    process.exitCode = 1;
  }
}

void main();
