/**
 * Generate Excave terrain tiles (16×16) — wall relief with proper cliff corners.
 * South-facing cliffs + L-shaped outer corners (no tall E/W "cardboard" faces).
 * Run: node scripts/generate-placeholder-assets.mjs
 */
import { deflateSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const gameAssetsRoot = join(rootDir, "app/assets/game")
const SIZE = 16
/** Cliff band height (source px) — hangs visually toward the floor. */
const FACE_H = 8
/** Outer corner wrap width inside the cliff band. */
const CORNER_W = 6
/** Side cliff thickness (E/W) — readable corridor walls, not 2px hairs. */
const SIDE_W = 6

const C = {
  void: [0x08, 0x09, 0x08],
  deep: [0x14, 0x15, 0x12],
  rock0: [0x22, 0x22, 0x1c],
  rock1: [0x2e, 0x2d, 0x24],
  rock2: [0x3c, 0x38, 0x2c],
  rock3: [0x50, 0x48, 0x38],
  soil0: [0x55, 0x4a, 0x37],
  soil1: [0x67, 0x59, 0x42],
  soilDark: [0x4a, 0x40, 0x30],
  faceHi: [0x7a, 0x6a, 0x52],
  faceMid: [0x58, 0x4c, 0x3a],
  faceLo: [0x32, 0x2c, 0x22],
  faceSide: [0x48, 0x40, 0x30],
  faceSideHi: [0x62, 0x56, 0x42],
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

function writePng(path, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = SIZE * 4
  const raw = Buffer.alloc((stride + 1) * SIZE)
  for (let y = 0; y < SIZE; y++) {
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

function blank() {
  return Buffer.alloc(SIZE * SIZE * 4)
}

function set(buf, x, y, rgb, a = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  buf[i] = rgb[0]
  buf[i + 1] = rgb[1]
  buf[i + 2] = rgb[2]
  buf[i + 3] = a
}

function fill(buf, rgb) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) set(buf, x, y, rgb)
  }
}

function noiseSoil(buf, seed) {
  fill(buf, C.soil0)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = (x * 3 + y * 5 + seed * 17) % 11
      if (n === 0) set(buf, x, y, C.soil1)
      else if (n === 1) set(buf, x, y, C.soilDark)
      else if (n === 2 && seed % 2 === 0) set(buf, x, y, C.rock2)
    }
  }
  const px = 3 + (seed % 8)
  const py = 9 + (seed % 4)
  set(buf, px, py, C.rock2)
  set(buf, px + 1, py, C.rock3)
}

/** Seamless rim rock — no directional lip (faces carry all edge orientation). */
function paintWallTop(buf, seed) {
  fill(buf, C.rock1)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Soft noise; avoid column/row stripes that read as wrong-facing trim.
      const n = ((x * 7) ^ (y * 13) ^ (seed * 19)) % 17
      if (n === 0) set(buf, x, y, C.rock0)
      else if (n === 1) set(buf, x, y, C.rock2)
      else if (n === 2) set(buf, x, y, C.deep)
      else if (n === 3) set(buf, x, y, C.rock3)
    }
  }
}

function southCliffRgb(row, x) {
  if (row === 0) return C.faceHi
  if (row === 1) return C.rock3
  if (row >= FACE_H - 2) return C.faceLo
  if ((x + row * 3) % 9 === 0) return C.rock2
  return C.faceMid
}

function sideCliffRgb(row, col, fromOuter) {
  const edge = fromOuter ? col === 0 : col === SIDE_W - 1
  if (edge) return C.faceSideHi
  if (row === 0) return C.faceHi
  if (row >= FACE_H - 2) return C.faceLo
  return C.faceSide
}

/** Full-width south cliff — continuous band, joins with neighbors. */
function paintFaceS(buf) {
  const y0 = SIZE - FACE_H
  for (let y = y0; y < SIZE; y++) {
    const row = y - y0
    for (let x = 0; x < SIZE; x++) {
      set(buf, x, y, southCliffRgb(row, x))
    }
  }
}

/**
 * Outer SE: south cliff (FACE_H) + full-height east lip (matches wall_face_e).
 */
function paintCornerSE(buf) {
  const y0 = SIZE - FACE_H
  const xSplit = SIZE - CORNER_W
  // East return — same orientation as wall_face_e (floor to the east).
  for (let y = 0; y < SIZE; y++) {
    for (let x = xSplit; x < SIZE; x++) {
      const col = x - xSplit
      const onFloorEdge = col === 0
      if (y >= y0) {
        const row = y - y0
        set(buf, x, y, sideCliffRgb(row, col, true))
      } else if (onFloorEdge) {
        set(buf, x, y, C.faceSideHi)
      } else {
        set(buf, x, y, C.rock2)
      }
    }
  }
  // South cliff — stops before east return.
  for (let y = y0; y < SIZE; y++) {
    const row = y - y0
    for (let x = 0; x < xSplit; x++) {
      set(buf, x, y, southCliffRgb(row, x))
    }
  }
  set(buf, xSplit, y0, C.faceHi)
}

function paintCornerSW(buf) {
  const y0 = SIZE - FACE_H
  const xSplit = CORNER_W
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < xSplit; x++) {
      const col = xSplit - 1 - x
      const onFloorEdge = col === 0
      if (y >= y0) {
        const row = y - y0
        set(buf, x, y, sideCliffRgb(row, col, true))
      } else if (onFloorEdge) {
        set(buf, x, y, C.faceSideHi)
      } else {
        set(buf, x, y, C.rock2)
      }
    }
  }
  for (let y = y0; y < SIZE; y++) {
    const row = y - y0
    for (let x = xSplit; x < SIZE; x++) {
      set(buf, x, y, southCliffRgb(row, x))
    }
  }
  set(buf, xSplit - 1, y0, C.faceHi)
}

/**
 * East face: full-height lip on the east edge (floor to the east).
 * Bottom FACE_H uses cliff shading; upper part is darker rock trim.
 * Orientation = floor-facing edge, not a south cliff reused sideways.
 */
function paintFaceE(buf) {
  const x0 = SIZE - SIDE_W
  for (let y = 0; y < SIZE; y++) {
    for (let x = x0; x < SIZE; x++) {
      const col = x - x0
      const onFloorEdge = col === 0
      if (y >= SIZE - FACE_H) {
        const row = y - (SIZE - FACE_H)
        set(buf, x, y, sideCliffRgb(row, col, true))
      } else if (onFloorEdge) {
        set(buf, x, y, C.faceSideHi)
      } else {
        set(buf, x, y, C.rock2)
      }
    }
  }
}

function paintFaceW(buf) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIDE_W; x++) {
      const col = SIDE_W - 1 - x
      const onFloorEdge = col === 0
      if (y >= SIZE - FACE_H) {
        const row = y - (SIZE - FACE_H)
        set(buf, x, y, sideCliffRgb(row, col, true))
      } else if (onFloorEdge) {
        set(buf, x, y, C.faceSideHi)
      } else {
        set(buf, x, y, C.rock2)
      }
    }
  }
}

/** NE/NW: side lip only (no north-facing cardboard wall). */
function paintCornerNE(buf) {
  paintFaceE(buf)
}

function paintCornerNW(buf) {
  paintFaceW(buf)
}

/**
 * Inner SE: south cliff stops before the east opening (T / L junctions).
 * Cut aligns with CORNER_W so it meets the spur's west face.
 */
function paintInnerSE(buf) {
  const y0 = SIZE - FACE_H
  const xEnd = SIZE - CORNER_W
  for (let y = y0; y < SIZE; y++) {
    const row = y - y0
    for (let x = 0; x < xEnd; x++) {
      set(buf, x, y, southCliffRgb(row, x))
    }
  }
  // End cap — same height as a side lip so the inner corner reads as one turn.
  for (let y = y0; y < SIZE; y++) {
    const row = y - y0
    set(buf, xEnd - 1, y, sideCliffRgb(row, 0, true))
  }
  set(buf, xEnd - 1, y0, C.faceHi)
}

function paintInnerSW(buf) {
  const y0 = SIZE - FACE_H
  const xStart = CORNER_W
  for (let y = y0; y < SIZE; y++) {
    const row = y - y0
    for (let x = xStart; x < SIZE; x++) {
      set(buf, x, y, southCliffRgb(row, x))
    }
  }
  for (let y = y0; y < SIZE; y++) {
    const row = y - y0
    set(buf, xStart, y, sideCliffRgb(row, 0, true))
  }
  set(buf, xStart, y0, C.faceHi)
}

const tilesRoot = join(gameAssetsRoot, "tiles")

for (let i = 1; i <= 3; i++) {
  const buf = blank()
  noiseSoil(buf, i * 13)
  if (i === 2) {
    set(buf, 5, 6, C.rock2)
    set(buf, 6, 7, C.rock2)
    set(buf, 7, 8, C.soilDark)
  }
  if (i === 3) {
    set(buf, 10, 4, C.rock3)
    set(buf, 11, 4, C.rock2)
    set(buf, 10, 5, C.rock2)
  }
  writePng(join(tilesRoot, `ground_0${i}.png`), buf)
}
{
  const buf = blank()
  noiseSoil(buf, 39)
  writePng(join(tilesRoot, "ground_04.png"), buf)
}

for (let i = 1; i <= 3; i++) {
  const buf = blank()
  paintWallTop(buf, i * 19)
  writePng(join(tilesRoot, `wall_top_0${i}.png`), buf)
}

{
  const s = blank()
  paintFaceS(s)
  writePng(join(tilesRoot, "wall_face_s.png"), s)

  const e = blank()
  paintFaceE(e)
  writePng(join(tilesRoot, "wall_face_e.png"), e)

  const w = blank()
  paintFaceW(w)
  writePng(join(tilesRoot, "wall_face_w.png"), w)

  const se = blank()
  paintCornerSE(se)
  writePng(join(tilesRoot, "wall_corner_se.png"), se)

  const sw = blank()
  paintCornerSW(sw)
  writePng(join(tilesRoot, "wall_corner_sw.png"), sw)

  const ne = blank()
  paintCornerNE(ne)
  writePng(join(tilesRoot, "wall_corner_ne.png"), ne)

  const nw = blank()
  paintCornerNW(nw)
  writePng(join(tilesRoot, "wall_corner_nw.png"), nw)

  const ise = blank()
  paintInnerSE(ise)
  writePng(join(tilesRoot, "wall_inner_se.png"), ise)

  const isw = blank()
  paintInnerSW(isw)
  writePng(join(tilesRoot, "wall_inner_sw.png"), isw)
}

{
  const top = blank()
  paintWallTop(top, 19)
  writePng(join(tilesRoot, "wall_center.png"), top)
  writePng(join(tilesRoot, "wall.png"), top)
  const g = blank()
  noiseSoil(g, 13)
  writePng(join(tilesRoot, "ground.png"), g)

  const edgeS = blank()
  paintWallTop(edgeS, 19)
  paintFaceS(edgeS)
  writePng(join(tilesRoot, "wall_edge_s.png"), edgeS)
  const edgeN = blank()
  paintWallTop(edgeN, 19)
  writePng(join(tilesRoot, "wall_edge_n.png"), edgeN)
  const edgeE = blank()
  paintWallTop(edgeE, 19)
  paintFaceE(edgeE)
  writePng(join(tilesRoot, "wall_edge_e.png"), edgeE)
  const edgeW = blank()
  paintWallTop(edgeW, 19)
  paintFaceW(edgeW)
  writePng(join(tilesRoot, "wall_edge_w.png"), edgeW)
}

console.log("Wrote terrain tileset with L-corners under app/assets/game/tiles/")
