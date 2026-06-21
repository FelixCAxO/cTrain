import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  createCompletionActionLabels,
  createCompletionCheckItems,
  createCompletionSummary,
  findNextLesson,
  formatCompletionCheckFeedback,
  runCompletionAction
} from '../src/commands/completionActions';
import type { Lesson } from '../src/lessons/schema';
import type { LessonProgressRecord } from '../src/progress/progressStore';

describe('completion actions', () => {
  it('summarizes best-WPM delta and current streak in the completion toast', () => {
    assert.equal(
      createCompletionSummary(record({ wpm: 58 }), { previousBestWpm: 45, currentStreak: 4 }),
      'Lesson done in 1:00 - 58 WPM (+13 best), 2 mistakes, 4-day streak'
    );

    assert.equal(
      createCompletionSummary(record({ wpm: 40 }), { previousBestWpm: 45, currentStreak: 1 }),
      'Lesson done in 1:00 - 40 WPM (best 45), 2 mistakes, 1-day streak'
    );
  });

  it('uses catalogue ordering for next lesson and returns undefined at the terminal lesson', () => {
    const lessons = [
      lesson('java-generics-method-14', []),
      lesson('java-method-return-02', []),
      lesson('java-interface-04', ['java-method-return-02'])
    ];

    assert.equal(findNextLesson(lessons[1]!, lessons)?.id, 'java-interface-04');
    assert.equal(findNextLesson(lessons[0]!, lessons), undefined);
  });

  it('continues through prerequisite-aware catalogue order', () => {
    const lessons = [
      lesson('java-primitives-types-21', []),
      lesson('java-string-methods-23', ['java-primitives-types-21', 'java-if-else-22']),
      lesson('java-arrays-init-25', ['java-string-methods-23']),
      lesson('java-if-else-22', ['java-primitives-types-21'])
    ];

    assert.equal(findNextLesson(lessons[0]!, lessons)?.id, 'java-if-else-22');
  });

  it('offers due flashcards as an explicit completion action', () => {
    assert.deepEqual(createCompletionActionLabels(lesson('java-interface-04', []), 2), [
      'Next Lesson',
      'Retry',
      'Review Due Flashcards'
    ]);
    assert.deepEqual(createCompletionActionLabels(undefined, 0), ['Retry']);
  });

  it('runs due flashcards only after the explicit review action is selected', async () => {
    let reviewed = false;
    const choice = await runCompletionAction(
      lesson('java-interface-04', []),
      1,
      async (actions) => {
        assert.deepEqual(actions, ['Next Lesson', 'Retry', 'Review Due Flashcards']);
        return 'Next Lesson';
      },
      async () => {
        reviewed = true;
      }
    );

    assert.equal(choice, 'Next Lesson');
    assert.equal(reviewed, false);
  });

  it('formats completion check choices and answer feedback', () => {
    const check = {
      prompt: 'Which Optional fallback is lazy?',
      choices: ['orElse', 'orElseGet', 'get'],
      answerIndex: 1,
      explanation: 'orElseGet receives a supplier and only calls it when the Optional is empty.'
    };

    assert.deepEqual(createCompletionCheckItems(check), [
      { label: 'orElse', description: 'Choice 1', choiceIndex: 0 },
      { label: 'orElseGet', description: 'Choice 2', choiceIndex: 1 },
      { label: 'get', description: 'Choice 3', choiceIndex: 2 }
    ]);
    assert.equal(
      formatCompletionCheckFeedback(check, 1),
      'Correct. orElseGet receives a supplier and only calls it when the Optional is empty.'
    );
    assert.equal(
      formatCompletionCheckFeedback(check, 0),
      'Review this point. orElseGet receives a supplier and only calls it when the Optional is empty.'
    );
  });

  it('shuffles completion check choices while retaining the authored answer mapping', () => {
    const check = {
      prompt: 'Which Optional fallback is lazy?',
      choices: ['orElse', 'orElseGet', 'get'],
      answerIndex: 1,
      explanation: 'orElseGet receives a supplier and only calls it when the Optional is empty.'
    };

    const items = createCompletionCheckItems(check, { random: sequenceRandom([0, 0]) });

    assert.deepEqual(items, [
      { label: 'orElseGet', description: 'Choice 1', choiceIndex: 1 },
      { label: 'get', description: 'Choice 2', choiceIndex: 2 },
      { label: 'orElse', description: 'Choice 3', choiceIndex: 0 }
    ]);
    assert.equal(
      formatCompletionCheckFeedback(check, items[0]!.choiceIndex),
      'Correct. orElseGet receives a supplier and only calls it when the Optional is empty.'
    );
  });
});

function record(overrides: Partial<LessonProgressRecord> = {}): LessonProgressRecord {
  return {
    lessonId: 'java-method-return-02',
    lessonVersion: 1,
    status: 'completed',
    completedAt: '2026-05-18T12:00:00.000Z',
    durationMs: 60_000,
    mistakeCount: 2,
    rejectedPasteCount: 0,
    typedCharacters: 100,
    wpm: 20,
    mistakes: [],
    ...overrides
  };
}

function lesson(id: string, prerequisites: string[]): Lesson {
  return {
    schemaVersion: 1,
    id,
    version: 1,
    title: id,
    description: id,
    language: 'java',
    difficulty: 1,
    estimatedSeconds: 30,
    tags: ['java'],
    prerequisites,
    targetCode: 'const value = 1;\nconsole.log(value);\n'
  };
}

function sequenceRandom(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0;
}
