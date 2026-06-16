import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';

const root = path.resolve(__dirname, '..');

describe('rebuild VSIX batch file', () => {
  it('rebuilds the expected VSIX through the package script', () => {
    const batchPath = path.join(root, 'rebuild-vsix.bat');
    assert.equal(fs.existsSync(batchPath), true, 'rebuild-vsix.bat should exist at the extension root');

    const batch = fs.readFileSync(batchPath, 'utf8');
    assert.match(batch, /package\.json/);
    assert.match(batch, /require\('\.\/package\.json'\)\.name/);
    assert.match(batch, /require\('\.\/package\.json'\)\.version/);
    assert.match(batch, /set "RELEASE_DIR=%~dp0\.\.\\releases"/);
    assert.doesNotMatch(batch, /code-trainer-\d+\.\d+\.\d+\.vsix/);
    assert.match(batch, /call npm run package/);
    assert.match(batch, /if not exist "%VSIX%"/i);
    assert.match(batch, /exit \/b 1/i);
  });

  it('keeps the local rebuild helper out of the packaged extension', () => {
    const vscodeIgnore = fs.readFileSync(path.join(root, '.vscodeignore'), 'utf8');
    assert.match(vscodeIgnore, /^rebuild-vsix\.bat$/m);
  });
});
