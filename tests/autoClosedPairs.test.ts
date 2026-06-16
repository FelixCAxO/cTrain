import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { autoClosedPairs, openerForCloser } from '../src/training/autoClosedPairs';

describe('auto-closed pair metadata', () => {
  it('uses one shared pair map for paste policy and prefix matching semantics', () => {
    assert.deepEqual(autoClosedPairs, {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      "'": "'",
      '`': '`'
    });

    assert.deepEqual(
      [...openerForCloser.entries()].sort(([left], [right]) => left.localeCompare(right)),
      Object.entries(autoClosedPairs)
        .map(([opener, closer]) => [closer, opener])
        .sort(([left], [right]) => left.localeCompare(right))
    );
  });
});
