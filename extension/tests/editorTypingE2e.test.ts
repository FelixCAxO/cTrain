import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { builtInLessons } from '../src/lessons/builtInLessons';
import { TrainingSession } from '../src/training/trainingSession';
import { planDocumentSync, type DocumentSyncPlan } from '../src/ui/documentSync';

interface EditorState {
  text: string;
  cursorOffset: number;
  cursorPosition: { line: number; character: number };
}

describe('editor typing e2e flow', () => {
  it('follows the lesson cursor through an auto-skipped blank row', () => {
    const lesson = builtInLessons.find((item) => item.id === 'java-exceptions-try-catch-06');
    assert.ok(lesson);

    const session = new TrainingSession(lesson);
    const editor: EditorState = {
      text: session.documentText,
      cursorOffset: session.documentText.length,
      cursorPosition: positionAt(session.documentText, session.documentText.length)
    };
    const initialText = session.documentText;

    for (const char of 'import java.io.IOException;') {
      typeCharacter(editor, session, char);
    }

    const afterImport = `${initialText}import java.io.IOException;\n\n`;
    assert.equal(String(editor.text), afterImport);
    assert.equal(editor.cursorOffset, String(editor.text).length);
    assert.deepEqual(editor.cursorPosition, positionAt(afterImport, afterImport.length));
    assert.deepEqual(positionAt(editor.text, editor.cursorOffset), positionAt(afterImport, afterImport.length));

    for (const char of 'try') {
      typeCharacter(editor, session, char);
    }

    const afterTry = `${afterImport}try`;
    assert.equal(String(editor.text), afterTry);
    assert.equal(editor.cursorOffset, String(editor.text).length);
    assert.deepEqual(editor.cursorPosition, positionAt(afterTry, afterTry.length));
    assert.deepEqual(positionAt(editor.text, editor.cursorOffset), positionAt(afterTry, afterTry.length));
    assert.equal(session.ghostTextSegments[0]?.contentText, ' {');
  });
});

function typeCharacter(editor: EditorState, session: TrainingSession, char: string): void {
  const nextText = insertAt(editor.text, editor.cursorOffset, char);
  const result = session.applyDocumentText(nextText, [{ text: char, rangeLength: 0 }]);
  const syncPlan = planDocumentSync(result, nextText, session.documentText);

  assert.equal(result.accepted, true, `should accept "${char}" at ${editor.cursorOffset}`);
  applySyncPlan(editor, nextText, session.documentText, syncPlan, char.length);
}

function applySyncPlan(
  editor: EditorState,
  acceptedEditorText: string,
  sessionText: string,
  syncPlan: DocumentSyncPlan,
  typedLength: number
): void {
  if (syncPlan.shouldReplace) {
    if (!syncPlan.moveCursorToEnd) {
      assert.fail('accepted editor sync should carry a cursor target after replacement');
    }
    editor.text = sessionText;
    editor.cursorOffset = syncPlan.cursorOffset;
    editor.cursorPosition = syncPlan.cursorPosition;
    return;
  }

  editor.text = acceptedEditorText;
  editor.cursorOffset += typedLength;
  editor.cursorPosition = positionAt(editor.text, editor.cursorOffset);
}

function insertAt(value: string, offset: number, text: string): string {
  return value.slice(0, offset) + text + value.slice(offset);
}

function positionAt(value: string, offset: number): { line: number; character: number } {
  let line = 0;
  let character = 0;

  for (let index = 0; index < offset; index += 1) {
    if (value[index] === '\n') {
      line += 1;
      character = 0;
    } else {
      character += 1;
    }
  }

  return { line, character };
}
