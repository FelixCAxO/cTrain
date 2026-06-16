import type { LessonCompletionCheck } from '../lessons/schema';
import type { CompletionCheckAnswerSourceV2, CompletionCheckReviewV2, ProgressBlobV2 } from './migrations';

export const completionCheckReviewOffsetsDays = [1, 3, 7] as const;

export interface CreateCompletionCheckReviewInput {
  lessonId: string;
  lessonTitle: string;
  checkIndex: number;
  check: LessonCompletionCheck;
  selectedChoiceIndex: number;
  answeredAt: string;
  source?: CompletionCheckAnswerSourceV2;
}

export interface DueCompletionCheckReview {
  review: CompletionCheckReviewV2;
  dueDate: string;
}

export interface SpacedRepetitionAccuracy {
  retestCount: number;
  correctRetestCount: number;
  accuracyPercent?: number;
}

export function createCompletionCheckId(lessonId: string, checkIndex: number): string {
  return `${lessonId}:${checkIndex}`;
}

export function createCompletionCheckReview(input: CreateCompletionCheckReviewInput): CompletionCheckReviewV2 {
  const correct = input.selectedChoiceIndex === input.check.answerIndex;
  return {
    id: createCompletionCheckId(input.lessonId, input.checkIndex),
    lessonId: input.lessonId,
    lessonTitle: input.lessonTitle,
    checkIndex: input.checkIndex,
    prompt: input.check.prompt,
    choices: input.check.choices.slice(),
    answerIndex: input.check.answerIndex,
    explanation: input.check.explanation,
    firstMissedAt: input.answeredAt,
    lastAnsweredAt: input.answeredAt,
    dueDates: createDueDates(input.answeredAt),
    completedDueDates: [],
    attempts: [{
      answeredAt: input.answeredAt,
      selectedChoiceIndex: input.selectedChoiceIndex,
      correct,
      source: input.source ?? 'lesson'
    }]
  };
}

export function createDueDates(answeredAt: string): string[] {
  const date = parseIsoDate(answeredAt);
  return completionCheckReviewOffsetsDays.map((offset) => addUtcDays(date, offset));
}

export function collectDueCompletionCheckReviews(
  progress: Pick<ProgressBlobV2, 'completionCheckReviews'>,
  now = new Date()
): DueCompletionCheckReview[] {
  const today = toUtcCalendarDate(now);
  return Object.values(progress.completionCheckReviews)
    .map((review) => {
      const dueDate = getNextDueDate(review);
      return dueDate === undefined || dueDate > today ? undefined : { review, dueDate };
    })
    .filter((item): item is DueCompletionCheckReview => item !== undefined)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate)
      || left.review.lessonTitle.localeCompare(right.review.lessonTitle)
      || left.review.checkIndex - right.review.checkIndex);
}

export function getNextDueDate(review: CompletionCheckReviewV2): string | undefined {
  return review.dueDates.find((dueDate) => !review.completedDueDates.includes(dueDate));
}

export function calculateSpacedRepetitionAccuracy(
  progress: Pick<ProgressBlobV2, 'completionCheckReviews'>
): SpacedRepetitionAccuracy {
  const reviewAttempts = Object.values(progress.completionCheckReviews)
    .flatMap((review) => review.attempts)
    .filter((attempt) => attempt.source === 'review');
  const correctRetestCount = reviewAttempts.filter((attempt) => attempt.correct).length;

  return {
    retestCount: reviewAttempts.length,
    correctRetestCount,
    accuracyPercent: reviewAttempts.length === 0
      ? undefined
      : Math.round((correctRetestCount / reviewAttempts.length) * 100)
  };
}

function parseIsoDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0);
  }
  return parsed;
}

function addUtcDays(date: Date, days: number): string {
  return toUtcCalendarDate(new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + days
  )));
}

function toUtcCalendarDate(date: Date): string {
  return [
    date.getUTCFullYear().toString().padStart(4, '0'),
    (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    date.getUTCDate().toString().padStart(2, '0')
  ].join('-');
}
