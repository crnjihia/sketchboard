# ADR 0002: Yjs Transport over Socket.io vs y-websocket

## Status
Accepted

## Context
Standard Yjs setups often default to `y-websocket`. However:
1. Production web apps need unified connection management, authentication, presence, heartbeats, and metrics. Running `y-websocket` alongside Socket.io forces two separate WebSocket connections per browser tab.
2. Two connection endpoints require two distinct load balancer configs, two sets of TLS terminations, two sticky session configurations, and two horizontal scaling infrastructures.
3. Socket.io provides native room management, built-in volatile messaging for ephemeral cursors, and production-tested Redis clustering adapters (`@socket.io/redis-adapter`).

## Decision
Carry Yjs binary updates directly over Socket.io binary events (`Uint8Array` / `Buffer`):
- `sync:step1`: State vector handshake from client.
- `sync:step2`: Targeted diff payload from server.
- `sync:update`: Incremental local edits sent by client with `clientSeq` tracking.
- `sync:ack`: Server confirmation of persistence/in-memory ingestion.
- `cursor:move`: High-frequency volatile broadcasts bypassing CRDT doc persistence.

## Consequences
- Single persistent connection per client: lower battery and memory overhead on mid-range mobile devices.
- Unified auth and rate limiting at the Socket.io handshake and event gateway.
- Outbox ACK pattern guarantees at-least-once delivery with Yjs update idempotency.
- Volatile emits allow fast cursor updates (~30fps) without buffering or backpressure.
