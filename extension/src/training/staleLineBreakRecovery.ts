import { analyzePrefix, normalizeLineEndings } from './prefixMatch';
import { isAutoClosedPairText } from './autoClosedPairs';
import type { TextChange } from './pastePolicy';

export function recoverStaleAutoLineBreakInput(
  targetCode: string,
  currentDocumentText: string,
  nextText: string,
  changes: TextChange[]
): string {
  const current = normalizeLineEndings(currentDocumentText);
  const next = normalizeLineEndings(nextText);
  const insertedText = normalizeLineEndings(changes.map((change) => change.text).join(''));
  const indentationRecovered = recoverInputBeforeTargetIndentation(targetCode, next, insertedText);
  if (indentationRecovered !== next) {
    return indentationRecovered;
  }

  const pendingTargetLayoutRecovered = recoverInputBeforePendingTargetLayout(targetCode, current, next, insertedText);
  if (pendingTargetLayoutRecovered !== undefined) {
    return pendingTargetLayoutRecovered;
  }

  if (insertedText.length === 0 || next.startsWith(current)) {
    return next;
  }

  const pendingLayout = /\n+[ \t]*$/.exec(current);
  if (pendingLayout === null || pendingLayout.index === undefined) {
    return next;
  }

  const beforePendingLayout = current.slice(0, pendingLayout.index);
  const pendingLayoutText = current.slice(pendingLayout.index);
  if (!next.startsWith(beforePendingLayout)) {
    return next;
  }

  const staleSuffix = next.slice(beforePendingLayout.length);
  if (staleSuffix.length === 0) {
    return next;
  }

  if (!staleSuffix.includes('\n')) {
    const recovered = current + staleSuffix;
    return analyzePrefix(targetCode, recovered).ok ? recovered : next;
  }

  if (insertedText.includes('\n')) {
    return next;
  }

  const insertedAt = staleSuffix.indexOf(insertedText);
  if (insertedAt < 0) {
    return next;
  }

  const suffixWithoutInsertedText = staleSuffix.slice(0, insertedAt)
    + staleSuffix.slice(insertedAt + insertedText.length);
  if (suffixWithoutInsertedText !== pendingLayoutText) {
    return next;
  }

  const recovered = current + insertedText;
  return analyzePrefix(targetCode, recovered).ok ? recovered : next;
}

export function recoverStaleAutomaticInsertionInput(
  targetCode: string,
  currentDocumentText: string,
  nextText: string,
  changes: TextChange[],
  pendingAutomaticInsertionStart: number | undefined
): string {
  const current = normalizeLineEndings(currentDocumentText);
  const next = normalizeLineEndings(nextText);
  const insertedText = normalizeLineEndings(changes.map((change) => change.text).join(''));
  const indentationRecovered = recoverInputBeforeTargetIndentation(targetCode, next, insertedText);
  if (indentationRecovered !== next) {
    return indentationRecovered;
  }

  const pendingTargetLayoutRecovered = recoverInputBeforePendingTargetLayout(targetCode, current, next, insertedText);
  if (pendingTargetLayoutRecovered !== undefined) {
    return pendingTargetLayoutRecovered;
  }

  if (pendingAutomaticInsertionStart === undefined) {
    return recoverStaleAutoLineBreakInput(targetCode, currentDocumentText, nextText, changes);
  }

  if (
    insertedText.length === 0
    || next.startsWith(current)
    || pendingAutomaticInsertionStart < 0
    || pendingAutomaticInsertionStart > current.length
  ) {
    return next;
  }

  const beforePendingInsertion = current.slice(0, pendingAutomaticInsertionStart);
  const pendingInsertionText = current.slice(pendingAutomaticInsertionStart);
  if (!next.startsWith(beforePendingInsertion)) {
    return recoverStaleAutoLineBreakInput(targetCode, currentDocumentText, nextText, changes);
  }

  const staleSuffix = next.slice(beforePendingInsertion.length);
  if (staleSuffix.length === 0) {
    return next;
  }

  if (!staleSuffix.includes('\n')) {
    const recovered = current + staleSuffix;
    if (analyzePrefix(targetCode, recovered).ok) {
      return recovered;
    }

    return recoverStaleInputBeforePendingAutomaticInsertion(
      targetCode,
      current,
      beforePendingInsertion,
      staleSuffix,
      insertedText,
      pendingAutomaticInsertionStart
    ) ?? recoverStaleAutoLineBreakInput(targetCode, currentDocumentText, nextText, changes);
  }

  if (insertedText.includes('\n')) {
    return next;
  }

  const insertedAt = staleSuffix.indexOf(insertedText);
  if (insertedAt < 0) {
    return recoverStaleAutoLineBreakInput(targetCode, currentDocumentText, nextText, changes);
  }

  const suffixWithoutInsertedText = staleSuffix.slice(0, insertedAt)
    + staleSuffix.slice(insertedAt + insertedText.length);
  if (suffixWithoutInsertedText !== pendingInsertionText) {
    return recoverStaleAutoLineBreakInput(targetCode, currentDocumentText, nextText, changes);
  }

  const recovered = current + insertedText;
  return analyzePrefix(targetCode, recovered).ok
    ? recovered
    : recoverStaleAutoLineBreakInput(targetCode, currentDocumentText, nextText, changes);
}

function recoverInputBeforeTargetIndentation(
  targetCode: string,
  nextText: string,
  insertedText: string
): string {
  const target = normalizeLineEndings(targetCode);
  const next = normalizeLineEndings(nextText);

  if (insertedText.length !== 1 || insertedText === '\n' || insertedText === '\r') {
    return next;
  }

  const match = analyzePrefix(target, next);
  if (match.ok) {
    return recoverSkippedInputBeforeTargetIndentation(target, next, insertedText, match.nextIndex, match.normalizedActual, match.skippedClosers);
  }

  if (match.mistake === undefined || match.mistake.actual !== insertedText) {
    return next;
  }

  return recoverInputAtTargetIndentation(target, next, insertedText, match.mistake.targetIndex, match.mistake.actualIndex);
}

function recoverSkippedInputBeforeTargetIndentation(
  target: string,
  next: string,
  insertedText: string,
  targetIndex: number,
  normalizedActual: string,
  skippedClosers: number
): string {
  if (skippedClosers === 0) {
    return next;
  }

  const actualIndex = next.lastIndexOf(insertedText);
  if (actualIndex < 0 || next.slice(0, actualIndex) !== normalizedActual) {
    return next;
  }

  return recoverInputAtTargetIndentation(target, next, insertedText, targetIndex, actualIndex);
}

function recoverInputAtTargetIndentation(
  target: string,
  next: string,
  insertedText: string,
  targetIndex: number,
  actualIndex: number
): string {
  if (!isHorizontalWhitespace(target[targetIndex])) {
    return next;
  }

  const lineStart = target.lastIndexOf('\n', targetIndex - 1) + 1;
  if (!isOnlyHorizontalWhitespace(target.slice(lineStart, targetIndex))) {
    return next;
  }

  let nextTargetIndex = targetIndex;
  while (isHorizontalWhitespace(target[nextTargetIndex])) {
    nextTargetIndex += 1;
  }

  if (target[nextTargetIndex] !== insertedText) {
    return next;
  }

  const missingIndentation = target.slice(targetIndex, nextTargetIndex);
  const recovered = next.slice(0, actualIndex)
    + missingIndentation
    + next.slice(actualIndex);

  return analyzePrefix(target, recovered).ok ? recovered : next;
}

function recoverInputBeforePendingTargetLayout(
  targetCode: string,
  currentDocumentText: string,
  nextText: string,
  insertedText: string
): string | undefined {
  const target = normalizeLineEndings(targetCode);
  const current = normalizeLineEndings(currentDocumentText);
  const next = normalizeLineEndings(nextText);

  if (insertedText.length === 0 || insertedText.includes('\n') || insertedText.includes('\r') || !next.startsWith(current)) {
    return undefined;
  }

  const staleSuffix = next.slice(current.length);
  if (staleSuffix.length === 0) {
    return undefined;
  }

  let targetIndex = current.length;
  let staleIndex = 0;
  while (staleIndex < staleSuffix.length && target[targetIndex] === staleSuffix[staleIndex]) {
    targetIndex += 1;
    staleIndex += 1;
  }

  if (staleIndex >= staleSuffix.length) {
    return undefined;
  }

  let layoutEnd = targetIndex;
  let sawLayout = false;
  while (target[layoutEnd] === '\n') {
    layoutEnd += 1;
    sawLayout = true;
  }
  while (target[layoutEnd] === ' ' || target[layoutEnd] === '\t') {
    layoutEnd += 1;
    sawLayout = true;
  }

  if (!sawLayout || target[layoutEnd] !== staleSuffix[staleIndex]) {
    return undefined;
  }

  if (isAutoClosedPairText(insertedText) && staleSuffix.slice(staleIndex) === insertedText.slice(-1)) {
    return undefined;
  }

  const recovered = current + target.slice(current.length, layoutEnd) + staleSuffix.slice(staleIndex);
  return analyzePrefix(target, recovered).ok ? recovered : undefined;
}

function recoverStaleInputBeforePendingAutomaticInsertion(
  targetCode: string,
  current: string,
  beforePendingInsertion: string,
  staleSuffix: string,
  insertedText: string,
  pendingAutomaticInsertionStart: number
): string | undefined {
  if (insertedText.length === 0) {
    return undefined;
  }

  const insertedAt = staleSuffix.lastIndexOf(insertedText);
  if (insertedAt <= 0 || insertedAt + insertedText.length !== staleSuffix.length) {
    return undefined;
  }

  const staleBeforeInput = staleSuffix.slice(0, insertedAt);
  const staleBeforeInputMatch = analyzePrefix(targetCode, beforePendingInsertion + staleBeforeInput);
  if (
    !staleBeforeInputMatch.ok
    || staleBeforeInputMatch.nextIndex > pendingAutomaticInsertionStart
    || staleBeforeInputMatch.skippedClosers === 0
  ) {
    return undefined;
  }

  const recovered = current + insertedText;
  return analyzePrefix(targetCode, recovered).ok ? recovered : undefined;
}

function isHorizontalWhitespace(value: string | undefined): boolean {
  return value === ' ' || value === '\t';
}

function isOnlyHorizontalWhitespace(value: string): boolean {
  return /^[ \t]*$/.test(value);
}
