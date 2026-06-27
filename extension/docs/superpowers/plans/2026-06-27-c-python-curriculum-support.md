# C And Python Curriculum Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing C/Python curriculum support tests pass without adding the 91 C certification lessons yet.

**Architecture:** Extend the existing validator constants and generated schema, then add small seed lesson assets under the existing recursive loader. Keep mock exams Java-certification-only and teach comment skipping to recognize `#` for Python while preserving `//` for C/Java.

**Tech Stack:** TypeScript, Mocha, Node, existing lesson JSON loader.

---

### Task 1: Runtime Authoring Constants

**Files:**
- Modify: `extension/src/lessons/validator.ts`
- Modify: `extension/lessons/_schema/lesson.schema.json`
- Test: `extension/tests/lessonValidator.test.ts`

- [x] Confirm RED with targeted Mocha tests.
- [x] Add `c` and `python` to `lessonLanguages`.
- [x] Add C and Python version lists to `lessonLanguageVersionsByLanguage`.
- [x] Add requested C/Python tags to `lessonTags`.
- [x] Regenerate the checked-in authoring schema from `createLessonJsonSchema()`.

### Task 2: Runtime Behavior And Seed Assets

**Files:**
- Modify: `extension/src/lessons/lessonOrdering.ts`
- Modify: `extension/src/commands/examBlueprint.ts`
- Modify: `extension/src/training/sourceLesson.ts`
- Modify: `extension/src/training/trainingSession.ts`
- Create: `extension/lessons/c/*.json`
- Create: `extension/lessons/python/pcep/*.json`
- Create: `extension/lessons/python/pcap/*.json`
- Create: `extension/lessons/python/pcpp1/*.json`
- Test: `extension/tests/lessonOrdering.test.ts`, `extension/tests/mockExam.test.ts`, `extension/tests/sourceLesson.test.ts`, `extension/tests/trainingSession.test.ts`

- [x] Keep C and Python seed tracks after Java and before Prog2 references.
- [x] Filter mock-exam question banks to Java lessons.
- [x] Recognize C, Java, and Python current-file languages.
- [x] Auto-skip Python `#` comments like existing `//` teaching comments.
- [x] Add 6 C and 9 Python seed lessons with completion checks.

### Task 3: Docs, Roadmap, Verification, Commit

**Files:**
- Modify: `extension/docs/lessons.md`
- Modify: `extension/docs/architecture.md`
- Modify: `extension/docs/roadmap-coverage.tsv`
- Modify: `README.md`
- Modify: `extension/README.md`
- Create: `extension/docs/language-tracks.md`
- Test: `extension/tests/lessonRoadmapContent.test.ts`, `extension/tests/schemaGeneration.test.ts`

- [x] Document C/Python authoring support.
- [x] Add roadmap rows for public C, Java, and Python languages.
- [x] Run `npm test`.
- [x] Run `npm run roadmap:coverage -- --check`.
- [x] Review the diff.
- [x] Commit to `main` without pushing.
