import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { formatPausedStatusBarText, formatStatusBarAccessibilityLabel, formatStatusBarText } from '../src/ui/statusBar';
import type { TrainingSessionStatus } from '../src/training/trainingSession';

describe('status bar formatting', () => {
  it('keeps the progress segment visible when transient feedback is present', () => {
    const text = formatStatusBarText(status({
      typedCharacters: 8,
      percentComplete: 40,
      elapsedMs: 2_500,
      mistakeCount: 1,
      feedback: "expected 'b' got 'x' at line 1"
    }));

    assert.equal(text, "cTrain: 40% | -- WPM | 0:02 | 1 mistake | expected 'b' got 'x' at line 1");
  });

  it('renders WPM only after enough typing time and characters have elapsed', () => {
    assert.match(formatStatusBarText(status({ typedCharacters: 9, elapsedMs: 10_000, wpm: 11 })), /-- WPM/);
    assert.match(formatStatusBarText(status({ typedCharacters: 10, elapsedMs: 2_999, wpm: 40 })), /-- WPM/);
    assert.match(formatStatusBarText(status({ typedCharacters: 10, elapsedMs: 3_000, wpm: 40 })), /40 WPM/);
  });

  it('provides a screen-reader label for the status item', () => {
    assert.equal(
      formatStatusBarAccessibilityLabel(status({ typedCharacters: 10, elapsedMs: 3_000, percentComplete: 25, wpm: 40 })),
      'cTrain lesson 25 percent complete, 40 words per minute, elapsed 0 minutes 3 seconds, 0 mistakes'
    );
  });

  it('marks paused sessions with a warning prefix while preserving metrics', () => {
    assert.equal(
      formatPausedStatusBarText(status({ typedCharacters: 10, elapsedMs: 3_000, percentComplete: 25, wpm: 40 })),
      'cTrain: [PAUSED] 25% | 40 WPM | 0:03 | 0 mistakes'
    );
  });

  it('shows completed sessions as 100 percent and suppresses transient feedback', () => {
    const completed = status({
      isComplete: true,
      percentComplete: 90,
      typedCharacters: 20,
      elapsedMs: 10_000,
      wpm: 24,
      feedback: "expected 'x' got 'y' at line 1"
    });

    assert.equal(formatStatusBarText(completed), 'cTrain: 100% | 24 WPM | 0:10 | 0 mistakes');
    assert.equal(
      formatStatusBarAccessibilityLabel(completed),
      'cTrain lesson 100 percent complete, 24 words per minute, elapsed 0 minutes 10 seconds, 0 mistakes'
    );
  });
});

function status(overrides: Partial<TrainingSessionStatus> = {}): TrainingSessionStatus {
  return {
    isComplete: false,
    typedCharacters: 0,
    totalCharacters: 20,
    percentComplete: 0,
    elapsedMs: 0,
    wpm: 0,
    mistakeCount: 0,
    rejectedPasteCount: 0,
    ...overrides
  };
}
