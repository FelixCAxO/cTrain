import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';
import { collectMockExamQuestions } from '../src/commands/mockExam';
import { builtInLessons } from '../src/lessons/builtInLessons';
import type { LessonCompletionCheck } from '../src/lessons/schema';

const root = path.resolve(__dirname, '..');

interface RoadmapRow {
  track: string;
  roadmapNode: string;
  expectedTags: string[];
  minExamReadyLessons: number;
  minCompletionChecksPerLesson: number;
}

describe('lesson roadmap coverage content', () => {
  it('documents roadmap rows for every public built-in lesson', () => {
    const rows = readRoadmapRows();
    const orphanIds = builtInLessons
      .filter((lesson) => !rows.some((row) => (
        lesson.language === row.track
        && row.expectedTags.every((tag) => lesson.tags.includes(tag))
      )))
      .map((lesson) => lesson.id)
      .sort();

    assert.deepEqual(orphanIds, []);
  });

  it('tracks Java roadmap nodes explicitly', () => {
    const rows = readRoadmapRows();

    for (const expected of [
      ['java', 'Class Basics', ['classes']],
      ['java', 'Methods', ['methods']],
      ['java', 'Interfaces', ['interfaces']],
      ['java', 'Streams', ['streams']],
      ['java', 'Static Members', ['static', 'methods']],
      ['java', 'Equals HashCode Comparable', ['object-contracts']],
      ['java', 'Numeric Casting Overflow Math', ['numeric-casting', 'math']],
      ['java', 'Multi Catch Custom Exceptions', ['multicatch']],
      ['java', 'Varargs', ['varargs']],
      ['java', 'Unnamed Variables', ['unnamed-variables']],
      ['java', 'Executor Services', ['executors']]
    ] as const) {
      assert.ok(
        rows.some((row) => (
          row.track === expected[0]
          && row.roadmapNode === expected[1]
          && expected[2].every((tag) => row.expectedTags.includes(tag))
        )),
        `${expected[0]}/${expected[1]} should have a roadmap row`
      );
    }
  });

  it('keeps roadmap coverage scoped to Java public lessons', () => {
    const rows = readRoadmapRows();

    assert.deepEqual([...new Set(rows.map((row) => row.track))], ['java']);
    assert.equal(builtInLessons.every((lesson) => lesson.language === 'java'), true);
  });

  it('requires exam-ready roadmap rows to have non-preview lessons with completion checks', () => {
    const rows = readRoadmapRows();

    for (const row of rows.filter((item) => item.minExamReadyLessons > 0)) {
      const examReadyLessons = builtInLessons.filter((lesson) => (
        lesson.language === row.track
        && !lesson.tags.includes('preview')
        && row.expectedTags.every((tag) => lesson.tags.includes(tag))
        && (lesson.completionChecks ?? []).length >= row.minCompletionChecksPerLesson
      ));

      assert.ok(
        examReadyLessons.length >= row.minExamReadyLessons,
        `${row.track}/${row.roadmapNode} should have ${row.minExamReadyLessons} exam-ready lesson(s)`
      );
    }
  });

  it('requires core exam objective rows to be assessment-ready, not just tag-covered', () => {
    const rows = readRoadmapRows();
    const rowByNode = new Map(rows.map((row) => [row.roadmapNode, row]));

    for (const roadmapNode of ['Generics', 'Optional', 'Streams', 'Strings']) {
      const row = rowByNode.get(roadmapNode);
      assert.notEqual(row, undefined, `${roadmapNode} should have a roadmap row`);
      assert.equal(row!.minExamReadyLessons, 1, `${roadmapNode} should require one exam-ready lesson`);
      assert.equal(row!.minCompletionChecksPerLesson, 2, `${roadmapNode} should require two completion checks`);
    }
  });

  it('requires every in-scope 1Z0-831 roadmap row to be assessment-ready', () => {
    const rows = readRoadmapRows();
    const offSyllabusRows = new Set([
      'Http Client',
      'Structured Concurrency',
      'Lazy Constants',
      'Security'
    ]);

    for (const row of rows.filter((candidate) => !offSyllabusRows.has(candidate.roadmapNode))) {
      assert.equal(row.minExamReadyLessons, 1, `${row.roadmapNode} should require one non-preview cert lesson`);
      assert.equal(row.minCompletionChecksPerLesson, 2, `${row.roadmapNode} should require two completion checks`);
    }
  });

  it('does not count preview-only Java 26 topics as 1Z0-831 exam-ready roadmap rows', () => {
    const rows = readRoadmapRows();
    const rowByNode = new Map(rows.map((row) => [row.roadmapNode, row]));

    for (const previewOnlyNode of ['Structured Concurrency', 'Lazy Constants', 'Security']) {
      const row = rowByNode.get(previewOnlyNode);
      assert.notEqual(row, undefined, `${previewOnlyNode} should remain an explicit preview roadmap row`);
      assert.equal(row!.minExamReadyLessons, 0, `${previewOnlyNode} should not be exam-ready`);
      assert.equal(row!.minCompletionChecksPerLesson, 0, `${previewOnlyNode} should not require exam checks`);
    }
  });

  it('gives every in-scope 1Z0-831 roadmap row at least three pooled questions', () => {
    const rows = readRoadmapRows();
    const questions = collectMockExamQuestions(builtInLessons);
    const lessonById = new Map(builtInLessons.map((lesson) => [lesson.id, lesson]));

    const thinRows = rows
      .filter((row) => row.minExamReadyLessons > 0)
      .map((row) => {
        const rowQuestions = questions.filter((question) => {
          const lesson = lessonById.get(question.lessonId);
          return lesson !== undefined
            && lesson.language === row.track
            && row.expectedTags.every((tag) => lesson.tags.includes(tag));
        });
        return {
          node: row.roadmapNode,
          count: rowQuestions.length,
          traceCount: rowQuestions.filter((question) => isCodeTraceCheck(question.check)).length
        };
      })
      .filter((row) => row.count < 3 || row.traceCount < 1);

    assert.deepEqual(
      thinRows,
      [],
      `roadmap rows below the 3-question or 1-code-trace floor: ${JSON.stringify(thinRows)}`
    );
  });
});

function readRoadmapRows(): RoadmapRow[] {
  const lines = fs.readFileSync(path.join(root, 'docs', 'roadmap-coverage.tsv'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const [header, ...rows] = lines;
  assert.equal(header, 'track\troadmapNode\texpectedTags\tminExamReadyLessons\tminCompletionChecksPerLesson');

  return rows.map((line) => {
    const [track, roadmapNode, expectedTags, minExamReadyLessons, minCompletionChecksPerLesson] = line.split('\t');
    return {
      track: track!,
      roadmapNode: roadmapNode!,
      expectedTags: expectedTags!.split(',').map((tag) => tag.trim()).filter(Boolean),
      minExamReadyLessons: Number(minExamReadyLessons),
      minCompletionChecksPerLesson: Number(minCompletionChecksPerLesson)
    };
  });
}

function isCodeTraceCheck(check: LessonCompletionCheck): boolean {
  const searchable = [check.prompt, ...check.choices].join('\n');

  return (
    /\bWhat does\b/.test(check.prompt)
    || /\bWhat happens\b/.test(check.prompt)
    || /\bwhat prints\b/i.test(searchable)
    || /\bprints?\b/i.test(check.prompt)
    || /\bcompiles?\b/i.test(searchable)
    || /\bfails to compile\b/i.test(searchable)
    || /\bthrows?\b/i.test(searchable)
    || /\bexception\b/i.test(searchable)
  );
}
