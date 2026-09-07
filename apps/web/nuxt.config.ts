import { defineNuxtConfig } from "nuxt/config"

export default defineNuxtConfig({
  compatibilityDate: "2025-09-01",
  future: {
    compatibilityVersion: 4,
  },
  devtools: { enabled: true },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? "http://127.0.0.1:3001",
      socketUrl: process.env.NUXT_PUBLIC_SOCKET_URL ?? "http://127.0.0.1:3001",
    },
  },
})
