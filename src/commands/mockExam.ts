import type { Lesson, LessonCompletionCheck } from '../lessons/schema';
import type { CompletionCheckAnswerRecord, MockExamAttempt, MockExamWrongAnswer } from '../progress/progressStore';
import {
  allocateObjectiveTargets,
  getExamObjectiveForLesson,
  javaSe25ExamBlueprint
} from './examBlueprint';
import type { MockExamReadinessSummary, ObjectiveBlindSpot } from '../progress/readiness';

export const mockExamQuestionCount = javaSe25ExamBlueprint.questionCount;
export const mockExamDurationMs = javaSe25ExamBlueprint.durationMs;
export const mockExamPassingScorePercent = javaSe25ExamBlueprint.passingScorePercent;

export interface MockExamQuestion {
  id: string;
  lessonId: string;
  lessonTitle: string;
  checkIndex: number;
  objectiveId: string;
  objectiveLabel: string;
  check: LessonCompletionCheck;
}

export interface CreateMockExamAttemptInput {
  questions: MockExamQuestion[];
  selectedChoiceIndexesByQuestionId: ReadonlyMap<string, number>;
  startedAt: string;
  completedAt: string;
}

export interface CreateMockExamCompletionCheckAnswerRecordsInput {
  questions: MockExamQuestion[];
  selectedChoiceIndexesByQuestionId: ReadonlyMap<string, number>;
  answeredAt: string;
}

export interface MockExamReviewItem {
  label: string;
  description: string;
  detail: string;
  wrongAnswer: MockExamWrongAnswer;
}

export interface FormatMockExamSummaryOptions {
  readiness?: MockExamReadinessSummary;
  blindSpots?: readonly ObjectiveBlindSpot[];
}

export function collectMockExamQuestions(
  lessons: readonly Lesson[],
  options: { includeOffSyllabus?: boolean } = {}
): MockExamQuestion[] {
  return lessons
    .flatMap((lesson) => {
      const objective = getExamObjectiveForLesson(lesson, options);
      if (objective === undefined) {
        return [];
      }

      return (lesson.completionChecks ?? []).map((check, index) => ({
        id: `${lesson.id}:${index}`,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        checkIndex: index,
        objectiveId: objective.id,
        objectiveLabel: objective.label,
        check
      }));
    });
}

export function selectMockExamQuestions(
  questions: readonly MockExamQuestion[],
  count: number,
  random: () => number = Math.random
): MockExamQuestion[] {
  const selected: MockExamQuestion[] = [];
  const targetCount = Math.min(Math.max(0, Math.floor(count)), questions.length);
  const selectedIds = new Set<string>();
  const targets = allocateObjectiveTargets(targetCount);

  for (const objective of javaSe25ExamBlueprint.objectives) {
    const target = targets.get(objective.id) ?? 0;
    const bucket = questions.filter((question) => question.objectiveId === objective.id);
    drawQuestions(bucket, target, targetCount, random, selectedIds, selected);
  }

  if (selected.length < targetCount) {
    drawBalancingQuestions(questions, targetCount, random, selectedIds, selected);
  }

  if (selected.length < targetCount) {
    drawQuestions(questions, targetCount - selected.length, targetCount, random, selectedIds, selected);
  }

  return selected;
}

function drawBalancingQuestions(
  questions: readonly MockExamQuestion[],
  targetCount: number,
  random: () => number,
  selectedIds: Set<string>,
  selected: MockExamQuestion[]
): void {
  let madeProgress = true;
  while (selected.length < targetCount && madeProgress) {
    madeProgress = false;
    const counts = countSelectedByObjective(selected);

    for (const objective of [...javaSe25ExamBlueprint.objectives].sort((left, right) => (
      (counts.get(left.id) ?? 0) - (counts.get(right.id) ?? 0)
    ))) {
      if (selected.length >= targetCount) {
        return;
      }

      const currentCount = counts.get(objective.id) ?? 0;
      const maxCount = Math.max(
        allocateObjectiveTargets(targetCount).get(objective.id) ?? 0,
        Math.floor(targetCount * (objective.weight + 0.05))
      );
      if (currentCount >= maxCount) {
        continue;
      }

      const before = selected.length;
      drawQuestions(
        questions.filter((question) => question.objectiveId === objective.id),
        1,
        targetCount,
        random,
        selectedIds,
        selected
      );
      if (selected.length > before) {
        counts.set(objective.id, currentCount + 1);
        madeProgress = true;
      }
    }
  }
}

function countSelectedByObjective(questions: readonly Pick<MockExamQuestion, 'objectiveId'>[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const question of questions) {
    counts.set(question.objectiveId, (counts.get(question.objectiveId) ?? 0) + 1);
  }
  return counts;
}

function drawQuestions(
  questions: readonly MockExamQuestion[],
  count: number,
  targetCount: number,
  random: () => number,
  selectedIds: Set<string>,
  selected: MockExamQuestion[]
): void {
  const available = questions.filter((question) => !selectedIds.has(question.id));
  while (selected.length < targetCount && count > 0 && available.length > 0) {
    const index = Math.floor(random() * available.length);
    const [question] = available.splice(index, 1);
    if (question !== undefined) {
      selectedIds.add(question.id);
      selected.push(question);
      count -= 1;
    }
  }
}

export function createMockExamAttempt(input: CreateMockExamAttemptInput): MockExamAttempt {
  const wrongAnswers: MockExamWrongAnswer[] = [];
  const objectiveResults = new Map<string, {
    objectiveId: string;
    objectiveLabel: string;
    questionCount: number;
    correctCount: number;
  }>();
  let correctCount = 0;

  for (const question of input.questions) {
    const selectedIndex = input.selectedChoiceIndexesByQuestionId.get(question.id);
    const objective = objectiveResults.get(question.objectiveId) ?? {
      objectiveId: question.objectiveId,
      objectiveLabel: question.objectiveLabel,
      questionCount: 0,
      correctCount: 0
    };
    objective.questionCount += 1;
    objectiveResults.set(question.objectiveId, objective);

    if (selectedIndex === question.check.answerIndex) {
      correctCount += 1;
      objective.correctCount += 1;
      continue;
    }

    wrongAnswers.push({
      lessonId: question.lessonId,
      lessonTitle: question.lessonTitle,
      objectiveId: question.objectiveId,
      objectiveLabel: question.objectiveLabel,
      prompt: question.check.prompt,
      selectedChoice: selectedIndex === undefined ? 'Unanswered' : question.check.choices[selectedIndex] ?? 'Unanswered',
      correctChoice: question.check.choices[question.check.answerIndex]!,
      explanation: question.check.explanation
    });
  }

  const scorePercent = input.questions.length === 0
    ? 0
    : Math.round((correctCount / input.questions.length) * 100);

  return {
    completedAt: input.completedAt,
    durationMs: Math.min(mockExamDurationMs, Math.max(0, Date.parse(input.completedAt) - Date.parse(input.startedAt))),
    questionCount: input.questions.length,
    correctCount,
    scorePercent,
    passed: scorePercent >= mockExamPassingScorePercent,
    lessonIds: [...new Set(input.questions.map((question) => question.lessonId))],
    objectiveResults: javaSe25ExamBlueprint.objectives
      .map((objective) => objectiveResults.get(objective.id))
      .filter((result): result is NonNullable<typeof result> => result !== undefined)
      .map((result) => ({
        ...result,
        accuracyPercent: result.questionCount === 0 ? 0 : Math.round((result.correctCount / result.questionCount) * 100)
      })),
    wrongAnswers
  };
}

export function createMockExamCompletionCheckAnswerRecords(
  input: CreateMockExamCompletionCheckAnswerRecordsInput
): CompletionCheckAnswerRecord[] {
  return input.questions.flatMap((question) => {
    const selectedChoiceIndex = input.selectedChoiceIndexesByQuestionId.get(question.id) ?? -1;
    if (selectedChoiceIndex === question.check.answerIndex) {
      return [];
    }

    return [{
      lessonId: question.lessonId,
      lessonTitle: question.lessonTitle,
      checkIndex: question.checkIndex,
      check: question.check,
      selectedChoiceIndex,
      answeredAt: input.answeredAt,
      source: 'mock-exam'
    }];
  });
}

export function formatMockExamSummary(attempt: MockExamAttempt, options: FormatMockExamSummaryOptions = {}): string {
  const suffix = attempt.passed
    ? `at or above the ${mockExamPassingScorePercent}% pass mark.`
    : `below the ${mockExamPassingScorePercent}% pass mark.`;
  const readinessText = options.readiness?.lastFiveAveragePercent === undefined
    ? undefined
    : ` Last-5 average: ${options.readiness.lastFiveAveragePercent}%; ${options.readiness.consecutiveMocksAtOrAbove80}/3 mocks >=80%.`;
  const blindSpotText = options.blindSpots === undefined || options.blindSpots.length === 0
    ? undefined
    : ` Blind spots: ${options.blindSpots.map((spot) => `${spot.objectiveLabel} ${spot.accuracyPercent}%`).join(', ')}.`;
  return `Mock exam: ${attempt.correctCount}/${attempt.questionCount} correct (${attempt.scorePercent}%) - ${suffix}${readinessText ?? ''}${blindSpotText ?? ''}`;
}

export function createMockExamReviewItems(wrongAnswers: readonly MockExamWrongAnswer[]): MockExamReviewItem[] {
  return wrongAnswers.map((wrongAnswer) => ({
    label: wrongAnswer.prompt,
    description: wrongAnswer.lessonTitle,
    detail: `Your answer: ${wrongAnswer.selectedChoice} | Correct: ${wrongAnswer.correctChoice}`,
    wrongAnswer
  }));
}
