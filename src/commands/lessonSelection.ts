import type { Lesson } from '../lessons/schema';
import type { LessonStatusSummary, ProgressBlob } from '../progress/progressStore';

export function suggestedAfterTitles(
  lesson: Lesson,
  records: ProgressBlob['lessons'],
  allLessons: Lesson[]
): string[] {
  if (usesPrerequisitesAsOrderingHints(lesson)) {
    return [];
  }

  return missingPrerequisiteChains(lesson, records, allLessons).map((chain) => chain.join(' -> '));
}

function usesPrerequisitesAsOrderingHints(lesson: Lesson): boolean {
  return lesson.tags.includes('prog2') && lesson.tags.includes('source-file');
}

function missingPrerequisiteChains(
  lesson: Lesson,
  records: ProgressBlob['lessons'],
  allLessons: Lesson[]
): string[][] {
  const lessonsById = new Map(allLessons.map((candidate) => [candidate.id, candidate]));
  return lesson.prerequisites
    .filter((lessonId) => records[lessonId] === undefined)
    .flatMap((lessonId) => collectMissingPrerequisiteChains(lessonId, records, lessonsById, new Set([lesson.id])));
}

function collectMissingPrerequisiteChains(
  lessonId: string,
  records: ProgressBlob['lessons'],
  lessonsById: Map<string, Lesson>,
  visitedIds: Set<string>
): string[][] {
  const lesson = lessonsById.get(lessonId);
  if (lesson === undefined) {
    return [[lessonId]];
  }

  if (visitedIds.has(lessonId)) {
    return [[lesson.title]];
  }

  const nextVisitedIds = new Set(visitedIds);
  nextVisitedIds.add(lessonId);
  const missingPrerequisitePaths = lesson.prerequisites
    .filter((prerequisiteId) => records[prerequisiteId] === undefined)
    .flatMap((prerequisiteId) => collectMissingPrerequisiteChains(
      prerequisiteId,
      records,
      lessonsById,
      nextVisitedIds
    ));

  if (missingPrerequisitePaths.length === 0) {
    return [[lesson.title]];
  }

  return missingPrerequisitePaths.map((path) => [...path, lesson.title]);
}

export function enrichLessonStatus(
  lesson: Lesson,
  status: LessonStatusSummary,
  progress: ProgressBlob,
  allLessons: Lesson[]
): LessonStatusSummary {
  return {
    ...status,
    suggestedAfterTitles: suggestedAfterTitles(lesson, progress.lessons, allLessons)
  };
}
