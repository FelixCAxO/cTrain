import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { builtInLessons } from '../src/lessons/builtInLessons';
import { validateLesson } from '../src/lessons/validator';
import type { Lesson, LessonCompletionCheck } from '../src/lessons/schema';

describe('Java certification exam-readiness content', () => {
  const lessonsById = new Map(builtInLessons.map((lesson) => [lesson.id, lesson]));

  it('teaches record fundamentals before record patterns deconstruct records', () => {
    const recordsLesson = findLesson('java-records-45');
    const recordPatternsLesson = findLesson('java-record-patterns-57');

    assert.equal(validateLesson(recordsLesson).ok, true);
    assert.equal(recordsLesson.languageVersion, 'Java 16');
    assert.equal(recordsLesson.difficulty, 3);

    for (const tag of ['java', 'records', 'classes', 'object-contracts']) {
      assert.ok(recordsLesson.tags.includes(tag), `java-records-45 should be tagged ${tag}`);
    }

    assert.deepEqual(recordsLesson.prerequisites, ['java-equals-hashcode-37']);
    assert.ok(recordPatternsLesson.prerequisites.includes('java-records-45'));
    assert.match(recordsLesson.targetCode, /record\s+\w+\(/);
    assert.match(recordsLesson.targetCode, /public\s+\w+\s*\{/);
    assert.match(recordsLesson.targetCode, /implements\s+\w+/);
    assert.match(recordsLesson.targetCode, /import java\.util\.Locale;/);
    assert.match(recordsLesson.targetCode, /toLowerCase\(Locale\.ROOT\)/);
    assert.match((recordsLesson.learningGoals ?? []).join('\n'), /compact constructor/i);
    assert.match((recordsLesson.learningGoals ?? []).join('\n'), /accessor|equals|hashCode|toString/i);
  });

  it('does not introduce record syntax before the records lesson teaches it', () => {
    const lessonIds = builtInLessons.map((lesson) => lesson.id);
    const recordsIndex = lessonIds.indexOf('java-records-45');

    assert.notEqual(recordsIndex, -1, 'java-records-45 should be in the built-in lesson order');

    const earlyRecordUsers = builtInLessons
      .slice(0, recordsIndex)
      .filter((lesson) => /\brecord\s+\w+\s*\(/.test(lesson.targetCode))
      .map((lesson) => lesson.id);

    assert.deepEqual(earlyRecordUsers, []);
  });

  it('uses code-analysis completion checks for the reviewed certification content', () => {
    for (const spec of codeAnalysisChecks) {
      const lesson = findLesson(spec.lessonId);
      const checks = lesson.completionChecks ?? [];

      for (const expectedPrompt of spec.promptPatterns) {
        const check = checks.find((candidate) => expectedPrompt.test(candidate.prompt));

        assert.notEqual(check, undefined, `${spec.lessonId} should include prompt ${expectedPrompt}`);
        assert.ok(check!.choices.length >= 4, `${spec.lessonId} ${check!.prompt} should have at least four choices`);
        assert.ok(
          isCodeAnalysisCheck(check!),
          `${spec.lessonId} ${check!.prompt} should ask about code behavior, compile behavior, or runtime behavior`
        );
      }
    }
  });

  it('uses at least one code-analysis completion check in every non-preview cert-band lesson', () => {
    const missing = builtInLessons
      .filter((lesson) => {
        const suffix = Number(lesson.id.match(/-(\d+)$/)?.[1]);
        return suffix >= 50
          && suffix <= 91
          && !lesson.tags.includes('preview')
          && lesson.languageVersion !== 'Java 26'
          && !lesson.tags.includes('http-client');
      })
      .filter((lesson) => !(lesson.completionChecks ?? []).some(isCodeAnalysisCheck))
      .map((lesson) => lesson.id)
      .sort();

    assert.deepEqual(missing, [], `these cert-band lessons need code-analysis checks: ${missing.join(', ')}`);
  });

  function findLesson(id: string): Lesson {
    const lesson = lessonsById.get(id);
    assert.notEqual(lesson, undefined, `${id} should be built in`);
    return lesson!;
  }
});

const codeAnalysisChecks = [
  {
    lessonId: 'java-records-45',
    promptPatterns: [
      /What does badge\.email\(\) return\?/,
      /Which Badge declaration fails to compile\?/
    ]
  },
  {
    lessonId: 'java-stream-collect-16',
    promptPatterns: [
      /What does emails contain after this stream pipeline runs\?/
    ]
  },
  {
    lessonId: 'java-sealed-types-55',
    promptPatterns: [
      /Which Shape subtype declaration fails to compile\?/
    ]
  },
  {
    lessonId: 'java-record-patterns-57',
    promptPatterns: [
      /What does isOrigin\(new Point\(0, 0\)\) return\?/,
      /What does isOrigin\(null\) return\?/
    ]
  },
  {
    lessonId: 'java-switch-expression-58',
    promptPatterns: [
      /What does seasonDays\("autumn"\) return\?/
    ]
  }
] as const;

function isCodeAnalysisCheck(check: LessonCompletionCheck): boolean {
  const searchable = [check.prompt, ...check.choices].join('\n');

  return (
    /\bWhat does\b/.test(check.prompt)
    || /\bWhat happens\b/.test(check.prompt)
    || /\bfails to compile\b/i.test(searchable)
    || /\bexception\b/i.test(searchable)
  );
}
