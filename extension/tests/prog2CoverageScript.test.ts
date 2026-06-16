import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'mocha';
import type { Lesson } from '../src/lessons/schema';

const root = path.resolve(__dirname, '..');
const scriptPath = path.join(root, 'scripts', 'assert-prog2-coverage.cjs');
const prog2Root = path.join(root, 'prog2-lessons');

describe('Prog2 reference coverage assertion script', () => {
  it('passes the checked-in reference-only Prog2 source corpus', () => {
    const result = runCoverage(prog2Root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /36 Prog2 reference lessons/);
  });

  it('fails when a non-reference Prog2 lesson is present', () => {
    const lessonRoot = makeTempLessonRoot();
    copyJsonFiles(prog2Root, lessonRoot);
    writeLesson(lessonRoot, {
      ...makeReferenceLesson('prog2-book-b1-liang-9-1-001'),
      tags: ['java', 'prog2', 'b1', 'book-exercise', 'source-file']
    });

    const result = runCoverage(lessonRoot);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /expected exactly 36 Prog2 reference lessons, got 37/i);
    assert.match(result.stderr, /unexpected Prog2 lesson in reference-only package: prog2-book-b1-liang-9-1-001/i);
    assert.match(result.stderr, /removed corpus tag book-exercise/i);
  });

  it('fails when a kept reference points to a removed prerequisite', () => {
    const lessonRoot = makeTempLessonRoot();
    copyJsonFiles(prog2Root, lessonRoot);
    const lessonPath = path.join(lessonRoot, 'prog2-b1-reference-class-object-constructor-421.json');
    const lesson = parseJson<Lesson>(fs.readFileSync(lessonPath, 'utf8'));
    fs.writeFileSync(lessonPath, JSON.stringify({
      ...lesson,
      prerequisites: ['prog2-exam-style-subscription-tier-420']
    }, null, 2));

    const result = runCoverage(lessonRoot);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing prerequisite prog2-exam-style-subscription-tier-420/i);
    assert.match(result.stderr, /depends on non-reference prerequisite prog2-exam-style-subscription-tier-420/i);
  });

  it('fails when retained references include removed source or provenance terms', () => {
    const lessonRoot = makeTempLessonRoot();
    copyJsonFiles(prog2Root, lessonRoot);
    const lessonPath = path.join(lessonRoot, 'prog2-ref-p2-list-api-702.json');
    const lesson = parseJson<Lesson>(fs.readFileSync(lessonPath, 'utf8'));
    fs.writeFileSync(lessonPath, JSON.stringify({
      ...lesson,
      description: `${lesson.description} Source: 04_Exams/Exam_2025-06-07.pdf Uppgift 2.`
    }, null, 2));

    const result = runCoverage(lessonRoot);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /removed source\/provenance term/i);
    assert.match(result.stderr, /prog2-ref-p2-list-api-702/);
  });
});

function makeTempLessonRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ctrain-prog2-guard-'));
}

function copyJsonFiles(source: string, destination: string): void {
  fs.mkdirSync(destination, { recursive: true });
  for (const file of fs.readdirSync(source).filter((entry) => entry.endsWith('.json'))) {
    fs.copyFileSync(path.join(source, file), path.join(destination, file));
  }
}

function runCoverage(lessonRoot: string): { status: number | null; stdout: string; stderr: string } {
  return spawnSync(process.execPath, [scriptPath, lessonRoot], {
    cwd: root,
    encoding: 'utf8'
  });
}

function makeReferenceLesson(id: string): Lesson {
  return {
    schemaVersion: 1,
    id,
    version: 1,
    title: 'Unexpected Lesson',
    description: 'Unexpected Prog2 lesson.',
    language: 'java',
    difficulty: 3,
    estimatedSeconds: 120,
    tags: ['java', 'prog2', 'source-file'],
    prerequisites: [],
    learningGoals: ['Practice Java.'],
    languageVersion: 'Java 8',
    targetCode: 'class UnexpectedLesson {\n  int value() { return 1; }\n}'
  };
}

function writeLesson(directory: string, lesson: Lesson): void {
  fs.writeFileSync(path.join(directory, `${lesson.id}.json`), JSON.stringify(lesson, null, 2));
}

function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}
