/**
 * Computes the stage offset that centers a world focus point in the viewport,
 * accounting for integer camera zoom. Positions are snapped to whole pixels
 * so nearest-neighbor art stays crisp.
 */
export function computeCameraOffset(
  viewportWidth: number,
  viewportHeight: number,
  focusX: number,
  focusY: number,
  zoom = 1,
): { x: number; y: number } {
  const x = viewportWidth / 2 - focusX * zoom
  const y = viewportHeight / 2 - focusY * zoom
  return {
    x: Math.round(x),
    y: Math.round(y),
  }
}
