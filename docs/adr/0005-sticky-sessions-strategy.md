# ADR 0005: Sticky Session Strategy for Socket.io and WebSocket Upgrade

## Status
Accepted

## Context
Socket.io supports two primary transport mechanisms:
1. Pure WebSockets (bidirectional full-duplex TCP stream over HTTP/1.1 or HTTP/2).
2. HTTP Long-Polling (HTTP GET/POST request pairs used when corporate firewalls, mobile proxies, or legacy networks block WebSocket upgrades).

In a multi-replica cluster behind a load balancer (such as NGINX or Kubernetes Ingress), routing decisions impact each transport differently:
- **For WebSockets**: Once established, a WebSocket connection remains pinned to a single server process for its lifetime. Cross-node synchronization is handled transparently via `@socket.io/redis-adapter` Pub/Sub channels. If a client disconnects and reconnects to a different pod, the Yjs state vector handshake (`sync:step1` / `sync:step2`) guarantees complete reconciliation. Therefore, pure WebSockets would survive even without session stickiness.
- **For HTTP Long-Polling**: Each long-poll cycle consists of consecutive HTTP requests (a `GET` request waiting for events, followed by a `POST` request sending updates). If request A hits `server-1` and request B hits `server-2`, `server-2` rejects the request with an unknown `sid` (session ID) error (`400 Bad Request / Session ID unknown`), causing severe connection flap and thrashing.

## Decision
Mandate **Session Stickiness** at the load balancer / ingress layer:
1. **Local Docker Compose**:
   - NGINX upstream uses `ip_hash;`.
   - All requests from a client IP consistently hash to the same backend server replica (`server-1` or `server-2`).
2. **Kubernetes Ingress (NGINX Ingress Controller)**:
   - Configure cookie-based session affinity:
     - `nginx.ingress.kubernetes.io/affinity: "cookie"`
     - `nginx.ingress.kubernetes.io/session-cookie-name: "SKETCHBOARD_AFFINITY"`
     - `nginx.ingress.kubernetes.io/session-cookie-max-age: "86400"`
     - `nginx.ingress.kubernetes.io/session-cookie-samesite: "Lax"`
3. **Resilience & Failover**:
   - If a server replica crashes or restarts, the load balancer reroutes traffic to the surviving replica.
   - The client seamlessly upgrades to a new session, sends its Yjs state vector, and receives any missing updates via Redis and PostgreSQL.

## Consequences
- Guaranteed stability across all mobile and proxy environments, even when long-polling fallback is active.
- Transparent failover with zero state corruption.
- Smooth distribution across pods while maintaining session consistency.
