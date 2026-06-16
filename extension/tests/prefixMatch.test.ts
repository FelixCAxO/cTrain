import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { analyzePrefix, getGhostTextSegments } from '../src/training/prefixMatch';

describe('prefix matcher', () => {
  it('accepts an exact prefix and returns the remaining ghost text', () => {
    const result = analyzePrefix('class Demo {\n}', 'class Demo');

    assert.equal(result.ok, true);
    assert.equal(result.nextIndex, 'class Demo'.length);
    assert.equal(result.ghostText, ' {\n}');
    assert.equal(result.isComplete, false);
  });

  it('reports the first mismatched character without advancing the target cursor', () => {
    const result = analyzePrefix('return value;', 'retx');

    assert.equal(result.ok, false);
    assert.deepEqual(result.mistake, {
      actualIndex: 3,
      targetIndex: 3,
      expected: 'u',
      actual: 'x'
    });
    assert.equal(result.nextIndex, 3);
  });

  it('skips auto-closed bracket characters that are not the next target character', () => {
    const result = analyzePrefix('if (ready) {\n  run();\n}', 'if (ready) {}');

    assert.equal(result.ok, true);
    assert.equal(result.normalizedActual, 'if (ready) {');
    assert.equal(result.skippedClosers, 1);
    assert.equal(result.ghostText, '\n  run();\n}');
  });

  it('continues skipping an auto-closed closer after the user types inside the pair', () => {
    const result = analyzePrefix('if (ready) {', 'if (r)');

    assert.equal(result.ok, true);
    assert.equal(result.normalizedActual, 'if (r');
    assert.equal(result.skippedClosers, 1);
    assert.equal(result.ghostText, 'eady) {');
  });

  it('skips auto-closed quote characters without treating the second quote as typed input', () => {
    const result = analyzePrefix('const name = "Ada";', 'const name = ""');

    assert.equal(result.ok, true);
    assert.equal(result.normalizedActual, 'const name = "');
    assert.equal(result.skippedClosers, 1);
    assert.equal(result.ghostText, 'Ada";');
  });

  it('normalizes CRLF editor text to LF before matching multi-line lessons', () => {
    const target = 'def greet(name):\n    return f"Hello, {name}"\n';
    const actual = 'def greet(name):\r\n    return';

    const result = analyzePrefix(target, actual);

    assert.equal(result.ok, true);
    assert.equal(result.normalizedActual, 'def greet(name):\n    return');
  });

  it('builds one single-line ghost segment per target line after the typed prefix', () => {
    const target = 'public class Demo {\n  public void run() {\n  }\n}';
    const actual = 'public class Demo {\n  publ';

    const segments = getGhostTextSegments(target, actual);

    assert.deepEqual(segments, [
      { line: 1, character: 6, contentText: 'ic void run() {' },
      { line: 2, character: 0, contentText: '  }' },
      { line: 3, character: 0, contentText: '}' }
    ]);
  });

  it('meets the matcher latency budget for a 200-line target', () => {
    const target = Array.from({ length: 200 }, (_, index) => `line_${index}();`).join('\n');
    const actual = target.slice(0, Math.floor(target.length * 0.75));
    const startedAt = performance.now();

    const result = analyzePrefix(target, actual);
    const elapsedMs = performance.now() - startedAt;

    assert.equal(result.ok, true);
    assert.ok(elapsedMs < 5, `expected matcher under 5ms, got ${elapsedMs}ms`);
  });
});
