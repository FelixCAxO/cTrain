import fs from 'node:fs';
import path from 'node:path';
import type { LessonPersonalBestV2, MockExamObjectiveResultV2, ProgressBlobV2 } from './migrations';

export interface StudySprintProfile {
  sprintDays: number;
  targetTotalMinutes: number;
}

export const fallbackStudySprintProfile: StudySprintProfile = {
  sprintDays: 12,
  targetTotalMinutes: 900
};

export const studySprintProfile = loadStudySprintProfile();

export interface MockExamReadinessSummary {
  lastFiveAveragePercent?: number;
  consecutiveMocksAtOrAbove80: number;
  readyToBook: boolean;
}

export interface SprintProgressSummary {
  totalMinutes: number;
  targetMinutes: number;
  practiceDays: number;
  sprintDays: number;
  minutesRemaining: number;
  metDailyStreak: boolean;
  metMinuteTarget: boolean;
}

export interface ObjectiveBlindSpot {
  objectiveId: string;
  objectiveLabel: string;
  questionCount: number;
  correctCount: number;
  accuracyPercent: number;
}

export function loadStudySprintProfile(mapPath = findPreimplementationMapPath()): StudySprintProfile {
  if (mapPath === undefined) {
    return fallbackStudySprintProfile;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(mapPath, 'utf8')) as {
      studyProfile?: Partial<StudySprintProfile>;
    };
    const sprintDays = parsed.studyProfile?.sprintDays;
    const targetTotalMinutes = parsed.studyProfile?.targetTotalMinutes;

    if (isPositiveInteger(sprintDays) && isPositiveInteger(targetTotalMinutes)) {
      return { sprintDays, targetTotalMinutes };
    }
  } catch {
    return fallbackStudySprintProfile;
  }

  return fallbackStudySprintProfile;
}

export function calculateMockExamReadiness(progress: Pick<ProgressBlobV2, 'mockExamAttempts'>): MockExamReadinessSummary {
  const attempts = progress.mockExamAttempts.slice(-5);
  const lastFiveAveragePercent = attempts.length === 0
    ? undefined
    : Math.round(attempts.reduce((sum, attempt) => sum + attempt.scorePercent, 0) / attempts.length);

  let consecutiveMocksAtOrAbove80 = 0;
  for (let index = progress.mockExamAttempts.length - 1; index >= 0; index -= 1) {
    if (progress.mockExamAttempts[index]!.scorePercent < 80) {
      break;
    }
    consecutiveMocksAtOrAbove80 += 1;
  }

  return {
    lastFiveAveragePercent,
    consecutiveMocksAtOrAbove80,
    readyToBook: consecutiveMocksAtOrAbove80 >= 3
  };
}

export function hasMetTypingFluencyFloor(personalBest: LessonPersonalBestV2 | undefined): boolean {
  return personalBest !== undefined
    && personalBest.wpm >= 45
    && personalBest.errorRatePercent < 2;
}

export function calculateSprintProgress(
  progress: Pick<ProgressBlobV2, 'lessons' | 'mockExamAttempts'>,
  now = new Date()
): SprintProgressSummary {
  const endDate = toUtcCalendarDate(now);
  const startDate = addUtcDays(now, -(studySprintProfile.sprintDays - 1));
  const practiceDays = new Set<string>();
  let totalMs = 0;

  for (const lesson of Object.values(progress.lessons)) {
    for (const attempt of lesson.attempts) {
      const date = toUtcCalendarDate(new Date(attempt.completedAt));
      if (date >= startDate && date <= endDate) {
        practiceDays.add(date);
        totalMs += attempt.durationMs;
      }
    }
  }

  for (const attempt of progress.mockExamAttempts) {
    const date = toUtcCalendarDate(new Date(attempt.completedAt));
    if (date >= startDate && date <= endDate) {
      practiceDays.add(date);
      totalMs += attempt.durationMs;
    }
  }

  const totalMinutes = Math.round(totalMs / 60_000);
  return {
    totalMinutes,
    targetMinutes: studySprintProfile.targetTotalMinutes,
    practiceDays: practiceDays.size,
    sprintDays: studySprintProfile.sprintDays,
    minutesRemaining: Math.max(0, studySprintProfile.targetTotalMinutes - totalMinutes),
    metDailyStreak: practiceDays.size >= studySprintProfile.sprintDays,
    metMinuteTarget: totalMinutes >= studySprintProfile.targetTotalMinutes
  };
}

export function calculateFinalWeekBlindSpots(
  progress: Pick<ProgressBlobV2, 'mockExamAttempts'>,
  now = new Date()
): ObjectiveBlindSpot[] {
  const cutoff = now.getTime() - (7 * 24 * 60 * 60 * 1000);
  const aggregates = new Map<string, MockExamObjectiveResultV2>();

  for (const attempt of progress.mockExamAttempts) {
    const completedAt = Date.parse(attempt.completedAt);
    if (!Number.isFinite(completedAt) || completedAt < cutoff || completedAt > now.getTime()) {
      continue;
    }

    for (const result of attempt.objectiveResults) {
      const existing = aggregates.get(result.objectiveId);
      if (existing === undefined) {
        aggregates.set(result.objectiveId, { ...result });
      } else {
        existing.questionCount += result.questionCount;
        existing.correctCount += result.correctCount;
        existing.accuracyPercent = calculateAccuracy(existing.correctCount, existing.questionCount);
      }
    }
  }

  return [...aggregates.values()]
    .filter((result) => result.questionCount > 0 && result.accuracyPercent < 70)
    .sort((left, right) => left.accuracyPercent - right.accuracyPercent
      || left.objectiveLabel.localeCompare(right.objectiveLabel));
}

function calculateAccuracy(correctCount: number, questionCount: number): number {
  return questionCount === 0 ? 0 : Math.round((correctCount / questionCount) * 100);
}

function findPreimplementationMapPath(): string | undefined {
  const fileName = path.join('docs', 'java25-cert-preimplementation-map.json');
  const candidates = [
    path.resolve(__dirname, '..', '..', fileName),
    path.resolve(__dirname, '..', '..', '..', fileName),
    path.resolve(__dirname, '..', fileName),
    path.resolve(process.cwd(), fileName)
  ];

  return [...new Set(candidates)].find((candidate) => fs.existsSync(candidate));
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
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
