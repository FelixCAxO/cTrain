import { compareBuiltInLessons } from './lessonOrdering';
import type { Lesson } from './schema';

export interface LessonCatalogue {
  lessons: Lesson[];
  lessonIds: string[];
  lessonsFrom(lessonId: string): Lesson[];
  nextAfter(lessonId: string): Lesson | undefined;
}

export function createLessonCatalogue(lessons: Lesson[]): LessonCatalogue {
  const orderedLessons = [...lessons].sort(compareBuiltInLessons);
  const lessonIds = orderedLessons.map((lesson) => lesson.id);

  return {
    lessons: orderedLessons,
    lessonIds,
    lessonsFrom(lessonId: string): Lesson[] {
      const startIndex = lessonIds.indexOf(lessonId);
      return startIndex < 0 ? [] : orderedLessons.slice(startIndex);
    },
    nextAfter(lessonId: string): Lesson | undefined {
      const currentIndex = lessonIds.indexOf(lessonId);
      return currentIndex < 0 ? undefined : orderedLessons[currentIndex + 1];
    }
  };
}
