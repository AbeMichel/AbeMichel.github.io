export const PLAYER_COLORS = [
  '#42A5F5', // Soft Blue
  '#FF7043', // Coral
  '#66BB6A', // Mint
  '#AB47BC', // Lavender
  '#FFB300', // Amber
  '#EC407A', // Rose
  '#26A69A', // Teal
  '#78909C'  // Slate
];

export function assignColor(peerIndex) {
  return PLAYER_COLORS[peerIndex % PLAYER_COLORS.length];
}
