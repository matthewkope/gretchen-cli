import React from 'react';
import { render } from 'ink';
import { App } from './app.jsx';

const arg = (process.argv[2] || '').toLowerCase();

if (arg === '--help' || arg === '-h' || arg === 'help') {
  console.log(`Gretchen — terminal project management

Usage:
  gretchen | gre        open the task board
  gre cal               open the calendar
  gre help              show this help

Inside the app:
  type a task + enter   add a task ("ship report due friday #work", "demo @today")
                        #tags group tasks; dates become Obsidian Tasks format (📅 date)
  enter (empty input)   toggle done on the selected task
  up/down               select a task
  shift+up/down         reorder the selected task
  tab / shift+tab       nest the selected task under the one above / un-nest
  ctrl+space            archive the selected task (sub-tasks go along)
  ctrl+d                delete the selected task (sub-tasks go along)

After entering a date, a priority picker appears — Obsidian Tasks emojis
(🔺 highest, ⏫ high, 🔼 medium, 🔽 low, ⏬ lowest); enter on "none" skips.

Slash commands (type / to see the menu, tab completes):
  /cal                  open the calendar (dates from all projects)
  /project <name>       open a project, creating it if new (/projects lists)
  /inbox                back to the inbox task list
  /move <name>          move the selected task into a project (or inbox)
  /archive              archive all completed tasks (/clear also works)
  /archived             view archived tasks
  /tag <name>           filter by #tag (/tag lists tags, /all clears)
  /sort                 sort tasks by due date
  /stats                task counts at a glance
  /help                 in-app help
  /exit (or /quit)      quit gretchen

Tasks are stored as plain markdown in ~/.gretchen/tasks.md`);
  process.exit(0);
}

const initialView = arg === 'cal' || arg === 'calendar' ? 'calendar' : 'home';

const app = render(<App initialView={initialView} />);
app.waitUntilExit().then(() => process.exit(0));
