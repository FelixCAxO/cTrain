import { compareBuiltInLessons, getBuiltInLessonCategory } from '../lessons/lessonOrdering';
import type { Lesson } from '../lessons/schema';
import type { LessonStatusSummary } from '../progress/progressStore';
import { formatCompletionBadge, formatLearningGoalsDetail } from './lessonPicker';

export interface LessonTreeGroup {
  id: string;
  label: string;
  icon: string;
  lessonIds: string[];
}

export function createLessonTreeGroups(lessons: Lesson[]): LessonTreeGroup[] {
  const groups = new Map<string, LessonTreeGroup & { order: number }>();

  for (const lesson of [...lessons].sort(compareBuiltInLessons)) {
    const category = getBuiltInLessonCategory(lesson);
    let group = groups.get(category.key);
    if (group === undefined) {
      group = {
        id: category.key,
        label: category.label,
        icon: category.icon,
        order: category.order,
        lessonIds: []
      };
      groups.set(category.key, group);
    }

    group.lessonIds.push(lesson.id);
  }

  return [...groups.values()]
    .sort((left, right) => left.order - right.order)
    .map((group) => ({ id: group.id, label: group.label, icon: group.icon, lessonIds: group.lessonIds }));
}

export function formatLessonTreeDescription(status: LessonStatusSummary): string {
  const badge = formatCompletionBadge(status.completionCount);
  const parts = [
    formatBestWpm(status),
    status.dueReviewCount === undefined || status.dueReviewCount === 0 ? undefined : `Recall due ${status.dueReviewCount}`,
    badge === undefined ? undefined : `Completed ${badge}`
  ].filter((part): part is string => part !== undefined);

  if (parts.length > 0) {
    return parts.join(' | ');
  }

  if (status.suggestedAfterTitles.length > 0) {
    return `Suggested after: ${status.suggestedAfterTitles.join(', ')}`;
  }

  return status.detail;
}

function formatBestWpm(status: LessonStatusSummary): string | undefined {
  if (status.bestWpm === undefined) {
    return undefined;
  }

  if (status.bestErrorRatePercent === undefined) {
    return `Best ${status.bestWpm} WPM`;
  }

  return `Best ${status.bestWpm} WPM (${status.bestErrorRatePercent}% err)`;
}

export function formatLessonTreeTooltip(lesson: Lesson, status: LessonStatusSummary): string {
  const baseText = [
    lesson.description,
    formatLearningGoalsDetail(lesson.learningGoals)
  ].filter((part): part is string => part !== undefined).join('\n\n');

  if (status.completionCount > 0 || status.suggestedAfterTitles.length === 0) {
    return baseText;
  }

  return `${baseText}\n\nSuggested after: ${status.suggestedAfterTitles.join(', ')}`;
}
