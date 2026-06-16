import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { suite, test } from 'mocha';
import { programmingSymbols } from '../../programmingSymbols';
import {
  cursorPosition,
  findBuiltInLesson,
  initialLessonText,
  normalizeLineEndings,
  positionAtTextEnd,
  typeText,
  waitForEditorText,
  waitForTrainingEditor
} from './helpers';

suite('cTrain start lesson e2e', () => {
  test('starts and types a Java built-in lesson with auto-skipped blank rows', async () => {
    const lesson = findBuiltInLesson((item) => item.targetCode.includes('import java.io.IOException;\n\ntry'), 'blank-row Java lesson');
    const initialText = initialLessonText(lesson);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.commands.executeCommand('cTrain.startLesson', lesson.id);

    const editor = await waitForTrainingEditor();
    await vscode.window.showTextDocument(editor.document, editor.viewColumn, false);
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    await typeText('import java.io.IOException;t');

    const expectedText = `${initialText}import java.io.IOException;\n\nt`;
    await waitForEditorText(editor, expectedText);
    assert.equal(normalizeLineEndings(editor.document.getText()), expectedText);
    assert.deepEqual(cursorPosition(editor), positionAtTextEnd(expectedText));
  });

  test('keeps a fast first import character when it arrives before blank-row sync settles', async () => {
    const lesson = findBuiltInLesson((item) => item.targetCode.includes('import java.io.IOException;\n\ntry'), 'blank-row try lesson');
    const initialText = initialLessonText(lesson);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const sourceDocument = await vscode.workspace.openTextDocument({
      content: lesson.targetCode,
      language: 'java'
    });
    await vscode.window.showTextDocument(sourceDocument, { preview: false });
    await vscode.commands.executeCommand('cTrain.practiceCurrentFile');

    const editor = await waitForTrainingEditor();
    await vscode.window.showTextDocument(editor.document, editor.viewColumn, false);
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    await typeText('import java.io.IOException;t');

    const expectedText = `${initialText}import java.io.IOException;\n\nt`;
    await waitForEditorText(editor, expectedText);
    assert.equal(normalizeLineEndings(editor.document.getText()), expectedText);
    assert.deepEqual(cursorPosition(editor), positionAtTextEnd(expectedText));
  });

  test('keeps the real editor cursor after an auto-skipped blank row', async () => {
    const lesson = findBuiltInLesson((item) => item.targetCode.includes('import java.io.IOException;\n\ntry'), 'blank-row try lesson');
    const initialText = initialLessonText(lesson);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const sourceDocument = await vscode.workspace.openTextDocument({
      content: lesson.targetCode,
      language: 'java'
    });
    await vscode.window.showTextDocument(sourceDocument, { preview: false });
    await vscode.commands.executeCommand('cTrain.practiceCurrentFile');

    const editor = await waitForTrainingEditor();
    await vscode.window.showTextDocument(editor.document, editor.viewColumn, false);
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    await typeText('import java.io.IOException;');

    const afterImport = `${initialText}import java.io.IOException;\n\n`;
    await waitForEditorText(editor, afterImport);
    assert.equal(normalizeLineEndings(editor.document.getText()), afterImport);
    assert.deepEqual(cursorPosition(editor), positionAtTextEnd(afterImport));

    await typeText('t');
    const afterT = `${afterImport}t`;
    await waitForEditorText(editor, afterT);
    assert.equal(normalizeLineEndings(editor.document.getText()), afterT);
    assert.deepEqual(cursorPosition(editor), positionAtTextEnd(afterT));

    await typeText('ry');

    const afterTry = `${afterImport}try`;
    await waitForEditorText(editor, afterTry);
    assert.equal(normalizeLineEndings(editor.document.getText()), afterTry);
    assert.deepEqual(cursorPosition(editor), positionAtTextEnd(afterTry));
  });

  test('lets current-file annotation markers follow auto-skipped indentation', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const sourceDocument = await vscode.workspace.openTextDocument({
      content: [
        'public class Demo {',
        '',
        '  @Override',
        '  public String toString() {',
        '    return "demo";',
        '  }',
        '}'
      ].join('\n'),
      language: 'java'
    });
    await vscode.window.showTextDocument(sourceDocument, { preview: false });
    await vscode.commands.executeCommand('cTrain.practiceCurrentFile');

    const editor = await waitForTrainingEditor();
    await vscode.window.showTextDocument(editor.document, editor.viewColumn, false);
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    await typeText('public class Demo {@');

    await waitForEditorText(editor, 'public class Demo {\n\n  @');
    assert.equal(normalizeLineEndings(editor.document.getText()), 'public class Demo {\n\n  @');
    assert.deepEqual(cursorPosition(editor), { line: 2, character: 3 });
  });

  test('types programming symbols in a current-file lesson', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const config = vscode.workspace.getConfiguration('editor');
    const previousAutoClosingBrackets = config.inspect<string>('autoClosingBrackets')?.globalValue;
    const previousAutoClosingQuotes = config.inspect<string>('autoClosingQuotes')?.globalValue;
    await config.update('autoClosingBrackets', 'never', vscode.ConfigurationTarget.Global);
    await config.update('autoClosingQuotes', 'never', vscode.ConfigurationTarget.Global);
    const symbolLine = programmingSymbols;
    const sourceDocument = await vscode.workspace.openTextDocument({
      content: symbolLine,
      language: 'java'
    });
    try {
      await vscode.window.showTextDocument(sourceDocument, { preview: false });
      await vscode.commands.executeCommand('cTrain.practiceCurrentFile');

      const editor = await waitForTrainingEditor();
      await vscode.window.showTextDocument(editor.document, editor.viewColumn, false);
      await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
      await typeText(symbolLine);

      await waitForEditorText(editor, symbolLine);
      assert.equal(normalizeLineEndings(editor.document.getText()), symbolLine);
      assert.deepEqual(cursorPosition(editor), { line: 0, character: symbolLine.length });
    } finally {
      await config.update('autoClosingBrackets', previousAutoClosingBrackets, vscode.ConfigurationTarget.Global);
      await config.update('autoClosingQuotes', previousAutoClosingQuotes, vscode.ConfigurationTarget.Global);
    }
  });
});
