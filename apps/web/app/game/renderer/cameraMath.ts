/**
 * Computes the stage offset that centers a world focus point in the viewport.
 */
export function computeCameraOffset(
  viewportWidth: number,
  viewportHeight: number,
  focusX: number,
  focusY: number,
): { x: number; y: number } {
  return {
    x: viewportWidth / 2 - focusX,
    y: viewportHeight / 2 - focusY,
  }
}
