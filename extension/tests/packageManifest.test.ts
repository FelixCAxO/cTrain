import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'mocha';
import { builtInLessons } from '../src/lessons/builtInLessons';
import { validateLesson } from '../src/lessons/validator';
import * as validatorModule from '../src/lessons/validator';

const root = path.resolve(__dirname, '..');

interface PackageManifest {
  name: string;
  displayName: string;
  main: string;
  repository?: {
    type: string;
    url: string;
  };
  activationEvents: string[];
  contributes: {
    commands: { command: string; title?: string }[];
    configuration: {
      properties: Record<string, { default?: unknown }>;
    };
    views: {
      explorer: { id: string }[];
    };
    viewsWelcome: { contents: string }[];
    menus: {
      'editor/context': { command: string }[];
    };
  };
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
  files?: unknown;
}

interface LessonAuthoringSchema {
  required: string[];
  additionalProperties: boolean;
  properties: {
    $schema: { type: string };
    language: { enum: string[] };
    difficulty: { minimum: number; maximum: number };
    estimatedSeconds: { minimum: number; maximum: number };
    id: { pattern: string };
    tags: { items: { enum: string[] } };
    targetCode: { minLength: number };
    languageVersion: { enum: string[] };
  };
  allOf: {
    if?: { properties?: { language?: { const?: string } } };
    then: { properties: { languageVersion: { enum: string[] } } };
  }[];
}

describe('package manifest and synced assets', () => {
  const manifest = parseJson<PackageManifest>(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  it('keeps the repository root limited to README, LICENSE, and folders', () => {
    const repoRoot = path.resolve(root, '..');
    const rootFiles = fs.readdirSync(repoRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();

    assert.deepEqual(rootFiles, ['LICENSE', 'README.md']);
  });

  it('declares cTrain branding, commands, settings, and no inline provider contribution', () => {
    assert.equal(manifest.name, 'ctrain');
    assert.equal(manifest.displayName, 'cTrain (Code Training)');
    assert.equal(manifest.main, './dist/extension.js');
    assert.deepEqual(manifest.repository, {
      type: 'git',
      url: 'https://github.com/FelixCAxO/cTrain.git'
    });
    assert.deepEqual(manifest.activationEvents, [
      'onView:cTrain.lessons',
      'onCommand:cTrain.mockExam'
    ]);
    assert.deepEqual(manifest.contributes.commands.map((command: { command: string }) => command.command), [
      'cTrain.startLesson',
      'cTrain.practiceCurrentFile',
      'cTrain.mockExam',
      'cTrain.pauseSession',
      'cTrain.restartSession',
      'cTrain.sessionActions'
    ]);
    assert.equal(manifest.contributes.configuration.properties['cTrain.ghostTextOpacity'].default, 0.4);
    assert.equal(manifest.contributes.configuration.properties['cTrain.allowPaste'].default, false);
    assert.equal(manifest.contributes.views.explorer[0].id, 'cTrain.lessons');
    assert.match(manifest.contributes.viewsWelcome[0].contents, /Start Lesson/);
    assert.match(manifest.contributes.viewsWelcome[0].contents, /Practice Current File/);
    assert.match(manifest.contributes.viewsWelcome[0].contents, /Read the lesson guide/);
    assert.ok(manifest.contributes.menus['editor/context'].some((item: { command: string }) => item.command === 'cTrain.practiceCurrentFile'));
    assert.equal(JSON.stringify(manifest).includes('inlineCompletion'), false);
  });

  it('wires CI, lint, coverage, and bundled-artifact gates into package scripts', () => {
    assert.equal(manifest.scripts.lint, 'eslint src tests');
    assert.match(manifest.scripts.test, /npm run compile/);
    assert.match(manifest.scripts.test, /npm run lint/);
    assert.match(manifest.scripts.test, /npm run test:unit/);
    assert.match(manifest.scripts.test, /npm run build/);
    assert.match(manifest.scripts.test, /npm run test:bundle/);
    assert.equal(manifest.scripts['test:bundle'], 'node ./scripts/smoke-bundle.cjs');
    assert.match(manifest.scripts.coverage, /^c8 /);
    assert.match(manifest.scripts.coverage, /--include "src\/\*\*\/\*\.ts"/);
    assert.equal(manifest.scripts['roadmap:coverage'], 'node scripts/roadmap-coverage.cjs');
    assert.match(manifest.scripts.package, /--out \.\.\/releases\/ctrain-0\.1\.0\.vsix/);

    for (const dependency of ['eslint', 'typescript-eslint', 'eslint-plugin-import', 'c8']) {
      assert.ok(manifest.devDependencies[dependency], `${dependency} should be a dev dependency`);
    }

    assert.equal(fs.existsSync(path.join(root, 'eslint.config.mjs')), true);
    assert.equal(fs.existsSync(path.join(root, 'scripts', 'smoke-bundle.cjs')), true);
    assert.equal(fs.existsSync(path.join(root, 'scripts', 'roadmap-coverage.cjs')), true);
    assert.equal(
      fs.existsSync(path.join(root, 'scripts', 'generate-prog2-book-lessons.cjs')),
      false,
      'synthetic Prog2 book lesson generator should not remain checked in'
    );
    assert.equal(
      JSON.stringify(manifest.scripts).includes('generate-prog2-book-lessons'),
      false,
      'package scripts should not reference the deleted synthetic generator'
    );
    assert.equal(
      fs.existsSync(path.join(root, 'scripts', 'annotate-prog2-lessons.cjs')),
      false,
      'retired Prog2 annotator tooling should not remain checked in'
    );
    assert.match(fs.readFileSync(path.join(root, 'esbuild.mjs'), 'utf8'), /sourcemap:\s*'linked'/);
    assert.equal(fs.existsSync(path.join(root, '.c8rc.json')), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, '.c8rc.json'), 'utf8')), {
      'check-coverage': true,
      lines: 85,
      branches: 80
    });

    const ciPath = path.join(root, '..', '.github', 'workflows', 'ci.yml');
    assert.equal(fs.existsSync(ciPath), true);
    const ci = fs.readFileSync(ciPath, 'utf8');
    for (const expected of ['windows-latest', 'ubuntu-latest', 'working-directory: extension', 'cache-dependency-path: extension/package-lock.json', 'npm ci', 'npm test', 'npm run test:e2e', 'npm run coverage', 'xvfb-run -a', 'path: extension/coverage']) {
      assert.ok(ci.includes(expected), `ci.yml should include ${expected}`);
    }
  });

  it('keeps all seed lesson JSON files in sync with built-in lessons', () => {
    const lessonDir = path.join(root, 'lessons');
    const files = listLessonJsonFiles(lessonDir);
    const fileIds = files.map((file) => path.basename(file, '.json')).sort();
    const builtInIds = builtInLessons.map((lesson) => lesson.id).sort();

    assert.deepEqual(fileIds, builtInIds);

    for (const file of files) {
      const json = parseJson<unknown>(fs.readFileSync(file, 'utf8'));
      const validation = validateLesson(json);
      assert.equal(validation.ok, true, file);
      assert.deepEqual(json, builtInLessons.find((lesson) => lesson.id === path.basename(file, '.json')));
    }
  });

  it('stores built-in lessons in per-track folders with an authoring JSON schema', () => {
    const lessonDir = path.join(root, 'lessons');
    const trackDirectories = fs.readdirSync(lessonDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => entry.name)
      .sort();

    assert.deepEqual(trackDirectories, ['c', 'java', 'python']);
    assert.deepEqual(fs.readdirSync(lessonDir).filter((file) => file.endsWith('.json')), []);

    const schemaPath = path.join(lessonDir, '_schema', 'lesson.schema.json');
    const schema = parseJson<LessonAuthoringSchema>(fs.readFileSync(schemaPath, 'utf8'));
    assert.deepEqual(schema.required, [
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
    ]);
    assert.deepEqual(schema.properties.language.enum, ['java', 'c', 'python']);
    assert.equal(schema.properties.$schema.type, 'string');
    assert.equal(schema.properties.difficulty.minimum, 1);
    assert.equal(schema.properties.difficulty.maximum, 5);
    assert.equal(schema.properties.estimatedSeconds.minimum, 10);
    assert.equal(schema.properties.estimatedSeconds.maximum, 1800);
    assert.equal(schema.properties.id.pattern, '^[a-z0-9]+(?:-[a-z0-9]+)*-\\d{2,}$');
    assert.equal(schema.additionalProperties, false);
    assert.ok(schema.properties.tags.items.enum.includes('source-file'));
    assert.equal(schema.properties.targetCode.minLength, 1);
  });

  it('keeps the authoring schema in sync with runtime lesson validator constants', () => {
    const schemaPath = path.join(root, 'lessons', '_schema', 'lesson.schema.json');
    const schema = parseJson<LessonAuthoringSchema>(fs.readFileSync(schemaPath, 'utf8'));
    const runtime = validatorModule as typeof validatorModule & {
      lessonLanguages?: readonly string[];
      lessonIdPattern?: RegExp;
      lessonTags?: readonly string[];
      lessonLanguageVersionsByLanguage?: Record<string, readonly string[]>;
    };
    const versionEnum = [
      'Java 8',
      'Java 9',
      'Java 11',
      'Java 14',
      'Java 15',
      'Java 16',
      'Java 17',
      'Java 21',
      'Java 22',
      'Java 23',
      'Java 24',
      'Java 25',
      'Java 26',
      'C89',
      'C99',
      'C11',
      'C17',
      'C23',
      'Python 3.10',
      'Python 3.11',
      'Python 3.12',
      'Python 3.13',
      'Python 3.14'
    ];

    assert.deepEqual(runtime.lessonLanguages, schema.properties.language.enum);
    assert.equal(runtime.lessonIdPattern?.source, schema.properties.id.pattern);
    assert.deepEqual(runtime.lessonTags, schema.properties.tags.items.enum);
    assert.deepEqual(schema.properties.languageVersion.enum, versionEnum);

    const versionRules = schema.allOf
      .filter((rule): rule is {
        if: { properties: { language: { const: string } } };
        then: { properties: { languageVersion: { enum: string[] } } };
      } => rule.if?.properties?.language?.const !== undefined)
      .map((rule) => [
        rule.if.properties.language.const,
        rule.then.properties.languageVersion.enum
      ]);

    assert.deepEqual(Object.fromEntries(versionRules), runtime.lessonLanguageVersionsByLanguage);
  });

  it('ships user-facing docs and excludes course-specific and local assets from the vsix', () => {
    for (const doc of ['architecture.md', 'lessons.md', 'testing.md']) {
      const fullPath = path.join(root, 'docs', doc);
      assert.equal(fs.existsSync(fullPath), true, `${doc} should exist`);
      assert.ok(fs.readFileSync(fullPath, 'utf8').includes('cTrain'), `${doc} should mention cTrain`);
    }

    const lessonsDoc = fs.readFileSync(path.join(root, 'docs', 'lessons.md'), 'utf8');
    assert.ok(lessonsDoc.includes('learningGoals'));
    assert.ok(lessonsDoc.includes('defects'));
    assert.ok(lessonsDoc.includes('completionChecks'));
    assert.ok(lessonsDoc.includes('languageVersion'));
    assert.doesNotMatch(lessonsDoc, /Optional fields are .*steps/);
    assert.ok(lessonsDoc.includes('Java 24'));
    assert.ok(lessonsDoc.includes('Java 14'));
    assert.ok(lessonsDoc.includes('Java 17'));
    assert.ok(lessonsDoc.includes('Java 21'));
    assert.ok(lessonsDoc.includes('104 C, Java, and Python lessons'));
    assert.ok(lessonsDoc.includes('36 Prog2 reference lessons'));
    assert.equal(fs.existsSync(path.join(root, 'docs', 'prog2-liang-exercise-manifest.json')), false);
    assert.doesNotMatch(lessonsDoc, /lessons\/cpp\//);
    assert.doesNotMatch(lessonsDoc, /lessons\/typescript\//);
    assert.doesNotMatch(lessonsDoc, /C\+\+17/);
    assert.doesNotMatch(lessonsDoc, /TypeScript 5/);
    for (const lesson of builtInLessons) {
      assert.ok(lessonsDoc.includes(lesson.id), `docs/lessons.md should mention ${lesson.id}`);
    }

    assert.equal(manifest.files, undefined);

    const vscodeIgnore = fs.readFileSync(path.join(root, '.vscodeignore'), 'utf8');
    assert.ok(vscodeIgnore.includes('dist/meta.json'));
    assert.ok(vscodeIgnore.includes('coverage/**'));
    assert.ok(vscodeIgnore.includes('releases/**'));
    assert.ok(vscodeIgnore.includes('*.vsix'));
    assert.ok(vscodeIgnore.includes('.github/**'));
    assert.ok(vscodeIgnore.includes('.vscode/**'));
    assert.ok(vscodeIgnore.includes('prog2-lessons/**'));
    assert.ok(vscodeIgnore.includes('eslint.config.mjs'));
    const vscodeIgnoreLines = new Set(vscodeIgnore.split(/\r?\n/).filter(Boolean));
    assert.equal(vscodeIgnoreLines.has('docs/**'), false);
    assert.equal(vscodeIgnoreLines.has('lessons/**'), false);
  });

  it('keeps editor-local and generated files out of git tracking', () => {
    const gitIgnore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

    for (const expected of ['.vscode/']) {
      assert.ok(gitIgnore.includes(expected), `.gitignore should include ${expected}`);
    }
    assert.ok(gitIgnore.includes('*.vsix'), '.gitignore should ignore generated extension-workspace VSIX files by default');
  });

  it('presents a minimal first-use guide on the packaged extension page', () => {
    const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

    assert.ok(readme.includes('## How to use'));
    assert.ok(readme.includes('1. Press `Ctrl+Shift+P` to open the Command Palette.'));
    assert.ok(readme.includes('cTrain Explorer view'));
    assert.ok(readme.includes('If you used `Ctrl+P`, type `>cTrain` instead of `cTrain`.'));
    assert.ok(readme.includes('cTrain: Start Lesson'));
    assert.ok(readme.includes('cTrain: Practice Current File'));
    assert.ok(readme.includes('cTrain: Mock Exam'));
    assert.ok(readme.includes('104 C, Java, and Python typing lessons'));
    assert.ok(readme.includes('Typing tips'));
  });

  it('keeps READMEs synced with current development gates', () => {
    const readmes = [
      fs.readFileSync(path.join(root, '..', 'README.md'), 'utf8'),
      fs.readFileSync(path.join(root, 'README.md'), 'utf8')
    ];

    for (const readme of readmes) {
      for (const expected of [
        'npm test',
        'npm run coverage',
        'npm run test:e2e',
        'npm run test:all',
        'npm run package',
        'unit, bundle, and e2e checks together'
      ]) {
        assert.ok(readme.includes(expected), `README should mention ${expected}`);
      }
    }

    assert.ok(readmes[0].includes('npm ci'), 'repository README should mention npm ci');
    assert.ok(readmes[0].includes('extension/docs/testing.md'), 'repository README should link extension/docs/testing.md');
    assert.ok(readmes[1].includes('docs/testing.md'), 'extension README should link docs/testing.md');
  });

  it('keeps user-facing docs synced with commands and lesson authoring rules', () => {
    const architectureDoc = fs.readFileSync(path.join(root, 'docs', 'architecture.md'), 'utf8');
    const lessonsDoc = fs.readFileSync(path.join(root, 'docs', 'lessons.md'), 'utf8');
    const testingDoc = fs.readFileSync(path.join(root, 'docs', 'testing.md'), 'utf8');
    const runtime = validatorModule as typeof validatorModule & {
      lessonLanguageVersionsByLanguage?: Record<string, readonly string[]>;
    };

    for (const command of manifest.contributes.commands) {
      assert.ok(architectureDoc.includes(command.title ?? command.command), `architecture.md should mention ${command.title ?? command.command}`);
    }

    for (const versions of Object.values(runtime.lessonLanguageVersionsByLanguage ?? {})) {
      for (const version of versions) {
        assert.ok(lessonsDoc.includes(version), `docs/lessons.md should mention ${version}`);
      }
    }

    for (const expected of [
      '`$schema`',
      'difficulty 3+ lessons',
      '"minCompletionChecksPerLesson": 2',
      'C, Java, and Python roadmap rows'
    ]) {
      assert.ok(`${lessonsDoc}\n${testingDoc}`.includes(expected), `docs should mention ${expected}`);
    }
  });
});

function listLessonJsonFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('_')) {
        files.push(...listLessonJsonFiles(fullPath));
      }
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}
