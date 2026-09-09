<script setup lang="ts">
defineProps<{
  /** 0 = ready, 1 = just started cooling. */
  cooldownRatio: number
  cooldownSeconds: number
  /** Brief highlight when keyboard triggers the same action. */
  pressed?: boolean
  disabled?: boolean
}>()

defineEmits<{
  activate: []
}>()
</script>

<template>
  <button
    type="button"
    class="scan-btn"
    tabindex="-1"
    :disabled="disabled || cooldownRatio > 0"
    :data-pressed="pressed ? 'true' : 'false'"
    :data-cooling="cooldownRatio > 0 ? 'true' : 'false'"
    :aria-label="
      cooldownRatio > 0
        ? `Scan en recharge, ${cooldownSeconds} seconde${cooldownSeconds > 1 ? 's' : ''}`
        : 'Scanner'
    "
    @pointerdown.prevent="$emit('activate')"
  >
    <span
      v-if="cooldownRatio > 0"
      class="cooldown-fill"
      :style="{ transform: `scaleY(${cooldownRatio})` }"
      aria-hidden="true"
    />
    <svg
      class="icon"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      <!-- Radar / sonar pulse — warm lamp tones, crisp strokes -->
      <circle
        cx="12"
        cy="12"
        r="2.2"
        fill="currentColor"
      />
      <circle
        cx="12"
        cy="12"
        r="5.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        opacity="0.9"
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        opacity="0.55"
        stroke-dasharray="4 3"
      />
    </svg>
    <span v-if="cooldownRatio > 0" class="timer" aria-hidden="true">
      {{ cooldownSeconds }}
    </span>
  </button>
</template>

<style scoped>
.scan-btn {
  position: relative;
  display: grid;
  place-items: center;
  width: 4.25rem;
  height: 4.25rem;
  padding: 0;
  overflow: hidden;
  border: 2px solid #d7b16f;
  background: rgba(18, 16, 14, 0.88);
  color: #ffe1a0;
  cursor: pointer;
  font: 12px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  image-rendering: pixelated;
  user-select: none;
  -webkit-user-select: none;
}

.scan-btn:disabled {
  cursor: default;
  border-color: #5a5348;
  color: #8a8275;
}

.scan-btn[data-pressed="true"] {
  border-color: #ffe1a0;
  background: rgba(42, 36, 28, 0.95);
  transform: translateY(1px);
}

.scan-btn:not(:disabled):active {
  transform: translateY(1px);
  border-color: #ffe1a0;
}

.cooldown-fill {
  position: absolute;
  inset: 0;
  transform-origin: bottom center;
  background: rgba(215, 177, 111, 0.22);
  pointer-events: none;
}

.icon {
  position: relative;
  z-index: 1;
  display: block;
}

.timer {
  position: absolute;
  z-index: 1;
  right: 0.3rem;
  bottom: 0.25rem;
  font-size: 11px;
  font-weight: 700;
  color: #d7b16f;
}
</style>
