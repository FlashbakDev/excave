/**
 * Deterministic 32-bit mix for world generation.
 * Not cryptographic — terrain only.
 */
export function hashInt(seed: number, ...parts: number[]): number {
  let h = seed >>> 0
  for (const part of parts) {
    h ^= Math.imul(part | 0, 0x9e3779b1)
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
    h ^= h >>> 16
  }
  return h >>> 0
}

export function seedFromString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
