import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import type { ProgressBlob } from '../src/progress/progressStore';
import { formatStreakReminder, shouldShowStreakReminder } from '../src/progress/streakReminder';

describe('streak reminder', () => {
  it('does not show when there is no prior completion or no active streak', () => {
    assert.equal(shouldShowStreakReminder(progress({ lastCompletionDate: undefined, currentStreak: 0 })), false);
    assert.equal(shouldShowStreakReminder(progress({ lastCompletionDate: '2026-05-17', currentStreak: 0 })), false);
  });

  it('shows only on the calendar day after the last completion', () => {
    assert.equal(
      shouldShowStreakReminder(progress({ lastCompletionDate: '2026-05-17', currentStreak: 3 }), new Date('2026-05-17T12:00:00.000Z')),
      false
    );
    assert.equal(
      shouldShowStreakReminder(progress({ lastCompletionDate: '2026-05-17', currentStreak: 3 }), new Date('2026-05-18T12:00:00.000Z')),
      true
    );
    assert.equal(
      shouldShowStreakReminder(progress({ lastCompletionDate: '2026-05-17', currentStreak: 3 }), new Date('2026-05-19T12:00:00.000Z')),
      false
    );
  });

  it('uses the supplied time zone when deriving the current calendar day', () => {
    const blob = progress({ lastCompletionDate: '2026-05-18', currentStreak: 3 });
    const now = new Date('2026-05-18T22:30:00.000Z');

    assert.equal(shouldShowStreakReminder(blob, now, 'UTC'), false);
    assert.equal(shouldShowStreakReminder(blob, now, 'Europe/Stockholm'), true);
  });

  it('suppresses reminders snoozed for the current local calendar day only', () => {
    const blob = progress({
      lastCompletionDate: '2026-05-17',
      currentStreak: 3,
      streakReminderSnoozedDate: '2026-05-18'
    });

    assert.equal(shouldShowStreakReminder(blob, new Date('2026-05-18T12:00:00.000Z')), false);
    assert.equal(shouldShowStreakReminder({
      ...blob,
      streakReminderSnoozedDate: '2026-05-17'
    }, new Date('2026-05-18T12:00:00.000Z')), true);
  });

  it('handles month, year, and leap-day boundaries', () => {
    assert.equal(
      shouldShowStreakReminder(progress({ lastCompletionDate: '2025-12-31', currentStreak: 2 }), new Date('2026-01-01T10:00:00.000Z')),
      true
    );
    assert.equal(
      shouldShowStreakReminder(progress({ lastCompletionDate: '2024-02-29', currentStreak: 2 }), new Date('2024-03-01T10:00:00.000Z')),
      true
    );
  });

  it('formats the user-facing reminder text with the current streak length', () => {
    assert.equal(
      formatStreakReminder(4),
      'Your 4-day cTrain streak is waiting. Practice a lesson today to keep it going.'
    );
  });
});

function progress(overrides: Partial<ProgressBlob>): ProgressBlob {
  return {
    version: 2,
    updatedAt: '2026-05-18T00:00:00.000Z',
    currentStreak: 1,
    longestStreak: 1,
    lessons: {},
    mockExamAttempts: [],
    completionCheckReviews: {},
    ...overrides
  };
}
