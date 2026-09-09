/**
 * Map a pointer position inside the excavation grid to a cell.
 * Compensates for small CSS cells on mobile by using continuous coords.
 */
export function cellFromPointer(
  localX: number,
  localY: number,
  widthPx: number,
  heightPx: number,
  cols: number,
  rows: number,
): { x: number; y: number } | null {
  if (widthPx <= 0 || heightPx <= 0 || cols <= 0 || rows <= 0) {
    return null
  }
  if (localX < 0 || localY < 0 || localX > widthPx || localY > heightPx) {
    return null
  }
  const x = Math.min(cols - 1, Math.max(0, Math.floor((localX / widthPx) * cols)))
  const y = Math.min(rows - 1, Math.max(0, Math.floor((localY / heightPx) * rows)))
  return { x, y }
}
