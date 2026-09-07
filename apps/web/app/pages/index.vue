<template>
  <main class="home">
    <h1>Excave</h1>
    <p>POC — souterrain multijoueur (Lot 0)</p>
    <NuxtLink class="enter" to="/game">Entrer dans le souterrain</NuxtLink>
  </main>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 1rem;
  min-height: 100vh;
  padding: 2rem;
  box-sizing: border-box;
}

h1 {
  margin: 0;
  font-size: clamp(2.5rem, 8vw, 4.5rem);
  letter-spacing: 0.04em;
  font-weight: 700;
}

p {
  margin: 0;
  opacity: 0.75;
}

.enter {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.75rem 1.25rem;
  color: #12100e;
  text-decoration: none;
  background: #c4a574;
  border: 1px solid #9a7d4f;
}

.enter:hover {
  background: #d4b584;
}
</style>
