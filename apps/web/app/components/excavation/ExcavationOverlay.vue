<script setup lang="ts">
import { computed, ref, watch } from "vue"
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
const impactKey = ref(0)

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
  },
)

const ended = computed(
  () =>
    status.value === ExcavationSessionStatus.Collapsed ||
    status.value === ExcavationSessionStatus.Completed,
)

const title = computed(() => {
  if (status.value === ExcavationSessionStatus.Collapsed) {
    return "Effondrement"
  }
  if (status.value === ExcavationSessionStatus.Completed) {
    return "Excavation terminée"
  }
  return "Excavation"
})

const lootSummary = computed(() => {
  const found = recovered.value.length
  const total = props.session.treasureCount
  return `${found} / ${total} trésor${total > 1 ? "s" : ""}`
})

function onDig(x: number, y: number): void {
  if (ended.value) {
    return
  }
  emit("hit", x, y, tool.value)
}

function applyUpdate(update: ExcavationUpdatePayload): void {
  if (update.sessionId !== props.session.sessionId) {
    return
  }
  const nextCells = [...cells.value]
  const nextMetal = [...revealedMetal.value]
  for (const cell of update.changedCells) {
    const index = cell.y * props.session.width + cell.x
    nextCells[index] = cell.remainingRock
    if (cell.isMetal) {
      nextMetal[index] = true
    }
  }
  cells.value = nextCells
  revealedMetal.value = nextMetal
  stability.value = update.stability
  status.value = update.status
  recovered.value = [...update.recoveredTreasures]
  message.value = update.message ?? null
  impactKey.value += 1
}

defineExpose({ applyUpdate })
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" :aria-label="title">
    <div class="panel">
      <header class="header">
        <div>
          <p class="eyebrow">Filon · {{ lootSummary }}</p>
          <h2>{{ title }}</h2>
        </div>
        <button v-if="ended" type="button" class="close" @click="emit('close')">
          Fermer
        </button>
      </header>

      <ExcavationStability :stability="stability" :max-stability="session.maxStability" />

      <ExcavationToolbar v-model:tool="tool" />

      <ExcavationGrid
        :width="session.width"
        :height="session.height"
        :cells="cells"
        :revealed-metal="revealedMetal"
        :disabled="ended"
        :impact-key="impactKey"
        @dig="onDig"
      />

      <ul v-if="recovered.length > 0" class="loot" aria-label="Trésors récupérés">
        <li v-for="(item, index) in recovered" :key="`${item.type}-${index}`">
          <span class="loot-name">{{ item.name }}</span>
          <span class="loot-rarity">{{ item.rarity }}</span>
        </li>
      </ul>

      <p v-if="message" class="message">{{ message }}</p>
      <p v-else class="hint">Touchez ou cliquez une case pour frapper.</p>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 0.75rem;
  background:
    radial-gradient(ellipse at center, rgb(18 16 14 / 35%), rgb(12 10 8 / 82%));
}

.panel {
  width: min(100%, 460px);
  max-height: min(92vh, 720px);
  overflow: auto;
  display: grid;
  gap: 0.85rem;
  padding: 0.9rem;
  border: 1px solid #5a5348;
  background: #161310;
  color: #e8e2d6;
  box-shadow: 0 18px 40px rgb(0 0 0 / 45%);
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.eyebrow {
  margin: 0;
  color: #8a8275;
  font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h2 {
  margin: 0.2rem 0 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.close {
  border: 1px solid #5a5348;
  background: #241f1a;
  color: #e8e2d6;
  padding: 0.4rem 0.7rem;
  cursor: pointer;
  font: 12px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.loot {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}

.loot li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid #3a342c;
  background: #1c1814;
  font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.loot-name {
  color: #e8e2d6;
}

.loot-rarity {
  color: #8a8275;
  letter-spacing: 0.04em;
}

.message {
  margin: 0;
  color: #d4a017;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.hint {
  margin: 0;
  color: #8a8275;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

@media (max-width: 480px) {
  .panel {
    width: 100%;
    max-height: 96vh;
    padding: 0.75rem;
  }
}
</style>
