import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'mocha';
import * as builtInLessonModule from '../src/lessons/builtInLessons';
import { validateLesson } from '../src/lessons/validator';
import type { Lesson } from '../src/lessons/schema';

interface BuiltInLessonLoadResult {
  lessons: Lesson[];
  errors: { source: string; index: number; message: string }[];
}

const { builtInLessons, resolveBuiltInLessonDirectory } = builtInLessonModule;
const maybeLoadBuiltInLessonFiles = (builtInLessonModule as unknown as {
  loadBuiltInLessonFiles?: (baseDirectory?: string) => BuiltInLessonLoadResult;
}).loadBuiltInLessonFiles;

describe('built-in lesson asset resolution', () => {
  it('prefers the packaged lessons directory over parent or cwd directories', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrain-lessons-'));
    const extensionRoot = path.join(tempRoot, 'extension');
    const distDirectory = path.join(extensionRoot, 'dist');
    const packagedLessons = path.join(extensionRoot, 'lessons');
    const packagedJavaLessons = path.join(packagedLessons, 'java');
    const parentLessons = path.join(tempRoot, 'lessons');

    fs.mkdirSync(distDirectory, { recursive: true });
    fs.mkdirSync(packagedJavaLessons, { recursive: true });
    fs.mkdirSync(parentLessons, { recursive: true });
    fs.writeFileSync(path.join(packagedJavaLessons, 'packaged.json'), '{}');
    fs.writeFileSync(path.join(parentLessons, 'outside.json'), '{}');

    assert.equal(resolveBuiltInLessonDirectory(distDirectory), packagedLessons);
  });

  it('skips source directories that do not contain JSON lesson assets', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrain-source-lessons-'));
    const sourceLessonModuleDirectory = path.join(tempRoot, 'src', 'lessons');
    const repoLessons = path.join(tempRoot, 'lessons');

    fs.mkdirSync(sourceLessonModuleDirectory, { recursive: true });
    fs.mkdirSync(repoLessons, { recursive: true });
    fs.writeFileSync(path.join(sourceLessonModuleDirectory, 'builtInLessons.ts'), '');
    fs.writeFileSync(path.join(repoLessons, 'lesson.json'), '{}');

    assert.equal(resolveBuiltInLessonDirectory(sourceLessonModuleDirectory), repoLessons);
  });

  it('resolves repo lesson assets when e2e tests import compiled modules from out', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrain-out-lessons-'));
    const compiledLessonModuleDirectory = path.join(tempRoot, 'out', 'src', 'lessons');
    const repoLessons = path.join(tempRoot, 'lessons');
    const repoPythonLessons = path.join(repoLessons, 'python');

    fs.mkdirSync(compiledLessonModuleDirectory, { recursive: true });
    fs.mkdirSync(repoPythonLessons, { recursive: true });
    fs.writeFileSync(path.join(repoPythonLessons, 'lesson.json'), '{}');

    assert.equal(resolveBuiltInLessonDirectory(compiledLessonModuleDirectory), repoLessons);
  });

  it('loads valid bundled lessons and reports invalid files without throwing', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrain-invalid-builtins-'));
    const distDirectory = path.join(tempRoot, 'extension', 'dist');
    const lessonDirectory = path.join(tempRoot, 'extension', 'lessons', 'java');
    fs.mkdirSync(distDirectory, { recursive: true });
    fs.mkdirSync(lessonDirectory, { recursive: true });
    fs.writeFileSync(path.join(lessonDirectory, 'java-valid-01.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'java-valid-01',
      version: 1,
      title: 'Valid Java',
      description: 'Practice a valid bundled lesson.',
      language: 'java',
      difficulty: 1,
      estimatedSeconds: 35,
      tags: ['java'],
      prerequisites: [],
      targetCode: 'int count = 1;\ncount += 1;\nSystem.out.println(count);'
    }));
    fs.writeFileSync(path.join(lessonDirectory, 'java-invalid-02.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'bad lesson',
      version: 1,
      title: 'Invalid Java',
      description: 'This lesson has an invalid id.',
      language: 'java',
      difficulty: 1,
      estimatedSeconds: 35,
      tags: ['java'],
      prerequisites: [],
      targetCode: 'int count = 1;\ncount += 1;\nSystem.out.println(count);'
    }));
    fs.writeFileSync(path.join(lessonDirectory, 'java-broken-03.json'), '{not json');

    const result = getLoadBuiltInLessonFiles()(distDirectory);

    assert.deepEqual(result.lessons.map((lesson) => lesson.id), ['java-valid-01']);
    assert.equal(result.errors.length, 2);
    assert.match(result.errors[0].message, /java-broken-03\.json/);
    assert.match(result.errors[0].message, /Invalid JSON/);
    assert.match(result.errors[1].message, /java-invalid-02\.json/);
    assert.match(result.errors[1].message, /id expected/);
  });

  it('returns an error result instead of throwing when no bundled lessons directory exists', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrain-missing-builtins-'));
    const moduleDirectory = path.join(tempRoot, 'extension', 'dist');
    fs.mkdirSync(moduleDirectory, { recursive: true });

    const result = getLoadBuiltInLessonFiles()(moduleDirectory);

    assert.deepEqual(result.lessons, []);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].source, 'built-in');
    assert.match(result.errors[0].message, /Unable to find bundled lessons directory/);
  });

  it('keeps the compatibility export as a plain valid lesson array', () => {
    assert.equal(Array.isArray(builtInLessons), true);
    assert.ok(builtInLessons.length > 0);

    for (const lesson of builtInLessons) {
      assert.equal(validateLesson(lesson).ok, true, lesson.id);
    }
  });
});

function getLoadBuiltInLessonFiles(): (baseDirectory?: string) => BuiltInLessonLoadResult {
  if (typeof maybeLoadBuiltInLessonFiles !== 'function') {
    assert.fail('loadBuiltInLessonFiles should be exported');
  }
  return maybeLoadBuiltInLessonFiles;
}
