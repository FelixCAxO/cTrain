import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';
import { builtInLessons } from '../src/lessons/builtInLessons';
import { getBuiltInLessonCategory } from '../src/lessons/lessonOrdering';

interface PreImplementationMap {
  areas: Array<{
    roadmapNode: string;
    flashcards: {
      questionPatterns: string[];
    };
    programmingExercises: {
      exercisePatterns: string[];
    };
    implementedLessonIds?: string[];
  }>;
}

interface ImplementedExercise {
  roadmapNode: string;
  lessonId: string;
  requiredTags: string[];
  prerequisites: string[];
  targetTokens: string[];
}

const root = path.resolve(__dirname, '..');
const mapPath = path.join(root, 'docs', 'java25-cert-preimplementation-map.json');
const plan = JSON.parse(fs.readFileSync(mapPath, 'utf8')) as PreImplementationMap;

const selectedExercises: ImplementedExercise[] = [
  {
    roadmapNode: 'Generics',
    lessonId: 'java-generics-wildcard-copy-68',
    requiredTags: ['java', 'generics', 'collections'],
    prerequisites: ['java-generics-method-14', 'java-collections-list-07'],
    targetTokens: ['? extends Number', 'List<Number>', 'addAll']
  },
  {
    roadmapNode: 'Optional',
    lessonId: 'java-optional-lazy-fallback-69',
    requiredTags: ['java', 'optional', 'lambdas'],
    prerequisites: ['java-optional-orelse-15', 'java-lambda-functional-13'],
    targetTokens: ['Supplier<String>', 'orElseGet', 'buildGuestName']
  },
  {
    roadmapNode: 'Streams',
    lessonId: 'java-stream-lazy-pipeline-80',
    requiredTags: ['java', 'streams', 'lambdas'],
    prerequisites: ['java-stream-collect-16', 'java-lambda-functional-13'],
    targetTokens: ['.filter(', '.toList()', 'IllegalStateException']
  },
  {
    roadmapNode: 'Numeric Casting Overflow Math',
    lessonId: 'java-checked-numeric-casts-81',
    requiredTags: ['java', 'numeric-casting', 'math', 'primitives'],
    prerequisites: ['java-casting-overflow-38', 'java-primitives-types-21'],
    targetTokens: ['(long) megabytes', 'Math.multiplyExact', 'Math.toIntExact']
  },
  {
    roadmapNode: 'Strings',
    lessonId: 'java-string-pool-equality-82',
    requiredTags: ['java', 'strings', 'references'],
    prerequisites: ['java-string-methods-23', 'java-reference-null-29'],
    targetTokens: ['.equals(', '.intern()', 'StringBuilder']
  },
  {
    roadmapNode: 'Equals HashCode Comparable',
    lessonId: 'java-mutable-hash-keys-83',
    requiredTags: ['java', 'object-contracts', 'collections', 'sets'],
    prerequisites: ['java-equals-hashcode-37', 'java-set-hashset-36'],
    targetTokens: ['instanceof Tag', 'hashCode', 'HashSet']
  }
];

describe('implemented Java 25 pre-implementation exercises', () => {
  const lessonsById = new Map(builtInLessons.map((lesson) => [lesson.id, lesson]));

  it('promotes selected high-yield pre-map exercises into live cert lessons', () => {
    for (const selected of selectedExercises) {
      const planArea = plan.areas.find((area) => area.roadmapNode === selected.roadmapNode);
      assert.notEqual(planArea, undefined, `${selected.roadmapNode} should exist in the pre-implementation map`);
      assert.ok(
        planArea!.programmingExercises.exercisePatterns.length >= 2,
        `${selected.roadmapNode} should have planned coding exercise patterns`
      );
      assert.ok(
        planArea!.flashcards.questionPatterns.length >= 2,
        `${selected.roadmapNode} should have planned recall patterns`
      );
      assert.ok(
        planArea!.implementedLessonIds?.includes(selected.lessonId),
        `${selected.roadmapNode} should record ${selected.lessonId} as implemented from the pre-map`
      );

      const lesson = lessonsById.get(selected.lessonId);
      assert.notEqual(lesson, undefined, `${selected.lessonId} should be implemented as a live lesson`);
      assert.equal(getBuiltInLessonCategory(lesson!).key, 'java-25-cert-exam', selected.lessonId);
      assert.deepEqual(lesson!.prerequisites, selected.prerequisites, selected.lessonId);
      assert.equal(lesson!.tags.includes('preview'), false, `${selected.lessonId} should be exam-ready, not preview`);
      assert.ok(lesson!.targetCode.startsWith('// Java 25 exam prep - '), `${selected.lessonId} should use the cert-prep header`);
      assert.match(lesson!.targetCode.split('\n')[1] ?? '', /^\/\/ Learn: /, selected.lessonId);

      for (const tag of selected.requiredTags) {
        assert.ok(lesson!.tags.includes(tag), `${selected.lessonId} should include tag ${tag}`);
      }

      for (const token of selected.targetTokens) {
        assert.ok(lesson!.targetCode.includes(token), `${selected.lessonId} should demonstrate ${token}`);
      }
    }
  });

  it('keeps implemented pre-map exercises in the same educational style as other cert lessons', () => {
    for (const selected of selectedExercises) {
      const lesson = lessonsById.get(selected.lessonId)!;
      const checks = lesson.completionChecks ?? [];
      const lineCount = lesson.targetCode.split('\n').length;

      assert.ok((lesson.learningGoals ?? []).length >= 2, `${selected.lessonId} should expose concrete learning goals`);
      assert.ok(lineCount >= 3 && lineCount <= 30, `${selected.lessonId} should stay compact`);
      assert.ok(checks.length >= 2, `${selected.lessonId} should add mock-exam recall coverage`);

      for (const [index, check] of checks.entries()) {
        assert.ok(check.prompt.trim().endsWith('?'), `${selected.lessonId} check ${index + 1} should be phrased as a question`);
        assert.ok(check.choices.length >= 4, `${selected.lessonId} check ${index + 1} should use exam-style distractors`);
        assert.equal(new Set(check.choices).size, check.choices.length, `${selected.lessonId} check ${index + 1} choices should be unique`);
        assert.ok(check.explanation.length >= 20, `${selected.lessonId} check ${index + 1} should explain the trap`);
      }
    }
  });
});
