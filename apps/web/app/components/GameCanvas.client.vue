<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue"
import type { GameRenderer, GameRendererStats } from "~/game/renderer"
import type { ChunkPayload, WorldJoinedPayload } from "@excave/shared"

const hostRef = ref<HTMLElement | null>(null)
const stats = ref<GameRendererStats | null>(null)
const errorMessage = ref<string | null>(null)
const renderer = shallowRef<GameRenderer | null>(null)
const isDev = import.meta.dev

const pendingJoin = shallowRef<WorldJoinedPayload | null>(null)
const pendingChunks = shallowRef<ChunkPayload[] | null>(null)

const { connectionLabel, shortPlayerId, pingMs, status, lastError, requestChunks } =
  useGameSession({
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
  })

onMounted(async () => {
  const host = hostRef.value
  if (!host) {
    return
  }

  try {
    const { GameRenderer } = await import("~/game/renderer")
    const next = new GameRenderer()
    renderer.value = next
    next.onStats((value) => {
      stats.value = value
    })
    next.onChunkRequest((chunks) => {
      requestChunks(chunks)
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
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Échec d'initialisation Pixi"
    renderer.value?.destroy()
    renderer.value = null
  }
})

onBeforeUnmount(() => {
  renderer.value?.destroy()
  renderer.value = null
})
</script>

<template>
  <div class="canvas-root">
    <div ref="hostRef" class="canvas-host" aria-label="Rendu du souterrain" />

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
      <p v-if="isDev && stats">FPS {{ stats.fps.toFixed(0) }}</p>
      <p v-if="lastError" class="error">{{ lastError }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p class="hint">ZQSD / WASD / flèches — exploration locale Lot 3</p>
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
  margin: 0;
  padding: 0.5rem 0.65rem;
  font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  font-size: 0.75rem;
  line-height: 1.35;
  color: #e8e2d6;
  background: rgb(18 16 14 / 72%);
  pointer-events: none;
}

.hud p {
  margin: 0;
}

.hud span[data-status="connected"] {
  color: #9fbf8a;
}

.hud span[data-status="connecting"] {
  color: #c4a574;
}

.hud span[data-status="disconnected"] {
  color: #d09080;
}

.hint {
  margin-top: 0.35rem !important;
  opacity: 0.65;
}

.error {
  color: #f0b4a0;
}
</style>
