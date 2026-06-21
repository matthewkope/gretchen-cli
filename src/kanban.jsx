import React, { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import {
  loadBoard, saveBoard, parseInput, archiveTask, loadSprint, startNewSprint,
  sprintLabel, listBoards, addBoard,
} from './store.js';

// The kanban board, terminal edition. Same ~/.gretchen board files the web app
// and the Mac app use (Obsidian Kanban format), so edits here show up there and
// vice versa. Each board is its own sprint. No drag-and-drop in a terminal, so:
//   ←/→ or h/l : select column      ↑/↓ or j/k : select card
//   shift+←/→  : move card to the prev/next list (change its status)
//   shift+↑/↓  : reorder the card within its list
//   [ / ]      : switch board (sprint)      B : new board
//   a add · enter/e edit · x delete · A archive list · S new sprint · n new list · r rename
export function Kanban({ accent, onExit }) {
  const { stdout } = useStdout();
  const [boardSlug, setBoardSlug] = useState('default');
  const [boards, setBoards] = useState(() => listBoards());
  const [board, setBoard] = useState(() => loadBoard('default'));
  const [sprint, setSprint] = useState(() => loadSprint('default'));
  const [colIdx, setColIdx] = useState(0);
  const [cardIdx, setCardIdx] = useState(0);
  const [editing, setEditing] = useState(null); // { mode:'add'|'edit'|'newcol'|'rename'|'newboard', text }
  const [flash, setFlash] = useState(null);

  const commit = (next) => { saveBoard(next, boardSlug); setBoard(next); };
  const clone = () => board.map((c) => ({ ...c, cards: [...c.cards] }));
  const col = board[colIdx];
  const card = col?.cards[cardIdx];

  // switch to another board (sprint), reloading its columns + sprint header
  function switchBoard(slug) {
    setBoardSlug(slug);
    setBoard(loadBoard(slug));
    setSprint(loadSprint(slug));
    setBoards(listBoards());
    setColIdx(0);
    setCardIdx(0);
  }
  function cycleBoard(dir) {
    const list = listBoards();
    if (list.length < 2) { setFlash('only one board — press B to make another'); return; }
    const i = Math.max(0, list.findIndex((b) => b.slug === boardSlug));
    const nextB = list[(i + dir + list.length) % list.length];
    switchBoard(nextB.slug);
    setFlash(`board: ${nextB.name}`);
  }

  // archive the Done list, roll the rest forward, bump the sprint number
  function newSprint() {
    const out = startNewSprint({ goal: '' }, boardSlug);
    setBoard(loadBoard(boardSlug));
    setSprint(out.sprint);
    setBoards(listBoards());
    setColIdx(0);
    setCardIdx(0);
    setFlash(`${sprintLabel(out.sprint)} started — archived ${out.archived} card${out.archived === 1 ? '' : 's'}`);
  }

  function moveCard(dir) {
    const to = colIdx + dir;
    if (!card || to < 0 || to >= board.length) return;
    const next = clone();
    const [c] = next[colIdx].cards.splice(cardIdx, 1);
    const at = Math.min(cardIdx, next[to].cards.length);
    next[to].cards.splice(at, 0, c);
    commit(next);
    setColIdx(to);
    setCardIdx(at);
  }
  function reorderCard(dir) {
    const j = cardIdx + dir;
    if (!card || j < 0 || j >= col.cards.length) return;
    const next = clone();
    const arr = next[colIdx].cards;
    [arr[cardIdx], arr[j]] = [arr[j], arr[cardIdx]];
    commit(next);
    setCardIdx(j);
  }
  function deleteCard() {
    if (!card) return;
    const next = clone();
    const [removed] = next[colIdx].cards.splice(cardIdx, 1);
    commit(next);
    setCardIdx((i) => Math.max(0, Math.min(i, next[colIdx].cards.length - 1)));
    setFlash(`Deleted: ${removed.title}`);
  }
  function archiveColumn() {
    if (!col?.cards.length) return;
    const n = col.cards.length;
    const label = sprintLabel(sprint); // stamp each card with its sprint
    for (const c of col.cards) archiveTask(c, label); // → ~/.gretchen/archive.md
    const next = board.map((c, i) => (i === colIdx ? { ...c, cards: [] } : c));
    commit(next);
    setCardIdx(0);
    setFlash(`Archived ${n} card${n === 1 ? '' : 's'} from ${col.name}`);
  }
  function commitEdit() {
    const text = editing.text.trim();
    const m = editing.mode;
    if ((m === 'add' || m === 'edit') && text) {
      const parsed = { ...parseInput(text), indent: 0 };
      if (parsed.title) {
        if (m === 'add') {
          const next = board.map((c, i) => (i === colIdx ? { ...c, cards: [...c.cards, parsed] } : c));
          commit(next);
          setCardIdx(next[colIdx].cards.length - 1);
        } else {
          const next = board.map((c, i) => ({
            ...c, cards: c.cards.map((cd, j) => (i === colIdx && j === cardIdx ? parsed : cd)),
          }));
          commit(next);
        }
      }
    } else if (m === 'newcol' && text) {
      const next = [...board, { name: text, cards: [] }];
      commit(next);
      setColIdx(next.length - 1);
      setCardIdx(0);
    } else if (m === 'rename' && text) {
      commit(board.map((c, i) => (i === colIdx ? { ...c, name: text } : c)));
    } else if (m === 'newboard' && text) {
      const { slug } = addBoard({ name: text });
      switchBoard(slug);
      setFlash(`Created board: ${text}`);
    }
    setEditing(null);
  }

  useInput((ch, key) => {
    // text-entry sub-mode captures everything
    if (editing) {
      if (key.escape) return setEditing(null);
      if (key.return) return commitEdit();
      if (key.backspace || key.delete) return setEditing((e) => ({ ...e, text: e.text.slice(0, -1) }));
      if (ch && !key.ctrl && !key.meta && !key.tab) setEditing((e) => ({ ...e, text: e.text + ch }));
      return;
    }
    setFlash(null);
    if (key.escape) return onExit();
    const n = board.length;
    // move a card between/within lists with shift
    if (key.shift && key.leftArrow) return moveCard(-1);
    if (key.shift && key.rightArrow) return moveCard(1);
    if (key.shift && key.upArrow) return reorderCard(-1);
    if (key.shift && key.downArrow) return reorderCard(1);
    // switch board (sprint)
    if (ch === '[') return cycleBoard(-1);
    if (ch === ']') return cycleBoard(1);
    if (ch === 'B') return setEditing({ mode: 'newboard', text: '' });
    // navigate
    if (key.leftArrow || ch === 'h') { setColIdx((i) => Math.max(0, i - 1)); setCardIdx(0); return; }
    if (key.rightArrow || ch === 'l') { setColIdx((i) => Math.min(n - 1, i + 1)); setCardIdx(0); return; }
    if (key.upArrow || ch === 'k') return setCardIdx((i) => Math.max(0, i - 1));
    if (key.downArrow || ch === 'j') return setCardIdx((i) => Math.min(Math.max(0, (col?.cards.length || 1) - 1), i + 1));
    // actions
    if (ch === 'a') return setEditing({ mode: 'add', text: '' });
    if (ch === 'e' || key.return) { if (card) setEditing({ mode: 'edit', text: card.title }); return; }
    if (ch === 'x') return deleteCard();
    if (ch === 'A') return archiveColumn();
    if (ch === 'S') return newSprint();
    if (ch === 'n') return setEditing({ mode: 'newcol', text: '' });
    if (ch === 'r') { if (col) setEditing({ mode: 'rename', text: col.name }); return; }
  });

  // layout: fixed-width lists, a horizontal window scrolled to keep the
  // selected list visible; cards windowed vertically to keep the selection in view
  const totalW = stdout?.columns ?? 80;
  const colW = 28;
  const perScreen = Math.max(1, Math.floor((totalW - 1) / (colW + 2)));
  const startCol = Math.max(0, Math.min(colIdx - Math.floor(perScreen / 2), Math.max(0, board.length - perScreen)));
  const visible = board.map((c, i) => ({ ...c, idx: i })).slice(startCol, startCol + perScreen);
  const maxCards = Math.max(4, (stdout?.rows ?? 24) - 12);

  const editLabel = editing
    ? { add: `Add to ${col?.name}`, edit: 'Edit card', newcol: 'New list', rename: 'Rename list', newboard: 'New board name' }[editing.mode]
    : '';

  // day N of the sprint, inclusive of both endpoints
  const sprintDay = (() => {
    const d0 = (s) => new Date(`${s}T00:00:00`);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const D = 86400000;
    const total = Math.max(1, Math.round((d0(sprint.end) - d0(sprint.start)) / D) + 1);
    const day = Math.min(total, Math.max(1, Math.round((now - d0(sprint.start)) / D) + 1));
    return { day, total };
  })();

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* board tabs (one per sprint) */}
      <Text>
        <Text dimColor>boards  </Text>
        {boards.map((b, i) => (
          <Text key={b.slug} bold={b.slug === boardSlug} color={b.slug === boardSlug ? accent : undefined} dimColor={b.slug !== boardSlug}>
            {i > 0 ? '   ' : ''}{b.slug === boardSlug ? '▸ ' : '  '}{b.name}
          </Text>
        ))}
      </Text>
      <Text>
        <Text bold color={accent}>{sprintLabel(sprint)}</Text>
        <Text dimColor>
          {sprint.name ? `  #${sprint.number}` : ''}
          {'  '}{sprint.goal || 'no goal set'}
          {'  ·  '}{sprint.start} → {sprint.end}
          {'  ·  Day '}{sprintDay.day}/{sprintDay.total}
          {'  ·  '}{board.length} list{board.length === 1 ? '' : 's'}
          {startCol > 0 ? '  ‹ more' : ''}
          {startCol + perScreen < board.length ? '  more ›' : ''}
        </Text>
      </Text>

      <Box marginTop={1}>
        {visible.map((c) => {
          const isSel = c.idx === colIdx;
          const cards = c.cards;
          let from = 0;
          if (isSel && cards.length > maxCards) from = Math.max(0, Math.min(cardIdx - Math.floor(maxCards / 2), cards.length - maxCards));
          const shown = cards.slice(from, from + maxCards);
          return (
            <Box key={c.idx} flexDirection="column" width={colW} marginRight={2}
                 borderStyle="round" borderColor={isSel ? accent : 'gray'} paddingX={1}>
              <Text bold color={isSel ? accent : undefined} wrap="truncate">{c.name} ({cards.length})</Text>
              {cards.length === 0 && <Text dimColor>—</Text>}
              {from > 0 && <Text dimColor>↑ {from} more</Text>}
              {shown.map((cd, k) => {
                const j = from + k;
                const sel = isSel && j === cardIdx;
                return (
                  <Text key={j} wrap="truncate" inverse={sel} color={sel ? accent : undefined}>
                    {sel ? '› ' : '  '}{cd.title}
                  </Text>
                );
              })}
              {from + maxCards < cards.length && <Text dimColor>↓ {cards.length - (from + maxCards)} more</Text>}
            </Box>
          );
        })}
      </Box>

      {editing ? (
        <Box marginTop={1}>
          <Text color={accent}>{editLabel}: </Text>
          <Text>{editing.text}</Text>
          <Text color={accent}>█</Text>
        </Box>
      ) : (
        <Text dimColor>
          {flash ||
            'a add · e/⏎ edit · x del · ⇧←/→ move · ⇧↑/↓ reorder · n list · r rename · A archive · S sprint · [/] board · B new board · esc home'}
        </Text>
      )}
    </Box>
  );
}
