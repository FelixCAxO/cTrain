import {
  createAttempt,
  createEmptyProgressBlob,
  createLessonPersonalBest,
  createMockExamAttempt,
  type CompletionCheckAnswerSourceV2,
  type CompletionCheckReviewAttemptV2,
  type CompletionCheckReviewV2,
  type LessonPersonalBestV2,
  maxStoredAttempts,
  maxStoredMockExamAttempts,
  maxStoredMistakes,
  migrateProgressBlob,
  type LessonProgressRecordV2,
  type MockExamAttemptV2,
  type MockExamWrongAnswerV2,
  type ProgressBlobV2
} from './migrations';
import type { LessonCompletionCheck } from '../lessons/schema';
import {
  collectDueCompletionCheckReviews,
  createCompletionCheckId,
  createCompletionCheckReview,
  createDueDates,
  getNextDueDate
} from './spacedRepetition';

export const progressStorageKey = 'codeTrainer.progress.v2';
export { maxStoredAttempts, maxStoredMistakes, maxStoredMockExamAttempts };

export type LessonProgressRecord = Omit<LessonProgressRecordV2, 'bestWpm' | 'lastWpm' | 'attempts' | 'personalBest'>;
export type MockExamAttempt = MockExamAttemptV2;
export type MockExamWrongAnswer = MockExamWrongAnswerV2;
export type ProgressBlob = ProgressBlobV2;

export interface StateStore {
  get<T>(key: string): T | undefined | Thenable<T | undefined>;
  update(key: string, value: unknown): void | Thenable<void>;
}

export interface ProgressStoreOptions {
  clock?: () => Date;
  timeZone?: string;
}

export interface LessonStatusSummary {
  state: 'not-started' | 'completed' | 'changed-since-completion';
  detail: string;
  bestWpm?: number;
  bestErrorRatePercent?: number;
  dueReviewCount?: number;
  completionCount: number;
  suggestedAfterTitles: string[];
}

export interface CompletionCheckAnswerRecord {
  lessonId: string;
  lessonTitle: string;
  checkIndex: number;
  check: LessonCompletionCheck;
  selectedChoiceIndex: number;
  answeredAt: string;
  source: CompletionCheckAnswerSourceV2;
}

export class MemoryStateStore implements StateStore {
  public lastKey?: string;

  public constructor(private readonly values: Record<string, unknown> = {}) {}

  public get<T>(key: string): T | undefined {
    if (this.lastKey === undefined || Object.prototype.hasOwnProperty.call(this.values, key)) {
      this.lastKey = key;
    }
    return this.values[key] as T | undefined;
  }

  public update(key: string, value: unknown): void {
    this.lastKey = key;
    this.values[key] = value;
  }
}

export class ProgressStore {
  private writeChain: Promise<void> = Promise.resolve();

  public constructor(
    private readonly state: StateStore,
    private readonly options: ProgressStoreOptions = {}
  ) {}

  public async load(): Promise<ProgressBlob> {
    const stored = await this.state.get<unknown>(progressStorageKey);
    if (stored !== undefined) {
      return cloneProgressBlob(migrateProgressBlob(stored));
    }

    return createEmptyProgressBlob();
  }

  public async recordCompletion(record: LessonProgressRecord): Promise<void> {
    const write = this.writeChain.then(() => this.recordCompletionLocked(record));
    this.writeChain = write.catch(() => undefined);
    return write;
  }

  public async recordMockExamAttempt(record: MockExamAttempt): Promise<void> {
    const write = this.writeChain.then(() => this.recordMockExamAttemptLocked(record));
    this.writeChain = write.catch(() => undefined);
    return write;
  }

  public async recordCompletionCheckAnswer(record: CompletionCheckAnswerRecord): Promise<void> {
    const write = this.writeChain.then(() => this.recordCompletionCheckAnswerLocked(record));
    this.writeChain = write.catch(() => undefined);
    return write;
  }

  private async recordCompletionLocked(record: LessonProgressRecord): Promise<void> {
    const progress = await this.load();
    const previous = progress.lessons[record.lessonId];
    const attempt = createAttempt(record);

    progress.lessons[record.lessonId] = {
      ...record,
      mistakes: record.mistakes.slice(0, maxStoredMistakes),
      bestWpm: Math.max(previous?.bestWpm ?? 0, record.wpm),
      lastWpm: record.wpm,
      attempts: [...(previous?.attempts ?? []), attempt].slice(-maxStoredAttempts),
      personalBest: selectPersonalBest(previous?.personalBest, attempt)
    };

    updateStreak(progress, record.completedAt, this.options.timeZone);
    progress.updatedAt = this.now().toISOString();
    await this.state.update(progressStorageKey, progress);
  }

  private async recordCompletionCheckAnswerLocked(record: CompletionCheckAnswerRecord): Promise<void> {
    const progress = await this.load();
    const id = createCompletionCheckId(record.lessonId, record.checkIndex);
    const correct = record.selectedChoiceIndex === record.check.answerIndex;
    const previous = progress.completionCheckReviews[id];

    if (correct && (record.source === 'lesson' || previous === undefined)) {
      return;
    }

    if (previous === undefined) {
      progress.completionCheckReviews[id] = createCompletionCheckReview(record);
    } else {
      progress.completionCheckReviews[id] = updateCompletionCheckReview(previous, record, correct);
    }

    progress.updatedAt = this.now().toISOString();
    await this.state.update(progressStorageKey, progress);
  }

  private async recordMockExamAttemptLocked(record: MockExamAttempt): Promise<void> {
    const progress = await this.load();
    progress.mockExamAttempts = [
      ...(progress.mockExamAttempts ?? []),
      createMockExamAttempt(record)
    ].slice(-maxStoredMockExamAttempts);
    progress.updatedAt = this.now().toISOString();
    await this.state.update(progressStorageKey, progress);
  }

  public async getLessonStatus(lessonId: string, lessonVersion: number): Promise<LessonStatusSummary> {
    const progress = await this.load();
    const record = progress.lessons[lessonId];

    if (record === undefined) {
    return createStatusSummary('not-started', 'Not started', undefined, 0);
    }

    if (record.lessonVersion !== lessonVersion) {
      return createStatusSummary('changed-since-completion', 'Changed since completion', record, countDueReviews(progress, lessonId, this.now()));
    }

    return createStatusSummary('completed', 'Completed', record, countDueReviews(progress, lessonId, this.now()));
  }

  public async snoozeStreakReminder(): Promise<void> {
    const write = this.writeChain.then(async () => {
      const progress = await this.load();
      progress.streakReminderSnoozedDate = formatCalendarDate(this.now(), this.options.timeZone);
      progress.updatedAt = this.now().toISOString();
      await this.state.update(progressStorageKey, progress);
    });
    this.writeChain = write.catch(() => undefined);
    return write;
  }

  private now(): Date {
    return this.options.clock?.() ?? new Date();
  }
}

function createStatusSummary(
  state: LessonStatusSummary['state'],
  detail: string,
  record?: LessonProgressRecordV2,
  dueReviewCount?: number
): LessonStatusSummary {
  return {
    state,
    detail,
    bestWpm: record?.bestWpm,
    bestErrorRatePercent: record?.personalBest.errorRatePercent,
    dueReviewCount,
    completionCount: record?.attempts.length ?? 0,
    suggestedAfterTitles: []
  };
}

function selectPersonalBest(
  previous: LessonPersonalBestV2 | undefined,
  attempt: ReturnType<typeof createAttempt>
): LessonPersonalBestV2 {
  const candidate = createLessonPersonalBest(attempt);
  if (previous === undefined) {
    return candidate;
  }

  if (candidate.wpm !== previous.wpm) {
    return candidate.wpm > previous.wpm ? candidate : previous;
  }

  return candidate.errorRatePercent < previous.errorRatePercent ? candidate : previous;
}

function updateCompletionCheckReview(
  review: CompletionCheckReviewV2,
  record: CompletionCheckAnswerRecord,
  correct: boolean
): CompletionCheckReviewV2 {
  const attempt: CompletionCheckReviewAttemptV2 = {
    answeredAt: record.answeredAt,
    selectedChoiceIndex: record.selectedChoiceIndex,
    correct,
    source: record.source
  };

  if (!correct) {
    return {
      ...review,
      lastAnsweredAt: record.answeredAt,
      dueDates: createDueDates(record.answeredAt),
      completedDueDates: [],
      attempts: [...review.attempts, attempt]
    };
  }

  const nextDueDate = record.source === 'review' ? getNextDueDate(review) : undefined;
  return {
    ...review,
    lastAnsweredAt: record.answeredAt,
    completedDueDates: nextDueDate === undefined || review.completedDueDates.includes(nextDueDate)
      ? review.completedDueDates.slice()
      : [...review.completedDueDates, nextDueDate],
    attempts: [...review.attempts, attempt]
  };
}

function countDueReviews(progress: ProgressBlob, lessonId: string, now: Date): number {
  return collectDueCompletionCheckReviews(progress, now)
    .filter((item) => item.review.lessonId === lessonId)
    .length;
}

function updateStreak(progress: ProgressBlob, completedAt: string, timeZone: string | undefined): void {
  const completionDate = formatCalendarDate(new Date(completedAt), timeZone);

  if (progress.lastCompletionDate === completionDate) {
    return;
  }

  if (progress.lastCompletionDate !== undefined && isNextDate(progress.lastCompletionDate, completionDate)) {
    progress.currentStreak += 1;
  } else {
    progress.currentStreak = 1;
  }

  progress.longestStreak = Math.max(progress.longestStreak, progress.currentStreak);
  progress.lastCompletionDate = completionDate;
}

function isNextDate(previousDate: string, nextDate: string): boolean {
  return shiftCalendarDate(previousDate, 1) === nextDate;
}

function formatCalendarDate(date: Date, timeZone: string | undefined): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (year === undefined || month === undefined || day === undefined) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function shiftCalendarDate(calendarDate: string, days: number): string {
  const [year, month, day] = calendarDate.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return calendarDate;
  }

  const shifted = new Date(year, month - 1, day + days);
  return [
    shifted.getFullYear().toString().padStart(4, '0'),
    (shifted.getMonth() + 1).toString().padStart(2, '0'),
    shifted.getDate().toString().padStart(2, '0')
  ].join('-');
}

function cloneProgressBlob(progress: ProgressBlob): ProgressBlob {
  return {
    ...progress,
    lessons: Object.fromEntries(
      Object.entries(progress.lessons).map(([lessonId, record]) => [
        lessonId,
        cloneLessonRecord(record)
      ])
    ),
    mockExamAttempts: progress.mockExamAttempts.map(createMockExamAttempt),
    completionCheckReviews: Object.fromEntries(
      Object.entries(progress.completionCheckReviews).map(([id, review]) => [
        id,
        {
          ...review,
          choices: review.choices.slice(),
          dueDates: review.dueDates.slice(),
          completedDueDates: review.completedDueDates.slice(),
          attempts: review.attempts.map((attempt) => ({ ...attempt }))
        }
      ])
    )
  };
}

function cloneLessonRecord(record: LessonProgressRecordV2): LessonProgressRecordV2 {
  const stored = record as LessonProgressRecordV2 & {
    attempts?: LessonProgressRecordV2['attempts'];
    mistakes?: LessonProgressRecordV2['mistakes'];
  };

  return {
    ...record,
    mistakes: Array.isArray(stored.mistakes)
      ? stored.mistakes.slice(0, maxStoredMistakes).map((mistake) => ({ ...mistake }))
      : [],
    attempts: Array.isArray(stored.attempts)
      ? stored.attempts.slice(-maxStoredAttempts).map((attempt) => ({
        ...attempt,
        mistakes: Array.isArray(attempt.mistakes)
          ? attempt.mistakes.slice(0, maxStoredMistakes).map((mistake) => ({ ...mistake }))
          : []
      }))
      : []
  };
}
