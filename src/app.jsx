import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { loadTasks, saveTasks, loadArchive, saveArchive, archiveTask, parseInput, formatTask, today } from './store.js';
import { Calendar } from './calendar.jsx';
import { Mascot } from './mascot.jsx';

const ACCENT = '#d77757'; // Claude Code's terracotta

function Banner({ view }) {
  return (
    <Box borderStyle="round" borderColor={ACCENT} paddingX={1}>
      {view === 'home' && (
        <Box marginRight={2}>
          <Mascot />
        </Box>
      )}
      <Box flexDirection="column" justifyContent="center">
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
        archive · ctrl+d delete · /cal /archive /help /quit
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
      if (text === '/quit' || text === '/q' || text === '/exit') return exit();
      if (text === '/cal' || text === '/calendar') return setView('calendar');
      if (text === '/archive') {
        setSel(0);
        return setView('archive');
      }
      if (text === '/help') {
        note('Type a task and press enter. Dates: "@2026-06-15", "tomorrow", "friday".');
        return;
      }
      if (text.startsWith('/')) return note(`Unknown command: ${text}`);
      const task = parseInput(text);
      if (!task.title) return;
      persist([...tasks, task]);
      setSel(tasks.length);
      note(`Added: ${formatTask(task)}`);
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
            <Text>
              <Text color={ACCENT}>{'> '}</Text>
              {input}
              <Text color={ACCENT}>▌</Text>
            </Text>
          </Box>
        </Box>
      )}

      <Box marginTop={view === 'home' ? 0 : 1} flexDirection="column">
        {flash && <Text color="green">{flash}</Text>}
        <HelpBar view={view} />
      </Box>
    </Box>
  );
}
