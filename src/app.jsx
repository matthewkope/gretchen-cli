import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { loadTasks, saveTasks, loadArchive, saveArchive, archiveTask, parseInput, formatTask, today } from './store.js';
import { Calendar } from './calendar.jsx';

const ACCENT = '#d77757'; // Claude Code's terracotta

const COMMANDS = [
  { name: 'cal', desc: 'open the calendar' },
  { name: 'archive', desc: 'view archived tasks' },
  { name: 'clear', desc: 'archive all completed tasks' },
  { name: 'sort', desc: 'sort tasks by due date' },
  { name: 'stats', desc: 'task counts at a glance' },
  { name: 'help', desc: 'how to use gretchen' },
  { name: 'exit', desc: 'quit gretchen' },
];

const ALIASES = { quit: 'exit', q: 'exit', calendar: 'cal', sortby: 'sort' };

function matchCommands(input) {
  if (!input.startsWith('/')) return [];
  const q = input.slice(1).split(/\s/)[0].toLowerCase();
  return COMMANDS.filter((c) => c.name.startsWith(q));
}

function resolveCommand(text) {
  const q = text.slice(1).split(/\s/)[0].toLowerCase();
  const name = ALIASES[q] || q;
  const exact = COMMANDS.find((c) => c.name === name);
  if (exact) return exact.name;
  const prefix = COMMANDS.filter((c) => c.name.startsWith(name));
  return prefix.length === 1 ? prefix[0].name : null;
}

function Banner({ view }) {
  return (
    <Box borderStyle="round" borderColor={ACCENT} paddingX={1} flexDirection="column">
      <Text>
        <Text color={ACCENT}>✻ Gretchen</Text>
        <Text dimColor> v0.1.0 — terminal project management</Text>
      </Text>
      <Text dimColor>
        {view === 'home' && '~/.gretchen/tasks.md'}
        {view === 'archive' && '~/.gretchen/archive.md'}
        {view === 'calendar' && 'calendar'}
      </Text>
    </Box>
  );
}

function TaskLine({ task, selected }) {
  return (
    <Text>
      <Text color={selected ? ACCENT : undefined}>{selected ? '❯ ' : '  '}</Text>
      <Text color={task.done ? 'green' : 'white'}>{task.done ? '[x]' : '[ ]'}</Text>
      <Text color={selected ? ACCENT : undefined} strikethrough={task.done}>
        {' '}
        {task.title}
      </Text>
      {task.date && (
        <Text color={task.date < today() && !task.done ? 'red' : 'cyan'}> @{task.date}</Text>
      )}
    </Text>
  );
}

function HelpBar({ view }) {
  if (view === 'home')
    return (
      <Text dimColor>
        enter add task · ↑/↓ select · shift+↑/↓ reorder · enter (empty) toggle done · ctrl+space
        archive · ctrl+d delete · / commands
      </Text>
    );
  if (view === 'archive') return <Text dimColor>ctrl+u unarchive · ↑/↓ select · esc home</Text>;
  return <Text dimColor>←/→ day · shift+←/→ month · t today · esc home</Text>;
}

export function App({ initialView = 'home' }) {
  const { exit } = useApp();
  const [view, setView] = useState(initialView);
  const [tasks, setTasks] = useState(loadTasks);
  const [archive, setArchive] = useState(loadArchive);
  const [sel, setSel] = useState(0);
  const [input, setInput] = useState('');
  const [flash, setFlash] = useState(null);

  const persist = (next) => {
    setTasks(next);
    saveTasks(next);
  };

  const note = (msg) => setFlash(msg);

  useInput((ch, key) => {
    if (key.ctrl && ch === 'c') return exit();

    if (view !== 'home') {
      if (key.escape) {
        setView('home');
        setSel(0);
        setFlash(null);
      }
      if (view === 'archive') {
        if (key.upArrow) setSel((s) => Math.max(0, s - 1));
        if (key.downArrow) setSel((s) => Math.min(archive.length - 1, s + 1));
        if (key.ctrl && ch === 'u' && archive[sel]) {
          const item = archive[sel];
          const nextArchive = archive.filter((_, i) => i !== sel);
          setArchive(nextArchive);
          saveArchive(nextArchive);
          persist([...tasks, { ...item, done: false }]);
          setSel((s) => Math.max(0, Math.min(s, nextArchive.length - 1)));
          note(`Unarchived: ${item.title}`);
        }
      }
      return;
    }

    // --- home view ---
    if (key.upArrow && key.shift) {
      // reorder up (Cmd+Shift+↑ isn't visible to terminals, so Shift+↑)
      if (sel > 0) {
        const next = [...tasks];
        [next[sel - 1], next[sel]] = [next[sel], next[sel - 1]];
        persist(next);
        setSel(sel - 1);
      }
      return;
    }
    if (key.downArrow && key.shift) {
      if (sel < tasks.length - 1) {
        const next = [...tasks];
        [next[sel], next[sel + 1]] = [next[sel + 1], next[sel]];
        persist(next);
        setSel(sel + 1);
      }
      return;
    }
    if (key.upArrow) return setSel((s) => Math.max(0, s - 1));
    if (key.downArrow) return setSel((s) => Math.min(tasks.length - 1, s + 1));

    // Ctrl+Space arrives as a NUL byte (Cmd+Ctrl+Space is reserved by macOS)
    if (ch === '\u0000' || (key.ctrl && ch === ' ')) {
      const task = tasks[sel];
      if (task) {
        archiveTask(task);
        setArchive(loadArchive());
        const next = tasks.filter((_, i) => i !== sel);
        persist(next);
        setSel((s) => Math.max(0, Math.min(s, next.length - 1)));
        note(`Archived: ${task.title}`);
      }
      return;
    }

    if (key.ctrl && ch === 'd') {
      const task = tasks[sel];
      if (task) {
        const next = tasks.filter((_, i) => i !== sel);
        persist(next);
        setSel((s) => Math.max(0, Math.min(s, next.length - 1)));
        note(`Deleted: ${task.title}`);
      }
      return;
    }

    if (key.return) {
      const text = input.trim();
      if (!text) {
        // toggle done on selected task
        if (tasks[sel]) {
          const next = tasks.map((t, i) => (i === sel ? { ...t, done: !t.done } : t));
          persist(next);
        }
        return;
      }
      setInput('');
      if (text.startsWith('/')) {
        const cmd = resolveCommand(text);
        if (cmd === 'exit') return exit();
        if (cmd === 'cal') return setView('calendar');
        if (cmd === 'archive') {
          setSel(0);
          return setView('archive');
        }
        if (cmd === 'help') {
          note('Type a task and press enter. Dates: "@2026-06-15", "tomorrow", "friday". Type / for commands.');
          return;
        }
        if (cmd === 'clear') {
          const done = tasks.filter((t) => t.done);
          if (done.length === 0) return note('No completed tasks to clear.');
          done.forEach(archiveTask);
          setArchive(loadArchive());
          persist(tasks.filter((t) => !t.done));
          setSel(0);
          return note(`Archived ${done.length} completed task${done.length === 1 ? '' : 's'}.`);
        }
        if (cmd === 'sort') {
          const next = [...tasks].sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
          });
          persist(next);
          setSel(0);
          return note('Sorted by due date (undated tasks last).');
        }
        if (cmd === 'stats') {
          const open = tasks.filter((t) => !t.done);
          const dueToday = open.filter((t) => t.date === today()).length;
          const overdue = open.filter((t) => t.date && t.date < today()).length;
          return note(
            `${open.length} open · ${tasks.length - open.length} done · ${archive.length} archived · ${dueToday} due today · ${overdue} overdue`
          );
        }
        return note(`Unknown command: ${text} — type / to see commands.`);
      }
      const task = parseInput(text);
      if (!task.title) return;
      persist([...tasks, task]);
      setSel(tasks.length);
      note(`Added: ${formatTask(task)}`);
      return;
    }

    if (key.tab) {
      const matches = matchCommands(input);
      if (matches.length > 0) setInput(`/${matches[0].name}`);
      return;
    }
    if (key.backspace || key.delete) return setInput((v) => v.slice(0, -1));
    if (ch && !key.ctrl && !key.meta && !key.escape && !key.tab) setInput((v) => v + ch);
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Banner view={view} />

      {view === 'calendar' && <Calendar tasks={tasks} accent={ACCENT} />}

      {view === 'archive' && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Archive ({archive.length})</Text>
          {archive.length === 0 && <Text dimColor>Nothing archived yet. Ctrl+Space a task to send it here.</Text>}
          {archive.map((t, i) => (
            <TaskLine key={i} task={t} selected={i === sel} />
          ))}
        </Box>
      )}

      {view === 'home' && (
        <Box flexDirection="column" marginTop={1}>
          {tasks.length === 0 && <Text dimColor>No tasks yet. Type one below and press enter.</Text>}
          {tasks.map((t, i) => (
            <TaskLine key={i} task={t} selected={i === sel} />
          ))}
          <Box borderStyle="round" borderColor={ACCENT} paddingX={1} marginTop={1}>
            <Text color={ACCENT}>{'> '}</Text>
            <Text wrap="truncate-start">{input}</Text>
            <Text color={ACCENT}>▌</Text>
          </Box>
          {input.startsWith('/') && (
            <Box flexDirection="column" paddingX={2}>
              {matchCommands(input).map((c, i) => (
                <Text key={c.name}>
                  <Text color={i === 0 ? ACCENT : undefined} bold={i === 0}>
                    /{c.name.padEnd(9)}
                  </Text>
                  <Text dimColor>{c.desc}</Text>
                </Text>
              ))}
              {matchCommands(input).length === 0 && <Text dimColor>no matching command</Text>}
              <Text dimColor>tab to complete · enter to run</Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={view === 'home' ? 0 : 1} flexDirection="column">
        {flash && <Text color="green">{flash}</Text>}
        <HelpBar view={view} />
      </Box>
    </Box>
  );
}
