# cTrain

![cTrain logo](extension/docs/cTrain_logo.png)

Practice typing real code inside VS Code, with focused tracks for Java certification, Python certification, and C systems fundamentals.

> Personal project - the Java track is focused on Oracle Java SE 25 preparation. The broader cTrain goal is separate, focused practice tracks for Java, Python, and C.

## Lessons

104 C, Java, and Python typing lessons, grouped so the next choice is easier to scan:

- **Java** - foundations, Oracle Java SE 25 certification, and selected Java 26 features.
- **Python** - PCEP, PCAP, and PCPP1 certification-aligned practice.
- **C** - systems fundamentals: compilation, memory, pointers, arrays, structs, and debugging.

Each public snippet lesson opens with a concise teaching comment and includes a short key-line note where a new concept first appears.

See [language tracks](extension/docs/language-tracks.md) for the C / Java / Python split.

## How to use

1. Press `Ctrl+Shift+P` to open the Command Palette.
2. Run `cTrain: Start Lesson`.
3. Pick a lesson.
4. Type over the ghost text until the lesson is complete.
5. Run `cTrain: Mock Exam` when you want a scored, objective-weighted 50-question certification drill.

If you used `Ctrl+P`, type `>cTrain` instead of `cTrain`.

## Practice your own code

1. Open a source file.
2. Select the code you want to practice, or leave nothing selected to use the whole file.
3. Run `cTrain: Practice Current File` from the Command Palette or editor right-click menu.

## Typing tips

- Paste is blocked by default so the session measures typing, not copying. The first rejection explains the muscle-memory reason in the status bar.
- The status bar shows progress, WPM, elapsed time, and mistakes. When paused, it shows a warning-colored `[PAUSED]` prefix.
- Symbol mistakes include keyboard hints, such as `(` with `Shift+9`, in status feedback and editor hovers.
- After a lesson, choose `Next Lesson` to continue in catalogue order or `Retry` to repeat it.
- Wrong completion-check answers become recall reviews due on day 1, day 3, and day 7.
- Lesson rows show personal-best WPM with error rate and any due recall-review count.
- The lesson picker title tracks the 12-day, 900-minute Java 25 study sprint from the certification map.
- Mock exams draw from certification-focused lesson completion checks, shuffle answer choices, use the Java SE 25 50-question / 120-minute / 68% pass format, sample by objective, and save objective-level missed-question review.
- Mock summaries show the rolling last-5 average, whether the 3 consecutive 80% readiness gate is met, and any objectives below 70% in the final-week signal.

## Development

- Run `cd extension && npm ci` to install dependencies.
- Run `cd extension && npm test` to verify the extension.
- Run `cd extension && npm run package` to build `releases/ctrain-0.1.0.vsix`.
