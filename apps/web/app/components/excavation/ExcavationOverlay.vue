<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import {
  ExcavationSessionStatus,
  ExcavationTool,
  type ExcavationStartedPayload,
  type ExcavationTool as ExcavationToolId,
  type ExcavationUpdatePayload,
  type RecoveredTreasurePublic,
} from "@excave/shared"
import ExcavationGrid from "./ExcavationGrid.vue"
import ExcavationStability from "./ExcavationStability.vue"
import ExcavationToolbar from "./ExcavationToolbar.vue"
import { ExcavationImpactFx, type ImpactFx } from "./excavationImpactFx"

const props = defineProps<{
  session: ExcavationStartedPayload
}>()

const emit = defineEmits<{
  hit: [x: number, y: number, tool: ExcavationToolId]
  close: []
}>()

const tool = ref<ExcavationToolId>(ExcavationTool.Pickaxe)
const cells = ref<number[]>([...props.session.cells])
const revealedMetal = ref<boolean[]>([...props.session.revealedMetal])
const stability = ref(props.session.stability)
const status = ref(props.session.status)
const message = ref<string | null>(null)
const recovered = ref<RecoveredTreasurePublic[]>([
  ...props.session.recoveredTreasures,
])

const impactFx = new ExcavationImpactFx()
const effects = shallowRef<readonly ImpactFx[]>([])
const shakeOffset = ref({ x: 0, y: 0 })
let lastHitTool: ExcavationToolId = ExcavationTool.Pickaxe
let rafId = 0
let lastFrameMs = 0

watch(
  () => props.session.sessionId,
  () => {
    cells.value = [...props.session.cells]
    revealedMetal.value = [...props.session.revealedMetal]
    stability.value = props.session.stability
    status.value = props.session.status
    message.value = null
    recovered.value = [...props.session.recoveredTreasures]
    tool.value = ExcavationTool.Pickaxe
    impactFx.clear()
    publishFx()
    stopLoop()
  },
)

const ended = computed(
  () =>
    status.value === ExcavationSessionStatus.Collapsed ||
    status.value === ExcavationSessionStatus.Completed,
)

const dialogLabel = computed(() => {
  if (status.value === ExcavationSessionStatus.Collapsed) {
    return "Effondrement"
  }
  if (status.value === ExcavationSessionStatus.Completed) {
    return "Excavation terminée"
  }
  return "Excavation"
})

const lootCount = computed(
  () => `${recovered.value.length} / ${props.session.treasureCount}`,
)

function publishFx(): void {
  effects.value = impactFx.getActive()
  shakeOffset.value = impactFx.getShakeOffset()
}

function stopLoop(): void {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  lastFrameMs = 0
}

function ensureLoop(): void {
  if (rafId) {
    return
  }
  lastFrameMs = performance.now()
  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - lastFrameMs) / 1000)
    lastFrameMs = now
    impactFx.tick(dt)
    publishFx()
    if (impactFx.activeCount > 0 || impactFx.getShake() > 0) {
      rafId = requestAnimationFrame(frame)
      return
    }
    rafId = 0
  }
  rafId = requestAnimationFrame(frame)
}

function onDig(x: number, y: number): void {
  if (ended.value) {
    return
  }
  lastHitTool = tool.value
  impactFx.spawnTap(x, y, tool.value)
  publishFx()
  ensureLoop()
  emit("hit", x, y, tool.value)
}

function applyUpdate(update: ExcavationUpdatePayload): void {
  if (update.sessionId !== props.session.sessionId) {
    return
  }
  const prevCells = cells.value
  const prevMetal = revealedMetal.value
  const nextCells = [...prevCells]
  const nextMetal = [...prevMetal]
  const treasureReveal = update.newlyRecoveredTreasures.length > 0

  for (const cell of update.changedCells) {
    const index = cell.y * props.session.width + cell.x
    const fromRock = prevCells[index] ?? 0
    const wasMetal = prevMetal[index] === true
    nextCells[index] = cell.remainingRock
    if (cell.isMetal) {
      nextMetal[index] = true
    }
    impactFx.spawnFromDelta({
      x: cell.x,
      y: cell.y,
      tool: lastHitTool,
      fromRock,
      toRock: cell.remainingRock,
      revealedMetal: cell.isMetal === true && !wasMetal,
      revealedTreasure: treasureReveal && fromRock > 0 && cell.remainingRock === 0,
    })
  }

  cells.value = nextCells
  revealedMetal.value = nextMetal
  stability.value = update.stability
  status.value = update.status
  recovered.value = [...update.recoveredTreasures]
  message.value = update.message ?? null
  publishFx()
  ensureLoop()
}

onBeforeUnmount(() => {
  stopLoop()
  impactFx.clear()
})

defineExpose({ applyUpdate })
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" :aria-label="dialogLabel">
    <div class="stage">
      <header class="hud">
        <p class="loot badge" aria-label="Trésors récupérés">
          <span class="loot-label">Trésors</span>
          <span class="loot-count">{{ lootCount }}</span>
        </p>
        <ExcavationStability
          :stability="stability"
          :max-stability="session.maxStability"
        />
      </header>

      <div class="wall">
        <ExcavationGrid
          :width="session.width"
          :height="session.height"
          :cells="cells"
          :revealed-metal="revealedMetal"
          :disabled="ended"
          :effects="effects"
          :shake-offset="shakeOffset"
          @dig="onDig"
        />
      </div>

      <footer class="footer">
        <ExcavationToolbar v-if="!ended" v-model:tool="tool" />
        <button
          v-else
          type="button"
          class="close-dock"
          @click="emit('close')"
        >
          Fermer
        </button>
        <p
          class="banner"
          :class="{
            status: ended,
            message: !ended && !!message,
            ghost: !ended && !message,
          }"
          aria-live="polite"
        >
          <template v-if="ended">{{ dialogLabel }}</template>
          <template v-else-if="message">{{ message }}</template>
          <template v-else>&nbsp;</template>
        </p>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 0;
  background:
    radial-gradient(ellipse at 50% 30%, #2a1c10 0%, #080908 70%);
  overflow: hidden;
  overscroll-behavior: none;
}

.stage {
  width: 100%;
  height: 100%;
  max-width: 36rem;
  margin: 0 auto;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 0.55rem;
  padding: 0.65rem 0.65rem calc(0.65rem + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  color: #e8e2d6;
  background:
    linear-gradient(180deg, #1a1410 0%, #10100e 40%, #0c0c0a 100%);
}

.hud {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
  min-height: 2.25rem;
}

.badge {
  margin: 0;
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.25rem 0.55rem;
  border-radius: 0.45rem;
  background: #f4efe4;
  border: 1px solid #d8d0c0;
  box-shadow: 0 1px 0 rgb(0 0 0 / 18%);
  font: 700 12px/1.2 ui-rounded, "Trebuchet MS", sans-serif;
  color: #2a241c;
}

.loot-label {
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6e6558;
  font-size: 9px;
}

.loot-count {
  color: #b87820;
  font-size: 14px;
}

.wall {
  min-height: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.1rem 0;
}

.footer {
  display: grid;
  grid-template-rows: 4.6rem auto;
  gap: 0.4rem;
  padding-top: 0.1rem;
  align-items: stretch;
}

.close-dock {
  width: 100%;
  max-width: 22rem;
  margin: 0 auto;
  min-height: 100%;
  border: 2px solid #c4a574;
  border-radius: 0.85rem;
  background: linear-gradient(180deg, #2a241c 0%, #1c1916 100%);
  color: #ffe1a0;
  cursor: pointer;
  touch-action: manipulation;
  font: 700 14px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.close-dock:active {
  transform: translateY(1px);
}

.banner {
  margin: 0 auto;
  max-width: 22rem;
  width: 100%;
  min-height: 2.2rem;
  text-align: center;
  padding: 0.45rem 0.75rem;
  border-radius: 0.65rem;
  background: rgb(12 10 8 / 78%);
  border: 1px solid rgb(255 255 255 / 10%);
  font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  box-sizing: border-box;
}

.banner.ghost {
  visibility: hidden;
}

.banner.status {
  color: #d7b16f;
}

.banner.message {
  color: #f0c14a;
}

@media (min-width: 720px) {
  .overlay {
    padding: 1rem;
    background: rgb(8 9 8 / 88%);
  }

  .stage {
    height: min(100%, 44rem);
    align-self: center;
    border-radius: 0.75rem;
    border: 3px solid #8f6a38;
    box-shadow:
      0 0 0 1px #4a3520,
      0 12px 28px rgb(0 0 0 / 45%);
  }
}

@media (max-width: 419px) {
  .stage {
    padding: 0.45rem 0.45rem calc(0.45rem + env(safe-area-inset-bottom, 0px));
    gap: 0.4rem;
  }

  .hud {
    gap: 0.4rem;
  }

  .footer {
    grid-template-rows: 4.2rem auto;
  }
}

@media (orientation: landscape) and (max-height: 500px) {
  .stage {
    grid-template-rows: auto minmax(0, 1fr) auto;
    padding: 0.35rem 0.5rem;
    gap: 0.35rem;
  }

  .footer {
    grid-template-rows: 3.2rem auto;
    gap: 0.25rem;
  }

  .footer :deep(.tool) {
    min-height: 2.85rem;
    padding: 0.3rem 0.35rem;
  }

  .footer :deep(.name) {
    font-size: 10px;
  }

  .banner {
    min-height: 1.85rem;
    padding: 0.3rem 0.55rem;
  }
}
</style>
