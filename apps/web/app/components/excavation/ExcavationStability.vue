<script setup lang="ts">
defineProps<{
  stability: number
  maxStability: number
}>()
</script>

<template>
  <div class="stability" role="meter" :aria-valuenow="stability" :aria-valuemin="0" :aria-valuemax="maxStability">
    <div class="label">
      <span>Stabilité</span>
      <span>{{ Math.round(stability) }} / {{ maxStability }}</span>
    </div>
    <div class="track">
      <div
        class="fill"
        :class="{ danger: stability / maxStability < 0.25 }"
        :style="{ width: `${Math.max(0, Math.min(100, (stability / maxStability) * 100))}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
.stability {
  display: grid;
  gap: 0.35rem;
}

.label {
  display: flex;
  justify-content: space-between;
  font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #e8e2d6;
}

.track {
  height: 10px;
  border: 1px solid #5a5348;
  background: #1a1714;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: #9bbb7a;
  transition: width 120ms ease-out;
}

.fill.danger {
  background: #c45c26;
}
</style>
