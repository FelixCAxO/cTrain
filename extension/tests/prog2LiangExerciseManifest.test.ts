import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';

const root = path.resolve(process.cwd());
const manifestPath = path.join(root, 'docs', 'prog2-liang-exercise-manifest.json');
const prog2Root = path.join(root, 'prog2-lessons');

describe('retired Prog2 external-source manifest', () => {
  it('does not keep the removed external-source manifest in docs', () => {
    assert.equal(fs.existsSync(manifestPath), false);
  });

  it('keeps retained Prog2 references free of removed external-source terms', () => {
    const retainedJson = fs.readdirSync(prog2Root)
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map((file) => fs.readFileSync(path.join(prog2Root, file), 'utf8'))
      .join('\n');

    assert.doesNotMatch(retainedJson, /\bLiang\b/i);
    assert.doesNotMatch(retainedJson, /Z[- ]?Library/i);
    assert.doesNotMatch(retainedJson, /03_Literature/i);
    assert.doesNotMatch(retainedJson, /04_Exams/i);
    assert.doesNotMatch(retainedJson, /06_Exercises/i);
    assert.doesNotMatch(retainedJson, /\bUppgift\b/i);
    assert.doesNotMatch(retainedJson, /prog2-book-/i);
    assert.doesNotMatch(retainedJson, /prog2-exam-2025-/i);
    assert.doesNotMatch(retainedJson, /prog2-exam-style-/i);
  });

  it('documents the manifest retirement in the reference policy note', () => {
    const doc = fs.readFileSync(path.join(root, 'docs', 'prog2-exercise-expansion.md'), 'utf8');

    assert.match(doc, /retired/i);
    assert.match(doc, /reference-only/i);
    assert.doesNotMatch(doc, /source exercise reference/i);
  });
});
