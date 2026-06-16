import type { LessonListItem } from '../lessons/schema';
import type { LessonStatusSummary } from '../progress/progressStore';
import { compareBuiltInLessonItems, getBuiltInLessonCategory } from '../lessons/lessonOrdering';
import type { SprintProgressSummary } from '../progress/readiness';

export interface LessonQuickPickItem {
  kind?: -1;
  label: string;
  description?: string;
  detail?: string;
  lessonId?: string;
}

interface LessonPickerGroup {
  key: string;
  label: string;
  order: number;
}

export function createPickerItems(
  lessons: LessonListItem[],
  statuses: Map<string, LessonStatusSummary>
): LessonQuickPickItem[] {
  const sorted = [...lessons].sort((left, right) => {
    const leftGroup = getLessonPickerGroup(left);
    const rightGroup = getLessonPickerGroup(right);
    const groupOrder = leftGroup.order - rightGroup.order;
    if (groupOrder !== 0) {
      return groupOrder;
    }

    const groupLabelOrder = leftGroup.label.localeCompare(rightGroup.label);
    if (groupLabelOrder !== 0) {
      return groupLabelOrder;
    }

    const builtInTrackOrder = compareBuiltInLessonItems(left, right);
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
  const groupCounts = countPickerGroups(sorted);
  const items: LessonQuickPickItem[] = [];
  let lastGroupKey: string | undefined;

  for (const item of sorted) {
    const { lesson, source } = item;
    const group = getLessonPickerGroup(item);
    if (group.key !== lastGroupKey) {
      items.push({ kind: -1, label: `${group.label} (${groupCounts.get(group.key) ?? 0})` });
      lastGroupKey = group.key;
    }

    const status = statuses.get(lesson.id) ?? {
      state: 'not-started',
      detail: 'Not started',
      completionCount: 0,
      suggestedAfterTitles: []
    };
    const icon = status.state === 'completed' ? '$(check)' : status.state === 'changed-since-completion' ? '$(warning)' : '$(circle-large-outline)';
    const badge = formatCompletionBadge(status.completionCount);
    const suggestedPrefix = status.completionCount === 0 && status.suggestedAfterTitles.length > 0
      ? `Suggested after: ${status.suggestedAfterTitles.join(', ')} - `
      : '';

    items.push({
      label: `${icon} ${lesson.title}${badge === undefined ? '' : ` ${badge}`}`,
      description: [
        formatLanguageLabel(lesson.language),
        `Difficulty ${lesson.difficulty}`,
        formatMinutes(lesson.estimatedSeconds),
        source,
        formatBestWpm(status),
        status.dueReviewCount === undefined || status.dueReviewCount === 0 ? undefined : `Recall due ${status.dueReviewCount}`,
        badge === undefined ? undefined : `Completed ${badge}`
      ].filter((part): part is string => part !== undefined).join(' | '),
      detail: [
        formatPickerCategoryDetail(item),
        `${suggestedPrefix}${status.detail} - ${lesson.description}`,
        formatLearningGoalsDetail(lesson.learningGoals),
        formatTagsDetail(lesson.tags, lesson.language)
      ].filter((part): part is string => part !== undefined).join('\n'),
      lessonId: lesson.id
    });
  }

  return items;
}

function countPickerGroups(lessons: LessonListItem[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of lessons) {
    const group = getLessonPickerGroup(item);
    counts.set(group.key, (counts.get(group.key) ?? 0) + 1);
  }

  return counts;
}

function getLessonPickerGroup(item: LessonListItem): LessonPickerGroup {
  if (item.source === 'built-in') {
    const category = getBuiltInLessonCategory(item.lesson);
    return {
      key: category.key,
      label: category.order === 4 ? formatLanguageLabel(item.lesson.language) : category.label,
      order: category.order
    };
  }

  return {
    key: `workspace-${item.lesson.language}`,
    label: `${formatLanguageLabel(item.lesson.language)} Workspace`,
    order: 100
  };
}

function formatPickerCategoryDetail(item: LessonListItem): string | undefined {
  if (item.source !== 'built-in') {
    return undefined;
  }

  return `Category: ${getBuiltInLessonCategory(item.lesson).label}`;
}

export function formatLessonPickerTitle(
  completedCount: number,
  totalCount: number,
  currentStreak: number,
  sprintProgress?: SprintProgressSummary
): string {
  const streakText = currentStreak === 1 ? '1-day streak' : `${currentStreak}-day streak`;
  const sprintText = sprintProgress === undefined
    ? undefined
    : `sprint ${sprintProgress.totalMinutes}/${sprintProgress.targetMinutes} min, ${sprintProgress.practiceDays}/${sprintProgress.sprintDays} days`;
  return `cTrain: Start Lesson (${[`${completedCount} of ${totalCount} completed`, streakText, sprintText].filter(Boolean).join(', ')})`;
}

export function formatCompletionBadge(completionCount: number): string | undefined {
  return completionCount > 0 ? `×${completionCount}` : undefined;
}

export function formatLanguageLabel(language: string): string {
  return `${formatLanguageIcon(language)} ${formatLanguage(language)}`;
}

export function formatLearningGoalsDetail(learningGoals: readonly string[] | undefined): string | undefined {
  const goals = learningGoals?.map((goal) => goal.trim()).filter((goal) => goal.length > 0) ?? [];
  return goals.length === 0 ? undefined : `Goals: ${goals.join('; ')}`;
}

export function formatTagsDetail(tags: readonly string[], language: string): string | undefined {
  const searchableTags = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && tag !== language);

  return searchableTags.length === 0 ? undefined : `Tags: ${searchableTags.join(', ')}`;
}

function formatLanguage(language: string): string {
  if (language === 'cpp') {
    return 'C++';
  }

  if (language === 'typescript') {
    return 'TypeScript';
  }

  return `${language[0]!.toUpperCase()}${language.slice(1)}`;
}

function formatLanguageIcon(language: string): string {
  if (language === 'java') {
    return '$(symbol-class)';
  }

  if (language === 'cpp') {
    return '$(symbol-namespace)';
  }

  if (language === 'typescript') {
    return '$(symbol-method)';
  }

  if (language === 'python') {
    return '$(symbol-misc)';
  }

  return '$(code)';
}

function formatMinutes(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} min`;
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
