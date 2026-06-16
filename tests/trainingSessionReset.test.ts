import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';
import { builtInLessons } from '../src/lessons/builtInLessons';
import type { Lesson } from '../src/lessons/schema';
import { TrainingSession } from '../src/training/trainingSession';

const root = path.resolve(__dirname, '..');

describe('training session reset', () => {
  it('resets every authored exercise to its initial document, counters, and ghost text', () => {
    const lessons = [...builtInLessons, ...readProg2Lessons()];
    assert.equal(lessons.length, 118);

    for (const lesson of lessons) {
      const clock = () => 1_000;
      const initial = new TrainingSession(lesson, { clock });
      const dirty = new TrainingSession(lesson, { clock });
      const nextCharacter = lesson.targetCode[dirty.status.typedCharacters];

      if (nextCharacter !== undefined) {
        const accepted = dirty.applyDocumentText(
          `${dirty.documentText}${nextCharacter}`,
          [{ text: nextCharacter, rangeLength: 0 }],
          { now: 2_000 }
        );
        assert.equal(accepted.accepted, true, `${lesson.id} should accept its next catalogue character`);
      }

      dirty.applyDocumentText(
        `${dirty.documentText}not-the-current-exercise`,
        [{ text: 'not-the-current-exercise', rangeLength: 0 }],
        { now: 3_000 }
      );
      assert.ok(
        dirty.status.typedCharacters !== initial.status.typedCharacters
          || dirty.status.rejectedPasteCount > 0,
        `${lesson.id} should be dirty before reset`
      );

      const reset = dirty.reset();

      assert.notEqual(reset, dirty, `${lesson.id} should create a fresh session instance`);
      assert.equal(reset.lesson, lesson);
      assert.equal(reset.documentText, initial.documentText, lesson.id);
      assert.deepEqual(reset.status, initial.status, lesson.id);
      assert.deepEqual(reset.ghostTextSegments, initial.ghostTextSegments, lesson.id);
      assert.deepEqual(reset.mistakes, [], lesson.id);
      assert.equal(reset.consumeCompletionRecord(), undefined, lesson.id);
    }
  });
});

function readProg2Lessons(): Lesson[] {
  const prog2Root = path.join(root, 'prog2-lessons');
  return fs.readdirSync(prog2Root)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => JSON.parse(fs.readFileSync(path.join(prog2Root, file), 'utf8')) as Lesson);
}
