# Real-Time Collaborative Canvas

A simple web app where multiple users can draw together in real-time.

---

## Quick Start

### Prerequisites
- Node.js (v14+)
- npm or yarn
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd realtimecanva
   ```

2. **Install backend dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```
   Server runs on `http://localhost:3000`

---

## How to Use

### Create a Room
1. Go to landing page
2. Enter your name
3. Enter room name
4. Click "Create Room"
5. Share the room ID with friends

### Join a Room
1. Go to landing page
2. Enter your name
3. Enter the room ID
4. Click "Join Room"
5. Start drawing together!

### Drawing
- **Brush**: Draw freehand
- **Eraser**: Remove drawings
- **Line**: Draw straight lines
- **Color**: Choose any color
- **Size**: Adjust brush size
- **Undo/Redo**: Ctrl+Z / Ctrl+Y
- **Clear**: Clear entire canvas

---

## Features

✅ Real-time collaboration (multiple users)  
✅ Multiple drawing tools (brush, eraser, line)  
✅ Color picker  
✅ Adjustable brush size  
✅ Undo/Redo functionality  
✅ See other users' cursors  
✅ Auto-save drawing history  
✅ Room-based organization  

---

## Project Structure

```
realtimecanva/
├── server/
│   ├── server.js          # Express + Socket.IO server
│   ├── package.json       # Backend dependencies
│   └── README.md
│
└── project/
    ├── index.html         # Landing page
    ├── canvas.html        # Drawing interface
    ├── main.js            # Room creation/joining logic
    ├── canvas.js          # Drawing engine
    ├── websocket.js       # WebSocket connection
    ├── style.css          # Landing page styles
    ├── canvas-style.css   # Canvas page styles
    └── README.md
```

---

## Technology Stack

- **Frontend**: HTML5 Canvas, Vanilla JavaScript, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO Server
- **Communication**: WebSocket

---

## Key Workflows

### 1. Room Creation
```
User enters name and room name
→ System generates room ID
→ Creates room on server
→ Redirects to canvas page
→ Canvas is ready to draw
```

### 2. Drawing Sync
```
User draws locally
→ Browser sends drawing event
→ Server stores in history
→ Server broadcasts to room
→ All users see drawing
```

### 3. Undo/Redo
```
User clicks undo
→ Request sent to server
→ Server removes the stroke
→ Broadcasts update to room
→ All users see undo
```

### 4. User Joins
```
New user enters room ID
→ Connects to server
→ Server sends drawing history
→ All previous drawings appear
→ User can start drawing
```

---

## Data Structures

### Room Object
```javascript
{
  roomId: "ABC123DEF456",
  roomName: "My Room",
  users: [
    { id, name, color, x, y }
  ],
  drawingHistory: [
    { fromX, fromY, toX, toY, color, width, tool }
  ]
}
```

### Drawing Event
```javascript
{
  fromX: 100,
  fromY: 50,
  toX: 150,
  toY: 75,
  color: "#FF0000",
  width: 3,
  tool: "brush"
}
```

---

## WebSocket Events

### Client Sends
- `join-room`: Join a room
- `draw`: Send drawing data
- `draw-line`: Send line stroke
- `cursor-move`: Send cursor position
- `undo`: Request undo
- `redo`: Request redo
- `clear-canvas`: Clear all drawings

### Server Sends
- `users-list`: List of users in room
- `user-joined`: New user joined
- `draw`: Remote user drawing
- `cursor-move`: Remote cursor position
- `drawing-history`: All previous drawings
- `undo`: Remote undo action
- `redo`: Remote redo action
- `user-left`: User disconnected

---

## Performance

- Canvas optimized with separate layers
- History limited to 50 states
- Drawing history capped at 1000 strokes
- Event throttling for cursor updates
- Auto cleanup on disconnect

---

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome | ✅ Yes |
| Firefox | ✅ Yes |
| Safari | ✅ Yes |
| Edge | ✅ Yes |
| Mobile | ✅ Yes (touch) |

---

## Troubleshooting

### Can't connect to server
- Make sure server is running on port 3000
- Check firewall settings
- Try refreshing the page

### Drawing not syncing
- Check internet connection
- Verify WebSocket connection in browser console
- Try rejoining the room

### Undo/Redo not working
- Make sure you're connected to server
- Try clicking undo multiple times
- Refresh page if stuck

### Room ID not working
- Room ID must be exactly 12 characters
- Room ID is case-sensitive
- Room must exist (check with creator)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl + Z | Undo |
| Ctrl + Y | Redo |
| Ctrl + L | Clear Canvas |

---

## Deployment

### Frontend (Vercel)
1. Push code to GitHub
2. Connect to Vercel
3. Set environment variable: `REACT_APP_SERVER_URL`
4. Deploy

### Backend (Render)
1. Push to GitHub
2. Connect platform to repo
3. Set PORT environment variable
4. Deploy

---

## Security

- Input validation on both sides
- CORS protection enabled
- Room capacity enforcement
- No sensitive data stored
- Graceful error handling

---

## Future Features

- User authentication
- Save drawings to database
- Share drawings
- Text tool
- Shapes
- Zoom and pan
- Video chat
- User permissions

---

## Time spent
- 2.5 days
