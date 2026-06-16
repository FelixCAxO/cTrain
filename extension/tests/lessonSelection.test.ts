import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { suggestedAfterTitles } from '../src/commands/lessonSelection';
import type { Lesson } from '../src/lessons/schema';
import type { ProgressBlob } from '../src/progress/progressStore';

describe('lesson prerequisite hints', () => {
  it('suggests incomplete prerequisites as a non-blocking hint', () => {
    const intro = lesson('typescript-function-01', 'Functions', []);
    const dependent = lesson('typescript-async-04', 'Async', ['typescript-function-01']);

    assert.deepEqual(suggestedAfterTitles(dependent, progress({}).lessons, [intro, dependent]), ['Functions']);
  });

  it('drops the hint once prerequisites are complete', () => {
    const intro = lesson('typescript-function-01', 'Functions', []);
    const dependent = lesson('typescript-async-04', 'Async', ['typescript-function-01']);

    assert.deepEqual(
      suggestedAfterTitles(dependent, progress({ 'typescript-function-01': true }).lessons, [intro, dependent]),
      []
    );
  });

  it('reports nested prerequisite chains in suggested order', () => {
    const basics = lesson('typescript-function-01', 'Functions', []);
    const interfaces = lesson('typescript-interface-02', 'Interfaces', ['typescript-function-01']);
    const classes = lesson('typescript-class-06', 'Classes', ['typescript-interface-02']);
    const dependent = lesson('typescript-advanced-09', 'Advanced', ['typescript-class-06']);
    const lessons = [basics, interfaces, classes, dependent];

    assert.deepEqual(suggestedAfterTitles(dependent, progress({}).lessons, lessons), [
      'Functions -> Interfaces -> Classes'
    ]);
    assert.deepEqual(suggestedAfterTitles(
      dependent,
      progress({ 'typescript-function-01': true }).lessons,
      lessons
    ), [
      'Interfaces -> Classes'
    ]);
  });

  it('keeps Prog2 source-file prerequisites as silent ordering metadata', () => {
    const copy = prog2Lesson('prog2-b2-f04-array-list-copy-01', 'Prog2B2F04ArrayListCopy', []);
    const corrected = prog2Lesson('prog2-b2-f04-array-list-02', 'Prog2B2F04ArrayList', [
      'prog2-b2-f04-array-list-copy-01'
    ]);
    const lessons = [copy, corrected];

    assert.deepEqual(suggestedAfterTitles(corrected, progress({}).lessons, lessons), []);
  });
});

function lesson(id: string, title: string, prerequisites: string[]): Lesson {
  return {
    schemaVersion: 1,
    id,
    version: 1,
    title,
    description: title,
    language: 'typescript',
    difficulty: 1,
    estimatedSeconds: 30,
    tags: ['typescript'],
    prerequisites,
    targetCode: 'const value = 1;\nconsole.log(value);\n'
  };
}

function prog2Lesson(id: string, title: string, prerequisites: string[]): Lesson {
  return {
    ...lesson(id, title, prerequisites),
    language: 'java',
    difficulty: 3,
    tags: ['java', 'prog2', 'source-file'],
    languageVersion: 'Java 8',
    learningGoals: [`Practice ${title}.`],
    targetCode: 'class Demo {\n  void run() {\n  }\n}'
  };
}

function progress(completed: Record<string, true>): ProgressBlob {
  return {
    version: 2,
    updatedAt: '2026-05-18T00:00:00.000Z',
    currentStreak: 0,
    longestStreak: 0,
    lessons: Object.fromEntries(Object.keys(completed).map((lessonId) => [
      lessonId,
      {
        lessonId,
        lessonVersion: 1,
        status: 'completed',
        completedAt: '2026-05-18T00:00:00.000Z',
        durationMs: 60_000,
        mistakeCount: 0,
        rejectedPasteCount: 0,
        typedCharacters: 20,
        wpm: 20,
        mistakes: [],
        bestWpm: 20,
        lastWpm: 20,
        attempts: [],
        personalBest: {
          completedAt: '2026-05-18T00:00:00.000Z',
          durationMs: 60_000,
          mistakeCount: 0,
          typedCharacters: 20,
          wpm: 20,
          errorRatePercent: 0
        }
      }
    ])),
    mockExamAttempts: [],
    completionCheckReviews: {}
  };
}
