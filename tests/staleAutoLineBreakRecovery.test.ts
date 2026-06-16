import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { recoverStaleAutoLineBreakInput } from '../src/training/trainingSession';

describe('stale auto line-break recovery', () => {
  it('returns the editor text for deletion changes before recovery is attempted', () => {
    assert.equal(
      recoverStaleAutoLineBreakInput('abc\ndef', 'abc\n', 'abc', [{ text: '', rangeLength: 1 }]),
      'abc'
    );
  });

  it('returns the editor text when it already starts with the session text', () => {
    assert.equal(
      recoverStaleAutoLineBreakInput('abc\nx', 'abc\n', 'abc\nx', [{ text: 'x', rangeLength: 0 }]),
      'abc\nx'
    );
  });

  it('recovers input appended before automatic line layout reaches the editor', () => {
    assert.equal(
      recoverStaleAutoLineBreakInput(
        '// Learn: header\nimport java.io.IOException;\n\ntry',
        '// Learn: header\nimport java.io.IOException;',
        '// Learn: header\nimport java.io.IOException;t',
        [{ text: 't', rangeLength: 0 }]
      ),
      '// Learn: header\nimport java.io.IOException;\n\nt'
    );

    assert.equal(
      recoverStaleAutoLineBreakInput(
        'public class Demo {\n\n  @Override',
        'public class Demo {',
        'public class Demo {@',
        [{ text: '@', rangeLength: 0 }]
      ),
      'public class Demo {\n\n  @'
    );
  });

  it('recovers coalesced fast input appended before automatic line layout', () => {
    assert.equal(
      recoverStaleAutoLineBreakInput(
        '// Learn: header\nimport java.io.IOException;\n\ntry',
        '// Learn: header\n',
        '// Learn: header\nimport java.io.IOException;t',
        [{ text: 'import java.io.IOException;t', rangeLength: 0 }]
      ),
      '// Learn: header\nimport java.io.IOException;\n\nt'
    );

    assert.equal(
      recoverStaleAutoLineBreakInput(
        'public class Demo {\n\n  @Override',
        '',
        'public class Demo {@}',
        [{ text: 'public class Demo {@}', rangeLength: 0 }]
      ),
      'public class Demo {\n\n  @}'
    );
  });

  it('does not recover when the current session text has no pending layout suffix', () => {
    assert.equal(
      recoverStaleAutoLineBreakInput('abcx', 'abc', 'abxc', [{ text: 'x', rangeLength: 0 }]),
      'abxc'
    );
  });

  it('does not treat an auto-closed pair closer as the typed target after pending layout', () => {
    assert.equal(
      recoverStaleAutoLineBreakInput(
        'if (ready) {\n  }',
        '',
        'if (ready) {}',
        [{ text: '{}', rangeLength: 0 }]
      ),
      'if (ready) {}'
    );
  });

  it('does not recover when the editor text no longer shares the stable prefix', () => {
    assert.equal(
      recoverStaleAutoLineBreakInput('abc\n\nx', 'abc\n\n', 'abx', [{ text: 'x', rangeLength: 0 }]),
      'abx'
    );
  });

  it('does not recover when the stale suffix is empty', () => {
    assert.equal(
      recoverStaleAutoLineBreakInput('abc\n\nx', 'abc\n\n', 'abc', [{ text: 'x', rangeLength: 0 }]),
      'abc'
    );
  });

  it('recovers a non-newline stale suffix only when the reconstructed text matches the target', () => {
    assert.equal(
      recoverStaleAutoLineBreakInput('abc\n\nx', 'abc\n\n', 'abcx', [{ text: 'x', rangeLength: 0 }]),
      'abc\n\nx'
    );

    assert.equal(
      recoverStaleAutoLineBreakInput('abc\n\ny', 'abc\n\n', 'abcx', [{ text: 'x', rangeLength: 0 }]),
      'abcx'
    );
  });

  it('does not recover newline-containing editor suffixes from newline insertions', () => {
    assert.equal(
      recoverStaleAutoLineBreakInput('abc\n  x', 'abc\n  ', 'abcx\n  ', [{ text: 'x\n', rangeLength: 0 }]),
      'abcx\n  '
    );
  });

  it('does not recover when the inserted text is absent from the stale suffix', () => {
    assert.equal(
      recoverStaleAutoLineBreakInput('abc\n  x', 'abc\n  ', 'abcx\n  ', [{ text: 'z', rangeLength: 0 }]),
      'abcx\n  '
    );
  });

  it('recovers newline-containing stale suffixes only when the remaining suffix is the pending layout', () => {
    assert.equal(
      recoverStaleAutoLineBreakInput('abc\n  x', 'abc\n  ', 'abcx\n  ', [{ text: 'x', rangeLength: 0 }]),
      'abc\n  x'
    );

    assert.equal(
      recoverStaleAutoLineBreakInput('abc\n  x', 'abc\n  ', 'abcx\n y ', [{ text: 'x', rangeLength: 0 }]),
      'abcx\n y '
    );
  });
});
