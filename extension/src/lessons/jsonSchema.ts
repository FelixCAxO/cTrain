import { lessonIdPattern, lessonLanguageVersionsByLanguage, lessonLanguages, lessonTags } from './validator';

type JsonSchemaValue = string | number | boolean | string[] | JsonSchemaObject | JsonSchemaValue[];

interface JsonSchemaObject {
  [key: string]: JsonSchemaValue;
}

const requiredLessonFields = [
  'schemaVersion',
  'id',
  'version',
  'title',
  'description',
  'language',
  'difficulty',
  'estimatedSeconds',
  'tags',
  'prerequisites',
  'targetCode'
] as const;

export function createLessonJsonSchema(): JsonSchemaObject {
  const languageVersionEnum = Object.values(lessonLanguageVersionsByLanguage).flat();

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://ctrain.local/schemas/lesson.schema.json',
    title: 'cTrain Lesson',
    type: 'object',
    additionalProperties: false,
    required: [...requiredLessonFields],
    properties: {
      $schema: { type: 'string' },
      schemaVersion: { const: 1 },
      id: {
        type: 'string',
        pattern: lessonIdPattern.source
      },
      version: {
        type: 'integer',
        minimum: 1
      },
      title: {
        type: 'string',
        minLength: 1
      },
      description: {
        type: 'string',
        minLength: 1
      },
      language: {
        type: 'string',
        enum: [...lessonLanguages]
      },
      difficulty: {
        type: 'integer',
        minimum: 1,
        maximum: 5
      },
      estimatedSeconds: {
        type: 'integer',
        minimum: 10,
        maximum: 1800
      },
      tags: stringArraySchema([...lessonTags]),
      prerequisites: stringArraySchema(),
      learningGoals: stringArraySchema(),
      defects: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['line', 'hint'],
          properties: {
            line: {
              type: 'integer',
              minimum: 1
            },
            hint: {
              type: 'string',
              minLength: 1
            }
          }
        }
      },
      completionChecks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['prompt', 'choices', 'answerIndex', 'explanation'],
          properties: {
            prompt: {
              type: 'string',
              minLength: 1
            },
            choices: {
              type: 'array',
              minItems: 2,
              items: {
                type: 'string',
                minLength: 1
              }
            },
            answerIndex: {
              type: 'integer',
              minimum: 0
            },
            explanation: {
              type: 'string',
              minLength: 1
            }
          }
        }
      },
      languageVersion: {
        type: 'string',
        minLength: 1,
        enum: languageVersionEnum
      },
      targetCode: {
        type: 'string',
        minLength: 1
      }
    },
    allOf: [
      ...Object.entries(lessonLanguageVersionsByLanguage).map(([language, versions]) => ({
        if: {
          required: [
            'language'
          ],
          properties: {
            language: {
              const: language
            }
          }
        },
        then: {
          properties: {
            languageVersion: {
              enum: [...versions]
            }
          }
        }
      })),
      {
        if: {
          required: [
            'difficulty'
          ],
          properties: {
            difficulty: {
              minimum: 3
            }
          }
        },
        then: {
          required: [
            'learningGoals',
            'languageVersion'
          ],
          properties: {
            learningGoals: {
              minItems: 1
            }
          }
        }
      }
    ]
  };
}

function stringArraySchema(itemEnum?: readonly string[]): JsonSchemaObject {
  return {
    type: 'array',
    items: {
      type: 'string',
      minLength: 1,
      ...(itemEnum === undefined ? {} : { enum: [...itemEnum] })
    }
  };
}
