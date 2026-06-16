import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { classifyTextChange } from '../src/training/pastePolicy';

describe('paste policy', () => {
  it('allows VS Code undo and redo reason codes to carry multi-character edits', () => {
    assert.deepEqual(classifyTextChange([{ text: 'abc', rangeLength: 0, reason: 1 }], false), { kind: 'allowed' });
    assert.deepEqual(classifyTextChange([{ text: 'abc', rangeLength: 0, reason: 2 }], false), { kind: 'allowed' });
  });

  it('rejects mismatched and non-editor-generated pair-like insertions', () => {
    assert.deepEqual(classifyTextChange([{ text: '({', rangeLength: 0 }], false), {
      kind: 'paste',
      insertedLength: 2
    });
    assert.deepEqual(classifyTextChange([{ text: '{not}', rangeLength: 0 }], false), {
      kind: 'paste',
      insertedLength: 5
    });
    assert.deepEqual(classifyTextChange([{ text: '{}[]', rangeLength: 0 }], false), {
      kind: 'paste',
      insertedLength: 4
    });
  });

  it('allows known auto-closed pairs with empty or whitespace-only bodies', () => {
    for (const text of ['()', '[]', '{}', '""', "''", '``', '{ }', '(\t)']) {
      assert.deepEqual(classifyTextChange([{ text, rangeLength: 0 }], false), { kind: 'allowed' }, text);
    }
  });

  it('allows one logical character even when it spans multiple UTF-16 code units', () => {
    for (const text of ['e\u0301', '😀', '👩‍💻']) {
      assert.deepEqual(classifyTextChange([{ text, rangeLength: 0 }], false), { kind: 'allowed' }, text);
    }
  });

  it('rejects multi-grapheme insertions when paste is disabled', () => {
    for (const text of ['e\u0301x', '😀x']) {
      assert.deepEqual(classifyTextChange([{ text, rangeLength: 0 }], false), {
        kind: 'paste',
        insertedLength: text.length
      }, text);
    }
  });

  it('allows target-prefix insertions while rejecting unrelated multi-character insertions', () => {
    assert.deepEqual(
      classifyTextChange([{ text: 'public', rangeLength: 0 }], false, { targetRemainder: 'public class Demo' }),
      { kind: 'allowed' }
    );
    assert.deepEqual(
      classifyTextChange([{ text: 'private', rangeLength: 0 }], false, { targetRemainder: 'public class Demo' }),
      { kind: 'paste', insertedLength: 7 }
    );
  });

  it('allows pending line layout before exactly one next target character', () => {
    const cases = [
      { text: '\n}', targetRemainder: '}' },
      { text: '\r}', targetRemainder: '}' },
      { text: '\r\n}', targetRemainder: '}' },
      { text: '\n  }', targetRemainder: '}' },
      { text: '\r\n\t|', targetRemainder: '|' },
      { text: '\r\n  e\u0301', targetRemainder: 'e\u0301' }
    ];

    for (const { text, targetRemainder } of cases) {
      assert.deepEqual(
        classifyTextChange([{ text, rangeLength: 0 }], false, { targetRemainder }),
        { kind: 'allowed' },
        JSON.stringify(text)
      );
    }
  });

  it('allows pending line layout before one auto-closed target opener', () => {
    assert.deepEqual(
      classifyTextChange([{ text: '\r\n  {}', rangeLength: 0 }], false, { targetRemainder: '{' }),
      { kind: 'allowed' }
    );
  });

  it('rejects pending line layout before a multi-character target prefix', () => {
    assert.deepEqual(
      classifyTextChange([{ text: '\r\n  return true;', rangeLength: 0 }], false, { targetRemainder: 'return true;' }),
      { kind: 'paste', insertedLength: '\r\n  return true;'.length }
    );
  });

  it('allows one-character formatter rewrites before prefix validation', () => {
    assert.deepEqual(
      classifyTextChange([{ text: '  }', rangeLength: 2 }], false, {
        targetRemainder: '}',
        singleCharacterFormattingRewrite: true
      }),
      { kind: 'allowed' }
    );
  });

  it('rejects formatter-shaped multi-character appends without the formatting rewrite signal', () => {
    assert.deepEqual(
      classifyTextChange([{ text: '  return', rangeLength: 2 }], false, {
        targetRemainder: 'return true;',
        singleCharacterFormattingRewrite: false
      }),
      { kind: 'paste', insertedLength: '  return'.length }
    );
  });
});
