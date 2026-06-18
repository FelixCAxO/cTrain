import type { Lesson, LessonLanguage } from './schema';

export interface ValidationError {
  path: string;
  got: unknown;
  expected: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; lesson: Lesson; errors: [] }
  | { ok: false; errors: ValidationError[] };

export const lessonLanguages = ['java'] as const;
export const lessonIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{2,}$/;
export const lessonLanguageVersionsByLanguage: Record<string, readonly string[]> = {
  java: ['Java 8', 'Java 9', 'Java 11', 'Java 14', 'Java 15', 'Java 16', 'Java 17', 'Java 21', 'Java 22', 'Java 23', 'Java 24', 'Java 25', 'Java 26']
};
export const lessonTags = [
  'abstract',
  'aot',
  'applets',
  'arrays',
  'automatic-modules',
  'b1',
  'b2',
  'b3',
  'classes',
  'collections',
  'collectors',
  'concurrency',
  'conditionals',
  'constructors',
  'dates',
  'deque',
  'encapsulation',
  'enum-members',
  'enums',
  'errors',
  'events',
  'exceptions',
  'executors',
  'file-chooser',
  'final-fields',
  'files',
  'filtering',
  'focus',
  'formatting',
  'functional-interfaces',
  'functions',
  'g1',
  'gc',
  'generics',
  'http-client',
  'if-else',
  'imports',
  'inheritance',
  'interface-methods',
  'interfaces',
  'io',
  'iterators',
  'jars',
  'java',
  'javafx',
  'jlink',
  'lambda',
  'lambdas',
  'lazy-constants',
  'list-view',
  'literals',
  'localization',
  'loops',
  'map',
  'maps',
  'math',
  'methods',
  'modules',
  'multicatch',
  'networking',
  'numeric-casting',
  'object-contracts',
  'observable-list',
  'optional',
  'pattern-matching',
  'partitioning',
  'preview',
  'primitives',
  'prog2',
  'properties',
  'records',
  'references',
  'resources',
  'scoped-values',
  'sealed',
  'search',
  'security',
  'sequenced-collections',
  'serialization',
  'sets',
  'sort',
  'sorting',
  'source-file',
  'stable-values',
  'static',
  'streams',
  'strings',
  'structured-concurrency',
  'switch',
  'table-view',
  'testing',
  'text-blocks',
  'threads',
  'time',
  'unnamed-modules',
  'unnamed-variables',
  'validation',
  'var',
  'varargs',
  'variables',
  'vector-api',
  'virtual-threads',
  'workspace'
] as const;

const languages = new Set<LessonLanguage>(lessonLanguages);
const tags = new Set<string>(lessonTags);
const lessonFields = new Set([
  '$schema',
  'schemaVersion',
  'id',
  'version',
  'title',
  'description',
  'language',
  'difficulty',
  'estimatedSeconds',
  'tags',
  'prerequisites',
  'learningGoals',
  'defects',
  'completionChecks',
  'languageVersion',
  'targetCode'
]);

export function validateLesson(value: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const record = isRecord(value) ? value : {};

  expectKnownProperties(record, lessonFields, '', errors);
  expectOptionalString(record, '$schema', errors);
  expectExact(record, 'schemaVersion', 1, errors);
  expectId(record.id, errors);
  expectPositiveInteger(record, 'version', errors);
  expectNonEmptyString(record, 'title', errors);
  expectNonEmptyString(record, 'description', errors);
  expectLanguage(record.language, errors);
  expectDifficulty(record.difficulty, errors);
  expectEstimatedSeconds(record, errors);
  expectStringArray(record.tags, 'tags', errors);
  expectKnownTags(record.tags, errors);
  expectStringArray(record.prerequisites, 'prerequisites', errors);
  expectOptionalStringArray(record.learningGoals, 'learningGoals', errors);
  expectOptionalDefects(record.defects, errors);
  expectOptionalCompletionChecks(record.completionChecks, errors);
  expectOptionalLanguageVersion(record, errors);
  expectNonEmptyString(record, 'targetCode', errors);
  expectTargetCodeLineCount(record, errors);
  expectIdMatchesLanguage(record, errors);
  expectAdvancedMetadata(record, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, lesson: record as unknown as Lesson, errors: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addError(errors: ValidationError[], path: string, got: unknown, expected: string): void {
  errors.push({
    path,
    got,
    expected,
    message: `${path} expected ${expected}`
  });
}

function expectExact(
  record: Record<string, unknown>,
  key: string,
  expectedValue: unknown,
  errors: ValidationError[]
): void {
  if (record[key] !== expectedValue) {
    addError(errors, key, record[key], JSON.stringify(expectedValue));
  }
}

function expectId(value: unknown, errors: ValidationError[]): void {
  if (typeof value !== 'string' || !lessonIdPattern.test(value)) {
    addError(errors, 'id', value, 'stable kebab-case id ending in a numeric sequence of at least two digits');
  }
}

function expectKnownProperties(
  record: Record<string, unknown>,
  allowedFields: Set<string>,
  prefix: string,
  errors: ValidationError[]
): void {
  for (const key of Object.keys(record)) {
    if (!allowedFields.has(key)) {
      addError(errors, prefix.length > 0 ? `${prefix}.${key}` : key, record[key], 'known lesson field');
    }
  }
}

function expectNonEmptyString(
  record: Record<string, unknown>,
  key: string,
  errors: ValidationError[]
): void {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    addError(errors, key, value, 'non-empty string');
  }
}

function expectPositiveInteger(
  record: Record<string, unknown>,
  key: string,
  errors: ValidationError[]
): void {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < 1) {
    addError(errors, key, value, 'positive integer');
  }
}

function expectEstimatedSeconds(record: Record<string, unknown>, errors: ValidationError[]): void {
  const value = record.estimatedSeconds;
  if (!Number.isInteger(value) || (value as number) < 10 || (value as number) > 1_800) {
    addError(errors, 'estimatedSeconds', value, 'integer from 10 to 1800');
    return;
  }

  if (typeof record.targetCode !== 'string' || isSourceFileLesson(record)) {
    return;
  }

  if (countTypeableTargetCharacters(record.targetCode) > 300 && (value as number) < 180) {
    addError(errors, 'estimatedSeconds', value, 'at least 180 seconds for snippets over 300 characters');
  }
}

function expectLanguage(value: unknown, errors: ValidationError[]): void {
  if (typeof value !== 'string' || !languages.has(value as LessonLanguage)) {
    addError(errors, 'language', value, 'java');
  }
}

function expectDifficulty(value: unknown, errors: ValidationError[]): void {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5) {
    addError(errors, 'difficulty', value, 'integer from 1 to 5');
  }
}

function expectStringArray(value: unknown, path: string, errors: ValidationError[]): void {
  if (!Array.isArray(value)) {
    addError(errors, path, value, 'array of strings');
    return;
  }

  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      addError(errors, `${path}[${index}]`, item, 'non-empty string');
    }
  });
}

function expectKnownTags(value: unknown, errors: ValidationError[]): void {
  if (!Array.isArray(value)) {
    return;
  }

  value.forEach((item, index) => {
    if (typeof item === 'string' && item.trim().length > 0 && !tags.has(item)) {
      addError(errors, `tags[${index}]`, item, 'known lesson tag');
    }
  });
}

function expectOptionalStringArray(value: unknown, path: string, errors: ValidationError[]): void {
  if (value === undefined) {
    return;
  }

  expectStringArray(value, path, errors);
}

function expectOptionalDefects(value: unknown, errors: ValidationError[]): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    addError(errors, 'defects', value, 'array of defect hint objects');
    return;
  }

  value.forEach((item, index) => {
    const path = `defects[${index}]`;
    if (!isRecord(item)) {
      addError(errors, path, item, 'defect hint object');
      return;
    }

    expectKnownProperties(item, new Set(['line', 'hint']), path, errors);

    if (!Number.isInteger(item.line) || (item.line as number) < 1) {
      addError(errors, `${path}.line`, item.line, 'one-based positive integer line number');
    }

    if (typeof item.hint !== 'string' || item.hint.trim().length === 0) {
      addError(errors, `${path}.hint`, item.hint, 'non-empty string');
    }
  });
}

function expectOptionalCompletionChecks(value: unknown, errors: ValidationError[]): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    addError(errors, 'completionChecks', value, 'array of completion check objects');
    return;
  }

  value.forEach((item, index) => {
    const path = `completionChecks[${index}]`;
    if (!isRecord(item)) {
      addError(errors, path, item, 'completion check object');
      return;
    }

    expectKnownProperties(item, new Set(['prompt', 'choices', 'answerIndex', 'explanation']), path, errors);

    if (typeof item.prompt !== 'string' || item.prompt.trim().length === 0) {
      addError(errors, `${path}.prompt`, item.prompt, 'non-empty string');
    }

    expectCompletionChoices(item.choices, `${path}.choices`, errors);

    if (!Number.isInteger(item.answerIndex) || !isAnswerIndexInRange(item.answerIndex, item.choices)) {
      addError(errors, `${path}.answerIndex`, item.answerIndex, 'zero-based index into choices');
    }

    if (typeof item.explanation !== 'string' || item.explanation.trim().length === 0) {
      addError(errors, `${path}.explanation`, item.explanation, 'non-empty string');
    }
  });
}

function expectCompletionChoices(value: unknown, path: string, errors: ValidationError[]): void {
  if (!Array.isArray(value) || value.length < 2) {
    addError(errors, path, value, 'array of at least two non-empty strings');
    return;
  }

  value.forEach((choice, index) => {
    if (typeof choice !== 'string' || choice.trim().length === 0) {
      addError(errors, `${path}[${index}]`, choice, 'non-empty string');
    }
  });
}

function isAnswerIndexInRange(answerIndex: unknown, choices: unknown): boolean {
  if (!Array.isArray(choices) || !Number.isInteger(answerIndex)) {
    return false;
  }

  const index = answerIndex as number;
  return index >= 0 && index < choices.length;
}

function expectOptionalString(
  record: Record<string, unknown>,
  key: string,
  errors: ValidationError[]
): void {
  if (record[key] === undefined) {
    return;
  }

  if (typeof record[key] !== 'string') {
    addError(errors, key, record[key], 'string');
  }
}

function expectOptionalLanguageVersion(record: Record<string, unknown>, errors: ValidationError[]): void {
  const value = record.languageVersion;
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    addError(errors, 'languageVersion', value, 'known language version');
    return;
  }

  if (typeof record.language !== 'string' || !languages.has(record.language as LessonLanguage)) {
    return;
  }

  const allowedVersions = lessonLanguageVersionsByLanguage[record.language];
  if (allowedVersions === undefined || !allowedVersions.includes(value)) {
    addError(errors, 'languageVersion', value, `version for ${record.language}`);
  }
}

function expectAdvancedMetadata(record: Record<string, unknown>, errors: ValidationError[]): void {
  if (!Number.isInteger(record.difficulty) || (record.difficulty as number) < 3) {
    return;
  }

  if (!Array.isArray(record.learningGoals) || record.learningGoals.length === 0) {
    addError(errors, 'learningGoals', record.learningGoals, 'non-empty array of strings for difficulty 3+');
  }

  if (record.languageVersion === undefined) {
    addError(errors, 'languageVersion', record.languageVersion, 'known language version for difficulty 3+');
  }
}

function expectTargetCodeLineCount(record: Record<string, unknown>, errors: ValidationError[]): void {
  if (typeof record.targetCode !== 'string' || record.targetCode.trim().length === 0 || isSourceFileLesson(record)) {
    return;
  }

  const lineCount = record.targetCode.split('\n').length;
  if (lineCount < 3 || lineCount > 30) {
    addError(errors, 'targetCode', record.targetCode, '3 to 30 lines for snippet lessons');
  }
}

function expectIdMatchesLanguage(record: Record<string, unknown>, errors: ValidationError[]): void {
  if (typeof record.id !== 'string' || typeof record.language !== 'string') {
    return;
  }

  if (!lessonIdPattern.test(record.id) || !languages.has(record.language as LessonLanguage)) {
    return;
  }

  if (record.id.startsWith(`${record.language}-`)) {
    return;
  }

  if (record.language === 'java' && record.id.startsWith('prog2-')) {
    return;
  }

  addError(errors, 'id', record.id, `id prefixed with ${record.language}-`);
}

function isSourceFileLesson(record: Record<string, unknown>): boolean {
  return Array.isArray(record.tags) && record.tags.includes('source-file');
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
