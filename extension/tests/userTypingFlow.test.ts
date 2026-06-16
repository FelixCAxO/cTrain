import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { builtInLessons } from '../src/lessons/builtInLessons';
import { TrainingSession } from '../src/training/trainingSession';
import { planDocumentSync } from '../src/ui/documentSync';

describe('user typing flow', () => {
  it('keeps a fast next-line keystroke when it arrives before auto line sync', () => {
    const lesson = builtInLessons.find((item) => item.id === 'java-interface-04');
    assert.ok(lesson);

    const session = new TrainingSession(lesson);
    const firstLine = 'interface Greeter {';
    const initialText = session.documentText;
    let editorText = initialText;

    for (const char of firstLine.slice(0, -1)) {
      editorText += char;
      const result = session.applyDocumentText(editorText, [{ text: char, rangeLength: 0 }]);
      const syncPlan = planDocumentSync(result, editorText, session.documentText);
      if (syncPlan.shouldReplace) {
        editorText = session.documentText;
      }
    }

    editorText += '{';
    const lineComplete = session.applyDocumentText(editorText, [{ text: '{', rangeLength: 0 }]);
    const pendingAutoLineSync = planDocumentSync(lineComplete, editorText, session.documentText);
    assert.deepEqual(pendingAutoLineSync, {
      shouldReplace: true,
      moveCursorToEnd: true,
      cursorOffset: `${initialText}${firstLine}\n  `.length,
      cursorPosition: positionAt(`${initialText}${firstLine}\n  `)
    });

    editorText += 'S';
    const fastNextLineInput = session.applyDocumentText(editorText, [{ text: 'S', rangeLength: 0 }]);
    const syncAfterFastInput = planDocumentSync(fastNextLineInput, editorText, session.documentText);

    assert.equal(fastNextLineInput.accepted, true);
    assert.equal(session.documentText, `${initialText}${firstLine}\n  S`);
    assert.deepEqual(syncAfterFastInput, {
      shouldReplace: true,
      moveCursorToEnd: true,
      cursorOffset: `${initialText}${firstLine}\n  S`.length,
      cursorPosition: positionAt(`${initialText}${firstLine}\n  S`)
    });
    assert.deepEqual(session.ghostTextSegments[0], {
      line: positionAt(`${initialText}${firstLine}\n  S`).line,
      character: 3,
      contentText: 'tring greet(String name);'
    });

    editorText = session.documentText;
    const secondLine = '  String greet(String name);';
    for (const char of secondLine.slice('  S'.length)) {
      editorText += char;
      const result = session.applyDocumentText(editorText, [{ text: char, rangeLength: 0 }]);
      assert.equal(result.accepted, true, `should accept "${char}" while typing the second import`);

      const syncPlan = planDocumentSync(result, editorText, session.documentText);
      if (syncPlan.shouldReplace) {
        editorText = session.documentText;
      }
    }

    assert.equal(session.documentText, `${initialText}${firstLine}\n${secondLine}\n`);
    assert.deepEqual(session.ghostTextSegments[0], {
      line: positionAt(session.documentText).line,
      character: 0,
      contentText: '}'
    });
  });

  it('keeps the next-line keystroke when blank-line auto sync leaves the cursor on the skipped row', () => {
    const lesson = builtInLessons.find((item) => item.id === 'java-exceptions-try-catch-06');
    assert.ok(lesson);

    const session = new TrainingSession(lesson);
    const firstLine = 'import java.io.IOException;';
    const initialText = session.documentText;

    const editorFirstLine = `${initialText}${firstLine}`;
    const lineComplete = session.applyDocumentText(editorFirstLine, [{ text: ';', rangeLength: 0 }]);
    const pendingBlankLineSync = planDocumentSync(lineComplete, editorFirstLine, session.documentText);
    const afterFirstLine = `${initialText}${firstLine}\n\n`;
    assert.deepEqual(pendingBlankLineSync, {
      shouldReplace: true,
      moveCursorToEnd: true,
      cursorOffset: afterFirstLine.length,
      cursorPosition: positionAt(afterFirstLine)
    });
    assert.equal(session.documentText, afterFirstLine);

    const editorTextWithStrandedCursorInput = `${initialText}${firstLine}\nt\n`;
    const nextLineInput = session.applyDocumentText(
      editorTextWithStrandedCursorInput,
      [{ text: 't', rangeLength: 0 }]
    );
    const syncAfterNextLineInput = planDocumentSync(
      nextLineInput,
      editorTextWithStrandedCursorInput,
      session.documentText
    );

    assert.equal(nextLineInput.accepted, true);
    const afterFastInput = `${initialText}${firstLine}\n\nt`;
    assert.equal(session.documentText, afterFastInput);
    assert.deepEqual(syncAfterNextLineInput, {
      shouldReplace: true,
      moveCursorToEnd: true,
      cursorOffset: afterFastInput.length,
      cursorPosition: positionAt(afterFastInput)
    });
    assert.deepEqual(session.ghostTextSegments[0], {
      line: positionAt(afterFastInput).line,
      character: 1,
      contentText: 'ry {'
    });
  });
});

function positionAt(value: string): { line: number; character: number } {
  let line = 0;
  let character = 0;

  for (const char of value) {
    if (char === '\n') {
      line += 1;
      character = 0;
    } else {
      character += 1;
    }
  }

  return { line, character };
}
