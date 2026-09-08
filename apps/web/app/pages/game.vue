<template>
  <main class="game">
    <ClientOnly>
      <GameCanvas />
      <template #fallback>
        <div class="fallback">Chargement du souterrain…</div>
      </template>
    </ClientOnly>
  </main>
</template>

<style scoped>
.game {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  background: #080908;
}

.fallback {
  flex: 1;
  display: grid;
  place-items: center;
  color: #9a9080;
}
</style>
