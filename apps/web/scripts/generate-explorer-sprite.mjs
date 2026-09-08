/**
 * Generate Excave Lot 14 explorer spritesheet (16×16 frames, original pixel art).
 * Layout (64×48):
 *   cols: idle | walk0 | walk1 | walk2
 *   rows: down | up | left
 * Right-facing uses horizontal mirror at runtime (lamp + pack stay coherent).
 *
 * Run: node scripts/generate-explorer-sprite.mjs
 */
import { deflateSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(rootDir, "app/assets/game/characters/explorer")
const FRAME = 16
const COLS = 4
const ROWS = 3
const SHEET_W = FRAME * COLS
const SHEET_H = FRAME * ROWS

/** Palette from ART_DIRECTION — muted earth + lamp hot (not gem-saturated). */
const P = {
  helmet: [0x8a, 0x7a, 0x5c],
  helmetDark: [0x67, 0x59, 0x42],
  lamp: [0xff, 0xe1, 0xa0],
  lampMid: [0xf2, 0xca, 0x7c],
  skin: [0xd8, 0xa7, 0x5f],
  body: [0x6b, 0x52, 0x3a],
  bodyDark: [0x55, 0x4a, 0x37],
  pants: [0x34, 0x31, 0x27],
  boots: [0x19, 0x1a, 0x16],
  pack: [0x45, 0x40, 0x33],
  packDark: [0x2a, 0x28, 0x22],
  outline: [0x10, 0x11, 0x0f],
}

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function writePng(path, rgba, width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, png)
}

function blankFrame() {
  return Buffer.alloc(FRAME * FRAME * 4)
}

function set(buf, x, y, rgb, a = 255) {
  if (x < 0 || y < 0 || x >= FRAME || y >= FRAME) return
  const i = (y * FRAME + x) * 4
  buf[i] = rgb[0]
  buf[i + 1] = rgb[1]
  buf[i + 2] = rgb[2]
  buf[i + 3] = a
}

/** Draw pixels from a compact string map (`.` transparent, letters = palette keys). */
function stamp(buf, ox, oy, rows, colors) {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === "." || ch === " ") continue
      const rgb = colors[ch]
      if (rgb) set(buf, ox + x, oy + y, rgb)
    }
  }
}

const COLORS = {
  H: P.helmet,
  h: P.helmetDark,
  L: P.lamp,
  l: P.lampMid,
  S: P.skin,
  B: P.body,
  b: P.bodyDark,
  P: P.pants,
  K: P.boots,
  A: P.pack,
  a: P.packDark,
  O: P.outline,
}

function drawDown(buf, legPhase) {
  // Helmet + frontal lamp (iconic)
  stamp(
    buf,
    4,
    1,
    [
      ".HHHHHH.",
      "HhHHHHLh",
      "HhSSSSHh",
      ".hSSSSh.",
    ],
    COLORS,
  )
  set(buf, 9, 2, P.lamp)
  set(buf, 10, 2, P.lampMid)
  // Torso
  stamp(
    buf,
    5,
    5,
    [
      ".BBBB.",
      "BBBBBB",
      "BbBBbB",
      ".BBBB.",
    ],
    COLORS,
  )
  // Legs by phase: 0 idle/stride mid, 1 left forward, 2 right forward
  if (legPhase === 0) {
    stamp(buf, 5, 9, ["PP..PP", "KK..KK"], COLORS)
  } else if (legPhase === 1) {
    stamp(buf, 4, 9, [".PP.PP.", "KK...KK"], COLORS)
  } else {
    stamp(buf, 5, 9, ["PP.PP.", "KK...KK"], COLORS)
  }
}

function drawUp(buf, legPhase) {
  // Back of helmet + backpack
  stamp(
    buf,
    4,
    1,
    [
      ".HHHHHH.",
      "HhHHHHHh",
      "HhHHHHHh",
      ".hhhhhh.",
    ],
    COLORS,
  )
  stamp(
    buf,
    5,
    4,
    [
      ".AAAA.",
      "AaAAaA",
      ".AAAA.",
    ],
    COLORS,
  )
  stamp(
    buf,
    5,
    6,
    [
      "BBBBBB",
      "BbBBbB",
      ".BBBB.",
    ],
    COLORS,
  )
  if (legPhase === 0) {
    stamp(buf, 5, 9, ["PP..PP", "KK..KK"], COLORS)
  } else if (legPhase === 1) {
    stamp(buf, 4, 9, [".PP.PP.", "KK...KK"], COLORS)
  } else {
    stamp(buf, 5, 9, ["PP.PP.", "KK...KK"], COLORS)
  }
}

function drawLeft(buf, legPhase) {
  // Profile facing left — lamp at front (left), pack behind (right)
  stamp(
    buf,
    3,
    1,
    [
      "..HHHH.",
      ".LHhHH.",
      ".lSSSH.",
      "..SSSh.",
    ],
    COLORS,
  )
  stamp(
    buf,
    4,
    5,
    [
      ".BBBAA",
      "BBBBaA",
      ".BBBb.",
    ],
    COLORS,
  )
  if (legPhase === 0) {
    stamp(buf, 5, 8, [".PP.", "P..P", "K..K"], COLORS)
  } else if (legPhase === 1) {
    stamp(buf, 4, 8, ["PP..", ".P.P", "K..K"], COLORS)
  } else {
    stamp(buf, 5, 8, [".PP.", "P.P.", "K..K"], COLORS)
  }
}

function paintFrame(direction, col) {
  const buf = blankFrame()
  // col: 0 idle, 1 walk0, 2 walk1, 3 walk2 → leg phases 0 / 1 / 0 / 2
  const phase = col === 0 ? 0 : col === 1 ? 1 : col === 2 ? 0 : 2
  if (direction === "down") drawDown(buf, phase)
  else if (direction === "up") drawUp(buf, phase)
  else drawLeft(buf, phase)
  return buf
}

const sheet = Buffer.alloc(SHEET_W * SHEET_H * 4)
const dirs = ["down", "up", "left"]

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const frame = paintFrame(dirs[row], col)
    for (let y = 0; y < FRAME; y++) {
      for (let x = 0; x < FRAME; x++) {
        const src = (y * FRAME + x) * 4
        const dx = col * FRAME + x
        const dy = row * FRAME + y
        const dst = (dy * SHEET_W + dx) * 4
        sheet[dst] = frame[src]
        sheet[dst + 1] = frame[src + 1]
        sheet[dst + 2] = frame[src + 2]
        sheet[dst + 3] = frame[src + 3]
      }
    }
  }
}

writePng(join(outDir, "explorer.png"), sheet, SHEET_W, SHEET_H)

const frames = {}
const names = {
  down: ["explorer_idle_down_0", "explorer_walk_down_0", "explorer_walk_down_1", "explorer_walk_down_2"],
  up: ["explorer_idle_up_0", "explorer_walk_up_0", "explorer_walk_up_1", "explorer_walk_up_2"],
  left: ["explorer_idle_left_0", "explorer_walk_left_0", "explorer_walk_left_1", "explorer_walk_left_2"],
}
for (let row = 0; row < ROWS; row++) {
  const dir = dirs[row]
  for (let col = 0; col < COLS; col++) {
    frames[names[dir][col]] = {
      frame: { x: col * FRAME, y: row * FRAME, w: FRAME, h: FRAME },
    }
  }
}

const atlas = {
  meta: {
    image: "explorer.png",
    size: { w: SHEET_W, h: SHEET_H },
    scale: 1,
    format: "RGBA8888",
    notes:
      "Lot 14 Excave explorer. Right frames = mirror of left at runtime. Walk cycle uses frames 0,1,2,1.",
  },
  frames,
}

writeFileSync(join(outDir, "explorer.json"), `${JSON.stringify(atlas, null, 2)}\n`)

// Keep Lot 11 single-frame path in sync (idle down) for any leftover references.
{
  const idle = paintFrame("down", 0)
  writePng(join(rootDir, "app/assets/game/characters/player_idle.png"), idle, FRAME, FRAME)
}

console.log(`Wrote explorer spritesheet ${SHEET_W}×${SHEET_H} → app/assets/game/characters/explorer/`)
