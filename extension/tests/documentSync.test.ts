import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { planDocumentSync, positionAtDocumentEnd, shouldRepaintSyncedDocument } from '../src/ui/documentSync';
import type { ApplyDocumentResult } from '../src/training/trainingSession';

describe('document sync planner', () => {
  it('replaces rejected input without forcing the cursor to the end', () => {
    const result: ApplyDocumentResult = {
      accepted: false,
      shouldRevert: true,
      reason: 'mistake',
      feedback: "expected 'b' got 'x' at line 1"
    };

    assert.deepEqual(planDocumentSync(result, 'ax', 'a'), {
      shouldReplace: true,
      moveCursorToEnd: false
    });
  });

  it('moves the cursor to the end when accepted input auto-syncs line breaks', () => {
    const result: ApplyDocumentResult = {
      accepted: true,
      shouldRevert: false,
      reason: 'input'
    };

    assert.deepEqual(planDocumentSync(result, 'abc', 'abc\n'), {
      shouldReplace: true,
      moveCursorToEnd: true,
      cursorOffset: 'abc\n'.length,
      cursorPosition: { line: 1, character: 0 }
    });
  });

  it('reports the exact target cursor offset when accepted input auto-syncs blank rows', () => {
    const result: ApplyDocumentResult = {
      accepted: true,
      shouldRevert: false,
      reason: 'input'
    };

    assert.deepEqual(planDocumentSync(result, 'package se.su.img;', 'package se.su.img;\n\n'), {
      shouldReplace: true,
      moveCursorToEnd: true,
      cursorOffset: 'package se.su.img;\n\n'.length,
      cursorPosition: { line: 2, character: 0 }
    });
  });

  it('positions reset cursors at the end of non-empty initial lesson text', () => {
    assert.deepEqual(positionAtDocumentEnd('// LESSON: Reset.\n// You will learn: restart.\n'), {
      line: 2,
      character: 0
    });
    assert.deepEqual(positionAtDocumentEnd('class Demo {\n  int value;\n}'), {
      line: 2,
      character: 1
    });
  });

  it('keeps the cursor position independent from editor line endings', () => {
    const result: ApplyDocumentResult = {
      accepted: true,
      shouldRevert: false,
      reason: 'input'
    };

    const plan = planDocumentSync(result, 'package se.su.img;', 'package se.su.img;\n\n');

    assert.deepEqual(plan, {
      shouldReplace: true,
      moveCursorToEnd: true,
      cursorOffset: 'package se.su.img;\n\n'.length,
      cursorPosition: { line: 2, character: 0 }
    });
  });

  it('does not replace accepted editor text that only differs by CRLF line endings', () => {
    const result: ApplyDocumentResult = {
      accepted: true,
      shouldRevert: false,
      reason: 'input'
    };

    assert.deepEqual(planDocumentSync(result, 'package se.su.img;\r\n\r\ni', 'package se.su.img;\n\ni'), {
      shouldReplace: false
    });
  });

  it('skips document replacement when accepted input already matches session text', () => {
    const result: ApplyDocumentResult = {
      accepted: true,
      shouldRevert: false,
      reason: 'input'
    };

    assert.deepEqual(planDocumentSync(result, 'abc', 'abc'), {
      shouldReplace: false
    });
  });

  it('repaints decorations only when the visible editor still matches the session text', () => {
    assert.equal(shouldRepaintSyncedDocument('abc', 'abc'), true);
    assert.equal(shouldRepaintSyncedDocument('abc\r\n', 'abc\n'), true);
    assert.equal(shouldRepaintSyncedDocument('abc,', 'abc'), false);
  });
});
