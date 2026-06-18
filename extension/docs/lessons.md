# cTrain Lessons

cTrain (Code Training) lessons use schema version `1`.

Required fields are `schemaVersion`, `id`, `version`, `title`, `description`, `language`, `difficulty`, `estimatedSeconds`, `tags`, `prerequisites`, and `targetCode`. Optional fields are `learningGoals`, `defects`, `completionChecks`, and `languageVersion`. Authored lesson JSON is Java-only: use `language: "java"` and Java language versions `Java 8`, `Java 9`, `Java 11`, `Java 14`, `Java 15`, `Java 16`, `Java 17`, `Java 21`, `Java 22`, `Java 23`, `Java 24`, `Java 25`, or `Java 26`. Current-file practice is separate from authored lesson JSON and still preserves the VS Code language id from the active editor.

Built-in public lessons live under `lessons/java/`:

```text
lessons/
  _schema/lesson.schema.json
  java/
```

The TypeScript validator remains authoritative at runtime. `lessons/_schema/lesson.schema.json` matches the runtime-required fields and known field shapes for authoring-time JSON validation, including rejection of unknown fields, non-Java lesson languages, and unknown tags. New snippet lesson files should use compact `targetCode` blocks of 3 to 30 lines, keep `estimatedSeconds` between 10 and 1800, and keep prerequisite chains reachable and acyclic. Full source-file lessons tagged `source-file` are exempt from the snippet line-count and long-snippet estimate checks.

Use `learningGoals` for learner-facing outcomes shown in the picker and lesson tree tooltip. Use `defects[]` only for fix-the-code lessons; each entry is `{ "line": number, "hint": string }`, where `line` is one-based against the lesson source after any generated `// LESSON:` header is removed. Use `completionChecks[]` for exam-shaped recall prompts shown after completion and pooled by `cTrain: Mock Exam`; each check is `{ "prompt": string, "choices": string[], "answerIndex": number, "explanation": string }`, with a zero-based `answerIndex`. Runtime UI shuffles displayed choices and maps selections back to the authored answer index, so authoring order should stay readable but cannot be used as an answer cue. Every in-scope Java SE 25 roadmap row maps to at least one non-preview lesson with at least two completion checks; `tests/lessonRoadmapContent.test.ts` and `npm run roadmap:coverage -- --check` enforce that objective coverage. Every in-scope roadmap row also has at least three eligible pooled questions, and the built-in mock bank keeps at least 200 eligible questions so two 50-question mocks can be drawn from a meaningfully deeper pool. At least half of the pooled questions must be code-analysis prompts ("what prints", "does it compile", or "what is thrown"), and every certification lesson ships at least one such check, so practice mirrors the code-reading style of the Oracle Java SE 25 (1Z0-831) exam. `tests/lessonValidator.test.ts` keeps the pooled answer positions from clustering at a single index.

The public seed set ships 89 Java lessons. Lessons `01`-`45` are the foundational track; lessons `50`-`69` plus the `80`+ growth ids form the Java 25 Cert Exam category aligned with the Oracle Java SE 25 (1Z0-831) objectives (the original `50`-`69` band is full, so promoted cert exercises and gap-closure lessons continue at `80`+); and lessons `70`-`79` demonstrate headline Java 26 features. The Java 26 preview features (structured concurrency, lazy constants, primitive type patterns, and PEM encoding) carry the `preview` tag, the Vector API lesson flags its incubator module, and all Java 26 side-track lessons stay out of the certification exam:

- `java-class-basic-01`
- `java-method-return-02`
- `java-loop-array-03`
- `java-interface-04`
- `java-access-modifiers-05`
- `java-exceptions-try-catch-06`
- `java-collections-list-07`
- `java-map-counter-08`
- `java-constructor-encapsulation-09`
- `java-inheritance-extends-10`
- `java-abstract-class-11`
- `java-enum-switch-12`
- `java-lambda-functional-13`
- `java-generics-method-14`
- `java-optional-orelse-15`
- `java-stream-collect-16`
- `java-stream-groupby-17`
- `java-try-with-resources-18`
- `java-var-textblock-19`
- `java-thread-runnable-20`
- `java-primitives-types-21`
- `java-if-else-22`
- `java-string-methods-23`
- `java-operators-assignment-24`
- `java-arrays-init-25`
- `java-static-members-26`
- `java-indexed-loop-27`
- `java-method-overload-28`
- `java-reference-null-29`
- `java-package-import-30`
- `java-interface-methods-31`
- `java-functional-interfaces-32`
- `java-varargs-33`
- `java-unnamed-variables-34`
- `java-enum-members-35`
- `java-set-hashset-36`
- `java-equals-hashcode-37`
- `java-casting-overflow-38`
- `java-multicatch-custom-exception-39`
- `java-virtual-threads-40`
- `java-executors-callable-41`
- `java-time-localdate-42`
- `java-time-formatting-43`
- `java-http-client-44`
- `java-records-45`
- `java-instance-main-50`
- `java-flexible-constructors-51`
- `java-module-import-52`
- `java-module-declaration-53`
- `java-scoped-values-54`
- `java-sealed-types-55`
- `java-pattern-switch-56`
- `java-record-patterns-57`
- `java-switch-expression-58`
- `java-sequenced-collections-59`
- `java-deque-arraydeque-60`
- `java-nio-files-61`
- `java-io-streams-62`
- `java-serialization-63`
- `java-localization-64`
- `java-concurrency-locks-65`
- `java-parallel-stream-66`
- `java-stream-gatherers-67`
- `java-generics-wildcard-copy-68`
- `java-optional-lazy-fallback-69`
- `java-stream-lazy-pipeline-80`
- `java-checked-numeric-casts-81`
- `java-string-pool-equality-82`
- `java-mutable-hash-keys-83`
- `java-nested-classes-84`
- `java-initializer-blocks-85`
- `java-module-services-86`
- `java-stringbuilder-mutation-87`
- `java-gc-eligibility-88`
- `java-primitive-streams-89`
- `java-concurrent-hashmap-90`
- `java-console-input-91`
- `java-packaging-artifacts-92`
- `java-stream-partitioning-93`
- `java-http3-client-70`
- `java-structured-concurrency-71`
- `java-lazy-constants-72`
- `java-primitive-patterns-73`
- `java-pem-encoding-74`
- `java-final-fields-75`
- `java-applet-removal-76`
- `java-aot-object-caching-77`
- `java-g1-synchronization-78`
- `java-vector-api-79`

Every public snippet lesson opens its `targetCode` with a concise teaching comment and includes at least one short line-level concept note. Java 24/25/26 lessons (ids `50` and above) keep their two-line objective header - `// Java 24 ...`, `// Java 25 ...`, or `// Java 26 ...` followed by a `// Learn: ...` line - and preview lessons say `PREVIEW` in that header. cTrain auto-types `//` comments and excludes them from typing metrics, so the learner reads what the lesson teaches without typing the header.

The built-in loader walks `lessons/` recursively, ignores authoring-only folders whose names start with `_`, validates every lesson JSON file, keeps valid lessons when one file is malformed, and then sorts by curriculum category (Foundations, Java 25 Cert Exam, Java 26, Prog2 references, then unknown future categories); within each category it sorts direct prerequisites before dependents, then by numeric id suffix and id. The cert-exam growth ids (`80`+) therefore sit between `69` and the Java 26 band in the catalogue. This order is the lesson catalogue order used by the picker, tree, and completion `Next Lesson` action, so learners can start from any catalogue item and continue one lesson at a time. Missing prerequisite ids, cyclic prerequisite chains, and lessons depending on rejected prerequisites are rejected during loading.

Workspace lesson loading reads `.codetrainer/lessons/*.json`: invalid lessons are skipped without crashing, and valid Java workspace lessons can coexist with built-in lessons when ids are unique. Duplicate ids are rejected across both built-in and workspace lessons so progress keys remain unambiguous.

## Prog2 reference lessons

The Prog2 reference set is reference-only. The retained corpus is exactly 36 Prog2 reference lessons in `prog2-lessons/`, each using `language: "java"`, a `prog2-*` id, and the `source-file` tag. These lessons stay in the repository as owned Java reference material and are excluded from the published `ctrain-*.vsix` via `.vscodeignore`, so the public extension ships the `lessons/java/` set only.

Reference lessons are self-contained: every prerequisite points to another retained reference lesson, and the first reference has no removed prerequisite. `scripts/assert-prog2-coverage.cjs` guards the reference corpus, rejecting non-Java lessons, unexpected `prog2-*` files, removed corpus tags, stale prerequisites, duplicate ids, and removed source/provenance terms.

The external-source expansion manifest has been retired. Keep new Prog2 material as authored Java references with owned wording and compact practice examples. Do not add source-mapped exercise copies or one-off exam-drill files to this repository.

Roadmap coverage can be inspected with:

```powershell
npm run roadmap:coverage
npm run roadmap:coverage -- --check
```

The script reads `docs/roadmap-coverage.tsv` by default and prints JSON objects shaped as `{ "track": "...", "roadmapNode": "...", "coveredBy": ["lesson-id"], "examReadyBy": ["lesson-id"], "minExamReadyLessons": 1, "minCompletionChecksPerLesson": 1 }`. The current roadmap file intentionally contains Java rows only. Rows with non-zero readiness columns require non-preview lessons with enough `completionChecks`, so Java 26 side-track features do not count as Oracle Java SE 25 (1Z0-831) exam-ready coverage. `docs/oracle-1z0-831-objective-map.md` reconciles Oracle's published objective areas and sub-objectives against the mock-exam blueprint plus roadmap rows. Mock exams draw 50 certification-focused questions from that completion-check bank, excluding preview, Java 26, and HTTP client side-track lessons by default; they keep a 120-minute timer, sample by objective, persist objective-level results, and show missed-question explanations.

## Java 25 pre-implementation backlog

The pre-implementation map used for future exam content is `docs/java25-cert-preimplementation-map.json`.
It is isolated from live lesson execution and is tied to `docs/roadmap-coverage.tsv`.
It specifies flashcard and coding-exercise planning for each exam-ready Java 25 roadmap node.
When a planned item is promoted into the public curriculum, the roadmap node records it in `implementedLessonIds`; the promoted exercises so far are `java-generics-wildcard-copy-68` (Generics), `java-optional-lazy-fallback-69` (Optional), `java-stream-lazy-pipeline-80` (Streams), `java-checked-numeric-casts-81` (Numeric Casting Overflow Math), `java-string-pool-equality-82` (Strings), and `java-mutable-hash-keys-83` (Equals HashCode Comparable). The gap-closure lessons `java-nested-classes-84`, `java-initializer-blocks-85`, `java-module-services-86`, `java-stringbuilder-mutation-87`, `java-gc-eligibility-88`, `java-primitive-streams-89`, `java-concurrent-hashmap-90`, `java-console-input-91`, `java-packaging-artifacts-92`, and `java-stream-partitioning-93` turn previously missing or thin Oracle 1Z0-831 sub-objectives into dedicated non-preview lessons with at least two completion checks and at least one code-trace prompt.

The map includes `studyProfile`, so you can run a focused 12-day sprint without changing lesson assets:
- `sprintDays`: total sprint length (12 days in the current plan)
- `sessionsPerDay`: 3 sessions/day
- `sessionMinutesMin` / `sessionMinutesMax`: 25-45 minutes
- `targetTotalMinutes`: 900 minutes minimum across the sprint
- `highYieldWindow`: first 10 priority windows receive extra repetition pressure
- `dailyCadence`, `phaseAllocation`, and `mockDrills` to guide review cadence and checkpoints
