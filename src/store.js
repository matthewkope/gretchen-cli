import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = path.join(os.homedir(), '.gretchen');
const TASKS_FILE = path.join(DIR, 'tasks.md');
const ARCHIVE_FILE = path.join(DIR, 'archive.md');

const TASK_RE = /^- \[( |x)\] (.*)$/;
const TAG_RE = /#[\w][\w/-]*/g;

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

// Obsidian Tasks emoji format: description first, then 📅 due and ✅ done at the end.
// https://publish.obsidian.md/tasks/
export function formatTask(task) {
  let line = `- [${task.done ? 'x' : ' '}] ${task.title}`;
  if (task.date) line += ` 📅 ${task.date}`;
  if (task.doneDate) line += ` ✅ ${task.doneDate}`;
  return line;
}

export function parseLine(line) {
  const m = line.match(TASK_RE);
  if (!m) return null;
  let rest = m[2];
  let date = null;
  let doneDate = null;
  // 📅 is current format; @date is the pre-emoji format, migrated on next save
  const due = rest.match(/(?:📅|@)\s?(\d{4}-\d{2}-\d{2})/u);
  if (due) {
    date = due[1];
    rest = rest.replace(due[0], '');
  }
  const done = rest.match(/✅\s?(\d{4}-\d{2}-\d{2})/u);
  if (done) {
    doneDate = done[1];
    rest = rest.replace(done[0], '');
  }
  return { done: m[1] === 'x', title: rest.replace(/\s{2,}/g, ' ').trim(), date, doneDate };
}

export function getTags(task) {
  return [...new Set(task.title.match(TAG_RE) || [])];
}

function loadFile(file, header) {
  ensureDir();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `# ${header}\n\n`);
    return [];
  }
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map(parseLine)
    .filter(Boolean);
}

function saveFile(file, header, tasks) {
  ensureDir();
  fs.writeFileSync(file, `# ${header}\n\n${tasks.map(formatTask).join('\n')}\n`);
}

export function loadTasks() {
  return loadFile(TASKS_FILE, 'Gretchen Tasks');
}

export function saveTasks(tasks) {
  saveFile(TASKS_FILE, 'Gretchen Tasks', tasks);
}

export function loadArchive() {
  return loadFile(ARCHIVE_FILE, 'Gretchen Archive');
}

export function saveArchive(tasks) {
  saveFile(ARCHIVE_FILE, 'Gretchen Archive', tasks);
}

export function archiveTask(task) {
  const archive = loadArchive();
  archive.unshift({ ...task, done: true, doneDate: task.doneDate || today() });
  saveFile(ARCHIVE_FILE, 'Gretchen Archive', archive);
}

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function today() {
  return iso(new Date());
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DATE_WORD = `\\d{4}-\\d{2}-\\d{2}|today|tomorrow|${WEEKDAYS.join('|')}`;

function resolveDateWord(word) {
  const w = word.toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return w;
  const d = new Date();
  if (w === 'tomorrow') d.setDate(d.getDate() + 1);
  else if (w !== 'today') {
    const target = WEEKDAYS.indexOf(w);
    if (target < 0) return null;
    d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7 || 7));
  }
  return iso(d);
}

// Parse raw input into a task. #tags stay in the description (Obsidian style).
// Dates, in priority order:
//   "@today", "@friday", "@2026-06-15"     — @ followed by a date word
//   "due tomorrow", "due 2026-06-15"       — the word due followed by a date word
//   "call mom tomorrow"                    — a bare trailing date word
export function parseInput(raw) {
  let title = raw.trim().replace(/^- \[[ x]\]\s*/, '');
  let date = null;

  const at = title.match(new RegExp(`@(${DATE_WORD})\\b`, 'i'));
  const due = at ? null : title.match(new RegExp(`\\bdue:?\\s+(${DATE_WORD})\\b`, 'i'));
  const bare = at || due ? null : title.match(new RegExp(`\\b(today|tomorrow|${WEEKDAYS.join('|')})\\s*$`, 'i'));

  const hit = at || due || bare;
  if (hit) {
    const resolved = resolveDateWord(hit[1]);
    if (resolved) {
      date = resolved;
      title = (title.slice(0, hit.index) + title.slice(hit.index + hit[0].length)).trim();
    }
  }

  return { done: false, title: title.replace(/\s{2,}/g, ' ').trim(), date, doneDate: null };
}
