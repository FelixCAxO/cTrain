import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';
import { builtInLessons } from '../src/lessons/builtInLessons';

interface RoadmapRow {
  roadmapNode: string;
  expectedTags: string[];
  minExamReadyLessons: number;
  minCompletionChecksPerLesson: number;
}

interface StudyProfile {
  sprintDays: number;
  sessionsPerDay: number;
  sessionMinutesMin: number;
  sessionMinutesMax: number;
  targetTotalMinutes: number;
  highYieldWindow: number;
  sequencing: string;
}

interface AreaStudyPlan {
  order: number;
  priority: 1 | 2 | 3;
  phase: 'foundation' | 'integration' | 'advanced-modern';
  studyMode: 'flashcard-heavy' | 'code-heavy' | 'balanced';
  estimatedMinutes: {
    flashcards: number;
    programming: number;
    total: number;
  };
  minimumSessions: {
    flashcards: number;
    programming: number;
  };
  exitCriteria: string[];
}

interface FlashcardPlan {
  minimumCount: number;
  questionPatterns: string[];
  focus: string;
}

interface ProgrammingPlan {
  minimumCount: number;
  exercisePatterns: string[];
  focus: string;
}

interface PreImplementationArea {
  roadmapNode: string;
  expectedTags: string[];
  prerequisites: string[];
  flashcards: FlashcardPlan;
  programmingExercises: ProgrammingPlan;
  implementedLessonIds?: string[];
  study: AreaStudyPlan;
}

interface PreImplementationMap {
  exam: string;
  edition: string;
  studyProfile: StudyProfile;
  areas: PreImplementationArea[];
}

const root = process.cwd();
const mapPath = path.join(root, 'docs', 'java25-cert-preimplementation-map.json');
const roadmapPath = path.join(root, 'docs', 'roadmap-coverage.tsv');

const roadmapRows = readRoadmapRows();
const examReadyRows = roadmapRows
  .filter((row) => row.minExamReadyLessons > 0 && row.minCompletionChecksPerLesson > 0)
  .sort((left, right) => left.roadmapNode.localeCompare(right.roadmapNode));
const plan = readPlan();
const plannedRows = [...plan.areas]
  .sort((left, right) => left.roadmapNode.localeCompare(right.roadmapNode));
const plannedRowsByStudyOrder = [...plan.areas]
  .sort((left, right) => left.study.order - right.study.order);
const studyOrderIndex = new Map(plannedRowsByStudyOrder.map((area, index) => [area.roadmapNode, index]));

describe('Java 25 certification pre-implementation exercise map', () => {
  it('declares a synchronized roadmap-backed plan with flashcards and coding exercises', () => {
    assert.equal(plan.exam, 'Oracle Java SE 25 (1Z0-831)');
    assert.equal(plan.edition, 'Java 25');
    assert.ok(Array.isArray(plan.areas));
    assert.ok(plan.areas.length > 0);
    assert.equal(plan.studyProfile.sprintDays > 0, true);
    assert.equal(plan.studyProfile.sessionsPerDay > 0, true);
    assert.equal(plan.studyProfile.sessionMinutesMin > 0, true);
    assert.equal(plan.studyProfile.sessionMinutesMax > plan.studyProfile.sessionMinutesMin, true);
    assert.equal(plan.studyProfile.targetTotalMinutes > 0, true);
    assert.equal(plan.studyProfile.highYieldWindow > 0, true);
    assert.equal(plan.studyProfile.sequencing.length > 0, true);
  });

  it('aligns roadmap nodes to the current exam-ready roadmap rows', () => {
    const expectedNodes = examReadyRows.map((row) => row.roadmapNode);
    const plannedNodes = plannedRows.map((area) => area.roadmapNode);

    assert.deepEqual(plannedNodes, expectedNodes, 'pre-implementation map should mirror roadmap-coverage exam-ready rows');
  });

  it('keeps mapped tags synchronized with roadmap coverage and requires both exercise modes', () => {
    const rowByNode = new Map(roadmapRows.map((row) => [row.roadmapNode, row]));

    for (const area of plannedRows) {
      const row = rowByNode.get(area.roadmapNode);
      assert.notEqual(row, undefined, `${area.roadmapNode} should exist in roadmap-coverage.tsv`);
      assert.ok(area.expectedTags.length > 0, `${area.roadmapNode} should keep at least one expected tag`);
      assert.ok(row!.expectedTags.every((tag) => area.expectedTags.includes(tag)), `${area.roadmapNode} should include planned tags for the roadmap row`);

      assert.equal(Array.isArray(area.flashcards.questionPatterns), true, `${area.roadmapNode} flashcards should list question archetypes`);
      assert.ok(area.flashcards.minimumCount >= 6, `${area.roadmapNode} flashcards minimum should be practical`);
      assert.ok(area.flashcards.questionPatterns.length >= 2, `${area.roadmapNode} should include multiple flashcard archetypes`);
      assert.ok(area.flashcards.focus.trim().length > 0, `${area.roadmapNode} flashcard focus should be described`);

      assert.equal(Array.isArray(area.programmingExercises.exercisePatterns), true, `${area.roadmapNode} coding plan should list exercise archetypes`);
      assert.ok(area.programmingExercises.minimumCount >= 2, `${area.roadmapNode} should include at least two coding exercises`);
      assert.ok(area.programmingExercises.exercisePatterns.length >= 2, `${area.roadmapNode} should include multiple coding archetypes`);
      assert.ok(area.programmingExercises.focus.trim().length > 0, `${area.roadmapNode} coding focus should be described`);
      assert.equal(typeof area.study.order, 'number');
      assert.equal(area.study.priority >= 1 && area.study.priority <= 3, true);
      assert.equal(['foundation', 'integration', 'advanced-modern'].includes(area.study.phase), true);
      assert.ok(area.study.minimumSessions.flashcards >= 1, `${area.roadmapNode} should have at least one flashcard session`);
      assert.ok(area.study.minimumSessions.programming >= 1, `${area.roadmapNode} should have at least one coding session`);
      assert.ok(area.study.estimatedMinutes.total > 0, `${area.roadmapNode} should carry minute estimate`);
      assert.equal(
        area.study.estimatedMinutes.total,
        area.study.estimatedMinutes.flashcards + area.study.estimatedMinutes.programming,
        `${area.roadmapNode} total minutes should match component minutes`
      );
      assert.equal(area.study.exitCriteria.length > 0, true);
    }
  });

  it('models a practical fast-pass study order and effort envelope', () => {
    const orders = plannedRowsByStudyOrder.map((area) => area.study.order);
    assert.deepEqual(orders, [...orders].sort((left, right) => left - right), 'area study orders should be strictly increasing');

    const expectedTotal = plan.studyProfile.targetTotalMinutes;
    const plannedTotal = plannedRows.reduce((sum, area) => sum + area.study.estimatedMinutes.total, 0);
    assert.ok(
      plannedTotal >= expectedTotal,
      `planned minutes (${plannedTotal}) should meet or exceed the target (${expectedTotal})`
    );

    const highYield = plannedRowsByStudyOrder.filter((area) => area.study.priority === 1);
    assert.ok(highYield.length >= 8, 'at least eight high-yield areas should be clearly prioritized');
    assert.deepEqual(
      highYield.map((area) => area.study.order),
      Array.from({ length: highYield.length }, (_value, index) => index + 1),
      'high-yield areas should lead the study order'
    );

    const highYieldMinutes = highYield.reduce((sum, area) => sum + area.study.minimumSessions.flashcards, 0)
      + highYield.reduce((sum, area) => sum + area.study.minimumSessions.programming, 0);
    assert.ok(highYieldMinutes >= 2 * highYield.length, 'high-yield areas should map to at least two sessions each collectively');
  });

  it('validates prerequisite chains against roadmap coverage scope', () => {
    const roadmapNodes = new Set(roadmapRows.map((row) => row.roadmapNode));

    for (const area of plannedRows) {
      const normalized = [...new Set(area.prerequisites)];
      assert.deepEqual(area.prerequisites, normalized, `${area.roadmapNode} prerequisites should not repeat entries`);

      for (const prereq of normalized) {
        if (prereq.length === 0) {
          continue;
        }

        assert.ok(
          roadmapNodes.has(prereq),
          `${area.roadmapNode} prerequisite ${prereq} should map to a roadmap node`
        );
      }
    }
  });

  it('aligns prerequisite links to study order for coherent sequencing', () => {
    for (let index = 0; index < plannedRowsByStudyOrder.length; index += 1) {
      const area = plannedRowsByStudyOrder[index];
      for (const prerequisite of area.prerequisites) {
        const prerequisiteIndex = studyOrderIndex.get(prerequisite);

        assert.ok(prerequisiteIndex === undefined || prerequisiteIndex < index, `${area.roadmapNode} should not depend on future study steps (${prerequisite}).`);
        assert.notEqual(area.roadmapNode, prerequisite, `${area.roadmapNode} cannot list itself as a prerequisite.`);
      }
    }
  });

  it('does not allow empty or duplicate study plan ordering', () => {
    const uniqueOrders = new Set(usedOrders(plannedRows.map((area) => area.study.order)));

    assert.equal(uniqueOrders.size, plannedRows.length);

    const sorted = [...uniqueOrders].sort((left, right) => left - right);
    for (let index = 0; index < sorted.length; index += 1) {
      assert.equal(sorted[index], index + 1);
    }
  });

  it('does not add roadmap rows with exam-ready objectives but no pre-implementation area', () => {
    const missing = examReadyRows
      .filter((row) => !plannedRows.some((area) => area.roadmapNode === row.roadmapNode))
      .map((row) => row.roadmapNode);

    assert.deepEqual(missing, []);
  });

  it('keeps implemented lesson tracking synced with built-in lessons and promoted docs', () => {
    const builtInIds = new Set(builtInLessons.map((lesson) => lesson.id));
    const implementedIds = new Set(plan.areas.flatMap((area) => area.implementedLessonIds ?? []));

    for (const lessonId of implementedIds) {
      assert.ok(builtInIds.has(lessonId), `${lessonId} should exist as a built-in lesson`);
    }

    const lessonsDoc = fs.readFileSync(path.join(root, 'docs', 'lessons.md'), 'utf8');
    const start = lessonsDoc.indexOf('When a planned item is promoted');
    const end = lessonsDoc.indexOf('\n\nThe map includes', start);
    const promotedSection = lessonsDoc.slice(start, end);
    const documentedPromotions = [...promotedSection.matchAll(/`(java-[a-z0-9-]+-\d{2,})`/g)]
      .map((match) => match[1]!);

    assert.ok(documentedPromotions.length >= 16, 'docs/lessons.md should list promoted pre-map lessons');
    for (const lessonId of documentedPromotions) {
      assert.ok(implementedIds.has(lessonId), `${lessonId} should be recorded in implementedLessonIds`);
    }
  });

  it('requires each plan entry to define at least one learning dependency for sequencing', () => {
    for (const area of plannedRows) {
      assert.equal(Array.isArray(area.prerequisites), true, `${area.roadmapNode} prerequisites must be an array`);
      assert.ok(area.prerequisites.length <= 3, `${area.roadmapNode} should avoid deep sequencing chains`);
    }
  });
});

function readPlan(): PreImplementationMap {
  const raw = fs.readFileSync(mapPath, 'utf8');
  const parsed = JSON.parse(raw) as PreImplementationMap;
  assert.equal(typeof parsed.exam, 'string');
  assert.equal(typeof parsed.edition, 'string');
  assert.equal(Array.isArray(parsed.areas), true);
  assert.equal(typeof parsed.studyProfile, 'object');

  return parsed;
}

function usedOrders(orders: number[]): number[] {
  return orders.filter((order) => Number.isInteger(order) && order > 0);
}

function readRoadmapRows(): RoadmapRow[] {
  const lines = fs.readFileSync(roadmapPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const [header, ...rows] = lines;
  assert.equal(header, 'track\troadmapNode\texpectedTags\tminExamReadyLessons\tminCompletionChecksPerLesson');

  return rows.filter((line) => line.split('\t')[0] === 'java').map((line) => {
    const [track, roadmapNode, expectedTags, minExamReadyLessons, minCompletionChecksPerLesson] = line.split('\t');
    assert.equal(track, 'java');

    return {
      roadmapNode: roadmapNode!,
      expectedTags: expectedTags!
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      minExamReadyLessons: Number(minExamReadyLessons),
      minCompletionChecksPerLesson: Number(minCompletionChecksPerLesson)
    };
  });
}
