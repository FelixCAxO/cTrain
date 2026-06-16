import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';
import {
  calculateFinalWeekBlindSpots,
  calculateMockExamReadiness,
  calculateSprintProgress,
  hasMetTypingFluencyFloor,
  loadStudySprintProfile,
  studySprintProfile
} from '../src/progress/readiness';
import type { ProgressBlob } from '../src/progress/progressStore';

describe('certification readiness signals', () => {
  it('uses last-five mock average and three consecutive 80+ attempts as the booking gate', () => {
    const readiness = calculateMockExamReadiness(progress({
      mockExamAttempts: [66, 82, 78, 80, 84, 88].map((score, index) => mockAttempt(score, `2026-06-${10 + index}T08:00:00.000Z`))
    }));

    assert.equal(readiness.lastFiveAveragePercent, 82);
    assert.equal(readiness.consecutiveMocksAtOrAbove80, 3);
    assert.equal(readiness.readyToBook, true);
  });

  it('keeps the booking gate closed until the last three mocks are all at least 80 percent', () => {
    const readiness = calculateMockExamReadiness(progress({
      mockExamAttempts: [90, 82, 79, 88, 91].map((score, index) => mockAttempt(score, `2026-06-${10 + index}T08:00:00.000Z`))
    }));

    assert.equal(readiness.lastFiveAveragePercent, 86);
    assert.equal(readiness.consecutiveMocksAtOrAbove80, 2);
    assert.equal(readiness.readyToBook, false);
  });

  it('checks the typing fluency floor with WPM and error rate', () => {
    assert.equal(hasMetTypingFluencyFloor({
      completedAt: '2026-06-15T08:00:00.000Z',
      durationMs: 60_000,
      mistakeCount: 1,
      typedCharacters: 500,
      wpm: 55,
      errorRatePercent: 0.2
    }), true);
    assert.equal(hasMetTypingFluencyFloor({
      completedAt: '2026-06-15T08:00:00.000Z',
      durationMs: 60_000,
      mistakeCount: 15,
      typedCharacters: 500,
      wpm: 55,
      errorRatePercent: 3
    }), false);
  });

  it('tracks 12-day sprint minutes and practiced days from persisted attempts', () => {
    const summary = calculateSprintProgress(progress({
      lessons: {
        'java-class-basic-01': lessonRecord('java-class-basic-01', [
          ['2026-06-04T08:00:00.000Z', 30],
          ['2026-06-05T08:00:00.000Z', 45],
          ['2026-06-14T08:00:00.000Z', 90]
        ])
      },
      mockExamAttempts: [
        mockAttempt(80, '2026-06-15T08:00:00.000Z', 120)
      ]
    }), new Date('2026-06-15T12:00:00.000Z'));

    assert.equal(studySprintProfile.sprintDays, 12);
    assert.equal(studySprintProfile.targetTotalMinutes, 900);
    assert.equal(summary.practiceDays, 4);
    assert.equal(summary.totalMinutes, 285);
    assert.equal(summary.minutesRemaining, 615);
    assert.equal(summary.metDailyStreak, false);
  });

  it('loads the sprint target from the certification pre-implementation map', () => {
    const root = path.resolve(__dirname, '..');
    const mapPath = path.join(root, 'docs', 'java25-cert-preimplementation-map.json');
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf8')) as {
      studyProfile: { sprintDays: number; targetTotalMinutes: number };
    };

    assert.deepEqual(loadStudySprintProfile(mapPath), {
      sprintDays: map.studyProfile.sprintDays,
      targetTotalMinutes: map.studyProfile.targetTotalMinutes
    });
    assert.deepEqual(studySprintProfile, loadStudySprintProfile(mapPath));
  });

  it('reports final-week objective blind spots below 70 percent accuracy', () => {
    const blindSpots = calculateFinalWeekBlindSpots(progress({
      mockExamAttempts: [
        {
          ...mockAttempt(80, '2026-06-10T08:00:00.000Z'),
          objectiveResults: [
            objectiveResult('streams', 'Processing Data Using Streams and Lambda Expressions', 5, 5),
            objectiveResult('io', 'Performing Input and Output Operations Using the Java I/O API', 5, 2)
          ]
        },
        {
          ...mockAttempt(82, '2026-06-14T08:00:00.000Z'),
          objectiveResults: [
            objectiveResult('streams', 'Processing Data Using Streams and Lambda Expressions', 5, 4),
            objectiveResult('io', 'Performing Input and Output Operations Using the Java I/O API', 5, 4)
          ]
        },
        {
          ...mockAttempt(92, '2026-06-01T08:00:00.000Z'),
          objectiveResults: [
            objectiveResult('packaging', 'Packaging and Deploying Java Code', 5, 0)
          ]
        }
      ]
    }), new Date('2026-06-15T12:00:00.000Z'));

    assert.deepEqual(blindSpots, [
      {
        objectiveId: 'io',
        objectiveLabel: 'Performing Input and Output Operations Using the Java I/O API',
        questionCount: 10,
        correctCount: 6,
        accuracyPercent: 60
      }
    ]);
  });
});

function progress(overrides: Partial<ProgressBlob> = {}): ProgressBlob {
  return {
    version: 2,
    updatedAt: '2026-06-15T00:00:00.000Z',
    currentStreak: 0,
    longestStreak: 0,
    lessons: {},
    mockExamAttempts: [],
    completionCheckReviews: {},
    ...overrides
  };
}

function lessonRecord(lessonId: string, attempts: [string, number][]): ProgressBlob['lessons'][string] {
  const mappedAttempts = attempts.map(([completedAt, minutes]) => ({
    completedAt,
    durationMs: minutes * 60_000,
    mistakeCount: 0,
    rejectedPasteCount: 0,
    typedCharacters: 500,
    wpm: 50,
    mistakes: []
  }));
  const last = mappedAttempts.at(-1)!;

  return {
    lessonId,
    lessonVersion: 1,
    status: 'completed',
    ...last,
    bestWpm: 50,
    lastWpm: 50,
    attempts: mappedAttempts,
    personalBest: {
      completedAt: last.completedAt,
      durationMs: last.durationMs,
      mistakeCount: 0,
      typedCharacters: 500,
      wpm: 50,
      errorRatePercent: 0
    }
  };
}

function mockAttempt(scorePercent: number, completedAt: string, minutes = 120): ProgressBlob['mockExamAttempts'][number] {
  return {
    completedAt,
    durationMs: minutes * 60_000,
    questionCount: 50,
    correctCount: Math.round(scorePercent / 2),
    scorePercent,
    passed: scorePercent >= 68,
    lessonIds: ['java-class-basic-01'],
    wrongAnswers: [],
    objectiveResults: []
  };
}

function objectiveResult(
  objectiveId: string,
  objectiveLabel: string,
  questionCount: number,
  correctCount: number
): ProgressBlob['mockExamAttempts'][number]['objectiveResults'][number] {
  return {
    objectiveId,
    objectiveLabel,
    questionCount,
    correctCount,
    accuracyPercent: Math.round((correctCount / questionCount) * 100)
  };
}
