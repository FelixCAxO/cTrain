import path from 'node:path';
import type { Lesson } from '../lessons/schema';

export interface EditorSource {
  fileName: string;
  languageId: string;
  fullText: string;
  selectedText?: string;
  sourceSessionId?: string;
}

export type PracticeSourceValidation =
  | { ok: true }
  | { ok: false; reason: 'too-short' | 'too-large'; message: string };

export function createLessonFromEditorSource(source: EditorSource): Lesson {
  const hasSelection = source.selectedText !== undefined && source.selectedText.length > 0;
  const baseName = path.basename(source.fileName);
  const nameWithoutExtension = baseName.replace(/\.[^.]+$/, '');
  const slug = slugify(nameWithoutExtension);
  const language = resolveTrainingLanguageId({ language: source.languageId });
  const practiceText = hasSelection ? source.selectedText! : source.fullText;
  const sourceSessionSuffix = source.sourceSessionId === undefined ? '' : `-${slugify(source.sourceSessionId)}`;

  return {
    schemaVersion: 1,
    id: `${hasSelection ? 'selection' : 'current-file'}-${slug}-${slugify(language)}${sourceSessionSuffix}`,
    version: 1,
    title: hasSelection ? `Selection from ${baseName}` : baseName,
    description: hasSelection ? 'Practice the current selection.' : 'Practice the current file.',
    language,
    difficulty: 1,
    estimatedSeconds: estimateSeconds(practiceText),
    tags: ['source-file', language],
    prerequisites: [],
    targetCode: practiceText
  };
}

export function validatePracticeSourceText(text: string): PracticeSourceValidation {
  if (text.length < 20) {
    return {
      ok: false,
      reason: 'too-short',
      message: `Select at least 20 characters to start a cTrain lesson. Current source has ${text.length} characters.`
    };
  }

  if (text.length > 20_000) {
    return {
      ok: false,
      reason: 'too-large',
      message: 'This source is over 20,000 characters and may be slow to practice.'
    };
  }

  return { ok: true };
}

export function resolveTrainingLanguageId(source: Pick<Lesson, 'language'>): string {
  return source.language;
}

export function trimPracticeSourceText(text: string): string {
  return text.slice(0, 20_000);
}

export function isKnownTrainingLanguageId(languageId: string): boolean {
  return !['plaintext', ''].includes(languageId) && knownTrainingLanguages.has(languageId);
}

export async function applyTrainingLanguageToDocument<TDocument>(
  document: TDocument,
  languageId: string,
  setLanguage: (document: TDocument, languageId: string) => PromiseLike<TDocument>
): Promise<TDocument> {
  return setLanguage(document, languageId);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : 'untitled';
}

function estimateSeconds(text: string): number {
  return Math.max(30, Math.ceil(text.length / 3));
}

const knownTrainingLanguages = new Set(['java', 'cpp', 'typescript', 'python', 'javascript', 'csharp', 'go', 'rust']);
