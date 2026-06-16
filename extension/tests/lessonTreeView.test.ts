import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createLessonTreeGroups, formatLessonTreeDescription, formatLessonTreeTooltip } from '../src/ui/lessonTreeModel';
import type { Lesson } from '../src/lessons/schema';

describe('lesson tree model', () => {
  it('groups built-in lessons into ordered curriculum categories', () => {
    const groups = createLessonTreeGroups([
      lesson({ id: 'java-http3-client-70', title: 'HTTP/3 Client' }),
      lesson({ id: 'java-class-basic-01', title: 'Class Basics' }),
      lesson({ id: 'prog2-ref-p2-list-api-702', title: 'List API', tags: ['java', 'prog2', 'source-file'] }),
      lesson({ id: 'java-stream-lazy-pipeline-80', title: 'Stream Lazy Pipelines' }),
      lesson({ id: 'java-instance-main-50', title: 'Instance Main' }),
      lesson({ id: 'java-records-45', title: 'Records' })
    ]);

    assert.deepEqual(groups.map((group) => [group.id, group.label, group.lessonIds]), [
      ['java-foundations', 'Foundations', ['java-class-basic-01', 'java-records-45']],
      ['java-25-cert-exam', 'Java 25 Cert Exam', ['java-instance-main-50', 'java-stream-lazy-pipeline-80']],
      ['java-26', 'Java 26', ['java-http3-client-70']],
      ['prog2-references', 'Prog2 References', ['prog2-ref-p2-list-api-702']]
    ]);
  });

  it('formats progress-rich lesson descriptions', () => {
    assert.equal(formatLessonTreeDescription({
      state: 'completed',
      detail: 'Completed',
      bestWpm: 78,
      completionCount: 3,
      suggestedAfterTitles: []
    }), 'Best 78 WPM | Completed ×3');

    assert.equal(formatLessonTreeDescription({
      state: 'not-started',
      detail: 'Not started',
      bestWpm: undefined,
      completionCount: 0,
      suggestedAfterTitles: ['Functions']
    }), 'Suggested after: Functions');

    assert.equal(formatLessonTreeDescription({
      state: 'not-started',
      detail: 'Not started',
      bestWpm: undefined,
      completionCount: 0,
      suggestedAfterTitles: []
    }), 'Not started');
  });

  it('formats personal-best error rate and due recall reviews', () => {
    assert.equal(formatLessonTreeDescription({
      state: 'completed',
      detail: 'Completed',
      bestWpm: 62,
      bestErrorRatePercent: 1.6,
      dueReviewCount: 3,
      completionCount: 2,
      suggestedAfterTitles: []
    }), 'Best 62 WPM (1.6% err) | Recall due 3 | Completed ×2');
  });

  it('formats prerequisite suggestions in lesson tooltips', () => {
    assert.equal(formatLessonTreeTooltip(lesson({
      id: 'java-interface-04',
      title: 'Interfaces',
      description: 'Practice Java interfaces.',
      prerequisites: ['java-method-return-02']
    }), {
      state: 'not-started',
      detail: 'Not started',
      completionCount: 0,
      suggestedAfterTitles: ['Methods']
    }), 'Practice Java interfaces.\n\nSuggested after: Methods');

    assert.equal(formatLessonTreeTooltip(lesson({
      id: 'java-advanced-09',
      title: 'Advanced',
      description: 'Practice advanced Java.',
      prerequisites: ['java-class-basic-01', 'java-exceptions-try-catch-06']
    }), {
      state: 'not-started',
      detail: 'Not started',
      completionCount: 0,
      suggestedAfterTitles: ['Methods -> Interfaces -> Classes', 'Exceptions']
    }), 'Practice advanced Java.\n\nSuggested after: Methods -> Interfaces -> Classes, Exceptions');
  });

  it('omits the suggestion hint once a lesson has been completed', () => {
    assert.equal(formatLessonTreeTooltip(lesson({
      id: 'java-interface-04',
      title: 'Interfaces',
      description: 'Practice Java interfaces.',
      prerequisites: ['java-method-return-02']
    }), {
      state: 'completed',
      detail: 'Completed',
      bestWpm: 60,
      completionCount: 2,
      suggestedAfterTitles: ['Methods']
    }), 'Practice Java interfaces.');
  });

  it('surfaces learning goals in lesson tree tooltips', () => {
    assert.equal(formatLessonTreeTooltip(lesson({
      id: 'java-generics-method-14',
      title: 'Generics',
      description: 'Practice Java generics.',
      learningGoals: [
        'Use type parameters in a function signature.',
        'Return the same type that came in.'
      ]
    }), {
      state: 'not-started',
      detail: 'Not started',
      completionCount: 0,
      suggestedAfterTitles: []
    }), 'Practice Java generics.\n\nGoals: Use type parameters in a function signature.; Return the same type that came in.');
  });
});

function lesson(overrides: Partial<Lesson>): Lesson {
  return {
    schemaVersion: 1,
    id: 'java-class-basic-01',
    version: 1,
    title: 'Class Basics',
    description: 'Practice Java.',
    language: 'java',
    difficulty: 1,
    estimatedSeconds: 30,
    tags: ['java'],
    prerequisites: [],
    targetCode: 'class Demo {\n}\n',
    ...overrides
  };
}
