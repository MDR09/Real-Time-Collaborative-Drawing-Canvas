# ARCHITECTURE.md - Real-Time Collaborative Canvas System Design

## Complete System Architecture Documentation
## ⚙️ Overview
A real-time collaborative drawing app using **HTML5 Canvas**, **Vanilla JS**, **Node.js**, **Express**, and **WebSocket**.

```
Frontend (HTML, CSS, JS)
    ↕  WebSocket (WebSocket)
Backend (Node.js + Express + WebSocket)
```

## 📊 Component Architecture

### Frontend Components

#### 1. Landing Page Module
```
main.js (Landing Logic)
├─ generateRoomId()        → Generate 12-char random ID
├─ switchMode()            → Toggle Create/Join
├─ createRoom()            → Create new room
├─ joinRoom()              → Join existing room
└─ Validation & UI Updates
```

**Responsibilities:**
- Handle room creation flow
- Validate user inputs
- Store session data in localStorage
- Redirect to canvas page

#### 2. Canvas Module
```
canvas.js (Drawing Logic)
├─ Drawing Layer
│  ├─ selectTool()         → Switch tools (brush/eraser/line)
│  ├─ startDrawing()       → Begin drawing action
│  ├─ handleMouseMove()    → Draw as user moves mouse
│  ├─ stopDrawing()        → End drawing action
│  └─ drawLine()           → Draw line primitives
│
├─ History Layer
│  ├─ saveHistory()        → Save canvas state
│  ├─ undoAction()         → Undo last action
│  ├─ redoAction()         → Redo last undone action
│  └─ redrawCanvas()       → Redraw from history
│
└─ UI Control
   ├─ changeColor()        → Update color picker
   ├─ changeStrokeWidth()  → Update brush size
   ├─ clearCanvas()        → Clear entire canvas
   └─ downloadCanvas()     → Export as PNG
```

**Responsibilities:**
- Handle all drawing interactions
- Manage canvas state
- Provide undo/redo functionality
- Update UI elements

#### 3. WebSocket Module
```
websocket.js (Connection Manager)
├─ WebSocketManager Class
│  ├─ connect()            → Connect to server
│  ├─ loadSocketIO()       → Load Socket.IO library
│  ├─ setupListeners()     → Register event handlers
│  ├─ joinRoom()           → Emit join-room event
│  ├─ sendDraw()           → Send drawing data
│  ├─ sendCursorMove()     → Send cursor position
│  └─ disconnect()         → Close connection
│
└─ Callback System
   ├─ on()                 → Register event callback
   └─ emit()               → Trigger callbacks
```

**Responsibilities:**
- Manage WebSocket connection
- Handle Socket.IO library loading
- Implement event callback system
- Provide send methods for all event types

---

### Backend Components

#### Server (server.js)

```
Express Server Setup
├─ Middleware
│  ├─ CORS Support
│  └─ Static Files
│
├─ HTTP Routes
│  ├─ GET /              → Serve landing page
│  ├─ GET /canvas        → Serve canvas page
│  ├─ GET /health        → Health check endpoint
│  └─ GET /stats         → Server statistics
│
└─ Socket.IO Server
   ├─ Connection Handler
   │  └─ io.on('connection', socket => {...})
   │
   ├─ Room Management
   │  ├─ rooms = new Map()
   │  ├─ createRoom()
   │  ├─ addUserToRoom()
   │  ├─ removeUserFromRoom()
   │  └─ getRoomUsers()
   │
   ├─ Event Handlers
   │  ├─ 'join-room'         → Add user to room
   │  ├─ 'draw'              → Broadcast drawing
   │  ├─ 'draw-line'         → Broadcast line
   │  ├─ 'clear-canvas'      → Broadcast clear
   │  ├─ 'cursor-move'       → Broadcast cursor
   │  ├─ 'undo'              → Broadcast undo
   │  ├─ 'redo'              → Broadcast redo
   │  └─ 'disconnect'        → Remove user
   │
   └─ Broadcast System
      ├─ socket.to(room).emit()   → Send to room
      ├─ io.to(room).emit()       → Send to all in room
      └─ socket.emit()            → Send to user only
```

---

## 🔄 Data Flow Architecture

### 1. Room Creation Flow
```
User Input (Landing Page)
    ↓
main.js: createRoom()
    ↓
Generate Room ID (12 chars)
    ↓
Store in localStorage
    ↓
Redirect to canvas.html
    ↓
canvas.js: initCanvas()
    ↓
connectWebSocket()
    ↓
websocket.js: connect()
    ↓
Load Socket.IO library
    ↓
Join room with isHost=true
    ↓
server.js: 'join-room' event
    ↓
createRoom() (server-side)
    ↓
addUserToRoom()
    ↓
Send 'users-list' to user
    ↓
Canvas Ready
```

### 2. Drawing Synchronization Flow
```
User Draws on Canvas
    ↓
canvas.js: handleMouseMove()
    ↓
drawLine() (local canvas)
    ↓
websocket.js: sendDraw()
    ↓
emit 'draw' event with data
    ↓
server.js receives 'draw'
    ↓
Store in drawingHistory
    ↓
socket.to(room).emit('draw')
    ↓
canvas.js: setupWebSocketListeners()
    ↓
wsManager.on('remote-draw')
    ↓
drawLineRemote() (remote canvas)
    ↓
All users see drawing
```

### 3. Cursor Tracking Flow
```
User Moves Mouse
    ↓
canvas.js: handleMouseMove()
    ↓
Update position display
    ↓
websocket.js: sendCursorMove(x, y)
    ↓
emit 'cursor-move' event
    ↓
server.js receives 'cursor-move'
    ↓
Update user.x and user.y
    ↓
socket.to(room).emit('cursor-move')
    ↓
canvas.js: wsManager.on('remote-cursor-move')
    ↓
updateRemoteCursor()
    ↓
Create/Update cursor indicator
    ↓
Show cursor with user name
```

### 4. History & Sync Flow
```
User A Creates Room
    ↓
Draws Circle
    ↓
Server stores in drawingHistory
    ↓
User B Joins Room
    ↓
server.js: 'join-room' event
    ↓
Send 'drawing-history' event
    ↓
canvas.js: wsManager.on('drawing-history')
    ↓
Replay all strokes on remoteCtx
    ↓
Canvas shows all previous drawings
```

---

