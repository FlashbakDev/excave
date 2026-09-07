<template>
  <main class="game">
    <header class="top">
      <NuxtLink class="back" to="/">← Accueil</NuxtLink>
      <div class="titles">
        <h1>Souterrain</h1>
        <p>Monde chunké déterministe (Lot 3)</p>
      </div>
    </header>

    <ClientOnly>
      <GameCanvas />
      <template #fallback>
        <div class="fallback">Chargement du rendu…</div>
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
}

.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #3a342c;
  background: rgb(18 16 14 / 88%);
}

.titles {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 1rem;
}

h1 {
  margin: 0;
  font-size: 1.15rem;
  letter-spacing: 0.04em;
}

.titles p {
  margin: 0;
  opacity: 0.7;
  font-size: 0.875rem;
}

.back {
  color: #c4a574;
  text-decoration: none;
}

.back:hover {
  text-decoration: underline;
}

.fallback {
  flex: 1;
  display: grid;
  place-items: center;
  color: #9a9080;
}
</style>
