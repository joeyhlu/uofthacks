# ProteccAPI CLI Tool

**ProtectAPI** is a CLI tool to detect and manage sensitive API keys in your codebase. It supports detecting common API keys and managing them securely by suggesting environment variable usage. It also integrates with Git pre-commit hooks to prevent committing sensitive keys. Furthermore, it helps improve security of the code by identifying vulnerabilities and suspicious packages. Additionally, feel free to check out our VSCode Extension [here](https://marketplace.visualstudio.com/items?itemName=StevenQiao.ProteccAPI) !

---

## Features

- Detects common API keys such as AWS, GitHub, OpenAI, Google Cloud, Stripe, and more.
- Provides a CLI interface for scanning and handling API keys.
- Security Scoring: Provides a comprehensive security score (0.0–10.0) to give an overall assessment of your repository’s security.
- Automatically generates or updates a `.env` file with detected API keys.
- Vulnerability Assessment: Scans for known vulnerabilities in project dependencies and detects typosquatting
- Automatically Creates a git ignore for sensitive files
- Suggests replacing sensitive keys in your code with environment variables.
- Blocks commits with exposed API keys using Git hooks.
- Suspicious Script Detection: Flags potentially harmful lifecycle scripts in package.json
- Secure Scan is now available as a VSCode extension: ProteccAPI, offering real-time detection of sensitive keys directly within your code editor. Available on the VSCode Marketplace.

---

## Installation

### Install Globally via NPM

```bash
npm install -g proteccapi
```

Once installed, the secure-scan command will be globally available.

### Install Locally
Alternatively, install it as a local dependency in your project:
```bash
npm install proteccapi
```

## Usage

### Basic commands 
**Scan Staged Files**
To scan only staged files:
```
secure-scan
```
**Scan All Files**
To scan all files in the project:
``` bash
secure-scan --all
```

**Generate/Update .env File**
To automatically add detected keys to a .env file:
```bash
secure-scan --env
```

**Custom .env Path**
Specify a custom path for the .env file:
```bash
secure-scan --env --env-path ./config/.env
```

**Debug Mode**
Enable debug logs to troubleshoot issues:
```bash
secure-scan --debug
```

## Integration with Git Hooks
Secure Scan can be integrated into your Git workflow to block commits containing sensitive keys.

**Set Up Pre-Commit Hook**
Install Husky:
``` bash
npm install husky --save-dev
npx husky install
```

**Add a Pre-Commit Hook:**
``` bash
npx husky add .husky/pre-commit "secure-scan"
```
Now, Secure Scan will run before every commit to block commits with exposed API keys.

## Supported API Keys
Secure Scan detects the following API keys:

- AWS Access Key
    - Regex: AKIA[0-9A-Z]{16}
- AWS Secret Key
    -Regex: [A-Za-z0-9/+=]{40}
- GitHub Token
    - Regex: gh[oprs]_[A-Za-z0-9_]{36}
- OpenAI API Key
    - Regex: sk-(live|test)-[A-Za-z0-9]{32}
- Google Cloud API Key
    - Regex: AIza[0-9A-Za-z-_]{35}
- Stripe API Key
    - Regex: (?:sk_live|pk_live)_[A-Za-z0-9]{24}

## Development
**Clone the Repository**
To contribute to Secure Scan, clone the GitHub repository:
``` bash
git clone https://github.com/aayanrahman/proteccapi.git
cd proteccapi
```
**Install Dependencies**
Install all required dependencies:
```bash
npm install
```

**Run Locally**
Run the CLI tool locally:
```bash
npm run scan
```

**Publish Updates to NPM**
Increment the version in package.json:
```bash
npm version patch
```
Publish to npm:
```bash
npm publish
```

## Examples
** Example 1: Detect API Keys: ** 
Create a file test.js with the following content:
```javascript
const apiKey = "your-api-key";
```
Stage the file:
```bash
git add test.js
```
Run Secure Scan: 
```bash
secure-scan
```

Output:

```mathematica
⚠️  Found potential API keys:
  OpenAI API Key in file test.js:
    your-api-key

❌ Commit blocked! Remove or handle these keys before committing.
```

## VSCode Extension
1. Install ProteccAPI extension (v 1.0.6) on VSCode MarketPlace.
2. Open any folder that you are currently working on.
3. Open Command Palette on your VSCode (`Cmd + Shift + P` on macOS, or `Ctrl + Shift + P` on Windows) and search for **“Run ProteccAPI CLI”**.
4. Execute **“Run ProteccAPI CLI”** for a quick scan!

**Example output:**

<img width="303" alt="image" src="https://github.com/user-attachments/assets/0bf42aad-7711-4d17-8532-8c699bfd99b4" />

## License
Secure Scan is open-source software licensed under the MIT License.

## Contributing
We welcome contributions to improve Secure Scan! To contribute:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request.

## Support
For questions or issues, open an issue on GitHub.



