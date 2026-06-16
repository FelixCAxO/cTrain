# cTrain Testing

cTrain (Code Training) uses TypeScript compile checks, typed ESLint checks, Mocha unit tests, a bundled-artifact smoke test, c8 coverage, and VS Code extension-host e2e tests.

Run the unit test gate:

```powershell
npm test
```

`npm test` runs `tsc --noEmit`, `eslint src tests`, the Mocha unit suite, the esbuild bundle, and `scripts/smoke-bundle.cjs`, which requires `dist/extension.js` and verifies the extension exports.

Run coverage:

```powershell
npm run coverage
```

Run the roadmap lesson coverage report:

```powershell
npm run roadmap:coverage
```

The roadmap report reads `docs/roadmap-coverage.tsv`, walks the recursive `lessons/` tree, and prints `{track, roadmapNode, coveredBy[], examReadyBy[], minExamReadyLessons, minCompletionChecksPerLesson}` JSON entries for lesson-authoring review. `npm run roadmap:coverage -- --check` fails when any in-scope Java SE 25 objective lacks at least one non-preview exam-ready lesson with at least two completion checks. The unit tests add publish-depth gates on top: every in-scope roadmap row needs at least three eligible pooled questions, the built-in mock bank needs at least 200 questions, at least half of that bank must be code-trace questions, and `docs/oracle-1z0-831-objective-map.md` must map every Oracle 1Z0-831 objective area and sub-objective to the blueprint plus roadmap rows. These are curriculum coverage guardrails, separate from the c8 code coverage report.

Run the extension-host e2e gate:

```powershell
npm run test:e2e
```

Run both gates:

```powershell
npm run test:all
```

Run the bundled build:

```powershell
npm run build
```

Create the installable VSIX:

```powershell
npm run package
```

`npm run package` builds the public `ctrain-*.vsix` and respects `.vscodeignore`, which excludes `prog2-lessons/`. The 36 retained Prog2 reference lessons stay in the repository as reference-only material and are not bundled into the published extension; `scripts/assert-prog2-coverage.cjs` guards that reference-only corpus.

The unit suite covers prefix matching, shared auto-close pair metadata, autoclose-aware matching after typing inside pairs, CRLF normalization, automatic line-break advancement including blank source rows, stranded-cursor recovery after blank-row auto sync, cursor targets for document sync and reset/open positioning, stale-prefix replacement rejection, stale-editor decoration repaint guards, per-document task serialization, printable ASCII programming punctuation, ghost text line segmentation, future-line ghost rendering, theme-token ghost prompt coloring, insertion and replacement paste policy, single-grapheme composed input, pending-layout keyboard symbol edits, closing braces typed a few spaces before their auto-inserted indentation target, stale auto-closed braces before pending automatic indentation, one-symbol formatter indentation rewrites, CRLF-based formatter offsets, formatter auto-close pairs, formatter single-grapheme replacements, mixed content-change events, paste-like formatter-shaped edits, first-time paste rejection messaging, active mistake clearing, backspace ghost rebuilds, mistake keyboard hints in status and hover formatting, one-shot completion progress records, WPM calculation, personal-best WPM/error tracking, catalogue ordering with `nextAfter` and `lessonsFrom`, catalogue-driven completion actions, lesson picker and tree curriculum grouping, shuffled completion-check answer choices, day 1/3/7 recall scheduling for missed completion checks, certification lesson code-analysis checks, Java SE 25 roadmap objective coverage, official Oracle 1Z0-831 objective mapping, gap-closure lessons for missing and thin objectives, mock exam 50-question/120-minute/68%-pass constants, 200-question bank depth, 50 percent code-trace ratio, objective-weighted mock selection and scoring, rolling readiness and final-week blind-spot signals, current-file and selection lesson creation, source-practice session id isolation, source-size guards, local language id preservation for theme colors, language-assigned document handoff, reset-to-initial-state coverage across all 82 public Java lessons and 36 Prog2 reference lessons, Java-only lesson validation, public lesson teaching-comment policy, completion-check bank breadth and answer-position distribution, prerequisite existence and cycle validation, recursive prerequisite suggestion chains, optional lesson metadata, duplicate workspace ids, Java seed lesson files, Prog2 sparse teaching-comment generation without filler narration, Prog2 reference-only corpus guards, package manifest discoverability, progress v1 and v2 migration, malformed progress fallback, serialized progress writes, failed-write immutability, lesson attempt history, mock exam attempt history, streak reminders including timezone boundaries, paused status bar formatting, and user-facing docs.

Extension-host e2e tests live under `tests/e2e/suite/*.e2e.ts` and are discovered automatically after TypeScript compilation. `tests/e2e/run.ts` gives each run a process-specific VS Code user-data directory, and the e2e Mocha runner retries once. The e2e suite covers command activation, lesson picker cancellation, real VS Code document editing, current-file practice with and without a selection, paste rejection rollback, formatter-shaped indentation replacement metadata, closing braces typed before the end of auto-inserted indentation, pause/resume behavior, restart behavior including current-file lessons with leading generated comments, config changes during a session, automatic blank-row skipping, platform line endings, active cursor placement after the editor follows the lesson text, current-file session isolation from reused virtual URIs, annotation markers after skipped indentation, and layout-independent typing of printable ASCII programming punctuation.

CI runs on Windows and Linux through `.github/workflows/ci.yml`. The Linux e2e job uses `xvfb-run -a`; both OS jobs run `npm ci`, `npm test`, `npm run coverage`, and `npm run test:e2e`.

Manual visual verification should open `cTrain: Start Lesson`, `cTrain: Practice Current File`, and `cTrain: Mock Exam` in VS Code and check Default Dark+, Default Light+, Solarized, High Contrast Dark, High Contrast Light, and at least one installed user theme such as Catppuccin with `cTrain.ghostTextOpacity` set to `0.4`.
