import type { ApplyDocumentResult } from '../training/trainingSession';

export type DocumentSyncPlan =
  | { shouldReplace: false }
  | { shouldReplace: true; moveCursorToEnd: false }
  | { shouldReplace: true; moveCursorToEnd: true; cursorOffset: number; cursorPosition: TextPosition };

export interface TextPosition {
  line: number;
  character: number;
}

export function planDocumentSync(
  result: ApplyDocumentResult,
  editorText: string,
  sessionText: string
): DocumentSyncPlan {
  if (!result.accepted && result.shouldRevert) {
    return {
      shouldReplace: true,
      moveCursorToEnd: false
    };
  }

  if (result.accepted && normalizeLineEndings(editorText) !== normalizeLineEndings(sessionText)) {
    return {
      shouldReplace: true,
      moveCursorToEnd: true,
      cursorOffset: sessionText.length,
      cursorPosition: positionAt(sessionText, sessionText.length)
    };
  }

  return {
    shouldReplace: false
  };
}

export function shouldRepaintSyncedDocument(editorText: string, sessionText: string): boolean {
  return normalizeLineEndings(editorText) === normalizeLineEndings(sessionText);
}

export function positionAtDocumentEnd(text: string): TextPosition {
  return positionAt(text, text.length);
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

function positionAt(text: string, offset: number): TextPosition {
  let line = 0;
  let character = 0;

  for (let index = 0; index < offset; index += 1) {
    if (text[index] === '\n') {
      line += 1;
      character = 0;
    } else {
      character += 1;
    }
  }

  return { line, character };
}
