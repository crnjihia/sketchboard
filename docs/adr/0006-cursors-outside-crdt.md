# ADR 0006: Keeping Ephemeral Cursors and Presence Outside the CRDT

## Status
Accepted

## Context
In collaborative canvas tools, cursor movement and viewport coordinates are transmitted at 30–60 Hz per active user.
If cursor positions are embedded inside the CRDT document (`Y.Doc`):
1. **CRDT History Bloat**: Every micro-movement generates immutable CRDT operations with transaction metadata, timestamps, and origin vectors, ballooning document size from kilobytes to gigabytes within minutes.
2. **Storage Amplification**: Hot update logs and PostgreSQL snapshots would continuously write throwaway transient coordinates to disk.
3. **CPU Overhead**: Parsing and GCing thousands of cursor transactions wastes CPU cycles on mobile and low-power devices.

## Decision
Keep cursors and presence strictly **ephemeral and outside the CRDT**:
- High-frequency cursor streaming uses plain Socket.io **volatile events** (`socket.volatile.to(room).emit('cursor:move', ...)`). If a client experiences network congestion or packet drops, frames are safely dropped without buffering or backpressure.
- Zero cursor data is written to the Y.Doc, Redis hot update log, or PostgreSQL boards snapshot.
- Presence state (who is currently in the room) is tracked in Redis hashes (`sketchboard:board:<boardId>:presence`) with a 60-second TTL refreshed via socket heartbeats.

## Consequences
- The CRDT document remains lean, fast, and durable.
- Cursors feel buttery smooth and responsive without causing database or network bloat.
- Network disconnection immediately clears cursor indicators after an idle timeout.
