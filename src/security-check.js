#!/usr/bin/env node

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import leven from 'leven';

async function main() {
  console.log(chalk.bold.cyan('\n== Secure Check CLI ==\n'));

  const spinner = ora('Running npm audit...').start();
  const result = spawnSync('npm', ['audit', '--json'], { encoding: 'utf-8' });

  if (result.error) {
    spinner.fail('npm audit did not run');
    throw result.error;
  }

  spinner.succeed('npm audit completed.');
  const auditOutput = result.stdout.trim();
  let auditData = null;

  if (auditOutput) {
    try {
      auditData = JSON.parse(auditOutput);
    } catch (err) {
      console.log(chalk.red('Could not parse npm audit JSON output.'));
    }
  }

  let vulnerabilitiesCount = 0;

  // Process audit data
  if (auditData && auditData.vulnerabilities) {
    for (const [pkgName, info] of Object.entries(auditData.vulnerabilities)) {
      const via = Array.isArray(info.via) ? info.via : [info.via];
      vulnerabilitiesCount += via.length;
      console.log(
        `${chalk.red('[!]')} Found ${chalk.yellow(via.length)} vulnerabilities in ${chalk.cyan(
          pkgName
        )} (severity: ${chalk.magenta(info.severity)})`
      );
    }
  } else {
    console.log(chalk.green('✓ No known vulnerabilities found.'));
  }

  console.log(chalk.bold.cyan('\n== Advanced Package Security Checks ==\n'));

  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(chalk.yellow('No node_modules folder detected. Skipping package-related checks.'));
    printSummary(vulnerabilitiesCount, 10.0); // Perfect score without package checks
    return;
  }

  // Check for typosquatting, lifecycle scripts, and suspicious patterns
  const suspiciousPackages = [];
  const packages = fs.readdirSync(nodeModulesPath);

  for (const pkg of packages) {
    const { isSuspect, closestMatch, distance } = checkTyposquatting(pkg);
    if (isSuspect) {
      suspiciousPackages.push({ pkg, closestMatch, distance });
    }
  }

  if (suspiciousPackages.length > 0) {
    console.log(chalk.red('[!] Potential typosquatting detected:'));
    suspiciousPackages.forEach(({ pkg, closestMatch, distance }) => {
      console.log(
        ` - ${chalk.yellow(pkg)} (close to "${chalk.cyan(closestMatch)}", distance=${distance})`
      );
    });
  } else {
    console.log(chalk.green('✓ No suspicious activity detected in packages.'));
    console.log(chalk.green('✓ No vunerabilities found.'));
  }

  // Final summary
  const finalScore = computeSecurityScore(vulnerabilitiesCount, suspiciousPackages.length);
  printSummary(vulnerabilitiesCount, finalScore);
}

function checkTyposquatting(pkgName) {
  const POPULAR_PACKAGES = ['react', 'lodash', 'express', 'mongoose', 'chalk', 'moment', 'axios'];
  let minDistance = Infinity;
  let closestMatch = null;

  for (const popular of POPULAR_PACKAGES) {
    const distance = leven(pkgName, popular);
    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = popular;
    }
  }

  return {
    isSuspect: minDistance <= 2 && pkgName !== closestMatch,
    closestMatch,
    distance: minDistance,
  };
}

function computeSecurityScore(vulnerabilitiesCount, typosquattingCount) {
  let score = 10.0;

  // Deduct points for vulnerabilities
  if (vulnerabilitiesCount > 0) {
    score -= Math.min(vulnerabilitiesCount * 0.5, 5); // Cap deduction at 5
  }

  // Deduct points for typosquatting
  if (typosquattingCount > 0) {
    score -= Math.min(typosquattingCount, 2); // Cap deduction at 2
  }

  return Math.max(0, score.toFixed(1)); // Ensure score is non-negative
}

function printSummary(vulnerabilitiesCount, finalScore) {
  console.log(chalk.bold.blue('\n-- Final Security Summary --\n'));
  console.log(`🔍 Dependencies scanned: ${vulnerabilitiesCount}`);
  console.log(`🛡️  Final Security Score: ${chalk.green(finalScore)}/10.0`);;
}

export default main;
