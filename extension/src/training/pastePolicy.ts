import { isAutoClosedPairText } from './autoClosedPairs';
import { isSingleGrapheme } from './graphemes';

export type ChangeReason = 'undo' | 'redo' | 'typing' | number | undefined;

export interface TextChange {
  text: string;
  rangeLength: number;
  rangeOffset?: number;
  reason?: ChangeReason;
}

export type TextChangeClassification = { kind: 'allowed' } | { kind: 'paste'; insertedLength: number };

export interface TextChangeContext {
  targetRemainder?: string;
  singleCharacterFormattingRewrite?: boolean;
}

export function classifyTextChange(
  changes: TextChange[],
  allowPaste: boolean,
  context: TextChangeContext = {}
): TextChangeClassification {
  if (
    allowPaste
    || context.singleCharacterFormattingRewrite === true
    || changes.every((change) => change.reason === 'undo' || change.reason === 'redo' || change.reason === 1 || change.reason === 2)
  ) {
    return { kind: 'allowed' };
  }

  for (const change of changes) {
    if (isTargetPrefixInsertion(change, context.targetRemainder)) {
      continue;
    }

    if (change.text.length > 1 && !isSingleGrapheme(change.text) && !isEditorGeneratedInsertion(change.text)) {
      return { kind: 'paste', insertedLength: change.text.length };
    }
  }

  return { kind: 'allowed' };
}

function isTargetPrefixInsertion(change: TextChange, targetRemainder: string | undefined): boolean {
  if (change.rangeLength !== 0 || change.text.length <= 1 || targetRemainder === undefined) {
    return false;
  }

  const insertedText = normalizeLineEndings(change.text);
  if (targetRemainder.startsWith(insertedText)) {
    return true;
  }

  const pendingLayout = /^\n+[ \t]*(.+)$/s.exec(insertedText);
  if (pendingLayout === null) {
    return false;
  }

  const pendingInput = pendingLayout[1]!;
  if (isSingleGrapheme(pendingInput)) {
    return targetRemainder.startsWith(pendingInput);
  }

  return isAutoClosedPairText(pendingInput) && targetRemainder.startsWith(pendingInput[0]!);
}

function isEditorGeneratedInsertion(text: string): boolean {
  const normalizedText = normalizeLineEndings(text);
  if (/^\n[ \t]*$/.test(normalizedText)) {
    return true;
  }

  return isAutoClosedPairText(normalizedText);
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}
