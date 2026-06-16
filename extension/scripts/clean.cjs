const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const retryingRemoveOptions = {
  recursive: true,
  force: true,
  maxRetries: 5,
  retryDelay: 100
};

function removeWorkspaceEntry(entry, options) {
  const absolutePath = path.resolve(root, entry);
  const relativePath = path.relative(root, absolutePath);

  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to remove a path outside the workspace: ${entry}`);
  }

  fs.rmSync(absolutePath, options);
}

for (const directory of ['dist', 'out', 'coverage', '.vscode-test']) {
  removeWorkspaceEntry(directory, retryingRemoveOptions);
}

for (const entry of fs.readdirSync(root)) {
  if (entry.endsWith('.vsix') || entry.endsWith('.log')) {
    removeWorkspaceEntry(entry, { force: true, maxRetries: 5, retryDelay: 100 });
  }
}
