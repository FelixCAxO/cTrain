import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { builtInLessons } from '../src/lessons/builtInLessons';
import { validateLesson } from '../src/lessons/validator';

const expectedFoundationLessons = [
  {
    id: 'java-access-modifiers-05',
    difficulty: 2,
    tokens: ['protected', 'private', 'final class']
  },
  {
    id: 'java-if-else-22',
    difficulty: 1,
    tokens: ['if (', 'else', '>=']
  },
  {
    id: 'java-string-methods-23',
    difficulty: 2,
    languageVersion: 'Java 11',
    tokens: ['isBlank', 'substring', 'contains']
  },
  {
    id: 'java-operators-assignment-24',
    difficulty: 1,
    tokens: ['+=', '++', '%']
  },
  {
    id: 'java-indexed-loop-27',
    difficulty: 2,
    tokens: ['for (int i = 0', 'break', 'continue']
  },
  {
    id: 'java-method-overload-28',
    difficulty: 2,
    tokens: ['format(String', 'format(int']
  },
  {
    id: 'java-reference-null-29',
    difficulty: 2,
    tokens: ['null', '==', 'NullPointerException']
  },
  {
    id: 'java-package-import-30',
    difficulty: 2,
    // List.of is a Java 9 API, so the lesson must not claim a Java 8 floor.
    languageVersion: 'Java 9',
    tokens: ['package', 'import java.util']
  },
  {
    id: 'java-interface-methods-31',
    difficulty: 3,
    tokens: ['default ', 'static ', 'private ']
  },
  {
    id: 'java-varargs-33',
    difficulty: 2,
    tokens: ['int... values', 'values.length', 'sum(']
  },
  {
    id: 'java-unnamed-variables-34',
    difficulty: 3,
    tokens: ['for (String _', 'catch (NumberFormatException _)', 'Java 22']
  },
  {
    id: 'java-enum-members-35',
    difficulty: 3,
    tokens: ['enum Level', 'private final', 'Level(int']
  },
  {
    id: 'java-equals-hashcode-37',
    difficulty: 4,
    languageVersion: 'Java 8',
    tokens: ['equals(Object obj)', 'User other = (User) obj;', 'hashCode()', 'compareTo']
  },
  {
    id: 'java-casting-overflow-38',
    difficulty: 3,
    tokens: ['(byte) 200', 'Math.addExact', 'Integer.MAX_VALUE']
  },
  {
    id: 'java-multicatch-custom-exception-39',
    difficulty: 3,
    languageVersion: 'Java 8',
    tokens: ['text.trim().isEmpty()', 'catch (', ' | ', 'extends Exception']
  },
  {
    id: 'java-executors-callable-41',
    difficulty: 4,
    tokens: ['ExecutorService', 'Callable', 'ConcurrentHashMap']
  },
  {
    id: 'java-time-formatting-43',
    difficulty: 3,
    // java.time types are not auto-imported in the snippet context, and the
    // prerequisite lesson's stated goal is typing java.time imports.
    tokens: ['DateTimeFormatter', 'ZoneId', 'Period', 'import java.time.ZonedDateTime;', 'import java.time.format.DateTimeFormatter;']
  }
] as const;

describe('foundation curriculum expansion', () => {
  const lessonsById = new Map(builtInLessons.map((lesson) => [lesson.id, lesson]));

  it('ships valid low-difficulty foundation lessons for common 1Z0-831 gaps', () => {
    for (const spec of expectedFoundationLessons) {
      const lesson = lessonsById.get(spec.id);

      assert.notEqual(lesson, undefined, `${spec.id} should be built in`);
      assert.equal(validateLesson(lesson).ok, true, spec.id);
      assert.equal(lesson!.difficulty, spec.difficulty, spec.id);
      if ('languageVersion' in spec) {
        assert.equal(lesson!.languageVersion, spec.languageVersion, spec.id);
      }

      for (const token of spec.tokens) {
        assert.ok(lesson!.targetCode.includes(token), `${spec.id} should include ${token}`);
      }
    }
  });
});
