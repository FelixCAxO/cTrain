import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, '../../..');
  const extensionTestsPath = path.resolve(__dirname, './suite/index');
  const userDataDir = path.resolve(extensionDevelopmentPath, '.vscode-test', `user-data-${process.pid}`);

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [
      '--disable-workspace-trust',
      `--user-data-dir=${userDataDir}`
    ]
  });
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
