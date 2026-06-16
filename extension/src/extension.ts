import * as vscode from 'vscode';
import { createLessonUriString } from './contentProvider';
import {
  createCompletionCheckItems,
  createCompletionSummary,
  findNextLesson,
  formatCompletionCheckFeedback
} from './commands/completionActions';
import {
  collectMockExamQuestions,
  createMockExamCompletionCheckAnswerRecords,
  createMockExamAttempt,
  createMockExamReviewItems,
  formatMockExamSummary,
  mockExamDurationMs,
  mockExamQuestionCount,
  selectMockExamQuestions
} from './commands/mockExam';
import { createExtensionModel } from './extensionModel';
import { builtInLessonLoadResult, builtInLessons } from './lessons/builtInLessons';
import { loadWorkspaceLessonFiles, mergeLessonLists, sortLessonsForPicker } from './lessons/lessonLoader';
import type { Lesson, LessonListItem } from './lessons/schema';
import { createPickerItems, formatLessonPickerTitle } from './ui/lessonPicker';
import { ProgressStore, type LessonStatusSummary } from './progress/progressStore';
import { collectDueCompletionCheckReviews } from './progress/spacedRepetition';
import { calculateFinalWeekBlindSpots, calculateMockExamReadiness, calculateSprintProgress } from './progress/readiness';
import { formatMistakeHoverMessage, TrainingSession } from './training/trainingSession';
import { buildGhostDecorationSpec, buildMistakeDecorationSpec, planGhostDecorations, visibleGhostTextSegments } from './ui/ghostDecoration';
import { planDocumentSync, positionAtDocumentEnd, shouldRepaintSyncedDocument } from './ui/documentSync';
import { formatPausedStatusBarText, formatStatusBarAccessibilityLabel, formatStatusBarText } from './ui/statusBar';
import { applyTrainingLanguageToDocument, createLessonFromEditorSource, isKnownTrainingLanguageId, resolveTrainingLanguageId, trimPracticeSourceText, validatePracticeSourceText } from './training/sourceLesson';
import { formatStreakReminder, shouldShowStreakReminder } from './progress/streakReminder';
import { createSerializedTaskQueue } from './serializedTaskQueue';
import { CodeTrainerFileSystemProvider } from './training/codeTrainerFileSystemProvider';
import { LessonTreeDataProvider } from './ui/lessonTreeView';
import { showLessonLoadErrors } from './ui/lessonLoadNotifications';
import { enrichLessonStatus } from './commands/lessonSelection';

const sessions = new Map<string, TrainingSession>();
const revertingDocuments = new Set<string>();
const documentChangeQueue = createSerializedTaskQueue();
const pausedSessions = new Set<string>();
const lastGhostKeys = new Map<string, string>();

let ghostDecoration: vscode.TextEditorDecorationType | undefined;
let mistakeDecoration: vscode.TextEditorDecorationType | undefined;
let statusBar: vscode.StatusBarItem | undefined;
let lessonTreeDataProvider: LessonTreeDataProvider | undefined;
let statusTick: NodeJS.Timeout | undefined;
let outputChannel: vscode.OutputChannel | undefined;
let sourcePracticeSessionCounter = 0;

interface QueuedTrainingDocumentChange {
  key: string;
  session: TrainingSession;
  documentText: string;
  changes: {
    text: string;
    rangeLength: number;
    rangeOffset: number;
    reason: vscode.TextDocumentChangeReason | undefined;
  }[];
  progressStore: ProgressStore;
  fileSystemProvider: CodeTrainerFileSystemProvider;
}

type TimedQuickPickResult<T> =
  | { kind: 'selected'; item: T }
  | { kind: 'cancelled' }
  | { kind: 'timed-out' };

export function activate(context: vscode.ExtensionContext): void {
  const fileSystemProvider = new CodeTrainerFileSystemProvider();
  const progressStore = new ProgressStore(context.globalState);
  outputChannel = vscode.window.createOutputChannel('cTrain');
  context.subscriptions.push(outputChannel);

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  resetStatusBar();
  context.subscriptions.push(statusBar);

  refreshDecorationTypes();
  context.subscriptions.push(new vscode.Disposable(disposeDecorationTypes));
  lessonTreeDataProvider = new LessonTreeDataProvider(progressStore, reportError);
  void showLessonLoadErrors(
    builtInLessonLoadResult.errors,
    'built-in',
    outputChannel,
    (message, ...items) => vscode.window.showWarningMessage(message, ...items)
  );

  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider('code-trainer', fileSystemProvider, {
      isCaseSensitive: true
    }),
    vscode.window.registerTreeDataProvider('cTrain.lessons', lessonTreeDataProvider),
    vscode.commands.registerCommand('cTrain.startLesson', async (lessonId?: string) => {
      await runSafely('Failed to start cTrain lesson', async () => {
        const selectedLesson = await selectLesson(progressStore, lessonId);
        if (selectedLesson === undefined) {
          return;
        }

        await openTrainingSession(selectedLesson, fileSystemProvider);
      });
    }),
    vscode.commands.registerCommand('cTrain.practiceCurrentFile', async () => {
      await runSafely('Failed to practice the current file with cTrain', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor === undefined) {
          void vscode.window.showWarningMessage('cTrain needs an active editor to practice the current file.');
          return;
        }

        const selectedText = getSelectedText(editor);
        let sourceText = selectedText ?? editor.document.getText();
        const validation = validatePracticeSourceText(sourceText);
        if (!validation.ok) {
          if (validation.reason === 'too-large') {
            const choice = await vscode.window.showWarningMessage(validation.message, 'Trim to First 20,000 Chars', 'Practice Anyway');
            if (choice === 'Trim to First 20,000 Chars') {
              sourceText = trimPracticeSourceText(sourceText);
            } else if (choice !== 'Practice Anyway') {
              return;
            }
          } else {
            void vscode.window.showWarningMessage(validation.message);
            return;
          }
        }

        if (!isKnownTrainingLanguageId(editor.document.languageId)) {
          void vscode.window.showWarningMessage(`cTrain will practice this file as ${editor.document.languageId}, but syntax highlighting may be limited.`);
        }

        const lesson = createLessonFromEditorSource({
          fileName: editor.document.fileName,
          languageId: editor.document.languageId,
          fullText: selectedText === undefined ? sourceText : editor.document.getText(),
          selectedText: selectedText === undefined ? undefined : sourceText,
          sourceSessionId: String(++sourcePracticeSessionCounter)
        });

        await openTrainingSession(lesson, fileSystemProvider);
      });
    }),
    vscode.commands.registerCommand('cTrain.mockExam', async () => {
      await runSafely('Failed to run cTrain mock exam', async () => {
        await showMockExam(progressStore);
      });
    }),
    vscode.commands.registerCommand('cTrain.pauseSession', async () => {
      await runSafely('Failed to pause cTrain session', async () => {
        toggleActiveSessionPause();
      });
    }),
    vscode.commands.registerCommand('cTrain.restartSession', async () => {
      await runSafely('Failed to restart cTrain session', async () => {
        await restartActiveSession(fileSystemProvider);
      });
    }),
    vscode.commands.registerCommand('cTrain.sessionActions', async () => {
      await runSafely('Failed to run cTrain session action', async () => {
        await showSessionActions(fileSystemProvider);
      });
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const key = event.document.uri.toString();
      const session = sessions.get(key);
      if (session === undefined || revertingDocuments.has(key)) {
        return;
      }

      const documentText = event.document.getText();
      const changes = event.contentChanges.map((change) => ({
          text: change.text,
          rangeLength: change.rangeLength,
          rangeOffset: change.rangeOffset,
          reason: event.reason
        }));

      void documentChangeQueue.enqueue(key, async () => {
        await handleTrainingDocumentChange({
          key,
          session,
          documentText,
          changes,
          progressStore,
          fileSystemProvider
        });
      }).catch((error: unknown) => {
        reportError('Failed to process cTrain document changes', error);
      });
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor === undefined) {
        resetStatusBar();
        return;
      }

      const session = sessions.get(editor.document.uri.toString());
      if (session !== undefined) {
        lastGhostKeys.delete(editor.document.uri.toString());
        updateEditorDecorations(editor, session);
      } else {
        resetStatusBar();
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('cTrain')) {
        refreshDecorationTypes();
        const editor = vscode.window.activeTextEditor;
        const session = editor === undefined ? undefined : sessions.get(editor.document.uri.toString());
        if (editor !== undefined && session !== undefined) {
          updateEditorDecorations(editor, session);
        }
      }
    })
  );

  statusTick = setInterval(() => {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
      return;
    }
    const key = editor.document.uri.toString();
    const session = sessions.get(key);
    if (session === undefined || pausedSessions.has(key)) {
      return;
    }

    session.tick();
    updateEditorDecorations(editor, session);
  }, 500);
  statusTick.unref();
  context.subscriptions.push(new vscode.Disposable(() => {
    if (statusTick !== undefined) {
      clearInterval(statusTick);
      statusTick = undefined;
    }
  }));

  void runSafely('Failed to show cTrain streak reminder', async () => {
    await showStreakReminder(progressStore);
  });
}

export function deactivate(): void {
  if (statusTick !== undefined) {
    clearInterval(statusTick);
    statusTick = undefined;
  }
  disposeDecorationTypes();
}

async function selectLesson(progressStore: ProgressStore, requestedLessonId?: string): Promise<Lesson | undefined> {
  const builtIns: LessonListItem[] = builtInLessons.map((lesson) => ({ lesson, source: 'built-in' }));
  const loaded = mergeLessonLists(builtIns, loadWorkspaceLessons());
  const lessons: LessonListItem[] = sortLessonsForPicker(loaded.lessons);

  void showLessonLoadErrors(
    loaded.errors,
    'duplicate',
    getOutputChannel(),
    (message, ...items) => vscode.window.showWarningMessage(message, ...items)
  );

  if (requestedLessonId !== undefined) {
    return lessons.find((item) => item.lesson.id === requestedLessonId)?.lesson;
  }

  const progress = await progressStore.load();
  const statuses = new Map<string, LessonStatusSummary>();
  for (const item of lessons) {
    const status = await progressStore.getLessonStatus(item.lesson.id, item.lesson.version);
    statuses.set(item.lesson.id, enrichLessonStatus(item.lesson, status, progress, builtInLessons));
  }
  const completedCount = lessons.filter((item) => progress.lessons[item.lesson.id]?.lessonVersion === item.lesson.version).length;
  const pickerItems = createPickerItems(lessons, statuses).map((item) => item.kind === -1
    ? { ...item, kind: vscode.QuickPickItemKind.Separator }
    : item);

  const picked = await vscode.window.showQuickPick(pickerItems, {
    title: formatLessonPickerTitle(
      completedCount,
      lessons.length,
      progress.currentStreak,
      calculateSprintProgress(progress)
    ),
    placeHolder: 'Choose a typing lesson',
    matchOnDescription: true,
    matchOnDetail: true
  });

  return picked === undefined ? undefined : lessons.find((item) => item.lesson.id === picked.lessonId)?.lesson;
}

function loadWorkspaceLessons(): LessonListItem[] {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const lessons: LessonListItem[] = [];
  const errors: ReturnType<typeof loadWorkspaceLessonFiles>['errors'] = [];

  for (const folder of folders) {
    const result = loadWorkspaceLessonFiles(folder.uri.fsPath);
    lessons.push(...result.lessons);
    errors.push(...result.errors);
  }

  void showLessonLoadErrors(
    errors,
    'workspace',
    getOutputChannel(),
    (message, ...items) => vscode.window.showWarningMessage(message, ...items)
  );

  return lessons;
}

async function handleTrainingDocumentChange(change: QueuedTrainingDocumentChange): Promise<void> {
  const { key, session, documentText, changes, progressStore, fileSystemProvider } = change;
  if (sessions.get(key) !== session) {
    return;
  }

  try {
    if (pausedSessions.has(key)) {
      const editor = findVisibleEditor(key);
      if (editor !== undefined && documentText !== session.documentText) {
        await replaceEditorDocumentText(key, editor, session.documentText, {});
        updateEditorDecorations(editor, session);
      }
      return;
    }

    const config = readSettings();
    const result = session.applyDocumentText(documentText, changes, { allowPaste: config.allowPaste });

    if (!result.accepted && result.shouldRevert && result.reason === 'paste') {
      void vscode.window.showInformationMessage(result.feedback);
    }

    const syncPlan = planDocumentSync(result, documentText, session.documentText);
    if (syncPlan.shouldReplace) {
      const editor = findVisibleEditor(key);
      if (editor !== undefined) {
        await replaceEditorDocumentText(key, editor, session.documentText, {
          cursorPosition: syncPlan.moveCursorToEnd ? syncPlan.cursorPosition : undefined
        });
      }
    }

    updateVisibleEditorDecorationsIfCurrent(key, session);

    const completionRecord = session.consumeCompletionRecord();
    if (completionRecord !== undefined) {
      const previousProgress = await progressStore.load();
      const previousBestWpm = previousProgress.lessons[completionRecord.lessonId]?.bestWpm;
      await progressStore.recordCompletion(completionRecord);
      const updatedProgress = await progressStore.load();
      lessonTreeDataProvider?.refresh();
      await showCompletionActions(session.lesson, completionRecord, fileSystemProvider, progressStore, {
        previousBestWpm,
        currentStreak: updatedProgress.currentStreak
      });
    }
  } catch (error) {
    clearTrainingSession(key);
    throw error;
  }
}

function updateVisibleEditorDecorationsIfCurrent(key: string, session: TrainingSession): void {
  if (sessions.get(key) !== session) {
    return;
  }

  const editor = findVisibleEditor(key);
  if (editor === undefined || !shouldRepaintSyncedDocument(editor.document.getText(), session.documentText)) {
    return;
  }

  updateEditorDecorations(editor, session);
}

async function showCompletionActions(
  lesson: Lesson,
  record: ReturnType<TrainingSession['createCompletionRecord']>,
  fileSystemProvider: CodeTrainerFileSystemProvider,
  progressStore: ProgressStore,
  context: { previousBestWpm?: number; currentStreak: number }
): Promise<void> {
  await showCompletionChecks(lesson, progressStore);
  await showDueCompletionCheckReviews(progressStore);

  const nextLesson = findNextLesson(lesson, builtInLessons);
  const actions = nextLesson === undefined ? ['Retry'] : ['Next Lesson', 'Retry'];
  const choice = await vscode.window.showInformationMessage(
    createCompletionSummary(record, context),
    ...actions
  );

  if (choice === 'Retry') {
    await openTrainingSession(lesson, fileSystemProvider);
    return;
  }

  if (choice === 'Next Lesson' && nextLesson !== undefined) {
    await openTrainingSession(nextLesson, fileSystemProvider);
  }
}

async function showCompletionChecks(lesson: Lesson, progressStore: ProgressStore): Promise<void> {
  for (const [checkIndex, check] of (lesson.completionChecks ?? []).entries()) {
    const choice = await vscode.window.showQuickPick(createCompletionCheckItems(check, { random: Math.random }), {
      placeHolder: check.prompt
    });

    if (choice !== undefined) {
      await progressStore.recordCompletionCheckAnswer({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        checkIndex,
        check,
        selectedChoiceIndex: choice.choiceIndex,
        answeredAt: new Date().toISOString(),
        source: 'lesson'
      });
      await vscode.window.showInformationMessage(formatCompletionCheckFeedback(check, choice.choiceIndex));
    }
  }
}

async function showDueCompletionCheckReviews(progressStore: ProgressStore): Promise<void> {
  const progress = await progressStore.load();
  const dueReviews = collectDueCompletionCheckReviews(progress);
  for (const due of dueReviews) {
    const check = {
      prompt: due.review.prompt,
      choices: due.review.choices,
      answerIndex: due.review.answerIndex,
      explanation: due.review.explanation
    };
    const choice = await vscode.window.showQuickPick(createCompletionCheckItems(check, { random: Math.random }), {
      title: `Spaced Review: ${due.review.lessonTitle}`,
      placeHolder: check.prompt
    });

    if (choice !== undefined) {
      await progressStore.recordCompletionCheckAnswer({
        lessonId: due.review.lessonId,
        lessonTitle: due.review.lessonTitle,
        checkIndex: due.review.checkIndex,
        check,
        selectedChoiceIndex: choice.choiceIndex,
        answeredAt: new Date().toISOString(),
        source: 'review'
      });
      await vscode.window.showInformationMessage(formatCompletionCheckFeedback(check, choice.choiceIndex));
    }
  }
}

async function showMockExam(progressStore: ProgressStore): Promise<void> {
  const bank = collectMockExamQuestions(builtInLessons);
  if (bank.length === 0) {
    void vscode.window.showWarningMessage('cTrain has no completion checks available for a mock exam.');
    return;
  }

  const questions = selectMockExamQuestions(bank, Math.min(mockExamQuestionCount, bank.length));
  const startedAt = new Date();
  const startedAtMs = startedAt.getTime();
  const selectedChoiceIndexesByQuestionId = new Map<string, number>();

  for (const [index, question] of questions.entries()) {
    const remainingMs = mockExamDurationMs - (Date.now() - startedAtMs);
    if (remainingMs <= 0) {
      void vscode.window.showInformationMessage('Mock exam time expired. Unanswered questions count as incorrect.');
      break;
    }

    const result = await showTimedQuickPick(
      createCompletionCheckItems(question.check, { random: Math.random }),
      {
        title: `Mock Exam ${index + 1}/${questions.length}`,
        placeHolder: question.check.prompt
      },
      remainingMs
    );

    if (result.kind === 'timed-out') {
      void vscode.window.showInformationMessage('Mock exam time expired. Unanswered questions count as incorrect.');
      break;
    }

    if (result.kind === 'cancelled') {
      return;
    }

    selectedChoiceIndexesByQuestionId.set(question.id, result.item.choiceIndex);
  }

  const completedAt = new Date().toISOString();
  const attempt = createMockExamAttempt({
    questions,
    selectedChoiceIndexesByQuestionId,
    startedAt: startedAt.toISOString(),
    completedAt
  });
  const missedReviewRecords = createMockExamCompletionCheckAnswerRecords({
    questions,
    selectedChoiceIndexesByQuestionId,
    answeredAt: completedAt
  });
  await progressStore.recordMockExamAttempt(attempt);
  for (const record of missedReviewRecords) {
    await progressStore.recordCompletionCheckAnswer(record);
  }
  const progress = await progressStore.load();
  const readiness = calculateMockExamReadiness(progress);
  const blindSpots = calculateFinalWeekBlindSpots(progress);

  const actions = attempt.wrongAnswers.length > 0 ? ['Review Missed Questions'] : [];
  const action = await vscode.window.showInformationMessage(
    formatMockExamSummary(attempt, { readiness, blindSpots }),
    ...actions
  );
  if (action !== 'Review Missed Questions') {
    return;
  }

  const reviewItem = await vscode.window.showQuickPick(createMockExamReviewItems(attempt.wrongAnswers), {
    title: 'Mock Exam Review',
    placeHolder: 'Choose a missed question'
  });
  if (reviewItem !== undefined) {
    await vscode.window.showInformationMessage(reviewItem.wrongAnswer.explanation);
  }
}

function showTimedQuickPick<T extends vscode.QuickPickItem>(
  items: readonly T[],
  options: { title: string; placeHolder: string },
  timeoutMs: number
): Promise<TimedQuickPickResult<T>> {
  if (timeoutMs <= 0) {
    return Promise.resolve({ kind: 'timed-out' });
  }

  return new Promise((resolve) => {
    const picker = vscode.window.createQuickPick<T>();
    const disposables: vscode.Disposable[] = [];
    let settled = false;

    picker.items = items.slice();
    picker.title = options.title;
    picker.placeholder = options.placeHolder;

    const timer = setTimeout(() => {
      settle({ kind: 'timed-out' });
    }, timeoutMs);

    const settle = (result: TimedQuickPickResult<T>): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      for (const disposable of disposables) {
        disposable.dispose();
      }
      picker.hide();
      picker.dispose();
      resolve(result);
    };

    disposables.push(
      picker.onDidAccept(() => {
        const item = picker.selectedItems[0];
        settle(item === undefined ? { kind: 'cancelled' } : { kind: 'selected', item });
      }),
      picker.onDidHide(() => {
        settle({ kind: 'cancelled' });
      })
    );

    picker.show();
  });
}

async function showStreakReminder(progressStore: ProgressStore): Promise<void> {
  const progress = await progressStore.load();
  if (!shouldShowStreakReminder(progress)) {
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    formatStreakReminder(progress.currentStreak),
    'Start Lesson',
    'Not Today'
  );
  if (choice === 'Start Lesson') {
    await vscode.commands.executeCommand('cTrain.startLesson');
  } else if (choice === 'Not Today') {
    await progressStore.snoozeStreakReminder();
  }
}

function resetStatusBar(): void {
  if (statusBar === undefined) {
    return;
  }

  statusBar.command = 'cTrain.startLesson';
  statusBar.text = 'cTrain: Start Lesson';
  statusBar.backgroundColor = undefined;
  statusBar.accessibilityInformation = {
    label: 'cTrain start lesson'
  };
  statusBar.show();
}

function getOutputChannel(): vscode.OutputChannel {
  if (outputChannel === undefined) {
    outputChannel = vscode.window.createOutputChannel('cTrain');
  }

  return outputChannel;
}

function readSettings(): ReturnType<typeof createExtensionModel>['options'] {
  const config = vscode.workspace.getConfiguration('cTrain');
  return createExtensionModel({
    ghostTextOpacity: config.get<number>('ghostTextOpacity'),
    mistakeStyle: config.get<string>('mistakeStyle'),
    allowPaste: config.get<boolean>('allowPaste')
  }).options;
}

async function openTrainingSession(
  lesson: Lesson,
  fileSystemProvider: CodeTrainerFileSystemProvider
): Promise<void> {
  const uri = vscode.Uri.parse(createLessonUriString(lesson.id));
  const key = uri.toString();
  const session = new TrainingSession(lesson);
  sessions.set(key, session);
  pausedSessions.delete(key);
  lastGhostKeys.delete(key);
  fileSystemProvider.seed(uri, session.documentText);

  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const languageDocument = await applyTrainingLanguageToDocument(
      document,
      resolveTrainingLanguageId(lesson),
      (openedDocument, languageId) => vscode.languages.setTextDocumentLanguage(openedDocument, languageId)
    );
    const editor = await vscode.window.showTextDocument(languageDocument, { preview: false });
    const initialCursor = initialLessonCursorPosition(session);
    if (!shouldRepaintSyncedDocument(editor.document.getText(), session.documentText)) {
      await replaceEditorDocumentText(key, editor, session.documentText, {
        cursorPosition: initialCursor
      });
    } else if (initialCursor !== undefined) {
      moveEditorCursor(editor, initialCursor);
    }
    updateEditorDecorations(editor, session);
  } catch (error) {
    sessions.delete(key);
    fileSystemProvider.delete(uri);
    resetStatusBar();
    throw error;
  }
}

function getSelectedText(editor: vscode.TextEditor): string | undefined {
  const selections = editor.selections
    .filter((selection) => !selection.isEmpty)
    .map((selection) => editor.document.getText(selection));

  if (selections.length === 0) {
    return undefined;
  }

  return selections.join('\n');
}

function getActiveSessionEntry(): { key: string; editor: vscode.TextEditor; session: TrainingSession } | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return undefined;
  }

  const key = editor.document.uri.toString();
  const session = sessions.get(key);
  return session === undefined ? undefined : { key, editor, session };
}

function toggleActiveSessionPause(): void {
  const active = getActiveSessionEntry();
  if (active === undefined) {
    void vscode.window.showWarningMessage('cTrain has no active session to pause.');
    return;
  }

  if (pausedSessions.has(active.key)) {
    pausedSessions.delete(active.key);
  } else {
    pausedSessions.add(active.key);
  }

  updateEditorDecorations(active.editor, active.session);
}

async function restartActiveSession(fileSystemProvider: CodeTrainerFileSystemProvider): Promise<void> {
  const active = getActiveSessionEntry();
  if (active === undefined) {
    void vscode.window.showWarningMessage('cTrain has no active session to restart.');
    return;
  }

  const restarted = active.session.reset();
  sessions.set(active.key, restarted);
  pausedSessions.delete(active.key);
  lastGhostKeys.delete(active.key);
  fileSystemProvider.seed(active.editor.document.uri, restarted.documentText);
  await replaceEditorDocumentText(active.key, active.editor, restarted.documentText, {
    cursorPosition: initialLessonCursorPosition(restarted)
  });
  updateEditorDecorations(active.editor, restarted);
}

async function showSessionActions(fileSystemProvider: CodeTrainerFileSystemProvider): Promise<void> {
  const active = getActiveSessionEntry();
  if (active === undefined) {
    await vscode.commands.executeCommand('cTrain.startLesson');
    return;
  }

  const pauseLabel = pausedSessions.has(active.key) ? 'Resume Session' : 'Pause Session';
  const choice = await vscode.window.showQuickPick([pauseLabel, 'Restart Session', 'Start Another Lesson'], {
    title: 'cTrain Session Actions'
  });

  if (choice === pauseLabel) {
    toggleActiveSessionPause();
  } else if (choice === 'Restart Session') {
    await restartActiveSession(fileSystemProvider);
  } else if (choice === 'Start Another Lesson') {
    await vscode.commands.executeCommand('cTrain.startLesson');
  }
}

function refreshDecorationTypes(): void {
  ghostDecoration?.dispose();
  mistakeDecoration?.dispose();
  lastGhostKeys.clear();

  const settings = readSettings();
  const ghostSpec = buildGhostDecorationSpec(settings.ghostTextOpacity);
  const mistakeSpec = buildMistakeDecorationSpec(settings.mistakeStyle);

  ghostDecoration = vscode.window.createTextEditorDecorationType({
    opacity: ghostSpec.after.opacity,
    after: {
      color: new vscode.ThemeColor(ghostSpec.after.color),
      fontStyle: ghostSpec.after.fontStyle,
      textDecoration: `none; opacity: ${ghostSpec.after.opacity}`
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
  });
  mistakeDecoration = vscode.window.createTextEditorDecorationType({
    textDecoration: mistakeSpec.textDecoration,
    border: mistakeSpec.border,
    overviewRulerColor: new vscode.ThemeColor(mistakeSpec.overviewRulerColor),
    overviewRulerLane: vscode.OverviewRulerLane.Right
  });

}

function updateEditorDecorations(editor: vscode.TextEditor, session: TrainingSession): void {
  const key = editor.document.uri.toString();
  const ghostKey = `${session.status.typedCharacters}:${editor.document.lineCount}`;
  const shouldUpdateGhost = lastGhostKeys.get(key) !== ghostKey;
  const ghostOptions = shouldUpdateGhost
    ? planGhostDecorations(
      visibleGhostTextSegments(session.ghostTextSegments, editor.document.lineCount),
      editor.document.lineCount
    ).map((segment): vscode.DecorationOptions => {
      const line = Math.min(segment.line, Math.max(0, editor.document.lineCount - 1));
      const character = Math.min(segment.character, editor.document.lineAt(line).text.length);
      const position = new vscode.Position(line, character);
      return {
        range: new vscode.Range(position, position),
        hoverMessage: `cTrain prompt: ${segment.contentText}`,
        renderOptions: {
          after: {
            contentText: segment.contentText
          }
        }
      };
    })
    : undefined;
  const mistakeOptions = session.mistakes.map((mistake): vscode.DecorationOptions => {
    const start = editor.document.positionAt(mistake.actualIndex);
    return {
      range: new vscode.Range(start, start.translate(0, 1)),
      hoverMessage: formatMistakeHoverMessage(mistake)
    };
  });

  if (ghostDecoration !== undefined && ghostOptions !== undefined) {
    editor.setDecorations(ghostDecoration, ghostOptions);
    lastGhostKeys.set(key, ghostKey);
  }
  if (mistakeDecoration !== undefined) {
    editor.setDecorations(mistakeDecoration, mistakeOptions);
  }
  if (statusBar !== undefined) {
    const paused = pausedSessions.has(key);
    statusBar.text = paused ? formatPausedStatusBarText(session.status) : formatStatusBarText(session.status);
    statusBar.backgroundColor = paused ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
    statusBar.command = 'cTrain.sessionActions';
    statusBar.accessibilityInformation = {
      label: paused
        ? `cTrain paused, ${formatStatusBarAccessibilityLabel(session.status)}`
        : formatStatusBarAccessibilityLabel(session.status)
    };
    statusBar.show();
  }
}

async function replaceEditorDocumentText(
  key: string,
  editor: vscode.TextEditor,
  nextText: string,
  options: { cursorPosition?: { line: number; character: number } }
): Promise<void> {
  revertingDocuments.add(key);
  try {
    const fullRange = new vscode.Range(
      editor.document.positionAt(0),
      editor.document.positionAt(editor.document.getText().length)
    );
    let applied = false;
    try {
      applied = await editor.edit((edit) => {
        edit.replace(fullRange, nextText);
      });
    } catch {
      applied = false;
    }
    if (!applied) {
      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.replace(editor.document.uri, fullRange, nextText);
      applied = await vscode.workspace.applyEdit(workspaceEdit);
    }
    if (!applied) {
      throw new Error('VS Code rejected the cTrain document synchronization edit.');
    }

    if (options.cursorPosition !== undefined) {
      const line = Math.min(options.cursorPosition.line, Math.max(0, editor.document.lineCount - 1));
      const character = Math.min(options.cursorPosition.character, editor.document.lineAt(line).text.length);
      const end = new vscode.Position(line, character);
      editor.selection = new vscode.Selection(end, end);
    }
  } finally {
    revertingDocuments.delete(key);
  }
}

function moveEditorCursor(editor: vscode.TextEditor, position: { line: number; character: number }): void {
  const line = Math.min(position.line, Math.max(0, editor.document.lineCount - 1));
  const character = Math.min(position.character, editor.document.lineAt(line).text.length);
  const end = new vscode.Position(line, character);
  editor.selection = new vscode.Selection(end, end);
}

function initialLessonCursorPosition(session: TrainingSession): { line: number; character: number } | undefined {
  if (session.status.isComplete || session.documentText.length === 0) {
    return undefined;
  }

  return positionAtDocumentEnd(session.documentText);
}

function findVisibleEditor(key: string): vscode.TextEditor | undefined {
  return vscode.window.visibleTextEditors.find((item) => item.document.uri.toString() === key);
}

function clearTrainingSession(key: string): void {
  sessions.delete(key);
  pausedSessions.delete(key);
  lastGhostKeys.delete(key);
  const editor = findVisibleEditor(key);
  if (editor !== undefined) {
    if (ghostDecoration !== undefined) {
      editor.setDecorations(ghostDecoration, []);
    }
    if (mistakeDecoration !== undefined) {
      editor.setDecorations(mistakeDecoration, []);
    }
  }
  resetStatusBar();
}

function disposeDecorationTypes(): void {
  ghostDecoration?.dispose();
  mistakeDecoration?.dispose();
  ghostDecoration = undefined;
  mistakeDecoration = undefined;
}

async function runSafely(message: string, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    reportError(message, error);
  }
}

function reportError(message: string, error: unknown): void {
  console.error(`[cTrain] ${message}`, error);
  void vscode.window.showErrorMessage(`${message}: ${formatErrorMessage(error)}`);
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
