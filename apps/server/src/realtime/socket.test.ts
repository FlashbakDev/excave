import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { io as createClient, type Socket } from "socket.io-client"
import {
  ClientToServerEvent,
  ServerToClientEvent,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SessionReadyPayload,
  type WorldJoinedPayload,
} from "@excave/shared"
import { buildServer } from "../app.js"
import type { BuiltServer } from "../app.js"

describe("socket guest session", () => {
  let built: BuiltServer
  let baseUrl: string

  before(async () => {
    built = await buildServer({
      logger: false,
      enableRealtime: true,
      databaseUrl: null,
      worldSeed: "excave-poc-seed-1",
    })
    await built.app.listen({ port: 0, host: "127.0.0.1" })
    const address = built.app.server.address()
    assert.ok(address && typeof address === "object")
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  after(async () => {
    built.io?.close()
    await built.app.close()
  })

  function connectClient(): Socket<ServerToClientEvents, ClientToServerEvents> {
    return createClient(baseUrl, {
      transports: ["websocket"],
      forceNew: true,
    })
  }

  it("issues distinct playerIds for two connections", async () => {
    const first = connectClient()
    const second = connectClient()

    try {
      const [readyA, readyB] = await Promise.all([
        waitForEvent<SessionReadyPayload>(first, ServerToClientEvent.SessionReady),
        waitForEvent<SessionReadyPayload>(second, ServerToClientEvent.SessionReady),
      ])

      assert.notEqual(readyA.playerId, readyB.playerId)
      assert.equal(built.registry.count(), 2)

      const debug = await built.app.inject({ method: "GET", url: "/debug/players" })
      assert.equal(debug.statusCode, 200)
      assert.equal(debug.json<{ count: number }>().count, 2)
    } finally {
      first.close()
      second.close()
      await waitFor(() => built.registry.count() === 0)
    }
  })

  it("replies to session ping", async () => {
    const client = connectClient()

    try {
      await waitForEvent<SessionReadyPayload>(client, ServerToClientEvent.SessionReady)

      const clientTime = Date.now()
      const pongPromise = waitForEvent<{ clientTime: number; serverTime: number }>(
        client,
        ServerToClientEvent.SessionPong,
      )
      client.emit(ClientToServerEvent.SessionPing, { clientTime })
      const pong = await pongPromise

      assert.equal(pong.clientTime, clientTime)
      assert.ok(typeof pong.serverTime === "number")
    } finally {
      client.close()
      await waitFor(() => built.registry.count() === 0)
    }
  })

  it("joins the world and receives nearby chunks", async () => {
    const client = connectClient()

    try {
      await waitForEvent<SessionReadyPayload>(client, ServerToClientEvent.SessionReady)
      const joinedPromise = waitForEvent<WorldJoinedPayload>(
        client,
        ServerToClientEvent.WorldJoined,
      )
      client.emit(ClientToServerEvent.WorldJoin, {})
      const joined = await joinedPromise

      assert.equal(joined.worldId, "main")
      assert.equal(joined.chunks.length, 9)
      assert.ok(joined.chunks[0]?.tiles.length === 32 * 32)
    } finally {
      client.close()
      await waitFor(() => built.registry.count() === 0)
    }
  })
})

function waitForEvent<T>(
  socket: Socket,
  event: string,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${event}`))
    }, timeoutMs)

    socket.once(event, (payload: T) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timeout waiting for condition")
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}
