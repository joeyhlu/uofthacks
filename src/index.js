import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import dotenv from 'dotenv';
import readline from 'readline';
import { promisify } from 'util';

import { createEnvFile } from './envManager.js';

export class APIScanner {
  constructor(options = {}) {
    // Load environment variables if needed
    dotenv.config();

    this.options = {
      maxFileSize: 10 * 1024 * 1024,
      excludeExtensions: ['.jpg', '.png', '.gif', '.pdf', '.zip', '.lock'],
      debug: process.env.DEBUG === 'true' || options.debug,
      scanAllFiles: process.env.SCAN_ALL === 'true' || options.scanAllFiles,
      createEnvFile: options.createEnvFile || false,
      envPath: options.envPath || '.env',
      ...options
    };

    this.API_PATTERNS = [
      {
        name: 'AWS Access Key',
        pattern: /AKIA[0-9A-Z]{16}/g,
        envKey: 'AWS_ACCESS_KEY_ID',
      },
      {
        name: 'AWS Secret Key',
        pattern: /(?<=AWSSecretKey=)[a-zA-Z0-9\/+]{40}/g,
        envKey: 'AWS_SECRET_ACCESS_KEY',
      },
      {
        name: 'GitHub Token',
        pattern: /gh[oprs]_[A-Za-z0-9_]{36}/g,
        envKey: 'GITHUB_TOKEN',
      },
      {
        name: 'OpenAI API Key',
        pattern: /sk-(live|test)-[A-Za-z0-9]{32}/g,
        envKey: 'OPENAI_API_KEY',
      },
      {
        name: 'Google Cloud API Key',
        pattern: /AIza[0-9A-Za-z-_]{35}/g,
        envKey: 'GOOGLE_CLOUD_API_KEY',
      },
      {
        name: 'Stripe API Key',
        pattern: /(?:sk_live|pk_live)_[A-Za-z0-9]{24}/g,
        envKey: 'STRIPE_API_KEY',
      }
    ];

    this.spinner = ora();

    // We'll also create a readline interface for optional prompts
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Promisify question so we can use async/await
    this.question = promisify(this.rl.question).bind(this.rl);
  }

  log(message, level = 'info') {
    const levels = {
      info: chalk.blue('ℹ️ '),
      success: chalk.green('✔ '),
      warning: chalk.yellow('⚠️ '),
      error: chalk.red('✖ '),
      debug: chalk.grey('[DEBUG]')
    };
    if (level === 'debug' && !this.options.debug) return;
    console.log(`${levels[level]} ${message}`);
  }

  /**
   * Main scan method
   */
  async scan() {
    this.spinner.start('Scanning files for API keys...');

    const files = this.getFilesToScan();
    if (files.length === 0) {
      this.spinner.fail('No valid files to scan.');
      console.log('Make sure you have staged files or valid criteria.');
      this.rl.close();
      return { success: true, findings: [] };
    }

    let findings = [];
    for (const file of files) {
      findings = findings.concat(this.scanFile(file));
    }

    // Remove duplicates
    findings = this.deduplicateFindings(findings);

    if (findings.length > 0) {
      this.spinner.fail(`Found ${findings.length} potential API keys!`);

      // If user wants to create/update .env file
      if (this.options.createEnvFile) {
        await this.handleEnvCreation(findings);
      } else {
        // Otherwise just display them and fail
        this.displayFindings(findings);
        this.rl.close();
        process.exit(1);
      }
    } else {
      this.spinner.succeed('✔ No API keys found - safe to commit!');
      this.rl.close();
    }

    return { success: findings.length === 0, findings };
  }

  /**
   * Gather files either from "all" or just staged
   */
  getFilesToScan() {
    const ignoredPaths = ['node_modules', '.git', 'package-lock.json'];
    let files = [];

    try {
      if (this.options.scanAllFiles) {
        this.log('Scanning all files in the directory...', 'debug');
        const getAllFiles = (dir) => {
          let results = [];
          fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
            const fullPath = path.join(dir, entry.name);
            // Skip ignored directories
            if (entry.isDirectory() && !ignoredPaths.includes(entry.name)) {
              results = results.concat(getAllFiles(fullPath));
            } else if (entry.isFile() && this.isValidFile(fullPath)) {
              results.push(fullPath);
            }
          });
          return results;
        };
        files = getAllFiles(process.cwd());
      } else {
        this.log('Getting staged files only...', 'debug');
        const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
        files = output
          .split('\n')
          .filter((f) => f.trim())
          .filter((f) => !ignoredPaths.some((ignored) => f.includes(ignored)))
          .filter((f) => this.isValidFile(f));
      }
    } catch (error) {
      this.log(`Error getting files: ${error.message}`, 'error');
    }

    return files;
  }

  /**
   * Check file size/extension
   */
  isValidFile(file) {
    const ext = path.extname(file).toLowerCase();
    if (this.options.excludeExtensions.includes(ext)) {
      this.log(`Skipping excluded file type: ${file}`, 'debug');
      return false;
    }
    try {
      const stats = fs.statSync(file);
      if (stats.size > this.options.maxFileSize) {
        this.log(`Skipping large file: ${file}`, 'debug');
        return false;
      }
    } catch (error) {
      this.log(`Error checking file: ${file}`, 'error');
      return false;
    }
    return true;
  }

  /**
   * Scan a single file for patterns
   */
  scanFile(file) {
    this.log(`Scanning file: ${file}`, 'debug');
    const findings = [];
    try {
      const content = fs.readFileSync(file, 'utf8');
      this.API_PATTERNS.forEach(({ name, pattern }) => {
        const matches = [...content.matchAll(pattern)];
        matches.forEach((match) => {
          const line = content.substring(0, match.index).split('\n').length;
          // Optional partial masking if you want
          // const masked = match[0].length > 10 ? match[0].slice(0,4) + '...' + match[0].slice(-4) : match[0];
          findings.push({ type: name, file, line, snippet: match[0] });
        });
      });
    } catch (error) {
      this.log(`Error reading file: ${file}`, 'error');
    }
    return findings;
  }

  deduplicateFindings(findings) {
    const seen = new Set();
    return findings.filter(({ type, file, line }) => {
      const key = `${type}-${file}-${line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  displayFindings(findings) {
    const grouped = findings.reduce((acc, { type, file, line, snippet }) => {
      if (!acc[file]) acc[file] = [];
      acc[file].push({ type, line, snippet });
      return acc;
    }, {});

    console.log(chalk.red.bold('\n⚠️  Found potential API keys:'));
    Object.entries(grouped).forEach(([file, matches]) => {
      console.log(chalk.yellow(`\nIn file: ${file}`));
      matches.forEach(({ type, line, snippet }) => {
        console.log(`  ${chalk.cyan(type)} at line ${chalk.green(line)}:`);
        console.log(`    ${chalk.grey(snippet)}`);
      });
    });
    console.log(chalk.red.bold('\n❌ Commit blocked! Remove or handle these keys before committing.'));
  }

  /**
   * Creates/updates a .env file with discovered secrets
   */
  async handleEnvCreation(findings) {
    console.log(chalk.yellow('\nFound API keys that should be moved to an .env file.'));

    const { envContent, updated } = await createEnvFile(findings, this.API_PATTERNS, this.options.envPath);

    if (envContent && updated) {
      console.log(chalk.green('\n✔ Created/Updated .env file.'));
      console.log(chalk.yellow('Please replace the API keys in your code with the corresponding environment variables.'));
      
      // Show user how to replace
      findings.forEach(finding => {
        const pattern = this.API_PATTERNS.find(p => p.name === finding.type);
        if (pattern?.envKey) {
          console.log(chalk.blue(`\nReplace in code: ${finding.snippet}`));
          console.log(chalk.green(`With: process.env.${pattern.envKey}`));
        }
      });

      // Also ensure .env is gitignored
      this.addDotEnvToGitignore();
    } else {
      // If user declined to add anything or nothing changed, still fail the commit
      this.displayFindings(findings);
      process.exit(1);
    }

    this.rl.close();
    process.exit(1);
  }

  /**
   * Adds ".env" to .gitignore if not already present
   */
  addDotEnvToGitignore() {
    try {
      const gitignorePath = path.join(process.cwd(), '.gitignore');
      if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, '.env\n');
        console.log(chalk.green('Created .gitignore with .env'));
        return;
      }
      let gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gitignoreContent.includes('.env')) {
        gitignoreContent += '\n.env\n';
        fs.writeFileSync(gitignorePath, gitignoreContent);
        console.log(chalk.green('Added .env to .gitignore'));
      }
    } catch (error) {
      this.log(`Error updating .gitignore: ${error.message}`, 'error');
    }
  }
}
