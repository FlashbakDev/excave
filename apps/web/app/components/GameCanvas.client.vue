<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
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

function closeExcavation(): void {
  excavationSession.value = null
  renderer.value?.setMovementLocked(false)
}

onMounted(async () => {
  const host = hostRef.value
  if (!host) {
    return
  }

  try {
    const { GameRenderer } = await import("~/game/renderer")
    const next = new GameRenderer()
    renderer.value = next
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
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Échec d'initialisation Pixi"
    renderer.value?.destroy()
    renderer.value = null
  }
})

onBeforeUnmount(() => {
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

    <InventoryPanel :items="inventory" />

    <div class="hud" aria-live="polite">
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
      <p v-if="notice" class="notice">{{ notice }}</p>
      <p v-if="lastError" class="error">{{ lastError }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p class="hint">E / Espace : scanner (2s) puis excavate · ZQSD pour bouger</p>
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
  background: #12100e;
}

.canvas-host {
  width: 100%;
  height: 100%;
}

.canvas-host :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.hud {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 2;
  margin: 0;
  padding: 0.65rem 0.8rem;
  border: 1px solid #3a342c;
  background: rgba(18, 16, 14, 0.82);
  color: #e8e2d6;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  pointer-events: none;
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
</style>
