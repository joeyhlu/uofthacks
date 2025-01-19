// const vscode = require('vscode');
// const path = require('path');
// const { exec } = require('child_process');

// function activate(context) {
//   const disposable = vscode.commands.registerCommand('myExtension.runProteccapiCLI', () => {
//     // 1. Create an output channel for logs
//     const outputChannel = vscode.window.createOutputChannel('ProteccAPI CLI');
//     outputChannel.show(true);

//     // 2. Build the path to cli.js inside node_modules/proteccapi/bin
//     //    (Adjust if proteccapi is installed or located differently)
//     const cliPath = path.join(
//       context.extensionPath,
//       'node_modules',
//       'proteccapi',
//       'bin',
//       'cli.js'
//     );

//     console.log(cliPath);
//     const folders = vscode.workspace.workspaceFolders;
//     if (!folders || folders.length === 0) {
//       vscode.window.showErrorMessage('No workspace folder is open.');
//       return;
//     }

//     // Path to the first folder in the workspace
//     const projectPath = folders[0].uri.fsPath;
//     const secureScanCLI = path.join(
//       context.extensionPath,
//       'node_modules',
//       'proteccapi',
//       'bin',
//       'cli.js' // or 'secure-scan' if that file is present
//     );
//     // 3. Spawn the CLI
//     //    For example, passing "--all" to do a full scan
//     exec(``, (error, stdout, stderr) => {
//       if (error) {
//         outputChannel.appendLine(`[ERR] ${stderr || error.message}`);
//         vscode.window.showErrorMessage(`ProteccAPI CLI error: ${stderr || error.message}`);
//         return;
//       }
//       // 4. Print CLI output in the channel
//       outputChannel.appendLine(stdout);
//       vscode.window.showInformationMessage('ProteccAPI CLI completed. Check the "ProteccAPI CLI" output for results.');
//     });
//   });

//   context.subscriptions.push(disposable);
// }

// function deactivate() {}

// module.exports = {
//   activate,
//   deactivate
// };

const vscode = require('vscode');
const path = require('path');
const { exec } = require('child_process');

function activate(context) {
  const disposable = vscode.commands.registerCommand('myExtension.runProteccapiCLI', () => {
    // 1. Create an output channel for logs
    const outputChannel = vscode.window.createOutputChannel('ProteccAPI CLI');
    outputChannel.show(true);

    // 2. Locate the "secure-scan" binary
    // Typically found in .bin if your package.json has a "bin" entry for "secure-scan"
    // const extensionPath = vscode.extensions.getExtension('stevenqiao.proteccapi-1.0.4').extensionPath;
    const secureScanBinary = path.join(
      context.extensionPath,
      'node_modules',
      'bin',
      'secure-scan'
    );

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder is open.');
      return;
    }
    const projectPath = folders[0].uri.fsPath;
    outputChannel.appendLine(projectPath);

    // 3. Construct the command
    //    Make sure to include the "-a" flag or any other flags you need
    const command = `"${secureScanBinary}" -a`;

    // 4. Execute the command
    //    Set cwd to your project path so it runs in the correct folder
    exec(command, { cwd: projectPath }, (error, stdout, stderr) => {
      if (error) {
        outputChannel.appendLine(`[ERR] ${stderr || error.message}`);
        vscode.window.showErrorMessage(`ProteccAPI CLI error: ${stderr || error.message}`);
        return;
      }
      outputChannel.appendLine(stdout);
      vscode.window.showInformationMessage('ProteccAPI CLI completed. Check the "ProteccAPI CLI" output for results.');
    });
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
