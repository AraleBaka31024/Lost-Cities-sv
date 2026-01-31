import http from "http";
import { Server } from "socket.io";
import { createGame, applyAction, viewFor } from "./engine.js";

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }
  res.writeHead(404);
  res.end("Not Found");
});

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const rooms = {};
const socketRoom = new Map();

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
  if (!r || !r.game || r.players.length !== 2) return;
  r.players.forEach((sid, i) => {
    io.to(sid).emit("STATE", viewFor(r.game, i));
  });
}

function detachFromCurrentRoom(socket) {
  const roomCode = socketRoom.get(socket.id);
  if (!roomCode) return;

  const r = rooms[roomCode];
  if (r) {
    const idx = r.players.indexOf(socket.id);
    if (idx !== -1) r.players.splice(idx, 1);

    if (r.players.length === 1) {
      r.game = null;
      const otherId = r.players[0];
      io.to(otherId).emit("OPPONENT_LEFT", { room: roomCode });
    }

    if (r.players.length === 0) {
      delete rooms[roomCode];
    }
  }

  socket.leave(roomCode);
  socketRoom.delete(socket.id);
}

io.on("connection", (socket) => {
  socket.on("CREATE_ROOM", () => {
    detachFromCurrentRoom(socket);

    const room = genRoom();
    rooms[room] = { game: null, players: [socket.id] };
    socketRoom.set(socket.id, room);
    socket.join(room);

    socket.emit("ROOM_CREATED", room);
    socket.emit("WAITING_FOR_PLAYER", room);
  });

  socket.on("JOIN_ROOM", (roomRaw) => {
    detachFromCurrentRoom(socket);

    const room = normalizeRoom(roomRaw);
    const r = rooms[room];

    if (!r) {
      socket.emit("JOIN_FAILED", { reason: "ROOM_NOT_FOUND" });
      return;
    }

    if (r.players.length >= 2) {
      socket.emit("JOIN_FAILED", { reason: "ROOM_FULL" });
      return;
    }

    r.players.push(socket.id);
    socketRoom.set(socket.id, room);
    socket.join(room);

    if (r.players.length === 2) {
      r.game = createGame();
      emitStateToRoom(room);
    } else {
      socket.emit("WAITING_FOR_PLAYER", room);
    }
  });

  socket.on("ACTION", ({ room: roomRaw, action } = {}) => {
    const roomFromMap = socketRoom.get(socket.id);
    const room = roomFromMap || normalizeRoom(roomRaw);
    if (!room) return;

    const r = rooms[room];
    if (!r || !r.game || r.players.length !== 2) return;

    const pid = r.players.indexOf(socket.id);
    if (pid === -1) return;

    applyAction(r.game, pid, action);
    emitStateToRoom(room);
  });

  socket.on("LEAVE_ROOM", () => {
    detachFromCurrentRoom(socket);
  });

  socket.on("disconnect", () => {
    detachFromCurrentRoom(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on :${PORT}`);
});
