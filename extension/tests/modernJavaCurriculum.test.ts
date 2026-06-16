import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { builtInLessons } from '../src/lessons/builtInLessons';
import { validateLesson, lessonLanguageVersionsByLanguage, lessonTags } from '../src/lessons/validator';
import type { Lesson } from '../src/lessons/schema';

interface ModernLessonSpec {
  id: string;
  languageVersion: string;
  difficulty: number;
  preview: boolean;
  requiredTags: string[];
  tokens: string[];
}

// The Java 25 block (ids 50-69, growing at 80+ now that 50-69 is full) covers the Oracle
// Java SE 25 (1Z0-831) objectives that the original 30-lesson seed set did not yet reach, plus
// the four language features finalized in JDK 25 and promoted pre-implementation-map drills.
// The Java 26 block (ids 70-79) demonstrates the headline JDK 26 features; everything except
// HTTP/3 is still a preview feature and must be labelled as such so the curriculum stays
// honest about what is and is not on the certification exam.
const java25Lessons: ModernLessonSpec[] = [
  { id: 'java-instance-main-50', languageVersion: 'Java 25', difficulty: 2, preview: false, requiredTags: ['java', 'methods'], tokens: ['void main(', 'IO.'] },
  { id: 'java-flexible-constructors-51', languageVersion: 'Java 25', difficulty: 3, preview: false, requiredTags: ['java', 'constructors'], tokens: ['super(', 'throw'] },
  { id: 'java-module-import-52', languageVersion: 'Java 25', difficulty: 3, preview: false, requiredTags: ['java', 'imports', 'modules'], tokens: ['import module '] },
  { id: 'java-module-declaration-53', languageVersion: 'Java 9', difficulty: 3, preview: false, requiredTags: ['java', 'modules'], tokens: ['module ', 'requires ', 'exports '] },
  { id: 'java-scoped-values-54', languageVersion: 'Java 25', difficulty: 4, preview: false, requiredTags: ['java', 'concurrency', 'scoped-values'], tokens: ['ScopedValue'] },
  { id: 'java-sealed-types-55', languageVersion: 'Java 17', difficulty: 3, preview: false, requiredTags: ['java', 'sealed', 'inheritance'], tokens: ['sealed', 'permits'] },
  { id: 'java-pattern-switch-56', languageVersion: 'Java 21', difficulty: 3, preview: false, requiredTags: ['java', 'switch', 'pattern-matching'], tokens: ['switch', 'when '] },
  { id: 'java-record-patterns-57', languageVersion: 'Java 21', difficulty: 3, preview: false, requiredTags: ['java', 'records', 'pattern-matching'], tokens: ['record ', 'instanceof'] },
  { id: 'java-switch-expression-58', languageVersion: 'Java 14', difficulty: 2, preview: false, requiredTags: ['java', 'switch'], tokens: ['switch', 'yield'] },
  { id: 'java-sequenced-collections-59', languageVersion: 'Java 21', difficulty: 3, preview: false, requiredTags: ['java', 'collections', 'sequenced-collections'], tokens: ['getFirst', 'getLast'] },
  { id: 'java-deque-arraydeque-60', languageVersion: 'Java 8', difficulty: 2, preview: false, requiredTags: ['java', 'collections', 'deque'], tokens: ['Deque', 'ArrayDeque'] },
  { id: 'java-nio-files-61', languageVersion: 'Java 11', difficulty: 3, preview: false, requiredTags: ['java', 'files', 'io'], tokens: ['Path', 'Files.'] },
  { id: 'java-io-streams-62', languageVersion: 'Java 8', difficulty: 3, preview: false, requiredTags: ['java', 'io'], tokens: ['BufferedReader'] },
  { id: 'java-serialization-63', languageVersion: 'Java 16', difficulty: 3, preview: false, requiredTags: ['java', 'io', 'serialization'], tokens: ['Serializable', 'ObjectOutputStream'] },
  { id: 'java-localization-64', languageVersion: 'Java 8', difficulty: 3, preview: false, requiredTags: ['java', 'localization', 'formatting'], tokens: ['Locale', 'NumberFormat'] },
  { id: 'java-concurrency-locks-65', languageVersion: 'Java 8', difficulty: 4, preview: false, requiredTags: ['java', 'concurrency', 'threads'], tokens: ['ReentrantLock'] },
  { id: 'java-parallel-stream-66', languageVersion: 'Java 8', difficulty: 3, preview: false, requiredTags: ['java', 'streams', 'concurrency'], tokens: ['parallel'] },
  { id: 'java-stream-gatherers-67', languageVersion: 'Java 24', difficulty: 4, preview: false, requiredTags: ['java', 'streams', 'collectors'], tokens: ['Gatherers'] },
  { id: 'java-generics-wildcard-copy-68', languageVersion: 'Java 9', difficulty: 4, preview: false, requiredTags: ['java', 'generics', 'collections'], tokens: ['? extends Number', 'addAll'] },
  { id: 'java-optional-lazy-fallback-69', languageVersion: 'Java 8', difficulty: 3, preview: false, requiredTags: ['java', 'optional', 'lambdas'], tokens: ['orElseGet', 'Supplier'] },
  { id: 'java-stream-lazy-pipeline-80', languageVersion: 'Java 16', difficulty: 3, preview: false, requiredTags: ['java', 'streams', 'lambdas'], tokens: ['.filter(', '.toList()', 'IllegalStateException'] },
  { id: 'java-checked-numeric-casts-81', languageVersion: 'Java 8', difficulty: 3, preview: false, requiredTags: ['java', 'numeric-casting', 'math'], tokens: ['Math.multiplyExact', 'Math.toIntExact'] },
  { id: 'java-string-pool-equality-82', languageVersion: 'Java 8', difficulty: 3, preview: false, requiredTags: ['java', 'strings', 'references'], tokens: ['.equals(', '.intern()'] },
  { id: 'java-mutable-hash-keys-83', languageVersion: 'Java 16', difficulty: 4, preview: false, requiredTags: ['java', 'object-contracts', 'sets'], tokens: ['HashSet', 'hashCode'] },
  { id: 'java-nested-classes-84', languageVersion: 'Java 8', difficulty: 3, preview: false, requiredTags: ['java', 'classes', 'static'], tokens: ['static class', 'class ItemView', 'new AuditTask()'] },
  { id: 'java-initializer-blocks-85', languageVersion: 'Java 8', difficulty: 3, preview: false, requiredTags: ['java', 'classes', 'constructors', 'static'], tokens: ['static {', 'id = nextId++'] },
  { id: 'java-module-services-86', languageVersion: 'Java 9', difficulty: 3, preview: false, requiredTags: ['java', 'modules'], tokens: ['uses ', 'provides ', 'with '] },
  { id: 'java-stringbuilder-mutation-87', languageVersion: 'Java 8', difficulty: 3, preview: false, requiredTags: ['java', 'strings'], tokens: ['StringBuilder', '.append(', '.reverse()'] },
  { id: 'java-gc-eligibility-88', languageVersion: 'Java 8', difficulty: 3, preview: false, requiredTags: ['java', 'references'], tokens: ['first = null', 'System.gc()'] },
  { id: 'java-primitive-streams-89', languageVersion: 'Java 8', difficulty: 3, preview: false, requiredTags: ['java', 'streams'], tokens: ['IntStream', '.mapToInt(', '.boxed()'] },
  { id: 'java-concurrent-hashmap-90', languageVersion: 'Java 8', difficulty: 3, preview: false, requiredTags: ['java', 'collections', 'concurrency'], tokens: ['ConcurrentHashMap', '.merge(', '.computeIfAbsent('] },
  { id: 'java-console-input-91', languageVersion: 'Java 8', difficulty: 3, preview: false, requiredTags: ['java', 'io'], tokens: ['Scanner', 'System.console()', 'readLine('] }
];

const java26Lessons: ModernLessonSpec[] = [
  // The Java 26 demos run in the compact-source context where only java.base is implicitly
  // imported, so non-java.base modules keep explicit imports and nested types stay reachable.
  { id: 'java-http3-client-70', languageVersion: 'Java 26', difficulty: 4, preview: false, requiredTags: ['java', 'http-client', 'networking'], tokens: ['HTTP_3', 'import java.net.http.HttpClient;', 'HttpResponse.BodyHandlers.ofString()'] },
  { id: 'java-structured-concurrency-71', languageVersion: 'Java 26', difficulty: 4, preview: true, requiredTags: ['java', 'concurrency', 'structured-concurrency', 'preview'], tokens: ['StructuredTaskScope', 'static String findUser()', 'Subtask<String>'] },
  { id: 'java-lazy-constants-72', languageVersion: 'Java 26', difficulty: 4, preview: true, requiredTags: ['java', 'concurrency', 'lazy-constants', 'preview'], tokens: ['LazyConstant', '.get()', 'System.getLogger'] },
  { id: 'java-primitive-patterns-73', languageVersion: 'Java 26', difficulty: 4, preview: true, requiredTags: ['java', 'pattern-matching', 'switch', 'preview'], tokens: ['case int '] },
  { id: 'java-pem-encoding-74', languageVersion: 'Java 26', difficulty: 4, preview: true, requiredTags: ['java', 'security', 'io', 'preview'], tokens: ['PEMEncoder', 'PublicKey publicKey ='] }
];

const modernLessons = [...java25Lessons, ...java26Lessons];

// Every Oracle Java SE 25 (1Z0-831) objective area that the new blocks are responsible for must
// be represented by at least one shipped lesson tag.
const examObjectiveTags = [
  'enum-members',
  'executors',
  'interface-methods',
  'math',
  'multicatch',
  'numeric-casting',
  'object-contracts',
  'sealed',
  'pattern-matching',
  'sequenced-collections',
  'deque',
  'modules',
  'scoped-values',
  'serialization',
  'localization',
  'files',
  'io',
  'concurrency',
  'time',
  'unnamed-variables',
  'varargs'
];

describe('modern Java certification curriculum', () => {
  const lessonsById = new Map(builtInLessons.map((lesson) => [lesson.id, lesson]));

  it('registers certification-era Java versions as authorable language versions', () => {
    assert.ok(lessonLanguageVersionsByLanguage.java.includes('Java 17'), 'Java 17 should be authorable');
    assert.ok(lessonLanguageVersionsByLanguage.java.includes('Java 22'), 'Java 22 should be authorable');
    assert.ok(lessonLanguageVersionsByLanguage.java.includes('Java 23'), 'Java 23 should be authorable');
    assert.ok(lessonLanguageVersionsByLanguage.java.includes('Java 24'), 'Java 24 should be authorable');
    assert.ok(lessonLanguageVersionsByLanguage.java.includes('Java 25'), 'Java 25 should be authorable');
    assert.ok(lessonLanguageVersionsByLanguage.java.includes('Java 26'), 'Java 26 should be authorable');

    assert.equal(validateLesson(makeValidLesson({ languageVersion: 'Java 17' })).ok, true);
    assert.equal(validateLesson(makeValidLesson({ languageVersion: 'Java 22' })).ok, true);
    assert.equal(validateLesson(makeValidLesson({ languageVersion: 'Java 23' })).ok, true);
    assert.equal(validateLesson(makeValidLesson({ languageVersion: 'Java 24' })).ok, true);
    assert.equal(validateLesson(makeValidLesson({ languageVersion: 'Java 25' })).ok, true);
    assert.equal(validateLesson(makeValidLesson({ languageVersion: 'Java 26' })).ok, true);
  });

  it('registers every new feature tag used by the modern curriculum', () => {
    for (const spec of modernLessons) {
      for (const tag of spec.requiredTags) {
        assert.ok((lessonTags as readonly string[]).includes(tag), `tag ${tag} should be authorable`);
      }
    }
  });

  it('ships all 32 Java 25 exam-prep lessons and 5 Java 26 preview lessons', () => {
    for (const spec of modernLessons) {
      assert.ok(lessonsById.has(spec.id), `${spec.id} should be a built-in lesson`);
    }

    assert.equal(builtInLessons.filter((lesson) => lesson.languageVersion === 'Java 26').length, 5);
    assert.ok(
      builtInLessons.filter((lesson) => lesson.languageVersion === 'Java 25').length >= 4,
      'at least the JDK 25 language-feature lessons should target Java 25'
    );
  });

  it('keeps each modern lesson valid, goal-driven, and demonstrating its real API', () => {
    for (const spec of modernLessons) {
      const lesson = lessonsById.get(spec.id)!;

      assert.equal(validateLesson(lesson).ok, true, spec.id);
      assert.equal(lesson.languageVersion, spec.languageVersion, spec.id);
      assert.equal(lesson.difficulty, spec.difficulty, spec.id);
      assert.ok(Array.isArray(lesson.learningGoals) && lesson.learningGoals.length > 0, `${spec.id} needs learning goals`);

      for (const tag of spec.requiredTags) {
        assert.ok(lesson.tags.includes(tag), `${spec.id} should be tagged ${tag}`);
      }

      for (const token of spec.tokens) {
        assert.ok(lesson.targetCode.includes(token), `${spec.id} targetCode should contain ${token}`);
      }
    }
  });

  it('adds retrieval-practice completion checks to every Java 25 exam-prep lesson', () => {
    for (const spec of java25Lessons) {
      const lesson = lessonsById.get(spec.id)!;
      const checks = lesson.completionChecks ?? [];

      assert.ok(checks.length >= 2, `${spec.id} should have at least two exam-shaped completion checks`);
      for (const [index, check] of checks.entries()) {
        assert.ok(check.prompt.includes('?'), `${spec.id} check ${index + 1} should read as a question`);
        assert.ok(check.choices.length >= 2, `${spec.id} check ${index + 1} should offer answer choices`);
        assert.ok(
          check.answerIndex >= 0 && check.answerIndex < check.choices.length,
          `${spec.id} check ${index + 1} should point at a valid answer`
        );
        assert.ok(check.explanation.length >= 20, `${spec.id} check ${index + 1} should explain the trap`);
      }
    }
  });

  it('labels preview features as preview and keeps final features unmarked', () => {
    for (const spec of modernLessons) {
      const lesson = lessonsById.get(spec.id)!;
      const goalText = (lesson.learningGoals ?? []).join('\n');

      if (spec.preview) {
        assert.ok(lesson.tags.includes('preview'), `${spec.id} should carry the preview tag`);
        assert.match(goalText, /preview/i, `${spec.id} learning goals should flag the preview status`);
      } else {
        assert.equal(lesson.tags.includes('preview'), false, `${spec.id} is a final feature and should not be tagged preview`);
      }
    }
  });

  it('opens every modern lesson with an auto-typed objective header the learner reads', () => {
    for (const spec of modernLessons) {
      const lesson = lessonsById.get(spec.id)!;
      const lines = lesson.targetCode.split('\n');

      // First line names the feature and its Java version so the header alone says what is taught.
      assert.match(lines[0]!, /^\/\/ Java 2[456]\b/, `${spec.id} should open with a Java 24/25/26 header comment`);
      // Second line states the concrete learning outcome.
      assert.match(lines[1]!, /^\/\/ Learn: /, `${spec.id} second header line should state the objective`);
      // Real, typeable code must follow the header (the header is auto-typed, not the whole lesson).
      assert.ok(
        lines.slice(2).some((line) => line.trim().length > 0 && !line.trim().startsWith('//')),
        `${spec.id} should contain typeable code after the header`
      );

      if (spec.preview) {
        assert.match(`${lines[0]} ${lines[1]}`, /preview/i, `${spec.id} header should flag the preview status`);
      }
    }
  });

  it('covers every responsible 1Z0-831 objective area with a shipped lesson tag', () => {
    for (const tag of examObjectiveTags) {
      assert.ok(
        builtInLessons.some((lesson) => !lesson.tags.includes('preview') && lesson.tags.includes(tag)),
        `at least one lesson should cover the ${tag} objective`
      );
    }
  });

  it('orders the modern lessons after the original seed set in the catalogue', () => {
    const ids = builtInLessons.map((lesson) => lesson.id);
    const firstModernIndex = ids.indexOf('java-instance-main-50');
    const lastSeedIndex = ids.indexOf('java-http-client-44');

    assert.ok(firstModernIndex > lastSeedIndex, 'modern lessons should follow the seed catalogue');
  });

  it('keeps the whole cert-exam band ahead of the Java 26 band in the catalogue', () => {
    const ids = builtInLessons.map((lesson) => lesson.id);
    const lastCertIndex = ids.indexOf('java-console-input-91');
    const firstJava26Index = ids.indexOf('java-http3-client-70');

    assert.notEqual(lastCertIndex, -1, 'cert growth lessons should be in the catalogue');
    assert.ok(
      lastCertIndex < firstJava26Index,
      'cert-exam growth ids (80+) should stay grouped with the cert band before Java 26 demos'
    );
  });
});

function makeValidLesson(overrides: Partial<Lesson> = {}): Lesson {
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
    learningGoals: ['Practice a valid lesson.'],
    languageVersion: 'Java 8',
    targetCode: 'int count = 1;\ncount += 1;\nSystem.out.println(count);',
    ...overrides
  };
}
