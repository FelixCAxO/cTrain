import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createLessonCatalogue } from '../src/lessons/lessonCatalogue';
import type { Lesson } from '../src/lessons/schema';

describe('lesson catalogue', () => {
  it('sorts lessons into the stable catalogue order without mutating the caller list', () => {
    const lessons = [
      lesson('java-arrays-init-25'),
      lesson('prog2-ref-p2-list-api-702', ['java', 'prog2', 'source-file']),
      lesson('java-class-basic-01'),
      lesson('java-string-methods-23')
    ];

    const catalogue = createLessonCatalogue(lessons);

    assert.deepEqual(catalogue.lessonIds, [
      'java-class-basic-01',
      'java-string-methods-23',
      'java-arrays-init-25',
      'prog2-ref-p2-list-api-702'
    ]);
    assert.deepEqual(lessons.map((item) => item.id), [
      'java-arrays-init-25',
      'prog2-ref-p2-list-api-702',
      'java-class-basic-01',
      'java-string-methods-23'
    ]);
  });

  it('starts from any catalogue lesson and advances one item at a time', () => {
    const catalogue = createLessonCatalogue([
      lesson('java-arrays-init-25'),
      lesson('java-primitives-types-21'),
      lesson('java-string-methods-23', ['java'], ['java-if-else-22']),
      lesson('java-if-else-22')
    ]);

    assert.deepEqual(catalogue.lessonsFrom('java-primitives-types-21').map((item) => item.id), [
      'java-primitives-types-21',
      'java-if-else-22',
      'java-string-methods-23',
      'java-arrays-init-25'
    ]);
    assert.equal(catalogue.nextAfter('java-primitives-types-21')?.id, 'java-if-else-22');
    assert.equal(catalogue.nextAfter('java-arrays-init-25'), undefined);
    assert.deepEqual(catalogue.lessonsFrom('missing-lesson'), []);
  });
});

function lesson(
  id: string,
  tags = ['java'],
  prerequisites: string[] = []
): Lesson {
  return {
    schemaVersion: 1,
    id,
    version: 1,
    title: id,
    description: id,
    language: 'java',
    difficulty: 1,
    estimatedSeconds: 30,
    tags,
    prerequisites,
    targetCode: 'class Demo {\n}\n'
  };
}
