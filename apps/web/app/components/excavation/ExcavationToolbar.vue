<script setup lang="ts">
import { ExcavationTool, type ExcavationTool as ExcavationToolId } from "@excave/shared"

const tool = defineModel<ExcavationToolId>("tool", { required: true })

const options: Array<{ id: ExcavationToolId; label: string; hint: string }> = [
  {
    id: ExcavationTool.Pickaxe,
    label: "Pioche",
    hint: "Précise · peu de stabilité",
  },
  {
    id: ExcavationTool.Hammer,
    label: "Marteau",
    hint: "Large · plus de dégâts",
  },
]
</script>

<template>
  <div class="toolbar" role="toolbar" aria-label="Outils d'excavation">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      class="tool"
      :data-active="tool === option.id"
      @click="tool = option.id"
    >
      <strong>{{ option.label }}</strong>
      <span>{{ option.hint }}</span>
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.tool {
  display: grid;
  gap: 0.15rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid #5a5348;
  background: #1c1916;
  color: #e8e2d6;
  text-align: left;
  cursor: pointer;
  font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.tool strong {
  font-size: 13px;
}

.tool span {
  color: #8a8275;
  font-size: 11px;
}

.tool[data-active="true"] {
  border-color: #c4a574;
  background: #2a241c;
}

.tool:active {
  transform: translateY(1px);
}
</style>
