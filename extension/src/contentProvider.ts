import type { Lesson } from './lessons/schema';
import { TrainingSession } from './training/trainingSession';

const uriPrefix = 'code-trainer:/lesson/';

export function createLessonUriString(lessonId: string): string {
  return `${uriPrefix}${encodeURIComponent(lessonId)}`;
}

export function lessonIdFromUriString(uri: string): string {
  if (!uri.startsWith(uriPrefix)) {
    throw new Error(`Unsupported cTrain URI: ${uri}`);
  }

  return decodeURIComponent(uri.slice(uriPrefix.length));
}

export function renderLessonDocument(lesson: Lesson): string {
  return new TrainingSession(lesson).documentText;
}

export class CodeTrainerContentProvider {
  public provideTextDocumentContent(): string {
    return '';
  }
}
