import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { builtInLessons } from '../src/lessons/builtInLessons';

describe('lesson teaching comments', () => {
  const snippetLessons = builtInLessons.filter((lesson) => !lesson.tags.includes('source-file'));

  it('opens every public snippet lesson with a concise teaching comment', () => {
    for (const lesson of snippetLessons) {
      const firstLine = lesson.targetCode.split('\n')[0]?.trim() ?? '';

      assert.match(firstLine, new RegExp(`^${escapeRegExp(lineCommentPrefix(lesson.language))}\\s+\\S`), `${lesson.id} should open with a learner-facing comment`);
      assert.ok(firstLine.length <= 96, `${lesson.id} opening comment should stay concise`);
    }
  });

  it('includes a concise line-level concept comment beyond the opening header', () => {
    for (const lesson of snippetLessons) {
      const comments = lesson.targetCode
        .split('\n')
        .map((line) => {
          const start = findLineCommentStart(line, lineCommentPrefix(lesson.language));
          return start === undefined ? undefined : line.slice(start).trim();
        })
        .filter((line): line is string => line !== undefined);
      const conceptComments = comments.filter((line) => !isHeaderComment(line));

      assert.ok(comments.length >= 2, `${lesson.id} should include a concept comment after the opener`);
      assert.ok(conceptComments.length >= 1, `${lesson.id} should include a line-level concept comment`);
      for (const line of comments) {
        assert.ok(line.length <= 120, `${lesson.id} comment is too long: ${line}`);
      }
    }
  });
});

function isHeaderComment(line: string): boolean {
  return /^(?:\/\/|#) Learn:/.test(line) || /^\/\/ Java \d+/.test(line);
}

function lineCommentPrefix(language: string): string {
  return language === 'python' ? '#' : '//';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
