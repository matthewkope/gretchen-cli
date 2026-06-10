# ✻ Gretchen

A terminal project management app styled after the Claude Code CLI. Tasks are
plain markdown in the [Obsidian Tasks](https://publish.obsidian.md/tasks/)
format, dates become a calendar, finished work lands in a weekly-grouped
archive, and everything is driven from one prompt with slash commands and
pop-up pickers.

## Install

```sh
git clone https://github.com/matthewkope/gretchen.git
cd gretchen
npm install
npm link        # makes `gretchen` and `gre` available everywhere
```

## Usage

```sh
gretchen        # open the task board
gre             # same thing, shorter
gre cal         # jump straight to the calendar
gre help        # cheatsheet
```

## Adding tasks

Type into the prompt and press **enter**. Gretchen formats the markdown for
you, using the Obsidian Tasks emoji format, so your files work in Obsidian too:

| You type                    | Stored as                               |
| --------------------------- | --------------------------------------- |
| `ship the report`           | `- [ ] ship the report`                 |
| `call mom tomorrow`         | `- [ ] call mom 📅 2026-06-10`          |
| `demo due friday`           | `- [ ] demo 📅 2026-06-12`              |
| `pay rent @today`           | `- [ ] pay rent 📅 2026-06-09`          |
| `buy milk #home due monday` | `- [ ] buy milk #home 📅 2026-06-15`    |

Dates can be written as `@today`, `@tomorrow`, `@friday`, `@2026-07-01`, the
same words after `due`, or a bare trailing date word. They convert to
`📅 YYYY-MM-DD` live, the moment you finish the word. Completed tasks get a
`✅` done date. The list re-sorts on every add (priority, then due date).

## Pickers

Everything pops up under the prompt as you type — **↑/↓** selects, **tab or
enter** inserts:

- **`/`** — the command menu, filtered as you type
- **`@` or `due `** — a date picker: today, tomorrow, the rest of the week,
  next week, in 2 weeks
- **after a date lands** — a priority picker: 🔺 highest, ⏫ high, 🔼 medium,
  🔽 low, ⏬ lowest (enter on *none*, the default, just submits)
- **`#`** — your existing tags with task counts (`/tag ` too)
- **`/project `, `/move `** — projects with open-task counts
- **`/sort `** — the five sort keys

## Sub-tasks

Tasks nest, Obsidian-style — indented checklist lines under a parent:

```markdown
- [ ] plan launch
    - [ ] write announcement
    - [ ] book venue
```

With an empty prompt, **tab** nests the selected task under the one above;
press tab again to un-nest (**shift+tab** steps out one level directly).
A parent and its sub-tasks travel as one block: archiving, deleting, moving,
filing, reordering, and sorting all keep them together. Each line is still
its own task with its own date, priority, and done state.

## Projects

Each project is its own markdown file under `~/.gretchen/projects/`. The nav
bar above the task list shows the inbox and every project; the calendar
aggregates due dates from all of them.

- `/project <name>` opens a project, creating it if new (`/project` lists)
- `/inbox` returns to the main list
- `/move <name>` moves the selected task there (`/move inbox` brings it back)
- `/file` sweeps the list: every task whose `#tag` matches an existing
  project is filed into it
- **ctrl+p / ctrl+0** cycle forward/back through inbox and projects

## Toggl time tracking (optional)

`/toggl` opens your Toggl profile page; paste the API token into the prompt
and you're connected. **ctrl+t** then starts/stops tracking the selected task
with a live ⏺ elapsed timer — entries are named after the task text and filed
under the Toggl project matching the current Gretchen project (or first
`#tag`). `/toggl off` disconnects.

## Slash commands

| Command            | Action                                              |
| ------------------ | --------------------------------------------------- |
| `/cal`             | calendar — month/week/day views (`m`/`w`/`d`, tab)  |
| `/project <name>`  | open or create a project (`/proj`, `/projects`)     |
| `/inbox`           | back to the inbox (`/home`)                         |
| `/move <name>`     | move selected task to a project (`/mv`)             |
| `/file`            | file tagged tasks into matching projects (`/sweep`) |
| `/tag <name>`      | filter by #tag — `/tag` lists, `/all` clears        |
| `/sort <key>`      | priority · due · tag · description · status         |
| `/archive`         | archive all completed tasks (`/clear`)              |
| `/archived`        | view the archive (`ctrl+u` unarchives)              |
| `/stats`           | open / done / archived / due / overdue / projects   |
| `/toggl`           | connect or disconnect Toggl (`/toggl off`)          |
| `/commands`        | full command list with aliases (`/cmds`)            |
| `/exit`            | quit (`/quit`, `/q`, or ctrl+c)                     |

## Keys

| Key                   | Action                                       |
| --------------------- | -------------------------------------------- |
| `↑` / `↓`             | select a task (or steer an open picker)      |
| `shift+↑` / `shift+↓` | reorder — blocks move with their sub-tasks   |
| `tab` / `shift+tab`   | nest / un-nest the selected task             |
| `enter` (empty)       | toggle done on the selected task             |
| `ctrl+e`              | edit the selected task in the prompt         |
| `ctrl+space`          | archive the selected task (+ sub-tasks)      |
| `ctrl+d`              | delete the selected task (+ sub-tasks)       |
| `ctrl+t`              | start/stop Toggl tracking                    |
| `ctrl+p` / `ctrl+0`   | next / previous project                      |
| `esc`                 | back home / close panel / cancel edit        |

> **Note on Cmd shortcuts:** macOS terminals never forward the ⌘ key to apps
> (and ⌃⌘Space is the system emoji picker), so archive is `ctrl+space` and
> reorder is `shift+↑/↓` — the closest terminal-legal equivalents.

## Calendar

`gre cal` or `/cal`. Month, week, and day views (`m`/`w`/`d` or tab cycles,
enter zooms in). Arrows move by day/week, `shift+←/→` jumps a period, `t`
returns to today. Days with due tasks show them inline; today is highlighted.

## Storage

Everything is plain markdown you can edit by hand (or open in Obsidian):

- `~/.gretchen/tasks.md` — the inbox
- `~/.gretchen/projects/<name>.md` — one file per project
- `~/.gretchen/archive.md` — archived tasks, grouped by year/month/week
- `~/.gretchen/toggl-token` — Toggl API token, if connected

## Development

```sh
npm install
npm run dev     # build and run
```
