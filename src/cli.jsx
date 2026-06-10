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
  type a task + enter   add a task ("ship report tomorrow", "demo @2026-06-15")
  enter (empty input)   toggle done on the selected task
  up/down               select a task
  shift+up/down         reorder the selected task
  ctrl+space            archive the selected task
  ctrl+d                delete the selected task
  /cal /archive /help /quit

Tasks are stored as plain markdown in ~/.gretchen/tasks.md`);
  process.exit(0);
}

const initialView = arg === 'cal' || arg === 'calendar' ? 'calendar' : 'home';

render(<App initialView={initialView} />);
