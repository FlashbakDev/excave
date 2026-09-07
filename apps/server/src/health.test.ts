import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildServer } from "./app.js"

describe("GET /health", () => {
  it("returns status ok", async () => {
    const { app, db } = await buildServer({
      logger: false,
      enableRealtime: false,
      databaseUrl: null,
      worldSeed: "test-seed",
    })

    const response = await app.inject({
      method: "GET",
      url: "/health",
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.json<{ status: string }>().status, "ok")

    await app.close()
    await db?.client.end({ timeout: 1 })
  })
})

describe("GET /debug/players", () => {
  it("reports zero connected players initially", async () => {
    const { app, db } = await buildServer({
      logger: false,
      enableRealtime: false,
      databaseUrl: null,
    })

    const response = await app.inject({
      method: "GET",
      url: "/debug/players",
    })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { count: 0, players: [] })

    await app.close()
    await db?.client.end({ timeout: 1 })
  })
})

describe("GET /debug/world", () => {
  it("exposes deterministic spawn for a fixed seed", async () => {
    const first = await buildServer({
      logger: false,
      enableRealtime: false,
      databaseUrl: null,
      worldSeed: "excave-poc-seed-1",
    })
    const second = await buildServer({
      logger: false,
      enableRealtime: false,
      databaseUrl: null,
      worldSeed: "excave-poc-seed-1",
    })

    try {
      const a = await first.app.inject({ method: "GET", url: "/debug/world" })
      const b = await second.app.inject({ method: "GET", url: "/debug/world" })
      assert.deepEqual(a.json(), b.json())
    } finally {
      await first.app.close()
      await second.app.close()
    }
  })
})
