import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import {
  loadTasks, saveTasks, loadArchive, saveArchive, archiveTask, parseInput, formatTask,
  getTags, today, dateSuggestions, tagSuggestions, autoFormatDates, DATE_CTX,
  loadAllTasks, listProjects, projectSuggestions, projectExists, slugifyProject, archiveSections, compareTasks,
  taskBlocks, sortTasks, SORT_KEYS, sortSuggestions,
  prioritySuggestions, priorityEmoji, PRIO_CTX,
} from './store.js';
import { Calendar } from './calendar.jsx';
import {
  togglToken, verifyToken, saveToken, clearToken, startEntry, stopEntry, openTokenPage, TOKEN_URL,
  loadMap, saveMap, mapKey, togglProjectByName,
} from './toggl.js';
import { logEntry, timeStats, timeCsvPath, getEmail, setEmail } from './timer.js';

const ACCENT = '#d77757'; // Claude Code's terracotta

const COMMANDS = [
  { name: 'cal', desc: 'open the calendar' },
  { name: 'archive', desc: 'archive all completed tasks' },
  { name: 'archived', desc: 'view archived tasks' },
  { name: 'project', desc: 'open or create a project — /project name' },
  { name: 'inbox', desc: 'back to the inbox task list' },
  { name: 'move', desc: 'move selected task to a project — /move name' },
  { name: 'file', desc: 'file tasks into projects matching their #tags' },
  { name: 'tag', desc: 'filter by #tag — /tag name, /tag to list' },
  { name: 'all', desc: 'clear the tag filter' },
  { name: 'sort', desc: 'sort tasks — /sort priority · due · tag · description · status' },
  { name: 'stats', desc: 'task counts at a glance' },
  { name: 'time', desc: 'local time log — /time email <addr> · /time open' },
  { name: 'toggl', desc: 'push time entries live to Toggl — map <name> <project> · unmap · off' },
  { name: 'commands', desc: 'list all commands and what they do' },
  { name: 'exit', desc: 'quit gretchen' },
];

const ALIASES = {
  quit: 'exit', q: 'exit', calendar: 'cal', sortby: 'sort', tags: 'tag',
  cmds: 'commands', clear: 'archive', projects: 'project', proj: 'project', mv: 'move', home: 'inbox',
  sweep: 'file', timer: 'time', csv: 'time',
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

// Toggl entry description: just the task text — no #tags, no 📅/✅ dates,
// no priority or other emojis
function togglDescription(title) {
  return (
    title
      .replace(/(?:📅|✅)\s*\d{4}-\d{2}-\d{2}/gu, '')
      .replace(/#[\w][\w/-]*/g, '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{2000}-\u{206F}\u{FE0F}\u{200D}]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || 'untitled'
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
      {(task.indent || 0) > 0 && <Text dimColor>{'  '.repeat(task.indent)}↳ </Text>}
      <Text color={task.done ? 'green' : 'white'}>{task.done ? '[x]' : '[ ]'}</Text>
      <Text> </Text>
      <Title title={task.title} selected={selected} done={task.done} />
      {task.priority && <Text> {priorityEmoji(task.priority)}</Text>}
      {task.date && (
        <Text color={task.date < today() && !task.done ? 'red' : 'cyan'}> 📅 {task.date}</Text>
      )}
      {task.doneDate && <Text color="green"> ✅ {task.doneDate}</Text>}
      {task.src && <Text color="magenta"> [{task.src}]</Text>}
      {tracked && <Text color="red"> ⏺ {fmtElapsed(elapsed)}</Text>}
      {!tracked && selected && <Text color="green"> ▶</Text>}
    </Text>
  );
}

// list title + every project, for jumping around with /project
function NavBar({ project, openCount }) {
  const items = ['inbox', ...listProjects()];
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        <Text bold color={ACCENT}>{project ? `Project: ${project}` : 'Inbox'}</Text>
        <Text dimColor> — {openCount} open task{openCount === 1 ? '' : 's'}</Text>
      </Text>
      {items.length > 1 && (
        <Text>
          {items.map((n, i) => {
            const active = (n === 'inbox' ? null : n) === (project ?? null);
            return (
              <Text key={n}>
                {i > 0 && <Text dimColor> · </Text>}
                <Text color={active ? ACCENT : undefined} bold={active} dimColor={!active}>
                  {active ? `[${n}]` : n}
                </Text>
              </Text>
            );
          })}
          <Text dimColor>  — ctrl+p next · ctrl+0 prev · /project {'<name>'} jumps</Text>
        </Text>
      )}
    </Box>
  );
}

function HelpBar({ view, toggl }) {
  if (view === 'home')
    return (
      <Text dimColor>
        enter add task ("buy milk #home due friday") · ↑/↓ select · shift+↑/↓ reorder ·
        tab/shift+tab nest sub-task · enter (empty) toggle done ·{' '}
        ctrl+t track ▶/⏹ · ctrl+e edit · ctrl+space archive · ctrl+d delete · / commands
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
  const [filePrompt, setFilePrompt] = useState(null); // { name, count } — offer to pull tagged inbox tasks into a new project
  const [editing, setEditing] = useState(null); // task loaded into the input via ctrl+e
  const [tracking, setTracking] = useState(null); // { id, title, startedAt } — running Toggl entry
  const [, setTick] = useState(0);
  const projectRef = React.useRef(project); // current list, always fresh for key handlers

  // re-render once a second while tracking so the elapsed time ticks
  useEffect(() => {
    if (!tracking) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [tracking]);

  // the list shown on the home view; ops map back to real indices via identity.
  // In the inbox, every project's tasks are shown too — they stay in their
  // project file, and ops route back there via src/srcIdx.
  const projectTasks = !project
    ? listProjects().flatMap((n) => loadTasks(n).map((t, i) => ({ ...t, src: n, srcIdx: i })))
    : [];
  const allVisible = [...tasks, ...projectTasks];
  const visible = tagFilter ? allVisible.filter((t) => getTags(t).includes(tagFilter)) : allVisible;
  const realIndex = (i) => tasks.indexOf(visible[i]);

  // a task's block (itself + sub-tasks) as an index range within its own file
  const blockRange = (list, i) => {
    let j = i + 1;
    while (j < list.length && (list[j].indent || 0) > (list[i].indent || 0)) j++;
    return [i, j];
  };

  // rewrite the file a project task came from, then re-render to reload it
  const withSrc = (task, fn) => {
    const list = loadTasks(task.src);
    const next = fn(list, task.srcIdx);
    if (next) saveTasks(next, task.src);
    setTick((n) => n + 1);
  };

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
  const sortArgCtx = view === 'home' && /^\/sort(by)?\s+/i.test(input) ? input.match(/[\w]*$/) : null;
  const sortMenu = sortArgCtx ? sortSuggestions(sortArgCtx[0]) : [];
  // right after a 📅 date is completed, offer a priority
  const prioCtx = view === 'home' && !input.startsWith('/') && !hashCtx ? input.match(PRIO_CTX) : null;
  const prioMenu = prioCtx ? prioritySuggestions(prioCtx[2]) : [];
  const menuLen = input.startsWith('/')
    ? tagArgCtx && tagMenu.length > 0
      ? tagMenu.length
      : projArgCtx && projMenu.length > 0
      ? projMenu.length
      : sortArgCtx && sortMenu.length > 0
      ? sortMenu.length
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

  const insertSort = (s) => {
    if (!sortArgCtx || !s) return;
    editInput((v) => `${v.slice(0, sortArgCtx.index)}${s.key}`);
  };

  const insertPriority = (s) => {
    if (!prioCtx || !s) return;
    editInput((v) => `${v.slice(0, prioCtx.index)}📅 ${prioCtx[1]} ${s.emoji ? `${s.emoji} ` : ''}`);
  };

  // a task plus its sub-tasks (the lines below it with deeper indentation)
  const blockOf = (task) => {
    const i = tasks.indexOf(task);
    if (i < 0) return [task];
    let j = i + 1;
    while (j < tasks.length && (tasks[j].indent || 0) > (task.indent || 0)) j++;
    return tasks.slice(i, j);
  };

  // split a list into tasks (with their sub-blocks) whose #tag matches a
  // project name, and the rest
  const splitByTag = (list, name) => {
    const moved = [];
    const stay = [];
    for (let i = 0; i < list.length; ) {
      const t = list[i];
      let j = i + 1;
      while (j < list.length && (list[j].indent || 0) > (t.indent || 0)) j++;
      const block = list.slice(i, j);
      const hit = getTags(t).some((g) => slugifyProject(g.slice(1)) === name);
      (hit ? moved : stay).push(...block);
      i = j;
    }
    return { moved, stay };
  };

  // switch the task list to a project file (null = inbox), creating it if new
  const openProject = (name) => {
    const created = name && !projectExists(name);
    if (created) saveTasks([], name);
    projectRef.current = name;
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
    // new-project prompt: pull the matching tagged inbox tasks in?
    if (filePrompt) {
      if (ch === 'y' || ch === 'Y' || key.return) {
        const { moved, stay } = splitByTag(loadTasks(null), filePrompt.name);
        saveTasks(stay, null);
        const next = sortTasks([...loadTasks(filePrompt.name), ...moved]);
        saveTasks(next, filePrompt.name);
        if (project === filePrompt.name) setTasks(next);
        setFilePrompt(null);
        return note(`Filed ${moved.length} inbox task${moved.length === 1 ? '' : 's'} tagged #${filePrompt.name} into this project.`);
      }
      if (ch === 'n' || ch === 'N' || key.escape) {
        setFilePrompt(null);
        return note('Left them in the inbox — /file sweeps them over later.');
      }
      return;
    }
    if (key.escape) {
      if (editing) {
        setEditing(null);
        editInput(() => '');
        return note('Edit cancelled.');
      }
      if (panel) setPanel(null);
      return;
    }
    if ((key.upArrow || key.downArrow) && key.shift) {
      // reorder (Cmd+Shift+↑/↓ isn't visible to terminals, so Shift+↑/↓)
      if (tagFilter) return note('Clear the tag filter (/all) to reorder.');
      const task = tasks[sel];
      if (!task) return note('Open the project (/project) to reorder its tasks.');
      const dir = key.upArrow ? -1 : 1;
      if ((task.indent || 0) === 0) {
        // top-level tasks move as a block, sub-tasks riding along
        const blocks = taskBlocks(tasks);
        const bi = blocks.findIndex((b) => b.includes(task));
        if (bi + dir < 0 || bi + dir >= blocks.length) return;
        [blocks[bi + dir], blocks[bi]] = [blocks[bi], blocks[bi + dir]];
        const next = blocks.flat();
        persist(next);
        setSel(next.indexOf(task));
      } else {
        // sub-tasks swap with an adjacent sibling at the same depth
        const ni = sel + dir;
        if (ni < 0 || ni >= tasks.length || (tasks[ni].indent || 0) !== (task.indent || 0))
          return note('Sub-tasks reorder among siblings at the same depth.');
        const next = [...tasks];
        [next[sel], next[ni]] = [next[ni], next[sel]];
        persist(next);
        setSel(ni);
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
        if (task.src) {
          // project task shown in the inbox: archive it out of its own file
          withSrc(task, (list, i) => {
            const [a, b] = blockRange(list, i);
            list.slice(a, b).forEach(archiveTask);
            return [...list.slice(0, a), ...list.slice(b)];
          });
          setArchive(loadArchive());
          setSel((s) => Math.max(0, Math.min(s, visible.length - 2)));
          return note(`Archived from ${task.src}: ${task.title}`);
        }
        const block = blockOf(task); // sub-tasks go along with their parent
        block.forEach(archiveTask);
        setArchive(loadArchive());
        persist(tasks.filter((t) => !block.includes(t)));
        setSel((s) => Math.max(0, Math.min(s, visible.length - 2)));
        note(`Archived: ${task.title}${block.length > 1 ? ` (+${block.length - 1} sub-task${block.length > 2 ? 's' : ''})` : ''}`);
      }
      return;
    }

    // edit the selected task: its text loads into the input box for reworking
    if (key.ctrl && ch === 'e' && !input) {
      const task = visible[sel];
      if (!task) return;
      let text = task.title;
      if (task.priority) text += ` ${priorityEmoji(task.priority)}`;
      if (task.date) text += ` 📅 ${task.date}`;
      setEditing(task);
      editInput(() => text);
      return note('Editing — enter saves · esc cancels');
    }

    if (key.ctrl && ch === 'd') {
      const task = visible[sel];
      if (task) {
        if (task.src) {
          withSrc(task, (list, i) => {
            const [a, b] = blockRange(list, i);
            return [...list.slice(0, a), ...list.slice(b)];
          });
          setSel((s) => Math.max(0, Math.min(s, visible.length - 2)));
          return note(`Deleted from ${task.src}: ${task.title}`);
        }
        const block = blockOf(task);
        persist(tasks.filter((t) => !block.includes(t)));
        setSel((s) => Math.max(0, Math.min(s, visible.length - 2)));
        note(`Deleted: ${task.title}${block.length > 1 ? ` (+${block.length - 1} sub-task${block.length > 2 ? 's' : ''})` : ''}`);
      }
      return;
    }

    // cycle through the lists in the nav bar: ctrl+p forward, ctrl+0 back
    // (ctrl+o too — many terminals can't transmit ctrl+digit)
    if (key.ctrl && (ch === 'p' || ch === '0' || ch === 'o')) {
      const items = [null, ...listProjects()];
      const dir = ch === 'p' ? 1 : -1;
      // step from the ref, not render state — rapid presses land before the
      // re-render, and stepping from a stale list makes cycling feel stuck
      const next = items[(items.indexOf(projectRef.current) + dir + items.length) % items.length];
      projectRef.current = next;
      openProject(next);
      return note(next ? `Project: ${next}` : 'Inbox.');
    }

    // Toggl: start/stop tracking the selected task. The gretchen project is
    // created in Toggl if missing; inbox tasks fall back to their first #tag
    // (match-only), then "Untitled".
    if (key.ctrl && ch === 't') {
      const task = visible[sel];
      if (!task) return;

      // close out the running session: append the local CSV row, stop Toggl
      const finish = (t) => {
        logEntry({
          description: togglDescription(t.title),
          project: t.project || '',
          tags: t.tags || [],
          startedAt: t.startedAt,
          stoppedAt: Date.now(),
        });
        if (t.id) stopEntry(t.id).catch((e) => note(`Logged locally; Toggl stop failed: ${e.message}`));
      };

      if (tracking && tracking.title === task.title) {
        const elapsed = fmtElapsed(Date.now() - tracking.startedAt);
        finish(tracking);
        setTracking(null);
        return note(
          `⏹ ${elapsed} on "${togglDescription(tracking.title)}" — logged to time.csv${tracking.id ? ' + Toggl' : ''}`
        );
      }

      if (tracking) finish(tracking); // switching tasks: the old session is logged first

      const projName = project || task.src || '';
      const description = togglDescription(task.title);
      const session = {
        id: null,
        title: task.title,
        startedAt: Date.now(),
        project: projName,
        tags: getTags(task).map((g) => g.slice(1)),
      };
      setTracking(session);
      if (toggl && togglToken()) {
        note('Toggl: starting…');
        startEntry({ description, project: projName, tag: getTags(task)[0] })
          .then(({ entry, project: proj }) => {
            setTracking({ ...session, id: entry.id, startedAt: new Date(entry.start).getTime() });
            note(`⏺ tracking "${description}" → ${proj.name} (Toggl + time.csv)`);
          })
          .catch((e) => note(`⏺ tracking "${description}" locally (Toggl start failed: ${e.message})`));
      } else {
        note(`⏺ tracking "${description}" — ctrl+t stops · /time shows the log`);
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
      if (editing) {
        // saving an edit: rewrite the task in place, keeping done state,
        // nesting, and sub-tasks; clearing the text cancels
        const target = editing;
        setEditing(null);
        editInput(() => '');
        const updated = text ? parseInput(text) : null;
        if (!updated?.title) return note('Edit cancelled.');
        if (target.src) {
          withSrc(target, (list, i) =>
            list.map((x, j) =>
              j === i ? { ...x, title: updated.title, date: updated.date, priority: updated.priority } : x
            )
          );
          return note(`Updated in ${target.src}: ${updated.title}`);
        }
        const merged = { ...target, title: updated.title, date: updated.date, priority: updated.priority };
        persist(tasks.map((t) => (t === target ? merged : t)));
        return note(`Updated: ${formatTask(merged).trim()}`);
      }
      if (!text) {
        // toggle done on selected task
        const task = visible[sel];
        if (task) {
          if (task.src) {
            withSrc(task, (list, i) =>
              list.map((x, j) =>
                j === i ? { ...x, done: !x.done, doneDate: x.done ? null : today() } : x
              )
            );
            return;
          }
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
          if (created) {
            // offer to pull matching tagged tasks out of the inbox
            const { moved } = splitByTag(loadTasks(null), name);
            if (moved.length) {
              setFilePrompt({ name, count: moved.length });
              return;
            }
          }
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
          if ((dest ?? null) === (task.src ?? project ?? null)) return note('Task is already in that list.');
          const created = dest && !projectExists(dest);
          if (task.src) {
            // project task selected from the inbox view: pull it out of its file
            const list = loadTasks(task.src);
            const [a, b] = blockRange(list, task.srcIdx);
            const block = list.slice(a, b).map(({ src, srcIdx, ...t }) => t);
            saveTasks([...list.slice(0, a), ...list.slice(b)], task.src);
            if (dest) saveTasks([...loadTasks(dest), ...block], dest);
            else persist([...tasks, ...block]);
            setTick((n) => n + 1);
            return note(`Moved ${task.src} → ${dest ?? 'inbox'}: ${task.title}`);
          }
          const block = blockOf(task); // sub-tasks move with their parent
          saveTasks([...loadTasks(dest), ...block], dest);
          persist(tasks.filter((t) => !block.includes(t)));
          setSel((s) => Math.max(0, Math.min(s, visible.length - 2)));
          return note(`Moved to ${dest ?? 'inbox'}${created ? ' (new project)' : ''}: ${task.title}`);
        }
        if (cmd === 'file') {
          // sweep: each top-level task whose #tag matches an existing project
          // moves there (with its sub-tasks); everything else stays put
          const moved = {};
          const stay = [];
          let skip = 0;
          for (let i = 0; i < tasks.length; i++) {
            if (skip > 0) {
              skip--;
              continue;
            }
            const t = tasks[i];
            const block = blockOf(t);
            const dest = getTags(t)
              .map((g) => slugifyProject(g.slice(1)))
              .find((n) => n && n !== project && projectExists(n));
            if (dest) {
              (moved[dest] ||= []).push(...block);
              skip = block.length - 1;
            } else stay.push(...block);
          }
          const names = Object.keys(moved);
          if (!names.length) return note('Nothing to file — no #tags match an existing project.');
          for (const n of names) saveTasks(sortTasks([...loadTasks(n), ...moved[n]]), n);
          persist(stay);
          setSel(0);
          const total = tasks.length - stay.length;
          return note(`Filed ${total} task${total === 1 ? '' : 's'} → ${names.join(', ')}.`);
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
          // bare /sort opens the picker; /sort <key> (or the highlighted option) sorts
          const arg = (sortArgCtx && sortMenu[msel]?.key) || text.split(/\s+/)[1];
          if (!arg) return editInput(() => '/sort ');
          const k = SORT_KEYS.find((s) => s.key.startsWith(arg.toLowerCase()));
          if (!k)
            return note(`Unknown sort: ${arg} — options: ${SORT_KEYS.map((s) => s.key).join(', ')}.`);
          persist(sortTasks(tasks, k.key));
          setSel(0);
          return note(`Sorted by ${k.key} (${k.desc}) — sub-tasks stay with their parent.`);
        }
        if (cmd === 'time') {
          const [, arg, value] = text.split(/\s+/);
          if (arg === 'email') {
            if (!value)
              return note(
                getEmail()
                  ? `Import email: ${getEmail()} — /time email <addr> changes it.`
                  : 'No email set — /time email you@example.com (Toggl import uses it to match you).'
              );
            setEmail(value);
            return note(`Import email set to ${value} — new time.csv rows will carry it.`);
          }
          if (arg === 'open') {
            import('node:child_process').then(({ spawn }) =>
              spawn('open', [timeCsvPath()], { detached: true, stdio: 'ignore' }).unref()
            );
            return note(`Opening ${timeCsvPath()}`);
          }
          const s = timeStats();
          return note(
            s.entries === 0
              ? `No time entries yet — ctrl+t on a task starts the timer. Log: ${timeCsvPath()}`
              : `${s.entries} entr${s.entries === 1 ? 'y' : 'ies'} · ${s.today} today · ${s.total} total · ${timeCsvPath()}${getEmail() ? '' : ' — set /time email for Toggl import'}`
          );
        }
        if (cmd === 'toggl') {
          const [, arg, ...rest] = text.split(/\s+/);
          // /toggl map — route a gretchen project or #tag to a specific Toggl project
          if (arg === 'map') {
            const map = loadMap();
            const [from, ...toParts] = rest;
            const to = toParts.join(' ');
            if (!from) {
              const list = Object.entries(map).map(([k, v]) => `${k} → ${v}`).join(' · ');
              return note(list ? `Toggl mappings: ${list} — /toggl unmap <name> removes.` : 'No mappings yet. /toggl map <project-or-#tag> <toggl project>.');
            }
            if (!to) return note('Usage: /toggl map <project-or-#tag> <toggl project>');
            if (!toggl || !togglToken()) return note('Connect Toggl first — /toggl opens setup.');
            note('Toggl: checking project…');
            togglProjectByName(to)
              .then((p) => {
                if (!p) return note(`No Toggl project named "${to}" — create it in Toggl first, or check the spelling.`);
                map[mapKey(from)] = p.name;
                saveMap(map);
                note(`Mapped ${from.replace(/^#/, '')} → Toggl project ${p.name}.`);
              })
              .catch((e) => note(`Toggl error: ${e.message}`));
            return;
          }
          if (arg === 'unmap') {
            const map = loadMap();
            const from = mapKey(rest[0] || '');
            if (!from || !(from in map)) return note(`No mapping for "${rest[0] || ''}" — /toggl map lists them.`);
            const was = map[from];
            delete map[from];
            saveMap(map);
            return note(`Unmapped ${from} (was → ${was}).`);
          }
          if (!arg && toggl)
            return note('Toggl is on — ctrl+t tracks the selected task · /toggl map routes projects/tags · /toggl off disconnects.');
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
      // in the inbox, a #tag matching an existing project files the task there
      if (!project) {
        const dest = getTags(task)
          .map((g) => slugifyProject(g.slice(1)))
          .find((n) => n && projectExists(n));
        if (dest) {
          saveTasks(sortTasks([...loadTasks(dest), task]), dest);
          return note(`Added to project ${dest} (matched #tag): ${formatTask(task)}`);
        }
      }
      // adding re-sorts the list (priority, then due date); sub-task blocks stay intact
      const next = sortTasks([...tasks, task]);
      persist(next);
      setSel(next.indexOf(task));
      note(`Added: ${formatTask(task)} — tab nests it under the task above`);
      return;
    }

    if (key.tab) {
      // tab with an empty input cycles the selected task's nesting: deeper
      // under the task above until the max depth, then back to top level.
      // shift+tab outdents one level directly.
      if (key.shift || (input === '' && visible[sel])) {
        if (tagFilter) return note('Clear the tag filter (/all) to change nesting.');
        const task = visible[sel];
        if (!task) return;
        if (task.src) return note(`Open the project (/project ${task.src}) to change nesting.`);
        const idx = tasks.indexOf(task);
        const cur = task.indent || 0;
        const max = idx > 0 ? (tasks[idx - 1].indent || 0) + 1 : 0;
        const next = key.shift ? Math.max(0, cur - 1) : cur >= max ? 0 : cur + 1;
        if (next === cur)
          return note(key.shift ? 'Already a top-level task.' : 'Nothing above to nest under.');
        persist(tasks.map((t) => (t === task ? { ...t, indent: next } : t)));
        return;
      }
      if (tagMenu.length > 0) return insertTag(tagMenu[msel]);
      if (projArgCtx && projMenu.length > 0) return insertProject(projMenu[msel]);
      if (sortArgCtx && sortMenu.length > 0) return insertSort(sortMenu[msel]);
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
          {archive.map((t, i) => {
            const s = archiveSections(t);
            const prev = i > 0 ? archiveSections(archive[i - 1]) : {};
            return (
              <Box key={i} flexDirection="column">
                {s.year !== prev.year && <Text bold color={ACCENT}>{s.year}</Text>}
                {(s.year !== prev.year || s.month !== prev.month) && <Text bold>  {s.month}</Text>}
                {(s.year !== prev.year || s.month !== prev.month || s.week !== prev.week) && (
                  <Text dimColor>    {s.week}</Text>
                )}
                <TaskLine task={t} selected={i === sel} />
              </Box>
            );
          })}
        </Box>
      )}

      {view === 'home' && (
        <Box flexDirection="column">
          <NavBar project={project} openCount={visible.filter((t) => !t.done).length} />
          {filePrompt && (
            <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} marginTop={1}>
              <Text>
                <Text bold color="magenta">New project {filePrompt.name} — </Text>
                file {filePrompt.count} inbox task{filePrompt.count === 1 ? '' : 's'} tagged{' '}
                <Text color="yellow">#{filePrompt.name}</Text> into it?
              </Text>
              <Text dimColor>y/enter yes · n/esc keep them in the inbox</Text>
            </Box>
          )}
          {visible.length === 0 && (
            <Text dimColor>
              {tagFilter ? `No tasks tagged ${tagFilter}. /all clears the filter.` : 'No tasks yet. Type one below and press enter.'}
            </Text>
          )}
          {visible.map((t, i) => (
            <TaskLine
              key={visible[i].src ? `${visible[i].src}:${visible[i].srcIdx}` : `inbox:${realIndex(i)}`}
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
              <Text color={editing ? 'yellow' : ACCENT}>{editing ? '✍️ ' : '> '}</Text>
              <Text wrap="truncate-start">{input}</Text>
              <Text color={ACCENT}>▌</Text>
            </Box>
          )}
          {input.startsWith('/') && !(tagArgCtx && tagMenu.length > 0) && !(projArgCtx && projMenu.length > 0) && !(sortArgCtx && sortMenu.length > 0) && (
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
          {sortArgCtx && sortMenu.length > 0 && (
            <Box flexDirection="column" paddingX={2}>
              <Text dimColor>sort by…</Text>
              {sortMenu.map((s, i) => (
                <Text key={s.key}>
                  <Text color={i === msel ? ACCENT : undefined} bold={i === msel}>
                    {i === msel ? '❯ ' : '  '}{s.key.padEnd(13)}
                  </Text>
                  <Text dimColor>{s.desc}</Text>
                </Text>
              ))}
              <Text dimColor>↑/↓ select · tab completes · enter sorts</Text>
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
