import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import {
  loadTasks, saveTasks, loadArchive, saveArchive, archiveTask, parseInput, formatTask,
  getTags, today, dateSuggestions, tagSuggestions, autoFormatDates, DATE_CTX,
  loadAllTasks, listProjects, projectSuggestions, projectExists, slugifyProject,
  prioritySuggestions, priorityEmoji, PRIO_CTX,
} from './store.js';
import { Calendar } from './calendar.jsx';
import { togglToken, verifyToken, saveToken, clearToken, startEntry, stopEntry, openTokenPage, TOKEN_URL } from './toggl.js';

const ACCENT = '#d77757'; // Claude Code's terracotta

const COMMANDS = [
  { name: 'cal', desc: 'open the calendar' },
  { name: 'archive', desc: 'archive all completed tasks' },
  { name: 'archived', desc: 'view archived tasks' },
  { name: 'project', desc: 'open or create a project — /project name' },
  { name: 'inbox', desc: 'back to the inbox task list' },
  { name: 'move', desc: 'move selected task to a project — /move name' },
  { name: 'tag', desc: 'filter by #tag — /tag name, /tag to list' },
  { name: 'all', desc: 'clear the tag filter' },
  { name: 'sort', desc: 'sort tasks by due date' },
  { name: 'stats', desc: 'task counts at a glance' },
  { name: 'refresh', desc: 'reload tasks from disk' },
  { name: 'toggl', desc: 'connect Toggl time tracking — opens the token page, /toggl off' },
  { name: 'commands', desc: 'list all commands and what they do' },
  { name: 'exit', desc: 'quit gretchen' },
];

const ALIASES = {
  quit: 'exit', q: 'exit', calendar: 'cal', sortby: 'sort', tags: 'tag', reload: 'refresh',
  cmds: 'commands', clear: 'archive', projects: 'project', proj: 'project', mv: 'move', home: 'inbox',
};

// reverse map: command name → its aliases, for the /commands panel
const ALIAS_NAMES = {};
for (const [alias, name] of Object.entries(ALIASES)) (ALIAS_NAMES[name] ||= []).push(`/${alias}`);

function CommandsPanel({ accent }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={accent} paddingX={1} marginTop={1}>
      <Text bold color={accent}>Commands</Text>
      {COMMANDS.map((c) => (
        <Text key={c.name}>
          <Text color={accent}>{`/${c.name}`.padEnd(11)}</Text>
          <Text>{c.desc}</Text>
          {ALIAS_NAMES[c.name] && <Text dimColor> · also {ALIAS_NAMES[c.name].join(', ')}</Text>}
        </Text>
      ))}
      <Text dimColor>type / to filter the menu · tab completes · esc closes this</Text>
    </Box>
  );
}

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

function Banner({ view, tagFilter, project }) {
  return (
    <Box borderStyle="round" borderColor={ACCENT} paddingX={1} flexDirection="column">
      <Text>
        <Text color={ACCENT}>✻ Gretchen</Text>
        <Text dimColor> v0.1.0 — terminal project management</Text>
      </Text>
      <Text>
        <Text dimColor>
          {view === 'home' && (project ? `~/.gretchen/projects/${project}.md` : '~/.gretchen/tasks.md')}
          {view === 'archive' && '~/.gretchen/archive.md'}
          {view === 'calendar' && 'calendar (all projects)'}
        </Text>
        {view === 'home' && project && <Text color="magenta"> · project: {project}</Text>}
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

function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

function TaskLine({ task, selected, tracked, elapsed, toggl }) {
  return (
    <Text>
      <Text color={selected ? ACCENT : undefined}>{selected ? '❯ ' : '  '}</Text>
      <Text color={task.done ? 'green' : 'white'}>{task.done ? '[x]' : '[ ]'}</Text>
      <Text> </Text>
      <Title title={task.title} selected={selected} done={task.done} />
      {task.priority && <Text> {priorityEmoji(task.priority)}</Text>}
      {task.date && (
        <Text color={task.date < today() && !task.done ? 'red' : 'cyan'}> 📅 {task.date}</Text>
      )}
      {task.doneDate && <Text color="green"> ✅ {task.doneDate}</Text>}
      {tracked && <Text color="red"> ⏺ {fmtElapsed(elapsed)}</Text>}
      {!tracked && selected && toggl && <Text color="green"> ▶</Text>}
    </Text>
  );
}

function HelpBar({ view, toggl }) {
  if (view === 'home')
    return (
      <Text dimColor>
        enter add task ("buy milk #home due friday") · ↑/↓ select · shift+↑/↓ reorder · enter
        (empty) toggle done · {toggl ? 'ctrl+t toggl ▶/⏹ · ' : ''}ctrl+space archive · ctrl+d delete
        · / commands
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
  const [panel, setPanel] = useState(null);
  const [project, setProject] = useState(null); // null = inbox
  const [toggl, setToggl] = useState(() => !!togglToken()); // opt-in via /toggl, sticky across restarts
  const [tokenPrompt, setTokenPrompt] = useState(false); // /toggl setup: paste-the-token prompt
  const [tokenInput, setTokenInput] = useState('');
  const [tracking, setTracking] = useState(null); // { id, title, startedAt } — running Toggl entry
  const [, setTick] = useState(0);

  // re-render once a second while tracking so the elapsed time ticks
  useEffect(() => {
    if (!tracking) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [tracking]);

  // the list shown on the home view; ops map back to real indices via identity
  const visible = tagFilter ? tasks.filter((t) => getTags(t).includes(tagFilter)) : tasks;
  const realIndex = (i) => tasks.indexOf(visible[i]);

  // popup menus under the input box: slash commands, date suggestions while
  // typing "@..." / "due ...", or existing tags while typing "#..." / "/tag ..."
  const cmdMenu = view === 'home' ? matchCommands(input) : [];
  const dateCtx = view === 'home' && !input.startsWith('/') ? input.match(DATE_CTX) : null;
  const dateMenu = dateCtx ? dateSuggestions(dateCtx[2]) : [];
  const hashCtx = view === 'home' && !input.startsWith('/') ? input.match(/#[\w/-]*$/) : null;
  const tagArgCtx = view === 'home' && /^\/tags?\s+/.test(input) ? input.match(/#?[\w/-]*$/) : null;
  const tagMenu = hashCtx
    ? tagSuggestions(tasks, hashCtx[0])
    : tagArgCtx
    ? tagSuggestions(tasks, tagArgCtx[0])
    : [];
  const projArgCtx =
    view === 'home' && /^\/(projects?|proj|move|mv)\s+/i.test(input) ? input.match(/[\w-]*$/) : null;
  const projMenu = projArgCtx ? projectSuggestions(projArgCtx[0]) : [];
  // right after a 📅 date is completed, offer a priority
  const prioCtx = view === 'home' && !input.startsWith('/') && !hashCtx ? input.match(PRIO_CTX) : null;
  const prioMenu = prioCtx ? prioritySuggestions(prioCtx[2]) : [];
  const menuLen = input.startsWith('/')
    ? tagArgCtx && tagMenu.length > 0
      ? tagMenu.length
      : projArgCtx && projMenu.length > 0
      ? projMenu.length
      : cmdMenu.length
    : hashCtx
    ? tagMenu.length
    : prioCtx
    ? prioMenu.length
    : dateMenu.length;
  const msel = Math.min(menuSel, Math.max(0, menuLen - 1));

  const editInput = (fn) => {
    setInput(fn);
    setMenuSel(0);
  };

  const insertDate = (s) => {
    if (!dateCtx || !s) return;
    editInput((v) => `${v.slice(0, dateCtx.index)}📅 ${s.date} `);
  };

  const insertTag = (s) => {
    if (!s) return;
    if (hashCtx) editInput((v) => `${v.slice(0, hashCtx.index)}${s.tag} `);
    else if (tagArgCtx) editInput((v) => `${v.slice(0, tagArgCtx.index)}${s.tag}`);
  };

  const insertProject = (s) => {
    if (!projArgCtx || !s) return;
    editInput((v) => `${v.slice(0, projArgCtx.index)}${s.name}`);
  };

  const insertPriority = (s) => {
    if (!prioCtx || !s) return;
    editInput((v) => `${v.slice(0, prioCtx.index)}📅 ${prioCtx[1]} ${s.emoji ? `${s.emoji} ` : ''}`);
  };

  // switch the task list to a project file (null = inbox), creating it if new
  const openProject = (name) => {
    const created = name && !projectExists(name);
    if (created) saveTasks([], name);
    setProject(name);
    setTasks(loadTasks(name));
    setSel(0);
    setTagFilter(null);
    return created;
  };

  const persist = (next) => {
    setTasks(next);
    saveTasks(next, project);
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
    // Toggl token prompt captures all input until connected or cancelled
    if (tokenPrompt) {
      if (key.escape) {
        setTokenPrompt(false);
        setTokenInput('');
        return note('Toggl setup cancelled.');
      }
      if (key.return) {
        const tok = tokenInput.trim();
        if (!tok) return;
        note('Toggl: checking token…');
        verifyToken(tok)
          .then((me) => {
            saveToken(tok);
            setToggl(true);
            setTokenPrompt(false);
            setTokenInput('');
            note(`Toggl connected as ${me.fullname || me.email} — ctrl+t tracks the selected task.`);
          })
          .catch((e) => {
            setTokenInput('');
            note(`Toggl: token rejected (${e.message}) — paste it again, or esc to cancel.`);
          });
        return;
      }
      if (key.backspace || key.delete) return setTokenInput((v) => v.slice(0, -1));
      // pasted tokens can arrive with stray whitespace/newlines — strip them
      if (ch && !key.ctrl && !key.meta) setTokenInput((v) => (v + ch).replace(/\s+/g, ''));
      return;
    }
    if (key.escape) {
      if (panel) setPanel(null);
      return;
    }
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

    // Toggl: start/stop tracking the selected task. The first #tag maps to an
    // existing Toggl project of the same name (no project is ever created).
    if (key.ctrl && ch === 't') {
      const task = visible[sel];
      if (!task) return;
      if (!toggl || !togglToken())
        return note('Toggl is off — run /toggl to set it up.');
      if (tracking && tracking.title === task.title) {
        const elapsed = fmtElapsed(Date.now() - tracking.startedAt);
        note('Toggl: stopping…');
        stopEntry(tracking.id)
          .then(() => {
            setTracking(null);
            note(`Toggl: stopped "${tracking.title}" after ${elapsed}`);
          })
          .catch((e) => note(`Toggl error stopping: ${e.message}`));
      } else {
        const tag = getTags(task)[0];
        const description = task.title.replace(/#[\w][\w/-]*/g, '').replace(/\s{2,}/g, ' ').trim() || task.title;
        note('Toggl: starting…');
        startEntry({ description, tag })
          .then(({ entry, project: proj }) => {
            setTracking({ id: entry.id, title: task.title, startedAt: new Date(entry.start).getTime() });
            note(
              `Toggl: tracking "${description}"` +
                (proj ? ` → ${proj.name}` : tag ? ` (no Toggl project named ${tag.slice(1)} — left unassigned)` : '')
            );
          })
          .catch((e) => note(`Toggl error starting: ${e.message}`));
      }
      return;
    }

    if (key.return) {
      // with the date or tag picker open, enter inserts the highlighted entry;
      // the next enter submits the task
      if (dateMenu.length > 0) return insertDate(dateMenu[msel]);
      if (hashCtx && tagMenu.length > 0) return insertTag(tagMenu[msel]);
      // priority picker: enter sets the highlighted priority; "none" falls
      // through so plain enter still submits the task
      if (prioCtx && prioMenu.length > 0 && prioMenu[msel]?.emoji) return insertPriority(prioMenu[msel]);
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
        setPanel(null);
        if (cmd === 'commands') return setPanel('commands');
        if (cmd === 'exit') return exit();
        if (cmd === 'cal') return setView('calendar');
        if (cmd === 'archive') {
          const done = tasks.filter((t) => t.done);
          if (done.length === 0) return note('No completed tasks to archive.');
          done.forEach(archiveTask);
          setArchive(loadArchive());
          persist(tasks.filter((t) => !t.done));
          setSel(0);
          return note(`Archived ${done.length} completed task${done.length === 1 ? '' : 's'} — /archived to view.`);
        }
        if (cmd === 'archived') {
          setSel(0);
          return setView('archive');
        }
        if (cmd === 'project') {
          const arg = (projArgCtx && projMenu[msel]?.name) || text.split(/\s+/)[1];
          if (!arg) {
            const names = listProjects();
            return note(
              names.length
                ? `Projects: ${names.join(' · ')} — /project <name> opens, /inbox returns.`
                : 'No projects yet. /project <name> creates one.'
            );
          }
          if (arg === 'inbox') {
            openProject(null);
            return note('Inbox.');
          }
          const name = slugifyProject(arg);
          if (!name) return note('Invalid project name.');
          const created = openProject(name);
          return note(created ? `Created project ${name}.` : `Opened project ${name}.`);
        }
        if (cmd === 'inbox') {
          openProject(null);
          return note('Inbox.');
        }
        if (cmd === 'move') {
          const arg = (projArgCtx && projMenu[msel]?.name) || text.split(/\s+/)[1];
          if (!arg) return note('Usage: /move <project> — moves the selected task (inbox works too).');
          const task = visible[sel];
          if (!task) return note('No task selected.');
          const dest = arg === 'inbox' ? null : slugifyProject(arg);
          if (arg !== 'inbox' && !dest) return note('Invalid project name.');
          if ((dest ?? null) === (project ?? null)) return note('Task is already in this list.');
          const created = dest && !projectExists(dest);
          saveTasks([...loadTasks(dest), task], dest);
          persist(tasks.filter((t) => t !== task));
          setSel((s) => Math.max(0, Math.min(s, visible.length - 2)));
          return note(`Moved to ${dest ?? 'inbox'}${created ? ' (new project)' : ''}: ${task.title}`);
        }
        if (cmd === 'tag') {
          // prefer the highlighted suggestion over the partial that was typed
          const arg = (tagArgCtx && tagMenu[msel]?.tag) || text.split(/\s+/)[1];
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
        if (cmd === 'toggl') {
          const arg = text.split(/\s+/)[1];
          if (!arg && toggl)
            return note('Toggl is on — ctrl+t starts/stops tracking the selected task. /toggl off disconnects, /toggl setup reconnects.');
          if (!arg || arg === 'setup') {
            // open the browser on the profile page and wait for the paste
            openTokenPage();
            setTokenPrompt(true);
            setTokenInput('');
            return note(`Opened ${TOKEN_URL} in your browser.`);
          }
          if (arg === 'off') {
            if (process.env.TOGGL_API_TOKEN)
              return note('Toggl token comes from $TOGGL_API_TOKEN — unset it to disconnect.');
            clearToken();
            setToggl(false);
            setTracking(null);
            return note('Toggl disconnected — token removed from ~/.gretchen/toggl-token.');
          }
          note('Toggl: checking token…');
          verifyToken(arg)
            .then((me) => {
              saveToken(arg);
              setToggl(true);
              note(`Toggl connected as ${me.fullname || me.email} — ctrl+t tracks the selected task.`);
            })
            .catch((e) => note(`Toggl: token rejected (${e.message}). Check track.toggl.com/profile.`));
          return;
        }
        if (cmd === 'refresh') {
          const nextTasks = loadTasks(project);
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
            `${open.length} open · ${tasks.length - open.length} done · ${archive.length} archived · ${dueToday} due today · ${overdue} overdue · ${listProjects().length} projects`
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
      if (tagMenu.length > 0) return insertTag(tagMenu[msel]);
      if (projArgCtx && projMenu.length > 0) return insertProject(projMenu[msel]);
      if (prioCtx && prioMenu.length > 0) return insertPriority(prioMenu[msel]);
      if (dateMenu.length > 0) return insertDate(dateMenu[msel]);
      if (cmdMenu.length > 0) editInput(() => `/${cmdMenu[msel].name}`);
      return;
    }
    if (key.backspace || key.delete) {
      // with the command menu open, one backspace dismisses the whole thing
      if (input.startsWith('/')) return editInput(() => '');
      return editInput((v) => v.slice(0, -1));
    }
    if (ch && !key.ctrl && !key.meta && !key.escape && !key.tab)
      editInput((v) => autoFormatDates(v + ch));
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Banner view={view} tagFilter={tagFilter} project={project} />

      {view === 'calendar' && <Calendar tasks={loadAllTasks()} accent={ACCENT} />}

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
            <TaskLine
              key={realIndex(i)}
              task={t}
              selected={i === sel}
              tracked={toggl && tracking?.title === t.title}
              elapsed={tracking ? Date.now() - tracking.startedAt : 0}
              toggl={toggl}
            />
          ))}
          {panel === 'commands' && <CommandsPanel accent={ACCENT} />}
          {tokenPrompt ? (
            <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginTop={1}>
              <Text bold color="cyan">Connect Toggl Track</Text>
              <Text dimColor>
                Your browser opened {TOKEN_URL} — scroll to "API Token" at the bottom, copy it,
                and paste it here.
              </Text>
              <Text>
                <Text color="cyan">{'token> '}</Text>
                <Text>{'•'.repeat(tokenInput.length)}</Text>
                <Text color="cyan">▌</Text>
                {tokenInput.length > 0 && <Text dimColor> {tokenInput.length} chars</Text>}
              </Text>
              <Text dimColor>paste · enter to connect · esc to cancel</Text>
            </Box>
          ) : (
            <Box borderStyle="round" borderColor={ACCENT} paddingX={1} marginTop={1}>
              <Text color={ACCENT}>{'> '}</Text>
              <Text wrap="truncate-start">{input}</Text>
              <Text color={ACCENT}>▌</Text>
            </Box>
          )}
          {input.startsWith('/') && !(tagArgCtx && tagMenu.length > 0) && !(projArgCtx && projMenu.length > 0) && (
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
          {tagMenu.length > 0 && (
            <Box flexDirection="column" paddingX={2}>
              {tagMenu.map((s, i) => (
                <Text key={s.tag}>
                  <Text color={i === msel ? ACCENT : 'yellow'} bold={i === msel}>
                    {i === msel ? '❯ ' : '  '}{s.tag.padEnd(14)}
                  </Text>
                  <Text dimColor>
                    {s.count} task{s.count === 1 ? '' : 's'}
                  </Text>
                </Text>
              ))}
              <Text dimColor>
                {tagArgCtx ? '↑/↓ select · tab completes · enter filters' : '↑/↓ select · tab or enter to insert'}
              </Text>
            </Box>
          )}
          {projArgCtx && projMenu.length > 0 && (
            <Box flexDirection="column" paddingX={2}>
              {projMenu.map((s, i) => (
                <Text key={s.name}>
                  <Text color={i === msel ? ACCENT : 'magenta'} bold={i === msel}>
                    {i === msel ? '❯ ' : '  '}{s.name.padEnd(16)}
                  </Text>
                  <Text dimColor>
                    {s.count} open task{s.count === 1 ? '' : 's'}
                  </Text>
                </Text>
              ))}
              <Text dimColor>↑/↓ select · tab completes · enter runs · a new name creates the project</Text>
            </Box>
          )}
          {prioCtx && prioMenu.length > 0 && (
            <Box flexDirection="column" paddingX={2}>
              <Text dimColor>set a priority?</Text>
              {prioMenu.map((s, i) => (
                <Text key={s.key}>
                  <Text color={i === msel ? ACCENT : undefined} bold={i === msel}>
                    {i === msel ? '❯ ' : '  '}{s.emoji || '─'} {s.key}
                  </Text>
                </Text>
              ))}
              <Text dimColor>↑/↓ select · tab or enter sets it · enter on none submits</Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={view === 'home' ? 0 : 1} flexDirection="column">
        {flash && <Text color="green">{flash}</Text>}
        <HelpBar view={view} toggl={toggl} />
      </Box>
    </Box>
  );
}
