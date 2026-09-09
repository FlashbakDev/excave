<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue"
import type { MovementButtons } from "@excave/shared"
import {
  IDLE_MOVEMENT,
  clampStickOffset,
  movementFromStick,
} from "~/game/input/virtualJoystick"

const emit = defineEmits<{
  change: [buttons: MovementButtons]
}>()

const zoneRef = ref<HTMLElement | null>(null)
const active = ref(false)
const originX = ref(0)
const originY = ref(0)
const knobX = ref(0)
const knobY = ref(0)

let pointerId: number | null = null
let lastButtons: MovementButtons = { ...IDLE_MOVEMENT }

const baseStyle = computed(() => ({
  left: `${originX.value}px`,
  top: `${originY.value}px`,
}))

const knobStyle = computed(() => ({
  transform: `translate(${knobX.value}px, ${knobY.value}px)`,
}))

function emitIfChanged(next: MovementButtons): void {
  if (
    next.up === lastButtons.up &&
    next.down === lastButtons.down &&
    next.left === lastButtons.left &&
    next.right === lastButtons.right
  ) {
    return
  }
  lastButtons = next
  emit("change", { ...next })
}

function release(): void {
  active.value = false
  pointerId = null
  knobX.value = 0
  knobY.value = 0
  emitIfChanged({ ...IDLE_MOVEMENT })
}

function onPointerDown(event: PointerEvent): void {
  if (!zoneRef.value || pointerId !== null || event.button !== 0) {
    return
  }
  const rect = zoneRef.value.getBoundingClientRect()
  pointerId = event.pointerId
  active.value = true
  // Dynamic origin = exact finger contact (no fixed home position).
  originX.value = event.clientX - rect.left
  originY.value = event.clientY - rect.top
  knobX.value = 0
  knobY.value = 0
  zoneRef.value.setPointerCapture(event.pointerId)
  emitIfChanged({ ...IDLE_MOVEMENT })
}

function onPointerMove(event: PointerEvent): void {
  if (!zoneRef.value || event.pointerId !== pointerId || !active.value) {
    return
  }
  const rect = zoneRef.value.getBoundingClientRect()
  const dx = event.clientX - rect.left - originX.value
  const dy = event.clientY - rect.top - originY.value
  const clamped = clampStickOffset(dx, dy)
  knobX.value = clamped.x
  knobY.value = clamped.y
  emitIfChanged(movementFromStick(clamped.x, clamped.y))
}

function onPointerUp(event: PointerEvent): void {
  if (event.pointerId !== pointerId) {
    return
  }
  if (zoneRef.value?.hasPointerCapture(event.pointerId)) {
    zoneRef.value.releasePointerCapture(event.pointerId)
  }
  release()
}

onBeforeUnmount(() => {
  release()
})
</script>

<template>
  <!-- Invisible lower-right hit zone: stick only renders after touch, at contact point. -->
  <div
    ref="zoneRef"
    class="joystick-zone"
    :data-active="active ? 'true' : 'false'"
    aria-label="Zone joystick (bas droite)"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      v-if="active"
      class="base"
      :style="baseStyle"
      aria-hidden="true"
    >
      <div class="ring" />
      <div class="knob" :style="knobStyle" />
    </div>
  </div>
</template>

<style scoped>
.joystick-zone {
  position: absolute;
  z-index: 3;
  right: 0;
  bottom: 0;
  width: min(48vw, 16rem);
  height: min(42vh, 18rem);
  /* Invisible until touch — no fixed target to aim for. */
  background: transparent;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

.base {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}

.ring {
  position: absolute;
  left: 0;
  top: 0;
  width: 7rem;
  height: 7rem;
  margin-left: -3.5rem;
  margin-top: -3.5rem;
  border: 2px solid rgba(255, 225, 160, 0.55);
  border-radius: 50%;
  background: rgba(18, 16, 14, 0.45);
  box-shadow: inset 0 0 0 1px rgba(84, 74, 55, 0.55);
}

.knob {
  position: absolute;
  left: 0;
  top: 0;
  width: 2.35rem;
  height: 2.35rem;
  margin-left: -1.175rem;
  margin-top: -1.175rem;
  border: 2px solid #ffe1a0;
  border-radius: 50%;
  background: rgba(242, 202, 124, 0.82);
  box-shadow: 0 0 0 1px rgba(8, 9, 8, 0.35);
  will-change: transform;
}
</style>
