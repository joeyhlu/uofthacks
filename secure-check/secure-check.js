#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const leven = require('leven');

const semver = require('semver');

function runNpmAudit() {
  const spinner = ora('Running npm audit...').start();
  const result = spawnSync('npm', ['audit', '--json'], {
    encoding: 'utf-8',
  });

  if (result.error) {
    spinner.fail('Failed to run npm audit.');
    throw result.error;
  }

  spinner.succeed('npm audit completed.');

  const auditOutput = result.stdout.trim();
  if (!auditOutput) {
    console.log(chalk.yellow('No audit output found (possibly no vulnerabilities, or an error occurred).'));
    return null;
  }

  try {
    const data = JSON.parse(auditOutput);
    return data;
  } catch (err) {
    console.log(chalk.red('Could not parse npm audit JSON output.'));
    return null;
  }
}

function reportNpmAudit(auditData) {
  if (!auditData) {
    console.log(chalk.yellow('No audit data to report.'));
    return;
  }

  if (auditData.vulnerabilities) {
    let totalVulns = 0;
    for (const [pkgName, info] of Object.entries(auditData.vulnerabilities)) {
      const via = Array.isArray(info.via) ? info.via : [info.via];
      totalVulns += via.length;
      console.log(`${chalk.red('[!]')} Found ${chalk.yellow(via.length)} vulnerabilities in ${chalk.cyan(pkgName)} (severity: ${chalk.magenta(info.severity)})`);
    }
    console.log(totalVulns > 0 
      ? chalk.red(`\nTotal vulnerabilities found: ${totalVulns}\n`) 
      : chalk.green('✓ No known vulnerabilities found.')
    );
  } else if (auditData.advisories) {
    const advisories = Object.values(auditData.advisories);
    if (advisories.length === 0) {
      console.log(chalk.green('✓ No known vulnerabilities found.'));
      return;
    }
    console.log(chalk.red(`[!] Found ${advisories.length} advisories:`));
    advisories.forEach((advisory) => {
      console.log(` - ${advisory.module_name}: ${advisory.overview} (severity: ${advisory.severity})`);
    });
  } else {
    console.log(chalk.green('✓ No known vulnerabilities found (or unrecognized audit format).'));
  }
}


function maliciousNameDetector(filePath, content) {
  let score = 0;
  const suspiciousKeywords = ['crypto', 'base64', 'eval', 'exec', 'fs.write'];
  suspiciousKeywords.forEach((keyword) => {
    if (content.includes(keyword)) {
      score += 0.2; 
    }
  });

  if (score > 1) score = 1;

  return {
    filePath,
    suspicionScore: score,
  };
}

const POPULAR_PACKAGES = ['react', 'lodash', 'express', 'mongoose', 'chalk', 'moment', 'axios', 'vue', 'typescript'];

function checkTyposquatting(pkgName) {
  let minDistance = Infinity;
  let closestMatch = null;

  for (const popular of POPULAR_PACKAGES) {
    const distance = leven(pkgName, popular);
    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = popular;
    }
  }

  if (minDistance <= 2 && pkgName !== closestMatch) {
    return { isSuspect: true, closestMatch, distance: minDistance };
  }
  return { isSuspect: false };
}

function checkPackageLifecycleScripts(pkgJsonPath) {
  if (!fs.existsSync(pkgJsonPath)) {
    return [];
  }
  const raw = fs.readFileSync(pkgJsonPath, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return [];
  }

  if (!data.scripts) return [];

  const suspiciousScripts = [];
  const lifecycleHooks = ['preinstall', 'postinstall', 'install', 'prestart', 'poststart']; 
  lifecycleHooks.forEach((hook) => {
    if (data.scripts[hook]) {
      suspiciousScripts.push({
        hook,
        script: data.scripts[hook],
      });
    }
  });

  return suspiciousScripts;
}

function checkEnvUsage(content) {
  const occurrences = (content.match(/process\.env/g) || []).length;
  return occurrences;
}

function gatherLocalPackages(modulesDir) {
  const results = [];

  function traverse(dir) {
    if (!fs.existsSync(dir)) return;

    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const content = fs.readFileSync(pkgPath, 'utf-8');
        const data = JSON.parse(content);
        if (data.name && data.version) {
          results.push({
            name: data.name,
            version: data.version,
            packageJsonPath: pkgPath,
          });
        }
      } catch {
      }
    }

    const subDirs = fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    subDirs.forEach((subDir) => {
      if (subDir === 'node_modules') {
        traverse(path.join(dir, subDir));
      }
    });
  }

  traverse(modulesDir);
  return results;
}

async function main() {
  console.log(chalk.bold.cyan('\n== ProteccCIL ==\n'));
  const auditData = runNpmAudit();
  reportNpmAudit(auditData);
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(chalk.yellow('No node_modules folder found. Skipping local package checks.'));
  }

  const allPackages = gatherLocalPackages(nodeModulesPath);
  if (allPackages.length === 0) {
    console.log(chalk.yellow('No packages found in node_modules. Skipping further checks.'));
  }

  console.log(chalk.blueBright(`\nScanning ${allPackages.length} local packages for additional issues...\n`));
  let foundIssues = false;

  for (const pkg of allPackages) {
    const { name, version, packageJsonPath } = pkg;

    const { isSuspect, closestMatch, distance } = checkTyposquatting(name);
    if (isSuspect) {
      foundIssues = true;
      console.log(
        chalk.red(`[!] Potential typosquatting/impostor package: ${name} (close to "${closestMatch}", distance=${distance})`)
      );
    }

    const suspiciousScripts = checkPackageLifecycleScripts(packageJsonPath);
    if (suspiciousScripts.length > 0) {
      foundIssues = true;
      console.log(chalk.red(`[!] Package "${name}" has lifecycle scripts that may be malicious:`));
      suspiciousScripts.forEach((scr) => {
        console.log(`    - ${scr.hook}: ${scr.script}`);
      });
    }

    const indexJsPath = path.join(path.dirname(packageJsonPath), 'index.js');
    if (fs.existsSync(indexJsPath)) {
      const content = fs.readFileSync(indexJsPath, 'utf8');
      const nameDetector = maliciousNameDetector(indexJsPath, content);
      if (nameDetector.suspicionScore >= 0.4) {
        foundIssues = true;
        console.log(chalk.red(`[!] Malicous Name: Package "${name}" has suspicious code (score: ${nameDetector.suspicionScore.toFixed(2)}).`));
      }

      const envCount = checkEnvUsage(content);
      if (envCount > 1) {
        foundIssues = true;
        console.log(chalk.yellow(`[?] Package "${name}" reads "process.env" ${envCount} times in index.js. Ensure no secrets are exfiltrated.`));
      }
    }
  }
  console.log (chalk.green('\nKeep safe!'))
  if (!foundIssues) {
    console.log(chalk.green('\nNo additional suspicious activity detected in local packages.'));
  } else {
    console.log(chalk.red('\nSome issues were detected; review them before proceeding.'));
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(chalk.red('An error occurred:'), err);
  process.exit(1);
});
