export interface GhostDecorationSpec {
  after: {
    color: 'editor.foreground';
    opacity: string;
    fontStyle: 'normal';
  };
  rangeBehavior: 'closedClosed';
}

export interface GhostDecorationPlan {
  line: number;
  character: number;
  contentText: string;
}

export type MistakeStyle = 'squiggle' | 'underline' | 'outline';

export interface MistakeDecorationSpec {
  textDecoration?: string;
  border?: string;
  overviewRulerColor: 'editorError.foreground';
}

export function buildGhostDecorationSpec(opacity: number): GhostDecorationSpec {
  return {
    after: {
      color: 'editor.foreground',
      opacity: clampOpacity(opacity).toString(),
      fontStyle: 'normal'
    },
    rangeBehavior: 'closedClosed'
  };
}

export function buildMistakeDecorationSpec(style: MistakeStyle): MistakeDecorationSpec {
  if (style === 'underline') {
    return {
      textDecoration: 'underline',
      overviewRulerColor: 'editorError.foreground'
    };
  }

  if (style === 'outline') {
    return {
      border: '1px solid',
      overviewRulerColor: 'editorError.foreground'
    };
  }

  return {
    textDecoration: 'underline wavy',
    overviewRulerColor: 'editorError.foreground'
  };
}

export function visibleGhostTextSegments<T extends { line: number }>(segments: T[], documentLineCount: number): T[] {
  void documentLineCount;
  return segments;
}

export function planGhostDecorations(
  segments: GhostDecorationPlan[],
  documentLineCount: number
): GhostDecorationPlan[] {
  const maxLine = Math.max(0, documentLineCount - 1);
  const planned: GhostDecorationPlan[] = [];

  for (const segment of segments) {
    const line = Math.min(segment.line, maxLine);
    const previous = planned[planned.length - 1];

    if (previous !== undefined && segment.line > maxLine && previous.line === maxLine) {
      previous.contentText = `${previous.contentText}\n${segment.contentText}`;
      continue;
    }

    planned.push({
      line,
      character: segment.line > maxLine ? Number.MAX_SAFE_INTEGER : segment.character,
      contentText: segment.contentText
    });
  }

  return planned.map((segment) => ({
    ...segment,
    contentText: truncateGhostText(segment.contentText)
  }));
}

function clampOpacity(opacity: number): number {
  if (!Number.isFinite(opacity)) {
    return 0.4;
  }

  return Math.min(1, Math.max(0.1, opacity));
}

function truncateGhostText(contentText: string): string {
  const lines = contentText.split('\n');
  const maxVisibleLines = 3;
  if (lines.length <= maxVisibleLines) {
    return contentText;
  }

  return [
    ...lines.slice(0, maxVisibleLines),
    `(${lines.length - maxVisibleLines} more)`
  ].join('\n');
}
