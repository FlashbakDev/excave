<script setup lang="ts">
import { ExcavationTool, type ExcavationTool as ExcavationToolId } from "@excave/shared"

const tool = defineModel<ExcavationToolId>("tool", { required: true })

const options: Array<{
  id: ExcavationToolId
  label: string
  tone: "pick" | "hammer"
}> = [
  {
    id: ExcavationTool.Pickaxe,
    label: "Pioche",
    tone: "pick",
  },
  {
    id: ExcavationTool.Hammer,
    label: "Marteau",
    tone: "hammer",
  },
]
</script>

<template>
  <div class="dock" role="toolbar" aria-label="Outils d'excavation">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      class="tool"
      :data-tone="option.tone"
      :data-active="tool === option.id"
      :aria-pressed="tool === option.id"
      :aria-label="option.label"
      @pointerdown.prevent="tool = option.id"
    >
      <span class="glyph" aria-hidden="true">
        <svg
          v-if="option.tone === 'pick'"
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <path
            fill="#c45c3a"
            stroke="#3a1808"
            stroke-width="1.5"
            d="M6 22 L14 8 L18 10 L12 24 Z"
          />
          <path
            fill="#e8d2a8"
            stroke="#3a1808"
            stroke-width="1.4"
            d="M16 6 L28 4 L26 10 L18 12 Z"
          />
          <rect x="13" y="10" width="3.2" height="16" rx="1" fill="#6e5130" stroke="#3a1808" stroke-width="1.2" />
        </svg>
        <svg
          v-else
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <path
            fill="#4a8fd4"
            stroke="#1a3048"
            stroke-width="1.5"
            d="M8 8 H24 V14 H8 Z"
          />
          <rect x="14" y="13" width="4" height="14" rx="1" fill="#6e5130" stroke="#3a1808" stroke-width="1.2" />
          <path fill="#7ab0e8" d="M9 9 H23 V11.5 H9 Z" />
        </svg>
      </span>
      <span class="name">{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.dock {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
  width: 100%;
  max-width: 22rem;
  height: 100%;
  margin: 0 auto;
  padding: 0.55rem 0.65rem;
  border-radius: 0.85rem;
  box-sizing: border-box;
  background: rgb(12 10 8 / 78%);
  border: 1px solid rgb(255 255 255 / 10%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 6%);
}

.tool {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 0.2rem;
  min-height: 3.5rem;
  min-width: 3.5rem;
  padding: 0.45rem 0.4rem 0.5rem;
  border: 2px solid #5a5348;
  border-radius: 0.65rem;
  background: linear-gradient(180deg, #2a241c 0%, #1c1916 100%);
  color: #e8e2d6;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.glyph {
  display: grid;
  place-items: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 0.45rem;
  background: rgb(255 255 255 / 6%);
}

.name {
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 11px;
  color: #c4a574;
}

.tool[data-tone="pick"][data-active="true"] {
  border-color: #c45c3a;
  background: linear-gradient(180deg, #3a241c 0%, #2a1810 100%);
  box-shadow: 0 0 0 1px rgb(196 92 58 / 35%);
}

.tool[data-tone="hammer"][data-active="true"] {
  border-color: #4a8fd4;
  background: linear-gradient(180deg, #1c2838 0%, #141c28 100%);
  box-shadow: 0 0 0 1px rgb(74 143 212 / 35%);
}

.tool[data-active="true"] .name {
  color: #ffe1a0;
}

.tool:active {
  transform: translateY(1px);
}
</style>
