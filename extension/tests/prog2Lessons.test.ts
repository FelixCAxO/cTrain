import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';
import { validateLesson } from '../src/lessons/validator';
import type { Lesson } from '../src/lessons/schema';

const root = path.resolve(__dirname, '..');
const prog2Root = path.join(root, 'prog2-lessons');
const referenceIdPattern = /^prog2-(?:b[12]-reference-|ref-p2-)/;

describe('Prog2 reference lesson corpus', () => {
  it('keeps the Prog2 corpus reference-only and Java-only', () => {
    const lessons = readProg2Lessons();

    assert.equal(lessons.length, 36);
    for (const lesson of lessons) {
      assert.match(lesson.id, referenceIdPattern);
      assert.equal(lesson.language, 'java', lesson.id);
      assert.ok(lesson.tags.includes('java'), `${lesson.id} should carry the java tag`);
      assert.ok(lesson.tags.includes('prog2'), `${lesson.id} should carry the prog2 tag`);
      assert.ok(lesson.tags.includes('source-file'), `${lesson.id} should remain full-source reference material`);
      assert.equal(validateLesson(lesson).ok, true, lesson.id);
    }
  });

  it('keeps every reference prerequisite inside the retained reference set', () => {
    const lessons = readProg2Lessons();
    const ids = new Set(lessons.map((lesson) => lesson.id));

    for (const lesson of lessons) {
      for (const prerequisite of lesson.prerequisites) {
        assert.ok(ids.has(prerequisite), `${lesson.id} depends on removed prerequisite ${prerequisite}`);
      }
    }
  });

  it('keeps reference descriptions learner-facing and free of removed provenance terms', () => {
    const bannedPatterns = [
      /Liang/i,
      /Z-Library/i,
      /03_Literature/i,
      /04_Exams/i,
      /06_Exercises/i,
      /\bUppgift\b/i,
      /Prog2 exam tasks/i,
      /\bbook-exercise\b/i,
      /\bexam-practice\b/i,
      /\bexam-reference\b/i,
      /\bexam-style-practice\b/i
    ];

    for (const lesson of readProg2Lessons()) {
      assert.match(lesson.description, /^Use this Java reference to review .+ through compact practice examples\.$/, lesson.id);
      const searchable = [
        lesson.id,
        lesson.title,
        lesson.description,
        ...(lesson.learningGoals ?? []),
        lesson.targetCode
      ].join('\n');

      for (const bannedPattern of bannedPatterns) {
        assert.doesNotMatch(searchable, bannedPattern, `${lesson.id} should not contain ${bannedPattern}`);
      }
    }
  });

  it('keeps Prog2 reference lessons concise and sparse enough for review practice', () => {
    const offenders: string[] = [];

    for (const lesson of readProg2Lessons()) {
      const header = lesson.targetCode.split('\n').find((line) => line.startsWith('// You will learn:'));
      assert.ok(header, `${lesson.id} should include a learning header`);
      if (header!.length > 110) {
        offenders.push(`${lesson.id}: learning header is ${header!.length} characters`);
      }

      const sourceLines = stripGeneratedHeader(lesson.targetCode).split('\n');
      const codeLines = sourceLines.filter((line) => line.trim().length > 0 && !line.trim().startsWith('//'));
      const trailingCommentLines = codeLines.filter((line) => {
        const commentStart = findLineCommentStart(line);
        return commentStart !== undefined && commentStart > 0;
      });
      const closingCommentLines = sourceLines.filter((line) => /}\s*\/\/\s*end\b/i.test(line));
      const importCommentLines = sourceLines.filter((line) => /^\s*import\b.+\/\/\s*/.test(line));

      if (trailingCommentLines.length > Math.ceil(codeLines.length * 0.55)) {
        offenders.push(`${lesson.id}: ${trailingCommentLines.length}/${codeLines.length} code lines have trailing comments`);
      }

      if (closingCommentLines.length > 0) {
        offenders.push(`${lesson.id}: closing braces should not carry end comments`);
      }

      if (importCommentLines.length > 0) {
        offenders.push(`${lesson.id}: imports should stay uncommented unless they teach a trap`);
      }
    }

    assert.deepEqual(offenders.slice(0, 30), []);
  });

  it('documents the Prog2 reference package policy', () => {
    const lessonsDoc = fs.readFileSync(path.join(root, 'docs', 'lessons.md'), 'utf8');

    assert.match(lessonsDoc, /Prog2 reference lessons/);
    assert.match(lessonsDoc, /36 Prog2 reference lessons/);
    assert.match(lessonsDoc, /reference-only/);
  });
});

function readProg2Lessons(): Lesson[] {
  return fs.readdirSync(prog2Root)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => JSON.parse(fs.readFileSync(path.join(prog2Root, file), 'utf8')) as Lesson);
}

function stripGeneratedHeader(targetCode: string): string {
  const lines = targetCode.split('\n');
  let firstSourceLine = 0;

  while (firstSourceLine < lines.length && /^\/\/ (?:LESSON:|You will learn:|Watch for:)/.test(lines[firstSourceLine]!)) {
    firstSourceLine += 1;
  }

  return lines.slice(firstSourceLine).join('\n');
}

function findLineCommentStart(line: string): number | undefined {
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (let index = 0; index < line.length - 1; index += 1) {
    const char = line[index]!;
    const next = line[index + 1]!;

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

    if (char === '/' && next === '/') {
      return index;
    }
  }

  return undefined;
}
