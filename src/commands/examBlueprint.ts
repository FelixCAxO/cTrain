import type { Lesson } from '../lessons/schema';
import type { MockExamQuestion } from './mockExam';

export interface ExamObjective {
  id: string;
  label: string;
  weight: number;
  tags: readonly string[];
}

export interface ExamBlueprint {
  examCode: '1Z0-831';
  questionCount: number;
  durationMs: number;
  passingScorePercent: number;
  objectives: readonly ExamObjective[];
}

export const javaSe25ExamBlueprint: ExamBlueprint = {
  examCode: '1Z0-831',
  questionCount: 50,
  durationMs: 120 * 60 * 1000,
  passingScorePercent: 68,
  objectives: [
    {
      id: 'values',
      label: 'Handling Date, Time, Text, Numeric and Boolean Values',
      weight: 0.1,
      tags: ['primitives', 'numeric-casting', 'math', 'strings', 'time', 'formatting', 'var', 'text-blocks']
    },
    {
      id: 'flow-control',
      label: 'Implementing Program Flow Control Using Decision and Looping Constructs',
      weight: 0.1,
      tags: ['conditionals', 'if-else', 'switch', 'loops']
    },
    {
      id: 'oop',
      label: 'Applying Object-Oriented Principles in Java Programs',
      weight: 0.1,
      tags: [
        'classes',
        'methods',
        'interfaces',
        'interface-methods',
        'records',
        'constructors',
        'inheritance',
        'abstract',
        'sealed',
        'pattern-matching',
        'enums',
        'enum-members',
        'encapsulation',
        'static',
        'references',
        'object-contracts',
        'functional-interfaces',
        'varargs',
        'unnamed-variables'
      ]
    },
    {
      id: 'exceptions',
      label: 'Implementing Exception Handling in Java Applications',
      weight: 0.1,
      tags: ['exceptions', 'multicatch', 'resources']
    },
    {
      id: 'collections',
      label: 'Using Arrays and Collections to Store and Retrieve Data',
      weight: 0.1,
      tags: ['arrays', 'collections', 'maps', 'sets', 'deque', 'sequenced-collections']
    },
    {
      id: 'streams',
      label: 'Processing Data Using Streams and Lambda Expressions',
      weight: 0.1,
      tags: ['streams', 'lambdas', 'lambda', 'optional', 'collectors']
    },
    {
      id: 'packaging',
      label: 'Packaging and Deploying Java Code',
      weight: 0.1,
      tags: ['modules', 'imports']
    },
    {
      id: 'concurrency',
      label: 'Implementing Multithreading for Concurrent Code Execution',
      weight: 0.1,
      tags: ['threads', 'virtual-threads', 'executors', 'concurrency', 'scoped-values']
    },
    {
      id: 'io',
      label: 'Performing Input and Output Operations Using the Java I/O API',
      weight: 0.1,
      tags: ['files', 'io', 'serialization']
    },
    {
      id: 'localization',
      label: 'Developing Applications with Localization Support',
      weight: 0.1,
      tags: ['localization']
    }
  ]
};

const objectiveById = new Map(javaSe25ExamBlueprint.objectives.map((objective) => [objective.id, objective]));

export function getExamObjectiveById(objectiveId: string): ExamObjective | undefined {
  return objectiveById.get(objectiveId);
}

export function getExamObjectiveForLesson(
  lesson: Lesson,
  options: { includeOffSyllabus?: boolean } = {}
): ExamObjective | undefined {
  if (options.includeOffSyllabus !== true && !isCertificationLesson(lesson)) {
    return undefined;
  }

  const candidates = javaSe25ExamBlueprint.objectives
    .map((objective, index) => ({
      objective,
      index,
      matchCount: objective.tags.filter((tag) => lesson.tags.includes(tag)).length
    }))
    .filter((candidate) => candidate.matchCount > 0)
    .sort((left, right) => right.matchCount - left.matchCount
      || left.objective.tags.length - right.objective.tags.length
      || left.index - right.index);

  return candidates[0]?.objective ?? objectiveById.get('oop');
}

export function isCertificationLesson(lesson: Lesson): boolean {
  return !lesson.tags.includes('preview')
    && lesson.languageVersion !== 'Java 26'
    && !lesson.tags.includes('http-client');
}

export function allocateObjectiveTargets(count: number, blueprint = javaSe25ExamBlueprint): Map<string, number> {
  const normalizedCount = Math.max(0, Math.floor(count));
  const allocations = blueprint.objectives.map((objective) => {
    const exact = normalizedCount * objective.weight;
    return {
      objective,
      target: Math.floor(exact),
      remainder: exact - Math.floor(exact)
    };
  });
  let assigned = allocations.reduce((sum, allocation) => sum + allocation.target, 0);

  for (const allocation of [...allocations].sort((left, right) => right.remainder - left.remainder)) {
    if (assigned >= normalizedCount) {
      break;
    }
    allocation.target += 1;
    assigned += 1;
  }

  return new Map(allocations.map((allocation) => [allocation.objective.id, allocation.target]));
}

export function isObjectiveMixWithinTolerance(
  questions: readonly Pick<MockExamQuestion, 'objectiveId'>[],
  blueprint = javaSe25ExamBlueprint,
  tolerancePercentagePoints = 5
): boolean {
  if (questions.length === 0) {
    return false;
  }

  return blueprint.objectives.every((objective) => {
    const actualPercent = (questions.filter((question) => question.objectiveId === objective.id).length / questions.length) * 100;
    const targetPercent = objective.weight * 100;
    return Math.abs(actualPercent - targetPercent) <= tolerancePercentagePoints;
  });
}
