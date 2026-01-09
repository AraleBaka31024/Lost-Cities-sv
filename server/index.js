
import { Server } from "socket.io";
import { createGame, applyAction, viewFor } from "./engine.js";

const io = new Server(3000, { cors:{origin:"*"} });
const rooms = {};

function genRoom() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i=0;i<6;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}

io.on("connection", socket => {

  socket.on("CREATE_ROOM", () => {
    const room = genRoom();
    rooms[room] = { game: null, players: [] };
    socket.join(room);
    rooms[room].players.push(socket.id);
    socket.emit("ROOM_CREATED", room);
  });

  socket.on("JOIN_ROOM", room => {
    if (!rooms[room] || rooms[room].players.length>=2) return;
    socket.join(room);
    rooms[room].players.push(socket.id);
    rooms[room].game = createGame();
    rooms[room].players.forEach((sid,i)=>{
      io.to(sid).emit("STATE", viewFor(rooms[room].game, i));
    });
  });

  socket.on("ACTION", ({room, action})=>{
    const r = rooms[room];
    if (!r || !r.game) return;
    const pid = r.players.indexOf(socket.id);
    if (pid === -1) return;
    applyAction(r.game, pid, action);
    r.players.forEach((sid,i)=>{
      io.to(sid).emit("STATE", viewFor(r.game, i));
    });
  });

});
console.log("Server running on :3000");
