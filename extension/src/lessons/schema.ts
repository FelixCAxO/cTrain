export type LessonLanguage = string;

export interface Lesson {
  schemaVersion: 1;
  id: string;
  version: number;
  title: string;
  description: string;
  language: LessonLanguage;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedSeconds: number;
  tags: string[];
  prerequisites: string[];
  learningGoals?: string[];
  defects?: LessonDefect[];
  completionChecks?: LessonCompletionCheck[];
  languageVersion?: string;
  targetCode: string;
}

export interface LessonDefect {
  line: number;
  hint: string;
}

export interface LessonCompletionCheck {
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

export type LessonSource = 'built-in' | 'workspace';

export interface LessonListItem {
  lesson: Lesson;
  source: LessonSource;
}
