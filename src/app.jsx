import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import {
  loadTasks, saveTasks, loadArchive, saveArchive, archiveTask, parseInput, formatTask,
  getTags, today, dateSuggestions, autoFormatDates, DATE_CTX,
} from './store.js';
import { Calendar } from './calendar.jsx';

const ACCENT = '#d77757'; // Claude Code's terracotta

const COMMANDS = [
  { name: 'cal', desc: 'open the calendar' },
  { name: 'archive', desc: 'view archived tasks' },
  { name: 'tag', desc: 'filter by #tag — /tag name, /tag to list' },
  { name: 'all', desc: 'clear the tag filter' },
  { name: 'clear', desc: 'archive all completed tasks' },
  { name: 'sort', desc: 'sort tasks by due date' },
  { name: 'stats', desc: 'task counts at a glance' },
  { name: 'refresh', desc: 'reload tasks from disk' },
  { name: 'help', desc: 'how to use gretchen' },
  { name: 'exit', desc: 'quit gretchen' },
];

const ALIASES = { quit: 'exit', q: 'exit', calendar: 'cal', sortby: 'sort', tags: 'tag', reload: 'refresh' };

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

function Banner({ view, tagFilter }) {
  return (
    <Box borderStyle="round" borderColor={ACCENT} paddingX={1} flexDirection="column">
      <Text>
        <Text color={ACCENT}>✻ Gretchen</Text>
        <Text dimColor> v0.1.0 — terminal project management</Text>
      </Text>
      <Text>
        <Text dimColor>
          {view === 'home' && '~/.gretchen/tasks.md'}
          {view === 'archive' && '~/.gretchen/archive.md'}
          {view === 'calendar' && 'calendar'}
        </Text>
        {view === 'home' && tagFilter && <Text color="yellow"> · filtering {tagFilter}</Text>}
      </Text>
    </Box>
  );
}

function Title({ title, selected, done }) {
  const parts = title.split(/(#[\w][\w/-]*)/g);
  return parts.map((p, i) =>
    p.startsWith('#') ? (
      <Text key={i} color="yellow">{p}</Text>
    ) : (
      <Text key={i} color={selected ? ACCENT : undefined} strikethrough={done}>{p}</Text>
    )
  );
}

function TaskLine({ task, selected }) {
  return (
    <Text>
      <Text color={selected ? ACCENT : undefined}>{selected ? '❯ ' : '  '}</Text>
      <Text color={task.done ? 'green' : 'white'}>{task.done ? '[x]' : '[ ]'}</Text>
      <Text> </Text>
      <Title title={task.title} selected={selected} done={task.done} />
      {task.date && (
        <Text color={task.date < today() && !task.done ? 'red' : 'cyan'}> 📅 {task.date}</Text>
      )}
      {task.doneDate && <Text color="green"> ✅ {task.doneDate}</Text>}
    </Text>
  );
}

function HelpBar({ view }) {
  if (view === 'home')
    return (
      <Text dimColor>
        enter add task ("buy milk #home due friday") · ↑/↓ select · shift+↑/↓ reorder · enter
        (empty) toggle done · ctrl+space archive · ctrl+d delete · / commands
      </Text>
    );
  if (view === 'archive') return <Text dimColor>ctrl+u unarchive · ↑/↓ select · esc home</Text>;
  return (
    <Text dimColor>
      m/w/d or tab switch view · enter zoom in · ←/→ day · ↑/↓ week · shift+←/→ prev/next
      period · t today · esc home
    </Text>
  );
}

export function App({ initialView = 'home' }) {
  const { exit } = useApp();
  const [view, setView] = useState(initialView);
  const [tasks, setTasks] = useState(loadTasks);
  const [archive, setArchive] = useState(loadArchive);
  const [sel, setSel] = useState(0);
  const [input, setInput] = useState('');
  const [flash, setFlash] = useState(null);
  const [tagFilter, setTagFilter] = useState(null);
  const [menuSel, setMenuSel] = useState(0);

  // the list shown on the home view; ops map back to real indices via identity
  const visible = tagFilter ? tasks.filter((t) => getTags(t).includes(tagFilter)) : tasks;
  const realIndex = (i) => tasks.indexOf(visible[i]);

  // popup menus under the input box: slash commands, or date suggestions
  // while typing "@..." / "due ..."
  const cmdMenu = view === 'home' ? matchCommands(input) : [];
  const dateCtx = view === 'home' && !input.startsWith('/') ? input.match(DATE_CTX) : null;
  const dateMenu = dateCtx ? dateSuggestions(dateCtx[2]) : [];
  const menuLen = input.startsWith('/') ? cmdMenu.length : dateMenu.length;
  const msel = Math.min(menuSel, Math.max(0, menuLen - 1));

  const editInput = (fn) => {
    setInput(fn);
    setMenuSel(0);
  };

  const insertDate = (s) => {
    if (!dateCtx || !s) return;
    editInput((v) => `${v.slice(0, dateCtx.index)}📅 ${s.date} `);
  };

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
    if ((key.upArrow || key.downArrow) && key.shift) {
      // reorder (Cmd+Shift+↑/↓ isn't visible to terminals, so Shift+↑/↓)
      if (tagFilter) return note('Clear the tag filter (/all) to reorder.');
      const dir = key.upArrow ? -1 : 1;
      if (sel + dir >= 0 && sel + dir < tasks.length) {
        const next = [...tasks];
        [next[sel], next[sel + dir]] = [next[sel + dir], next[sel]];
        persist(next);
        setSel(sel + dir);
      }
      return;
    }
    if (key.upArrow || key.downArrow) {
      // arrows steer an open popup menu; otherwise the task list
      if (menuLen > 0) {
        const dir = key.upArrow ? -1 : 1;
        return setMenuSel((s) => (Math.min(s, menuLen - 1) + dir + menuLen) % menuLen);
      }
      if (key.upArrow) return setSel((s) => Math.max(0, s - 1));
      return setSel((s) => Math.min(visible.length - 1, s + 1));
    }

    // Ctrl+Space arrives as a NUL byte, which Ink reports as ctrl+` (Cmd+Ctrl+Space is reserved by macOS)
    if (key.ctrl && (ch === ' ' || ch === '`' || ch === '\u0000')) {
      const task = visible[sel];
      if (task) {
        archiveTask(task);
        setArchive(loadArchive());
        persist(tasks.filter((t) => t !== task));
        setSel((s) => Math.max(0, Math.min(s, visible.length - 2)));
        note(`Archived: ${task.title}`);
      }
      return;
    }

    if (key.ctrl && ch === 'd') {
      const task = visible[sel];
      if (task) {
        persist(tasks.filter((t) => t !== task));
        setSel((s) => Math.max(0, Math.min(s, visible.length - 2)));
        note(`Deleted: ${task.title}`);
      }
      return;
    }

    if (key.return) {
      // with the date picker open, enter inserts the highlighted date;
      // the next enter submits the task
      if (dateMenu.length > 0) return insertDate(dateMenu[msel]);
      const text = input.trim();
      if (!text) {
        // toggle done on selected task
        const task = visible[sel];
        if (task) {
          persist(
            tasks.map((t) =>
              t === task ? { ...t, done: !t.done, doneDate: t.done ? null : today() } : t
            )
          );
        }
        return;
      }
      editInput(() => '');
      if (text.startsWith('/')) {
        // exact/unique-prefix match wins; otherwise run the highlighted menu entry
        const cmd = resolveCommand(text) || cmdMenu[msel]?.name;
        if (cmd === 'exit') return exit();
        if (cmd === 'cal') return setView('calendar');
        if (cmd === 'archive') {
          setSel(0);
          return setView('archive');
        }
        if (cmd === 'help') {
          note('Add tasks with #tags and dates: "@today", "due friday", "due 2026-06-15" → 📅. Type / for commands.');
          return;
        }
        if (cmd === 'tag') {
          const arg = text.split(/\s+/)[1];
          if (!arg) {
            const counts = {};
            for (const t of tasks) for (const tag of getTags(t)) counts[tag] = (counts[tag] || 0) + 1;
            const list = Object.entries(counts).map(([t, n]) => `${t} (${n})`).join(' · ');
            return note(list ? `Tags: ${list} — /tag <name> to filter.` : 'No tags yet. Add one with #name in a task.');
          }
          const tag = arg.startsWith('#') ? arg : `#${arg}`;
          setTagFilter(tag);
          setSel(0);
          return note(`Filtering by ${tag} — /all to clear.`);
        }
        if (cmd === 'all') {
          setTagFilter(null);
          setSel(0);
          return note('Tag filter cleared.');
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
        if (cmd === 'refresh') {
          const nextTasks = loadTasks();
          setTasks(nextTasks);
          setArchive(loadArchive());
          setSel((s) => Math.max(0, Math.min(s, nextTasks.length - 1)));
          return note('Refreshed from disk.');
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
      if (dateMenu.length > 0) return insertDate(dateMenu[msel]);
      if (cmdMenu.length > 0) editInput(() => `/${cmdMenu[msel].name}`);
      return;
    }
    if (key.backspace || key.delete) return editInput((v) => v.slice(0, -1));
    if (ch && !key.ctrl && !key.meta && !key.escape && !key.tab)
      editInput((v) => autoFormatDates(v + ch));
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Banner view={view} tagFilter={tagFilter} />

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
          {visible.length === 0 && (
            <Text dimColor>
              {tagFilter ? `No tasks tagged ${tagFilter}. /all clears the filter.` : 'No tasks yet. Type one below and press enter.'}
            </Text>
          )}
          {visible.map((t, i) => (
            <TaskLine key={realIndex(i)} task={t} selected={i === sel} />
          ))}
          <Box borderStyle="round" borderColor={ACCENT} paddingX={1} marginTop={1}>
            <Text color={ACCENT}>{'> '}</Text>
            <Text wrap="truncate-start">{input}</Text>
            <Text color={ACCENT}>▌</Text>
          </Box>
          {input.startsWith('/') && (
            <Box flexDirection="column" paddingX={2}>
              {cmdMenu.map((c, i) => (
                <Text key={c.name}>
                  <Text color={i === msel ? ACCENT : undefined} bold={i === msel}>
                    {i === msel ? '❯ ' : '  '}/{c.name.padEnd(9)}
                  </Text>
                  <Text dimColor>{c.desc}</Text>
                </Text>
              ))}
              {cmdMenu.length === 0 && <Text dimColor>no matching command</Text>}
              <Text dimColor>↑/↓ select · tab to complete · enter to run</Text>
            </Box>
          )}
          {dateMenu.length > 0 && (
            <Box flexDirection="column" paddingX={2}>
              {dateMenu.map((s, i) => (
                <Text key={s.label}>
                  <Text color={i === msel ? ACCENT : undefined} bold={i === msel}>
                    {i === msel ? '❯ ' : '  '}📅 {s.label.padEnd(12)}
                  </Text>
                  <Text dimColor>{s.date}</Text>
                </Text>
              ))}
              <Text dimColor>↑/↓ select · tab or enter to insert</Text>
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
