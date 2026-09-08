/**
 * Generate Excave Lot 15A cave decor atlas (16×16 frames, original pixel art).
 * Static environment only — muted rock/soil palette, no glow, no gem saturation.
 *
 * Layout (64×64): 4×4 frames
 *   row0: stone_sm | stone_md | pebbles | pebbles_loose
 *   row1: crack_floor | crack_floor_y | dust | dust_scatter
 *   row2: root | root_fork | mushroom | mushroom_pair
 *   row3: wall_crack | wall_crack_diag | wall_chip | mineral_trace
 *
 * Run: node scripts/generate-cave-decor.mjs
 */
import { deflateSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(rootDir, "app/assets/game/environment")
const FRAME = 16
const COLS = 4
const ROWS = 4
const SHEET_W = FRAME * COLS
const SHEET_H = FRAME * ROWS

/** ART_DIRECTION rock/soil + muted olive (mushrooms) — never gem hues. */
const P = {
  rock0: [0x19, 0x1a, 0x16],
  rock1: [0x25, 0x25, 0x1f],
  rock2: [0x34, 0x31, 0x27],
  rock3: [0x45, 0x40, 0x33],
  soil0: [0x55, 0x4a, 0x37],
  soil1: [0x67, 0x59, 0x42],
  soilDark: [0x4a, 0x40, 0x30],
  deep: [0x10, 0x11, 0x0f],
  /** Desaturated olive — dull fungi, not Gem vert (Lot 15C quieter). */
  moss: [0x32, 0x36, 0x2c],
  mossDark: [0x26, 0x2a, 0x24],
  mossCap: [0x3e, 0x40, 0x34],
  /** Faint mineral streak — almost rock, never Gem or. */
  mineral: [0x4a, 0x45, 0x38],
  mineralDim: [0x3a, 0x36, 0x2c],
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

const C = {
  "0": P.rock0,
  "1": P.rock1,
  "2": P.rock2,
  "3": P.rock3,
  s: P.soil0,
  S: P.soil1,
  d: P.soilDark,
  D: P.deep,
  m: P.moss,
  M: P.mossCap,
  n: P.mossDark,
  v: P.mineral,
  V: P.mineralDim,
}

function drawStoneSm(buf) {
  stamp(
    buf,
    6,
    9,
    [
      ".22.",
      "2332",
      ".21.",
    ],
    C,
  )
}

function drawStoneMd(buf) {
  stamp(
    buf,
    4,
    8,
    [
      "..22..",
      ".2332.",
      "232132",
      ".2212.",
    ],
    C,
  )
}

function drawPebbles(buf) {
  stamp(
    buf,
    3,
    8,
    [
      ".2...3..",
      "23.21.2.",
      "..2..21.",
    ],
    C,
  )
}

function drawPebblesLoose(buf) {
  set(buf, 3, 10, P.rock2)
  set(buf, 4, 10, P.rock3)
  set(buf, 7, 9, P.rock1)
  set(buf, 8, 9, P.rock2)
  set(buf, 9, 10, P.rock2)
  set(buf, 12, 11, P.rock3)
  set(buf, 5, 12, P.rock1)
  set(buf, 11, 8, P.rock2)
}

function drawCrackFloor(buf) {
  stamp(
    buf,
    3,
    5,
    [
      "..d.....",
      "...d....",
      "....d...",
      "...d1...",
      "..d.....",
      ".d......",
      "d.......",
    ],
    C,
  )
}

function drawCrackFloorY(buf) {
  stamp(
    buf,
    4,
    4,
    [
      "...d....",
      "...d....",
      "..d.d...",
      ".d...d..",
      "d.....d.",
    ],
    C,
  )
}

function drawDust(buf) {
  set(buf, 5, 8, P.soilDark)
  set(buf, 7, 9, P.soil0)
  set(buf, 9, 8, P.soilDark)
  set(buf, 6, 10, P.rock2)
  set(buf, 10, 10, P.soilDark)
  set(buf, 8, 11, P.soil0)
}

function drawDustScatter(buf) {
  const pts = [
    [2, 7],
    [4, 9],
    [6, 6],
    [8, 10],
    [10, 8],
    [12, 11],
    [3, 12],
    [11, 6],
    [7, 12],
  ]
  for (const [x, y] of pts) {
    set(buf, x, y, (x + y) % 2 === 0 ? P.soilDark : P.rock2)
  }
}

function drawRoot(buf) {
  stamp(
    buf,
    6,
    3,
    [
      "..d.",
      "..d.",
      ".d..",
      "d...",
      "d.d.",
      ".d..",
    ],
    C,
  )
  set(buf, 7, 9, P.mossDark)
}

function drawRootFork(buf) {
  stamp(
    buf,
    4,
    4,
    [
      "...d....",
      "...d....",
      "..d.d...",
      ".d...d..",
      "d.....d.",
      "......d.",
    ],
    C,
  )
}

function drawMushroom(buf) {
  // Tiny dull cap — must not read as loot / gem
  stamp(
    buf,
    7,
    9,
    [
      ".M.",
      "MnM",
      ".n.",
      ".d.",
    ],
    C,
  )
}

function drawMushroomPair(buf) {
  stamp(
    buf,
    5,
    8,
    [
      ".M....",
      "MnM.M.",
      ".n.MnM",
      ".d..n.",
      "....d.",
    ],
    C,
  )
}

function drawWallCrack(buf) {
  stamp(
    buf,
    6,
    2,
    [
      ".D.",
      ".1.",
      "D..",
      ".D.",
      "..1",
      ".D.",
      "D..",
      ".D.",
      "..D",
      ".1.",
    ],
    C,
  )
}

function drawWallCrackDiag(buf) {
  stamp(
    buf,
    3,
    3,
    [
      "D.........",
      ".D........",
      "..1.......",
      "...D......",
      "....D.....",
      ".....1....",
      "......D...",
      ".......D..",
      "........D.",
    ],
    C,
  )
}

function drawWallChip(buf) {
  stamp(
    buf,
    5,
    5,
    [
      "..22..",
      ".2112.",
      "210012",
      ".2112.",
      "..22..",
    ],
    C,
  )
}

function drawMineralTrace(buf) {
  // Thin rock-tone streak — must not read as interactive ore / gem vein
  stamp(
    buf,
    4,
    7,
    [
      "..2.......",
      "...21.....",
      "....12....",
      ".....2....",
    ],
    C,
  )
}

const FRAMES = [
  ["decor_stone_sm", drawStoneSm],
  ["decor_stone_md", drawStoneMd],
  ["decor_pebbles", drawPebbles],
  ["decor_pebbles_loose", drawPebblesLoose],
  ["decor_crack_floor", drawCrackFloor],
  ["decor_crack_floor_y", drawCrackFloorY],
  ["decor_dust", drawDust],
  ["decor_dust_scatter", drawDustScatter],
  ["decor_root", drawRoot],
  ["decor_root_fork", drawRootFork],
  ["decor_mushroom", drawMushroom],
  ["decor_mushroom_pair", drawMushroomPair],
  ["decor_wall_crack", drawWallCrack],
  ["decor_wall_crack_diag", drawWallCrackDiag],
  ["decor_wall_chip", drawWallChip],
  ["decor_mineral_trace", drawMineralTrace],
]

const sheet = Buffer.alloc(SHEET_W * SHEET_H * 4)
const framesMeta = {}

for (let i = 0; i < FRAMES.length; i++) {
  const [name, paint] = FRAMES[i]
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const frame = blankFrame()
  paint(frame)
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
  framesMeta[name] = {
    frame: { x: col * FRAME, y: row * FRAME, w: FRAME, h: FRAME },
  }
}

writePng(join(outDir, "cave_decor.png"), sheet, SHEET_W, SHEET_H)

const atlas = {
  meta: {
    image: "cave_decor.png",
    size: { w: SHEET_W, h: SHEET_H },
    scale: 1,
    format: "RGBA8888",
    notes:
      "Lot 15A Excave cave decor. Static, ≤1 tile, muted rock/soil only — no glow, no gem saturation, not interactive ore.",
  },
  frames: framesMeta,
}

writeFileSync(join(outDir, "cave_decor.json"), `${JSON.stringify(atlas, null, 2)}\n`)

console.log(
  `Wrote cave decor atlas ${SHEET_W}×${SHEET_H} (${FRAMES.length} frames) → app/assets/game/environment/`,
)
