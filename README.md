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

Type into the prompt and press **enter** — Gretchen formats the markdown for you:

| You type                  | Stored as                          |
| ------------------------- | ---------------------------------- |
| `ship the report`         | `- [ ] ship the report`            |
| `call mom tomorrow`       | `- [ ] call mom @2026-06-10`       |
| `demo friday`             | `- [ ] demo @2026-06-12`           |
| `pay rent @2026-07-01`    | `- [ ] pay rent @2026-07-01`       |

## Keys

| Key                | Action                                  |
| ------------------ | --------------------------------------- |
| `↑` / `↓`          | select a task                           |
| `shift+↑` / `shift+↓` | reorder the selected task            |
| `enter` (empty)    | toggle done on the selected task        |
| `ctrl+space`       | archive the selected task               |
| `ctrl+d`           | delete the selected task                |
| `/cal`             | calendar view                           |
| `/archive`         | archive view (`ctrl+u` to unarchive)    |
| `/quit` or `ctrl+c`| exit                                    |

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
