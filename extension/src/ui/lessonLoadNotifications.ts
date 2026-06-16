import type * as vscode from 'vscode';
import type { LessonLoadError } from '../lessons/lessonLoader';

export function showLessonLoadErrors(
  errors: LessonLoadError[],
  scope: string,
  outputChannel: vscode.OutputChannel,
  showWarningMessage: (message: string, ...items: string[]) => Thenable<string | undefined>
): Thenable<string | undefined> | undefined {
  if (errors.length === 0) {
    return undefined;
  }

  outputChannel.appendLine(`cTrain skipped ${errors.length} ${scope} lesson ${errors.length === 1 ? 'file' : 'files'}:`);
  for (const error of errors) {
    outputChannel.appendLine(`- ${error.message}`);
  }

  return showWarningMessage(
    `cTrain skipped ${errors.length} ${scope} lesson ${errors.length === 1 ? 'file' : 'files'}. See the cTrain output for details.`,
    'Show Output'
  ).then((choice) => {
    if (choice === 'Show Output') {
      outputChannel.show(true);
    }
    return choice;
  });
}
