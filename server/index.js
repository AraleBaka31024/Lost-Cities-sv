// index.js (server) — Render-ready
import http from "http";
import { Server } from "socket.io";
import { createGame, applyAction, viewFor } from "./engine.js";

const PORT = process.env.PORT || 3000;

// Render cần bind vào port được cấp
const server = http.createServer((req, res) => {
  // Health check endpoint (Render sẽ ping)
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }
  res.writeHead(404);
  res.end("Not Found");
});

const io = new Server(server, {
  cors: {
    origin: "*", // có thể siết lại domain web của bạn sau
    methods: ["GET", "POST"],
  },
});

const rooms = {}; // { [roomCode]: { game, players:[socketId1, socketId2] } }

function genRoom() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function normalizeRoom(room) {
  return String(room || "").trim().toUpperCase();
}

function emitStateToRoom(roomCode) {
  const r = rooms[roomCode];
  if (!r || !r.game) return;
  r.players.forEach((sid, i) => {
    io.to(sid).emit("STATE", viewFor(r.game, i));
  });
}

function removeSocketFromRooms(socketId) {
  for (const roomCode of Object.keys(rooms)) {
    const r = rooms[roomCode];
    const idx = r.players.indexOf(socketId);
    if (idx !== -1) {
      r.players.splice(idx, 1);

      // Nếu game đang chạy mà một người out -> thông báo cho người còn lại
      if (r.players.length === 1) {
        io.to(r.players[0]).emit("OPPONENT_LEFT");
      }

      // Nếu không còn ai thì xoá phòng
      if (r.players.length === 0) {
        delete rooms[roomCode];
      }
      break;
    }
  }
}

io.on("connection", (socket) => {
  // CREATE_ROOM
  socket.on("CREATE_ROOM", () => {
    const room = genRoom();
    rooms[room] = { game: null, players: [] };

    socket.join(room);
    rooms[room].players.push(socket.id);

    socket.emit("ROOM_CREATED", room);
    // (tuỳ chọn) báo trạng thái chờ
    socket.emit("WAITING_FOR_PLAYER", room);
  });

  // JOIN_ROOM
  socket.on("JOIN_ROOM", (roomRaw) => {
    const room = normalizeRoom(roomRaw);
    const r = rooms[room];

    // phòng không tồn tại
    if (!r) {
      socket.emit("JOIN_FAILED", { reason: "ROOM_NOT_FOUND" });
      return;
    }

    // phòng đủ 2 người
    if (r.players.length >= 2) {
      socket.emit("JOIN_FAILED", { reason: "ROOM_FULL" });
      return;
    }

    socket.join(room);
    r.players.push(socket.id);

    // đủ 2 người -> tạo game + gửi STATE cho cả 2
    if (r.players.length === 2) {
      r.game = createGame();
      emitStateToRoom(room);
    }
  });

  // ACTION
  socket.on("ACTION", ({ room: roomRaw, action } = {}) => {
    const room = normalizeRoom(roomRaw);
    const r = rooms[room];
    if (!r || !r.game) return;

    const pid = r.players.indexOf(socket.id);
    if (pid === -1) return;

    applyAction(r.game, pid, action);
    emitStateToRoom(room);
  });

  // DISCONNECT cleanup
  socket.on("disconnect", () => {
    removeSocketFromRooms(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on :${PORT}`);
});
