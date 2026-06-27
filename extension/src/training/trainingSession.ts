import type { Lesson } from '../lessons/schema';
import type { LessonProgressRecord } from '../progress/progressStore';
import { getGhostTextSegments, type GhostTextSegment, type MatchMistake, normalizeLineEndings, analyzePrefix } from './prefixMatch';
import { classifyTextChange, type TextChange } from './pastePolicy';
import { recoverStaleAutomaticInsertionInput } from './staleLineBreakRecovery';
import { isAutoClosedPairText } from './autoClosedPairs';
import { isSingleGrapheme } from './graphemes';

export { recoverStaleAutoLineBreakInput } from './staleLineBreakRecovery';

export interface TrainingSessionStatus {
  isComplete: boolean;
  typedCharacters: number;
  totalCharacters: number;
  percentComplete: number;
  elapsedMs: number;
  wpm: number;
  mistakeCount: number;
  rejectedPasteCount: number;
  feedback?: string;
}

export interface TrainingSessionOptions {
  clock?: () => number;
}

export interface ApplyDocumentOptions {
  allowPaste?: boolean;
  now?: number;
}

export type ApplyDocumentResult =
  | { accepted: true; shouldRevert: false; reason: 'input' | 'complete' }
  | { accepted: false; shouldRevert: true; reason: 'paste'; insertedLength: number; feedback: string }
  | { accepted: false; shouldRevert: true; reason: 'mistake'; mistake?: MatchMistake; feedback?: string }
  | { accepted: false; shouldRevert: true; reason: 'stale' };

export class TrainingSession {
  private readonly targetCode: string;
  private readonly autoTypedCommentSpans: AutoTypedSpan[];
  private readonly startedAt: number;
  private completedAt?: number;
  private completionRecordConsumed = false;
  private pasteHintShown = false;
  private pendingAutomaticInsertionStart: number | undefined;
  private readonly mistakeHistory: MatchMistake[] = [];

  public documentText = '';
  public readonly mistakes: MatchMistake[] = [];
  public readonly status: TrainingSessionStatus = {
    isComplete: false,
    typedCharacters: 0,
    totalCharacters: 0,
    percentComplete: 0,
    elapsedMs: 0,
    wpm: 0,
    mistakeCount: 0,
    rejectedPasteCount: 0
  };

  public constructor(
    public readonly lesson: Lesson,
    private readonly options: TrainingSessionOptions = {}
  ) {
    this.targetCode = normalizeLineEndings(lesson.targetCode);
    this.autoTypedCommentSpans = findAutoTypedCommentSpans(this.targetCode, lesson.language);
    this.startedAt = this.now();
    this.status.totalCharacters = this.targetCode.length;
    const initial = appendAutomaticTargetText(this.targetCode, '', 0, this.autoTypedCommentSpans);
    this.documentText = initial.documentText;
    this.status.typedCharacters = initial.nextIndex;
    this.pendingAutomaticInsertionStart = initial.automaticInsertionStart;
    this.status.isComplete = initial.nextIndex === this.targetCode.length;
    this.updateTiming(this.startedAt);
  }

  public get ghostTextSegments(): GhostTextSegment[] {
    return getGhostTextSegments(this.targetCode, this.documentText);
  }

  public applyDocumentText(
    nextText: string,
    changes: TextChange[],
    options: ApplyDocumentOptions = {}
  ): ApplyDocumentResult {
    const eventTime = options.now ?? this.now();
    const recoveredText = recoverStaleAutomaticInsertionInput(
      this.targetCode,
      this.documentText,
      nextText,
      changes,
      this.pendingAutomaticInsertionStart
    );
    const match = analyzePrefix(this.targetCode, recoveredText);
    if (match.ok && match.nextIndex < this.status.typedCharacters && !isIntentionalBackwardEdit(changes)) {
      this.updateTiming(eventTime);
      return {
        accepted: false,
        shouldRevert: true,
        reason: 'stale'
      };
    }

    const paste = classifyTextChange(changes, options.allowPaste ?? false, {
      targetRemainder: this.targetCode.slice(this.status.typedCharacters),
      singleCharacterFormattingRewrite: changes.every((change) => isSingleCharacterFormattingRewrite(change, this.documentText))
    });

    if (paste.kind === 'paste') {
      this.status.rejectedPasteCount += 1;
      this.updateTiming(eventTime);
      this.status.feedback = this.pasteHintShown
        ? 'Paste is disabled for cTrain lessons.'
        : 'Paste is disabled to build muscle memory. Type the prompt instead.';
      this.pasteHintShown = true;
      return {
        accepted: false,
        shouldRevert: true,
        reason: 'paste',
        insertedLength: paste.insertedLength,
        feedback: this.status.feedback
      };
    }

    if (!match.ok) {
      this.status.mistakeCount += 1;
      if (match.mistake !== undefined) {
        this.mistakes.push(match.mistake);
        this.mistakeHistory.push(match.mistake);
        this.status.feedback = formatMistakeFeedback(this.targetCode, match.mistake);
      }
      this.updateTiming(eventTime);
      return {
        accepted: false,
        shouldRevert: true,
        reason: 'mistake',
        mistake: match.mistake,
        feedback: this.status.feedback
      };
    }

    const advanced = match.nextIndex > this.status.typedCharacters
      ? appendAutomaticTargetText(this.targetCode, match.normalizedActual, match.nextIndex, this.autoTypedCommentSpans)
      : { documentText: match.normalizedActual, nextIndex: match.nextIndex };

    this.documentText = advanced.documentText;
    this.status.typedCharacters = advanced.nextIndex;
    this.pendingAutomaticInsertionStart = advanced.automaticInsertionStart;
    this.status.isComplete = advanced.nextIndex === this.targetCode.length;
    this.status.feedback = undefined;
    this.mistakes.length = 0;

    if (this.status.isComplete && this.completedAt === undefined) {
      this.completedAt = eventTime;
    }

    this.updateTiming(this.completedAt ?? eventTime);

    return {
      accepted: true,
      shouldRevert: false,
      reason: this.status.isComplete ? 'complete' : 'input'
    };
  }

  public createCompletionRecord(): LessonProgressRecord {
    if (!this.status.isComplete || this.completedAt === undefined) {
      throw new Error('Cannot create completion record before the lesson is complete');
    }

    return {
      lessonId: this.lesson.id,
      lessonVersion: this.lesson.version,
      status: 'completed',
      completedAt: new Date(this.completedAt).toISOString(),
      durationMs: this.completedAt - this.startedAt,
      mistakeCount: this.status.mistakeCount,
      rejectedPasteCount: this.status.rejectedPasteCount,
      typedCharacters: this.status.typedCharacters,
      wpm: this.status.wpm,
      mistakes: [...this.mistakeHistory]
    };
  }

  public consumeCompletionRecord(): LessonProgressRecord | undefined {
    if (!this.status.isComplete || this.completedAt === undefined || this.completionRecordConsumed) {
      return undefined;
    }

    this.completionRecordConsumed = true;
    return this.createCompletionRecord();
  }

  public reset(): TrainingSession {
    return new TrainingSession(this.lesson, this.options);
  }

  public tick(now = this.now()): void {
    this.updateTiming(this.completedAt ?? now);
  }

  private now(): number {
    return this.options.clock?.() ?? Date.now();
  }

  private updateTiming(now: number): void {
    this.status.elapsedMs = Math.max(0, now - this.startedAt);
    this.status.percentComplete = this.targetCode.length === 0
      ? 100
      : Math.floor((this.status.typedCharacters / this.targetCode.length) * 100);
    this.status.wpm = calculateWpm(
      countWpmCharacters(this.status.typedCharacters, this.autoTypedCommentSpans),
      this.status.elapsedMs
    );
  }
}

interface AutoTypedSpan {
  start: number;
  end: number;
}

function isSingleCharacterFormattingRewrite(change: TextChange, currentDocumentText: string): boolean {
  if (change.text.length <= 1) {
    return true;
  }

  if (change.rangeLength === 0 || change.rangeOffset === undefined) {
    return false;
  }

  const insertedText = normalizeLineEndings(change.text);
  const candidateOffsets = [
    change.rangeOffset,
    mapCrlfOffsetToLfOffset(currentDocumentText, change.rangeOffset)
  ].filter((offset, index, offsets): offset is number => offset !== undefined && offsets.indexOf(offset) === index);

  return candidateOffsets.some((offset) => {
    const replacedText = normalizeLineEndings(currentDocumentText.slice(
      offset,
      offset + change.rangeLength
    ));
    const appendedText = insertedText.slice(replacedText.length);

    return /^[ \t]+$/.test(replacedText)
      && insertedText.startsWith(replacedText)
      && (isSingleGrapheme(appendedText) || isAutoClosedPairText(appendedText));
  });
}

function isIntentionalBackwardEdit(changes: TextChange[]): boolean {
  return changes.length > 0 && changes.every((change) => (
    change.text.length === 0 && change.rangeLength > 0
  ) || change.reason === 'undo' || change.reason === 'redo' || change.reason === 1 || change.reason === 2);
}

function mapCrlfOffsetToLfOffset(text: string, crlfOffset: number): number | undefined {
  let expandedOffset = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (expandedOffset === crlfOffset) {
      return index;
    }

    expandedOffset += text[index] === '\n' ? 2 : 1;
  }

  return expandedOffset === crlfOffset ? text.length : undefined;
}

export function calculateWpm(typedCharacters: number, elapsedMs: number): number {
  if (typedCharacters < 10 || elapsedMs < 3_000) {
    return 0;
  }

  return Math.round((typedCharacters / 5) / (elapsedMs / 60_000));
}

export function formatMistakeFeedback(targetCode: string, mistake: MatchMistake): string {
  const line = targetCode.slice(0, mistake.targetIndex).split('\n').length;
  return `expected ${formatExpectedCharacter(mistake.expected)} got ${formatCharacter(mistake.actual)} at line ${line}`;
}

export function formatMistakeHoverMessage(mistake: MatchMistake): string {
  return `Expected ${formatExpectedCharacter(mistake.expected)}, got ${formatCharacter(mistake.actual)}`;
}

function appendAutomaticTargetText(
  targetCode: string,
  documentText: string,
  nextIndex: number,
  autoTypedCommentSpans: AutoTypedSpan[]
): { documentText: string; nextIndex: number; automaticInsertionStart?: number } {
  let updatedText = documentText;
  let updatedIndex = nextIndex;
  let automaticInsertionStart: number | undefined;
  let changed = true;

  const appendAutomaticText = (text: string): void => {
    if (automaticInsertionStart === undefined) {
      automaticInsertionStart = updatedText.length;
    }
    updatedText += text;
  };

  while (changed) {
    changed = false;

    const commentSpan = autoTypedCommentSpans.find((span) => span.start === updatedIndex);
    if (commentSpan !== undefined) {
      appendAutomaticText(targetCode.slice(commentSpan.start, commentSpan.end));
      updatedIndex = commentSpan.end;
      changed = true;
    }

    let appendedLineBreak = false;

    while (targetCode[updatedIndex] === '\n') {
      appendAutomaticText('\n');
      updatedIndex += 1;
      appendedLineBreak = true;
      changed = true;
    }

    if (appendedLineBreak) {
      while (targetCode[updatedIndex] === ' ' || targetCode[updatedIndex] === '\t') {
        appendAutomaticText(targetCode[updatedIndex]!);
        updatedIndex += 1;
        changed = true;
      }
    }
  }

  return {
    documentText: updatedText,
    nextIndex: updatedIndex,
    automaticInsertionStart
  };
}

function findAutoTypedCommentSpans(targetCode: string, language: string): AutoTypedSpan[] {
  const spans: AutoTypedSpan[] = [];
  const lines = targetCode.split('\n');
  let lineOffset = 0;
  const commentPrefix = language === 'python' ? '#' : '//';

  for (const line of lines) {
    const commentStart = findLineCommentStart(line, commentPrefix);
    if (commentStart !== undefined) {
      spans.push({
        start: lineOffset + findAutoTypedLineCommentStart(line, commentStart),
        end: lineOffset + line.length
      });
    }
    lineOffset += line.length + 1;
  }

  return spans;
}

function findLineCommentStart(line: string, commentPrefix: string): number | undefined {
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (let index = 0; index <= line.length - commentPrefix.length; index += 1) {
    const char = line[index]!;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (quote !== undefined) {
      if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (line.startsWith(commentPrefix, index)) {
      return index;
    }
  }

  return undefined;
}

function findAutoTypedLineCommentStart(line: string, commentStart: number): number {
  let start = commentStart;
  while (start > 0 && (line[start - 1] === ' ' || line[start - 1] === '\t')) {
    start -= 1;
  }

  return line.slice(0, start).trim().length === 0 ? commentStart : start;
}

function countWpmCharacters(targetIndex: number, autoTypedCommentSpans: AutoTypedSpan[]): number {
  let autoTypedCharacters = 0;

  for (const span of autoTypedCommentSpans) {
    if (span.start >= targetIndex) {
      break;
    }

    autoTypedCharacters += Math.max(0, Math.min(span.end, targetIndex) - span.start);
  }

  return targetIndex - autoTypedCharacters;
}

function formatCharacter(value: string | undefined): string {
  if (value === undefined) {
    return "'end of lesson'";
  }
  if (value === '\n') {
    return "'\\n'";
  }
  return `'${value}'`;
}

function formatExpectedCharacter(value: string | undefined): string {
  const formatted = formatCharacter(value);
  const hint = value === undefined ? undefined : keyboardHints[value];
  return hint === undefined ? formatted : `${formatted} [${hint}]`;
}

const keyboardHints: Record<string, string> = {
  '!': 'Shift+1',
  '"': 'Shift+\'',
  '#': 'Shift+3',
  '$': 'Shift+4',
  '%': 'Shift+5',
  '&': 'Shift+7',
  '(': 'Shift+9',
  ')': 'Shift+0',
  '*': 'Shift+8',
  '+': 'Shift+=',
  ':': 'Shift+;',
  '<': 'Shift+,',
  '>': 'Shift+.',
  '?': 'Shift+/',
  '@': 'Shift+2',
  '[': '[',
  '\\': '\\',
  ']': ']',
  '^': 'Shift+6',
  '_': 'Shift+-',
  '`': '`',
  '{': 'Shift+[',
  '|': 'Shift+\\',
  '}': 'Shift+]',
  '~': 'Shift+`'
};
