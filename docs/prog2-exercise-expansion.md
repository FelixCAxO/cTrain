# Prog2 Reference Package Policy

The previous external-source expansion has been retired. The Prog2 reference set is now reference-only and contains exactly 36 Prog2 reference lessons from `prog2-lessons/`.

The retained files follow these patterns:

- `prog2-b1-reference-*.json`
- `prog2-b2-reference-*.json`
- `prog2-ref-p2-*.json`

Each retained lesson is authored as Java, uses a `prog2-*` id, includes `prog2` and `source-file` tags, and points prerequisites only at another retained reference lesson. The first retained reference has no prerequisite.

Packaging policy:

- Public package: 82 Java lessons from `lessons/java/`. The published `ctrain-*.vsix` excludes `prog2-lessons/`.
- Reference corpus: 36 Prog2 reference lessons kept in `prog2-lessons/` as owned Java reference material, not bundled into the published extension.
- Guard: `scripts/assert-prog2-coverage.cjs` checks the 36-file reference-only corpus.

Do not add source-mapped exercise copies, one-off exam-drill files, removed corpus tags, stale prerequisites, or non-Java authored lesson JSON. New Prog2 material must be owned Java reference content with compact practice examples and learner-facing descriptions.
