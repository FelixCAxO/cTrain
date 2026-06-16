import * as vscode from 'vscode';
import { builtInLessons } from '../lessons/builtInLessons';
import type { Lesson } from '../lessons/schema';
import { ProgressStore, type LessonStatusSummary } from '../progress/progressStore';
import { createLessonTreeGroups, formatLessonTreeDescription, formatLessonTreeTooltip, type LessonTreeGroup } from './lessonTreeModel';
import { formatCompletionBadge } from './lessonPicker';
import { enrichLessonStatus } from '../commands/lessonSelection';

type LessonTreeNode = LessonTreeGroup | Lesson;

export class LessonTreeDataProvider implements vscode.TreeDataProvider<LessonTreeNode> {
  private readonly emitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeTreeData = this.emitter.event;

  public constructor(
    private readonly progressStore: ProgressStore,
    private readonly reportError: (message: string, error: unknown) => void = () => undefined
  ) {}

  public refresh(): void {
    this.emitter.fire();
  }

  public async getChildren(element?: LessonTreeNode): Promise<LessonTreeNode[]> {
    if (element === undefined) {
      return createLessonTreeGroups(builtInLessons);
    }

    if (isLessonTreeGroup(element)) {
      return element.lessonIds
        .map((lessonId) => builtInLessons.find((lesson) => lesson.id === lessonId))
        .filter((lesson): lesson is Lesson => lesson !== undefined);
    }

    return [];
  }

  public async getTreeItem(element: LessonTreeNode): Promise<vscode.TreeItem> {
    if (isLessonTreeGroup(element)) {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscode.ThemeIcon(element.icon);
      item.contextValue = 'cTrainLessonCategory';
      return item;
    }

    const status = await this.getLessonStatus(element);
    const badge = formatCompletionBadge(status.completionCount);
    const label = badge === undefined ? element.title : `${element.title} ${badge}`;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = formatLessonTreeDescription(status);
    item.tooltip = formatLessonTreeTooltip(element, status);
    item.contextValue = 'cTrainLesson';
    item.iconPath = new vscode.ThemeIcon(status.state === 'completed' ? 'check' : 'circle-outline');
    item.command = {
      command: 'cTrain.startLesson',
      title: 'Start Lesson',
      arguments: [element.id]
    };
    item.accessibilityInformation = {
      label: `${element.title}, ${item.description ?? status.detail}`
    };
    return item;
  }

  private async getLessonStatus(lesson: Lesson): Promise<LessonStatusSummary> {
    try {
      const progress = await this.progressStore.load();
      const base = await this.progressStore.getLessonStatus(lesson.id, lesson.version);
      return enrichLessonStatus(lesson, base, progress, builtInLessons);
    } catch (error) {
      this.reportError('Failed to read lesson progress for tree item', error);
      return {
        state: 'not-started',
        detail: 'Progress unavailable',
        completionCount: 0,
        suggestedAfterTitles: []
      };
    }
  }
}

function isLessonTreeGroup(node: LessonTreeNode): node is LessonTreeGroup {
  return 'lessonIds' in node;
}
