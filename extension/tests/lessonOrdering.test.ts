import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { compareBuiltInLessons, getBuiltInLessonCategory } from '../src/lessons/lessonOrdering';
import type { Lesson } from '../src/lessons/schema';

describe('built-in lesson ordering', () => {
  it('orders direct prerequisites before dependents even when the prerequisite has a later numeric suffix', () => {
    const sorted = [
      lesson('java-string-methods-23', ['java-primitives-types-21', 'java-if-else-22']),
      lesson('java-if-else-22', ['java-primitives-types-21']),
      lesson('java-primitives-types-21')
    ].sort(compareBuiltInLessons);

    assert.deepEqual(sorted.map((item) => item.id), [
      'java-primitives-types-21',
      'java-if-else-22',
      'java-string-methods-23'
    ]);
  });

  it('categorizes built-in lessons by public curriculum boundary', () => {
    assert.deepEqual(getBuiltInLessonCategory(lesson('java-records-45')), {
      key: 'java-foundations',
      label: 'Foundations',
      icon: 'book',
      order: 0
    });
    assert.deepEqual(getBuiltInLessonCategory(lesson('java-instance-main-50')), {
      key: 'java-25-cert-exam',
      label: 'Java 25 Cert Exam',
      icon: 'mortar-board',
      order: 1
    });
    assert.deepEqual(getBuiltInLessonCategory(lesson('java-stream-gatherers-67')), {
      key: 'java-25-cert-exam',
      label: 'Java 25 Cert Exam',
      icon: 'mortar-board',
      order: 1
    });
    assert.deepEqual(getBuiltInLessonCategory(lesson('java-http3-client-70')), {
      key: 'java-26',
      label: 'Java 26',
      icon: 'beaker',
      order: 2
    });
    assert.deepEqual(getBuiltInLessonCategory(lesson('prog2-ref-p2-list-api-702')), {
      key: 'prog2-references',
      label: 'Prog2 References',
      icon: 'references',
      order: 90
    });
    assert.deepEqual(getBuiltInLessonCategory(lesson('c-hello-main-01')), {
      key: 'c-foundations',
      label: 'C Foundations',
      icon: 'chip',
      order: 10
    });
    assert.deepEqual(getBuiltInLessonCategory(lesson('c-pointers-addresses-80')), {
      key: 'c-advanced',
      label: 'C Advanced',
      icon: 'tools',
      order: 12
    });
    assert.deepEqual(getBuiltInLessonCategory(lesson('python-print-input-01')), {
      key: 'python-pcep',
      label: 'Python PCEP',
      icon: 'book',
      order: 30
    });
    assert.deepEqual(getBuiltInLessonCategory(lesson('python-oop-class-methods-51')), {
      key: 'python-pcap',
      label: 'Python PCAP',
      icon: 'mortar-board',
      order: 31
    });
    assert.deepEqual(getBuiltInLessonCategory(lesson('python-decorators-context-managers-81')), {
      key: 'python-pcpp1',
      label: 'Python PCPP1',
      icon: 'mortar-board',
      order: 32
    });
  });

  it('keeps the Java 26 band bounded so the cert-exam band can grow past its filled 50-69 ids', () => {
    assert.equal(getBuiltInLessonCategory(lesson('java-future-preview-79')).key, 'java-26');
    assert.equal(getBuiltInLessonCategory(lesson('java-stream-lazy-pipeline-80')).key, 'java-25-cert-exam');
    assert.equal(getBuiltInLessonCategory(lesson('java-mutable-hash-keys-83')).key, 'java-25-cert-exam');
    assert.equal(getBuiltInLessonCategory(lesson('java-far-future-drill-102')).key, 'java-25-cert-exam');
  });

  it('orders the catalogue by curriculum category so cert-exam growth ids precede the Java 26 band', () => {
    const sorted = [
      lesson('python-print-input-01'),
      lesson('java-http3-client-70'),
      lesson('c-hello-main-01'),
      lesson('java-stream-lazy-pipeline-80'),
      lesson('java-records-45'),
      lesson('java-optional-lazy-fallback-69'),
      lesson('prog2-ref-p2-list-api-702')
    ].sort(compareBuiltInLessons);

    assert.deepEqual(sorted.map((item) => item.id), [
      'java-records-45',
      'java-optional-lazy-fallback-69',
      'java-stream-lazy-pipeline-80',
      'java-http3-client-70',
      'c-hello-main-01',
      'python-print-input-01',
      'prog2-ref-p2-list-api-702'
    ]);
  });
});

function lesson(id: string, prerequisites: string[] = []): Lesson {
  const language = id.startsWith('c-') ? 'c' : id.startsWith('python-') ? 'python' : 'java';

  return {
    schemaVersion: 1,
    id,
    version: 1,
    title: id,
    description: id,
    language,
    difficulty: 1,
    estimatedSeconds: 30,
    tags: [language],
    prerequisites,
    targetCode: 'class Demo {\n}\n'
  };
}
