import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  createLessonUriString,
  lessonIdFromUriString,
  renderLessonDocument
} from '../src/contentProvider';
import { createPickerItems, formatLessonPickerTitle } from '../src/ui/lessonPicker';
import { buildGhostDecorationSpec, buildMistakeDecorationSpec, planGhostDecorations, visibleGhostTextSegments } from '../src/ui/ghostDecoration';
import { formatStatusBarText } from '../src/ui/statusBar';
import type { Lesson } from '../src/lessons/schema';

const lesson: Lesson = {
  schemaVersion: 1,
  id: 'python-loop-01',
  version: 1,
  title: 'Python Loop',
  description: 'Practice a Python loop.',
  language: 'python',
  difficulty: 1,
  estimatedSeconds: 60,
  tags: ['python'],
  prerequisites: [],
  targetCode: 'for item in items:\n    print(item)'
};

describe('content provider and UI models', () => {
  it('uses the code-trainer scheme and round-trips lesson ids safely', () => {
    const uri = createLessonUriString('java/class basic 01');

    assert.equal(uri, 'code-trainer:/lesson/java%2Fclass%20basic%2001');
    assert.equal(lessonIdFromUriString(uri), 'java/class basic 01');
  });

  it('renders a blank training buffer when the lesson has no initial auto-typed text', () => {
    assert.equal(renderLessonDocument(lesson), '');
  });

  it('renders leading lesson headers as initial zero-keystroke document text', () => {
    assert.equal(renderLessonDocument({
      ...lesson,
      id: 'prog2-b2-f04-array-list-02',
      language: 'java',
      targetCode: '// LESSON: Dynamic arrays.\n// You will learn: resizing.\npublic class ArrayList {'
    }), '// LESSON: Dynamic arrays.\n// You will learn: resizing.\n');
  });

  it('creates picker labels with completion state, difficulty, language, and estimated time', () => {
    const item = createPickerItems([
      { lesson, source: 'workspace' }
    ], new Map([[lesson.id, { state: 'completed', detail: 'Completed', completionCount: 0, suggestedAfterTitles: [] }]]))
      .find((candidate) => candidate.lessonId === lesson.id)!;

    assert.equal(item.label, '$(check) Python Loop');
    assert.equal(item.description, '$(symbol-misc) Python | Difficulty 1 | 1 min | workspace');
    assert.equal(item.lessonId, 'python-loop-01');
  });

  it('formats C++ lesson picker groups and descriptions with the conventional language label', () => {
    const cppLesson: Lesson = {
      ...lesson,
      id: 'cpp-hello-world-01',
      title: 'C++ Hello World',
      language: 'cpp',
      tags: ['cpp'],
      targetCode: '#include <iostream>\n\nint main() {\n  return 0;\n}'
    };
    const items = createPickerItems([
      { lesson: cppLesson, source: 'built-in' }
    ], new Map());

    assert.equal(items[0]!.label, '$(symbol-namespace) C++ (1)');
    assert.equal(items[1]!.description, '$(symbol-namespace) C++ | Difficulty 1 | 1 min | built-in');
  });

  it('models decoration-only ghost text with numeric opacity', () => {
    const spec = buildGhostDecorationSpec(0.4);

    assert.equal(spec.after.opacity, '0.4');
    assert.equal(spec.after.fontStyle, 'normal');
    assert.equal(spec.rangeBehavior, 'closedClosed');
  });

  it('uses the active editor foreground token for the ghost prompt so local themes control it', () => {
    const spec = buildGhostDecorationSpec(0.4);

    assert.equal(spec.after.color, 'editor.foreground');
  });

  it('models mistake decorations for the supported styles', () => {
    assert.equal(buildMistakeDecorationSpec('squiggle').textDecoration, 'underline wavy');
    assert.equal(buildMistakeDecorationSpec('underline').textDecoration, 'underline');
    assert.equal(buildMistakeDecorationSpec('outline').border, '1px solid');
  });

  it('keeps future-line ghost segments visible at lesson start', () => {
    const segments = visibleGhostTextSegments([
      { line: 0, character: 0, contentText: 'first line' },
      { line: 1, character: 0, contentText: 'future line' }
    ], 1);

    assert.deepEqual(segments, [
      { line: 0, character: 0, contentText: 'first line' },
      { line: 1, character: 0, contentText: 'future line' }
    ]);
  });

  it('maps future-line ghost text to existing decoration lines with synthetic newlines', () => {
    const decorations = planGhostDecorations([
      { line: 0, character: 5, contentText: 'first' },
      { line: 1, character: 0, contentText: 'second' },
      { line: 2, character: 0, contentText: 'third' }
    ], 1);

    assert.deepEqual(decorations, [
      { line: 0, character: 5, contentText: 'first\nsecond\nthird' }
    ]);
  });

  it('truncates long folded ghost text with a remaining-line marker', () => {
    const decorations = planGhostDecorations([
      { line: 0, character: 0, contentText: 'first' },
      { line: 1, character: 0, contentText: 'second' },
      { line: 2, character: 0, contentText: 'third' },
      { line: 3, character: 0, contentText: 'fourth' },
      { line: 4, character: 0, contentText: 'fifth' }
    ], 1);

    assert.deepEqual(decorations, [
      { line: 0, character: 0, contentText: 'first\nsecond\nthird\n(2 more)' }
    ]);
  });

  it('groups picker lessons by language and exposes aggregate progress in the picker title', () => {
    const items = createPickerItems([
      { lesson, source: 'workspace' },
      {
        lesson: {
          ...lesson,
          id: 'java-class-basic-01',
          title: 'Java Class Basics',
          language: 'java'
        },
        source: 'built-in'
      }
    ], new Map([[lesson.id, { state: 'completed', detail: 'Completed', completionCount: 0, suggestedAfterTitles: [] }]]));

    assert.deepEqual(items.map((item) => item.label), [
      'Foundations (1)',
      '$(circle-large-outline) Java Class Basics',
      '$(symbol-misc) Python Workspace (1)',
      '$(check) Python Loop'
    ]);
    assert.equal(formatLessonPickerTitle(1, 2, 3), 'cTrain: Start Lesson (1 of 2 completed, 3-day streak)');
  });

  it('formats session status with percentage, WPM, elapsed time, and transient feedback', () => {
    assert.equal(formatStatusBarText({
      isComplete: false,
      typedCharacters: 21,
      totalCharacters: 50,
      percentComplete: 42,
      elapsedMs: 34_000,
      wpm: 58,
      mistakeCount: 2,
      rejectedPasteCount: 0
    }), 'cTrain: 42% | 58 WPM | 0:34 | 2 mistakes');

    assert.equal(formatStatusBarText({
      isComplete: false,
      typedCharacters: 21,
      totalCharacters: 50,
      percentComplete: 42,
      elapsedMs: 34_000,
      wpm: 58,
      mistakeCount: 2,
      rejectedPasteCount: 0,
      feedback: "expected 'x' got 'y' at line 2"
    }), "cTrain: 42% | 58 WPM | 0:34 | 2 mistakes | expected 'x' got 'y' at line 2");
  });
});
