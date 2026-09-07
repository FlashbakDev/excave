import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ClientToServerEvent,
  ServerToClientEvent,
} from "./events.js"

describe("socket event names", () => {
  it("keeps stable public event strings", () => {
    assert.equal(ServerToClientEvent.SessionReady, "session:ready")
    assert.equal(ServerToClientEvent.SessionPong, "session:pong")
    assert.equal(ServerToClientEvent.WorldJoined, "world:joined")
    assert.equal(ServerToClientEvent.WorldChunks, "world:chunks")
    assert.equal(ClientToServerEvent.SessionPing, "session:ping")
    assert.equal(ClientToServerEvent.WorldJoin, "world:join")
    assert.equal(ClientToServerEvent.WorldChunkRequest, "world:chunkRequest")
  })
})
