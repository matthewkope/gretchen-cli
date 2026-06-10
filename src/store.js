import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = path.join(os.homedir(), '.gretchen');
const TASKS_FILE = path.join(DIR, 'tasks.md');
const ARCHIVE_FILE = path.join(DIR, 'archive.md');

const TASK_RE = /^- \[( |x)\] (.*?)(?: @(\d{4}-\d{2}-\d{2}))?\s*$/;

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

export function formatTask(task) {
  return `- [${task.done ? 'x' : ' '}] ${task.title}${task.date ? ` @${task.date}` : ''}`;
}

export function parseLine(line) {
  const m = line.match(TASK_RE);
  if (!m) return null;
  return { done: m[1] === 'x', title: m[2], date: m[3] || null };
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
  archive.unshift({ ...task, done: true, archivedAt: today() });
  saveFile(ARCHIVE_FILE, 'Gretchen Archive', archive);
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Parse raw input into a formatted task. Understands:
//   "ship the report @2026-06-12", "call mom tomorrow", "demo friday", "pay rent today"
export function parseInput(raw) {
  let title = raw.trim();
  let date = null;

  const explicit = title.match(/@(\d{4}-\d{2}-\d{2})/);
  if (explicit) {
    date = explicit[1];
    title = title.replace(explicit[0], '').replace(/\s{2,}/g, ' ').trim();
  } else {
    const lower = title.toLowerCase();
    const wordMatch = lower.match(/\b(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b\s*$/);
    if (wordMatch) {
      const word = wordMatch[1];
      const d = new Date();
      if (word === 'tomorrow') d.setDate(d.getDate() + 1);
      else if (word !== 'today') {
        const target = WEEKDAYS.indexOf(word);
        const delta = (target - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + delta);
      }
      date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      title = title.slice(0, wordMatch.index).trim();
    }
  }

  // Strip any markdown checkbox the user typed themselves; we format it.
  title = title.replace(/^- \[[ x]\]\s*/, '');
  return { done: false, title, date };
}
