import { openerForCloser } from './autoClosedPairs';

export interface MatchMistake {
  actualIndex: number;
  targetIndex: number;
  expected: string | undefined;
  actual: string;
}

export interface PrefixMatchResult {
  ok: boolean;
  nextIndex: number;
  ghostText: string;
  isComplete: boolean;
  normalizedActual: string;
  skippedClosers: number;
  mistake?: MatchMistake;
}

export interface GhostTextSegment {
  line: number;
  character: number;
  contentText: string;
}

export function analyzePrefix(targetCode: string, actualText: string): PrefixMatchResult {
  const target = normalizeLineEndings(targetCode);
  const actual = normalizeLineEndings(actualText);
  let targetIndex = 0;
  let skippedClosers = 0;
  let normalizedActual = '';

  for (let actualIndex = 0; actualIndex < actual.length; actualIndex += 1) {
    const actualChar = actual[actualIndex]!;
    const targetChar = target[targetIndex];

    if (targetChar !== undefined && actualChar === targetChar) {
      normalizedActual += actualChar;
      targetIndex += 1;
      continue;
    }

    if (shouldSkipAutoClosedCloser(actual, actualIndex, targetChar)) {
      skippedClosers += 1;
      continue;
    }

    return {
      ok: false,
      nextIndex: targetIndex,
      ghostText: target.slice(targetIndex),
      isComplete: false,
      normalizedActual,
      skippedClosers,
      mistake: {
        actualIndex,
        targetIndex,
        expected: targetChar,
        actual: actualChar
      }
    };
  }

  return {
    ok: true,
    nextIndex: targetIndex,
    ghostText: target.slice(targetIndex),
    isComplete: targetIndex === target.length,
    normalizedActual,
    skippedClosers
  };
}

export function getGhostTextSegments(targetCode: string, actualText: string): GhostTextSegment[] {
  const target = normalizeLineEndings(targetCode);
  const match = analyzePrefix(target, actualText);

  if (match.isComplete) {
    return [];
  }

  const position = indexToPosition(target, match.nextIndex);
  const remainingLines = match.ghostText.split('\n');
  const segments: GhostTextSegment[] = [];

  remainingLines.forEach((contentText, offset) => {
    if (contentText.length === 0) {
      return;
    }

    segments.push({
      line: position.line + offset,
      character: offset === 0 ? position.character : 0,
      contentText
    });
  });

  return segments;
}

export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

function shouldSkipAutoClosedCloser(actual: string, actualIndex: number, targetChar: string | undefined): boolean {
  const actualChar = actual[actualIndex]!;
  const opener = openerForCloser.get(actualChar);

  if (opener === undefined || targetChar === actualChar || actualIndex === 0) {
    return false;
  }

  if (opener === actualChar) {
    return countBefore(actual, actualIndex, opener) % 2 === 1;
  }

  return hasUnmatchedOpenerBefore(actual, actualIndex, opener, actualChar);
}

function indexToPosition(value: string, index: number): { line: number; character: number } {
  let line = 0;
  let character = 0;

  for (let offset = 0; offset < index; offset += 1) {
    if (value[offset] === '\n') {
      line += 1;
      character = 0;
    } else {
      character += 1;
    }
  }

  return { line, character };
}

function countBefore(value: string, endExclusive: number, needle: string): number {
  let count = 0;

  for (let index = 0; index < endExclusive; index += 1) {
    if (value[index] === needle) {
      count += 1;
    }
  }

  return count;
}

function hasUnmatchedOpenerBefore(
  value: string,
  endExclusive: number,
  opener: string,
  closer: string
): boolean {
  let depth = 0;

  for (let index = 0; index < endExclusive; index += 1) {
    const char = value[index];
    if (char === opener) {
      depth += 1;
    } else if (char === closer && depth > 0) {
      depth -= 1;
    }
  }

  return depth > 0;
}
