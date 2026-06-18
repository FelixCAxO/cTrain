import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'mocha';
import { builtInLessons } from '../src/lessons/builtInLessons';
import { validateLesson } from '../src/lessons/validator';
import type { Lesson } from '../src/lessons/schema';

const root = path.resolve(__dirname, '..');
const publicLessonRoot = path.join(root, 'lessons');
const prog2Root = path.join(root, 'prog2-lessons');

const expectedProg2ReferenceIds = [
  'prog2-b1-reference-arrays-loops-435',
  'prog2-b1-reference-class-object-constructor-421',
  'prog2-b1-reference-composition-design-427',
  'prog2-b1-reference-equals-hashcode-compareto-428',
  'prog2-b1-reference-exceptions-433',
  'prog2-b1-reference-inheritance-polymorphism-425',
  'prog2-b1-reference-interfaces-contracts-426',
  'prog2-b1-reference-methods-parameters-424',
  'prog2-b1-reference-records-enums-439',
  'prog2-b1-reference-references-values-null-423',
  'prog2-b1-reference-string-text-434',
  'prog2-b1-reference-visibility-final-static-422',
  'prog2-b2-reference-collections-concepts-429',
  'prog2-b2-reference-generics-432',
  'prog2-b2-reference-io-path-files-436',
  'prog2-b2-reference-lambdas-functional-interfaces-437',
  'prog2-b2-reference-map-api-430',
  'prog2-b2-reference-sorting-searching-431',
  'prog2-b2-reference-streams-438',
  'prog2-ref-p2-collection-interface-701',
  'prog2-ref-p2-collections-arrays-706',
  'prog2-ref-p2-collectors-recipes-709',
  'prog2-ref-p2-comparator-order-707',
  'prog2-ref-p2-javafx-controls-714',
  'prog2-ref-p2-javafx-dialog-files-css-717',
  'prog2-ref-p2-javafx-events-properties-715',
  'prog2-ref-p2-javafx-layout-data-711',
  'prog2-ref-p2-javafx-layout-pane-713',
  'prog2-ref-p2-javafx-lists-tables-716',
  'prog2-ref-p2-javafx-program-structure-712',
  'prog2-ref-p2-javafx-structure-710',
  'prog2-ref-p2-list-api-702',
  'prog2-ref-p2-map-overview-704',
  'prog2-ref-p2-queue-deque-priorityqueue-705',
  'prog2-ref-p2-set-uniqueness-703',
  'prog2-ref-p2-streams-api-708'
] as const;

const bannedProg2Terms = [
  /Liang/i,
  /Z-Library/i,
  /03_Literature/i,
  /04_Exams/i,
  /06_Exercises/i,
  /\bUppgift\b/i,
  /\bMario\b/i,
  /\bassets?\b/i,
  /Prog2 exam tasks/i
] as const;

describe('Java-only curriculum cleanup', () => {
  it('ships only Java public built-in lesson assets', () => {
    const trackDirectories = fs.readdirSync(publicLessonRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => entry.name)
      .sort();

    assert.deepEqual(trackDirectories, ['java']);
    assert.equal(builtInLessons.length, 89);
    assert.deepEqual([...new Set(builtInLessons.map((lesson) => lesson.language))], ['java']);
    assert.deepEqual(
      builtInLessons.map((lesson) => lesson.id).sort(),
      listLessonFiles(path.join(publicLessonRoot, 'java')).map((file) => path.basename(file, '.json')).sort()
    );
  });

  it('keeps authoring validation Java-only while still allowing Prog2 Java ids', () => {
    assert.equal(validateLesson(makeLesson({ language: 'java', id: 'java-valid-01', tags: ['java'] })).ok, true);
    assert.equal(validateLesson(makeLesson({ language: 'java', id: 'prog2-ref-p2-list-api-702', tags: ['java', 'prog2', 'source-file'] })).ok, true);

    for (const language of ['cpp', 'typescript', 'python']) {
      const result = validateLesson(makeLesson({
        language,
        id: `${language}-lesson-01`,
        tags: [language]
      }));

      assert.equal(result.ok, false, `${language} should no longer be valid authored curriculum`);
      assert.deepEqual(result.errors.map((error) => error.path), ['language', 'tags[0]']);
    }
  });

  it('keeps only the 36 self-contained Prog2 reference lessons', () => {
    const files = listLessonFiles(prog2Root);
    const ids = files.map((file) => path.basename(file, '.json'));
    const lessons = files.map((file) => parseJson<Lesson>(fs.readFileSync(file, 'utf8')));
    const lessonIds = new Set(ids);

    assert.deepEqual(ids, [...expectedProg2ReferenceIds].sort());

    for (const lesson of lessons) {
      assert.equal(lesson.language, 'java', lesson.id);
      assert.ok(lesson.tags.includes('prog2'), `${lesson.id} should keep the prog2 tag`);
      assert.ok(lesson.tags.includes('source-file'), `${lesson.id} should remain a source-file reference`);
      assert.equal(validateLesson(lesson).ok, true, lesson.id);

      for (const prerequisite of lesson.prerequisites) {
        assert.ok(lessonIds.has(prerequisite), `${lesson.id} should not depend on removed lesson ${prerequisite}`);
      }

      const searchable = [
        lesson.id,
        lesson.title,
        lesson.description,
        ...(lesson.learningGoals ?? []),
        lesson.targetCode
      ].join('\n');

      for (const banned of bannedProg2Terms) {
        assert.doesNotMatch(searchable, banned, `${lesson.id} should not contain ${banned}`);
      }
    }
  });

  it('uses a reference-only Prog2 coverage guard for the source tree', () => {
    const scriptPath = path.join(root, 'scripts', 'assert-prog2-coverage.cjs');
    const sourceResult = runNode(scriptPath, prog2Root);

    assert.equal(sourceResult.status, 0, sourceResult.stderr);
    assert.match(sourceResult.stdout, /36 Prog2 reference lessons/);
  });

  it('keeps docs and packaging policy synced to the Java reference-only corpus', () => {
    const lessonsDoc = fs.readFileSync(path.join(root, 'docs', 'lessons.md'), 'utf8');
    const architectureDoc = fs.readFileSync(path.join(root, 'docs', 'architecture.md'), 'utf8');
    const testingDoc = fs.readFileSync(path.join(root, 'docs', 'testing.md'), 'utf8');
    const expansionDoc = fs.readFileSync(path.join(root, 'docs', 'prog2-exercise-expansion.md'), 'utf8');

    assert.equal(fs.existsSync(path.join(root, 'docs', 'prog2-liang-exercise-manifest.json')), false);
    assert.equal(fs.existsSync(path.join(root, 'build-ctrain-prog2.bat')), false);
    assert.match(lessonsDoc, /89 Java lessons/);
    assert.match(lessonsDoc, /36 Prog2 reference lessons/);
    assert.match(architectureDoc, /Java public lessons plus 36 Prog2 reference lessons/);
    assert.match(testingDoc, /reference-only/);
    assert.match(testingDoc, /36 retained Prog2 reference lessons/);
    assert.doesNotMatch(testingDoc, /30 public Java lessons/);
    assert.doesNotMatch(testingDoc, /66 total Java lessons/);
    assert.doesNotMatch(testingDoc, /build-ctrain-prog2/);
    assert.match(expansionDoc, /reference-only/i);

    for (const doc of [lessonsDoc, architectureDoc, testingDoc, expansionDoc]) {
      for (const banned of [/lessons\/cpp\//, /TypeScript seed lessons/, /Python seed lessons/, /Liang/i, /Z-Library/i, /04_Exams/i]) {
        assert.doesNotMatch(doc, banned);
      }
    }
  });

  it('stores lesson JSON files as UTF-8 without BOM so JSON.parse works everywhere', () => {
    for (const file of [
      ...listLessonFiles(publicLessonRoot),
      ...listLessonFiles(prog2Root)
    ]) {
      const bytes = fs.readFileSync(file);
      assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${file} should not start with a UTF-8 BOM`);
    }
  });
});

function makeLesson(overrides: Partial<Lesson>): Lesson {
  return {
    schemaVersion: 1,
    id: 'java-valid-01',
    version: 1,
    title: 'Valid Java',
    description: 'A valid lesson fixture.',
    language: 'java',
    difficulty: 2,
    estimatedSeconds: 35,
    tags: ['java'],
    prerequisites: [],
    learningGoals: ['Practice a valid Java lesson.'],
    languageVersion: 'Java 8',
    targetCode: 'int count = 1;\ncount += 1;\nSystem.out.println(count);',
    ...overrides
  };
}

function listLessonFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('_')) {
        files.push(...listLessonFiles(fullPath));
      }
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function runNode(scriptPath: string, lessonRoot: string): { status: number | null; stdout: string; stderr: string } {
  return spawnSync(process.execPath, [scriptPath, lessonRoot], {
    cwd: root,
    encoding: 'utf8'
  });
}

function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}
