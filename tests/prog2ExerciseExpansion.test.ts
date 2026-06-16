import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';
import { compareBuiltInLessons } from '../src/lessons/lessonOrdering';
import { validateLesson } from '../src/lessons/validator';
import type { Lesson } from '../src/lessons/schema';

const root = path.resolve(__dirname, '..');
const prog2Root = path.join(root, 'prog2-lessons');

describe('Prog2 reference package policy', () => {
  it('accepts retained Prog2 reference ids beyond the original two-digit ceiling', () => {
    const lesson = makeProg2ReferenceLesson({
      id: 'prog2-ref-p2-list-api-702',
      title: 'List API - Reference Page 2'
    });

    assert.equal(validateLesson(lesson).ok, true);
  });

  it('sorts expanded Prog2 lesson numbers numerically instead of lexicographically', () => {
    const sorted = [
      makeProg2ReferenceLesson({ id: 'prog2-ref-p2-map-overview-704', title: 'Map Overview - Reference Page 2' }),
      makeProg2ReferenceLesson({ id: 'prog2-ref-p2-list-api-702', title: 'List API - Reference Page 2' })
    ].sort(compareBuiltInLessons);

    assert.deepEqual(sorted.map((lesson) => lesson.id), [
      'prog2-ref-p2-list-api-702',
      'prog2-ref-p2-map-overview-704'
    ]);
  });

  it('ships only authored reference sheets in the Prog2 corpus', () => {
    const files = fs.readdirSync(prog2Root).filter((file) => file.endsWith('.json')).sort();

    assert.equal(files.length, 36);
    assert.deepEqual(
      files.filter((file) => !/^prog2-(?:b[12]-reference-|ref-p2-).+\.json$/.test(file)),
      []
    );
  });

  it('documents reference-only packaging instead of removed book or exam expansion', () => {
    const lessonsDoc = fs.readFileSync(path.join(root, 'docs', 'lessons.md'), 'utf8');
    const expansionDoc = fs.readFileSync(path.join(root, 'docs', 'prog2-exercise-expansion.md'), 'utf8');
    const testingDoc = fs.readFileSync(path.join(root, 'docs', 'testing.md'), 'utf8');

    assert.match(expansionDoc, /reference-only/i);
    assert.match(expansionDoc, /36 Prog2 reference lessons/);
    assert.match(lessonsDoc, /82 Java lessons/);
    assert.match(testingDoc, /reference-only/);

    for (const doc of [lessonsDoc, expansionDoc, testingDoc]) {
      assert.doesNotMatch(doc, /Liang/i);
      assert.doesNotMatch(doc, /03_Literature/i);
      assert.doesNotMatch(doc, /04_Exams/i);
      assert.doesNotMatch(doc, /book-exercise/i);
      assert.doesNotMatch(doc, /exam-style-practice/i);
    }
  });
});

function makeProg2ReferenceLesson(overrides: Partial<Lesson>): Lesson {
  return {
    schemaVersion: 1,
    id: 'prog2-ref-p2-list-api-702',
    version: 1,
    title: 'List API - Reference Page 2',
    description: 'Use this Java reference to review List API through compact practice examples.',
    language: 'java',
    difficulty: 3,
    estimatedSeconds: 180,
    tags: ['java', 'prog2', 'b2', 'source-file', 'collections'],
    prerequisites: [],
    learningGoals: ['Review a Java reference topic.'],
    languageVersion: 'Java 8',
    targetCode: [
      '// LESSON: List API - Reference Page 2.',
      '// You will learn: Review List API choices.',
      'class ListReference {',
      '  int size(java.util.List<String> names) { return names.size(); }',
      '}'
    ].join('\n'),
    ...overrides
  };
}
