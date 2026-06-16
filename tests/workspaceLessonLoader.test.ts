import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'mocha';
import { loadWorkspaceLessonFiles } from '../src/lessons/lessonLoader';

describe('workspace lesson file loading', () => {
  it('loads valid lessons from .codetrainer/lessons and reports invalid files', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-trainer-lessons-'));
    const lessonDir = path.join(workspaceRoot, '.codetrainer', 'lessons');
    fs.mkdirSync(lessonDir, { recursive: true });
    fs.writeFileSync(
      path.join(lessonDir, 'java-workspace-01.json'),
      JSON.stringify({
        schemaVersion: 1,
        id: 'java-workspace-01',
        version: 1,
        title: 'Workspace Java',
        description: 'A workspace-owned lesson.',
        language: 'java',
        difficulty: 2,
        estimatedSeconds: 100,
        tags: ['workspace'],
        prerequisites: [],
        targetCode: 'int value = 1;\nint next = value + 1;\nSystem.out.println(next);'
      })
    );
    fs.writeFileSync(path.join(lessonDir, 'broken.json'), '{not json');

    const result = loadWorkspaceLessonFiles(workspaceRoot);

    assert.deepEqual(result.lessons.map((item) => item.lesson.id), ['java-workspace-01']);
    assert.equal(result.lessons[0].source, 'workspace');
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /Invalid JSON/);
  });

  it('returns an empty result when a workspace has no .codetrainer lessons folder', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'code-trainer-empty-'));

    const result = loadWorkspaceLessonFiles(workspaceRoot);

    assert.deepEqual(result.lessons, []);
    assert.deepEqual(result.errors, []);
  });
});
