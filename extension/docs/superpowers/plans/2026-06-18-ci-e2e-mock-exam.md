# CI E2E Mock Exam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the CI gate green and add real VS Code e2e coverage for the contributed `cTrain.mockExam` command.

**Architecture:** CI already passes locally, so this plan adds the smallest missing e2e coverage without production churn. The test drives the real command through the extension host, cancels the QuickPick, and proves no training editor opens.

**Tech Stack:** VS Code extension host e2e tests, Mocha, Node assert, npm scripts.

---

### Task 1: Mock Exam Command E2E Smoke

**Files:**
- Modify: `tests/e2e/suite/sessionInteractions.e2e.ts`
- Modify: `docs/testing.md`

- [ ] **Step 1: Write the e2e test first**

Add this test inside `suite('cTrain session interactions e2e', () => { ... })`:

```ts
  test('cancels the mock exam picker without opening a training editor', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');

    let examDone = false;
    const exam = Promise.resolve(vscode.commands.executeCommand('cTrain.mockExam')).finally(() => {
      examDone = true;
    });
    await delay(250);
    assert.equal(examDone, false);

    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
    await exam;

    assert.equal(vscode.window.visibleTextEditors.some((editor) => editor.document.uri.scheme === 'code-trainer'), false);
  });
```

- [ ] **Step 2: Run the e2e gate**

Run:

```powershell
npm run test:e2e
```

Expected: either the new test fails for a real mock-exam command issue, or it passes because the command wiring already works.

- [ ] **Step 3: Implement only if red**

If Step 2 fails, fix the root cause in `src/extension.ts` around `showMockExam` or `showTimedQuickPick`. Do not change production code if the new e2e test passes.

- [ ] **Step 4: Sync testing docs**

Update `docs/testing.md` so the e2e coverage list includes mock-exam command cancellation.

- [ ] **Step 5: Run CI-equivalent checks**

Run:

```powershell
npm test
npm run coverage
npm run test:e2e
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit on main**

Run:

```powershell
git add tests/e2e/suite/sessionInteractions.e2e.ts docs/testing.md docs/superpowers/plans/2026-06-18-ci-e2e-mock-exam.md
git commit -m "test: cover mock exam command e2e"
```
