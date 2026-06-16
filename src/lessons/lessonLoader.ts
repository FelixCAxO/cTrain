import fs from 'node:fs';
import path from 'node:path';
import type { LessonListItem, LessonSource } from './schema';
import { validateLesson } from './validator';
import { compareBuiltInLessonItems } from './lessonOrdering';

export interface LessonDirectory {
  source: LessonSource;
  lessons: unknown[];
}

export interface LessonLoadError {
  source: LessonSource;
  index: number;
  message: string;
}

export interface LessonLoadResult {
  lessons: LessonListItem[];
  errors: LessonLoadError[];
}

export interface IndexedLessonListItem {
  item: LessonListItem;
  index: number;
}

export function loadLessonsFromDirectories(directories: LessonDirectory[]): LessonLoadResult {
  const loadedLessons: IndexedLessonListItem[] = [];
  const errors: LessonLoadError[] = [];
  const seenIds = new Set<string>();

  for (const directory of directories) {
    directory.lessons.forEach((candidate, index) => {
      const validation = validateLesson(candidate);

      if (!validation.ok) {
        errors.push({
          source: directory.source,
          index,
          message: validation.errors.map((error) => error.message).join('; ')
        });
        return;
      }

      if (seenIds.has(validation.lesson.id)) {
        errors.push({
          source: directory.source,
          index,
          message: `Duplicate lesson id "${validation.lesson.id}"`
        });
        return;
      }

      seenIds.add(validation.lesson.id);
      loadedLessons.push({ item: { lesson: validation.lesson, source: directory.source }, index });
    });
  }

  const referenceValidation = rejectLessonsWithMissingPrerequisites(loadedLessons);
  return {
    lessons: referenceValidation.lessons,
    errors: [...errors, ...referenceValidation.errors]
  };
}

export function sortLessonsForPicker(lessons: LessonListItem[]): LessonListItem[] {
  return [...lessons].sort((left, right) => {
    const builtInTrackOrder = compareBuiltInTrackOrder(left, right);
    if (builtInTrackOrder !== 0) {
      return builtInTrackOrder;
    }

    const languageOrder = left.lesson.language.localeCompare(right.lesson.language);
    if (languageOrder !== 0) {
      return languageOrder;
    }

    const difficultyOrder = left.lesson.difficulty - right.lesson.difficulty;
    if (difficultyOrder !== 0) {
      return difficultyOrder;
    }

    return left.lesson.title.localeCompare(right.lesson.title);
  });
}

function compareBuiltInTrackOrder(left: LessonListItem, right: LessonListItem): number {
  return compareBuiltInLessonItems(left, right);
}

export function mergeLessonLists(...lessonLists: LessonListItem[][]): LessonLoadResult {
  const loadedLessons: IndexedLessonListItem[] = [];
  const errors: LessonLoadError[] = [];
  const seenIds = new Set<string>();

  for (const list of lessonLists) {
    for (let index = 0; index < list.length; index += 1) {
      const item = list[index]!;
      if (seenIds.has(item.lesson.id)) {
        errors.push({
          source: item.source,
          index,
          message: `Duplicate lesson id "${item.lesson.id}"`
        });
        continue;
      }

      seenIds.add(item.lesson.id);
      loadedLessons.push({ item, index });
    }
  }

  const referenceValidation = rejectLessonsWithMissingPrerequisites(loadedLessons);
  return {
    lessons: referenceValidation.lessons,
    errors: [...errors, ...referenceValidation.errors]
  };
}

export function rejectLessonsWithMissingPrerequisites(loadedLessons: IndexedLessonListItem[]): LessonLoadResult {
  const knownIds = new Set(loadedLessons.map(({ item }) => item.lesson.id));
  const lessonsById = new Map(loadedLessons.map((loaded) => [loaded.item.lesson.id, loaded.item.lesson]));
  const rejectedIds = new Set<string>();
  const errors: LessonLoadError[] = [];

  for (const loaded of loadedLessons) {
    const missing = loaded.item.lesson.prerequisites.filter((lessonId) => !knownIds.has(lessonId));
    if (missing.length > 0) {
      rejectedIds.add(loaded.item.lesson.id);
      errors.push({
        source: loaded.item.source,
        index: loaded.index,
        message: missing.map((lessonId) => `Missing prerequisite "${lessonId}" for lesson "${loaded.item.lesson.id}"`).join('; ')
      });
    }
  }

  for (const loaded of loadedLessons) {
    if (rejectedIds.has(loaded.item.lesson.id)) {
      continue;
    }

    const cycle = findPrerequisiteCycle(loaded.item.lesson.id, lessonsById);
    if (cycle !== undefined) {
      rejectedIds.add(loaded.item.lesson.id);
      errors.push({
        source: loaded.item.source,
        index: loaded.index,
        message: `Cyclic prerequisite chain for lesson "${loaded.item.lesson.id}": ${cycle.join(' -> ')}`
      });
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const loaded of loadedLessons) {
      if (rejectedIds.has(loaded.item.lesson.id)) {
        continue;
      }

      const rejectedPrerequisite = loaded.item.lesson.prerequisites.find((lessonId) => rejectedIds.has(lessonId));
      if (rejectedPrerequisite !== undefined) {
        rejectedIds.add(loaded.item.lesson.id);
        changed = true;
        errors.push({
          source: loaded.item.source,
          index: loaded.index,
          message: `Rejected prerequisite "${rejectedPrerequisite}" for lesson "${loaded.item.lesson.id}"`
        });
      }
    }
  }

  return {
    lessons: loadedLessons
      .filter((loaded) => !rejectedIds.has(loaded.item.lesson.id))
      .map((loaded) => loaded.item),
    errors
  };
}

function findPrerequisiteCycle(
  lessonId: string,
  lessonsById: Map<string, LessonListItem['lesson']>,
  chain: string[] = []
): string[] | undefined {
  const cycleStart = chain.indexOf(lessonId);
  if (cycleStart >= 0) {
    return [...chain.slice(cycleStart), lessonId];
  }

  const lesson = lessonsById.get(lessonId);
  if (lesson === undefined) {
    return undefined;
  }

  const nextChain = [...chain, lessonId];
  for (const prerequisiteId of lesson.prerequisites) {
    const cycle = findPrerequisiteCycle(prerequisiteId, lessonsById, nextChain);
    if (cycle !== undefined) {
      return cycle;
    }
  }

  return undefined;
}

export function loadWorkspaceLessonFiles(workspaceRoot: string): LessonLoadResult {
  const lessonDirectory = path.join(workspaceRoot, '.codetrainer', 'lessons');

  if (!fs.existsSync(lessonDirectory)) {
    return { lessons: [], errors: [] };
  }

  const candidates: unknown[] = [];
  const errors: LessonLoadError[] = [];
  const files = fs.readdirSync(lessonDirectory)
    .filter((file) => file.endsWith('.json'))
    .sort();

  files.forEach((file, index) => {
    const filePath = path.join(lessonDirectory, file);
    try {
      candidates.push(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } catch (error) {
      errors.push({
        source: 'workspace',
        index,
        message: `Invalid JSON in ${file}: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  const loaded = loadLessonsFromDirectories([{ source: 'workspace', lessons: candidates }]);
  return {
    lessons: loaded.lessons,
    errors: [...errors, ...loaded.errors]
  };
}
