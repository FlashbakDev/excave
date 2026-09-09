<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { EXCAVATION_MAX_ROCK } from "@excave/shared"
import { cellFromPointer } from "./excavationGridHit"
import type { ImpactFx } from "./excavationImpactFx"

const props = defineProps<{
  width: number
  height: number
  cells: number[]
  /** Parallel flags: true once metal is revealed on that cell. */
  revealedMetal: boolean[]
  disabled?: boolean
  effects?: readonly ImpactFx[]
  shakeOffset?: { x: number; y: number }
}>()

const emit = defineEmits<{
  dig: [x: number, y: number]
}>()

/** Must match `.crate` padding (px). */
const CRATE_PAD_PX = 10

const hostRef = ref<HTMLElement | null>(null)
const cellPx = ref(32)
let resizeObserver: ResizeObserver | null = null

const flatCells = computed(() => {
  const result: Array<{
    x: number
    y: number
    rock: number
    isMetal: boolean
    tone: "a" | "b"
  }> = []
  for (let y = 0; y < props.height; y += 1) {
    for (let x = 0; x < props.width; x += 1) {
      const index = y * props.width + x
      result.push({
        x,
        y,
        rock: props.cells[index] ?? 0,
        isMetal: props.revealedMetal[index] === true,
        tone: (x + y) % 2 === 0 ? "a" : "b",
      })
    }
  }
  return result
})

const effectsByCell = computed(() => {
  const map = new Map<string, ImpactFx[]>()
  for (const fx of props.effects ?? []) {
    const key = `${fx.x}:${fx.y}`
    const list = map.get(key)
    if (list) {
      list.push(fx)
    } else {
      map.set(key, [fx])
    }
  }
  return map
})

const gridStyle = computed(() => {
  const offset = props.shakeOffset ?? { x: 0, y: 0 }
  return {
    gridTemplateColumns: `repeat(${props.width}, ${cellPx.value}px)`,
    gridTemplateRows: `repeat(${props.height}, ${cellPx.value}px)`,
    width: `${cellPx.value * props.width}px`,
    height: `${cellPx.value * props.height}px`,
    transform:
      offset.x !== 0 || offset.y !== 0
        ? `translate(${offset.x}px, ${offset.y}px)`
        : undefined,
  }
})

function rockClass(rock: number, isMetal: boolean): string {
  if (isMetal) {
    return "metal"
  }
  if (rock <= 0) {
    return "rock-0"
  }
  if (rock >= EXCAVATION_MAX_ROCK) {
    return "rock-4"
  }
  return `rock-${rock}`
}

function cellFxClass(x: number, y: number): string[] {
  const list = effectsByCell.value.get(`${x}:${y}`)
  if (!list || list.length === 0) {
    return []
  }
  const classes = new Set<string>()
  for (const fx of list) {
    classes.add(`fx-${fx.kind}`)
    classes.add(`tool-${fx.tool}`)
    const t = Math.min(1, fx.age / fx.duration)
    if (t < 0.35) {
      classes.add("fx-hot")
    }
  }
  return [...classes]
}

function debrisFor(fx: ImpactFx): number[] {
  if (fx.kind === "tap") {
    return fx.tool === "hammer" ? [0, 1, 2] : [0, 1]
  }
  if (fx.kind === "burst") {
    return fx.tool === "hammer" ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3]
  }
  if (fx.kind === "chip") {
    return [0, 1, 2]
  }
  if (fx.kind === "metal") {
    return [0, 1]
  }
  if (fx.kind === "treasure") {
    return [0, 1, 2, 3]
  }
  return []
}

function debrisStyle(fx: ImpactFx, i: number): Record<string, string> {
  const t = Math.min(1, fx.age / fx.duration)
  const angle = (i / 6) * Math.PI * 2 + (fx.tool === "hammer" ? 0.2 : 0)
  const dist = (fx.tool === "hammer" ? 10 : 6) * (0.35 + t)
  const size = fx.kind === "treasure" ? 3 : fx.tool === "hammer" ? 3 : 2
  return {
    width: `${size}px`,
    height: `${size}px`,
    transform: `translate(${Math.round(Math.cos(angle) * dist)}px, ${Math.round(Math.sin(angle) * dist)}px)`,
    opacity: String(Math.max(0, 1 - t)),
  }
}

function canDig(rock: number, isMetal: boolean): boolean {
  return !props.disabled && !isMetal && rock > 0
}

function measure(): void {
  const host = hostRef.value
  if (!host) {
    return
  }
  // Fit the wood frame + grid inside the host (padding was previously ignored → overflow).
  const availW = Math.max(0, host.clientWidth - CRATE_PAD_PX * 2)
  const availH = Math.max(0, host.clientHeight - CRATE_PAD_PX * 2)
  const byWidth = Math.floor(availW / props.width)
  const byHeight = Math.floor(availH / props.height)
  const fitted =
    byHeight > 0 ? Math.min(byWidth, byHeight) : byWidth
  cellPx.value = Math.max(22, fitted)
}

function onPointerDown(event: PointerEvent): void {
  if (props.disabled || event.button !== 0) {
    return
  }
  const grid = event.currentTarget
  if (!(grid instanceof HTMLElement)) {
    return
  }
  const rect = grid.getBoundingClientRect()
  const localX = event.clientX - rect.left
  const localY = event.clientY - rect.top
  const cell = cellFromPointer(
    localX,
    localY,
    rect.width,
    rect.height,
    props.width,
    props.height,
  )
  if (!cell) {
    return
  }
  const index = cell.y * props.width + cell.x
  const rock = props.cells[index] ?? 0
  const isMetal = props.revealedMetal[index] === true
  if (!canDig(rock, isMetal)) {
    return
  }
  emit("dig", cell.x, cell.y)
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver === "undefined" || !hostRef.value) {
    return
  }
  resizeObserver = new ResizeObserver(() => {
    measure()
  })
  resizeObserver.observe(hostRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(
  () => [props.width, props.height] as const,
  () => {
    measure()
  },
)
</script>

<template>
  <div ref="hostRef" class="grid-host">
    <div class="crate">
      <div
        class="grid"
        :style="gridStyle"
        role="grid"
        aria-label="Mur à creuser"
        @pointerdown.prevent="onPointerDown"
      >
        <div
          v-for="cell in flatCells"
          :key="`${cell.x}:${cell.y}`"
          class="cell"
          :class="[
            rockClass(cell.rock, cell.isMetal),
            `tone-${cell.tone}`,
            ...cellFxClass(cell.x, cell.y),
          ]"
          role="gridcell"
          :aria-label="
            cell.isMetal
              ? `Métal en ${cell.x},${cell.y}`
              : cell.rock <= 0
                ? `Vide en ${cell.x},${cell.y}`
                : `Roche en ${cell.x},${cell.y}`
          "
        >
          <span class="bed" aria-hidden="true" />
          <span class="face" aria-hidden="true">
            <span class="pebbles" />
            <span class="cracks" />
          </span>
          <span
            v-for="fx in effectsByCell.get(`${cell.x}:${cell.y}`) ?? []"
            :key="fx.id"
            class="fx-burst"
            :data-kind="fx.kind"
            :data-tool="fx.tool"
            aria-hidden="true"
          >
            <i class="star" />
            <i
              v-for="i in debrisFor(fx)"
              :key="`${fx.id}-${i}`"
              class="debris"
              :style="debrisStyle(fx, i)"
            />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid-host {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}

/* Cadre « caisse » bois (réf. kit excavation) — padding fixe = CRATE_PAD_PX */
.crate {
  box-sizing: border-box;
  padding: 10px;
  border-radius: 0.55rem;
  background:
    linear-gradient(145deg, #d4b07a 0%, #b8894e 38%, #8f6a38 72%, #6e5130 100%);
  box-shadow:
    inset 0 1px 0 rgb(255 236 196 / 55%),
    inset 0 -2px 0 rgb(60 40 18 / 35%),
    0 4px 0 #4a3520,
    0 8px 18px rgb(0 0 0 / 45%);
}

.grid {
  display: grid;
  gap: 0;
  box-sizing: border-box;
  background: #2a180e;
  border: 0;
  outline: 2px solid #5a3a22;
  outline-offset: 0;
  image-rendering: pixelated;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.cell {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  border: 0;
  box-shadow: inset 0 0 0 1px rgb(42 24 14 / 55%);
  overflow: hidden;
  pointer-events: none;
  background: #3a2414;
}

/* Couche terre / lit (toujours sous la dalle) */
.bed {
  position: absolute;
  inset: 0;
  background-color: #4a2e18;
  background-image:
    radial-gradient(circle at 30% 40%, #5c3a22 0 1.5px, transparent 2px),
    radial-gradient(circle at 70% 65%, #3a2414 0 1.5px, transparent 2px),
    linear-gradient(160deg, #5a3820 0%, #3a2414 55%, #2a180e 100%);
  background-size: 100% 100%, 100% 100%, 100% 100%;
}

/* Dalle pierre */
.face {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  border: 1px solid rgb(0 0 0 / 18%);
  transition:
    opacity 140ms steps(2, end),
    filter 120ms steps(2, end);
}

.pebbles,
.cracks {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Galets blancs / relief (réf. bumps) */
.pebbles {
  opacity: 0;
  background-image:
    radial-gradient(circle at 28% 32%, #f2efe6 0 18%, transparent 20%),
    radial-gradient(circle at 68% 58%, #e8e2d6 0 14%, transparent 16%),
    radial-gradient(circle at 48% 72%, #d8d2c6 0 10%, transparent 12%);
  background-size: 55% 55%, 45% 45%, 40% 40%;
  background-repeat: no-repeat;
  background-position: 10% 15%, 55% 40%, 30% 60%;
  filter: drop-shadow(0 1px 0 rgb(0 0 0 / 25%));
}

.cracks {
  opacity: 0;
  background-image:
    linear-gradient(118deg, transparent 44%, #1a120c 44% 48%, transparent 48%),
    linear-gradient(28deg, transparent 52%, #1a120c 52% 55%, transparent 55%),
    linear-gradient(160deg, transparent 35%, #120c08 35% 40%, transparent 40%),
    linear-gradient(75deg, transparent 62%, #120c08 62% 66%, transparent 66%);
  background-size: 100% 100%;
  mix-blend-mode: multiply;
}

/* Tons dalles : gris froid / beige chaud */
.tone-a .face {
  background-color: #c8c4ba;
  background-image:
    linear-gradient(180deg, #ddd9cf 0%, transparent 42%),
    linear-gradient(90deg, rgb(0 0 0 / 6%) 0 1px, transparent 1px);
  background-size: 100% 100%, 7px 7px;
}

.tone-b .face {
  background-color: #d2c4a8;
  background-image:
    linear-gradient(180deg, #e4d8bc 0%, transparent 42%),
    linear-gradient(90deg, rgb(0 0 0 / 5%) 0 1px, transparent 1px);
  background-size: 100% 100%, 7px 7px;
}

/* 4 — intact */
.rock-4 .face {
  opacity: 1;
}
.rock-4 .pebbles {
  opacity: 0.9;
}
.rock-4 .cracks {
  opacity: 0;
}

/* 3 — légère fissure */
.rock-3 .face {
  opacity: 1;
  filter: brightness(0.97);
}
.rock-3 .pebbles {
  opacity: 0.55;
}
.rock-3 .cracks {
  opacity: 0.85;
  background-image:
    linear-gradient(118deg, transparent 44%, #1a120c 44% 48%, transparent 48%),
    linear-gradient(28deg, transparent 52%, #1a120c 52% 55%, transparent 55%);
}

/* 2 — cassée */
.rock-2 .face {
  opacity: 0.92;
  filter: brightness(0.92) saturate(0.95);
}
.rock-2 .pebbles {
  opacity: 0.25;
}
.rock-2 .cracks {
  opacity: 1;
}

/* 1 — presque dégagée : lit visible */
.rock-1 .face {
  opacity: 0.55;
  filter: brightness(0.88);
  clip-path: polygon(
    0% 0%,
    100% 0%,
    100% 62%,
    78% 100%,
    22% 100%,
    0% 70%
  );
}
.rock-1 .pebbles {
  opacity: 0;
}
.rock-1 .cracks {
  opacity: 1;
  background-image:
    linear-gradient(118deg, transparent 38%, #120c08 38% 46%, transparent 46%),
    linear-gradient(28deg, transparent 40%, #120c08 40% 48%, transparent 48%),
    linear-gradient(160deg, transparent 30%, #0a0806 30% 42%, transparent 42%),
    linear-gradient(75deg, transparent 55%, #0a0806 55% 62%, transparent 62%);
}

/* 0 — terre nue */
.rock-0 .face {
  opacity: 0;
  pointer-events: none;
}

/* Métal révélé */
.metal .face {
  opacity: 1;
  background-color: #8a939c;
  background-image:
    linear-gradient(135deg, #d0d6dc 0 28%, transparent 28%),
    linear-gradient(315deg, #4a525a 0 34%, transparent 34%),
    linear-gradient(180deg, #a8b0b8 0%, #6a727a 100%);
  border-color: #e8eef2;
  box-shadow: inset 0 0 0 1px #c5d0d8;
}
.metal .pebbles,
.metal .cracks {
  opacity: 0;
}

/* Impact juice */
.fx-hot .face {
  filter: brightness(1.28);
}

.fx-chip.tool-pick.fx-hot .face {
  filter: brightness(1.4);
  box-shadow: inset 0 0 0 1px #fff6e0;
}

.fx-burst.tool-hammer.fx-hot .face {
  filter: brightness(1.5);
  box-shadow: inset 0 0 0 2px #ffe8b0;
}

.fx-metal.fx-hot .face {
  filter: brightness(1.55);
  box-shadow: inset 0 0 0 2px #e8eef2;
}

.fx-treasure.fx-hot .bed {
  filter: brightness(1.25);
  box-shadow: inset 0 0 0 2px #f0c14a;
}

.fx-burst {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  z-index: 2;
}

.star {
  display: none;
  width: 70%;
  height: 70%;
  background: #fff8e8;
  clip-path: polygon(
    50% 0%,
    58% 35%,
    100% 38%,
    66% 58%,
    78% 100%,
    50% 72%,
    22% 100%,
    34% 58%,
    0% 38%,
    42% 35%
  );
  opacity: 0.95;
  filter: drop-shadow(0 0 4px rgb(255 255 255 / 80%));
}

.fx-hot .fx-burst[data-kind="tap"] .star,
.fx-burst[data-kind="treasure"] .star {
  display: block;
}

.fx-hot .fx-burst[data-kind="tap"] .star {
  width: 45%;
  height: 45%;
  opacity: 0.75;
}

.fx-burst[data-kind="treasure"] .star {
  width: 85%;
  height: 85%;
  animation: star-pop 180ms steps(3, end);
}

.fx-burst[data-kind="treasure"]::after {
  content: "?";
  position: absolute;
  font: 700 0.95em/1 ui-rounded, "Trebuchet MS", sans-serif;
  color: #e87820;
  text-shadow: 0 1px 0 #3a1808;
  animation: star-pop 180ms steps(3, end);
}

@keyframes star-pop {
  0% {
    transform: scale(0.4);
    opacity: 0;
  }
  40% {
    transform: scale(1.15);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.debris {
  position: absolute;
  left: 50%;
  top: 50%;
  margin: -1px 0 0 -1px;
  background: #8a6a48;
  box-shadow: 0 0 0 1px #3a2414;
}

.fx-burst[data-tool="hammer"] .debris {
  background: #a88860;
}

.fx-burst[data-kind="metal"] .debris {
  background: #c5d0d8;
  box-shadow: 0 0 0 1px #4a525a;
}

.fx-burst[data-kind="treasure"] .debris {
  background: #f0c14a;
  box-shadow: 0 0 0 1px #d4a017;
}

.fx-burst[data-kind="tap"][data-tool="pick"] .debris {
  background: #e8d2a8;
}

@media (max-width: 419px) {
  .crate {
    border-radius: 0.45rem;
  }
}
</style>
