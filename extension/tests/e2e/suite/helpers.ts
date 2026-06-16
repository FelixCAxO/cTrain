import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { renderLessonDocument } from '../../../src/contentProvider';
import { builtInLessons } from '../../../src/lessons/builtInLessons';
import type { Lesson } from '../../../src/lessons/schema';

export async function typeText(text: string): Promise<void> {
  for (const char of text) {
    await vscode.commands.executeCommand('type', { text: char });
  }
}

export async function pasteText(text: string): Promise<void> {
  await vscode.env.clipboard.writeText(text);
  await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
}

export async function waitForTrainingEditor(): Promise<vscode.TextEditor> {
  return waitFor('training editor to become active', () => {
    const editor = vscode.window.activeTextEditor;
    return editor?.document.uri.scheme === 'code-trainer' ? editor : undefined;
  });
}

export async function waitForEditorText(editor: vscode.TextEditor, expectedText: string): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 10_000) {
    if (normalizeLineEndings(editor.document.getText()) === expectedText) {
      return;
    }

    await delay(25);
  }

  throw new Error([
    'Timed out waiting for editor text.',
    `Expected: ${JSON.stringify(expectedText)}`,
    `Actual: ${JSON.stringify(editor.document.getText())}`,
    `Cursor: ${JSON.stringify(cursorPosition(editor))}`
  ].join('\n'));
}

export async function waitFor<T>(label: string, condition: () => T | undefined | false): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 10_000) {
    const result = condition();
    if (result !== undefined && result !== false) {
      return result;
    }

    await delay(25);
  }

  throw new Error(`Timed out waiting for ${label}`);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

export function cursorPosition(editor: vscode.TextEditor): { line: number; character: number } {
  const active = editor.selection.active;
  return {
    line: active.line,
    character: active.character
  };
}

export function findBuiltInLesson(predicate: (lesson: Lesson) => boolean, description: string): Lesson {
  const lesson = builtInLessons.find(predicate);
  assert.ok(lesson, `Expected built-in lesson for ${description}`);
  return lesson;
}

export function initialLessonText(lesson: Lesson): string {
  return renderLessonDocument(lesson);
}

export function firstTypeableCharacter(lesson: Lesson): string {
  const initialText = initialLessonText(lesson);
  const character = lesson.targetCode.slice(initialText.length)[0];
  assert.ok(character, `Expected lesson ${lesson.id} to have typeable text after initial comments`);
  return character;
}

export function positionAtTextEnd(value: string): { line: number; character: number } {
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
