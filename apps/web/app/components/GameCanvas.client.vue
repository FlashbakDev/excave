<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
import {
  SCAN_COOLDOWN_MS,
  type ChunkPayload,
  type ExcavationStartedPayload,
  type ExcavationUpdatePayload,
  type MovementButtons,
  type NodeDetectedPayload,
  type PlayerStatePayload,
  type WorldJoinedPayload,
} from "@excave/shared"
import type {
  GameRenderer,
  GameRendererStats,
  MovementDebugSnapshot,
} from "~/game/renderer"
import { IDLE_MOVEMENT } from "~/game/input/virtualJoystick"
import ExcavationOverlay from "~/components/excavation/ExcavationOverlay.vue"
import InventoryPanel from "~/components/InventoryPanel.vue"
import ScanButton from "~/components/ScanButton.vue"
import VirtualJoystick from "~/components/VirtualJoystick.vue"

const hostRef = ref<HTMLElement | null>(null)
const stats = ref<GameRendererStats | null>(null)
const movementDebug = shallowRef<MovementDebugSnapshot | null>(null)
const errorMessage = ref<string | null>(null)
const notice = ref<string | null>(null)
const excavationSession = shallowRef<ExcavationStartedPayload | null>(null)
const overlayRef = ref<{ applyUpdate: (update: ExcavationUpdatePayload) => void } | null>(
  null,
)
const renderer = shallowRef<GameRenderer | null>(null)
const isDev = import.meta.dev
/** Lot 13: immersive by default; F3 toggles developer HUD (Lot 18 will formalize). */
const debugHud = ref(false)
const route = useRoute()
const terrainTestActive = computed(
  () => isDev && String(route.query.terrainTest ?? "") !== "",
)

const pendingJoin = shallowRef<WorldJoinedPayload | null>(null)
const pendingChunks = shallowRef<ChunkPayload[] | null>(null)
const pendingStates = shallowRef<PlayerStatePayload[]>([])
const pendingNodes = shallowRef<NodeDetectedPayload[]>([])

/** Client mirror of server scan cooldown — UI only; server remains authoritative. */
const scanCooldownEndsAt = ref(0)
const scanNowMs = ref(0)
const scanButtonPressed = ref(false)
let noticeTimer: ReturnType<typeof setTimeout> | null = null
let scanCooldownRaf = 0
let scanPressTimer: ReturnType<typeof setTimeout> | null = null

const scanCooldownRemainingMs = computed(() =>
  Math.max(0, scanCooldownEndsAt.value - scanNowMs.value),
)
const scanCooldownRatio = computed(() => {
  if (scanCooldownRemainingMs.value <= 0) {
    return 0
  }
  return Math.min(1, scanCooldownRemainingMs.value / SCAN_COOLDOWN_MS)
})
const scanCooldownSeconds = computed(() =>
  Math.ceil(scanCooldownRemainingMs.value / 1000),
)
const scanButtonVisible = computed(
  () => !excavationSession.value && !terrainTestActive.value,
)

/** Coarse pointer / touch — virtual stick on the right. */
const touchControls = ref(false)
let touchMedia: MediaQueryList | null = null

const joystickVisible = computed(
  () =>
    touchControls.value &&
    !excavationSession.value &&
    !terrainTestActive.value &&
    status.value === "connected",
)

function syncTouchControls(): void {
  if (typeof window === "undefined") {
    touchControls.value = false
    return
  }
  touchControls.value =
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches
}

function onVirtualMove(buttons: MovementButtons): void {
  renderer.value?.setVirtualMovement(buttons)
}

function clearVirtualMove(): void {
  renderer.value?.setVirtualMovement({ ...IDLE_MOVEMENT })
}

function showNotice(message: string): void {
  notice.value = message
  if (noticeTimer) {
    clearTimeout(noticeTimer)
  }
  noticeTimer = setTimeout(() => {
    notice.value = null
    noticeTimer = null
  }, 4000)
}

function onHudKeyDown(event: KeyboardEvent): void {
  if (!isDev || event.repeat || event.code !== "F3") {
    return
  }
  event.preventDefault()
  debugHud.value = !debugHud.value
}

function armScanCooldown(durationMs: number): void {
  const endsAt = Date.now() + Math.max(0, durationMs)
  scanCooldownEndsAt.value = endsAt
  scanNowMs.value = Date.now()
  if (scanCooldownRaf) {
    cancelAnimationFrame(scanCooldownRaf)
    scanCooldownRaf = 0
  }
  const tick = (): void => {
    scanNowMs.value = Date.now()
    if (scanNowMs.value < scanCooldownEndsAt.value) {
      scanCooldownRaf = requestAnimationFrame(tick)
      return
    }
    scanCooldownRaf = 0
    scanCooldownEndsAt.value = 0
  }
  if (durationMs > 0) {
    scanCooldownRaf = requestAnimationFrame(tick)
  }
}

function flashScanButton(): void {
  scanButtonPressed.value = true
  if (scanPressTimer) {
    clearTimeout(scanPressTimer)
  }
  scanPressTimer = setTimeout(() => {
    scanButtonPressed.value = false
    scanPressTimer = null
  }, 120)
}

/** Shared path for HUD button + keyboard (E / Space). */
function requestScan(options?: { fromKeyboard?: boolean }): void {
  if (excavationSession.value || terrainTestActive.value) {
    return
  }
  if (status.value !== "connected") {
    return
  }
  if (scanCooldownRemainingMs.value > 0) {
    if (options?.fromKeyboard) {
      flashScanButton()
    }
    return
  }
  if (!renderer.value) {
    return
  }

  if (options?.fromKeyboard) {
    flashScanButton()
  }

  renderer.value.playLocalScanPulse()
  sendScan()
  armScanCooldown(SCAN_COOLDOWN_MS)
}

const {
  connectionLabel,
  shortPlayerId,
  playerId,
  pingMs,
  status,
  lastError,
  inventory,
  requestChunks,
  sendInput,
  sendScan,
  sendExcavationStart,
  sendExcavationHit,
} = useGameSession({
  onWorldJoined(payload) {
    if (renderer.value) {
      renderer.value.applyWorldJoin(
        payload.spawn,
        payload.chunks,
        payload.movementEpoch,
        payload.lastProcessedSequence,
      )
      renderer.value.setNetworkConnected(true)
    } else {
      pendingJoin.value = payload
    }
  },
  onWorldChunks(chunks) {
    if (renderer.value) {
      renderer.value.applyChunks(chunks)
    } else {
      pendingChunks.value = chunks
    }
  },
  onPlayerState(payload) {
    if (renderer.value) {
      renderer.value.applyPlayerState(payload)
    } else {
      pendingStates.value = [...pendingStates.value, payload]
    }
  },
  onNodeDetected(payload) {
    if (renderer.value) {
      renderer.value.applyNodeDetected(payload)
    } else {
      pendingNodes.value = [...pendingNodes.value, payload]
    }
    showNotice(payload.message)
  },
  onNodeUpdated(payload) {
    renderer.value?.applyNodeUpdated(payload)
  },
  onPlayerScanned(payload) {
    // Optimistic cooldown already armed in requestScan; keep full window.
    if (scanCooldownRemainingMs.value <= 0) {
      armScanCooldown(SCAN_COOLDOWN_MS)
    }
    if (!payload.detected) {
      showNotice("Rien d'enfoui à portée…")
    }
  },
  onPlayerScanRejected(payload) {
    armScanCooldown(payload.remainingMs)
    const seconds = Math.ceil(payload.remainingMs / 1000)
    showNotice(`Scan en recharge (${seconds}s)`)
  },
  onExcavationStarted(payload) {
    excavationSession.value = payload
    clearVirtualMove()
    renderer.value?.setMovementLocked(true)
    renderer.value?.applyNodeUpdated({
      nodeId: payload.nodeId,
      visualState: "busy",
      activePlayerId: payload.activePlayerId,
    })
  },
  onExcavationRejected(payload) {
    const labels: Record<string, string> = {
      not_found: "Filon introuvable",
      not_available: "Scannez d'abord ce filon (E)",
      out_of_range: "Trop loin du filon",
      busy: "Filon déjà en cours d'excavation",
      depleted: "Filon épuisé",
    }
    showNotice(labels[payload.reason] ?? "Excavation refusée")
  },
  onExcavationUpdate(payload) {
    overlayRef.value?.applyUpdate(payload)
  },
})

watch(playerId, (id) => {
  renderer.value?.setLocalPlayerId(id)
})

watch(pingMs, (ms) => {
  renderer.value?.setRoundTripMs(ms)
})

watch(status, (value) => {
  if (value !== "connected") {
    renderer.value?.setNetworkConnected(false)
  }
})

function closeExcavation(): void {
  excavationSession.value = null
  renderer.value?.setMovementLocked(false)
}

/**
 * Flush network payloads that arrived while Pixi was still booting.
 * Important: do not publish `renderer` until mount finished — otherwise
 * world:joined hits applyWorldJoin while world/camera are still null and
 * is dropped (direct /game loads often lose the join this way).
 */
function flushPending(next: GameRenderer): void {
  if (pendingJoin.value) {
    next.applyWorldJoin(
      pendingJoin.value.spawn,
      pendingJoin.value.chunks,
      pendingJoin.value.movementEpoch,
      pendingJoin.value.lastProcessedSequence,
    )
    next.setNetworkConnected(true)
    pendingJoin.value = null
  }
  if (pendingChunks.value) {
    next.applyChunks(pendingChunks.value)
    pendingChunks.value = null
  }
  for (const state of pendingStates.value) {
    next.applyPlayerState(state)
  }
  pendingStates.value = []
  for (const node of pendingNodes.value) {
    next.applyNodeDetected(node)
  }
  pendingNodes.value = []
}

onMounted(async () => {
  window.addEventListener("keydown", onHudKeyDown)
  syncTouchControls()
  touchMedia = window.matchMedia("(pointer: coarse)")
  touchMedia.addEventListener("change", syncTouchControls)

  // ClientOnly / hydration can leave the ref unset for one tick on cold /game.
  let host = hostRef.value
  if (!host) {
    await nextTick()
    host = hostRef.value
  }
  if (!host) {
    errorMessage.value = "Zone de rendu indisponible"
    return
  }

  try {
    const { GameRenderer } = await import("~/game/renderer")
    const next = new GameRenderer()
    next.setLocalPlayerId(playerId.value)
    next.onStats((value) => {
      stats.value = value
    })
    next.onMovementDebug((value) => {
      movementDebug.value = value
    })
    next.onChunkRequest((chunks) => {
      requestChunks(chunks)
    })
    next.onInputSend((payload) => {
      sendInput(payload)
    })
    next.onScan(() => {
      requestScan({ fromKeyboard: true })
    })
    next.onExcavationStart((nodeId) => {
      if (excavationSession.value) {
        return
      }
      sendExcavationStart(nodeId)
    })

    await next.mount(host)

    // Publish only when the world graph exists so socket handlers are safe.
    renderer.value = next
    next.setLocalPlayerId(playerId.value)
    next.setRoundTripMs(pingMs.value)
    next.setNetworkConnected(false)

    if (terrainTestActive.value) {
      next.loadTerrainTestScene({ debugColors: true, lighting: false })
      debugHud.value = true
    } else {
      flushPending(next)
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Échec d'initialisation Pixi"
    renderer.value?.destroy()
    renderer.value = null
  }
})

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onHudKeyDown)
  touchMedia?.removeEventListener("change", syncTouchControls)
  touchMedia = null
  clearVirtualMove()
  if (noticeTimer) {
    clearTimeout(noticeTimer)
  }
  if (scanPressTimer) {
    clearTimeout(scanPressTimer)
  }
  if (scanCooldownRaf) {
    cancelAnimationFrame(scanCooldownRaf)
  }
  renderer.value?.destroy()
  renderer.value = null
})
</script>

<template>
  <div class="canvas-root">
    <div ref="hostRef" class="canvas-host" aria-label="Rendu du souterrain" />

    <ExcavationOverlay
      v-if="excavationSession"
      ref="overlayRef"
      :session="excavationSession"
      @hit="(x, y, tool) => sendExcavationHit(excavationSession!.sessionId, x, y, tool)"
      @close="closeExcavation"
    />

    <InventoryPanel v-if="debugHud || inventory.length > 0" :items="inventory" />

    <div v-if="scanButtonVisible" class="scan-dock">
      <ScanButton
        :cooldown-ratio="scanCooldownRatio"
        :cooldown-seconds="scanCooldownSeconds"
        :pressed="scanButtonPressed"
        :disabled="status !== 'connected'"
        @activate="requestScan()"
      />
    </div>

    <VirtualJoystick
      v-if="joystickVisible"
      @change="onVirtualMove"
    />

    <div v-if="debugHud" class="hud hud-debug" aria-live="polite">
      <p>
        Connexion :
        <span :data-status="status">{{ connectionLabel }}</span>
      </p>
      <p>Player : {{ shortPlayerId }}</p>
      <p>Ping : {{ pingMs === null ? "—" : `${pingMs} ms` }}</p>
      <p v-if="stats">
        Chunk {{ stats.chunkX }}:{{ stats.chunkY }}
      </p>
      <p v-if="stats">
        Pos {{ stats.playerX.toFixed(0) }}, {{ stats.playerY.toFixed(0) }}
      </p>
      <p v-if="stats">
        Visibles : {{ stats.remoteCount }}
      </p>
      <p v-if="isDev && stats">FPS {{ stats.fps.toFixed(0) }}</p>
      <p v-if="stats">Zoom {{ stats.zoom }}×</p>
      <template v-if="movementDebug">
        <p>
          Input:
          {{ Object.entries(movementDebug.input).filter(([, down]) => down).map(([key]) => key).join("+") || "idle" }}
        </p>
        <p>
          Pred {{ movementDebug.predicted.x.toFixed(1) }},
          {{ movementDebug.predicted.y.toFixed(1) }}
        </p>
        <p v-if="movementDebug.authoritative">
          Auth {{ movementDebug.authoritative.x.toFixed(1) }},
          {{ movementDebug.authoritative.y.toFixed(1) }}
        </p>
        <p>
          Render {{ movementDebug.render.x.toFixed(1) }},
          {{ movementDebug.render.y.toFixed(1) }}
        </p>
        <p>
          Camera {{ movementDebug.camera.x.toFixed(1) }},
          {{ movementDebug.camera.y.toFixed(1) }}
        </p>
        <p>
          Err now {{ movementDebug.predictionErrorPx?.toFixed(2) ?? "—" }} px ·
          ack {{ movementDebug.acknowledgedErrorPx?.toFixed(2) ?? "—" }} px ·
          reconcile {{ movementDebug.reconcileAction }}
        </p>
        <p>
          Inputs {{ movementDebug.pendingInputCount }} · visual
          {{ movementDebug.visualErrorPx.toFixed(2) }} px · remote delay
          {{ movementDebug.remoteInterpolationDelayMs?.toFixed(0) ?? "—" }} ms
        </p>
        <p>
          Snapshot {{ movementDebug.snapshotHz?.toFixed(1) ?? "—" }} Hz ·
          age {{ movementDebug.snapshotAgeMs?.toFixed(0) ?? "—" }} ms
        </p>
        <p>
          dt render {{ movementDebug.renderDtMs.toFixed(2) }} ms ·
          sim {{ movementDebug.simulationDtMs?.toFixed(2) ?? "—" }} ms
        </p>
      </template>
      <p v-if="terrainTestActive" class="hint">
        Terrain test · C debug colors · L lighting · 1/2/3 zoom
      </p>
      <p v-else class="hint">F3 : masquer · 1/2/3 zoom · scan (E)</p>
    </div>

    <div v-else class="hud hud-minimal" aria-live="polite">
      <p v-if="status !== 'connected'" :data-status="status">
        {{ connectionLabel }}
      </p>
      <p v-if="notice" class="notice">{{ notice }}</p>
      <p v-if="lastError" class="error">{{ lastError }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </div>

    <div v-if="debugHud" class="hud-notices" aria-live="polite">
      <p v-if="notice" class="notice">{{ notice }}</p>
      <p v-if="lastError" class="error">{{ lastError }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<style scoped>
.canvas-root {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #080908;
}

.canvas-host {
  width: 100%;
  height: 100%;
}

.canvas-host :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.scan-dock {
  position: absolute;
  z-index: 4;
  left: 1.1rem;
  bottom: 1.1rem;
  pointer-events: auto;
}

.hud {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 2;
  margin: 0;
  padding: 0.65rem 0.8rem;
  border: 1px solid #3a342c;
  background: rgba(8, 9, 8, 0.82);
  color: #e8e2d6;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  pointer-events: none;
}

.hud-minimal {
  border-color: transparent;
  background: transparent;
  padding: 0.5rem 0.65rem;
}

.hud-notices {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 2;
  margin-top: 9rem;
  pointer-events: none;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.hud p {
  margin: 0;
}

.hud p + p {
  margin-top: 0.2rem;
}

.hud [data-status="connected"] {
  color: #9bbb7a;
}

.hud [data-status="connecting"] {
  color: #c4a574;
}

.hud [data-status="disconnected"] {
  color: #c47a7a;
}

.hud .error {
  color: #c47a7a;
  max-width: 18rem;
}

.hud .notice {
  color: #d4a017;
  max-width: 18rem;
  margin-top: 0.35rem;
}

.hud .hint {
  margin-top: 0.45rem;
  color: #8a8275;
  font-size: 11px;
}

.hud-notices .error {
  color: #c47a7a;
  max-width: 18rem;
}

.hud-notices .notice {
  color: #d4a017;
  max-width: 18rem;
}
</style>
