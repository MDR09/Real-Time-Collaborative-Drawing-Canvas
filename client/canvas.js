// Canvas references and context
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const remoteCanvas = document.getElementById('remoteCanvas');
const remoteCtx = remoteCanvas.getContext('2d');

// Canvas setup and auto-resize
function resizeCanvas() {
    const container = document.querySelector('.canvas-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    remoteCanvas.width = container.clientWidth;
    remoteCanvas.height = container.clientHeight;
    redrawCanvas();
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', resizeCanvas);

// Drawing state variables
let currentTool = 'brush';
let currentColor = '#000000';
let currentStrokeWidth = 3;
let isDrawing = false;
let startX = 0;
let startY = 0;

// History management for undo/redo
const history = [];
const redoStack = [];
const MAX_HISTORY = 50;

// Current stroke identifier for atomic undo/redo
let currentStrokeId = null;

// Current user information from localStorage
let currentUser = {
    name: localStorage.getItem('userName') || 'Anonymous',
    roomId: localStorage.getItem('roomId') || 'LOADING',
    isHost: localStorage.getItem('isHost') === 'true',
    color: generateUserColor()
};

// Map of remote users in the room
const remoteUsers = new Map();

function initCanvas() {
    console.log('Initializing canvas...');
    console.log('Current User:', currentUser);

    // Display user information in navbar
    const userNameDisplay = document.getElementById('userNameDisplay');
    const roomIdDisplay = document.getElementById('roomIdDisplay');

    if (userNameDisplay) {
        userNameDisplay.textContent = currentUser.name;
    } else {
        console.error('userNameDisplay element not found');
    }

    if (roomIdDisplay) {
        roomIdDisplay.textContent = currentUser.roomId;
    } else {
        console.error('roomIdDisplay element not found');
    }

    saveHistory();

    // Mouse event listeners for drawing
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch event listeners for mobile support
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);

    connectWebSocket();

    console.log(`Canvas initialized for ${currentUser.name} in room ${currentUser.roomId}`);
}

// Connect to WebSocket server and join room
async function connectWebSocket() {
    try {
        const SERVER_URL = 'https://real-time-collaborative-drawing-canvas-ni5j.onrender.com';
        await wsManager.connect(SERVER_URL);

        // Send room and user information
        wsManager.joinRoom({
            roomId: currentUser.roomId,
            roomName: localStorage.getItem('roomName') || 'Room',
            userName: currentUser.name,
            userColor: currentUser.color,
            capacity: localStorage.getItem('roomCapacity') || 5,
            isHost: currentUser.isHost
        });

        setupWebSocketListeners();

    } catch (error) {
        console.error('WebSocket connection failed:', error);
        document.getElementById('statusDisplay').textContent = 'Connection Failed';
        document.getElementById('statusDisplay').classList.add('error');
    }
}

// Setup WebSocket event listeners for real-time collaboration
function setupWebSocketListeners() {
    // Handle users list from server
    wsManager.on('users-list', (data) => {
        data.users.forEach(user => {
            if (user.id !== wsManager.socket.id) {
                addRemoteUser(user.id, user.name, user.color);
            }
        });
        updateUsersCount();
    });

    // Handle new user joining
    wsManager.on('user-joined', (data) => {
        console.log(`${data.userName} joined the room`);
        addRemoteUser(data.userId, data.userName, data.userColor);
        updateUsersCount();
    });

    // Handle user leaving
    wsManager.on('user-left', (data) => {
        console.log(`User left the room`);
        removeRemoteUser(data.userId);
        updateUsersCount();
    });

    // Handle remote drawing updates
    wsManager.on('remote-draw', (data) => {
        drawLineRemote(data.fromX, data.fromY, data.toX, data.toY, data.color, data.width, data.tool);
    });

    // Handle remote drawing lines and shapes
    wsManager.on('remote-draw-line', (data) => {
        drawLineRemote(data.fromX, data.fromY, data.toX, data.toY, data.color, data.width, data.tool);
    });

    wsManager.on('remote-clear-canvas', () => {
        console.log('Received remote clear-canvas');
        // Clear all drawing from both local and remote canvases
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        remoteCtx.clearRect(0, 0, remoteCanvas.width, remoteCanvas.height);
        history.length = 0;
        redoStack.length = 0;
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    });

    // Receive complete history update from server to sync all clients
    wsManager.on('full-history-update', (data) => {
        console.log('Full history update received');
        
        // Clear canvases and history
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        remoteCtx.clearRect(0, 0, remoteCanvas.width, remoteCanvas.height);
        
        history.length = 0;
        redoStack.length = 0;
        
        // Redraw all strokes from server history
        if (data.history && data.history.length > 0) {
            data.history.forEach((stroke, idx) => {
                if (stroke.tool === 'eraser') {
                    remoteCtx.clearRect(stroke.fromX - stroke.width / 2, stroke.fromY - stroke.width / 2, stroke.width, stroke.width);
                    remoteCtx.clearRect(stroke.toX - stroke.width / 2, stroke.toY - stroke.width / 2, stroke.width, stroke.width);
                } else if (stroke.tool === 'rectangle') {
                    remoteCtx.strokeStyle = stroke.color;
                    remoteCtx.lineWidth = stroke.width;
                    remoteCtx.strokeRect(stroke.fromX, stroke.fromY, stroke.toX - stroke.fromX, stroke.toY - stroke.fromY);
                } else if (stroke.tool === 'circle') {
                    const radius = Math.sqrt(Math.pow(stroke.toX - stroke.fromX, 2) + Math.pow(stroke.toY - stroke.fromY, 2));
                    remoteCtx.strokeStyle = stroke.color;
                    remoteCtx.lineWidth = stroke.width;
                    remoteCtx.beginPath();
                    remoteCtx.arc(stroke.fromX, stroke.fromY, radius, 0, 2 * Math.PI);
                    remoteCtx.stroke();
                } else {
                    remoteCtx.beginPath();
                    remoteCtx.moveTo(stroke.fromX, stroke.fromY);
                    remoteCtx.lineTo(stroke.toX, stroke.toY);
                    remoteCtx.strokeStyle = stroke.color;
                    remoteCtx.lineWidth = stroke.width;
                    remoteCtx.lineCap = 'round';
                    remoteCtx.lineJoin = 'round';
                    remoteCtx.stroke();
                    remoteCtx.closePath();
                }
                
                if (stroke.tool === 'eraser') {
                    ctx.clearRect(stroke.fromX - stroke.width / 2, stroke.fromY - stroke.width / 2, stroke.width, stroke.width);
                    ctx.clearRect(stroke.toX - stroke.width / 2, stroke.toY - stroke.width / 2, stroke.width, stroke.width);
                } else if (stroke.tool === 'rectangle') {
                    ctx.strokeStyle = stroke.color;
                    ctx.lineWidth = stroke.width;
                    ctx.strokeRect(stroke.fromX, stroke.fromY, stroke.toX - stroke.fromX, stroke.toY - stroke.fromY);
                } else if (stroke.tool === 'circle') {
                    const radius = Math.sqrt(Math.pow(stroke.toX - stroke.fromX, 2) + Math.pow(stroke.toY - stroke.fromY, 2));
                    ctx.strokeStyle = stroke.color;
                    ctx.lineWidth = stroke.width;
                    ctx.beginPath();
                    ctx.arc(stroke.fromX, stroke.fromY, radius, 0, 2 * Math.PI);
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.moveTo(stroke.fromX, stroke.fromY);
                    ctx.lineTo(stroke.toX, stroke.toY);
                    ctx.strokeStyle = stroke.color;
                    ctx.lineWidth = stroke.width;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.stroke();
                    ctx.closePath();
                }
            });
        }
        
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    });

    wsManager.on('drawing-history', (data) => {
        // Load initial drawing history when joining room
        data.history.forEach(stroke => {
            drawLineRemote(stroke.fromX, stroke.fromY, stroke.toX, stroke.toY, stroke.color, stroke.width, stroke.tool);
        });
    });

    // Handle remote user cursor movements
    wsManager.on('remote-cursor-move', (data) => {
        updateRemoteCursor(data.userId, data.x, data.y);
        if (remoteUsers.has(data.userId)) {
            remoteUsers.get(data.userId).x = data.x;
            remoteUsers.get(data.userId).y = data.y;
        }
    });

    // Handle room errors (e.g., room capacity exceeded)
    wsManager.on('room-error', (data) => {
        alert(data.message);
        window.location.href = 'index.html';
    });
}

// Drawing event handlers
function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    // Generate unique stroke ID for atomic undo/redo across all strokes
    currentStrokeId = `s-${Date.now()}-${Math.floor(Math.random()*100000)}`;

    if (currentTool === 'line') {
        saveHistory();
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update cursor position display
    document.getElementById('posDisplay').textContent = `${Math.round(x)}, ${Math.round(y)}`;

    // Broadcast cursor position to other users
    if (wsManager && wsManager.isSocketConnected()) {
        wsManager.sendCursorMove(x, y);
    }

    if (!isDrawing) return;

    // Handle brush drawing
    if (currentTool === 'brush') {
        drawLine(startX, startY, x, y, currentColor, currentStrokeWidth);

        if (wsManager && wsManager.isSocketConnected()) {
            wsManager.sendDraw({
                fromX: startX,
                fromY: startY,
                toX: x,
                toY: y,
                color: currentColor,
                width: currentStrokeWidth,
                tool: 'brush',
                strokeId: currentStrokeId
            });
        }

        startX = x;
        startY = y;
    } else if (currentTool === 'eraser') {
        // Handle eraser drawing
        erase(x, y, currentStrokeWidth);

        if (wsManager && wsManager.isSocketConnected()) {
            wsManager.sendDraw({
                fromX: startX,
                fromY: startY,
                toX: x,
                toY: y,
                color: 'transparent',
                width: currentStrokeWidth,
                tool: 'eraser',
                strokeId: currentStrokeId
            });
        }

        startX = x;
        startY = y;
    } else if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
        if (history.length > 0) {
            ctx.putImageData(history[history.length - 1], 0, 0);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        if (currentTool === 'line') {
            drawLine(startX, startY, x, y, currentColor, currentStrokeWidth);
        } else if (currentTool === 'rectangle') {
            drawRectangle(startX, startY, x, y, currentColor, currentStrokeWidth);
        } else if (currentTool === 'circle') {
            drawCircle(startX, startY, x, y, currentColor, currentStrokeWidth);
        }
    }
}

function handleTouchStart(e) {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    startX = touch.clientX - rect.left;
    startY = touch.clientY - rect.top;
    isDrawing = true;

    currentStrokeId = `s-${Date.now()}-${Math.floor(Math.random()*100000)}`;

    if (currentTool === 'line') {
        saveHistory();
    }
}

function handleTouchMove(e) {
    if (!isDrawing) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Handle touch-based brush drawing
    if (currentTool === 'brush') {
        drawLine(startX, startY, x, y, currentColor, currentStrokeWidth);
        if (wsManager && wsManager.isSocketConnected()) {
            wsManager.sendDraw({
                fromX: startX,
                fromY: startY,
                toX: x,
                toY: y,
                color: currentColor,
                width: currentStrokeWidth,
                tool: 'brush',
                strokeId: currentStrokeId
            });
        }
        startX = x;
        startY = y;
    } else if (currentTool === 'eraser') {
        // Handle touch-based eraser
        erase(x, y, currentStrokeWidth);
        if (wsManager && wsManager.isSocketConnected()) {
            wsManager.sendDraw({
                fromX: startX,
                fromY: startY,
                toX: x,
                toY: y,
                color: 'transparent',
                width: currentStrokeWidth,
                tool: 'eraser',
                strokeId: currentStrokeId
            });
        }
        startX = x;
        startY = y;
    }

    e.preventDefault();
}

function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;

    // Send final stroke for shapes (line, rectangle, circle)
    if ((currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') && wsManager && wsManager.isSocketConnected()) {
        let endX = startX;
        let endY = startY;
        
        if (e) {
            const rect = canvas.getBoundingClientRect();
            if (e.clientX !== undefined) {
                endX = e.clientX - rect.left;
                endY = e.clientY - rect.top;
            } else if (e.touches && e.touches.length > 0) {
                endX = e.touches[0].clientX - rect.left;
                endY = e.touches[0].clientY - rect.top;
            }
        }
        
        wsManager.sendDrawLine({
            fromX: startX,
            fromY: startY,
            toX: endX,
            toY: endY,
            color: currentColor,
            width: currentStrokeWidth,
            tool: currentTool,
            strokeId: `s-${Date.now()}-${Math.floor(Math.random()*100000)}`
        });
    }

    saveHistory();

    // Clear stroke ID after drawing completes
    currentStrokeId = null;
}

// Draw line on local canvas
function drawLine(fromX, fromY, toX, toY, color, width) {
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.closePath();
}

// Draw remote user's strokes on remote canvas layer
function drawLineRemote(fromX, fromY, toX, toY, color, width, tool) {
    if (tool === 'eraser') {
        // Erase on remote layer
        remoteCtx.clearRect(fromX - width / 2, fromY - width / 2, width, width);
        remoteCtx.clearRect(toX - width / 2, toY - width / 2, width, width);
    } else if (tool === 'rectangle') {
        // Draw rectangle shape
        remoteCtx.strokeStyle = color;
        remoteCtx.lineWidth = width;
        remoteCtx.strokeRect(fromX, fromY, toX - fromX, toY - fromY);
    } else if (tool === 'circle') {
        // Draw circle shape
        const radius = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
        remoteCtx.strokeStyle = color;
        remoteCtx.lineWidth = width;
        remoteCtx.beginPath();
        remoteCtx.arc(fromX, fromY, radius, 0, 2 * Math.PI);
        remoteCtx.stroke();
    } else {
        remoteCtx.beginPath();
        remoteCtx.moveTo(fromX, fromY);
        remoteCtx.lineTo(toX, toY);
        remoteCtx.strokeStyle = color;
        remoteCtx.lineWidth = width;
        remoteCtx.lineCap = 'round';
        remoteCtx.lineJoin = 'round';
        remoteCtx.stroke();
        remoteCtx.closePath();
    }
}

// Erase on local canvas
function erase(x, y, size) {
    ctx.clearRect(x - size / 2, y - size / 2, size, size);
}

// Draw rectangle shape on local canvas
function drawRectangle(fromX, fromY, toX, toY, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(fromX, fromY, toX - fromX, toY - fromY);
}

// Draw circle shape on local canvas
function drawCircle(fromX, fromY, toX, toY, color, width) {
    const radius = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(fromX, fromY, radius, 0, 2 * Math.PI);
    ctx.stroke();
}

// Select active drawing tool and update UI
function selectTool(tool) {
    currentTool = tool;

    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tool + 'Tool').classList.add('active');

    if (tool === 'brush') {
        canvas.style.cursor = 'crosshair';
        document.getElementById('toolDisplay').textContent = 'Brush';
    } else if (tool === 'eraser') {
        canvas.style.cursor = 'cell';
        document.getElementById('toolDisplay').textContent = 'Eraser';
    } else if (tool === 'line') {
        canvas.style.cursor = 'crosshair';
        document.getElementById('toolDisplay').textContent = 'Line';
    } else if (tool === 'rectangle') {
        canvas.style.cursor = 'crosshair';
        document.getElementById('toolDisplay').textContent = 'Rectangle';
    } else if (tool === 'circle') {
        canvas.style.cursor = 'crosshair';
        document.getElementById('toolDisplay').textContent = 'Circle';
    }
}

function changeColor(color) {
    currentColor = color;
    document.getElementById('colorPreview').style.background = color;
}

function changeStrokeWidth(width) {
    currentStrokeWidth = width;
    document.getElementById('strokeDisplay').textContent = width;
}

function saveHistory() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    history.push(imageData);

    if (history.length > MAX_HISTORY) {
        history.shift();
    }

    // Clear redo stack when new stroke is drawn
    redoStack.length = 0;
}

// Send undo request to server (removes last stroke by current user)
function undoAction() {
    console.log('=== UNDO BUTTON CLICKED ===');

    if (!wsManager) {
        console.warn('No WebSocket manager available - cannot send undo');
        return;
    }

    if (!wsManager.isSocketConnected || !wsManager.isSocketConnected()) {
        console.warn('WebSocket not connected, cannot send undo');
        return;
    }

    // Debounce: prevent rapid undo clicks (500ms minimum between clicks)
    if (undoAction._last && (Date.now() - undoAction._last) < 500) {
        console.log('Undo ignored (debounced)');
        return;
    }
    undoAction._last = Date.now();

    try {
        console.log('Sending undo request to server...');
        wsManager.sendUndo();
        console.log('Undo request sent — waiting for server full-history-update');
    } catch (err) {
        console.error('Failed to send undo request:', err);
    }
}

// Send redo request to server (restores last undone stroke)
function redoAction() {
    console.log('=== REDO BUTTON CLICKED ===');

    if (!wsManager) {
        console.warn('No WebSocket manager available - cannot send redo');
        return;
    }

    if (!wsManager.isSocketConnected || !wsManager.isSocketConnected()) {
        console.warn('WebSocket not connected, cannot send redo');
        return;
    }

    // Debounce: prevent rapid redo clicks
    if (redoAction._last && (Date.now() - redoAction._last) < 500) {
        console.log('Redo ignored (debounced)');
        return;
    }
    redoAction._last = Date.now();

    try {
        console.log('Sending redo request to server...');
        wsManager.sendRedo();
        console.log('Redo request sent — waiting for server full-history-update');
    } catch (err) {
        console.error('Failed to send redo request:', err);
    }
}

function clearCanvas() {
    // Clear entire canvas and broadcast to all users
    if (confirm('Are you sure you want to clear the entire canvas?')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        remoteCtx.clearRect(0, 0, remoteCanvas.width, remoteCanvas.height);
        saveHistory();

        // Broadcast clear event to server
        if (wsManager && wsManager.isSocketConnected()) {
            wsManager.clearCanvas();
        }
    }
}

// Redraw canvas from last saved state in history
function redrawCanvas() {
    if (history.length > 0) {
        ctx.putImageData(history[history.length - 1], 0, 0);
    }
}

// Download canvas drawing as PNG image
function downloadCanvas() {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `canvas-${currentUser.roomId}-${Date.now()}.png`;
    link.click();
    console.log('Canvas downloaded');
}

// Toggle full-screen drawing mode
function toggleFullscreen() {
    const container = document.querySelector('.canvas-container');
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
    } else {
        document.exitFullscreen();
    }
}

// Generate random color for user identification
function generateUserColor() {
    const colors = ['#667eea', '#764ba2', '#f5576c', '#f093fb', '#4ecdc4', '#44a08d'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Update active users count and user list display
function updateUsersCount() {
    const count = remoteUsers.size + 1;
    document.getElementById('usersCount').textContent = count;

    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';

    // Add current user badge
    const userBadge = document.createElement('span');
    userBadge.className = 'user-badge';
    userBadge.textContent = `${currentUser.name} (You)`;
    usersList.appendChild(userBadge);

    // Add remote users badges
    remoteUsers.forEach((user, userId) => {
        const badge = document.createElement('span');
        badge.className = 'user-badge';
        badge.style.borderLeft = `3px solid ${user.color}`;
        badge.textContent = `${user.name}`;
        usersList.appendChild(badge);
    });
}

// Add remote user to the session
function addRemoteUser(userId, name, color) {
    remoteUsers.set(userId, { name, color, x: 0, y: 0 });
    updateUsersCount();
}

// Remove remote user from the session
function removeRemoteUser(userId) {
    remoteUsers.delete(userId);
    const cursor = document.getElementById(`cursor-${userId}`);
    if (cursor) cursor.remove();
    updateUsersCount();
}

// Update remote user cursor position on canvas
function updateRemoteCursor(userId, x, y) {
    let cursor = document.getElementById(`cursor-${userId}`);

    if (!cursor) {
        // Create cursor element for new user
        cursor = document.createElement('div');
        cursor.id = `cursor-${userId}`;
        cursor.className = 'remote-cursor';
        const user = remoteUsers.get(userId);
        const pointerDiv = document.createElement('div');
        pointerDiv.className = 'cursor-pointer';
        pointerDiv.style.borderColor = user ? user.color : '#667eea';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'cursor-label';
        labelDiv.textContent = user ? user.name : 'User';
        labelDiv.style.background = user ? user.color : '#667eea';

        cursor.appendChild(pointerDiv);
        cursor.appendChild(labelDiv);
        document.getElementById('cursorsContainer').appendChild(cursor);
    }

    // Update cursor position
    cursor.style.left = (x - 10) + 'px';
    cursor.style.top = (y - 10) + 'px';
}

// Leave current room and return to main page
function leaveRoom() {
    if (confirm('Are you sure you want to leave this room?')) {
        if (wsManager) {
            wsManager.disconnect();
        }

        // Clear user session from localStorage
        localStorage.removeItem('userName');
        localStorage.removeItem('roomId');
        localStorage.removeItem('isHost');
        window.location.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
});
