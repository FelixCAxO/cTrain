import fs from 'node:fs';
import path from 'node:path';
import type { Lesson } from './schema';
import { rejectLessonsWithMissingPrerequisites, type IndexedLessonListItem, type LessonLoadError } from './lessonLoader';
import { validateLesson } from './validator';
import { compareBuiltInLessons } from './lessonOrdering';

export interface BuiltInLessonLoadResult {
  lessons: Lesson[];
  errors: LessonLoadError[];
}

export const builtInLessonLoadResult: BuiltInLessonLoadResult = loadBuiltInLessonFiles();
export const builtInLessons: Lesson[] = builtInLessonLoadResult.lessons;

export function loadBuiltInLessonFiles(baseDirectory = __dirname): BuiltInLessonLoadResult {
  let lessonDirectory: string;
  try {
    lessonDirectory = resolveBuiltInLessonDirectory(baseDirectory);
  } catch (error) {
    return {
      lessons: [],
      errors: [{
        source: 'built-in',
        index: 0,
        message: error instanceof Error ? error.message : String(error)
      }]
    };
  }

  const loadedLessons: IndexedLessonListItem[] = [];
  const errors: LessonLoadError[] = [];
  const files = listLessonFiles(lessonDirectory);

  files.forEach((file, index) => {
    try {
      loadedLessons.push({
        item: {
          lesson: readLessonFile(file),
          source: 'built-in'
        },
        index
      });
    } catch (error) {
      errors.push({
        source: 'built-in',
        index,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const referenceValidation = rejectLessonsWithMissingPrerequisites(loadedLessons);

  return {
    lessons: referenceValidation.lessons.map((item) => item.lesson).sort(compareBuiltInLessons),
    errors: [...errors, ...referenceValidation.errors]
  };
}

export function resolveBuiltInLessonDirectory(baseDirectory = __dirname): string {
  const candidates = [
    path.resolve(baseDirectory, '..', 'lessons'),
    path.resolve(baseDirectory, '..', '..', 'lessons'),
    path.resolve(baseDirectory, '..', '..', '..', 'lessons')
  ];

  const lessonDirectory = candidates.find(isLessonDirectory);
  if (lessonDirectory === undefined) {
    throw new Error('Unable to find bundled lessons directory.');
  }

  return lessonDirectory;
}

function isLessonDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory() && listLessonFiles(candidate).length > 0;
  } catch {
    return false;
  }
}

function listLessonFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('_')) {
        files.push(...listLessonFiles(fullPath));
      }
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function readLessonFile(filePath: string): Lesson {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON in ${path.basename(filePath)}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const validation = validateLesson(parsed);

  if (!validation.ok) {
    const message = validation.errors.map((error) => error.message).join('; ');
    throw new Error(`Invalid built-in lesson ${path.basename(filePath)}: ${message}`);
  }

  return validation.lesson;
}
