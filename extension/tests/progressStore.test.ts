import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { MemoryStateStore, ProgressStore, type LessonProgressRecord, type StateStore } from '../src/progress/progressStore';
import { migrateProgressBlob } from '../src/progress/migrations';
import { shouldShowStreakReminder } from '../src/progress/streakReminder';
import { createCompletionCheckId } from '../src/progress/spacedRepetition';

describe('progress store', () => {
  it('initializes a versioned empty progress blob under the v2 key', async () => {
    const state = new MemoryStateStore();
    const store = new ProgressStore(state);

    const progress = await store.load();

    assert.equal(progress.version, 2);
    assert.deepEqual(progress.lessons, {});
    assert.deepEqual(progress.completionCheckReviews, {});
    assert.equal(progress.currentStreak, 0);
    assert.equal(progress.longestStreak, 0);
    assert.equal(state.lastKey, 'codeTrainer.progress.v2');
  });

  it('persists lesson completion attempts, best WPM, and streaks while preserving records', async () => {
    const state = new MemoryStateStore({
      'codeTrainer.progress.v2': {
        version: 2,
        updatedAt: '2026-05-17T12:00:00.000Z',
        lastCompletionDate: '2026-05-17',
        currentStreak: 2,
        longestStreak: 2,
        lessons: {
          'old-lesson': {
            lessonId: 'old-lesson',
            lessonVersion: 1,
            status: 'completed',
            completedAt: '2026-05-17T12:00:00.000Z',
            durationMs: 1000,
            mistakeCount: 0,
            rejectedPasteCount: 0,
            typedCharacters: 5,
            wpm: 60,
            bestWpm: 60,
            lastWpm: 60,
            attempts: []
          }
        }
      }
    });
    const store = new ProgressStore(state, { clock: () => new Date('2026-05-18T12:00:00.000Z') });

    await store.recordCompletion({
      lessonId: 'java-class-basic-01',
      lessonVersion: 1,
      status: 'completed',
      completedAt: '2026-05-18T12:00:00.000Z',
      durationMs: 2500,
      mistakeCount: 1,
      rejectedPasteCount: 2,
      typedCharacters: 100,
      wpm: 480,
      mistakes: []
    });

    const progress = await store.load();
    assert.equal(Object.keys(progress.lessons).length, 2);
    assert.equal(progress.lessons['old-lesson'].status, 'completed');
    assert.equal(progress.lessons['java-class-basic-01'].mistakeCount, 1);
    assert.equal(progress.lessons['java-class-basic-01'].rejectedPasteCount, 2);
    assert.equal(progress.lessons['java-class-basic-01'].bestWpm, 480);
    assert.equal(progress.lessons['java-class-basic-01'].lastWpm, 480);
    assert.equal(progress.lessons['java-class-basic-01'].attempts.length, 1);
    assert.deepEqual(progress.lessons['java-class-basic-01'].personalBest, {
      completedAt: '2026-05-18T12:00:00.000Z',
      durationMs: 2500,
      mistakeCount: 1,
      typedCharacters: 100,
      wpm: 480,
      errorRatePercent: 1
    });
    assert.equal(progress.currentStreak, 3);
    assert.equal(progress.longestStreak, 3);
    assert.equal(progress.lastCompletionDate, '2026-05-18');
    assert.equal(progress.updatedAt, '2026-05-18T12:00:00.000Z');
  });

  it('persists mock exam attempts with score review while preserving lesson progress', async () => {
    const state = new MemoryStateStore({
      'codeTrainer.progress.v2': {
        version: 2,
        updatedAt: '2026-06-08T07:00:00.000Z',
        currentStreak: 1,
        longestStreak: 2,
        lessons: {
          'java-class-basic-01': {
            lessonId: 'java-class-basic-01',
            lessonVersion: 1,
            status: 'completed',
            completedAt: '2026-06-07T12:00:00.000Z',
            durationMs: 1000,
            mistakeCount: 0,
            rejectedPasteCount: 0,
            typedCharacters: 5,
            wpm: 60,
            bestWpm: 60,
            lastWpm: 60,
            attempts: []
          }
        },
        mockExamAttempts: []
      }
    });
    const store = new ProgressStore(state, { clock: () => new Date('2026-06-08T08:35:00.000Z') });

    await store.recordMockExamAttempt({
      completedAt: '2026-06-08T08:30:00.000Z',
      durationMs: 1_800_000,
      questionCount: 25,
      correctCount: 18,
      scorePercent: 72,
      passed: true,
      lessonIds: ['java-class-basic-01', 'java-method-return-02'],
      objectiveResults: [
        {
          objectiveId: 'values',
          objectiveLabel: 'Handling Date, Time, Text, Numeric and Boolean Values',
          questionCount: 10,
          correctCount: 8,
          accuracyPercent: 80
        }
      ],
      wrongAnswers: [
        {
          lessonId: 'java-method-return-02',
          lessonTitle: 'Java Method Return',
          objectiveId: 'values',
          objectiveLabel: 'Handling Date, Time, Text, Numeric and Boolean Values',
          prompt: 'What is returned?',
          selectedChoice: '0',
          correctChoice: 'a + b',
          explanation: 'The method returns the expression after return.'
        }
      ]
    });

    const progress = await store.load();
    assert.equal(Object.keys(progress.lessons).length, 1);
    assert.equal(progress.mockExamAttempts.length, 1);
    assert.equal(progress.mockExamAttempts[0]!.scorePercent, 72);
    assert.equal(progress.mockExamAttempts[0]!.objectiveResults[0]!.accuracyPercent, 80);
    assert.equal(progress.mockExamAttempts[0]!.wrongAnswers[0]!.lessonTitle, 'Java Method Return');
    assert.equal(progress.updatedAt, '2026-06-08T08:35:00.000Z');
  });

  it('persists missed completion checks for spaced review without altering lesson progress', async () => {
    const state = new MemoryStateStore();
    const store = new ProgressStore(state);

    await store.recordCompletionCheckAnswer({
      lessonId: 'java-string-methods-23',
      lessonTitle: 'String Methods',
      checkIndex: 1,
      check: {
        prompt: 'What does "Java".substring(1) return?',
        choices: ['J', 'ava', 'Java', 'It throws an exception'],
        answerIndex: 1,
        explanation: 'substring(1) starts at the second character.'
      },
      selectedChoiceIndex: 0,
      answeredAt: '2026-06-15T08:00:00.000Z',
      source: 'lesson'
    });

    const progress = await store.load();
    assert.deepEqual(progress.lessons, {});
    assert.deepEqual(Object.keys(progress.completionCheckReviews), [
      createCompletionCheckId('java-string-methods-23', 1)
    ]);
  });

  it('persists missed mock exam completion checks for spaced review', async () => {
    const state = new MemoryStateStore();
    const store = new ProgressStore(state);

    await store.recordCompletionCheckAnswer({
      lessonId: 'java-localization-64',
      lessonTitle: 'Java Localization',
      checkIndex: 2,
      check: {
        prompt: 'What does fmt.format(0.5) print?',
        choices: ['50%', '0.5%', '0,5', 'It fails to compile'],
        answerIndex: 0,
        explanation: 'Percent formatters multiply by 100 and add the percent sign.'
      },
      selectedChoiceIndex: 1,
      answeredAt: '2026-06-15T08:00:00.000Z',
      source: 'mock-exam'
    });

    const review = (await store.load()).completionCheckReviews[createCompletionCheckId('java-localization-64', 2)];
    assert.notEqual(review, undefined);
    assert.deepEqual(review!.dueDates, ['2026-06-16', '2026-06-18', '2026-06-22']);
    assert.equal(review!.attempts[0]!.source, 'mock-exam');
  });

  it('summarizes not-started, completed, and changed-since-completion picker states', async () => {
    const state = new MemoryStateStore({
      'codeTrainer.progress.v2': {
        version: 2,
        updatedAt: '2026-05-18T00:00:00.000Z',
        lastCompletionDate: '2026-05-18',
        currentStreak: 1,
        longestStreak: 1,
        lessons: {
          'java-class-basic-01': {
            lessonId: 'java-class-basic-01',
            lessonVersion: 1,
            status: 'completed',
            completedAt: '2026-05-18T00:00:00.000Z',
            durationMs: 1000,
            mistakeCount: 0,
            rejectedPasteCount: 0,
            typedCharacters: 5,
            wpm: 60,
            bestWpm: 60,
            lastWpm: 60,
            attempts: []
          }
        }
      }
    });
    const store = new ProgressStore(state);

    assert.equal((await store.getLessonStatus('missing', 1)).state, 'not-started');
    assert.equal((await store.getLessonStatus('java-class-basic-01', 1)).state, 'completed');
    assert.equal((await store.getLessonStatus('java-class-basic-01', 2)).state, 'changed-since-completion');
  });

  it('ignores the never-shipped v0 progress shape instead of migrating it', () => {
    const migrated = migrateProgressBlob({
      version: 0,
      records: {
        'typescript-function-01': {
          completed: true,
          completedAt: '2026-05-18T09:00:00.000Z'
        }
      }
    });

    assert.equal(migrated.version, 2);
    assert.deepEqual(migrated.lessons, {});
    assert.deepEqual(migrated.completionCheckReviews, {});
    assert.equal(migrated.currentStreak, 0);
  });

  it('migrates a v1 progress blob into v2 attempt history while skipping invalid records', () => {
    const migrated = migrateProgressBlob({
      version: 1,
      updatedAt: '2026-05-18T09:00:00.000Z',
      lessons: {
        'valid-lesson': {
          lessonId: 'valid-lesson',
          lessonVersion: 2,
          status: 'completed',
          completedAt: '2026-05-18T09:00:00.000Z',
          durationMs: 12_000,
          mistakeCount: 3
        },
        'invalid-lesson': {
          lessonId: 'invalid-lesson',
          status: 'completed'
        }
      }
    });

    assert.equal(migrated.version, 2);
    assert.equal(migrated.updatedAt, '2026-05-18T09:00:00.000Z');
    assert.equal(Object.keys(migrated.lessons).length, 1);
    assert.deepEqual(migrated.completionCheckReviews, {});
    assert.deepEqual(migrated.lessons['valid-lesson'].attempts, [{
      completedAt: '2026-05-18T09:00:00.000Z',
      durationMs: 12_000,
      mistakeCount: 3,
      rejectedPasteCount: 0,
      typedCharacters: 0,
      wpm: 0,
      mistakes: []
    }]);
  });

  it('falls back to an empty blob for malformed stored progress values', async () => {
    for (const value of ['not an object', null, { version: 99 }]) {
      const store = new ProgressStore(new MemoryStateStore({
        'codeTrainer.progress.v2': value
      }));

      const progress = await store.load();

      assert.equal(progress.version, 2);
      assert.deepEqual(progress.lessons, {});
      assert.deepEqual(progress.mockExamAttempts, []);
      assert.deepEqual(progress.completionCheckReviews, {});
      assert.equal(progress.currentStreak, 0);
      assert.equal(progress.longestStreak, 0);
    }
  });

  it('does not query the legacy v1 storage key when v2 progress is missing', async () => {
    const state = new TrackingStateStore({
      'codeTrainer.progress.v1': {
        version: 1,
        updatedAt: '2026-05-18T09:00:00.000Z',
        lessons: {
          stale: {
            lessonId: 'stale',
            lessonVersion: 1,
            status: 'completed',
            completedAt: '2026-05-18T09:00:00.000Z',
            durationMs: 12_000,
            mistakeCount: 0
          }
        }
      }
    });
    const store = new ProgressStore(state);

    const progress = await store.load();

    assert.deepEqual(state.getCalls, ['codeTrainer.progress.v2']);
    assert.deepEqual(progress.lessons, {});
  });

  it('serializes concurrent completion writes so no lesson record is lost', async () => {
    const state = new CloningStateStore({
      'codeTrainer.progress.v2': {
        version: 2,
        updatedAt: '2026-05-18T00:00:00.000Z',
        currentStreak: 0,
        longestStreak: 0,
        lessons: {}
      }
    });
    const store = new ProgressStore(state, { clock: () => new Date('2026-05-18T12:00:00.000Z') });

    await Promise.all([
      store.recordCompletion(record({ lessonId: 'lesson-a', completedAt: '2026-05-18T10:00:00.000Z', wpm: 20 })),
      store.recordCompletion(record({ lessonId: 'lesson-b', completedAt: '2026-05-18T11:00:00.000Z', wpm: 30 }))
    ]);

    const progress = await store.load();
    assert.deepEqual(Object.keys(progress.lessons).sort(), ['lesson-a', 'lesson-b']);
  });

  it('does not mutate stored progress when a completion update fails', async () => {
    const state = new RejectingUpdateStateStore({
      'codeTrainer.progress.v2': {
        version: 2,
        updatedAt: '2026-05-18T00:00:00.000Z',
        currentStreak: 0,
        longestStreak: 0,
        lessons: {}
      }
    });
    const store = new ProgressStore(state);

    await assert.rejects(
      store.recordCompletion(record({ lessonId: 'failed-lesson' })),
      /update failed/
    );

    assert.deepEqual(state.peek('codeTrainer.progress.v2'), {
      version: 2,
      updatedAt: '2026-05-18T00:00:00.000Z',
      currentStreak: 0,
      longestStreak: 0,
      lessons: {}
    });
  });

  it('appends repeated attempts while keeping best and last WPM distinct', async () => {
    const state = new MemoryStateStore();
    const store = new ProgressStore(state, { clock: () => new Date('2026-05-18T12:00:00.000Z') });

    await store.recordCompletion(record({ lessonId: 'retry-lesson', completedAt: '2026-05-18T10:00:00.000Z', wpm: 50 }));
    await store.recordCompletion(record({ lessonId: 'retry-lesson', completedAt: '2026-05-18T11:00:00.000Z', wpm: 35 }));

    const progress = await store.load();
    const lesson = progress.lessons['retry-lesson'];
    assert.equal(lesson.attempts.length, 2);
    assert.equal(lesson.bestWpm, 50);
    assert.equal(lesson.lastWpm, 35);
    assert.equal(lesson.personalBest.wpm, 50);
  });

  it('caps stored attempt history and per-attempt mistakes', async () => {
    const mistakes = Array.from({ length: 205 }, (_, index) => ({
      actualIndex: index,
      targetIndex: index,
      expected: 'a',
      actual: 'b'
    }));
    const existingAttempts = Array.from({ length: 25 }, (_, index) => ({
      completedAt: `2026-05-18T10:${index.toString().padStart(2, '0')}:00.000Z`,
      durationMs: 60_000,
      mistakeCount: 0,
      rejectedPasteCount: 0,
      typedCharacters: 100,
      wpm: 20 + index,
      mistakes
    }));
    const state = new MemoryStateStore({
      'codeTrainer.progress.v2': {
        version: 2,
        updatedAt: '2026-05-18T00:00:00.000Z',
        currentStreak: 0,
        longestStreak: 0,
        lessons: {
          'retry-lesson': {
            lessonId: 'retry-lesson',
            lessonVersion: 1,
            status: 'completed',
            completedAt: '2026-05-18T10:00:00.000Z',
            durationMs: 60_000,
            mistakeCount: 0,
            rejectedPasteCount: 0,
            typedCharacters: 100,
            wpm: 20,
            bestWpm: 20,
            lastWpm: 20,
            attempts: existingAttempts,
            mistakes
          }
        }
      }
    });
    const store = new ProgressStore(state, { clock: () => new Date('2026-05-18T12:00:00.000Z') });

    await store.recordCompletion(record({ lessonId: 'retry-lesson', mistakes, wpm: 80 }));

    const lesson = (await store.load()).lessons['retry-lesson'];
    assert.equal(lesson.attempts.length, 20);
    assert.equal(lesson.attempts[0]!.completedAt, '2026-05-18T10:06:00.000Z');
    assert.equal(lesson.attempts.at(-1)!.wpm, 80);
    assert.equal(lesson.mistakes.length, 200);
    assert.equal(lesson.attempts.every((attempt) => attempt.mistakes.length <= 200), true);
  });

  it('persists a streak-reminder snooze for the current calendar date', async () => {
    const state = new MemoryStateStore();
    const store = new ProgressStore(state, {
      clock: () => new Date('2026-05-18T10:00:00.000Z'),
      timeZone: 'Europe/Stockholm'
    });

    await store.snoozeStreakReminder();

    const progress = await store.load();
    assert.equal(progress.streakReminderSnoozedDate, '2026-05-18');
  });

  it('persists streak-reminder snooze using the configured local day near UTC midnight', async () => {
    const state = new MemoryStateStore();
    const store = new ProgressStore(state, {
      clock: () => new Date('2026-05-18T22:30:00.000Z'),
      timeZone: 'Europe/Stockholm'
    });

    await store.snoozeStreakReminder();

    const progress = await store.load();
    assert.equal(progress.streakReminderSnoozedDate, '2026-05-19');
  });

  it('shows a streak reminder only on the day after the last completion', () => {
    assert.equal(shouldShowStreakReminder({
      version: 2,
      updatedAt: '2026-05-17T12:00:00.000Z',
      lastCompletionDate: '2026-05-17',
      currentStreak: 4,
      longestStreak: 4,
      lessons: {},
      mockExamAttempts: [],
      completionCheckReviews: {}
    }, new Date('2026-05-18T08:00:00.000Z')), true);

    assert.equal(shouldShowStreakReminder({
      version: 2,
      updatedAt: '2026-05-17T12:00:00.000Z',
      lastCompletionDate: '2026-05-17',
      currentStreak: 4,
      longestStreak: 4,
      lessons: {},
      mockExamAttempts: [],
      completionCheckReviews: {}
    }, new Date('2026-05-19T08:00:00.000Z')), false);

    assert.equal(shouldShowStreakReminder({
      version: 2,
      updatedAt: '2026-05-17T12:00:00.000Z',
      lastCompletionDate: '2026-05-17',
      currentStreak: 4,
      longestStreak: 4,
      streakReminderSnoozedDate: '2026-05-18',
      lessons: {},
      mockExamAttempts: [],
      completionCheckReviews: {}
    }, new Date('2026-05-18T08:00:00.000Z')), false);
  });

  it('uses the configured local calendar day for streak updates', async () => {
    const state = new MemoryStateStore({
      'codeTrainer.progress.v2': {
        version: 2,
        updatedAt: '2026-05-17T21:30:00.000Z',
        lastCompletionDate: '2026-05-17',
        currentStreak: 1,
        longestStreak: 1,
        lessons: {}
      }
    });
    const store = new ProgressStore(state, {
      clock: () => new Date('2026-05-17T22:30:00.000Z'),
      timeZone: 'Europe/Stockholm'
    });

    await store.recordCompletion({
      lessonId: 'java-class-basic-01',
      lessonVersion: 1,
      status: 'completed',
      completedAt: '2026-05-17T22:30:00.000Z',
      durationMs: 60_000,
      mistakeCount: 0,
      rejectedPasteCount: 0,
      typedCharacters: 100,
      wpm: 20,
      mistakes: []
    });

    const progress = await store.load();
    assert.equal(progress.lastCompletionDate, '2026-05-18');
    assert.equal(progress.currentStreak, 2);
  });
});

function record(overrides: Partial<LessonProgressRecord> = {}): LessonProgressRecord {
  return {
    lessonId: 'java-class-basic-01',
    lessonVersion: 1,
    status: 'completed',
    completedAt: '2026-05-18T12:00:00.000Z',
    durationMs: 60_000,
    mistakeCount: 0,
    rejectedPasteCount: 0,
    typedCharacters: 100,
    wpm: 20,
    mistakes: [],
    ...overrides
  };
}

class CloningStateStore implements StateStore {
  public constructor(protected readonly values: Record<string, unknown>) {}

  public async get<T>(key: string): Promise<T | undefined> {
    return clone(this.values[key]) as T | undefined;
  }

  public async update(key: string, value: unknown): Promise<void> {
    this.values[key] = clone(value);
  }

  public peek(key: string): unknown {
    return clone(this.values[key]);
  }
}

class RejectingUpdateStateStore extends CloningStateStore {
  public override async update(): Promise<void> {
    throw new Error('update failed');
  }
}

class TrackingStateStore extends MemoryStateStore {
  public readonly getCalls: string[] = [];

  public override get<T>(key: string): T | undefined {
    this.getCalls.push(key);
    return super.get<T>(key);
  }
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}
