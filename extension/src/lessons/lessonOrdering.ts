import type { Lesson, LessonListItem } from './schema';

export function compareBuiltInLessons(left: Lesson, right: Lesson): number {
  const categoryOrder = compareCategoryOrder(left, right);
  if (categoryOrder !== 0) {
    return categoryOrder;
  }

  const prerequisiteOrder = compareDirectPrerequisiteOrder(left, right);
  if (prerequisiteOrder !== 0) {
    return prerequisiteOrder;
  }

  const sequenceOrder = getBuiltInLessonSequence(left.id) - getBuiltInLessonSequence(right.id);
  if (sequenceOrder !== 0) {
    return sequenceOrder;
  }

  return left.id.localeCompare(right.id);
}

export function compareBuiltInLessonItems(left: LessonListItem, right: LessonListItem): number {
  if (left.source !== 'built-in' || right.source !== 'built-in') {
    return 0;
  }

  return compareBuiltInLessons(left.lesson, right.lesson);
}

// Catalogue order follows the curriculum categories shown in the picker and tree, so
// "Next Lesson" walks Foundations, then the whole Java 25 Cert Exam band (including its
// 80+ growth ids), and reaches the Java 26 demos last.
function compareCategoryOrder(left: Lesson, right: Lesson): number {
  return getBuiltInLessonCategory(left).order - getBuiltInLessonCategory(right).order;
}

function compareDirectPrerequisiteOrder(left: Lesson, right: Lesson): number {
  if (left.prerequisites.includes(right.id)) {
    return 1;
  }

  if (right.prerequisites.includes(left.id)) {
    return -1;
  }

  return 0;
}

function getBuiltInLessonSequence(id: string): number {
  const match = id.match(/-(\d{2,})$/);
  return match === null ? Number.MAX_SAFE_INTEGER : Number.parseInt(match[1]!, 10);
}

export interface BuiltInLessonCategory {
  key: string;
  label: string;
  icon: string;
  order: number;
}

export function getBuiltInLessonCategory(lesson: Lesson): BuiltInLessonCategory {
  if (lesson.id.startsWith('c-')) {
    return getCLessonCategory(lesson);
  }

  if (lesson.id.startsWith('java-')) {
    return getJavaLessonCategory(lesson);
  }

  if (lesson.id.startsWith('python-')) {
    return getPythonLessonCategory(lesson);
  }

  if (lesson.id.startsWith('prog2-')) {
    return { key: 'prog2-references', label: 'Prog2 References', icon: 'references', order: 90 };
  }

  return { key: lesson.language, label: lesson.language, icon: 'symbol-namespace', order: 99 };
}

function getJavaLessonCategory(lesson: Lesson): BuiltInLessonCategory {
  const sequence = getBuiltInLessonSequence(lesson.id);
  if (sequence >= 70 && sequence <= 79) {
    return { key: 'java-26', label: 'Java 26', icon: 'beaker', order: 2 };
  }
  if (sequence >= 50) {
    return { key: 'java-25-cert-exam', label: 'Java 25 Cert Exam', icon: 'mortar-board', order: 1 };
  }
  return { key: 'java-foundations', label: 'Foundations', icon: 'book', order: 0 };
}

function getCLessonCategory(lesson: Lesson): BuiltInLessonCategory {
  const sequence = getBuiltInLessonSequence(lesson.id);
  if (sequence >= 80) {
    return { key: 'c-advanced', label: 'C Advanced', icon: 'tools', order: 12 };
  }
  if (sequence >= 50) {
    return { key: 'c-systems', label: 'C Systems Practice', icon: 'gear', order: 11 };
  }
  return { key: 'c-foundations', label: 'C Foundations', icon: 'chip', order: 10 };
}

function getPythonLessonCategory(lesson: Lesson): BuiltInLessonCategory {
  const sequence = getBuiltInLessonSequence(lesson.id);
  if (sequence >= 80) {
    return { key: 'python-pcpp1', label: 'Python PCPP1', icon: 'mortar-board', order: 32 };
  }
  if (sequence >= 50) {
    return { key: 'python-pcap', label: 'Python PCAP', icon: 'mortar-board', order: 31 };
  }
  return { key: 'python-pcep', label: 'Python PCEP', icon: 'book', order: 30 };
}
