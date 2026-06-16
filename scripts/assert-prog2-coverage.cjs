const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const lessonRoot = path.resolve(process.argv[2] ?? path.join(repoRoot, 'prog2-lessons'));
const expectedReferenceLessonCount = 36;
const expectedReferenceIds = [
  'prog2-b1-reference-arrays-loops-435',
  'prog2-b1-reference-class-object-constructor-421',
  'prog2-b1-reference-composition-design-427',
  'prog2-b1-reference-equals-hashcode-compareto-428',
  'prog2-b1-reference-exceptions-433',
  'prog2-b1-reference-inheritance-polymorphism-425',
  'prog2-b1-reference-interfaces-contracts-426',
  'prog2-b1-reference-methods-parameters-424',
  'prog2-b1-reference-records-enums-439',
  'prog2-b1-reference-references-values-null-423',
  'prog2-b1-reference-string-text-434',
  'prog2-b1-reference-visibility-final-static-422',
  'prog2-b2-reference-collections-concepts-429',
  'prog2-b2-reference-generics-432',
  'prog2-b2-reference-io-path-files-436',
  'prog2-b2-reference-lambdas-functional-interfaces-437',
  'prog2-b2-reference-map-api-430',
  'prog2-b2-reference-sorting-searching-431',
  'prog2-b2-reference-streams-438',
  'prog2-ref-p2-collection-interface-701',
  'prog2-ref-p2-collections-arrays-706',
  'prog2-ref-p2-collectors-recipes-709',
  'prog2-ref-p2-comparator-order-707',
  'prog2-ref-p2-javafx-controls-714',
  'prog2-ref-p2-javafx-dialog-files-css-717',
  'prog2-ref-p2-javafx-events-properties-715',
  'prog2-ref-p2-javafx-layout-data-711',
  'prog2-ref-p2-javafx-layout-pane-713',
  'prog2-ref-p2-javafx-lists-tables-716',
  'prog2-ref-p2-javafx-program-structure-712',
  'prog2-ref-p2-javafx-structure-710',
  'prog2-ref-p2-list-api-702',
  'prog2-ref-p2-map-overview-704',
  'prog2-ref-p2-queue-deque-priorityqueue-705',
  'prog2-ref-p2-set-uniqueness-703',
  'prog2-ref-p2-streams-api-708'
].sort();
const expectedReferenceIdSet = new Set(expectedReferenceIds);
const bannedPatterns = [
  /Liang/i,
  /Z-Library/i,
  /03_Literature/i,
  /04_Exams/i,
  /06_Exercises/i,
  /\bUppgift\b/i,
  /\bMario\b/i,
  /\bassets?\b/i,
  /Prog2 exam tasks/i
];
const riskyTags = new Set([
  'book-exercise',
  'exam-practice',
  'exam-reference',
  'exam-style-practice'
]);

module.exports = {
  assertProg2Coverage,
  normalizeSourceFingerprint,
  readLessons
};

if (require.main === module) {
  try {
    const lessons = readLessons(lessonRoot);
    const errors = assertProg2Coverage(lessons);

    if (errors.length > 0) {
      process.stderr.write(`${errors.join('\n')}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write('Prog2 coverage assertion passed for 36 Prog2 reference lessons.\n');
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

function assertProg2Coverage(lessons) {
  const errors = [];
  const allIds = lessons.map((lesson) => String(lesson.id ?? ''));
  const duplicateIds = findDuplicates(allIds);
  const prog2Lessons = lessons.filter((lesson) => String(lesson.id ?? '').startsWith('prog2-'));
  const prog2Ids = prog2Lessons.map((lesson) => String(lesson.id)).sort();
  const allLessonIds = new Set(allIds);

  if (lessons.length !== expectedReferenceLessonCount) {
    errors.push(`expected exactly 36 Prog2 reference lessons, got ${lessons.length}`);
  }

  if (duplicateIds.length > 0) {
    errors.push(`duplicate lesson ids: ${duplicateIds.join(', ')}`);
  }

  for (const lesson of lessons) {
    if (lesson.language !== 'java') {
      errors.push(`non-Java lesson in Prog2 package tree: ${lesson.id ?? '(missing id)'}`);
    }
  }

  if (prog2Lessons.length !== expectedReferenceIds.length) {
    errors.push(`expected exactly 36 Prog2 reference lessons, got ${prog2Lessons.length}`);
  }

  for (const id of expectedReferenceIds) {
    if (!prog2Ids.includes(id)) {
      errors.push(`missing Prog2 reference lesson: ${id}`);
    }
  }

  for (const id of prog2Ids) {
    if (!expectedReferenceIdSet.has(id)) {
      errors.push(`unexpected Prog2 lesson in reference-only package: ${id}`);
    }
  }

  for (const lesson of prog2Lessons) {
    errors.push(...findReferenceLessonErrors(lesson, allLessonIds));
  }

  return errors;
}

function findReferenceLessonErrors(lesson, allLessonIds) {
  const errors = [];
  const id = String(lesson.id ?? '(missing id)');
  const tags = Array.isArray(lesson.tags) ? lesson.tags : [];
  const prerequisites = Array.isArray(lesson.prerequisites) ? lesson.prerequisites : [];
  const searchable = [
    id,
    lesson.title,
    lesson.description,
    ...(Array.isArray(lesson.learningGoals) ? lesson.learningGoals : []),
    lesson.targetCode
  ].join('\n');

  if (lesson.language !== 'java') {
    errors.push(`reference lesson must use language java: ${id}`);
  }

  for (const requiredTag of ['java', 'prog2', 'source-file']) {
    if (!tags.includes(requiredTag)) {
      errors.push(`reference lesson missing ${requiredTag} tag: ${id}`);
    }
  }

  for (const tag of tags) {
    if (riskyTags.has(tag)) {
      errors.push(`reference lesson uses removed corpus tag ${tag}: ${id}`);
    }
  }

  for (const prerequisite of prerequisites) {
    if (!allLessonIds.has(prerequisite)) {
      errors.push(`missing prerequisite ${prerequisite} for ${id}`);
    }
    if (!expectedReferenceIdSet.has(prerequisite)) {
      errors.push(`reference lesson depends on non-reference prerequisite ${prerequisite}: ${id}`);
    }
  }

  for (const pattern of bannedPatterns) {
    if (pattern.test(searchable)) {
      errors.push(`reference lesson contains removed source/provenance term ${pattern}: ${id}`);
    }
  }

  return errors;
}

function normalizeSourceFingerprint(source) {
  return String(source ?? '')
    .replace(/\/\/.*$/gm, '')
    .replace(/'[^'\n\\]*(?:\\.[^'\n\\]*)*'/g, "'_'")
    .replace(/"[^"\n\\]*(?:\\.[^"\n\\]*)*"/g, '"_"')
    .replace(/\b\d+(?:\.\d+)?\b/g, '0')
    .replace(/\s+/g, ' ')
    .trim();
}

function readLessons(directory) {
  if (!fs.existsSync(directory)) {
    throw new Error(`Prog2 lesson directory not found: ${directory}`);
  }

  return listJsonFiles(directory)
    .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
}

function listJsonFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('_')) {
        files.push(...listJsonFiles(fullPath));
      }
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }

    seen.add(value);
  }

  return [...duplicates].sort();
}
