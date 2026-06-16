import type { Lesson, LessonCompletionCheck } from '../lessons/schema';
import { createLessonCatalogue } from '../lessons/lessonCatalogue';
import type { LessonProgressRecord } from '../progress/progressStore';

export interface CompletionSummaryContext {
  previousBestWpm?: number;
  currentStreak: number;
}

export interface CompletionCheckChoiceItem {
  label: string;
  description: string;
  choiceIndex: number;
}

export interface CompletionCheckItemOptions {
  random?: () => number;
}

export function createCompletionSummary(
  record: LessonProgressRecord,
  context: CompletionSummaryContext
): string {
  const bestText = formatBestWpm(record.wpm, context.previousBestWpm);
  const streakText = context.currentStreak === 1 ? '1-day streak' : `${context.currentStreak}-day streak`;
  return `Lesson done in ${formatDuration(record.durationMs)} - ${record.wpm} WPM ${bestText}, ${record.mistakeCount} ${record.mistakeCount === 1 ? 'mistake' : 'mistakes'}, ${streakText}`;
}

export function findNextLesson(currentLesson: Lesson, lessons: Lesson[]): Lesson | undefined {
  return createLessonCatalogue(lessons).nextAfter(currentLesson.id);
}

export function createCompletionCheckItems(
  check: LessonCompletionCheck,
  options: CompletionCheckItemOptions = {}
): CompletionCheckChoiceItem[] {
  const items = check.choices.map((choice, index) => ({
    label: choice,
    description: `Choice ${index + 1}`,
    choiceIndex: index
  }));

  if (options.random === undefined) {
    return items;
  }

  return shuffle(items, options.random).map((item, index) => ({
    ...item,
    description: `Choice ${index + 1}`
  }));
}

export function formatCompletionCheckFeedback(check: LessonCompletionCheck, selectedIndex: number): string {
  const prefix = selectedIndex === check.answerIndex ? 'Correct.' : 'Review this point.';
  return `${prefix} ${check.explanation}`;
}

function formatBestWpm(currentWpm: number, previousBestWpm: number | undefined): string {
  if (previousBestWpm === undefined || previousBestWpm <= 0) {
    return `(best ${currentWpm})`;
  }

  if (currentWpm > previousBestWpm) {
    return `(+${currentWpm - previousBestWpm} best)`;
  }

  return `(best ${previousBestWpm})`;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = items.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}
