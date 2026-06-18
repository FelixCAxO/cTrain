import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { suite, test } from 'mocha';
import { builtInLessons } from '../../../src/lessons/builtInLessons';
import {
  cursorPosition,
  delay,
  findBuiltInLesson,
  firstTypeableCharacter,
  initialLessonText,
  positionAtTextEnd,
  pasteText,
  typeText,
  waitFor,
  waitForEditorText,
  waitForTrainingEditor
} from './helpers';

suite('cTrain session interactions e2e', () => {
  test('rejects a multi-character paste-style edit and restores the lesson document', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const lesson = builtInLessons[0]!;
    await vscode.commands.executeCommand('cTrain.startLesson', lesson.id);

    const editor = await waitForTrainingEditor();
    await pasteText('definitely not the target');
    await waitForEditorText(editor, initialLessonText(lesson));
  });

  test('accepts formatter-shaped indentation replacements in a current-file lesson', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const config = vscode.workspace.getConfiguration('editor');
    const previousAutoClosingBrackets = config.inspect<string>('autoClosingBrackets')?.globalValue;
    await config.update('autoClosingBrackets', 'never', vscode.ConfigurationTarget.Global);
    const sourceDocument = await vscode.workspace.openTextDocument({
      content: [
        'if (ready) {',
        '  return true;',
        '  }',
        'System.out.println(ready);'
      ].join('\n'),
      language: 'java'
    });
    try {
      await vscode.window.showTextDocument(sourceDocument, { preview: false });
      await vscode.commands.executeCommand('cTrain.practiceCurrentFile');

      const editor = await waitForTrainingEditor();
      await vscode.window.showTextDocument(editor.document, editor.viewColumn, false);
      await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
      await typeText('if (ready) {');
      await waitForEditorText(editor, 'if (ready) {\n  ');
      await typeText('return true;');
      await waitForEditorText(editor, 'if (ready) {\n  return true;\n  ');

      const replaced = await editor.edit((edit) => {
        edit.replace(new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 2)), '  }');
      });
      assert.equal(replaced, true);

      await waitForEditorText(editor, 'if (ready) {\n  return true;\n  }\n');
    } finally {
      await config.update('autoClosingBrackets', previousAutoClosingBrackets, vscode.ConfigurationTarget.Global);
    }
  });

  test('accepts a closing brace typed a few spaces before its auto-inserted target column', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const sourceDocument = await vscode.workspace.openTextDocument({
      content: [
        'if (x) { // Starts the guarded branch.',
        '    return true; // Returns from the branch.',
        '    }'
      ].join('\n'),
      language: 'java'
    });

    await vscode.window.showTextDocument(sourceDocument, { preview: false });
    await vscode.commands.executeCommand('cTrain.practiceCurrentFile');

    const editor = await waitForTrainingEditor();
    await vscode.window.showTextDocument(editor.document, editor.viewColumn, false);
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    await typeText('if (');
    await waitForEditorText(editor, 'if (');
    let prefix = 'if (';
    for (const char of 'x) ') {
      await typeText(char);
      prefix += char;
      await waitForEditorText(editor, prefix);
    }
    await typeText('{');
    await waitForEditorText(editor, 'if (x) { // Starts the guarded branch.\n    ');
    await typeText('return true;');
    await waitForEditorText(editor, 'if (x) { // Starts the guarded branch.\n    return true; // Returns from the branch.\n    ');

    const shortenedIndent = await editor.edit((edit) => {
      edit.delete(new vscode.Range(new vscode.Position(2, 2), new vscode.Position(2, 4)));
    });
    assert.equal(shortenedIndent, true);
    await waitForEditorText(editor, 'if (x) { // Starts the guarded branch.\n    return true; // Returns from the branch.\n  ');
    editor.selection = new vscode.Selection(new vscode.Position(2, 2), new vscode.Position(2, 2));

    await typeText('}');
    await waitForEditorText(editor, [
      'if (x) { // Starts the guarded branch.',
      '    return true; // Returns from the branch.',
      '    }'
    ].join('\n'));
    assert.deepEqual(cursorPosition(editor), { line: 2, character: 5 });
  });

  test('continues accepting input after cTrain decoration settings change mid-session', async () => {
    const lesson = findBuiltInLesson((item) => item.targetCode.length > 0, 'non-empty lesson');
    const initialText = initialLessonText(lesson);
    const firstCharacter = firstTypeableCharacter(lesson);
    const config = vscode.workspace.getConfiguration('cTrain');
    const previousOpacity = config.inspect<number>('ghostTextOpacity')?.globalValue;

    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.commands.executeCommand('cTrain.startLesson', lesson.id);

    try {
      await config.update('ghostTextOpacity', 0.7, vscode.ConfigurationTarget.Global);
      const editor = await waitForTrainingEditor();
      await typeText(firstCharacter);
      await waitForEditorText(editor, `${initialText}${firstCharacter}`);
    } finally {
      await config.update('ghostTextOpacity', previousOpacity, vscode.ConfigurationTarget.Global);
    }
  });

  test('cancels the lesson picker without opening a training editor', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');

    const start = vscode.commands.executeCommand('cTrain.startLesson');
    await delay(250);
    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
    await start;

    assert.equal(vscode.window.visibleTextEditors.some((editor) => editor.document.uri.scheme === 'code-trainer'), false);
    await waitFor('no active training editor after cancellation', () => (
      vscode.window.activeTextEditor?.document.uri.scheme === 'code-trainer' ? false : true
    ));
  });

  test('cancels the mock exam picker without opening a training editor', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');

    let examDone = false;
    const exam = Promise.resolve(vscode.commands.executeCommand('cTrain.mockExam')).finally(() => {
      examDone = true;
    });
    await delay(250);
    assert.equal(examDone, false);

    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
    await exam;

    assert.equal(vscode.window.visibleTextEditors.some((editor) => editor.document.uri.scheme === 'code-trainer'), false);
  });

  test('pauses and resumes the active training session without losing progress', async () => {
    const lesson = findBuiltInLesson((item) => item.id === 'java-method-return-02', 'Java method return lesson');
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.commands.executeCommand('cTrain.startLesson', lesson.id);

    const editor = await waitForTrainingEditor();
    await typeText('pub');
    const initialText = initialLessonText(lesson);
    await waitForEditorText(editor, `${initialText}pub`);

    await vscode.commands.executeCommand('cTrain.pauseSession');
    await typeText('l');
    await waitForEditorText(editor, `${initialText}pub`);

    await vscode.commands.executeCommand('cTrain.pauseSession');
    await typeText('l');
    await waitForEditorText(editor, `${initialText}publ`);
  });

  test('restarts the active training session in the same lesson editor', async () => {
    const lesson = findBuiltInLesson((item) => item.id === 'java-method-return-02', 'Java method return lesson');
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.commands.executeCommand('cTrain.startLesson', lesson.id);

    const editor = await waitForTrainingEditor();
    await typeText('pub');
    const initialText = initialLessonText(lesson);
    await waitForEditorText(editor, `${initialText}pub`);

    await vscode.commands.executeCommand('cTrain.restartSession');
    await waitForEditorText(editor, initialText);
    await waitForCursorPosition(editor, positionAtTextEnd(initialText));
    assert.equal(editor.document.uri.scheme, 'code-trainer');
  });

  test('restarts a current-file exercise with leading comments at the typeable cursor', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const sourceDocument = await vscode.workspace.openTextDocument({
      content: [
        '// LESSON: Reset Practice.',
        '// You will learn: restart from a generated header.',
        'class ResetPractice {',
        '}'
      ].join('\n'),
      language: 'java'
    });

    await vscode.window.showTextDocument(sourceDocument, { preview: false });
    await vscode.commands.executeCommand('cTrain.practiceCurrentFile');

    const editor = await waitForTrainingEditor();
    const initialText = [
      '// LESSON: Reset Practice.',
      '// You will learn: restart from a generated header.',
      ''
    ].join('\n');
    await waitForEditorText(editor, initialText);
    await waitForCursorPosition(editor, { line: 2, character: 0 });

    await typeText('c');
    await waitForEditorText(editor, `${initialText}c`);

    await vscode.commands.executeCommand('cTrain.restartSession');
    await waitForEditorText(editor, initialText);
    await waitForCursorPosition(editor, { line: 2, character: 0 });

    await typeText('c');
    await waitForEditorText(editor, `${initialText}c`);
  });
});

async function waitForCursorPosition(
  editor: vscode.TextEditor,
  expected: { line: number; character: number }
): Promise<void> {
  await waitFor(`cursor ${expected.line}:${expected.character}`, () => {
    const actual = cursorPosition(editor);
    return actual.line === expected.line && actual.character === expected.character;
  });
}
