import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import type { LessonCompletionCheck } from '../src/lessons/schema';
import { MemoryStateStore, ProgressStore } from '../src/progress/progressStore';
import {
  calculateSpacedRepetitionAccuracy,
  collectDueCompletionCheckReviews,
  createCompletionCheckId,
  createCompletionCheckReview
} from '../src/progress/spacedRepetition';

describe('spaced repetition for missed completion checks', () => {
  it('schedules missed lesson checks for day 1, 3, and 7 reviews', async () => {
    const store = new ProgressStore(new MemoryStateStore(), {
      clock: () => new Date('2026-06-15T08:00:00.000Z')
    });

    await store.recordCompletionCheckAnswer({
      lessonId: 'java-optional-orelse-15',
      lessonTitle: 'Optional orElse',
      checkIndex: 0,
      check: optionalCheck,
      selectedChoiceIndex: 0,
      answeredAt: '2026-06-15T08:00:00.000Z',
      source: 'lesson'
    });

    const progress = await store.load();
    const review = progress.completionCheckReviews[createCompletionCheckId('java-optional-orelse-15', 0)];

    assert.notEqual(review, undefined);
    assert.deepEqual(review!.dueDates, ['2026-06-16', '2026-06-18', '2026-06-22']);
    assert.deepEqual(review!.completedDueDates, []);
    assert.equal(review!.attempts.length, 1);
    assert.equal(review!.attempts[0]!.correct, false);
    assert.equal(review!.attempts[0]!.source, 'lesson');
  });

  it('returns only due missed checks and completes one due date per correct retest', async () => {
    const progress = {
      version: 2,
      updatedAt: '2026-06-15T08:00:00.000Z',
      currentStreak: 0,
      longestStreak: 0,
      lessons: {},
      mockExamAttempts: [],
      completionCheckReviews: {
        [createCompletionCheckId('java-optional-orelse-15', 0)]: createCompletionCheckReview({
          lessonId: 'java-optional-orelse-15',
          lessonTitle: 'Optional orElse',
          checkIndex: 0,
          check: optionalCheck,
          selectedChoiceIndex: 0,
          answeredAt: '2026-06-15T08:00:00.000Z'
        }),
        [createCompletionCheckId('java-stream-collect-16', 1)]: createCompletionCheckReview({
          lessonId: 'java-stream-collect-16',
          lessonTitle: 'Stream Collect',
          checkIndex: 1,
          check: streamCheck,
          selectedChoiceIndex: 1,
          answeredAt: '2026-06-20T08:00:00.000Z'
        })
      }
    };
    const store = new ProgressStore(new MemoryStateStore({
      'codeTrainer.progress.v2': progress
    }), {
      clock: () => new Date('2026-06-16T09:00:00.000Z')
    });

    const due = collectDueCompletionCheckReviews(await store.load(), new Date('2026-06-16T09:00:00.000Z'));
    assert.deepEqual(due.map((item) => [item.review.id, item.dueDate]), [
      [createCompletionCheckId('java-optional-orelse-15', 0), '2026-06-16']
    ]);

    await store.recordCompletionCheckAnswer({
      lessonId: 'java-optional-orelse-15',
      lessonTitle: 'Optional orElse',
      checkIndex: 0,
      check: optionalCheck,
      selectedChoiceIndex: 1,
      answeredAt: '2026-06-16T09:00:00.000Z',
      source: 'review'
    });

    const review = (await store.load()).completionCheckReviews[createCompletionCheckId('java-optional-orelse-15', 0)]!;
    assert.deepEqual(review.completedDueDates, ['2026-06-16']);
    assert.equal(review.attempts.at(-1)!.correct, true);
    assert.equal(review.attempts.at(-1)!.source, 'review');
    assert.deepEqual(
      collectDueCompletionCheckReviews(await store.load(), new Date('2026-06-16T09:01:00.000Z')),
      []
    );
  });

  it('tracks retest accuracy and reschedules wrong retests for a fresh 1/3/7 cycle', async () => {
    const state = new MemoryStateStore();
    const store = new ProgressStore(state);
    await store.recordCompletionCheckAnswer({
      lessonId: 'java-optional-orelse-15',
      lessonTitle: 'Optional orElse',
      checkIndex: 0,
      check: optionalCheck,
      selectedChoiceIndex: 0,
      answeredAt: '2026-06-15T08:00:00.000Z',
      source: 'lesson'
    });
    await store.recordCompletionCheckAnswer({
      lessonId: 'java-optional-orelse-15',
      lessonTitle: 'Optional orElse',
      checkIndex: 0,
      check: optionalCheck,
      selectedChoiceIndex: 0,
      answeredAt: '2026-06-16T08:00:00.000Z',
      source: 'review'
    });

    const progress = await store.load();
    const review = progress.completionCheckReviews[createCompletionCheckId('java-optional-orelse-15', 0)]!;

    assert.deepEqual(review.dueDates, ['2026-06-17', '2026-06-19', '2026-06-23']);
    assert.deepEqual(review.completedDueDates, []);
    assert.deepEqual(calculateSpacedRepetitionAccuracy(progress), {
      retestCount: 1,
      correctRetestCount: 0,
      accuracyPercent: 0
    });
  });
});

const optionalCheck: LessonCompletionCheck = {
  prompt: 'What does Optional.empty().orElseGet(() -> "fallback") return?',
  choices: ['Optional.empty()', 'fallback', 'null', 'It fails to compile'],
  answerIndex: 1,
  explanation: 'orElseGet calls the supplier only when the Optional is empty.'
};

const streamCheck: LessonCompletionCheck = {
  prompt: 'What does List.of(1, 2).stream().map(n -> n * 2).toList() contain?',
  choices: ['[1, 2]', '[2, 4]', '[4, 2]', 'It throws an exception'],
  answerIndex: 1,
  explanation: 'map transforms each element before the terminal toList operation.'
};
