import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { today } from './store.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function Calendar({ tasks, accent }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth(), d: now.getDate() });

  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const firstDow = new Date(cursor.y, cursor.m, 1).getDay();

  const byDate = {};
  for (const t of tasks) {
    if (t.date) (byDate[t.date] ||= []).push(t);
  }

  useInput((ch, key) => {
    const move = (days) => {
      const d = new Date(cursor.y, cursor.m, cursor.d + days);
      setCursor({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() });
    };
    const moveMonth = (n) => {
      const d = new Date(cursor.y, cursor.m + n, 1);
      setCursor({ y: d.getFullYear(), m: d.getMonth(), d: Math.min(cursor.d, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()) });
    };
    if (key.leftArrow && key.shift) return moveMonth(-1);
    if (key.rightArrow && key.shift) return moveMonth(1);
    if (key.leftArrow) return move(-1);
    if (key.rightArrow) return move(1);
    if (key.upArrow) return move(-7);
    if (key.downArrow) return move(7);
    if (ch === 't') return setCursor({ y: now.getFullYear(), m: now.getMonth(), d: now.getDate() });
  });

  // build weeks
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const selectedDate = iso(cursor.y, cursor.m, cursor.d);
  const dayTasks = byDate[selectedDate] || [];
  const todayStr = today();

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color={accent}>
        {MONTHS[cursor.m]} {cursor.y}
      </Text>
      <Text dimColor>{' Su  Mo  Tu  We  Th  Fr  Sa'}</Text>
      {weeks.map((week, wi) => (
        <Text key={wi}>
          {week.map((d, di) => {
            if (d === null) return <Text key={di}>{'    '}</Text>;
            const dateStr = iso(cursor.y, cursor.m, d);
            const isSel = d === cursor.d;
            const isToday = dateStr === todayStr;
            const hasTasks = !!byDate[dateStr];
            const label = String(d).padStart(2, ' ');
            return (
              <Text key={di}>
                <Text
                  inverse={isSel}
                  color={isSel ? accent : hasTasks ? 'cyan' : isToday ? 'green' : undefined}
                  bold={isToday || hasTasks}
                >
                  {` ${label}`}
                </Text>
                <Text color="cyan">{hasTasks ? '•' : ' '}</Text>
              </Text>
            );
          })}
        </Text>
      ))}
      <Box flexDirection="column" marginTop={1}>
        <Text bold>
          {selectedDate}
          {selectedDate === todayStr ? ' (today)' : ''} — {dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}
        </Text>
        {dayTasks.map((t, i) => (
          <Text key={i}>
            {'  '}
            <Text color={t.done ? 'green' : 'white'}>{t.done ? '[x]' : '[ ]'}</Text> {t.title}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
