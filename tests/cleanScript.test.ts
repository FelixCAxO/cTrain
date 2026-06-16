import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';

const root = path.resolve(__dirname, '..');

describe('clean script', () => {
  it('uses retry-capable deletion for generated package artifacts', () => {
    const script = fs.readFileSync(path.join(root, 'scripts', 'clean.cjs'), 'utf8');

    assert.match(script, /maxRetries:\s*[1-9]\d*/);
    assert.match(script, /retryDelay:\s*[1-9]\d*/);
    assert.match(script, /recursive:\s*true/);
  });
});
