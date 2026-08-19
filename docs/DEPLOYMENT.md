# Synced Notepad — Deployment Guide

**Version:** 0.1
**Status:** Draft

---

## 1. Deployment Architecture

Initial deployment:

```text
                 Internet
                    │
              Reverse Proxy
                    │
          ┌─────────┴─────────┐
          │                   │
       Next.js             Node.js
          │                   │
          │                MongoDB
          │
       Static/Web
```

The reverse proxy serves as the single entry point for all client traffic. Next.js handles static assets and the web application. The Node.js server handles the synchronization API and WebSocket connections. MongoDB provides durable storage for all workspace data.

For production, HTTPS must terminate at the reverse proxy/load balancer.

---

## 2. Production Requirements

### HTTPS

Production deployments must use HTTPS. The TLS certificate should be terminated at the reverse proxy or load balancer, not at the application servers.

Internal traffic between the reverse proxy and the application servers can use plain HTTP when running within a trusted network.

---

## 3. Scaling Strategy

The architecture should allow horizontal scaling behind a load balancer:

```text
             Load Balancer
              /    |    \
             /     |     \
        Node 1   Node 2   Node 3
             \     |     /
                MongoDB
```

This is possible because synchronization state is stored durably in MongoDB rather than only in server memory. Any node instance can serve any client request.

---

## 4. WebSocket Scaling

When multiple backend instances are used, WebSocket events need a shared event mechanism.

### Redis Pub/Sub

```text
Node 1 receives change
       ↓
Redis event
       ↓
Node 2
       ↓
WebSocket client
```

When a change arrives at Node 1, it publishes the event to Redis. All other nodes subscribed to Redis receive the event and can forward it to their connected WebSocket clients.

This is not required for the first local development version but should be factored into the architecture from the start.

---

## 5. MongoDB Scaling

MongoDB should initially be deployed as a normal replica set or managed cluster appropriate to the environment.

Do not prematurely introduce sharding.

Sharding should only be considered when real workload requires it. Premature sharding adds operational complexity without providing measurable benefit at low scale.

---

## 6. Protocol Versioning

Each client identifies itself with two version fields:

```json
{
  "appVersion": "1.4.0",
  "syncProtocolVersion": 1
}
```

- `appVersion` — The semantic version of the installed application.
- `syncProtocolVersion` — An integer that increments only when the wire protocol changes in a backward-incompatible way.

Never assume all installed clients are running the latest version. The server must support older protocol versions for a reasonable deprecation window.

---

## 7. Protocol Compatibility

The server should be able to reject unsupported protocol versions cleanly.

When a client connects with a protocol version the server does not support, it responds with:

```text
SYNC_PROTOCOL_UNSUPPORTED
```

The client should show:

```text
Please update the app to continue syncing.
```

---

## 8. Observability

The server should track:

```text
sync requests
sync failures
average sync duration
conflict count
pairing attempts
device revocations
WebSocket connections
```

Do not log note content. Content is private to the user and should never appear in logs, metrics, or error reports.

---

## 9. Metrics

Useful metrics for monitoring and alerting:

```text
sync.success
sync.failure
sync.conflict
sync.duration
sync.batch_size

pairing.started
pairing.success
pairing.failure

device.revoked

websocket.connected
websocket.disconnected
```

These metrics enable operational visibility into sync reliability, pairing health, and connection stability.

---

## 10. Health Checks

Server should expose:

```text
GET /health
```

Returns 200 when the process is running and able to accept requests.

Optionally expose:

```text
GET /ready
```

Readiness can verify required dependencies such as MongoDB connectivity. A readiness check returning non-200 signals the load balancer to stop routing traffic to this instance.

---

## 11. Graceful Server Shutdown

When the server shuts down, it should follow this sequence:

```text
stop accepting new requests
 ↓
finish active transactions
 ↓
close WebSocket connections
 ↓
close MongoDB connection
 ↓
exit
```

Clients should automatically reconnect. The shutdown sequence ensures no in-flight sync operations are silently dropped and no database connections are left dangling.

---

## 12. Performance Priorities

Prioritize in this order:

```text
1. Correctness
2. Data durability
3. Security
4. Sync reliability
5. User experience
6. Performance optimization
```

A fast sync engine that occasionally loses notes is unacceptable.
