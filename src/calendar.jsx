import React, { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { today } from './store.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MODES = ['month', 'week', 'day'];

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// pad/truncate to exactly w columns (truncates with an ellipsis)
function fit(s, w) {
  const chars = [...s];
  if (chars.length > w) return chars.slice(0, Math.max(0, w - 1)).join('') + '…';
  return s + ' '.repeat(w - chars.length);
}

function rule(cellW, left, mid, right) {
  return left + Array(7).fill('─'.repeat(cellW)).join(mid) + right;
}

// A week-row grid: weeks is Date[][] (each inner array has 7 Dates).
// Each cell shows the day number plus up to eventRows event lines.
function Grid({ weeks, month, cursor, byDate, accent, todayStr, cellW, eventRows, showDow }) {
  const cursorStr = iso(cursor);
  return (
    <Box flexDirection="column">
      <Text dimColor>{rule(cellW, '┌', '┬', '┐')}</Text>
      {showDow && (
        <>
          <Text>
            <Text dimColor>│</Text>
            {DOW.map((d, i) => (
              <Text key={i}>
                <Text bold dimColor>{fit(` ${d}`, cellW)}</Text>
                <Text dimColor>│</Text>
              </Text>
            ))}
          </Text>
          <Text dimColor>{rule(cellW, '├', '┼', '┤')}</Text>
        </>
      )}
      {weeks.map((week, wi) => (
        <Box key={wi} flexDirection="column">
          {Array.from({ length: eventRows + 1 }, (_, row) => (
            <Text key={row}>
              <Text dimColor>│</Text>
              {week.map((date, di) => {
                const dateStr = iso(date);
                const inMonth = month === undefined || date.getMonth() === month;
                const isSel = dateStr === cursorStr;
                const isToday = dateStr === todayStr;
                const dayTasks = byDate[dateStr] || [];
                let cell;
                if (row === 0) {
                  // day-number line
                  const label = fit(` ${date.getDate()}${isToday ? ' •' : ''}`, cellW);
                  cell = (
                    <Text
                      inverse={isSel}
                      bold={isToday || isSel}
                      color={isSel ? accent : isToday ? 'green' : undefined}
                      dimColor={!inMonth && !isSel}
                    >
                      {label}
                    </Text>
                  );
                } else {
                  const overflow = dayTasks.length > eventRows;
                  if (row === eventRows && overflow) {
                    cell = <Text dimColor>{fit(` +${dayTasks.length - eventRows + 1} more`, cellW)}</Text>;
                  } else {
                    const t = dayTasks[row - 1];
                    if (!t) cell = <Text>{' '.repeat(cellW)}</Text>;
                    else
                      cell = (
                        <Text
                          color={t.done ? 'green' : 'cyan'}
                          dimColor={t.done || !inMonth}
                          strikethrough={t.done}
                        >
                          {fit(` ${t.title}`, cellW)}
                        </Text>
                      );
                  }
                }
                return (
                  <Text key={di}>
                    {cell}
                    <Text dimColor>│</Text>
                  </Text>
                );
              })}
            </Text>
          ))}
          <Text dimColor>{rule(cellW, ...(wi === weeks.length - 1 ? ['└', '┴', '┘'] : ['├', '┼', '┤']))}</Text>
        </Box>
      ))}
    </Box>
  );
}

function DayView({ cursor, byDate, accent, todayStr }) {
  const dateStr = iso(cursor);
  const dayTasks = byDate[dateStr] || [];
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={accent} paddingX={1}>
      <Text bold color={accent}>
        {DOW[cursor.getDay()]}, {MONTHS[cursor.getMonth()]} {cursor.getDate()}, {cursor.getFullYear()}
        {dateStr === todayStr ? ' (today)' : ''}
      </Text>
      {dayTasks.length === 0 && <Text dimColor>No tasks due this day.</Text>}
      {dayTasks.map((t, i) => (
        <Text key={i}>
          <Text color={t.done ? 'green' : 'white'}>{t.done ? '[x]' : '[ ]'}</Text>{' '}
          <Text strikethrough={t.done} dimColor={t.done} color={!t.done && t.date < todayStr ? 'red' : undefined}>
            {t.title}
          </Text>
        </Text>
      ))}
    </Box>
  );
}

export function Calendar({ tasks, accent }) {
  const { stdout } = useStdout();
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [mode, setMode] = useState('month');

  const byDate = {};
  for (const t of tasks) {
    if (t.date) (byDate[t.date] ||= []).push(t);
  }

  useInput((ch, key) => {
    const move = (days) => setCursor((c) => new Date(c.getFullYear(), c.getMonth(), c.getDate() + days));
    const moveMonth = (n) =>
      setCursor((c) => {
        const last = new Date(c.getFullYear(), c.getMonth() + n + 1, 0).getDate();
        return new Date(c.getFullYear(), c.getMonth() + n, Math.min(c.getDate(), last));
      });

    if (ch === 'm') return setMode('month');
    if (ch === 'w') return setMode('week');
    if (ch === 'd') return setMode('day');
    if (key.tab || ch === 'v') return setMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length]);
    if (key.return) return setMode((m) => (m === 'month' ? 'week' : 'day'));
    if (key.leftArrow && key.shift) return mode === 'month' ? moveMonth(-1) : move(mode === 'week' ? -7 : -1);
    if (key.rightArrow && key.shift) return mode === 'month' ? moveMonth(1) : move(mode === 'week' ? 7 : 1);
    if (key.leftArrow) return move(-1);
    if (key.rightArrow) return move(1);
    if (key.upArrow) return move(-7);
    if (key.downArrow) return move(7);
    if (ch === 't') return setCursor(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  });

  const cols = stdout?.columns ?? 80;
  const cellW = Math.max(8, Math.min(18, Math.floor((cols - 10) / 7)));
  const todayStr = today();

  // the week containing the cursor, starting Sunday
  const weekStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - cursor.getDay());
  const week = Array.from({ length: 7 }, (_, i) =>
    new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));

  // full month grid, padded with adjacent-month days
  const monthWeeks = [];
  if (mode === 'month') {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    for (let d = new Date(gridStart); d <= lastDay; d.setDate(d.getDate() + 7)) {
      monthWeeks.push(Array.from({ length: 7 }, (_, i) =>
        new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)));
    }
  }

  const title =
    mode === 'day'
      ? `${MONTHS[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`
      : mode === 'week'
      ? `Week of ${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}, ${weekStart.getFullYear()}`
      : `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const selTasks = byDate[iso(cursor)] || [];

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        <Text bold color={accent}>{title}</Text>
        <Text dimColor>
          {'  '}
          {MODES.map((m) => (m === mode ? `[${m}]` : ` ${m} `)).join(' ')}
        </Text>
      </Text>
      {mode === 'month' && (
        <Grid weeks={monthWeeks} month={cursor.getMonth()} cursor={cursor} byDate={byDate}
          accent={accent} todayStr={todayStr} cellW={cellW} eventRows={2} showDow />
      )}
      {mode === 'week' && (
        <Grid weeks={[week]} cursor={cursor} byDate={byDate}
          accent={accent} todayStr={todayStr} cellW={cellW} eventRows={8} showDow />
      )}
      {mode === 'day' && <DayView cursor={cursor} byDate={byDate} accent={accent} todayStr={todayStr} />}
      {mode !== 'day' && (
        <Text dimColor>
          {iso(cursor)}{iso(cursor) === todayStr ? ' (today)' : ''} — {selTasks.length} task{selTasks.length === 1 ? '' : 's'}
        </Text>
      )}
    </Box>
  );
}
