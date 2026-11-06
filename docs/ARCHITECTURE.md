# Sketchboard Architecture Deep-Dive

This document details the architectural design, internal data structures, and distributed communication mechanisms powering **Sketchboard**.

---

## 1. System Topology Overview

Sketchboard is designed as a distributed, high-concurrency real-time canvas engine operating over heterogeneous networks.

```mermaid
graph TD
    subgraph Edge ["Client Layer (Browsers & Tablets)"]
        Client1["Client A (Nairobi)\nHTML5 Dual-Layer Canvas Engine\nLocal Y.Doc + Optimistic Outbox"]
        Client2["Client B (Mombasa)\nHTML5 Dual-Layer Canvas Engine\nLocal Y.Doc + Optimistic Outbox"]
    end

    subgraph LoadBalancer ["Ingress & Routing Tier"]
        NGINX["NGINX Load Balancer / K8s Ingress\nSticky: ip_hash / Session Cookie\nWebSocket Upgrade & Timeout = 3600s"]
    end

    subgraph ApplicationCluster ["Stateless Application Cluster (sketchboard namespace)"]
        Server1["Server Replica 1 (Node.js 22)\nSocket.io + In-Memory Session Cache\nRate Limiter + Prometheus /metrics"]
        Server2["Server Replica 2 (Node.js 22)\nSocket.io + In-Memory Session Cache\nRate Limiter + Prometheus /metrics"]
    end

    subgraph MessagingTier ["Distributed Relay & Memory Tier"]
        RedisAdapter["Redis 7 Cluster\n@socket.io/redis-adapter Pub/Sub Relay"]
        HotLog["Redis Hot Update Log\nAppend-Only Stream per Board"]
    end

    subgraph PersistenceTier ["Compacted Storage Tier"]
        Postgres["PostgreSQL 16\nCompacted Binary Snapshots (boards table)"]
    end

    Client1 <-->|HTTP Long-Polling / WSS| NGINX
    Client2 <-->|HTTP Long-Polling / WSS| NGINX

    NGINX <-->|Pinned Session| Server1
    NGINX <-->|Pinned Session| Server2

    Server1 <-->|Pub/Sub Relay| RedisAdapter
    Server2 <-->|Pub/Sub Relay| RedisAdapter

    Server1 -->|appendHotUpdate()| HotLog
    Server2 -->|appendHotUpdate()| HotLog

    Server1 -.->|Distributed Lock Compaction| Postgres
    Server2 -.->|Distributed Lock Compaction| Postgres
```

---

## 2. Document Data Model & CRDT Semantics

Sketchboard uses **Yjs** as its core Conflict-free Replicated Data Type engine. Each canvas board is encapsulated in a single `Y.Doc`.

### Granular Property-Level Y.Maps
Traditional collaborative applications frequently model objects as coarse-grained JSON objects. In Sketchboard, each object is a nested `Y.Map<string, any>`:

```
Y.Doc ("nairobi-hq")
├── objects: Y.Map<string, Y.Map<string, any>>
│   ├── "card-1": Y.Map {
│   │     id: "card-1",
│   │     type: "rectangle",
│   │     x: 140,
│   │     y: 180,
│   │     w: 230,
│   │     h: 110,
│   │     rotation: 0,
│   │     style: { fill: "#1E293B", stroke: "#3B82F6", strokeWidth: 2 }
│   │   }
└── zOrder: Y.Array<string> ["card-1", "card-2", "sticky-1"]
```

### Conflict Resolution Invariants:
1. **Property Isolation**: If User A mutates `x`/`y` while User B updates `style.fill`, both operations succeed with zero data clobbering.
2. **Concurrent Property Collision**: If both users drag the same shape concurrently, Yjs deterministically resolves the winner using the higher client clock and peer ID.
3. **Z-Order Ordering**: Layer reordering operates on an atomic `Y.Array<string>`. Layer insertions and deletions converge without index drift.

---

## 3. Dual-Layer Canvas Engine

The web frontend strictly avoids heavyweight canvas libraries (Fabric.js, Konva, Pixi.js) in favor of the standard browser Canvas 2D API.

```mermaid
graph TD
    subgraph CanvasContainer ["DOM Viewport Container"]
        SceneCanvas["Scene Canvas (Bottom Layer)\nStatic Canvas Objects\nRedrawn strictly on Yjs doc mutations"]
        OverlayCanvas["Overlay Canvas (Top Layer)\nSelection Bounding Boxes & Resize Handles\nMarquee Box & Live Remote Cursors (60fps)"]
    end

    SpatialIndex["SpatialGrid Broadphase Index\nO(1) Viewport Culling (<1ms over 2,000 shapes)"]
    SceneCache["Plain-JS SceneCache\nUpdated via Y.Doc.observeDeep"]

    SceneCache --> SpatialIndex
    SpatialIndex --> SceneCanvas
```

### Why Dual Layers?
- Moving a remote cursor at 30fps would ordinarily trigger a 60fps full redraw of all 2,000 canvas objects.
- In Sketchboard, cursor interpolation and marquee selection are drawn onto the transparent **Overlay Canvas**, leaving the bottom **Scene Canvas** completely untouched until a document mutation actually occurs.

---

## 4. Multi-Node Replication & Compaction Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (Client A)
    participant S1 as Server Replica 1
    participant Redis as Redis Hot-Log & Pub/Sub
    participant PG as PostgreSQL (boards)
    participant S2 as Server Replica 2
    actor Bob as Bob (Client B)

    Alice->>S1: doc:update { boardId, update: [Uint8Array], clientSeq: 42 }
    S1->>S1: session.applyUpdate(update)
    S1->>Redis: RPUSH sketchboard:board:nairobi-hq:updates [update]
    S1->>Redis: PUBLISH sketchboard:pubsub:room:nairobi-hq [update]
    S1-->>Alice: doc:ack { clientSeq: 42, serverSeq: 18 }

    Redis->>S2: Relay via @socket.io/redis-adapter
    S2->>S2: session.applyUpdate(update)
    S2->>Bob: doc:update { boardId, update }

    Note over S1, PG: Snapshot Compaction Threshold Triggered (> 50 updates)
    S1->>Redis: SET compaction:lock:nairobi-hq NX EX 15
    alt Lock Acquired
        S1->>S1: snapshot = Y.encodeStateAsUpdate(session.doc)
        S1->>PG: INSERT INTO boards (id, snapshot) VALUES (...) ON CONFLICT UPDATE
        S1->>Redis: LTRIM sketchboard:board:nairobi-hq:updates
        S1->>Redis: DEL compaction:lock:nairobi-hq
    else Lock Held by Another Node
        S1->>S1: Skip compaction (handled by peer)
    end
```

---

## 5. Network Protocol Specifications

| Event | Direction | Payload | Semantics |
| :--- | :--- | :--- | :--- |
| `board:join` | Client &rarr; Server | `{ boardId, userId, userName }` | Joins board room and returns `nodeId` |
| `sync:step1` | Client &rarr; Server | `{ boardId, stateVector }` | Initiates Yjs state vector synchronization |
| `sync:step2` | Server &rarr; Client | `{ boardId, update }` | Returns binary delta missing on client |
| `doc:update` | Client &harr; Server | `{ boardId, update, clientSeq }` | Transmits local optimistic binary mutations |
| `doc:ack` | Server &rarr; Client | `{ clientSeq, serverSeq }` | Acknowledges receipt of client sequence |
| `cursor:move`| Client &rarr; Server | `{ boardId, userId, x, y }` | World-coordinate ephemeral cursor position |
| `cursor:remote`| Server &rarr; Client | `{ userId, userName, userColor, x, y }` | Volatile broadcast to other squad members |

---

## 6. Kenyan FinTech & Mobile Notification Subsystem

To address real-world workflows in Nairobi's technology ecosystem, Sketchboard incorporates native mobile money billing (**Safaricom Lipa Na M-Pesa**) and cellular SMS alerts (**Africa's Talking**). Both subsystems operate with zero-credential in-memory mock adapters by default, switching transparently to production gateways in live environments.

### Safaricom Lipa Na M-Pesa STK Push Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Browser)
    participant Web as React Web App
    participant Server as Sketchboard Server
    participant Ledger as Payment Ledger (PG/Memory)
    participant Daraja as Safaricom Daraja / Mock Adapter
    actor Phone as User Mobile Handset

    User->>Web: Select Plan & Enter Phone (0712345678)
    Web->>Server: POST /api/payments/mpesa/stkpush { boardId, phone, planId: "pro" }
    Server->>Server: Validate MSISDN & CBK limit (KES 150)
    Server->>Daraja: initiateStkPush({ phone: 254712345678, amount: 150 })
    Daraja->>Phone: Prompt SIM Menu (Enter M-Pesa PIN)
    Daraja-->>Server: Return { CheckoutRequestID: "ws_CO_..." }
    Server->>Ledger: recordCheckout({ checkoutRequestId, boardId, planId, amount, status: 'PENDING' })
    Server-->>Web: Return { checkoutRequestId, customerMessage }

    loop Poll Status Every 2.5s (or await webhook)
        Web->>Server: GET /api/payments/mpesa/status/ws_CO_...
        Server-->>Web: Status { status: 'PENDING' }
    end

    User->>Phone: Enter M-Pesa PIN & Submit
    Phone->>Daraja: Authorize transaction
    Daraja->>Server: POST /api/payments/mpesa/callback (Webhook payload)
    Server->>Server: parseMpesaCallback(payload) -> NLX4891234, ResultCode: 0
    Server->>Ledger: completePayment(checkoutRequestId, receiptNumber)
    Server->>Ledger: upgradeBoardPlan(boardId, planId: "pro")
    
    Web->>Server: GET /api/payments/mpesa/status/ws_CO_...
    Server-->>Web: Status { status: 'COMPLETED', receiptNumber: "NLX4891234" }
    Web-->>User: Display Bilingual Success Modal & Active Plan Badge
```

### Africa's Talking SMS Collaborator Invites

Collaborator invitations and billing receipts can be dispatched directly to Kenyan mobile devices in E.164 format:

```mermaid
graph LR
    SquadLead["Squad Lead\n(Nairobi HQ)"] -->|Invite Collaborator| WebUI["Web UI Modal\n(Phone: 0722000000)"]
    WebUI -->|POST /api/notifications/sms/invite| ServerAPI["Express Server API\n(Normalizes to +254722000000)"]
    ServerAPI -->|Format SMS Message| ATClient["Africa's Talking Adapter\n(Mock or Production Gateway)"]
    ATClient -->|Cellular Network Dispatch| Telco["Safaricom / Airtel Base Station"]
    Telco -->|SMS Delivery| Collaborator["Collaborator Handset\n(Direct Link to Board)"]
```

### Payment & Notification REST API Routes

| Endpoint | Method | Payload / Params | Response | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/api/payments/mpesa/stkpush` | `POST` | `{ boardId, phone, planId, callbackUrl? }` | `{ success: true, checkoutRequestId }` | Initiates Lipa Na M-Pesa STK Push |
| `/api/payments/mpesa/status/:id` | `GET` | `:id` (CheckoutRequestID) | `{ status, receiptNumber?, failureReason? }` | Polls transaction completion status |
| `/api/payments/mpesa/callback` | `POST` | Safaricom `stkCallback` JSON | `{ ResultCode: 0, ResultDesc: "Accepted" }` | Webhook receiver for transaction confirmation |
| `/api/payments/mpesa/mock-simulate` | `POST` | `{ checkoutRequestId, action: "success" \| "cancel" }` | `{ success: true, status }` | Dev-only handset simulation trigger |
| `/api/payments/mpesa/plan/:boardId` | `GET` | `:boardId` | `{ boardId, planId, maxShapes, active }` | Retrieves active workspace plan limits |
| `/api/notifications/sms/send` | `POST` | `{ to, message }` | `{ success: true, recipients: [...] }` | Sends arbitrary SMS via Africa's Talking |
| `/api/notifications/sms/invite` | `POST` | `{ boardId, phone, inviterName }` | `{ success: true, messageId }` | Sends board join invite link to phone |
| `/api/notifications/sms/outbox` | `GET` | _None_ | `Array<{ id, to, message, timestamp }>` | Inspects synthetic outbox in mock mode |

