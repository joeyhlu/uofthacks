#!/usr/bin/env node
import { Command } from 'commander';
import { APIScanner } from '../src/index.js';
import main from '../src/security-check.js'; // Import the security-check function
import chalk from 'chalk';


const program = new Command();

program
  .name('secure-scan')
  .description('Scan for exposed API keys and manage .env files')
  .version('1.0.0')
  .option('-a, --all', 'Scan all files (not just staged ones)')
  .option('-e, --env', 'Create/update .env file with found keys')
  .option('-d, --debug', 'Enable debug logging')
  .option('--env-path <path>', 'Custom path for .env file', '.env');

program
  .command('secure-check') // Subcommand for security checks
  .description('Run advanced npm security checks')
  .action(async () => {
    console.log(chalk.bold.cyan('\nSecure Check Subcommand Triggered'));
    try {
      await main(); // Call the logic from security-check.js
    } catch (error) {
      console.error(chalk.red('Security check failed:'), error);
      process.exit(1);
    }
  });

// Handle the default behavior
program.action(async (options) => {
  const scanner = new APIScanner({
    scanAllFiles: options.all,
    createEnvFile: options.env,
    debug: options.debug,
    envPath: options.envPath,
  });

  try {
    await scanner.scan(); // Default action: run API key scanning
  } catch (error) {
    console.error(chalk.red('API scanning failed:'), error);
    process.exit(1);
  }
});

program.parse(process.argv);
