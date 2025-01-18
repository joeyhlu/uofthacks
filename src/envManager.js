import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import dotenv from 'dotenv';

/**
 * createEnvFile - prompts user to add discovered secrets to .env
 */
export async function createEnvFile(findings, patterns, envPath) {
  let envContent = '';
  let updated = false;

  // Read existing env content
  const existingEnv = await readExistingEnv(envPath);

  // For each discovered secret, check if we should add it to .env
  for (const finding of findings) {
    const pattern = patterns.find(p => p.name === finding.type);
    if (pattern?.envKey) {
      const existingValue = existingEnv[pattern.envKey];

      // If the .env doesn't have this key set, prompt user to add it
      if (!existingValue) {
        const { useKey } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'useKey',
            message: `Add ${finding.type} to .env file? (Detected: ${finding.snippet})`,
            default: true,
          },
        ]);

        if (useKey) {
          envContent += `${pattern.envKey}=${finding.snippet}\n`;
          updated = true;
        }
      }
    }
  }

  if (updated) {
    await appendToEnvFile(envPath, envContent);
    return { envContent, updated };
  }

  return { envContent: null, updated: false };
}

async function readExistingEnv(envPath) {
  try {
    const content = await fs.readFile(envPath, 'utf8');
    return dotenv.parse(content);
  } catch (error) {
    // If file doesn't exist, return empty object
    return {};
  }
}

async function appendToEnvFile(envPath, content) {
  try {
    // Create or append
    await fs.appendFile(envPath, content);

    // Attempt to secure file permissions (mostly works on Unix-like systems)
    await fs.chmod(envPath, 0o600);
  } catch (error) {
    console.error('Error writing to .env file:', error);
    throw error;
  }
}
