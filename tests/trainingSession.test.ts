import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { TrainingSession } from '../src/training/trainingSession';
import { classifyTextChange } from '../src/training/pastePolicy';
import type { Lesson } from '../src/lessons/schema';
import { programmingSymbols } from './programmingSymbols';

const lesson: Lesson = {
  schemaVersion: 1,
  id: 'java-class-basic-01',
  version: 1,
  title: 'Java Class Basics',
  description: 'Type a minimal Java class.',
  language: 'java',
  difficulty: 1,
  estimatedSeconds: 90,
  tags: ['java', 'classes'],
  prerequisites: [],
  targetCode: 'public class Demo {\n  public static void main(String[] args) {\n  }\n}'
};

describe('training session', () => {
  it('starts with a target-backed empty document and ghost text for every line', () => {
    const session = new TrainingSession(lesson);

    assert.equal(session.documentText, '');
    assert.equal(session.status.isComplete, false);
    assert.equal(session.status.typedCharacters, 0);
    assert.deepEqual(session.ghostTextSegments.map((segment) => segment.contentText), [
      'public class Demo {',
      '  public static void main(String[] args) {',
      '  }',
      '}'
    ]);
  });

  it('shrinks ghost text one character at a time on accepted input', () => {
    const session = new TrainingSession(lesson);

    const result = session.applyDocumentText('p', [{ text: 'p', rangeLength: 0 }]);

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, 'p');
    assert.equal(session.ghostTextSegments[0].contentText, 'ublic class Demo {');
    assert.equal(session.status.typedCharacters, 1);
  });

  it('accepts every programming symbol as normal character input', () => {
    const symbolLesson: Lesson = {
      ...lesson,
      id: 'programming-symbols-99',
      targetCode: programmingSymbols
    };
    const session = new TrainingSession(symbolLesson);
    let editorText = '';

    for (const symbol of programmingSymbols) {
      editorText += symbol;
      const result = session.applyDocumentText(editorText, [{ text: symbol, rangeLength: 0 }]);

      assert.equal(result.accepted, true, `should accept programming symbol ${JSON.stringify(symbol)}`);
      assert.equal(session.documentText, editorText);
      assert.equal(session.status.typedCharacters, editorText.length);
      assert.equal(session.status.rejectedPasteCount, 0);
    }

    assert.equal(session.status.isComplete, true);
    assert.deepEqual(session.ghostTextSegments, []);
  });

  it('records a mistake squiggle range for the first invalid character', () => {
    const session = new TrainingSession(lesson);

    const result = session.applyDocumentText('publix', [{ text: 'publix', rangeLength: 0 }], { allowPaste: true });

    assert.equal(result.accepted, false);
    assert.equal(result.shouldRevert, true);
    assert.equal(result.reason, 'mistake');
    assert.equal(session.status.mistakeCount, 1);
    assert.deepEqual(session.mistakes[0], {
      actualIndex: 5,
      targetIndex: 5,
      expected: 'c',
      actual: 'x'
    });
    assert.equal(result.feedback, "expected 'c' got 'x' at line 1");
  });

  it('adds keyboard hints to symbol mistake feedback', () => {
    const symbolLesson: Lesson = {
      ...lesson,
      id: 'java-symbol-hint-99',
      targetCode: 'call(value);\nSystem.out.println(value);\nreturn value;'
    };
    const session = new TrainingSession(symbolLesson);

    const result = session.applyDocumentText('callx', [{ text: 'x', rangeLength: 0 }], { allowPaste: true });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'mistake');
    assert.equal(result.feedback, "expected '(' [Shift+9] got 'x' at line 1");
  });

  it('clears active mistake decorations after accepted input while preserving mistake history', () => {
    const session = new TrainingSession(lesson);

    session.applyDocumentText('publix', [{ text: 'publix', rangeLength: 0 }], { allowPaste: true });
    assert.equal(session.mistakes.length, 1);

    const result = session.applyDocumentText('p', [{ text: 'p', rangeLength: 0 }]);

    assert.equal(result.accepted, true);
    assert.equal(session.mistakes.length, 0);
    assert.equal(session.status.mistakeCount, 1);
  });

  it('rejects a paste of multiple characters by default without mutating session text', () => {
    const session = new TrainingSession(lesson);

    const result = session.applyDocumentText('not the lesson', [
      { text: 'not the lesson', rangeLength: 0 }
    ]);

    assert.equal(result.accepted, false);
    assert.equal(result.shouldRevert, true);
    assert.equal(result.reason, 'paste');
    assert.equal(result.insertedLength, 'not the lesson'.length);
    assert.equal(result.feedback, 'Paste is disabled to build muscle memory. Type the prompt instead.');
    assert.equal(session.documentText, '');
    assert.equal(session.status.rejectedPasteCount, 1);
  });

  it('shows the muscle-memory paste hint only once per session', () => {
    const session = new TrainingSession(lesson);

    const first = session.applyDocumentText('not the lesson', [
      { text: 'not the lesson', rangeLength: 0 }
    ]);
    const second = session.applyDocumentText('still pasted', [
      { text: 'still pasted', rangeLength: 0 }
    ]);

    assert.equal(first.reason, 'paste');
    assert.equal(first.feedback, 'Paste is disabled to build muscle memory. Type the prompt instead.');
    assert.equal(second.reason, 'paste');
    assert.equal(second.feedback, 'Paste is disabled for cTrain lessons.');
  });

  it('accepts an AltGr closing brace when VS Code reports pending CRLF layout with it', () => {
    const braceLesson: Lesson = {
      ...lesson,
      id: 'java-altgr-brace-99',
      targetCode: 'if (ready) {\n  return true;\n}'
    };
    const session = new TrainingSession(braceLesson);
    const firstLine = 'if (ready) {';
    const secondLine = `${firstLine}\n  return true;`;

    assert.equal(session.applyDocumentText(firstLine, [{ text: firstLine, rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.applyDocumentText(secondLine, [{ text: 'return true;', rangeLength: 0 }], { allowPaste: true }).accepted, true);

    const result = session.applyDocumentText(
      `${firstLine}\r\n  return true;\r\n}`,
      [{ text: '\r\n}', rangeLength: 0 }]
    );

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, `${firstLine}\n  return true;\n}`);
    assert.equal(session.status.isComplete, true);
    assert.equal(session.status.rejectedPasteCount, 0);
  });

  it('accepts an AltGr closing brace when VS Code reports an indentation replacement with it', () => {
    const braceLesson: Lesson = {
      ...lesson,
      id: 'java-altgr-formatted-brace-99',
      targetCode: 'if (ready) {\n  return true;\n  }'
    };
    const session = new TrainingSession(braceLesson);
    const firstLine = 'if (ready) {';
    const secondLine = `${firstLine}\n  return true;`;

    assert.equal(session.applyDocumentText(firstLine, [{ text: firstLine, rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.applyDocumentText(secondLine, [{ text: 'return true;', rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.documentText, `${secondLine}\n  `);

    const result = session.applyDocumentText(
      `${secondLine}\n  }`,
      [{ text: '  }', rangeLength: 2, rangeOffset: session.documentText.length - 2 }]
    );

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, `${secondLine}\n  }`);
    assert.equal(session.status.isComplete, true);
    assert.equal(session.status.rejectedPasteCount, 0);
  });

  it('accepts formatter indentation replacements when rangeOffset is based on CRLF editor text', () => {
    const braceLesson: Lesson = {
      ...lesson,
      id: 'java-altgr-crlf-offset-99',
      targetCode: 'if (ready) {\n  return true;\n  }'
    };
    const session = new TrainingSession(braceLesson);
    const firstLine = 'if (ready) {';
    const secondLine = `${firstLine}\n  return true;`;

    assert.equal(session.applyDocumentText(firstLine, [{ text: firstLine, rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.applyDocumentText(secondLine, [{ text: 'return true;', rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.documentText, `${secondLine}\n  `);

    const crlfCurrentText = session.documentText.replace(/\n/g, '\r\n');
    const result = session.applyDocumentText(
      `${secondLine.replace(/\n/g, '\r\n')}\r\n  }`,
      [{ text: '  }', rangeLength: 2, rangeOffset: crlfCurrentText.length - 2 }]
    );

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, `${secondLine}\n  }`);
    assert.equal(session.status.isComplete, true);
    assert.equal(session.status.rejectedPasteCount, 0);
  });

  it('accepts keyboard-layout symbols when VS Code reports indentation replacements', () => {
    for (const symbol of ['}', '[', ']', '\\', '|', '@', '~']) {
      const symbolLesson: Lesson = {
        ...lesson,
        id: `java-keyboard-symbol-${symbol.charCodeAt(0)}`,
        targetCode: `line\n  ${symbol}`
      };
      const session = new TrainingSession(symbolLesson);

      assert.equal(session.applyDocumentText('line', [{ text: 'line', rangeLength: 0 }], { allowPaste: true }).accepted, true);
      assert.equal(session.documentText, 'line\n  ');

      const result = session.applyDocumentText(
        `line\n  ${symbol}`,
        [{ text: `  ${symbol}`, rangeLength: 2, rangeOffset: session.documentText.length - 2 }]
      );

      assert.equal(result.accepted, true, symbol);
      assert.equal(session.documentText, `line\n  ${symbol}`);
      assert.equal(session.status.rejectedPasteCount, 0);
    }
  });

  it('accepts auto-closed openers when VS Code reports indentation replacements', () => {
    for (const [opener, closer] of [['{', '}'], ['[', ']'], ['"', '"'], ["'", "'"], ['`', '`']]) {
      const openerLesson: Lesson = {
        ...lesson,
        id: `java-autoclose-opener-${opener.charCodeAt(0)}`,
        targetCode: `line\n  ${opener}`
      };
      const session = new TrainingSession(openerLesson);

      assert.equal(session.applyDocumentText('line', [{ text: 'line', rangeLength: 0 }], { allowPaste: true }).accepted, true);
      assert.equal(session.documentText, 'line\n  ');

      const result = session.applyDocumentText(
        `line\n  ${opener}${closer}`,
        [{ text: `  ${opener}${closer}`, rangeLength: 2, rangeOffset: session.documentText.length - 2 }]
      );

      assert.equal(result.accepted, true, opener);
      assert.equal(session.documentText, `line\n  ${opener}`);
      assert.equal(session.status.rejectedPasteCount, 0);
    }
  });

  it('accepts tab-indented formatter replacements with one typed symbol', () => {
    const tabLesson: Lesson = {
      ...lesson,
      id: 'java-tab-formatting-99',
      targetCode: 'line\n\t}'
    };
    const session = new TrainingSession(tabLesson);

    assert.equal(session.applyDocumentText('line', [{ text: 'line', rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.documentText, 'line\n\t');

    const result = session.applyDocumentText(
      'line\n\t}',
      [{ text: '\t}', rangeLength: 1, rangeOffset: session.documentText.length - 1 }]
    );

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, 'line\n\t}');
    assert.equal(session.status.isComplete, true);
    assert.equal(session.status.rejectedPasteCount, 0);
  });

  it('accepts single-grapheme formatter replacements', () => {
    const graphemeLesson: Lesson = {
      ...lesson,
      id: 'java-grapheme-formatting-99',
      targetCode: 'line\n  e\u0301'
    };
    const session = new TrainingSession(graphemeLesson);

    assert.equal(session.applyDocumentText('line', [{ text: 'line', rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.documentText, 'line\n  ');

    const result = session.applyDocumentText(
      'line\n  e\u0301',
      [{ text: '  e\u0301', rangeLength: 2, rangeOffset: session.documentText.length - 2 }]
    );

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, 'line\n  e\u0301');
    assert.equal(session.status.isComplete, true);
    assert.equal(session.status.rejectedPasteCount, 0);
  });

  it('reports a mistake instead of paste when a formatter rewrite appends one wrong character', () => {
    const braceLesson: Lesson = {
      ...lesson,
      id: 'java-altgr-wrong-brace-99',
      targetCode: 'if (ready) {\n  return true;\n  }'
    };
    const session = new TrainingSession(braceLesson);
    const firstLine = 'if (ready) {';
    const secondLine = `${firstLine}\n  return true;`;

    assert.equal(session.applyDocumentText(firstLine, [{ text: firstLine, rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.applyDocumentText(secondLine, [{ text: 'return true;', rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.documentText, `${secondLine}\n  `);

    const result = session.applyDocumentText(
      `${secondLine}\n  ]`,
      [{ text: '  ]', rangeLength: 2, rangeOffset: session.documentText.length - 2 }]
    );

    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'mistake');
    assert.equal(session.status.mistakeCount, 1);
    assert.equal(session.status.rejectedPasteCount, 0);
  });

  it('rejects formatter-shaped replacements without usable range metadata', () => {
    const braceLesson: Lesson = {
      ...lesson,
      id: 'java-altgr-missing-range-99',
      targetCode: 'if (ready) {\n  return true;\n  }'
    };
    const session = new TrainingSession(braceLesson);
    const firstLine = 'if (ready) {';
    const secondLine = `${firstLine}\n  return true;`;

    assert.equal(session.applyDocumentText(firstLine, [{ text: firstLine, rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.applyDocumentText(secondLine, [{ text: 'return true;', rangeLength: 0 }], { allowPaste: true }).accepted, true);

    const result = session.applyDocumentText(
      `${secondLine}\n  }`,
      [{ text: '  }', rangeLength: 2 }]
    );

    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'paste');
    assert.equal(session.documentText, `${secondLine}\n  `);
    assert.equal(session.status.rejectedPasteCount, 1);
  });

  it('rejects formatter-shaped replacements when the range does not replace indentation', () => {
    const braceLesson: Lesson = {
      ...lesson,
      id: 'java-altgr-nonindent-range-99',
      targetCode: 'if (ready) {\n  return true;\n  }'
    };
    const session = new TrainingSession(braceLesson);
    const firstLine = 'if (ready) {';
    const secondLine = `${firstLine}\n  return true;`;

    assert.equal(session.applyDocumentText(firstLine, [{ text: firstLine, rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.applyDocumentText(secondLine, [{ text: 'return true;', rangeLength: 0 }], { allowPaste: true }).accepted, true);

    const result = session.applyDocumentText(
      `${secondLine}\n  }`,
      [{ text: '  }', rangeLength: 2, rangeOffset: 0 }]
    );

    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'paste');
    assert.equal(session.documentText, `${secondLine}\n  `);
    assert.equal(session.status.rejectedPasteCount, 1);
  });

  it('rejects formatter-shaped replacements that append multiple target characters', () => {
    const returnLesson: Lesson = {
      ...lesson,
      id: 'java-indented-paste-99',
      targetCode: 'if (ready) {\n  return true;'
    };
    const session = new TrainingSession(returnLesson);
    const firstLine = 'if (ready) {';

    assert.equal(session.applyDocumentText(firstLine, [{ text: firstLine, rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.documentText, `${firstLine}\n  `);

    const result = session.applyDocumentText(
      `${firstLine}\n  return`,
      [{ text: '  return', rangeLength: 2, rangeOffset: session.documentText.length - 2 }]
    );

    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'paste');
    assert.equal(session.documentText, `${firstLine}\n  `);
    assert.equal(session.status.rejectedPasteCount, 1);
  });

  it('accepts mixed changes when each edit is single-character input or a one-symbol formatting rewrite', () => {
    const mixedLesson: Lesson = {
      ...lesson,
      id: 'java-mixed-valid-edits-99',
      targetCode: 'ab\n  }x'
    };
    const session = new TrainingSession(mixedLesson);

    assert.equal(session.applyDocumentText('ab', [{ text: 'ab', rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.documentText, 'ab\n  ');

    const result = session.applyDocumentText('ab\n  }x', [
      { text: '  }', rangeLength: 2, rangeOffset: session.documentText.length - 2 },
      { text: 'x', rangeLength: 0, rangeOffset: session.documentText.length }
    ]);

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, 'ab\n  }x');
    assert.equal(session.status.rejectedPasteCount, 0);
  });

  it('rejects mixed changes when any sibling edit is paste-like', () => {
    const mixedLesson: Lesson = {
      ...lesson,
      id: 'java-mixed-paste-edits-99',
      targetCode: 'ab\n  }return'
    };
    const session = new TrainingSession(mixedLesson);

    assert.equal(session.applyDocumentText('ab', [{ text: 'ab', rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.documentText, 'ab\n  ');

    const result = session.applyDocumentText('ab\n  }return', [
      { text: '  }', rangeLength: 2, rangeOffset: session.documentText.length - 2 },
      { text: 'return', rangeLength: 0, rangeOffset: session.documentText.length }
    ]);

    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'paste');
    assert.equal(session.documentText, 'ab\n  ');
    assert.equal(session.status.rejectedPasteCount, 1);
  });

  it('rejects multi-character replacement paste by default', () => {
    const session = new TrainingSession(lesson);
    session.applyDocumentText('p', [{ text: 'p', rangeLength: 0 }]);

    const result = session.applyDocumentText('public', [{ text: 'ublic', rangeLength: 1 }]);

    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'paste');
    assert.equal(session.documentText, 'p');
    assert.equal(session.status.rejectedPasteCount, 1);
  });

  it('allows multi-character insertions that match the remaining target prefix', () => {
    const session = new TrainingSession(lesson);
    session.applyDocumentText('p', [{ text: 'p', rangeLength: 0 }]);

    const result = session.applyDocumentText('public', [{ text: 'ublic', rangeLength: 0 }]);

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, 'public');
    assert.equal(session.status.typedCharacters, 6);
  });

  it('allows undo and redo multi-character changes through the paste classifier', () => {
    assert.equal(classifyTextChange([{ text: 'abc', rangeLength: 0, reason: 'undo' }], false).kind, 'allowed');
    assert.equal(classifyTextChange([{ text: 'abc', rangeLength: 0, reason: 'redo' }], false).kind, 'allowed');
  });

  it('allows editor auto-indent and auto-close multi-character edits without treating them as paste', () => {
    assert.equal(classifyTextChange([{ text: '\n  ', rangeLength: 0 }], false).kind, 'allowed');
    assert.equal(classifyTextChange([{ text: '{}', rangeLength: 0 }], false).kind, 'allowed');
    assert.equal(classifyTextChange([{ text: '""', rangeLength: 0 }], false).kind, 'allowed');
  });

  it('automatically advances to the next target line after the user finishes a line', () => {
    const multilineLesson: Lesson = {
      ...lesson,
      id: 'java-two-lines-99',
      targetCode: 'import java.util.ArrayList;\nimport java.util.HashMap;'
    };
    const session = new TrainingSession(multilineLesson);

    const result = session.applyDocumentText(
      'import java.util.ArrayList;',
      [{ text: ';', rangeLength: 0 }]
    );

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, 'import java.util.ArrayList;\n');
    assert.equal(session.status.typedCharacters, 'import java.util.ArrayList;\n'.length);
    assert.deepEqual(session.ghostTextSegments, [
      { line: 1, character: 0, contentText: 'import java.util.HashMap;' }
    ]);
  });

  it('allows the user to backspace across an automatically inserted line break', () => {
    const multilineLesson: Lesson = {
      ...lesson,
      id: 'java-backspace-line-99',
      targetCode: 'abc\ndef'
    };
    const session = new TrainingSession(multilineLesson);

    session.applyDocumentText('abc', [{ text: 'c', rangeLength: 0 }]);

    const result = session.applyDocumentText('abc', [{ text: '', rangeLength: 1 }]);

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, 'abc');
    assert.equal(session.status.typedCharacters, 3);
    assert.deepEqual(session.ghostTextSegments, [
      { line: 1, character: 0, contentText: 'def' }
    ]);
  });

  it('rejects stale replacement events that would move progress back to an older prefix', () => {
    const staleLesson: Lesson = {
      ...lesson,
      id: 'java-stale-source-reload-99',
      targetCode: '// Learn: Handle a checked exception.\nimport java.io.IOException;\n\ntry'
    };
    const session = new TrainingSession(staleLesson);
    const initialText = session.documentText;
    const afterImport = `${initialText}import java.io.IOException;\n\n`;

    assert.equal(
      session.applyDocumentText(
        `${initialText}import java.io.IOException;`,
        [{ text: ';', rangeLength: 0 }]
      ).accepted,
      true
    );
    assert.equal(session.documentText, afterImport);

    const staleReload = session.applyDocumentText(initialText, [
      { text: '\n', rangeLength: 'import java.io.IOException;'.length + 1, rangeOffset: initialText.length - 1 }
    ]);

    assert.deepEqual(staleReload, {
      accepted: false,
      shouldRevert: true,
      reason: 'stale'
    });
    assert.equal(session.documentText, afterImport);
    assert.equal(session.status.typedCharacters, afterImport.length);
  });

  it('accepts backspace of a typed character without counting paste or mistake', () => {
    const shortLesson: Lesson = {
      ...lesson,
      id: 'java-backspace-character-99',
      targetCode: 'abcd'
    };
    const session = new TrainingSession(shortLesson);

    assert.equal(session.applyDocumentText('abc', [{ text: 'abc', rangeLength: 0 }], { allowPaste: true }).accepted, true);

    const result = session.applyDocumentText('ab', [{ text: '', rangeLength: 1 }]);

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, 'ab');
    assert.equal(session.status.typedCharacters, 2);
    assert.equal(session.status.mistakeCount, 0);
    assert.equal(session.status.rejectedPasteCount, 0);
    assert.deepEqual(session.ghostTextSegments, [
      { line: 0, character: 2, contentText: 'cd' }
    ]);
  });

  it('rebuilds ghost text after backspacing auto-inserted indentation', () => {
    const indentedLesson: Lesson = {
      ...lesson,
      id: 'java-backspace-indentation-99',
      targetCode: 'abc\n  def'
    };
    const session = new TrainingSession(indentedLesson);

    assert.equal(session.applyDocumentText('abc', [{ text: 'c', rangeLength: 0 }]).accepted, true);
    assert.equal(session.documentText, 'abc\n  ');

    const result = session.applyDocumentText('abc\n ', [{ text: '', rangeLength: 1 }]);

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, 'abc\n ');
    assert.equal(session.status.typedCharacters, 'abc\n '.length);
    assert.equal(session.status.mistakeCount, 0);
    assert.equal(session.status.rejectedPasteCount, 0);
    assert.deepEqual(session.ghostTextSegments, [
      { line: 1, character: 1, contentText: ' def' }
    ]);
  });

  it('automatically preserves blank target rows when consecutive enters are needed', () => {
    const blankLineLesson: Lesson = {
      ...lesson,
      id: 'java-blank-line-99',
      targetCode: 'import java.util.Map;\n\nMap<String, String> names = new HashMap<>();'
    };
    const session = new TrainingSession(blankLineLesson);

    const result = session.applyDocumentText(
      'import java.util.Map;',
      [{ text: ';', rangeLength: 0 }]
    );

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, 'import java.util.Map;\n\n');
    assert.equal(session.status.typedCharacters, 'import java.util.Map;\n\n'.length);
    assert.deepEqual(session.ghostTextSegments, [
      { line: 2, character: 0, contentText: 'Map<String, String> names = new HashMap<>();' }
    ]);
  });

  it('automatically follows indentation after skipped blank rows so annotations can be typed directly', () => {
    const annotationLesson: Lesson = {
      ...lesson,
      id: 'java-annotation-indentation-99',
      targetCode: 'public class Demo {\n\n  @Override\n  public String toString() {'
    };
    const session = new TrainingSession(annotationLesson);

    const lineComplete = session.applyDocumentText(
      'public class Demo {',
      [{ text: '{', rangeLength: 0 }]
    );

    assert.equal(lineComplete.accepted, true);
    assert.equal(session.documentText, 'public class Demo {\n\n  ');
    assert.equal(session.status.typedCharacters, 'public class Demo {\n\n  '.length);
    assert.deepEqual(session.ghostTextSegments[0], {
      line: 2,
      character: 2,
      contentText: '@Override'
    });

    const annotationStart = session.applyDocumentText(
      'public class Demo {\n\n  @',
      [{ text: '@', rangeLength: 0 }]
    );

    assert.equal(annotationStart.accepted, true);
    assert.equal(session.documentText, 'public class Demo {\n\n  @');
    assert.deepEqual(session.ghostTextSegments[0], {
      line: 2,
      character: 3,
      contentText: 'Override'
    });
  });

  it('automatically writes trailing line comments after code input and excludes them from WPM', () => {
    const commentLesson: Lesson = {
      ...lesson,
      id: 'java-autotyped-comments-99',
      targetCode: 'public int size() { // Returns the current size.\n  return size; // Sends size back to the caller.\n}'
    };
    const session = new TrainingSession(commentLesson, { clock: () => 1_000 });
    const firstCode = 'public int size() {';

    const result = session.applyDocumentText(firstCode, [{ text: '{', rangeLength: 0 }], { now: 61_000 });

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, `${firstCode} // Returns the current size.\n  `);
    assert.equal(session.status.typedCharacters, `${firstCode} // Returns the current size.\n  `.length);
    assert.equal(session.status.wpm, 4);
    assert.deepEqual(session.ghostTextSegments[0], {
      line: 1,
      character: 2,
      contentText: 'return size; // Sends size back to the caller.'
    });
  });

  it('keeps a fast next-line keystroke when it arrives before auto-comment sync', () => {
    const commentLesson: Lesson = {
      ...lesson,
      id: 'java-fast-autotyped-comment-99',
      targetCode: 'public int size() { // Returns the current size.\n  return size; // Sends size back to the caller.\n}'
    };
    const session = new TrainingSession(commentLesson);
    const firstCode = 'public int size() {';

    assert.equal(session.applyDocumentText(firstCode, [{ text: '{', rangeLength: 0 }]).accepted, true);

    const fastNextLineInput = session.applyDocumentText(`${firstCode}r`, [{ text: 'r', rangeLength: 0 }]);

    assert.equal(fastNextLineInput.accepted, true);
    assert.equal(session.documentText, `${firstCode} // Returns the current size.\n  r`);
    assert.deepEqual(session.ghostTextSegments[0], {
      line: 1,
      character: 3,
      contentText: 'eturn size; // Sends size back to the caller.'
    });
  });

  it('automatically writes indented comment-only lines after line completion', () => {
    const commentLesson: Lesson = {
      ...lesson,
      id: 'java-indented-comment-line-99',
      targetCode: 'if (ok) {\n  // Explains the guarded branch.\n  return true;\n}'
    };
    const session = new TrainingSession(commentLesson);

    const result = session.applyDocumentText('if (ok) {', [{ text: '{', rangeLength: 0 }]);

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, 'if (ok) {\n  // Explains the guarded branch.\n  ');
    assert.deepEqual(session.ghostTextSegments[0], {
      line: 2,
      character: 2,
      contentText: 'return true;'
    });
  });

  it('automatically writes a leading lesson header before the first typeable line', () => {
    const headerLesson: Lesson = {
      ...lesson,
      id: 'java-leading-lesson-header-99',
      targetCode: '// LESSON: Methods.\n// You will learn: return values.\npublic int size() {'
    };
    const session = new TrainingSession(headerLesson);

    assert.equal(session.documentText, '// LESSON: Methods.\n// You will learn: return values.\n');
    assert.equal(session.status.typedCharacters, session.documentText.length);
    assert.deepEqual(session.ghostTextSegments[0], {
      line: 2,
      character: 0,
      contentText: 'public int size() {'
    });
  });

  it('shows a commented exercise description before typeable solution code', () => {
    const exerciseLesson: Lesson = {
      ...lesson,
      id: 'java-leading-exercise-description-99',
      targetCode: [
        '// LESSON: Book Practice.',
        '// You will learn: solve the exercise.',
        '// EXERCISE: Implement the model with one field.',
        'class Demo {',
        '}'
      ].join('\n')
    };
    const session = new TrainingSession(exerciseLesson);

    assert.equal(
      session.documentText,
      [
        '// LESSON: Book Practice.',
        '// You will learn: solve the exercise.',
        '// EXERCISE: Implement the model with one field.',
        ''
      ].join('\n')
    );
    assert.deepEqual(session.ghostTextSegments[0], {
      line: 3,
      character: 0,
      contentText: 'class Demo {'
    });
  });

  it('keeps a fast first code keystroke when it arrives before leading header sync settles', () => {
    const headerLesson: Lesson = {
      ...lesson,
      id: 'java-fast-leading-header-99',
      targetCode: '// LESSON: Methods.\npublic int size() {'
    };
    const session = new TrainingSession(headerLesson);

    const result = session.applyDocumentText('p', [{ text: 'p', rangeLength: 0 }]);

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, '// LESSON: Methods.\np');
    assert.deepEqual(session.ghostTextSegments[0], {
      line: 1,
      character: 1,
      contentText: 'ublic int size() {'
    });
  });

  it('does not auto-skip comment markers inside string literals', () => {
    const urlLesson: Lesson = {
      ...lesson,
      id: 'java-url-string-99',
      targetCode: 'String url = "https://example.com";'
    };
    const session = new TrainingSession(urlLesson);

    const result = session.applyDocumentText('String url = "https:', [{ text: ':', rangeLength: 0 }], { allowPaste: true });

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, 'String url = "https:');
    assert.deepEqual(session.ghostTextSegments, [
      { line: 0, character: 'String url = "https:'.length, contentText: '//example.com";' }
    ]);
  });

  it('keeps a fast annotation marker when it arrives before indentation sync settles', () => {
    const annotationLesson: Lesson = {
      ...lesson,
      id: 'java-fast-annotation-99',
      targetCode: 'public class Demo {\n\n  @Override\n  public String toString() {'
    };
    const session = new TrainingSession(annotationLesson);
    const firstLine = 'public class Demo {';

    session.applyDocumentText(firstLine, [{ text: '{', rangeLength: 0 }]);
    const result = session.applyDocumentText(`${firstLine}@`, [{ text: '@', rangeLength: 0 }]);

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, `${firstLine}\n\n  @`);
    assert.deepEqual(session.ghostTextSegments[0], {
      line: 2,
      character: 3,
      contentText: 'Override'
    });
  });

  it('accepts a closing brace typed a few spaces before its auto-inserted target column', () => {
    const braceLesson: Lesson = {
      ...lesson,
      id: 'java-early-close-brace-99',
      targetCode: 'if (ready) { // Starts the guarded branch.\n    return true; // Returns from the branch.\n    }'
    };
    const session = new TrainingSession(braceLesson);
    const firstLine = 'if (ready) {';
    const secondLine = `${firstLine} // Starts the guarded branch.\n    return true;`;

    assert.equal(session.applyDocumentText(firstLine, [{ text: '{', rangeLength: 0 }]).accepted, true);
    assert.equal(session.applyDocumentText(secondLine, [{ text: 'return true;', rangeLength: 0 }], { allowPaste: true }).accepted, true);
    assert.equal(session.documentText, `${secondLine} // Returns from the branch.\n    `);

    const result = session.applyDocumentText(
      `${secondLine} // Returns from the branch.\n  }`,
      [{ text: '}', rangeLength: 0 }]
    );

    assert.equal(result.accepted, true);
    assert.equal(session.documentText, braceLesson.targetCode);
    assert.equal(session.status.isComplete, true);
    assert.equal(session.status.rejectedPasteCount, 0);
  });

  it('accepts a closing brace after auto-inserted indentation was shortened by a few spaces', () => {
    const braceLesson: Lesson = {
      ...lesson,
      id: 'java-shortened-indent-close-brace-99',
      targetCode: 'if (ready) { // Starts the guarded branch.\n    return true; // Returns from the branch.\n    }'
    };
    const session = new TrainingSession(braceLesson);
    const firstLine = 'if (ready) {';
    const secondLine = `${firstLine} // Starts the guarded branch.\n    return true;`;
    const shortenedIndentText = `${secondLine} // Returns from the branch.\n  `;

    assert.equal(session.applyDocumentText(firstLine, [{ text: '{', rangeLength: 0 }]).accepted, true);
    assert.equal(session.applyDocumentText(secondLine, [{ text: 'return true;', rangeLength: 0 }], { allowPaste: true }).accepted, true);

    const shortened = session.applyDocumentText(shortenedIndentText, [{ text: '', rangeLength: 2 }]);
    assert.equal(shortened.accepted, true);
    assert.equal(session.documentText, shortenedIndentText);

    const closing = session.applyDocumentText(`${shortenedIndentText}}`, [{ text: '}', rangeLength: 0 }]);

    assert.equal(closing.accepted, true);
    assert.equal(session.documentText, braceLesson.targetCode);
    assert.equal(session.status.isComplete, true);
    assert.equal(session.status.rejectedPasteCount, 0);
  });

  it('keeps a typed closing brace when a stale auto-closed brace is still before pending indentation', () => {
    const braceLesson: Lesson = {
      ...lesson,
      id: 'java-stale-autoclosed-close-brace-99',
      targetCode: 'if (ready) {\n  }'
    };
    const session = new TrainingSession(braceLesson);

    const opening = session.applyDocumentText('if (ready) {}', [{ text: '{}', rangeLength: 0 }]);

    assert.equal(opening.accepted, true);
    assert.equal(session.documentText, 'if (ready) {\n  ');

    const closing = session.applyDocumentText('if (ready) {}}', [{ text: '}', rangeLength: 0 }]);

    assert.equal(closing.accepted, true);
    assert.equal(session.documentText, braceLesson.targetCode);
    assert.equal(session.status.isComplete, true);
    assert.equal(session.status.rejectedPasteCount, 0);
  });

  it('marks completion and produces a progress record with duration and mistakes', () => {
    const shortLesson: Lesson = {
      ...lesson,
      id: 'java-short-99',
      targetCode: 'abcde'
    };
    const session = new TrainingSession(shortLesson, { clock: () => 1_000 });

    session.applyDocumentText('z', [{ text: 'z', rangeLength: 0 }]);
    session.applyDocumentText('abcde', [{ text: 'abcde', rangeLength: 0 }], { allowPaste: true, now: 61_000 });

    assert.equal(session.status.isComplete, true);
    assert.deepEqual(session.createCompletionRecord(), {
      lessonId: 'java-short-99',
      lessonVersion: 1,
      status: 'completed',
      completedAt: '1970-01-01T00:01:01.000Z',
      durationMs: 60_000,
      mistakeCount: 1,
      rejectedPasteCount: 0,
      typedCharacters: 5,
      wpm: 0,
      mistakes: [{
        actualIndex: 0,
        targetIndex: 0,
        expected: 'a',
        actual: 'z'
      }]
    });
  });

  it('emits a completion progress record only once', () => {
    const session = new TrainingSession(lesson, { clock: () => 1_000 });
    session.applyDocumentText(lesson.targetCode, [{ text: lesson.targetCode, rangeLength: 0 }], { allowPaste: true, now: 3_500 });

    assert.equal(session.consumeCompletionRecord()?.lessonId, 'java-class-basic-01');
    assert.equal(session.consumeCompletionRecord(), undefined);
  });

  it('ticks elapsed time without accepting more typed characters', () => {
    const session = new TrainingSession(lesson, { clock: () => 1_000 });

    session.applyDocumentText('public cla', [{ text: 'public cla', rangeLength: 0 }], { allowPaste: true, now: 4_000 });
    assert.equal(session.status.elapsedMs, 3_000);
    const percentComplete = session.status.percentComplete;

    session.tick(6_000);

    assert.equal(session.status.typedCharacters, 10);
    assert.equal(session.status.percentComplete, percentComplete);
    assert.equal(session.status.elapsedMs, 5_000);
    assert.equal(session.status.wpm, 24);
  });

  it('freezes ticked timing after completion', () => {
    const shortLesson: Lesson = {
      ...lesson,
      id: 'java-short-99',
      targetCode: 'public cla'
    };
    const session = new TrainingSession(shortLesson, { clock: () => 1_000 });

    session.applyDocumentText('public cla', [{ text: 'public cla', rangeLength: 0 }], { allowPaste: true, now: 4_000 });
    session.tick(20_000);

    assert.equal(session.status.isComplete, true);
    assert.equal(session.status.elapsedMs, 3_000);
  });

  it('gates WPM until enough elapsed time and typed characters are available', () => {
    const session = new TrainingSession(lesson, { clock: () => 1_000 });

    session.applyDocumentText('public cl', [{ text: 'public cl', rangeLength: 0 }], { allowPaste: true, now: 11_000 });
    assert.equal(session.status.wpm, 0);

    session.applyDocumentText('public cla', [{ text: 'a', rangeLength: 0 }], { now: 3_999 });
    assert.equal(session.status.wpm, 0);

    session.tick(4_000);
    assert.equal(session.status.wpm, 40);
  });
});
