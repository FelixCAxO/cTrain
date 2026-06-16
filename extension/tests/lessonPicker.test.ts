import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createPickerItems, formatLanguageLabel, formatLessonPickerTitle } from '../src/ui/lessonPicker';
import type { Lesson, LessonListItem } from '../src/lessons/schema';
import type { LessonStatusSummary } from '../src/progress/progressStore';

describe('lesson picker formatting', () => {
  it('surfaces best WPM, completion counts, and suggested prerequisites in picker rows', () => {
    const items = createPickerItems([
      item(lesson({ id: 'java-method-return-02', title: 'Methods', tags: ['methods'] })),
      item(lesson({
        id: 'java-interface-04',
        title: 'Interfaces',
        difficulty: 4,
        prerequisites: ['java-method-return-02'],
        tags: ['interfaces']
      }))
    ], new Map<string, LessonStatusSummary>([
      ['java-method-return-02', {
        state: 'completed',
        detail: 'Completed',
        bestWpm: 72,
        bestErrorRatePercent: 1.4,
        completionCount: 3,
        dueReviewCount: 2,
        suggestedAfterTitles: []
      }],
      ['java-interface-04', {
        state: 'not-started',
        detail: 'Not started',
        bestWpm: undefined,
        completionCount: 0,
        suggestedAfterTitles: ['Methods']
      }]
    ]));

    const completed = items.find((candidate) => candidate.lessonId === 'java-method-return-02');
    const suggested = items.find((candidate) => candidate.lessonId === 'java-interface-04');

    assert.match(completed?.label ?? '', /Methods ×3/);
    assert.match(completed?.label ?? '', /\$\(check\)/);
    assert.match(completed?.description ?? '', /Best 72 WPM \(1\.4% err\)/);
    assert.match(completed?.description ?? '', /Recall due 2/);
    assert.match(completed?.description ?? '', /Completed ×3/);
    assert.doesNotMatch(suggested?.label ?? '', /\$\(lock\)/);
    assert.match(suggested?.detail ?? '', /Suggested after: Methods/);
  });

  it('summarizes sprint progress in the picker title', () => {
    assert.equal(
      formatLessonPickerTitle(12, 74, 5, {
        totalMinutes: 255,
        targetMinutes: 900,
        practiceDays: 3,
        sprintDays: 12,
        minutesRemaining: 645,
        metDailyStreak: false,
        metMinuteTarget: false
      }),
      'cTrain: Start Lesson (12 of 74 completed, 5-day streak, sprint 255/900 min, 3/12 days)'
    );
  });

  it('adds compact language icons to lesson groups and rows', () => {
    assert.equal(formatLanguageLabel('java'), '$(symbol-class) Java');
    assert.equal(formatLanguageLabel('cpp'), '$(symbol-namespace) C++');
    assert.equal(formatLanguageLabel('typescript'), '$(symbol-method) TypeScript');
    assert.equal(formatLanguageLabel('python'), '$(symbol-misc) Python');
  });

  it('groups built-in Java lessons by curriculum category with counts', () => {
    const items = createPickerItems([
      item(lesson({ id: 'java-class-basic-01', title: 'Class Basics' })),
      item(lesson({ id: 'java-method-return-02', title: 'Method Return' })),
      item(lesson({ id: 'java-instance-main-50', title: 'Instance Main' })),
      item(lesson({ id: 'java-http3-client-70', title: 'HTTP/3 Client' }))
    ], new Map());

    assert.deepEqual(items.filter((candidate) => candidate.kind === -1).map((candidate) => candidate.label), [
      'Foundations (2)',
      'Java 25 Cert Exam (1)',
      'Java 26 (1)'
    ]);
    assert.deepEqual(items.filter((candidate) => candidate.lessonId !== undefined).map((candidate) => candidate.lessonId), [
      'java-class-basic-01',
      'java-method-return-02',
      'java-instance-main-50',
      'java-http3-client-70'
    ]);
  });

  it('makes the Java 25 cert category searchable from lesson rows', () => {
    const items = createPickerItems([
      item(lesson({ id: 'java-instance-main-50', title: 'Instance Main' }))
    ], new Map());

    const certLesson = items.find((candidate) => candidate.lessonId === 'java-instance-main-50');

    assert.match(certLesson?.detail ?? '', /Category: Java 25 Cert Exam/);
  });

  it('surfaces learning goals in picker detail text', () => {
    const items = createPickerItems([
      item(lesson({
        id: 'java-generics-method-14',
        title: 'Generics',
        description: 'Practice Java generic methods.',
        language: 'java',
        learningGoals: [
          'Use type parameters in a function signature.',
          'Return the same type that came in.'
        ]
      }))
    ], new Map());

    const generics = items.find((candidate) => candidate.lessonId === 'java-generics-method-14');

    assert.match(generics?.detail ?? '', /Practice Java generic methods\./);
    assert.match(generics?.detail ?? '', /Goals: Use type parameters in a function signature.; Return the same type that came in\./);
  });

  it('surfaces lesson tags so Prog2 reference groups are searchable', () => {
    const items = createPickerItems([
      item(lesson({
        id: 'prog2-ref-p2-list-api-702',
        title: 'List API - Reference Page 2',
        language: 'java',
        description: 'Use this Java reference to review List API through compact practice examples.',
        tags: ['java', 'prog2', 'b2', 'source-file', 'collections']
      }))
    ], new Map());

    const referenceLesson = items.find((candidate) => candidate.lessonId === 'prog2-ref-p2-list-api-702');

    assert.match(referenceLesson?.detail ?? '', /Tags: prog2, b2, source-file, collections/);
  });
});

function item(value: Lesson): LessonListItem {
  return { lesson: value, source: 'built-in' };
}

function lesson(overrides: Partial<Lesson>): Lesson {
  return {
    schemaVersion: 1,
    id: 'java-method-return-02',
    version: 1,
    title: 'Methods',
    description: 'Practice Java.',
    language: 'java',
    difficulty: 1,
    estimatedSeconds: 30,
    tags: ['java'],
    prerequisites: [],
    targetCode: 'int value = 1;\nSystem.out.println(value);\n',
    ...overrides
  };
}
