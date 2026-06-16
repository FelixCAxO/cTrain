import type { MatchMistake } from '../training/prefixMatch';

export interface AttemptV2 {
  completedAt: string;
  durationMs: number;
  mistakeCount: number;
  rejectedPasteCount: number;
  typedCharacters: number;
  wpm: number;
  mistakes: MatchMistake[];
}

export interface LessonPersonalBestV2 {
  completedAt: string;
  durationMs: number;
  mistakeCount: number;
  typedCharacters: number;
  wpm: number;
  errorRatePercent: number;
}

export interface LessonProgressRecordV2 extends AttemptV2 {
  lessonId: string;
  lessonVersion: number;
  status: 'completed';
  bestWpm: number;
  lastWpm: number;
  attempts: AttemptV2[];
  personalBest: LessonPersonalBestV2;
}

export type CompletionCheckAnswerSourceV2 = 'lesson' | 'review' | 'mock-exam';

export interface CompletionCheckReviewAttemptV2 {
  answeredAt: string;
  selectedChoiceIndex: number;
  correct: boolean;
  source: CompletionCheckAnswerSourceV2;
}

export interface CompletionCheckReviewV2 {
  id: string;
  lessonId: string;
  lessonTitle: string;
  checkIndex: number;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  firstMissedAt: string;
  lastAnsweredAt: string;
  dueDates: string[];
  completedDueDates: string[];
  attempts: CompletionCheckReviewAttemptV2[];
}

export interface MockExamObjectiveResultV2 {
  objectiveId: string;
  objectiveLabel: string;
  questionCount: number;
  correctCount: number;
  accuracyPercent: number;
}

export interface MockExamWrongAnswerV2 {
  lessonId: string;
  lessonTitle: string;
  objectiveId?: string;
  objectiveLabel?: string;
  prompt: string;
  selectedChoice: string;
  correctChoice: string;
  explanation: string;
}

export interface MockExamAttemptV2 {
  completedAt: string;
  durationMs: number;
  questionCount: number;
  correctCount: number;
  scorePercent: number;
  passed: boolean;
  lessonIds: string[];
  objectiveResults: MockExamObjectiveResultV2[];
  wrongAnswers: MockExamWrongAnswerV2[];
}

export interface ProgressBlobV2 {
  version: 2;
  updatedAt: string;
  lastCompletionDate?: string;
  streakReminderSnoozedDate?: string;
  currentStreak: number;
  longestStreak: number;
  lessons: Record<string, LessonProgressRecordV2>;
  mockExamAttempts: MockExamAttemptV2[];
  completionCheckReviews: Record<string, CompletionCheckReviewV2>;
}

interface LessonProgressRecordV1 {
  lessonId: string;
  lessonVersion: number;
  status: 'completed';
  completedAt: string;
  durationMs: number;
  mistakeCount: number;
}

interface ProgressBlobV1 {
  version: 1;
  updatedAt: string;
  lessons: Record<string, LessonProgressRecordV1>;
}

export function createEmptyProgressBlob(updatedAt = new Date(0).toISOString()): ProgressBlobV2 {
  return {
    version: 2,
    updatedAt,
    currentStreak: 0,
    longestStreak: 0,
    lessons: {},
    mockExamAttempts: [],
    completionCheckReviews: {}
  };
}

export function migrateProgressBlob(value: unknown): ProgressBlobV2 {
  if (isProgressBlobV2(value)) {
    return normalizeProgressBlobV2(value);
  }

  if (isProgressBlobV1(value)) {
    const migrated = createEmptyProgressBlob(value.updatedAt);

    for (const [lessonId, record] of Object.entries(value.lessons)) {
      if (!isProgressRecordV1(record)) {
        continue;
      }

      migrated.lessons[lessonId] = migrateRecordV1(record);
    }

    return migrated;
  }

  return createEmptyProgressBlob();
}

export const maxStoredMistakes = 200;
export const maxStoredAttempts = 20;
export const maxStoredMockExamAttempts = 20;
export const maxStoredMockExamWrongAnswers = 200;

export function createAttempt(record: AttemptV2): AttemptV2 {
  return {
    completedAt: record.completedAt,
    durationMs: record.durationMs,
    mistakeCount: record.mistakeCount,
    rejectedPasteCount: record.rejectedPasteCount,
    typedCharacters: record.typedCharacters,
    wpm: record.wpm,
    mistakes: record.mistakes.slice(0, maxStoredMistakes)
  };
}

export function createMockExamAttempt(record: MockExamAttemptV2): MockExamAttemptV2 {
  return {
    completedAt: record.completedAt,
    durationMs: record.durationMs,
    questionCount: record.questionCount,
    correctCount: record.correctCount,
    scorePercent: record.scorePercent,
    passed: record.passed,
    lessonIds: Array.isArray(record.lessonIds) ? record.lessonIds.slice() : [],
    objectiveResults: Array.isArray(record.objectiveResults)
      ? record.objectiveResults.map(createMockExamObjectiveResult)
      : [],
    wrongAnswers: Array.isArray(record.wrongAnswers)
      ? record.wrongAnswers.slice(0, maxStoredMockExamWrongAnswers).map((wrongAnswer) => ({ ...wrongAnswer }))
      : []
  };
}

export function createLessonPersonalBest(record: AttemptV2): LessonPersonalBestV2 {
  return {
    completedAt: record.completedAt,
    durationMs: record.durationMs,
    mistakeCount: record.mistakeCount,
    typedCharacters: record.typedCharacters,
    wpm: record.wpm,
    errorRatePercent: calculateErrorRatePercent(record.mistakeCount, record.typedCharacters)
  };
}

function migrateRecordV1(record: LessonProgressRecordV1): LessonProgressRecordV2 {
  const attempt = createAttempt({
    completedAt: record.completedAt,
    durationMs: record.durationMs,
    mistakeCount: record.mistakeCount,
    rejectedPasteCount: 0,
    typedCharacters: 0,
    wpm: 0,
    mistakes: []
  });

  return {
    lessonId: record.lessonId,
    lessonVersion: record.lessonVersion,
    status: 'completed',
    completedAt: record.completedAt,
    durationMs: record.durationMs,
    mistakeCount: record.mistakeCount,
    rejectedPasteCount: 0,
    typedCharacters: 0,
    wpm: 0,
    bestWpm: 0,
    lastWpm: 0,
    attempts: [attempt],
    personalBest: createLessonPersonalBest(attempt),
    mistakes: []
  };
}

function normalizeProgressBlobV2(progress: ProgressBlobV2): ProgressBlobV2 {
  return {
    ...progress,
    lessons: Object.fromEntries(
      Object.entries(progress.lessons).map(([lessonId, record]) => [
        lessonId,
        normalizeLessonRecord({
          ...record,
          mistakes: Array.isArray(record.mistakes) ? record.mistakes.slice(0, maxStoredMistakes) : [],
          attempts: Array.isArray(record.attempts)
            ? record.attempts.slice(-maxStoredAttempts).map(createAttempt)
            : []
        })
      ])
    ),
    mockExamAttempts: Array.isArray(progress.mockExamAttempts)
      ? progress.mockExamAttempts.slice(-maxStoredMockExamAttempts).map(createMockExamAttempt)
      : [],
    completionCheckReviews: normalizeCompletionCheckReviews(progress.completionCheckReviews)
  };
}

function normalizeLessonRecord(record: LessonProgressRecordV2): LessonProgressRecordV2 {
  const personalBest = isLessonPersonalBest(record.personalBest)
    ? record.personalBest
    : selectPersonalBest(record.attempts.length > 0 ? record.attempts : [record]);

  return {
    ...record,
    personalBest
  };
}

function selectPersonalBest(attempts: AttemptV2[]): LessonPersonalBestV2 {
  const [first, ...rest] = attempts;
  const best = rest.reduce((currentBest, attempt) => (
    isBetterPersonalBest(attempt, currentBest) ? attempt : currentBest
  ), first ?? {
    completedAt: new Date(0).toISOString(),
    durationMs: 0,
    mistakeCount: 0,
    rejectedPasteCount: 0,
    typedCharacters: 0,
    wpm: 0,
    mistakes: []
  });

  return createLessonPersonalBest(best);
}

function isBetterPersonalBest(candidate: AttemptV2, currentBest: AttemptV2): boolean {
  if (candidate.wpm !== currentBest.wpm) {
    return candidate.wpm > currentBest.wpm;
  }

  return calculateErrorRatePercent(candidate.mistakeCount, candidate.typedCharacters)
    < calculateErrorRatePercent(currentBest.mistakeCount, currentBest.typedCharacters);
}

function createMockExamObjectiveResult(record: MockExamObjectiveResultV2): MockExamObjectiveResultV2 {
  return {
    objectiveId: record.objectiveId,
    objectiveLabel: record.objectiveLabel,
    questionCount: record.questionCount,
    correctCount: record.correctCount,
    accuracyPercent: record.accuracyPercent
  };
}

function normalizeCompletionCheckReviews(value: unknown): Record<string, CompletionCheckReviewV2> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, CompletionCheckReviewV2] => isCompletionCheckReview(entry[1]))
      .map(([id, review]) => [
        id,
        {
          ...review,
          choices: review.choices.slice(),
          dueDates: review.dueDates.slice(),
          completedDueDates: review.completedDueDates.slice(),
          attempts: review.attempts.map((attempt) => ({ ...attempt }))
        }
      ])
  );
}

function isLessonPersonalBest(value: unknown): value is LessonPersonalBestV2 {
  return isRecord(value)
    && typeof value.completedAt === 'string'
    && typeof value.durationMs === 'number'
    && typeof value.mistakeCount === 'number'
    && typeof value.typedCharacters === 'number'
    && typeof value.wpm === 'number'
    && typeof value.errorRatePercent === 'number';
}

function isCompletionCheckReview(value: unknown): value is CompletionCheckReviewV2 {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.lessonId === 'string'
    && typeof value.lessonTitle === 'string'
    && typeof value.checkIndex === 'number'
    && typeof value.prompt === 'string'
    && Array.isArray(value.choices)
    && typeof value.answerIndex === 'number'
    && typeof value.explanation === 'string'
    && typeof value.firstMissedAt === 'string'
    && typeof value.lastAnsweredAt === 'string'
    && Array.isArray(value.dueDates)
    && Array.isArray(value.completedDueDates)
    && Array.isArray(value.attempts);
}

function calculateErrorRatePercent(mistakeCount: number, typedCharacters: number): number {
  if (typedCharacters <= 0) {
    return mistakeCount === 0 ? 0 : 100;
  }

  return Number(((mistakeCount / typedCharacters) * 100).toFixed(1));
}

function isProgressBlobV2(value: unknown): value is ProgressBlobV2 {
  return isRecord(value)
    && value.version === 2
    && typeof value.updatedAt === 'string'
    && typeof value.currentStreak === 'number'
    && typeof value.longestStreak === 'number'
    && isRecord(value.lessons);
}

function isProgressBlobV1(value: unknown): value is ProgressBlobV1 {
  return isRecord(value) && value.version === 1 && typeof value.updatedAt === 'string' && isRecord(value.lessons);
}

function isProgressRecordV1(value: unknown): value is LessonProgressRecordV1 {
  return isRecord(value)
    && typeof value.lessonId === 'string'
    && typeof value.lessonVersion === 'number'
    && value.status === 'completed'
    && typeof value.completedAt === 'string'
    && typeof value.durationMs === 'number'
    && typeof value.mistakeCount === 'number';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
