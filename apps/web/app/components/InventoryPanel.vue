<script setup lang="ts">
import type { InventoryItemPublic } from "@excave/shared"

defineProps<{
  items: InventoryItemPublic[]
}>()
</script>

<template>
  <aside class="inventory" aria-label="Inventaire">
    <h3>Inventaire</h3>
    <ul v-if="items.length > 0">
      <li v-for="item in items" :key="item.type">
        <span class="name">{{ item.name }}</span>
        <span class="qty">x{{ item.quantity }}</span>
      </li>
    </ul>
    <p v-else class="empty">Vide</p>
  </aside>
</template>

<style scoped>
.inventory {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  min-width: 9.5rem;
  max-width: 14rem;
  margin: 0;
  padding: 0.65rem 0.8rem;
  border: 1px solid #3a342c;
  background: rgba(18, 16, 14, 0.82);
  color: #e8e2d6;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  pointer-events: none;
}

h3 {
  margin: 0 0 0.4rem;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8a8275;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.25rem;
}

li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.name {
  color: #e8e2d6;
}

.qty {
  color: #c4a574;
}

.empty {
  margin: 0;
  color: #8a8275;
}
</style>
