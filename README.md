# ✻ Gretchen

A terminal project management app styled after the Claude Code CLI. Tasks are plain
markdown, dates become a calendar, and finished work lands in a browsable archive.

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

Type into the prompt and press **enter** — Gretchen formats the markdown for you,
using the [Obsidian Tasks](https://publish.obsidian.md/tasks/) emoji format
(`📅` due date, `✅` done date), so your files work in Obsidian too:

| You type                    | Stored as                               |
| --------------------------- | --------------------------------------- |
| `ship the report`           | `- [ ] ship the report`                 |
| `call mom tomorrow`         | `- [ ] call mom 📅 2026-06-10`          |
| `demo due friday`           | `- [ ] demo 📅 2026-06-12`              |
| `pay rent @today`           | `- [ ] pay rent 📅 2026-06-09`          |
| `buy milk #home due monday` | `- [ ] buy milk #home 📅 2026-06-15`    |

Dates can be written as `@today`, `@tomorrow`, `@friday`, `@2026-07-01`, the same
words after `due`, or a bare trailing date word. `#tags` stay in the description
and can be used to filter the list. Archived tasks get a `✅` completion date.

Dates format as you type: the moment you finish a date word (`due friday` +
space), it's replaced inline with `📅 2026-06-12`. And typing `@` or `due `
opens a date picker under the prompt — upcoming days, next week, in 2 weeks —
navigate with `↑/↓`, insert with tab or enter.

Tags get the same treatment: typing `#` lists your existing tags with task
counts, filtered as you keep typing — `↑/↓` to select, tab or enter to insert.
`/tag ` shows the same picker for choosing a filter.

## Keys

| Key                | Action                                  |
| ------------------ | --------------------------------------- |
| `↑` / `↓`          | select a task                           |
| `shift+↑` / `shift+↓` | reorder the selected task            |
| `enter` (empty)    | toggle done on the selected task        |
| `ctrl+space`       | archive the selected task               |
| `ctrl+d`           | delete the selected task                |
## Slash commands

Type `/` in the prompt to open the command menu (tab completes, enter runs):

| Command            | Action                                  |
| ------------------ | --------------------------------------- |
| `/cal`             | calendar view                           |
| `/archive`         | archive view (`ctrl+u` to unarchive)    |
| `/tag <name>`      | filter by #tag (`/tag` lists all tags)  |
| `/all`             | clear the tag filter                    |
| `/clear`           | archive all completed tasks             |
| `/sort`            | sort tasks by due date (undated last)   |
| `/stats`           | open / done / archived / overdue counts |
| `/help`            | in-app help                             |
| `/exit` (`/quit`)  | exit (or `ctrl+c`)                      |

> **Note on Cmd shortcuts:** macOS terminals never forward the ⌘ key to apps (and
> ⌃⌘Space is the system emoji picker), so the originally requested ⌃⌘Space and
> ⌘⇧↑/↓ are mapped to `ctrl+space` and `shift+↑/↓`.

## Storage

Everything is plain markdown you can edit by hand:

- `~/.gretchen/tasks.md` — active tasks
- `~/.gretchen/archive.md` — archived tasks

## Development

```sh
npm install
npm run dev     # build and run
```
