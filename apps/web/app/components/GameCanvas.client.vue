<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
import type { GameRenderer, GameRendererStats } from "~/game/renderer"
import type {
  ChunkPayload,
  ExcavationStartedPayload,
  ExcavationUpdatePayload,
  NodeDetectedPayload,
  PlayerStatePayload,
  WorldJoinedPayload,
} from "@excave/shared"
import ExcavationOverlay from "~/components/excavation/ExcavationOverlay.vue"
import InventoryPanel from "~/components/InventoryPanel.vue"

const hostRef = ref<HTMLElement | null>(null)
const stats = ref<GameRendererStats | null>(null)
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

let noticeTimer: ReturnType<typeof setTimeout> | null = null

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
  if (event.repeat || event.code !== "F3") {
    return
  }
  event.preventDefault()
  debugHud.value = !debugHud.value
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
      renderer.value.applyWorldJoin(payload.spawn, payload.chunks)
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
    renderer.value?.playScanPulse(payload.position, payload.rangePx)
    if (!payload.detected) {
      showNotice("Rien d'enfoui à portée…")
    }
  },
  onPlayerScanRejected(payload) {
    const seconds = Math.ceil(payload.remainingMs / 1000)
    showNotice(`Scan en recharge (${seconds}s)`)
  },
  onExcavationStarted(payload) {
    excavationSession.value = payload
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
    next.applyWorldJoin(pendingJoin.value.spawn, pendingJoin.value.chunks)
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
    next.onChunkRequest((chunks) => {
      requestChunks(chunks)
    })
    next.onInputSend((buttons, sequence) => {
      if (excavationSession.value) {
        return
      }
      sendInput(buttons, sequence)
    })
    next.onScan(() => {
      if (excavationSession.value) {
        return
      }
      sendScan()
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
  if (noticeTimer) {
    clearTimeout(noticeTimer)
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
      <p v-if="terrainTestActive" class="hint">
        Terrain test · C debug colors · L lighting · 1/2/3 zoom
      </p>
      <p v-else class="hint">F3 : masquer le debug · 1/2/3 zoom · E scan</p>
    </div>

    <div v-else class="hud hud-minimal" aria-live="polite">
      <p v-if="status !== 'connected'" :data-status="status">
        {{ connectionLabel }}
      </p>
      <p v-if="notice" class="notice">{{ notice }}</p>
      <p v-if="lastError" class="error">{{ lastError }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p v-if="!notice && !lastError && !errorMessage && status === 'connected'" class="hint">
        [E] scanner · F3 debug
      </p>
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

.hud-minimal .hint {
  margin-top: 0;
  opacity: 0.75;
}
</style>
