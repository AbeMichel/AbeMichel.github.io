export const getRow = (cellId) => Math.floor(cellId / 9);
export const getCol = (cellId) => cellId % 9;

export const getRegionCells = (cellId, regions) => {
  if (!regions) {
    // Standard 3x3 region calculation
    const r = getRow(cellId);
    const c = getCol(cellId);
    const regionRow = Math.floor(r / 3);
    const regionCol = Math.floor(c / 3);
    const ids = [];
    for (let row = regionRow * 3; row < regionRow * 3 + 3; row++) {
      for (let col = regionCol * 3; col < regionCol * 3 + 3; col++) {
        ids.push(row * 9 + col);
      }
    }
    return ids;
  }
  // Find the region containing cellId
  return regions.find(region => region.includes(cellId)) || [];
};

export const getHighlightedIds = (selectedId, regions) => {
  if (selectedId === null) return [];
  const r = getRow(selectedId);
  const c = getCol(selectedId);
  const highlighted = new Set();
  
  // Same row
  for (let col = 0; col < 9; col++) highlighted.add(r * 9 + col);
  // Same column
  for (let row = 0; row < 9; row++) highlighted.add(row * 9 + c);
  // Same region
  getRegionCells(selectedId, regions).forEach(id => highlighted.add(id));
  
  return Array.from(highlighted);
};

export const getConflictIds = (cells, regions) => {
  const conflictIds = new Set();
  const grid = cells.map(c => c.v || 0);
  
  for (let i = 0; i < 81; i++) {
    const val = grid[i];
    if (val === 0) continue;
    
    const r = getRow(i);
    const c = getCol(i);
    const region = getRegionCells(i, regions);
    
    // Check row
    for (let col = 0; col < 9; col++) {
      const peerIdx = r * 9 + col;
      if (peerIdx !== i && grid[peerIdx] === val) conflictIds.add(i);
    }
    // Check column
    for (let row = 0; row < 9; row++) {
      const peerIdx = row * 9 + c;
      if (peerIdx !== i && grid[peerIdx] === val) conflictIds.add(i);
    }
    // Check region
    for (const peerIdx of region) {
      if (peerIdx !== i && grid[peerIdx] === val) conflictIds.add(i);
    }
  }
  
  return Array.from(conflictIds);
};

export function getRegionBorderClasses(cellId, regions) {
  const r = getRow(cellId);
  const c = getCol(cellId);
  const classes = [];

  const getRegionIndex = (id) => {
    if (!regions) {
      return Math.floor(getRow(id) / 3) * 3 + Math.floor(getCol(id) / 3);
    }
    return regions.findIndex(reg => reg.includes(id));
  };

  const currentRegion = getRegionIndex(cellId);

  // Top border
  if (r === 0 || getRegionIndex(cellId - 9) !== currentRegion) {
    classes.push('region-border-top');
  }
  // Bottom border
  if (r === 8 || getRegionIndex(cellId + 9) !== currentRegion) {
    classes.push('region-border-bottom');
  }
  // Left border
  if (c === 0 || getRegionIndex(cellId - 1) !== currentRegion) {
    classes.push('region-border-left');
  }
  // Right border
  if (c === 8 || getRegionIndex(cellId + 1) !== currentRegion) {
    classes.push('region-border-right');
  }

  return classes;
}
