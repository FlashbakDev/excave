<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{
  stability: number
  maxStability: number
}>()

const ratio = computed(() =>
  Math.max(0, Math.min(1, props.stability / Math.max(1, props.maxStability))),
)
</script>

<template>
  <div
    class="stability"
    role="meter"
    :aria-valuenow="Math.round(stability)"
    :aria-valuemin="0"
    :aria-valuemax="maxStability"
    aria-label="Stabilité"
  >
    <div class="badge">
      <span class="label">Stab</span>
      <span class="value">{{ Math.round(stability) }}</span>
    </div>
    <div class="track">
      <div
        class="fill"
        :class="{ danger: ratio < 0.25, warn: ratio < 0.5 && ratio >= 0.25 }"
        :style="{ width: `${ratio * 100}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
.stability {
  display: grid;
  gap: 0.3rem;
  min-width: 6.5rem;
}

.badge {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  padding: 0.2rem 0.45rem;
  border-radius: 0.4rem;
  background: #f4efe4;
  border: 1px solid #d8d0c0;
  box-shadow: 0 1px 0 rgb(0 0 0 / 15%);
  font: 700 11px/1.2 ui-rounded, "Trebuchet MS", sans-serif;
  color: #3a342c;
  width: fit-content;
  margin-left: auto;
}

.label {
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6e6558;
  font-weight: 700;
  font-size: 9px;
}

.value {
  font-size: 13px;
  color: #2a241c;
}

.track {
  height: 8px;
  border-radius: 999px;
  border: 1px solid #5a3a22;
  background: #1a120c;
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: inherit;
  background: #9bbb7a;
  transition: width 100ms steps(2, end);
}

.fill.warn {
  background: #d7b16f;
}

.fill.danger {
  background: #c45c26;
}
</style>
