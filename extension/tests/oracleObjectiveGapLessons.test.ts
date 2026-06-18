import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';
import { getExamObjectiveForLesson } from '../src/commands/examBlueprint';
import { builtInLessons } from '../src/lessons/builtInLessons';
import { validateLesson } from '../src/lessons/validator';
import type { Lesson, LessonCompletionCheck } from '../src/lessons/schema';

const root = path.resolve(__dirname, '..');

interface GapLessonSpec {
  id: string;
  titlePattern: RegExp;
  requiredTags: string[];
  targetTokens: string[];
  learningGoalPattern: RegExp;
}

const dedicatedGapLessons: GapLessonSpec[] = [
  {
    id: 'java-nested-classes-84',
    titlePattern: /nested classes/i,
    requiredTags: ['java', 'classes'],
    targetTokens: ['static class', 'class ItemView', 'class AuditTask', 'new AuditTask()'],
    learningGoalPattern: /static nested|inner|local/i
  },
  {
    id: 'java-initializer-blocks-85',
    titlePattern: /initializer blocks/i,
    requiredTags: ['java', 'classes', 'constructors', 'static'],
    targetTokens: ['static {', 'id = nextId++;', 'Account(String owner)'],
    learningGoalPattern: /static initializer|instance initializer/i
  },
  {
    id: 'java-module-services-86',
    titlePattern: /module services/i,
    requiredTags: ['java', 'modules'],
    targetTokens: ['uses com.example.spi.Reporter;', 'provides com.example.spi.Reporter', 'with com.example.impl.JsonReporter;'],
    learningGoalPattern: /uses|provides/i
  },
  {
    id: 'java-stringbuilder-mutation-87',
    titlePattern: /stringbuilder/i,
    requiredTags: ['java', 'strings'],
    targetTokens: ['new StringBuilder', '.append(', '.insert(', '.reverse(', '.delete('],
    learningGoalPattern: /append|insert|reverse|delete/i
  },
  {
    id: 'java-gc-eligibility-88',
    titlePattern: /garbage collection/i,
    requiredTags: ['java', 'references'],
    targetTokens: ['first = null;', 'second = new Object();', 'cache[0] = null;'],
    learningGoalPattern: /garbage collection|eligible/i
  },
  {
    id: 'java-primitive-streams-89',
    titlePattern: /primitive streams/i,
    requiredTags: ['java', 'streams'],
    targetTokens: ['IntStream', '.mapToInt(', '.summaryStatistics()', '.boxed()'],
    learningGoalPattern: /IntStream|mapToInt|summaryStatistics|boxed/i
  },
  {
    id: 'java-concurrent-hashmap-90',
    titlePattern: /concurrenthashmap|concurrent collections/i,
    requiredTags: ['java', 'collections', 'concurrency'],
    targetTokens: ['ConcurrentHashMap', '.merge(', '.computeIfAbsent('],
    learningGoalPattern: /ConcurrentHashMap|concurrent collection/i
  },
  {
    id: 'java-console-input-91',
    titlePattern: /console input/i,
    requiredTags: ['java', 'io'],
    targetTokens: ['Scanner', 'System.console()', 'readLine('],
    learningGoalPattern: /Scanner|System\.console|readLine/i
  },
  {
    id: 'java-packaging-artifacts-92',
    titlePattern: /packaging artifacts/i,
    requiredTags: ['java', 'modules', 'jars', 'jlink', 'unnamed-modules', 'automatic-modules'],
    targetTokens: ['jar --create', 'jlink', 'Automatic-Module-Name'],
    learningGoalPattern: /JAR|jlink|automatic module/i
  },
  {
    id: 'java-stream-partitioning-93',
    titlePattern: /stream partitioning/i,
    requiredTags: ['java', 'streams', 'collectors', 'partitioning'],
    targetTokens: ['Collectors.partitioningBy', 'Map<Boolean, List<Task>>', 'Map<Boolean, Long>'],
    learningGoalPattern: /partitioningBy|Boolean/i
  }
];

describe('Oracle 1Z0-831 gap closure lessons', () => {
  const lessonsById = new Map(builtInLessons.map((lesson) => [lesson.id, lesson]));

  it('ships dedicated non-preview lessons for every verified missing or thin objective', () => {
    for (const spec of dedicatedGapLessons) {
      const lesson = findLesson(lessonsById, spec.id);
      assert.equal(validateLesson(lesson).ok, true, `${spec.id} should validate`);
      assert.equal(lesson!.language, 'java', `${spec.id} should be Java`);
      assert.notEqual(lesson!.languageVersion, 'Java 26', `${spec.id} should be in-scope for 1Z0-831`);
      assert.equal(lesson!.tags.includes('preview'), false, `${spec.id} must not be preview-only`);
      assert.match(lesson!.title, spec.titlePattern, `${spec.id} title should name the gap`);

      for (const tag of spec.requiredTags) {
        assert.ok(lesson!.tags.includes(tag), `${spec.id} should be tagged ${tag}`);
      }

      const learningGoals = (lesson!.learningGoals ?? []).join('\n');
      assert.match(learningGoals, spec.learningGoalPattern, `${spec.id} should state the exam concept in learning goals`);

      for (const token of spec.targetTokens) {
        assert.ok(lesson!.targetCode.includes(token), `${spec.id} targetCode should contain ${token}`);
      }
    }
  });

  it('backs each gap lesson with at least two completion checks and one code-trace check', () => {
    for (const spec of dedicatedGapLessons) {
      const lesson = findLesson(lessonsById, spec.id);
      const checks = lesson.completionChecks ?? [];

      assert.ok(checks.length >= 2, `${spec.id} should have at least two completion checks`);
      assert.ok(checks.some(isCodeTraceCheck), `${spec.id} should include at least one code-trace check`);
      for (const [index, check] of checks.entries()) {
        assert.ok(check.choices.length >= 4, `${spec.id} check ${index + 1} should offer at least four choices`);
        assert.ok(
          check.answerIndex >= 0 && check.answerIndex < check.choices.length,
          `${spec.id} check ${index + 1} should use a valid answerIndex`
        );
        assert.ok(check.explanation.length >= 30, `${spec.id} check ${index + 1} should explain the exam trap`);
      }
    }
  });

  it('routes garbage-collection lifecycle checks to the OOP exam objective', () => {
    assert.equal(getExamObjectiveForLesson(findLesson(lessonsById, 'java-gc-eligibility-88'))?.id, 'oop');
  });

  it('keeps constructor-prologue checks aligned with Java 25 flexible constructor bodies', () => {
    const staleChecks: string[] = [];

    for (const lesson of builtInLessons) {
      for (const [index, check] of (lesson.completionChecks ?? []).entries()) {
        const searchable = [
          check.prompt,
          ...check.choices,
          check.explanation
        ].join('\n');

        if (
          /int x = 1;.*before super/i.test(searchable)
          || /superclass constructor call must be the first constructor statement/i.test(searchable)
          || /constructor invocation to appear first, before ordinary statements/i.test(searchable)
        ) {
          staleChecks.push(`${lesson.id} check ${index + 1}`);
        }
      }
    }

    assert.deepEqual(staleChecks, []);
  });

  it('documents 7.2 packaging details while keeping the objective mapped to roadmap rows', () => {
    const docPath = path.join(root, 'docs', 'oracle-1z0-831-objective-map.md');
    assert.equal(fs.existsSync(docPath), true, 'objective mapping documentation should exist');
    const document = fs.readFileSync(docPath, 'utf8');

    assert.match(document, /7\.2/);
    assert.match(document, /jars?/i);
    assert.match(document, /jlink/i);
    assert.match(document, /automatic module/i);
    assert.match(document, /`Modules`/);
    assert.match(document, /`Methods`/);
    assert.doesNotMatch(document, /out of scope|N\/A|not directly teachable/i);
  });
});

function findLesson(lessonsById: ReadonlyMap<string, Lesson>, id: string): Lesson {
  const lesson = lessonsById.get(id);
  if (lesson === undefined) {
    assert.fail(`${id} should be a built-in lesson`);
  }
  return lesson;
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
