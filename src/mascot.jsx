import React from 'react';
import { Box, Text } from 'ink';

// Pixel-art mascot, drawn with half-block characters (two pixels per cell).
// Palette sampled from the reference photo: honey-blonde hair, fair skin,
// blue eyes, red dress over a white blouse.
const PALETTE = {
  H: '#d8a85e', // hair
  h: '#f3d394', // hair highlight
  d: '#b9853e', // hair shadow
  S: '#f7d9be', // skin
  B: '#f2b09a', // blush / nose
  E: '#3f7fbf', // eyes
  k: '#3a3026', // lashes & pupils
  L: '#d4543e', // lips
  W: '#f7f2e7', // blouse
  D: '#e0442e', // dress
};

const GRID = [
  '..........HHHHHHHHHHHH..........',
  '........HHHHHHHHHHHHHHHH........',
  '.......HHHHHHHHHHHHHHHHHH.......',
  '......HHhHHHHHHHHHHHHhHHHH......',
  '.....HHhHHHHHHHHHHHHHHhHHHH.....',
  '....HHhHHHHHHHHHHHHHHHHhHHHH....',
  '....HHHHHHHHHHHHHHHHHHHHHHHH....',
  '...HHHHHHHHHHHHHHHHHHHHHHHHHH...',
  '..HHHHHHSSHHHHHHHHHHHHSSHHHHHH..',
  '..HHHHSSSSSHHHHHHHHHHSSSSSHHHH..',
  '..HdHHSSSSSSSSSSSSSSSSSSSSHHdH..',
  '..HHHSSkkkkSSSSSSSSSSkkkkSSHHH..',
  '..HHHSSkEEkSSSSSSSSSSkEEkSSHHH..',
  '..HhHSSSkkSSSSSSSSSSSSkkSSSHhH..',
  '..HHHSSBBSSSSSSSSSSSSSSBBSSHHH..',
  '..HdHSSSSSSSSSSBBSSSSSSSSSHHdH..',
  '..HHHSSSSSSSSSSSSSSSSSSSSSSHHH..',
  '..HhHSSSSSSSSLLLLLLSSSSSSSSHhH..',
  '..HHHHSSSSSSSSSSSSSSSSSSSSHHHH..',
  '..HdHHHHSSSSSSSSSSSSSSSSHHHHdH..',
  '..HHHHHHH...SSSSSSSS...HHHHHHH..',
  '..HhHHHHH...SSSSSSSS...HHHHHhH..',
  '..HHHHHH..SSSSSSSSSSSS..HHHHHH..',
  '..HdHHH.WWWWWSSSSSSWWWWW.HHHdH..',
  '..HHHH.WWWWWWDDDDDDWWWWWW.HHHH..',
  '..HhHH.WWWWWDDDDDDDDWWWWW.HHhH..',
  '..HHHHWWWWWDDDDDDDDDDWWWWWHHHH..',
  '..HdHHWWWWDDDDDDDDDDDDWWWWHHdH..',
  '..HHHWWWWDDDDDDDDDDDDDDWWWWHHH..',
  '..HHHWWWDDDDDDDDDDDDDDDDWWWHHH..',
  '...HHWWDDDDDDDDDDDDDDDDDDWWHH...',
  '....WDDDDDDDDDDDDDDDDDDDDDDW....',
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
