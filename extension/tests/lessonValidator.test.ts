import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { validateLesson } from '../src/lessons/validator';
import { builtInLessons } from '../src/lessons/builtInLessons';
import { loadLessonsFromDirectories, mergeLessonLists, sortLessonsForPicker } from '../src/lessons/lessonLoader';
import type { Lesson, LessonListItem } from '../src/lessons/schema';

describe('lesson validation and loading', () => {
  it('accepts the complete hand-validated lesson schema', () => {
    const result = validateLesson({
      schemaVersion: 1,
      id: 'java-method-return-02',
      version: 1,
      title: 'Java Method Return',
      description: 'Practice a Java method return value.',
      language: 'java',
      difficulty: 2,
      estimatedSeconds: 120,
      tags: ['java', 'methods'],
      prerequisites: [],
      learningGoals: ['Type a method that returns a value.'],
      defects: [{ line: 2, hint: 'Use a return expression that matches the signature.' }],
      languageVersion: 'Java 8',
      targetCode: 'int add(int a, int b) {\n  return a + b;\n}'
    });

    assert.equal(result.ok, true);
  });

  it('returns a path-rich validation error for invalid fields', () => {
    const result = validateLesson({
      schemaVersion: 1,
      id: 'bad lesson',
      version: 0,
      title: '',
      description: 'Bad',
      language: 'ruby',
      difficulty: 6,
      estimatedSeconds: -1,
      tags: ['java', 2],
      prerequisites: [],
      learningGoals: ['ok', 3],
      languageVersion: '',
      targetCode: ''
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.find((error) => error.path === 'language')!.message, /java/);
    assert.deepEqual(result.errors.map((error) => error.path), [
      'id',
      'version',
      'title',
      'language',
      'difficulty',
      'estimatedSeconds',
      'tags[1]',
      'learningGoals[1]',
      'languageVersion',
      'targetCode'
    ]);
  });

  it('rejects unknown lesson fields instead of silently preserving typos', () => {
    const result = validateLesson({
      ...makeValidLesson(),
      targerCode: 'misspelled'
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map((error) => error.path), [
      'targerCode'
    ]);
  });

  it('accepts optional path-rich defect metadata for fix-the-code lessons', () => {
    const result = validateLesson({
      ...makeValidLesson(),
      defects: [
        { line: 2, hint: 'Use the plural equals helper.' },
        { line: 3, hint: 'Reject index values equal to size.' }
      ]
    });

    assert.equal(result.ok, true);
  });

  it('accepts optional completion checks for exam-shaped recall after a lesson', () => {
    const result = validateLesson({
      ...makeValidLesson(),
      completionChecks: [
        {
          prompt: 'What does Optional.orElseGet avoid when the Optional is present?',
          choices: [
            'Calling the fallback supplier',
            'Creating the Optional instance',
            'Checking for null before map'
          ],
          answerIndex: 0,
          explanation: 'orElseGet is lazy; its supplier runs only when the Optional is empty.'
        }
      ]
    });

    assert.equal(result.ok, true);
  });

  it('rejects malformed completion checks with path-rich errors', () => {
    const result = validateLesson({
      ...makeValidLesson(),
      completionChecks: [
        { prompt: '', choices: ['A', 'B'], answerIndex: 0, explanation: 'Valid explanation.' },
        { prompt: 'Too few choices?', choices: ['A'], answerIndex: 0, explanation: 'Valid explanation.' },
        { prompt: 'Index in range?', choices: ['A', 'B'], answerIndex: 2, explanation: 'Valid explanation.' },
        { prompt: 'Explanation required?', choices: ['A', 'B'], answerIndex: 1, explanation: '' },
        { prompt: 'Unknown field?', choices: ['A', 'B'], answerIndex: 1, explanation: 'Valid.', extra: true },
        'not a check'
      ]
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map((error) => error.path), [
      'completionChecks[0].prompt',
      'completionChecks[1].choices',
      'completionChecks[2].answerIndex',
      'completionChecks[3].explanation',
      'completionChecks[4].extra',
      'completionChecks[5]'
    ]);
  });

  it('rejects malformed defect metadata with path-rich errors', () => {
    const result = validateLesson({
      ...makeValidLesson(),
      defects: [
        { line: 0, hint: 'Line numbers are one-based.' },
        { line: 2, hint: '' },
        { line: 3, hint: 'Valid hint.', extra: true },
        'not a defect'
      ]
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map((error) => error.path), [
      'defects[0].line',
      'defects[1].hint',
      'defects[2].extra',
      'defects[3]'
    ]);
  });

  it('rejects the removed multi-step authoring shape at runtime', () => {
    const result = validateLesson({
      ...makeValidLesson(),
      steps: [
        {
          title: 'First step',
          targetCode: 'const count = 1;'
        }
      ]
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map((error) => error.path), ['steps']);
  });

  it('validates languageVersion against the known versions for each language', () => {
    assert.equal(validateLesson(makeValidLesson({
      languageVersion: 'Java 17'
    })).ok, true);
    assert.equal(validateLesson(makeValidLesson({
      languageVersion: 'Java 21'
    })).ok, true);
    assert.equal(validateLesson(makeValidLesson({
      languageVersion: 'Java 22'
    })).ok, true);
    assert.equal(validateLesson(makeValidLesson({
      languageVersion: 'Java 23'
    })).ok, true);
    assert.equal(validateLesson(makeValidLesson({
      languageVersion: 'Java 24'
    })).ok, true);

    const typo = validateLesson(makeValidLesson({
      languageVersion: 'Java 20'
    }));
    assert.equal(typo.ok, false);
    assert.deepEqual(typo.errors.map((error) => error.path), ['languageVersion']);

    const removedLanguage = validateLesson(makeValidLesson({
      language: 'cpp',
      id: 'cpp-removed-version-01',
      tags: ['cpp'],
      languageVersion: 'C++20'
    }));
    assert.equal(removedLanguage.ok, false);
    assert.deepEqual(removedLanguage.errors.map((error) => error.path), ['language', 'tags[0]']);
  });

  it('requires advanced lessons to declare version metadata and learning goals', () => {
    const missing = validateLesson(makeValidLesson({
      difficulty: 3,
      languageVersion: undefined,
      learningGoals: undefined
    }));
    assert.equal(missing.ok, false);
    assert.deepEqual(missing.errors.map((error) => error.path), [
      'learningGoals',
      'languageVersion'
    ]);

    const emptyGoals = validateLesson(makeValidLesson({
      difficulty: 3,
      learningGoals: []
    }));
    assert.equal(emptyGoals.ok, false);
    assert.deepEqual(emptyGoals.errors.map((error) => error.path), ['learningGoals']);

    assert.equal(validateLesson(makeValidLesson({
      difficulty: 2,
      languageVersion: undefined,
      learningGoals: undefined
    })).ok, true);
  });

  it('validates tags against the authoring allowlist', () => {
    const result = validateLesson(makeValidLesson({
      tags: ['java', 'stream']
    }));

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map((error) => error.path), ['tags[1]']);
    assert.match(result.errors[0]!.message, /known lesson tag/);
  });

  it('rejects removed exam-style practice Prog2 lesson tags', () => {
    const result = validateLesson(makeValidLesson({
      id: 'prog2-exam-style-sample-401',
      difficulty: 4,
      tags: ['java', 'prog2', 'b3', 'exam-style-practice', 'source-file', 'javafx', 'maps'],
      targetCode: 'class ExamStyleSample { // Defines a sample source-file lesson.\n  void run() { } // Keeps the fixture compact.\n} // end ExamStyleSample.'
    }));

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map((error) => error.path), ['tags[3]']);
  });

  it('rejects removed exam reference Prog2 lesson tags', () => {
    const result = validateLesson(makeValidLesson({
      id: 'prog2-exam-reference-format-mc-437',
      difficulty: 4,
      tags: ['java', 'prog2', 'exam-reference', 'source-file', 'collections', 'maps', 'sorting'],
      targetCode: [
        '// LESSON: Exam Reference - Format and MC Traps.',
        '// You will learn: Recognize the actual PROG2 exam format and common multiple-choice traps.',
        'class ExamReferenceFormatMc {',
        '  static boolean passesGate(int multipleChoicePoints, int task2, int task3, int task4) {',
        '    return multipleChoicePoints >= 10 && task2 >= 1 && task3 >= 1 && task4 >= 1;',
        '  }',
        '}'
      ].join('\n')
    }));

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map((error) => error.path), ['tags[2]']);
  });

  it('bounds estimatedSeconds and cross-checks long snippets against target length', () => {
    const tooShortForLongTarget = validateLesson(makeValidLesson({
      estimatedSeconds: 130,
      targetCode: [
        'HttpRequest request = HttpRequest.newBuilder()',
        '    .uri(URI.create("https://example.com/users"))',
        '    .header("Accept", "application/json")',
        '    .header("User-Agent", "cTrain")',
        '    .timeout(Duration.ofSeconds(10))',
        '    .GET()',
        '    .build();',
        'HttpResponse<String> response = client.send(request, BodyHandlers.ofString());'
      ].join('\n')
    }));
    assert.equal(tooShortForLongTarget.ok, false);
    assert.deepEqual(tooShortForLongTarget.errors.map((error) => error.path), ['estimatedSeconds']);

    const longTeachingComments = validateLesson(makeValidLesson({
      estimatedSeconds: 35,
      targetCode: [
        '// Learn: Read concise teaching notes before typing the real code.',
        '// This explanatory line is auto-typed and should not inflate the typing estimate.',
        '// Another long note describes a concept that is useful to read but not part of WPM.',
        '// Auto-typed comments can be long enough to help the learner without adding typing work.',
        '// The estimate should still follow the actual code characters that the learner types.',
        'int count = 1;',
        'count += 1;',
        'System.out.println(count);'
      ].join('\n')
    }));
    assert.equal(longTeachingComments.ok, true);

    const tooLarge = validateLesson(makeValidLesson({
      estimatedSeconds: 1_801
    }));
    assert.equal(tooLarge.ok, false);
    assert.deepEqual(tooLarge.errors.map((error) => error.path), ['estimatedSeconds']);

    const sourceFile = validateLesson(makeValidLesson({
      id: 'prog2-ref-p2-long-source-99',
      language: 'java',
      tags: ['java', 'prog2', 'b3', 'source-file'],
      estimatedSeconds: 1_200,
      targetCode: Array.from({ length: 80 }, (_, index) => `System.out.println(${index});`).join('\n')
    }));
    assert.equal(sourceFile.ok, true);
  });

  it('rejects snippet targetCode outside the 3 to 30 line authoring range', () => {
    const oneLine = validateLesson(makeValidLesson({
      targetCode: 'System.out.println("one line");'
    }));
    assert.equal(oneLine.ok, false);
    assert.deepEqual(oneLine.errors.map((error) => error.path), ['targetCode']);

    const tooManyLines = validateLesson(makeValidLesson({
      targetCode: Array.from({ length: 31 }, (_, index) => `line${index}();`).join('\n')
    }));
    assert.equal(tooManyLines.ok, false);
    assert.deepEqual(tooManyLines.errors.map((error) => error.path), ['targetCode']);
  });

  it('requires lesson ids to match their language prefix except Prog2 Java lessons', () => {
    const wrongPrefix = validateLesson(makeValidLesson({
      id: 'future-valid-01',
      language: 'java'
    }));
    assert.equal(wrongPrefix.ok, false);
    assert.deepEqual(wrongPrefix.errors.map((error) => error.path), ['id']);

    const prog2Java = validateLesson(makeValidLesson({
      id: 'prog2-ref-p2-list-api-702',
      language: 'java',
      tags: ['java', 'prog2', 'b2', 'source-file', 'collections']
    }));
    assert.equal(prog2Java.ok, true);
  });

  it('rejects former non-Java built-in lesson content', () => {
    const result = validateLesson({
      schemaVersion: 1,
      id: 'cpp-hello-world-01',
      version: 1,
      title: 'C++ Hello World',
      description: 'Practice a minimal C++ program.',
      language: 'cpp',
      difficulty: 1,
      estimatedSeconds: 90,
      tags: ['cpp', 'iostream'],
      prerequisites: [],
      targetCode: '#include <iostream>\n\nint main() {\n  std::cout << "Hello, cTrain!\\n";\n  return 0;\n}'
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map((error) => error.path), ['language', 'tags[0]', 'tags[1]']);
  });

  it('ships the Java-only public seed set', () => {
    assert.equal(builtInLessons.length, 89);
    assert.equal(builtInLessons.filter((item) => item.language === 'java').length, 89);
    assert.equal(builtInLessons.some((item) => /^(?:cpp|typescript|python)-/.test(item.id)), false);
    assert.equal(builtInLessons.some((item) => item.id.startsWith('prog2-')), false);

    for (const item of builtInLessons) {
      assert.equal(validateLesson(item).ok, true, item.id);
    }

    assert.deepEqual(builtInLessons.map((item) => item.id), [
      ...expectedJavaLessonIds
    ]);

  });

  it('keeps the built-in completion check bank broad and non-gameable', () => {
    const lessonsWithoutChecks = builtInLessons
      .filter((lesson) => (lesson.completionChecks ?? []).length === 0)
      .map((lesson) => lesson.id);
    const checks = builtInLessons.flatMap((lesson) => lesson.completionChecks ?? []);
    const indexZeroCount = checks.filter((check) => check.answerIndex === 0).length;
    const indexZeroShare = indexZeroCount / checks.length;

    assert.deepEqual(lessonsWithoutChecks, []);
    assert.ok(checks.length >= 80, `expected at least 80 completion checks, found ${checks.length}`);
    assert.ok(indexZeroShare <= 0.4, `answerIndex 0 share should stay <= 40%, found ${indexZeroShare}`);
    assert.ok(checks.some((check) => check.answerIndex === 2), 'at least one check should use answerIndex 2');
  });

  it('keeps entry-tier lessons reachable without advanced prerequisite cliffs', () => {
    assertLessonPrerequisites('java-exceptions-try-catch-06', ['java-interface-04']);
    assertLessonPrerequisites('java-primitives-types-21', ['java-class-basic-01']);
    assertLessonPrerequisites('java-if-else-22', ['java-primitives-types-21']);
    assertLessonPrerequisites('java-string-methods-23', ['java-primitives-types-21', 'java-if-else-22']);
    assertLessonPrerequisites('java-operators-assignment-24', ['java-string-methods-23']);
  });

  it('keeps the remaining Java curriculum gap lessons in the natural track', () => {
    assertLessonPrerequisites('java-arrays-init-25', ['java-operators-assignment-24']);
    assertLessonPrerequisites('java-static-members-26', ['java-arrays-init-25']);
    assertLessonPrerequisites('java-indexed-loop-27', ['java-static-members-26']);
    assertLessonPrerequisites('java-method-overload-28', ['java-indexed-loop-27']);
    assertLessonPrerequisites('java-reference-null-29', ['java-method-overload-28']);
    assertLessonPrerequisites('java-package-import-30', ['java-reference-null-29']);
    assertLessonPrerequisites('java-interface-methods-31', ['java-package-import-30']);
    assertLessonPrerequisites('java-functional-interfaces-32', ['java-package-import-30']);
    assertLessonPrerequisites('java-varargs-33', ['java-method-overload-28']);
    assertLessonPrerequisites('java-unnamed-variables-34', ['java-varargs-33']);
    assertLessonPrerequisites('java-enum-members-35', ['java-enum-switch-12']);
    assertLessonPrerequisites('java-set-hashset-36', ['java-functional-interfaces-32']);
    assertLessonPrerequisites('java-equals-hashcode-37', ['java-set-hashset-36']);
    assertLessonPrerequisites('java-casting-overflow-38', ['java-primitives-types-21']);
    assertLessonPrerequisites('java-multicatch-custom-exception-39', ['java-try-with-resources-18']);
    assertLessonPrerequisites('java-executors-callable-41', ['java-thread-runnable-20']);
    assertLessonPrerequisites('java-time-formatting-43', ['java-time-localdate-42']);
  });

  it('keeps Java 8 lessons decoupled from Java 21 prerequisite chains', () => {
    assertLessonPrerequisites('java-time-localdate-42', ['java-static-members-26']);
    assert.equal(findBuiltInLesson('java-time-localdate-42').languageVersion, 'Java 8');
    assert.equal(findBuiltInLesson('java-static-members-26').languageVersion, 'Java 8');
  });

  it('keeps all built-in lessons within lesson authoring guardrails', () => {
    for (const lesson of builtInLessons) {
      const validation = validateLesson(lesson);
      assert.equal(validation.ok, true, lesson.id);

      const targetLineCount = lesson.targetCode.split('\n').length;
      assert.ok(targetLineCount >= 3, `${lesson.id} should have at least 3 targetCode lines`);
      assert.ok(targetLineCount <= 30, `${lesson.id} should have at most 30 targetCode lines`);

      if (lesson.difficulty >= 3) {
        const languageVersion = lesson.languageVersion;
        if (typeof languageVersion !== 'string') {
          assert.fail(`${lesson.id} should declare languageVersion`);
        }
        assert.ok(languageVersion.length > 0, `${lesson.id} should declare languageVersion`);
        assert.ok(Array.isArray(lesson.learningGoals), `${lesson.id} should declare learningGoals`);
      }
    }
  });

  it('keeps built-in estimates inside the runtime authoring bounds', () => {
    for (const lesson of builtInLessons) {
      assert.ok(lesson.estimatedSeconds >= 10, `${lesson.id} should be at least 10 seconds`);
      assert.ok(lesson.estimatedSeconds <= 1_800, `${lesson.id} should be at most 1800 seconds`);
      if (countTypeableTargetCharacters(lesson.targetCode) > 300 && !lesson.tags.includes('source-file')) {
        assert.ok(lesson.estimatedSeconds >= 180, `${lesson.id} should budget long snippets at 180s or more`);
      }
    }
  });

  it('loads workspace lessons, skips invalid files, and rejects duplicate ids deterministically', () => {
    const result = loadLessonsFromDirectories([
      {
        source: 'built-in',
        lessons: [builtInLessons[0]]
      },
      {
        source: 'workspace',
        lessons: [
          builtInLessons[0],
          {
            schemaVersion: 1,
            id: 'java-workspace-01',
            version: 1,
            title: 'Workspace Java',
            description: 'Workspace lesson.',
            language: 'java',
            difficulty: 2,
            estimatedSeconds: 180,
            tags: ['workspace'],
            prerequisites: [],
            targetCode: 'String name = "workspace";\nSystem.out.println(name);\nSystem.out.println(name.toUpperCase());'
          },
          { id: 'invalid' }
        ]
      }
    ]);

    assert.deepEqual(result.lessons.map((item) => item.lesson.id), [
      builtInLessons[0].id,
      'java-workspace-01'
    ]);
    assert.equal(result.errors.length, 2);
    assert.match(result.errors[0].message, /Duplicate lesson id/);
    assert.match(result.errors[1].message, /schemaVersion/);
  });

  it('sorts picker lessons by built-in track order before fallback display fields', () => {
    const sorted = sortLessonsForPicker([
      makeLessonListItem('future-alpha-01', 'Future'),
      makeLessonListItem('prog2-ref-p2-list-api-702', 'Prog2'),
      { lesson: builtInLessons.find((item) => item.id === 'java-class-basic-01')!, source: 'built-in' }
    ]);

    assert.deepEqual(sorted.map((item) => item.lesson.id), [
      'java-class-basic-01',
      'prog2-ref-p2-list-api-702',
      'future-alpha-01'
    ]);
  });

  it('sorts same-sequence built-in lessons by id before fallback display fields', () => {
    const sorted = sortLessonsForPicker([
      makeLessonListItem('java-beta-01', 'A title', 1),
      makeLessonListItem('java-alpha-01', 'Z title', 5)
    ]);

    assert.deepEqual(sorted.map((item) => item.lesson.id), [
      'java-alpha-01',
      'java-beta-01'
    ]);
  });

  it('rejects lessons with missing prerequisites after all lesson ids are known', () => {
    const result = loadLessonsFromDirectories([
      {
        source: 'workspace',
        lessons: [
          makeValidLesson({
            id: 'java-needs-missing-01',
            prerequisites: ['java-missing-99']
          })
        ]
      }
    ]);

    assert.deepEqual(result.lessons, []);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0]!.message, /Missing prerequisite "java-missing-99"/);
  });

  it('accepts prerequisites declared later in the same load batch', () => {
    const result = loadLessonsFromDirectories([
      {
        source: 'workspace',
        lessons: [
          makeValidLesson({
            id: 'java-second-02',
            prerequisites: ['java-first-01']
          }),
          makeValidLesson({
            id: 'java-first-01',
            prerequisites: []
          })
        ]
      }
    ]);

    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.lessons.map((item) => item.lesson.id), ['java-second-02', 'java-first-01']);
  });

  it('rejects cyclic prerequisite chains after all lesson ids are known', () => {
    const result = loadLessonsFromDirectories([
      {
        source: 'workspace',
        lessons: [
          makeValidLesson({
            id: 'java-cycle-a-01',
            title: 'Cycle A',
            prerequisites: ['java-cycle-b-02']
          }),
          makeValidLesson({
            id: 'java-cycle-b-02',
            title: 'Cycle B',
            prerequisites: ['java-cycle-a-01']
          })
        ]
      }
    ]);

    assert.deepEqual(result.lessons, []);
    assert.equal(result.errors.length, 2);
    assert.match(result.errors[0]!.message, /Cyclic prerequisite chain/);
    assert.match(result.errors[0]!.message, /java-cycle-a-01 -> java-cycle-b-02 -> java-cycle-a-01/);
  });

  it('rejects lessons whose prerequisite was rejected by load-time validation', () => {
    const result = loadLessonsFromDirectories([
      {
        source: 'workspace',
        lessons: [
          makeValidLesson({
            id: 'java-dependent-01',
            title: 'Dependent',
            prerequisites: ['java-broken-02']
          }),
          makeValidLesson({
            id: 'java-broken-02',
            title: 'Broken',
            prerequisites: ['java-missing-99']
          })
        ]
      }
    ]);

    assert.deepEqual(result.lessons, []);
    assert.equal(result.errors.length, 2);
    assert.match(result.errors[0]!.message, /Missing prerequisite "java-missing-99"/);
    assert.match(result.errors[1]!.message, /Rejected prerequisite "java-broken-02" for lesson "java-dependent-01"/);
  });

  it('sorts Prog2 lessons after Java and unknown future prefixes after known tracks', () => {
    const sorted = sortLessonsForPicker([
      makeLessonListItem('prog2-ref-p2-list-api-702', 'Prog2'),
      makeLessonListItem('future-alpha-01', 'Future'),
      { lesson: builtInLessons.find((item) => item.id === 'java-class-basic-01')!, source: 'built-in' }
    ]);

    assert.deepEqual(sorted.map((item) => item.lesson.id), [
      'java-class-basic-01',
      'prog2-ref-p2-list-api-702',
      'future-alpha-01'
    ]);
  });

  it('rejects duplicate workspace lesson ids when merging with built-in lessons', () => {
    const result = mergeLessonLists(
      [{ lesson: builtInLessons[0], source: 'built-in' }],
      [
        { lesson: builtInLessons[0], source: 'workspace' },
        { lesson: builtInLessons[1], source: 'workspace' }
      ]
    );

    assert.deepEqual(result.lessons.map((item) => item.lesson.id), [
      builtInLessons[0].id,
      builtInLessons[1].id
    ]);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /Duplicate lesson id/);
  });
});

const expectedJavaLessonIds = [
      'java-class-basic-01',
      'java-method-return-02',
      'java-loop-array-03',
      'java-interface-04',
      'java-access-modifiers-05',
      'java-exceptions-try-catch-06',
      'java-collections-list-07',
      'java-map-counter-08',
      'java-constructor-encapsulation-09',
      'java-inheritance-extends-10',
      'java-abstract-class-11',
      'java-enum-switch-12',
      'java-lambda-functional-13',
      'java-generics-method-14',
      'java-optional-orelse-15',
      'java-stream-collect-16',
      'java-stream-groupby-17',
      'java-try-with-resources-18',
      'java-var-textblock-19',
      'java-thread-runnable-20',
      'java-primitives-types-21',
      'java-if-else-22',
      'java-string-methods-23',
      'java-operators-assignment-24',
      'java-arrays-init-25',
      'java-static-members-26',
      'java-indexed-loop-27',
      'java-method-overload-28',
      'java-reference-null-29',
      'java-package-import-30',
      'java-interface-methods-31',
      'java-functional-interfaces-32',
      'java-varargs-33',
      'java-unnamed-variables-34',
      'java-enum-members-35',
      'java-set-hashset-36',
      'java-equals-hashcode-37',
      'java-casting-overflow-38',
      'java-multicatch-custom-exception-39',
      'java-virtual-threads-40',
      'java-executors-callable-41',
      'java-time-localdate-42',
      'java-time-formatting-43',
      'java-http-client-44',
      'java-records-45',
      'java-instance-main-50',
      'java-flexible-constructors-51',
      'java-module-import-52',
      'java-module-declaration-53',
      'java-scoped-values-54',
      'java-sealed-types-55',
      'java-pattern-switch-56',
      'java-record-patterns-57',
      'java-switch-expression-58',
      'java-sequenced-collections-59',
      'java-deque-arraydeque-60',
      'java-nio-files-61',
      'java-io-streams-62',
      'java-serialization-63',
      'java-localization-64',
      'java-concurrency-locks-65',
      'java-parallel-stream-66',
      'java-stream-gatherers-67',
      'java-generics-wildcard-copy-68',
      'java-optional-lazy-fallback-69',
      'java-stream-lazy-pipeline-80',
      'java-checked-numeric-casts-81',
      'java-string-pool-equality-82',
      'java-mutable-hash-keys-83',
      'java-nested-classes-84',
      'java-initializer-blocks-85',
      'java-module-services-86',
      'java-stringbuilder-mutation-87',
      'java-gc-eligibility-88',
      'java-primitive-streams-89',
      'java-concurrent-hashmap-90',
      'java-console-input-91',
      'java-packaging-artifacts-92',
      'java-stream-partitioning-93',
      'java-http3-client-70',
      'java-structured-concurrency-71',
      'java-lazy-constants-72',
      'java-primitive-patterns-73',
      'java-pem-encoding-74',
      'java-final-fields-75',
      'java-applet-removal-76',
      'java-aot-object-caching-77',
      'java-g1-synchronization-78',
      'java-vector-api-79'
];

function assertLessonPrerequisites(lessonId: string, prerequisites: string[]): void {
  assert.deepEqual(findBuiltInLesson(lessonId).prerequisites, prerequisites, lessonId);
}

function findBuiltInLesson(lessonId: string): Lesson {
  const lessonsById = new Map(builtInLessons.map((lesson) => [lesson.id, lesson]));
  const lesson = lessonsById.get(lessonId);
  assert.notEqual(lesson, undefined, `${lessonId} should exist`);
  return lesson!;
}

function makeLessonListItem(id: string, title: string, difficulty: Lesson['difficulty'] = 3): LessonListItem {
  const lesson: Lesson = {
    schemaVersion: 1,
    id,
    version: 1,
    title,
    description: 'Synthetic built-in lesson used to test track ordering.',
    language: 'java',
    difficulty,
    estimatedSeconds: 120,
    tags: ['prog2'],
    prerequisites: [],
    targetCode: 'class Example {}'
  };

  return { lesson, source: 'built-in' };
}

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

function countTypeableTargetCharacters(targetCode: string): number {
  return targetCode
    .split('\n')
    .map((line) => {
      const commentStart = findLineCommentStart(line);
      return commentStart === undefined ? line : line.slice(0, commentStart);
    })
    .join('\n')
    .length;
}

function findLineCommentStart(line: string): number | undefined {
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (let index = 0; index < line.length - 1; index += 1) {
    const char = line[index]!;
    const next = line[index + 1]!;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (quote !== undefined) {
      if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '/' && next === '/') {
      return index;
    }
  }

  return undefined;
}
