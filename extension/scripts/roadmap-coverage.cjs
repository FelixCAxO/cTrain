const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const checkIndex = args.indexOf('--check');
const checkCoverage = checkIndex !== -1;
if (checkCoverage) {
  args.splice(checkIndex, 1);
}
const lessonRoot = path.resolve(args[0] ?? path.join(root, 'lessons'));
const roadmapPath = path.resolve(args[1] ?? path.join(root, 'docs', 'roadmap-coverage.tsv'));

const lessons = readLessons(lessonRoot);
const roadmapRows = readRoadmapRows(roadmapPath);

const report = roadmapRows.map((row) => {
  const coveredBy = lessons
    .filter((lesson) => lesson.language === row.track)
    .filter((lesson) => row.expectedTags.every((tag) => lesson.tags.includes(tag)))
    .map((lesson) => lesson.id)
    .sort();
  const examReadyBy = lessons
    .filter((lesson) => lesson.language === row.track)
    .filter(isCertificationLesson)
    .filter((lesson) => row.expectedTags.every((tag) => lesson.tags.includes(tag)))
    .filter((lesson) => countCompletionChecks(lesson) >= row.minCompletionChecksPerLesson)
    .map((lesson) => lesson.id)
    .sort();

  return {
    track: row.track,
    roadmapNode: row.roadmapNode,
    coveredBy,
    examReadyBy,
    minExamReadyLessons: row.minExamReadyLessons,
    minCompletionChecksPerLesson: row.minCompletionChecksPerLesson
  };
});

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (checkCoverage) {
  const gaps = report.filter((row) => row.coveredBy.length === 0);
  const underprepared = report.filter((row) => row.examReadyBy.length < row.minExamReadyLessons);
  if (gaps.length > 0) {
    process.stderr.write(`Uncovered roadmap rows: ${gaps.map((row) => `${row.track}/${row.roadmapNode}`).join(', ')}\n`);
    process.exitCode = 1;
  }
  if (underprepared.length > 0) {
    process.stderr.write(`Underprepared roadmap rows: ${underprepared.map((row) => `${row.track}/${row.roadmapNode}`).join(', ')}\n`);
    process.exitCode = 1;
  }
}

function countCompletionChecks(lesson) {
  return Array.isArray(lesson.completionChecks) ? lesson.completionChecks.length : 0;
}

function isCertificationLesson(lesson) {
  return !lesson.tags.includes('preview')
    && lesson.languageVersion !== 'Java 26'
    && !lesson.tags.includes('http-client');
}

function readLessons(directory) {
  return listJsonFiles(directory)
    .filter((file) => !file.split(path.sep).some((part) => part.startsWith('_')))
    .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
}

function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) {
    throw new Error(`Lesson directory not found: ${directory}`);
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

function readRoadmapRows(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const [header, ...rows] = lines;

  if (header !== 'track\troadmapNode\texpectedTags\tminExamReadyLessons\tminCompletionChecksPerLesson') {
    throw new Error('Roadmap TSV header must be: track\\troadmapNode\\texpectedTags\\tminExamReadyLessons\\tminCompletionChecksPerLesson');
  }

  return rows.map((line, index) => {
    const columns = line.split('\t');
    if (columns.length !== 5) {
      throw new Error(`Roadmap TSV row ${index + 2} must have 5 columns`);
    }

    const minExamReadyLessons = parseNonNegativeInteger(columns[3], `row ${index + 2} minExamReadyLessons`);
    const minCompletionChecksPerLesson = parseNonNegativeInteger(columns[4], `row ${index + 2} minCompletionChecksPerLesson`);

    return {
      track: columns[0],
      roadmapNode: columns[1],
      expectedTags: columns[2].split(',').map((tag) => tag.trim()).filter(Boolean),
      minExamReadyLessons,
      minCompletionChecksPerLesson
    };
  });
}

function parseNonNegativeInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== value) {
    throw new Error(`Roadmap TSV ${label} must be a non-negative integer`);
  }
  return parsed;
}
