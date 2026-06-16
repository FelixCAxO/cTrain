import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { suite, test } from 'mocha';
import { cursorPosition, normalizeLineEndings, typeText, waitForEditorText, waitForTrainingEditor } from './helpers';

suite('cTrain practice current file e2e', () => {
  test('starts a lesson from the whole active file when no text is selected', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const source = 'alpha beta gamma delta epsilon';
    const sourceDocument = await vscode.workspace.openTextDocument({
      content: source,
      language: 'plaintext'
    });
    const sourceEditor = await vscode.window.showTextDocument(sourceDocument, { preview: false });
    sourceEditor.selection = new vscode.Selection(0, 0, 0, 0);

    await vscode.commands.executeCommand('cTrain.practiceCurrentFile');

    const editor = await waitForTrainingEditor();
    await typeText(source);
    await waitForEditorText(editor, source);
    assert.equal(normalizeLineEndings(editor.document.getText()), source);
    assert.deepEqual(cursorPosition(editor), { line: 0, character: source.length });
  });

  test('starts a lesson from the current selection when text is selected', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const source = 'ignore this prefix\nselection target words here\nignore this suffix';
    const selectedText = 'selection target words here';
    const sourceDocument = await vscode.workspace.openTextDocument({
      content: source,
      language: 'plaintext'
    });
    const sourceEditor = await vscode.window.showTextDocument(sourceDocument, { preview: false });
    sourceEditor.selection = new vscode.Selection(1, 0, 1, selectedText.length);

    await vscode.commands.executeCommand('cTrain.practiceCurrentFile');

    const editor = await waitForTrainingEditor();
    await typeText(selectedText);
    await waitForEditorText(editor, selectedText);
    assert.equal(normalizeLineEndings(editor.document.getText()), selectedText);
  });
});
