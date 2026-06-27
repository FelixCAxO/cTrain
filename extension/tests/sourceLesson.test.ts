import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  applyTrainingLanguageToDocument,
  createLessonFromEditorSource,
  isKnownTrainingLanguageId,
  resolveTrainingLanguageId,
  trimPracticeSourceText,
  validatePracticeSourceText
} from '../src/training/sourceLesson';

describe('source file lessons', () => {
  it('creates a training lesson from the whole active file when no text is selected', () => {
    const lesson = createLessonFromEditorSource({
      fileName: 'MainController.java',
      languageId: 'java',
      fullText: 'public class MainController {\n}\n'
    });

    assert.equal(lesson.id, 'current-file-maincontroller-java');
    assert.equal(lesson.title, 'MainController.java');
    assert.equal(lesson.description, 'Practice the current file.');
    assert.equal(lesson.language, 'java');
    assert.equal(lesson.targetCode, 'public class MainController {\n}\n');
  });

  it('prefers selected text when the active editor has a selection', () => {
    const lesson = createLessonFromEditorSource({
      fileName: 'NetworkView.java',
      languageId: 'java',
      fullText: 'class NetworkView {\n  void render() {}\n}\n',
      selectedText: 'void render() {}'
    });

    assert.equal(lesson.id, 'selection-networkview-java');
    assert.equal(lesson.title, 'Selection from NetworkView.java');
    assert.equal(lesson.description, 'Practice the current selection.');
    assert.equal(lesson.targetCode, 'void render() {}');
  });

  it('can isolate repeated source-practice sessions with a caller-provided session id', () => {
    const first = createLessonFromEditorSource({
      fileName: 'NetworkView.java',
      languageId: 'java',
      fullText: 'class NetworkView {\n  void render() {}\n}\n',
      sourceSessionId: 'run-a'
    });
    const second = createLessonFromEditorSource({
      fileName: 'NetworkView.java',
      languageId: 'java',
      fullText: 'class NetworkView {\n  void render() {}\n}\n',
      sourceSessionId: 'run-b'
    });

    assert.equal(first.id, 'current-file-networkview-java-run-a');
    assert.equal(second.id, 'current-file-networkview-java-run-b');
    assert.notEqual(first.id, second.id);
    assert.equal(first.targetCode, second.targetCode);
  });

  it('uses the lesson or source language id so VS Code themes provide real syntax colors', () => {
    assert.equal(resolveTrainingLanguageId({ language: 'java' }), 'java');
    assert.equal(resolveTrainingLanguageId({ language: 'typescript' }), 'typescript');
    assert.equal(resolveTrainingLanguageId({ language: 'python' }), 'python');
    assert.equal(resolveTrainingLanguageId({ language: 'csharp' }), 'csharp');
  });

  it('shows the language-assigned document returned by VS Code so local themes can tokenize typed text', async () => {
    const openedDocument = { uri: 'code-trainer:/lesson/java-class-basic-01', languageId: 'plaintext' };
    const languageAssignedDocument = { uri: openedDocument.uri, languageId: 'java' };

    const documentToShow = await applyTrainingLanguageToDocument(
      openedDocument,
      'java',
      async (document: typeof openedDocument, languageId: string) => {
        assert.equal(document, openedDocument);
        assert.equal(languageId, 'java');
        return languageAssignedDocument;
      }
    );

    assert.equal(documentToShow, languageAssignedDocument);
  });

  it('guards current-file practice against too-short and huge sources', () => {
    assert.deepEqual(validatePracticeSourceText('short'), {
      ok: false,
      reason: 'too-short',
      message: 'Select at least 20 characters to start a cTrain lesson. Current source has 5 characters.'
    });

    assert.deepEqual(validatePracticeSourceText('x'.repeat(20_001)), {
      ok: false,
      reason: 'too-large',
      message: 'This source is over 20,000 characters and may be slow to practice.'
    });

    assert.deepEqual(validatePracticeSourceText('public class Demo {}'), { ok: true });
  });

  it('uses the minimum estimated duration for short but valid source lessons', () => {
    const lesson = createLessonFromEditorSource({
      fileName: 'SmallSnippet.ts',
      languageId: 'typescript',
      fullText: 'x'.repeat(89)
    });

    assert.equal(validatePracticeSourceText('x'.repeat(89)).ok, true);
    assert.equal(lesson.estimatedSeconds, 30);
  });

  it('trims very large current-file practice sources to the first 20,000 characters', () => {
    const trimmed = trimPracticeSourceText('x'.repeat(20_010));

    assert.equal(trimmed.length, 20_000);
  });

  it('recognizes C, Java, and Python source files for current-file practice', () => {
    assert.equal(isKnownTrainingLanguageId('c'), true);
    assert.equal(isKnownTrainingLanguageId('java'), true);
    assert.equal(isKnownTrainingLanguageId('python'), true);
  });

  it('detects plaintext and unknown language ids so the command can warn without blocking', () => {
    assert.equal(isKnownTrainingLanguageId('typescript'), true);
    assert.equal(isKnownTrainingLanguageId('plaintext'), false);
    assert.equal(isKnownTrainingLanguageId('made-up-language'), false);
  });
});
