import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'mocha';

const root = path.resolve(__dirname, '..');

describe('roadmap coverage report script', function () {
  this.timeout(10_000);
  it('reports roadmap nodes covered by lessons that contain the expected tags', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrain-roadmap-'));
    const lessonRoot = path.join(tempRoot, 'lessons');
    const javaDirectory = path.join(lessonRoot, 'java');
    const pythonDirectory = path.join(lessonRoot, 'python');
    fs.mkdirSync(javaDirectory, { recursive: true });
    fs.mkdirSync(pythonDirectory, { recursive: true });

    fs.writeFileSync(path.join(javaDirectory, 'java-if-else-22.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'java-if-else-22',
      version: 1,
      title: 'Java If Else',
      description: 'Practice conditional branches.',
      language: 'java',
      difficulty: 1,
      estimatedSeconds: 80,
      tags: ['java', 'conditionals', 'if-else'],
      prerequisites: [],
      completionChecks: [
        {
          prompt: 'Which branch runs when score is 60?',
          choices: ['if branch', 'else branch'],
          answerIndex: 0,
          explanation: 'The >= comparison includes 60, so the if branch runs.'
        }
      ],
      targetCode: 'if (score >= 60) {\n  pass();\n} else {\n  retry();\n}'
    }));
    fs.writeFileSync(path.join(pythonDirectory, 'python-list-comprehension-07.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'python-list-comprehension-07',
      version: 1,
      title: 'Python List Comprehension',
      description: 'Practice list comprehension syntax.',
      language: 'python',
      difficulty: 2,
      estimatedSeconds: 90,
      tags: ['python', 'list-comprehensions'],
      prerequisites: [],
      targetCode: 'names = [user.name for user in users]\nactive = [name for name in names if name]\nprint(active)'
    }));

    const tsvPath = path.join(tempRoot, 'roadmap.tsv');
    fs.writeFileSync(tsvPath, [
      'track\troadmapNode\texpectedTags\tminExamReadyLessons\tminCompletionChecksPerLesson',
      'java\tConditionals\tconditionals,if-else\t1\t1',
      'python\tList Comprehensions\tlist-comprehensions\t0\t0',
      'cpp\tSmart Pointers\tunique-ptr\t0\t0'
    ].join('\n'));

    const output = execFileSync(process.execPath, [
      path.join(root, 'scripts', 'roadmap-coverage.cjs'),
      lessonRoot,
      tsvPath
    ], { encoding: 'utf8' });

    assert.deepEqual(JSON.parse(output), [
      {
        track: 'java',
        roadmapNode: 'Conditionals',
        coveredBy: ['java-if-else-22'],
        examReadyBy: ['java-if-else-22'],
        minExamReadyLessons: 1,
        minCompletionChecksPerLesson: 1
      },
      {
        track: 'python',
        roadmapNode: 'List Comprehensions',
        coveredBy: ['python-list-comprehension-07'],
        examReadyBy: ['python-list-comprehension-07'],
        minExamReadyLessons: 0,
        minCompletionChecksPerLesson: 0
      },
      {
        track: 'cpp',
        roadmapNode: 'Smart Pointers',
        coveredBy: [],
        examReadyBy: [],
        minExamReadyLessons: 0,
        minCompletionChecksPerLesson: 0
      }
    ]);
  });

  it('fails --check when a roadmap node has no matching lesson', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrain-roadmap-check-'));
    const lessonRoot = path.join(tempRoot, 'lessons');
    const javaDirectory = path.join(lessonRoot, 'java');
    fs.mkdirSync(javaDirectory, { recursive: true });
    fs.writeFileSync(path.join(javaDirectory, 'java-if-else-22.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'java-if-else-22',
      version: 1,
      title: 'Java If Else',
      description: 'Practice conditional branches.',
      language: 'java',
      difficulty: 1,
      estimatedSeconds: 36,
      tags: ['java', 'conditionals', 'if-else'],
      prerequisites: [],
      targetCode: 'if (score >= 60) {\n  pass();\n} else {\n  retry();\n}'
    }));

    const tsvPath = path.join(tempRoot, 'roadmap.tsv');
    fs.writeFileSync(tsvPath, [
      'track\troadmapNode\texpectedTags\tminExamReadyLessons\tminCompletionChecksPerLesson',
      'java\tConditionals\tconditionals,if-else\t0\t0',
      'cpp\tSmart Pointers\tunique-ptr\t0\t0'
    ].join('\n'));

    const result = spawnSync(process.execPath, [
      path.join(root, 'scripts', 'roadmap-coverage.cjs'),
      '--check',
      lessonRoot,
      tsvPath
    ], { encoding: 'utf8' });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Uncovered roadmap rows/);
    assert.match(result.stderr, /cpp\/Smart Pointers/);
  });

  it('fails --check when a roadmap node is tag-covered but not exam-ready', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrain-roadmap-readiness-'));
    const lessonRoot = path.join(tempRoot, 'lessons');
    const javaDirectory = path.join(lessonRoot, 'java');
    fs.mkdirSync(javaDirectory, { recursive: true });
    fs.writeFileSync(path.join(javaDirectory, 'java-if-else-22.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'java-if-else-22',
      version: 1,
      title: 'Java If Else',
      description: 'Practice conditional branches.',
      language: 'java',
      difficulty: 1,
      estimatedSeconds: 36,
      tags: ['java', 'conditionals', 'if-else'],
      prerequisites: [],
      targetCode: 'if (score >= 60) {\n  pass();\n} else {\n  retry();\n}'
    }));

    const tsvPath = path.join(tempRoot, 'roadmap.tsv');
    fs.writeFileSync(tsvPath, [
      'track\troadmapNode\texpectedTags\tminExamReadyLessons\tminCompletionChecksPerLesson',
      'java\tConditionals\tconditionals,if-else\t1\t1'
    ].join('\n'));

    const result = spawnSync(process.execPath, [
      path.join(root, 'scripts', 'roadmap-coverage.cjs'),
      '--check',
      lessonRoot,
      tsvPath
    ], { encoding: 'utf8' });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Underprepared roadmap rows/);
    assert.match(result.stderr, /java\/Conditionals/);
  });

  it('fails --check when an exam objective has only one completion check but requires two', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrain-roadmap-two-checks-'));
    const lessonRoot = path.join(tempRoot, 'lessons');
    const javaDirectory = path.join(lessonRoot, 'java');
    fs.mkdirSync(javaDirectory, { recursive: true });
    fs.writeFileSync(path.join(javaDirectory, 'java-if-else-22.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'java-if-else-22',
      version: 1,
      title: 'Java If Else',
      description: 'Practice conditional branches.',
      language: 'java',
      difficulty: 1,
      estimatedSeconds: 36,
      tags: ['java', 'conditionals', 'if-else'],
      prerequisites: [],
      completionChecks: [
        {
          prompt: 'What does branch(true) return?',
          choices: ['pass', 'retry'],
          answerIndex: 0,
          explanation: 'The true branch returns pass.'
        }
      ],
      targetCode: 'if (score >= 60) {\n  pass();\n} else {\n  retry();\n}'
    }));

    const tsvPath = path.join(tempRoot, 'roadmap.tsv');
    fs.writeFileSync(tsvPath, [
      'track\troadmapNode\texpectedTags\tminExamReadyLessons\tminCompletionChecksPerLesson',
      'java\tConditionals\tconditionals,if-else\t1\t2'
    ].join('\n'));

    const result = spawnSync(process.execPath, [
      path.join(root, 'scripts', 'roadmap-coverage.cjs'),
      '--check',
      lessonRoot,
      tsvPath
    ], { encoding: 'utf8' });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Underprepared roadmap rows/);
    assert.match(result.stderr, /java\/Conditionals/);
  });

  it('passes --check for the checked-in roadmap TSV', () => {
    const result = spawnSync(process.execPath, [
      path.join(root, 'scripts', 'roadmap-coverage.cjs'),
      '--check',
      path.join(root, 'lessons'),
      path.join(root, 'docs', 'roadmap-coverage.tsv')
    ], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout) as {
      coveredBy: string[];
      examReadyBy: string[];
      minExamReadyLessons: number;
      minCompletionChecksPerLesson: number;
    }[];
    assert.ok(report.length > 0);
    assert.equal(report.every((row) => row.coveredBy.length > 0), true);
    assert.equal(report.every((row) => row.examReadyBy.length >= row.minExamReadyLessons), true);
    assert.equal(report.every((row) => row.minExamReadyLessons === 0 || row.minCompletionChecksPerLesson >= 2), true);
  });
});
