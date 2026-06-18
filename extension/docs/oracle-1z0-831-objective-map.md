# Oracle 1Z0-831 Objective Map

Source: Oracle University, Java SE 25 Developer Professional Exam Number: 1Z0-831 (`https://education.oracle.com/java-se-25-developer-professional/pexam_1Z0-831`). The sub-objective wording was cross-checked against the public Java 25 versus Java 21 objective comparison at `https://coderanch.com/wiki/1011490/certification/Java-Java` because Oracle's commerce page renders most topic details client-side.

This file reconciles Oracle's published objective areas with cTrain's mock-exam blueprint and `docs/roadmap-coverage.tsv`. Every official sub-objective lists checked roadmap rows and, where a gap was closed, the dedicated lesson id. Packaging objective `7.2` / `7b` also names command-line artifact topics such as JARs and `jlink` so the published claim stays tied to Oracle's objective wording.

## 1. Handling Date, Time, Text, Numeric and Boolean Values

Blueprint: `values`

- `1.1` primitives, wrappers, arithmetic, boolean expressions, Math API, precedence, conversions, and casting: `Primitive Types`, `Numeric Casting Overflow Math`
- `1.2` text, text blocks, String, and StringBuilder: `Strings`, `Local Variables`; dedicated StringBuilder gap lesson `java-stringbuilder-mutation-87`
- `1.3` date, time, duration, period, instant, time zones, and daylight saving time: `Date Time`, `Time Formatting`

## 2. Implementing Program Flow Control Using Decision and Looping Constructs

Blueprint: `flow-control`

- `2.1` if/else, switch statements and expressions, loops, break, and continue: `Conditionals`, `Switch Expressions`, `Loops`

## 3. Applying Object-Oriented Principles in Java Programs

Blueprint: `oop`

- `3.1` objects, nested class objects, object lifecycle, reference reassignment, and garbage collection: `Class Basics`, `References`; dedicated gap lessons `java-nested-classes-84` and `java-gc-eligibility-88`
- `3.2` classes, records, fields, methods, constructors including flexible constructor bodies, and initializers: `Class Basics`, `Records`, `Static Members`, `Constructors`; dedicated initializer lesson `java-initializer-blocks-85`
- `3.3` overloaded methods and varargs: `Methods`, `Varargs`
- `3.4` variable scopes, encapsulation, immutable objects, local variable type inference, and unnamed variables: `Access Modifiers`, `Local Variables`, `Unnamed Variables`
- `3.5` inheritance, abstract and sealed types, record classes, overriding Object methods, polymorphism, object type, and reference type: `Inheritance`, `Abstract Classes`, `Sealed Types`, `Pattern Matching`, `Records`, `Equals HashCode Comparable`
- `3.6` interfaces, functional interfaces, private interface methods, static interface methods, and default interface methods: `Interfaces`, `Interface Methods`, `Functional Interfaces`
- `3.7` enum types with fields, methods, and constructors: `Enums`, `Enum Members`

## 4. Implementing Exception Handling in Java Applications

Blueprint: `exceptions`

- `4.1` try/catch/finally, try-with-resources, multi-catch blocks, and custom exceptions: `Exceptions`, `Multi Catch Custom Exceptions`, `Resource Management`

## 5. Using Arrays and Collections to Store and Retrieve Data

Blueprint: `collections`

- `5.1` arrays, List, Set, Map, Deque, sequenced collections, and element add/remove/update/retrieve/sort operations: `Arrays`, `Collections`, `Set Collections`, `Maps`, `Deque`, `Sequenced Collections`

## 6. Processing Data Using Streams and Lambda Expressions

Blueprint: `streams`

- `6.1` object streams, primitive streams, lambda expressions, functional interfaces, filtering, transforming, processing, and sorting: `Streams`, `Lambdas`, `Functional Interfaces`; dedicated primitive-stream lesson `java-primitive-streams-89`
- `6.2` decomposition, concatenation, reduction, grouping, partitioning, gather operations, sequential streams, and parallel streams: `Streams`, `Stream Partitioning`, `Sequenced Collections`; dedicated partitioning lesson `java-stream-partitioning-93`

## 7. Packaging and Deploying Java Code

Blueprint: `packaging`

- `7.1` / `7a` modules, exported content, reflection, dependencies, services, providers, consumers, and module import declarations: `Modules`; dedicated module-service lesson `java-module-services-86`
- `7.2` / `7b` compiling and running source code, compact source files, instance main methods, multi-file source-code programs, modular JARs, non-modular JARs, `jlink` runtime images, migration to modules, unnamed modules, and automatic module migration: `Modules`, `Class Basics`, `Methods`, `Packaging Artifacts`, `Unnamed Automatic Modules`; dedicated artifact lesson `java-packaging-artifacts-92`

## 8. Implementing Multithreading for Concurrent Code Execution

Blueprint: `concurrency`

- `8.1` platform threads, virtual threads, Runnable, Callable, thread lifecycle, Executor services, concurrent API, and scoped values: `Threads`, `Virtual Threads`, `Executor Services`, `Scoped Values`
- `8.2` thread-safe code, locking mechanisms, and concurrent API: `Concurrency Utilities`
- `8.3` concurrent collection processing and parallel streams: `Concurrency Utilities`, `Streams`; dedicated concurrent-collection lesson `java-concurrent-hashmap-90`

## 9. Performing Input and Output Operations Using the Java I/O API

Blueprint: `io`

- `9.1` console data, file data, and I/O streams: `IO Streams`, `File IO`; dedicated console-input lesson `java-console-input-91`
- `9.2` object serialization and de-serialization: `Serialization`
- `9.3` Path construction, traversal, creation, reading, writing, and properties through java.nio.file: `File IO`

## 10. Developing Applications with Localization Support

Blueprint: `localization`

- `10.1` locales, resource bundles, messages, dates, times, numbers, currency, and percentage formatting/parsing: `Localization`, `Time Formatting`

## Coverage Summary

- Official objective areas: 10/10 represented in `javaSe25ExamBlueprint`
- Official sub-objectives: 24/24 mapped to blueprint objectives and checked roadmap rows; no missing mappings
- Missing-objective lessons added: `java-nested-classes-84`, `java-initializer-blocks-85`, `java-module-services-86`, `java-packaging-artifacts-92`
- Thin-objective lessons added: `java-stringbuilder-mutation-87`, `java-gc-eligibility-88`, `java-primitive-streams-89`, `java-concurrent-hashmap-90`, `java-console-input-91`, `java-stream-partitioning-93`
- Checked roadmap rows: all in-scope Java SE 25 rows require exam-ready lessons and completion checks through `tests/lessonRoadmapContent.test.ts` and `npm run roadmap:coverage -- --check`
