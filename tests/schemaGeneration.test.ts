import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';
import { createLessonJsonSchema } from '../src/lessons/jsonSchema';

const root = path.resolve(__dirname, '..');

describe('lesson JSON schema generation', () => {
  it('keeps the checked-in authoring schema generated from runtime validator constants', () => {
    const checkedIn = parseJson<ReturnType<typeof createLessonJsonSchema>>(
      fs.readFileSync(path.join(root, 'lessons', '_schema', 'lesson.schema.json'), 'utf8')
    );

    assert.deepEqual(checkedIn, createLessonJsonSchema());
  });

  it('emits optional completionChecks authoring schema', () => {
    const schema = createLessonJsonSchema() as {
      required: string[];
      properties: {
        completionChecks?: {
          type: string;
          items: {
            required: string[];
            properties: {
              prompt: { type: string; minLength: number };
              choices: { type: string; minItems: number };
              answerIndex: { type: string; minimum: number };
              explanation: { type: string; minLength: number };
            };
          };
        };
      };
    };

    assert.equal(schema.required.includes('completionChecks'), false);
    assert.deepEqual(schema.properties.completionChecks?.items.required, [
      'prompt',
      'choices',
      'answerIndex',
      'explanation'
    ]);
    assert.equal(schema.properties.completionChecks?.items.properties.prompt.minLength, 1);
    assert.equal(schema.properties.completionChecks?.items.properties.choices.minItems, 2);
    assert.equal(schema.properties.completionChecks?.items.properties.answerIndex.minimum, 0);
    assert.equal(schema.properties.completionChecks?.items.properties.explanation.minLength, 1);
  });
});

function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}
