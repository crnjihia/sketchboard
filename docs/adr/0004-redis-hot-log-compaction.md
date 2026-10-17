# ADR 0004: Redis Hot Update Log and PostgreSQL Snapshot Compaction

## Status
Accepted

## Context
High-frequency collaborative drawing generates rapid bursts of small Yjs binary updates (often 20–60 updates/second per board). Writing each individual update directly to PostgreSQL creates excessive IOPS, disk write amplification, and latency spikes. Conversely, keeping updates purely in memory risks data loss if a server pod restarts or crashes.

## Decision
Implement a tiered persistence and compaction model:
1. **Hot Ingestion (Redis List)**:
   - Key: `sketchboard:board:<boardId>:updates`
   - Every valid `sync:update` is appended to the Redis list (`RPUSH`) in constant time O(1).
   - Redis adapter relays the update across Socket.io cluster nodes.
2. **Periodic Compaction (PostgreSQL)**:
   - Thresholds: When the hot update log reaches $N$ updates (e.g. 50 updates) or $M$ KB (512 KB), or when the last client disconnects from the board.
   - Compaction: A server acquires a distributed lock (`sketchboard:lock:compact:<boardId>`) using Redis `SET ... PX NX` to prevent multi-node stampedes.
   - The doc state is compressed into a single binary update via `Y.encodeStateAsUpdate(doc)`.
   - The snapshot is upserted into PostgreSQL (`boards` table `snapshot` column).
   - The Redis hot update log is trimmed (`DEL` or `LTRIM`).
3. **Hydration on Join / Node Restart**:
   - When a node creates or loads a board session, it first reads the base snapshot from PostgreSQL, then replays any remaining uncompacted updates from Redis.
   - Clients joining any node always receive the converged state.

## Consequences
- Protects PostgreSQL from high-frequency write storms.
- Guarantees zero edit loss on unexpected node restarts.
- Compaction keeps document loading time and memory footprint minimal.
