<script setup lang="ts">
import { computed } from "vue"
import { EXCAVATION_MAX_ROCK } from "@excave/shared"

const props = defineProps<{
  width: number
  height: number
  cells: number[]
  /** Parallel flags: true once metal is revealed on that cell. */
  revealedMetal: boolean[]
  disabled?: boolean
  impactKey?: number
}>()

const emit = defineEmits<{
  dig: [x: number, y: number]
}>()

const rows = computed(() => {
  const result: Array<
    Array<{ x: number; y: number; rock: number; isMetal: boolean }>
  > = []
  for (let y = 0; y < props.height; y += 1) {
    const row: Array<{ x: number; y: number; rock: number; isMetal: boolean }> =
      []
    for (let x = 0; x < props.width; x += 1) {
      const index = y * props.width + x
      row.push({
        x,
        y,
        rock: props.cells[index] ?? 0,
        isMetal: props.revealedMetal[index] === true,
      })
    }
    result.push(row)
  }
  return result
})

function rockClass(rock: number, isMetal: boolean): string {
  if (isMetal) return "metal"
  if (rock <= 0) return "rock-0"
  if (rock >= EXCAVATION_MAX_ROCK) return "rock-4"
  return `rock-${rock}`
}

function canDig(rock: number, isMetal: boolean): boolean {
  return !props.disabled && !isMetal && rock > 0
}
</script>

<template>
  <div
    class="grid"
    :class="{ shake: impactKey }"
    :style="{
      gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
    }"
    role="grid"
    aria-label="Grille d'excavation"
  >
    <template v-for="row in rows" :key="`r-${row[0]?.y}`">
      <button
        v-for="cell in row"
        :key="`${cell.x}:${cell.y}`"
        type="button"
        class="cell"
        :class="rockClass(cell.rock, cell.isMetal)"
        :disabled="!canDig(cell.rock, cell.isMetal)"
        :aria-label="
          cell.isMetal
            ? `Case ${cell.x},${cell.y} métal`
            : `Case ${cell.x},${cell.y} roche ${cell.rock}`
        "
        @click="emit('dig', cell.x, cell.y)"
      >
        <span v-if="cell.isMetal">M</span>
        <span v-else-if="cell.rock > 0">{{ cell.rock }}</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  gap: 3px;
  width: min(100%, 420px);
  margin: 0 auto;
  touch-action: manipulation;
}

.grid.shake {
  animation: shake 180ms ease-out;
}

.cell {
  aspect-ratio: 1;
  border: 1px solid #3a342c;
  padding: 0;
  cursor: pointer;
  color: #f5e6c8;
  font: 700 11px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  user-select: none;
}

.cell:disabled {
  cursor: default;
  opacity: 0.95;
}

.rock-4 { background: #4a4034; }
.rock-3 { background: #5c5040; }
.rock-2 { background: #6e6250; }
.rock-1 { background: #857660; }
.rock-0 {
  background:
    radial-gradient(circle at 30% 30%, rgb(196 165 116 / 18%), transparent 45%),
    #2a241c;
  border-color: #2f2a24;
  color: transparent;
}

.metal {
  background:
    linear-gradient(135deg, #6a727a 0%, #3d444c 45%, #8a939c 100%);
  border-color: #9aa3ad;
  color: #1a1e22;
  cursor: default;
}

.cell:not(:disabled):active {
  filter: brightness(1.15);
}

@keyframes shake {
  0% { transform: translate(0, 0); }
  25% { transform: translate(-2px, 1px); }
  50% { transform: translate(2px, -1px); }
  75% { transform: translate(-1px, 0); }
  100% { transform: translate(0, 0); }
}
</style>
