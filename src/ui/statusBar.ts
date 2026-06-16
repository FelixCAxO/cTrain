import type { TrainingSessionStatus } from '../training/trainingSession';

export function formatStatusBarText(status: TrainingSessionStatus): string {
  const metrics = formatMetrics(status);
  if (status.isComplete) {
    return `cTrain: ${metrics}`;
  }

  if (status.feedback !== undefined) {
    return `cTrain: ${metrics} | ${status.feedback}`;
  }

  return `cTrain: ${metrics}`;
}

export function formatPausedStatusBarText(status: TrainingSessionStatus): string {
  return `cTrain: [PAUSED] ${formatMetrics(status)}`;
}

export function formatStatusBarAccessibilityLabel(status: TrainingSessionStatus): string {
  const wpm = shouldDisplayWpm(status) ? `${status.wpm} words per minute` : 'words per minute pending';
  const elapsed = formatElapsedForSpeech(status.elapsedMs);
  return `cTrain lesson ${formatPercent(status).replace('%', ' percent')} complete, ${wpm}, elapsed ${elapsed}, ${formatMistakes(status.mistakeCount)}`;
}

function formatMetrics(status: TrainingSessionStatus): string {
  return `${formatPercent(status)} | ${formatWpm(status)} | ${formatElapsed(status.elapsedMs)} | ${formatMistakes(status.mistakeCount)}`;
}

function formatPercent(status: TrainingSessionStatus): string {
  return `${status.isComplete ? 100 : status.percentComplete}%`;
}

function formatWpm(status: TrainingSessionStatus): string {
  return `${shouldDisplayWpm(status) ? status.wpm.toString() : '--'} WPM`;
}

function shouldDisplayWpm(status: TrainingSessionStatus): boolean {
  return status.elapsedMs >= 3_000 && status.typedCharacters >= 10;
}

function formatMistakes(count: number): string {
  return count === 1 ? '1 mistake' : `${count} mistakes`;
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatElapsedForSpeech(elapsedMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
}
