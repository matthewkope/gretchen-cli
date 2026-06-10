import React from 'react';
import { Box, Text } from 'ink';

// Pixel-art mascot, drawn with half-block characters (two pixels per cell).
// Palette sampled from the reference photo: honey-blonde hair, fair skin,
// blue eyes, red dress over a white blouse.
const PALETTE = {
  H: '#d8a85e', // hair
  h: '#f3d394', // hair highlight
  S: '#f7d9be', // skin
  E: '#3f7fbf', // eyes
  L: '#d4543e', // lips
  B: '#f2b09a', // blush
  W: '#f7f2e7', // blouse
  D: '#e0442e', // dress
};

const GRID = [
  '....HHHHHHHH....',
  '..HHHHHHHHHHHH..',
  '.HHhHHHHHHHHhHH.',
  '.HHHHHHHHHHHHHH.',
  'HHHSSSSSSSSSSHHH',
  'HHSSSSSSSSSSSSHH',
  'HHSSEESSSSEESSHH',
  'HHSBSSSSSSSSBSHH',
  'HHSSSSLLLLSSSSHH',
  'HHHSSSSSSSSSSHHH',
  '.HHHSSSSSSSSHHH.',
  '.HHH...SS...HHH.',
  '.HHH.WWWWWW.HHH.',
  '.HHWWWDDDDWWWHH.',
  '.HHWWDDDDDDWWHH.',
  'HHHWDDDDDDDDWHHH',
];

export function Mascot() {
  const lines = [];
  for (let r = 0; r < GRID.length; r += 2) {
    const cells = [];
    for (let c = 0; c < GRID[r].length; c++) {
      const top = PALETTE[GRID[r][c]];
      const bot = PALETTE[GRID[r + 1]?.[c]];
      if (top && bot) cells.push(<Text key={c} color={top} backgroundColor={bot}>▀</Text>);
      else if (top) cells.push(<Text key={c} color={top}>▀</Text>);
      else if (bot) cells.push(<Text key={c} color={bot}>▄</Text>);
      else cells.push(<Text key={c}> </Text>);
    }
    lines.push(<Text key={r}>{cells}</Text>);
  }
  return <Box flexDirection="column">{lines}</Box>;
}
