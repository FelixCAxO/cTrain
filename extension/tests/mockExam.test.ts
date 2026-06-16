import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  collectMockExamQuestions,
  createMockExamCompletionCheckAnswerRecords,
  createMockExamAttempt,
  formatMockExamSummary,
  mockExamDurationMs,
  mockExamPassingScorePercent,
  mockExamQuestionCount,
  selectMockExamQuestions
} from '../src/commands/mockExam';
import { getExamObjectiveForLesson, javaSe25ExamBlueprint, isObjectiveMixWithinTolerance } from '../src/commands/examBlueprint';
import { builtInLessons } from '../src/lessons/builtInLessons';
import type { Lesson, LessonCompletionCheck } from '../src/lessons/schema';

describe('mock exam command model', () => {
  it('matches the Java SE 25 exam format', () => {
    assert.equal(mockExamQuestionCount, 50);
    assert.equal(mockExamDurationMs, 120 * 60 * 1000);
    assert.equal(mockExamPassingScorePercent, 68);
    assert.equal(javaSe25ExamBlueprint.objectives.length, 10);
  });

  it('collects completion checks from all eligible lessons with lesson context', () => {
    const questions = collectMockExamQuestions([
      lesson('java-a-01', 'Lesson A', [
        {
          prompt: 'What prints?',
          choices: ['A', 'B'],
          answerIndex: 0,
          explanation: 'A is printed.'
        }
      ], { tags: ['java', 'strings'] }),
      lesson('java-b-02', 'Lesson B', []),
      lesson('java-c-03', 'Lesson C', [
        {
          prompt: 'Does this compile?',
          choices: ['Yes', 'No'],
          answerIndex: 1,
          explanation: 'The snippet does not compile.'
        }
      ])
    ]);

    assert.deepEqual(questions.map((question) => ({
      id: question.id,
      lessonId: question.lessonId,
      lessonTitle: question.lessonTitle,
      checkIndex: question.checkIndex,
      objectiveId: question.objectiveId,
      prompt: question.check.prompt
    })), [
      {
        id: 'java-a-01:0',
        lessonId: 'java-a-01',
        lessonTitle: 'Lesson A',
        checkIndex: 0,
        objectiveId: 'values',
        prompt: 'What prints?'
      },
      {
        id: 'java-c-03:0',
        lessonId: 'java-c-03',
        lessonTitle: 'Lesson C',
        checkIndex: 0,
        objectiveId: 'oop',
        prompt: 'Does this compile?'
      }
    ]);
  });

  it('excludes preview, Java 26, and HTTP client side-track questions from certification exams by default', () => {
    const examLesson = lesson('java-method-return-02', 'Method Return', [
      {
        prompt: 'What returns?',
        choices: ['a + b', 'void'],
        answerIndex: 0,
        explanation: 'The return expression is a + b.'
      }
    ]);
    const previewLesson = lesson('java-primitive-patterns-73', 'Primitive Patterns', [
      {
        prompt: 'Preview?',
        choices: ['Yes', 'No'],
        answerIndex: 0,
        explanation: 'Primitive patterns are preview here.'
      }
    ], { tags: ['java', 'preview'], languageVersion: 'Java 26' });
    const httpLesson = lesson('java-http-client-44', 'HTTP Client', [
      {
        prompt: 'Which client?',
        choices: ['HttpClient', 'Scanner'],
        answerIndex: 0,
        explanation: 'HttpClient is the networking API.'
      }
    ], { tags: ['java', 'http-client'], languageVersion: 'Java 11' });

    assert.deepEqual(
      collectMockExamQuestions([examLesson, previewLesson, httpLesson]).map((question) => question.lessonId),
      ['java-method-return-02']
    );
    assert.deepEqual(
      collectMockExamQuestions([examLesson, previewLesson, httpLesson], { includeOffSyllabus: true }).map((question) => question.lessonId),
      ['java-method-return-02', 'java-primitive-patterns-73', 'java-http-client-44']
    );
  });

  it('selects a bounded random question set without repeats', () => {
    const questions = Array.from({ length: 5 }, (_, index) => mockQuestion(index, undefined, 'values'));

    const selected = selectMockExamQuestions(questions, 3, sequenceRandom([0.8, 0.1, 0.5, 0.2]));

    assert.equal(selected.length, 3);
    assert.equal(new Set(selected.map((question) => question.id)).size, 3);
    assert.deepEqual(selected.map((question) => question.id), ['java-q-04:0', 'java-q-00:0', 'java-q-02:0']);
    assert.equal(selectMockExamQuestions(questions, 99, () => 0).length, 5);
  });

  it('selects objective-weighted exams within five percentage points of the blueprint when the bank is deep enough', () => {
    const questions = javaSe25ExamBlueprint.objectives.flatMap((objective) => (
      Array.from({ length: 8 }, (_value, index) => mockQuestion(index, undefined, objective.id))
    ));

    const selected = selectMockExamQuestions(questions, mockExamQuestionCount, sequenceRandom(Array(100).fill(0)));

    assert.equal(selected.length, 50);
    assert.equal(isObjectiveMixWithinTolerance(selected, javaSe25ExamBlueprint, 5), true);
    assert.deepEqual(
      javaSe25ExamBlueprint.objectives.map((objective) => [
        objective.id,
        selected.filter((question) => question.objectiveId === objective.id).length
      ]),
      javaSe25ExamBlueprint.objectives.map((objective) => [objective.id, 5])
    );
  });

  it('classifies overlapping localization lesson tags to the localization objective', () => {
    const localizationLesson = builtInLessons.find((lesson) => lesson.id === 'java-localization-64');

    assert.notEqual(localizationLesson, undefined);
    assert.equal(getExamObjectiveForLesson(localizationLesson!)?.id, 'localization');
  });

  it('keeps the real built-in mock exam bank within the blueprint tolerance', () => {
    const bank = collectMockExamQuestions(builtInLessons);
    const selected = selectMockExamQuestions(bank, mockExamQuestionCount, sequenceRandom(Array(500).fill(0)));
    const counts = Object.fromEntries(javaSe25ExamBlueprint.objectives.map((objective) => [
      objective.id,
      selected.filter((question) => question.objectiveId === objective.id).length
    ]));

    assert.equal(selected.length, mockExamQuestionCount);
    assert.equal(
      isObjectiveMixWithinTolerance(selected, javaSe25ExamBlueprint, 5),
      true,
      JSON.stringify(counts)
    );
  });

  it('keeps the built-in question bank deep enough for back-to-back 1Z0-831 mocks', () => {
    const bank = collectMockExamQuestions(builtInLessons);

    assert.ok(
      bank.length >= mockExamQuestionCount * 4,
      `expected at least ${mockExamQuestionCount * 4} eligible questions, found ${bank.length}`
    );
  });

  it('keeps at least half of the built-in question bank in code-trace format', () => {
    const bank = collectMockExamQuestions(builtInLessons);
    const traceQuestions = bank.filter((question) => isCodeTraceCheck(question.check));

    assert.ok(bank.length > 0);
    assert.ok(
      traceQuestions.length / bank.length >= 0.5,
      `expected at least 50% code-trace questions, found ${traceQuestions.length}/${bank.length}`
    );
  });

  it('gives every certification lesson enough checks and at least one code-trace check', () => {
    const thinLessons = builtInLessons
      .filter((lesson) => getExamObjectiveForLesson(lesson) !== undefined)
      .filter((lesson) => (lesson.completionChecks ?? []).length < 2)
      .map((lesson) => lesson.id);
    const missingTraceLessons = builtInLessons
      .filter((lesson) => getExamObjectiveForLesson(lesson) !== undefined)
      .filter((lesson) => !(lesson.completionChecks ?? []).some(isCodeTraceCheck))
      .map((lesson) => lesson.id);

    assert.deepEqual(thinLessons, [], `certification lessons with fewer than two checks: ${thinLessons.join(', ')}`);
    assert.deepEqual(missingTraceLessons, [], `certification lessons without code-trace checks: ${missingTraceLessons.join(', ')}`);
  });

  it('creates spaced-review answer records for wrong mock exam completion checks', () => {
    const questions = [
      mockQuestion(1, {
        prompt: 'Question 1?',
        choices: ['wrong', 'right'],
        answerIndex: 1,
        explanation: 'The second answer is correct.'
      }),
      mockQuestion(2, {
        prompt: 'Question 2?',
        choices: ['right', 'wrong'],
        answerIndex: 0,
        explanation: 'The first answer is correct.'
      })
    ];

    const records = createMockExamCompletionCheckAnswerRecords({
      questions,
      selectedChoiceIndexesByQuestionId: new Map([
        ['java-q-01:0', 0],
        ['java-q-02:0', 0]
      ]),
      answeredAt: '2026-06-08T08:30:00.000Z'
    });

    assert.deepEqual(records, [
      {
        lessonId: 'java-q-01',
        lessonTitle: 'Question 1',
        checkIndex: 0,
        check: questions[0]!.check,
        selectedChoiceIndex: 0,
        answeredAt: '2026-06-08T08:30:00.000Z',
        source: 'mock-exam'
      }
    ]);
  });

  it('grades answers, builds wrong-answer review, and applies the 68 percent passing score', () => {
    const startedAt = '2026-06-08T08:00:00.000Z';
    const completedAt = '2026-06-08T08:30:00.000Z';
    const questions = [
      mockQuestion(1, {
        prompt: 'Question 1?',
        choices: ['wrong', 'right'],
        answerIndex: 1,
        explanation: 'The second answer is correct.'
      }),
      mockQuestion(2, {
        prompt: 'Question 2?',
        choices: ['right', 'wrong'],
        answerIndex: 0,
        explanation: 'The first answer is correct.'
      }),
      mockQuestion(3, {
        prompt: 'Question 3?',
        choices: ['right', 'wrong'],
        answerIndex: 0,
        explanation: 'The first answer is correct.'
      })
    ];

    const attempt = createMockExamAttempt({
      questions,
      selectedChoiceIndexesByQuestionId: new Map([
        ['java-q-01:0', 0],
        ['java-q-02:0', 0],
        ['java-q-03:0', 0]
      ]),
      startedAt,
      completedAt
    });

    assert.equal(attempt.questionCount, 3);
    assert.equal(attempt.correctCount, 2);
    assert.equal(attempt.scorePercent, 67);
    assert.equal(attempt.passed, false);
    assert.equal(attempt.durationMs, 1_800_000);
    assert.deepEqual(attempt.lessonIds, ['java-q-01', 'java-q-02', 'java-q-03']);
    assert.deepEqual(attempt.objectiveResults, [
      {
        objectiveId: 'values',
        objectiveLabel: 'Handling Date, Time, Text, Numeric and Boolean Values',
        questionCount: 3,
        correctCount: 2,
        accuracyPercent: 67
      }
    ]);
    assert.deepEqual(attempt.wrongAnswers, [
      {
        lessonId: 'java-q-01',
        lessonTitle: 'Question 1',
        objectiveId: 'values',
        objectiveLabel: 'Handling Date, Time, Text, Numeric and Boolean Values',
        prompt: 'Question 1?',
        selectedChoice: 'wrong',
        correctChoice: 'right',
        explanation: 'The second answer is correct.'
      }
    ]);
    assert.equal(formatMockExamSummary(attempt), 'Mock exam: 2/3 correct (67%) - below the 68% pass mark.');
  });

  it('caps persisted duration at the mock exam time limit', () => {
    const attempt = createMockExamAttempt({
      questions: [mockQuestion(1)],
      selectedChoiceIndexesByQuestionId: new Map([['java-q-01:0', 0]]),
      startedAt: '2026-06-08T08:00:00.000Z',
      completedAt: '2026-06-08T11:00:00.000Z'
    });

    assert.equal(attempt.durationMs, mockExamDurationMs);
  });
});

function lesson(
  id: string,
  title: string,
  completionChecks: Lesson['completionChecks'],
  overrides: Partial<Lesson> = {}
): Lesson {
  return {
    schemaVersion: 1,
    id,
    version: 1,
    title,
    description: title,
    language: 'java',
    difficulty: 1,
    estimatedSeconds: 30,
    tags: ['java'],
    prerequisites: [],
    completionChecks,
    targetCode: 'class Demo {\n  void run() {}\n}',
    ...overrides
  };
}

function mockQuestion(index: number, check: LessonCompletionCheck = {
  prompt: `Question ${index}?`,
  choices: ['A', 'B'],
  answerIndex: 0,
  explanation: `Question ${index} explanation.`
}, objectiveId = 'values'): ReturnType<typeof collectMockExamQuestions>[number] {
  const objective = javaSe25ExamBlueprint.objectives.find((candidate) => candidate.id === objectiveId)!;
  const prefix = objectiveId === 'values' ? 'java-q' : `java-${objectiveId}-q`;
  return {
    id: `${prefix}-${index.toString().padStart(2, '0')}:0`,
    lessonId: `${prefix}-${index.toString().padStart(2, '0')}`,
    lessonTitle: `Question ${index}`,
    checkIndex: 0,
    objectiveId: objective.id,
    objectiveLabel: objective.label,
    check
  };
}

function sequenceRandom(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0;
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
