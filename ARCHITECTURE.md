# Architecture

Real-time collaborative drawing using **Socket.IO**, **HTML5 Canvas**, **Node.js**, and **Express**.

---

## System Overview

```
Frontend (Client)          Backend (Server)
├─ Canvas (2 layers)      ├─ Express HTTP
├─ WebSocket Manager      ├─ Socket.IO Server
└─ UI Controls            └─ Rooms Map
       ↕ WebSocket ↕
```

---

## Data Flow Diagram

### Drawing Event Journey

```
1. User draws mouse move
   ↓
2. Local canvas drawn immediately (canvas.js)
   ↓
3. collectStroke data {fromX, fromY, toX, toY, color, width, tool, strokeId}
   ↓
4. wsManager.sendDraw() emits to server
   ↓
5. Server: socket.on('draw') stores in room.drawingHistory
   ↓
6. Server: socket.to(room).emit('draw') broadcasts to others
   ↓
7. Other clients: remoteCtx draws on remote canvas layer
   ↓
8. All users see identical drawing
```

**Stroke Structure**:
```javascript
{
  fromX, fromY, toX, toY,      // Coordinates
  color, width, tool,           // Style (brush|eraser|line)
  userId, strokeId,             // Identification
  timestamp                      // Server timestamp
}
```

---

## WebSocket Protocol

### Client → Server Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `join-room` | {roomId, roomName, userName, userColor, capacity, isHost} | Join room |
| `draw` | {fromX, fromY, toX, toY, color, width, tool, strokeId} | Send stroke |
| `draw-line` | {fromX, fromY, toX, toY, color, width, tool, strokeId} | Send shape |
| `clear-canvas` | {} | Clear all |
| `cursor-move` | {x, y} | Update cursor |
| `undo` | {} | Request undo |
| `redo` | {} | Request redo |

### Server → Client Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `users-list` | {users: [{id, name, color}]} | Initial users |
| `draw` | {userId, userName, ...stroke} | Broadcast draw |
| `drawing-history` | {history: [...]} | Send history |
| `full-history-update` | {history: [...]} | Update after undo/redo/clear |
| `user-joined` | {userId, userName, userColor} | User joined |
| `user-left` | {userId, users} | User left |
| `cursor-move` | {userId, userName, userColor, x, y} | Remote cursor |

---

## Undo/Redo Strategy

### Implementation

Each drawing stroke gets unique `strokeId`:
```javascript
currentStrokeId = `s-${Date.now()}-${Math.random() * 100000}`;
```

**Server-side storage**:
```javascript
room = {
  drawingHistory: [...all strokes],        // Shared state
  userRedoStacks: Map<userId, [...groups]> // Per-user redo stacks
}
```

### How It Works

1. **User draws** → All pixels tagged with same strokeId
2. **Click undo** → Server finds last strokeId for this user
3. **Remove stroke** → All drawingHistory entries with that strokeId removed
4. **Store for redo** → Removed strokes pushed to userRedoStack
5. **Broadcast** → `full-history-update` sent to ALL users
6. **All clients rebuild** → Canvas redrawn from updated history

### Why This Works

✅ **Atomic** - Entire stroke removed at once  
✅ **User-scoped** - Only user's own strokes affected  
✅ **Global sync** - `full-history-update` keeps all clients consistent  
✅ **Per-user redo** - User A's undo doesn't affect User B's redo stack  
✅ **Reversible** - Redo restores exact stroke group

---

## Performance Decisions

| Decision | Implementation | Benefit |
|----------|------------------|---------|
| **2-layer canvas** | Local (own) + Remote (others) | No conflicts, clear layers |
| **Send all draws** | Every mousemove event → stroke | Smooth drawing |
| **History limit** | Max 1000 strokes/room | Controlled server memory |
| **Socket.IO** | WebSocket + HTTP polling | Real-time + network compatible |
| **In-memory** | rooms = new Map() | Sub-ms latency |
| **Broadcast only room** | socket.to(roomId).emit() | Scalable to many rooms |
| **Full history update** | Send entire history on changes | Consistency guaranteed |
| **User redo isolation** | Per-user redo stacks | No conflicts between users |

---

## Conflict Resolution

### Problem: Simultaneous Drawing

```
User A draws: (100, 50) at T1
User B draws: (200, 100) at T2
Both send within 10ms
→ What order should they appear?
```

### Solution: Server Timestamp + Full History

Server adds `timestamp: Date.now()` to each stroke:

```javascript
socket.on('draw', (data) => {
  const stroke = {
    ...data,
    userId: socket.id,
    timestamp: Date.now()
  };
  room.drawingHistory.push(stroke);
  socket.to(roomId).emit('draw', stroke);
});
```

### How Conflicts Don't Occur

1. **Server decides order** - drawingHistory array is ordered
2. **Broadcast to all** - `socket.to(room)` sends to others
3. **Replay from history** - On join, `drawing-history` replays all strokes
4. **Full updates** - On undo/clear, `full-history-update` resyncs everyone

### Simultaneous Undo/Redo

```
User A undoes while User B draws

→ Server removes A's strokes from drawingHistory
→ Broadcasts full-history-update
→ User B's strokes remain (different userId)
→ All clients rebuild canvas from same history
→ Consistent state maintained
```

### No Conflicts Guaranteed By

✅ Single server-side history array (source of truth)  
✅ Chronological ordering by server timestamp  
✅ Full history broadcasts keep clients synchronized  
✅ Each stroke has unique userId + strokeId combination  

---

## Room Management

**Server stores**:
```javascript
rooms = Map<roomId, {
  roomId, roomName, capacity,
  users: Map<socketId, {id, name, color, x, y}>,
  drawingHistory: [...strokes],
  userRedoStacks: Map<userId, [...groups]>
}>
```

**Room lifecycle**:
- Host creates room → `createRoom()` adds to rooms Map
- User joins → `addUserToRoom()` adds to users Map + sends history
- Last user leaves → `removeUserFromRoom()` deletes entire room

---

## Summary

| Aspect | How It Works |
|--------|--------------|
| Data Flow | User → Local Draw → Send → Server → Broadcast → Remote Draw → All See |
| Sync | Full history sent on join, updated on any change |
| Undo/Redo | Server-side per-user redo stacks, broadcasts full history |
| Conflicts | Server timestamp ordering + full history broadcasts |
| Layers | Local canvas (own) + Remote canvas (others) |
| Scalability | In-memory per-room data, socket.to(room) broadcasts |

---

**Architecture covers all drawing events, WebSocket protocol, undo/redo strategy, performance, and conflict resolution.** 
