import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';
import { javaSe25ExamBlueprint } from '../src/commands/examBlueprint';

const root = path.resolve(__dirname, '..');
const objectiveMapPath = path.join(root, 'docs', 'oracle-1z0-831-objective-map.md');

const officialObjectives = [
  {
    id: '1',
    blueprintId: 'values',
    label: 'Handling Date, Time, Text, Numeric and Boolean Values',
    subobjectives: ['1.1', '1.2', '1.3']
  },
  {
    id: '2',
    blueprintId: 'flow-control',
    label: 'Implementing Program Flow Control Using Decision and Looping Constructs',
    subobjectives: ['2.1']
  },
  {
    id: '3',
    blueprintId: 'oop',
    label: 'Applying Object-Oriented Principles in Java Programs',
    subobjectives: ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7']
  },
  {
    id: '4',
    blueprintId: 'exceptions',
    label: 'Implementing Exception Handling in Java Applications',
    subobjectives: ['4.1']
  },
  {
    id: '5',
    blueprintId: 'collections',
    label: 'Using Arrays and Collections to Store and Retrieve Data',
    subobjectives: ['5.1']
  },
  {
    id: '6',
    blueprintId: 'streams',
    label: 'Processing Data Using Streams and Lambda Expressions',
    subobjectives: ['6.1', '6.2']
  },
  {
    id: '7',
    blueprintId: 'packaging',
    label: 'Packaging and Deploying Java Code',
    subobjectives: ['7.1', '7.2']
  },
  {
    id: '8',
    blueprintId: 'concurrency',
    label: 'Implementing Multithreading for Concurrent Code Execution',
    subobjectives: ['8.1', '8.2', '8.3']
  },
  {
    id: '9',
    blueprintId: 'io',
    label: 'Performing Input and Output Operations Using the Java I/O API',
    subobjectives: ['9.1', '9.2', '9.3']
  },
  {
    id: '10',
    blueprintId: 'localization',
    label: 'Developing Applications with Localization Support',
    subobjectives: ['10.1']
  }
] as const;

const roadmapNodesBySubobjective = new Map<string, readonly string[]>([
  ['1.1', ['Primitive Types', 'Numeric Casting Overflow Math']],
  ['1.2', ['Strings', 'Local Variables']],
  ['1.3', ['Date Time', 'Time Formatting']],
  ['2.1', ['Conditionals', 'Switch Expressions', 'Loops']],
  ['3.1', ['Class Basics', 'References']],
  ['3.2', ['Class Basics', 'Records', 'Static Members', 'Constructors']],
  ['3.3', ['Methods', 'Varargs']],
  ['3.4', ['Access Modifiers', 'Local Variables', 'Unnamed Variables']],
  ['3.5', ['Inheritance', 'Abstract Classes', 'Sealed Types', 'Pattern Matching', 'Records', 'Equals HashCode Comparable']],
  ['3.6', ['Interfaces', 'Interface Methods', 'Functional Interfaces']],
  ['3.7', ['Enums', 'Enum Members']],
  ['4.1', ['Exceptions', 'Multi Catch Custom Exceptions', 'Resource Management']],
  ['5.1', ['Arrays', 'Collections', 'Set Collections', 'Maps', 'Deque', 'Sequenced Collections']],
  ['6.1', ['Streams', 'Lambdas', 'Functional Interfaces']],
  ['6.2', ['Streams', 'Sequenced Collections']],
  ['7.1', ['Modules']],
  ['7.2', ['Modules', 'Class Basics', 'Methods']],
  ['8.1', ['Threads', 'Virtual Threads', 'Executor Services', 'Scoped Values']],
  ['8.2', ['Concurrency Utilities']],
  ['8.3', ['Concurrency Utilities', 'Streams']],
  ['9.1', ['IO Streams', 'File IO']],
  ['9.2', ['Serialization']],
  ['9.3', ['File IO']],
  ['10.1', ['Localization', 'Time Formatting']]
]);

describe('Oracle 1Z0-831 objective mapping', () => {
  it('keeps every official objective area represented in the mock-exam blueprint', () => {
    assert.deepEqual(
      javaSe25ExamBlueprint.objectives.map((objective) => objective.id),
      officialObjectives.map((objective) => objective.blueprintId)
    );

    for (const official of officialObjectives) {
      const blueprint = javaSe25ExamBlueprint.objectives.find((objective) => objective.id === official.blueprintId);
      assert.notEqual(blueprint, undefined, `${official.id} should have a blueprint objective`);
      assert.equal(blueprint!.label, official.label);
    }
  });

  it('maps every official sub-objective to at least one checked-in roadmap node', () => {
    const roadmapNodes = new Set(readRoadmapRows().map((row) => row.roadmapNode));
    const unmapped = officialObjectives
      .flatMap((objective) => objective.subobjectives)
      .filter((subobjective) => {
        const nodes = roadmapNodesBySubobjective.get(subobjective) ?? [];
        return nodes.length === 0 || !nodes.every((node) => roadmapNodes.has(node));
      });

    assert.deepEqual(unmapped, []);
  });

  it('documents every official objective and sub-objective in the published mapping', () => {
    assert.equal(fs.existsSync(objectiveMapPath), true, 'docs/oracle-1z0-831-objective-map.md should exist');
    const document = fs.readFileSync(objectiveMapPath, 'utf8');

    for (const official of officialObjectives) {
      assert.match(document, new RegExp(`\\b${escapeRegExp(official.id)}\\b`));
      assert.ok(document.includes(official.label), `${official.label} should be documented`);
      assert.ok(document.includes(`Blueprint: \`${official.blueprintId}\``), `${official.blueprintId} should be documented`);

      for (const subobjective of official.subobjectives) {
        assert.ok(document.includes(`\`${subobjective}\``), `${subobjective} should be documented`);
        for (const node of roadmapNodesBySubobjective.get(subobjective) ?? []) {
          assert.ok(document.includes(`\`${node}\``), `${subobjective} should cite roadmap node ${node}`);
        }
      }
    }

    assert.doesNotMatch(document, /\bUnmapped\b/i);
  });
});

function readRoadmapRows(): { roadmapNode: string }[] {
  return fs.readFileSync(path.join(root, 'docs', 'roadmap-coverage.tsv'), 'utf8')
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [, roadmapNode] = line.split('\t');
      return { roadmapNode: roadmapNode! };
    });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
