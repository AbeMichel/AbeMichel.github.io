export const REGION_COLOR_PALETTE = [
  '#ffedda', // soft peach
  '#e8f4fd', // soft blue
  '#e8fdf5', // soft mint
  '#f5e8fd', // soft lavender
  '#fdfde8', // soft yellow
  '#fde8e8', // soft rose
  '#e8fdfd', // soft cyan
  '#f2fde8', // soft lime
  '#fde8f2'  // soft pink
];

export function getRegionColor(regionIndex) {
  return REGION_COLOR_PALETTE[regionIndex % REGION_COLOR_PALETTE.length];
}
