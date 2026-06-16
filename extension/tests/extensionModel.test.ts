import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createExtensionModel } from '../src/extensionModel';

describe('extension integration model', () => {
  it('uses cTrain commands and the code-trainer provider scheme', () => {
    const model = createExtensionModel();

    assert.deepEqual(model.commandIds, {
      startLesson: 'cTrain.startLesson',
      practiceCurrentFile: 'cTrain.practiceCurrentFile',
      mockExam: 'cTrain.mockExam'
    });
    assert.equal(model.providerScheme, 'code-trainer');
  });

  it('reads settings with the sprint defaults and clamps opacity', () => {
    const model = createExtensionModel({
      ghostTextOpacity: 3,
      mistakeStyle: 'outline',
      allowPaste: true
    });

    assert.equal(model.options.ghostTextOpacity, 1);
    assert.equal(model.options.mistakeStyle, 'outline');
    assert.equal(model.options.allowPaste, true);
  });
});
