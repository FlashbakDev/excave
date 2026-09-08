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
    assert.equal(ServerToClientEvent.PlayerState, "player:state")
    assert.equal(ServerToClientEvent.NodeDetected, "node:detected")
    assert.equal(ServerToClientEvent.NodeUpdated, "node:updated")
    assert.equal(ServerToClientEvent.PlayerScanned, "player:scanned")
    assert.equal(ServerToClientEvent.PlayerScanRejected, "player:scanRejected")
    assert.equal(ServerToClientEvent.ExcavationStarted, "excavation:started")
    assert.equal(ServerToClientEvent.ExcavationRejected, "excavation:rejected")
    assert.equal(ServerToClientEvent.ExcavationUpdate, "excavation:update")
    assert.equal(ServerToClientEvent.InventoryUpdate, "inventory:update")
    assert.equal(ClientToServerEvent.SessionPing, "session:ping")
    assert.equal(ClientToServerEvent.WorldJoin, "world:join")
    assert.equal(ClientToServerEvent.WorldChunkRequest, "world:chunkRequest")
    assert.equal(ClientToServerEvent.PlayerInput, "player:input")
    assert.equal(ClientToServerEvent.PlayerScan, "player:scan")
    assert.equal(ClientToServerEvent.ExcavationStart, "excavation:start")
    assert.equal(ClientToServerEvent.ExcavationHit, "excavation:hit")
  })
})
