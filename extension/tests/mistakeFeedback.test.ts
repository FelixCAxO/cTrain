import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { formatMistakeFeedback, formatMistakeHoverMessage } from '../src/training/trainingSession';

describe('mistake feedback formatting', () => {
  it('uses the same keyboard hints in status feedback and editor hover text', () => {
    const mistake = {
      actualIndex: 4,
      targetIndex: 4,
      expected: '(',
      actual: 'x'
    };

    assert.equal(
      formatMistakeFeedback('call(value);\nreturn value;\n', mistake),
      "expected '(' [Shift+9] got 'x' at line 1"
    );
    assert.equal(
      formatMistakeHoverMessage(mistake),
      "Expected '(' [Shift+9], got 'x'"
    );
  });
});
