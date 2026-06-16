import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { builtInLessons } from '../src/lessons/builtInLessons';
import { validateLesson } from '../src/lessons/validator';
import type { LessonCompletionCheck } from '../src/lessons/schema';

// The most heavily code-traced Oracle Java SE 25 (1Z0-831) objectives live in the foundational
// track (ids 01-45). The modern Java 25 block (50-69) is already held to a >=2 completion-check
// bar by modernJavaCurriculum.test.ts, but these core fundamentals were shipping a single,
// often definition-style check with only three options. The real exam is overwhelmingly
// "what does this print / does it compile / what is thrown" with four or more options, so each of
// these lessons must offer at least one code-analysis question with exam-shaped distractors.
const coreExamFundamentals = [
  'java-primitives-types-21',
  'java-operators-assignment-24',
  'java-string-methods-23',
  'java-casting-overflow-38',
  'java-generics-method-14',
  'java-optional-orelse-15',
  'java-stream-groupby-17',
  'java-exceptions-try-catch-06',
  'java-collections-list-07',
  'java-map-counter-08',
  'java-set-hashset-36',
  'java-arrays-init-25',
  'java-method-overload-28',
  'java-reference-null-29',
  'java-time-localdate-42',
  'java-inheritance-extends-10',
  'java-abstract-class-11',
  'java-interface-methods-31',
  'java-static-members-26',
  'java-enum-switch-12',
  'java-lambda-functional-13',
  'java-indexed-loop-27',
  'java-try-with-resources-18',
  'java-equals-hashcode-37',
  'java-multicatch-custom-exception-39',
  'java-functional-interfaces-32',
  'java-varargs-33',
  'java-enum-members-35',
  'java-stream-collect-16',
  'java-time-formatting-43',
  'java-var-textblock-19',
  'java-class-basic-01',
  'java-method-return-02',
  'java-loop-array-03',
  'java-interface-04',
  'java-access-modifiers-05',
  'java-constructor-encapsulation-09',
  'java-if-else-22',
  'java-package-import-30',
  'java-thread-runnable-20',
  'java-virtual-threads-40',
  'java-executors-callable-41',
  'java-unnamed-variables-34'
] as const;

// A certification lesson is anything the mock exam can draw from: it excludes Java 26 preview
// material and the HTTP-client side track, mirroring isCertificationLesson in mockExam.ts.
function isCertificationLesson(lesson: { tags: readonly string[]; languageVersion?: string }): boolean {
  return !lesson.tags.includes('preview')
    && lesson.languageVersion !== 'Java 26'
    && !lesson.tags.includes('http-client');
}

describe('foundation exam-readiness checks', () => {
  const lessonsById = new Map(builtInLessons.map((lesson) => [lesson.id, lesson]));

  it('drills core 1Z0-831 fundamentals with exam-shaped code-analysis checks', () => {
    for (const id of coreExamFundamentals) {
      const lesson = lessonsById.get(id);
      assert.notEqual(lesson, undefined, `${id} should be built in`);
      assert.equal(validateLesson(lesson!).ok, true, `${id} should validate`);

      const checks = lesson!.completionChecks ?? [];
      assert.ok(checks.length >= 2, `${id} should offer at least two completion checks`);

      for (const [index, check] of checks.entries()) {
        assert.ok(check.prompt.trim().endsWith('?'), `${id} check ${index + 1} should read as a question`);
        assert.ok(
          check.choices.length >= 4,
          `${id} check ${index + 1} should offer at least four exam-style choices`
        );
        assert.equal(
          new Set(check.choices).size,
          check.choices.length,
          `${id} check ${index + 1} should not repeat a choice`
        );
        assert.ok(
          check.answerIndex >= 0 && check.answerIndex < check.choices.length,
          `${id} check ${index + 1} answer index should point at a real choice`
        );
        assert.ok(
          check.explanation.trim().length >= 20,
          `${id} check ${index + 1} should explain the trap`
        );
      }

      assert.ok(
        checks.some((check) => isCodeAnalysisCheck(check)),
        `${id} should include at least one code-analysis check (what prints / compiles / is thrown)`
      );
    }
  });

  it('gives every certification lesson at least two questions for the mock-exam bank', () => {
    const thin = builtInLessons
      .filter((lesson) => isCertificationLesson(lesson))
      .filter((lesson) => (lesson.completionChecks ?? []).length < 2)
      .map((lesson) => lesson.id);

    assert.deepEqual(thin, [], `these certification lessons still ship fewer than two checks: ${thin.join(', ')}`);
  });
});

function isCodeAnalysisCheck(check: LessonCompletionCheck): boolean {
  const searchable = [check.prompt, ...check.choices].join('\n');

  return (
    /\bWhat does\b/.test(check.prompt)
    || /\bWhat happens\b/.test(check.prompt)
    || /\bfails to compile\b/i.test(searchable)
    || /\bexception\b/i.test(searchable)
  );
}
