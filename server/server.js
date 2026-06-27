const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const app = express();
const server = http.createServer(app);

// Enable CORS
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// PostgreSQL Database Connection Pool (Updated for Neon DB)
// Replace the connectionString below with your actual Neon DB URL!
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:YOUR_PASSWORD@ep-nameless-shape-123456.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// Fallback data in case the database isn't connected yet
// const FALLBACK_IMAGES = [
//   { url: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1000&q=80", answer: "Taj Mahal", aliases: ["the taj mahal", "taj", "tajmahal"], category: "places" },
//   { url: "https://images.unsplash.com/photo-1605130284535-11dd9eedc58a?auto=format&fit=crop&w=1000&q=80", answer: "Statue of Liberty", aliases: ["liberty statue", "statue of liberty"], category: "places" },
//   { url: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1000&q=80", answer: "Naruto", aliases: ["naruto uzumaki", "hokage"], category: "anime" },
//   { url: "https://images.unsplash.com/photo-1608889175123-8ee362201f81?auto=format&fit=crop&w=1000&q=80", answer: "Cinema", aliases: ["movies", "film", "entertainment"], category: "entertainment" }
// ];

// DATA STRUCTURES FOR MULTIPLE ROOMS
const rooms = {}; // Maps roomId -> game state object
const socketRoomMap = {}; // Maps socket.id -> roomId for quick lookups
const disconnectedPlayers = {}; // Maps `${roomId}:${playerName}` -> { score, timestamp }

// Helper to generate a 4-letter room code
const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

// The Game Loop Engine (Now takes a roomId!)
const startGameLoop = async (roomId) => {
  const room = rooms[roomId];
  if (!room) return;
  if (room.timerInterval) clearInterval(room.timerInterval);

  // If it's round 0, fetch fresh images from the database!
  if (room.currentRound === 0) {
    try {
      let result;
      const limit = room.totalRounds || 3;
      if (room.category === 'random') {
        result = await pool.query('SELECT * FROM trivia_images ORDER BY RANDOM() LIMIT $1', [limit]);
      } else {
        result = await pool.query('SELECT * FROM trivia_images WHERE category = $1 ORDER BY RANDOM() LIMIT $2', [room.category, limit]);
      }

      if (result.rows.length > 0) {
        room.activeImages = result.rows;
      } else {
        throw new Error(`No images found for category: ${room.category}`);
      }
    } catch (err) {
      console.log(`Database fetch failed (${err.message}), using fallback images.`);
      let fallbacks = FALLBACK_IMAGES;
      if (room.category !== 'random') {
        fallbacks = FALLBACK_IMAGES.filter(img => img.category === room.category);
        if (fallbacks.length === 0) fallbacks = FALLBACK_IMAGES;
      }
      room.activeImages = fallbacks.sort(() => 0.5 - Math.random()).slice(0, room.totalRounds || 3);
    }
  }

  room.status = 'playing';
  room.timeLeft = 30;
  room.players.forEach(p => p.hasGuessed = false);

  const currentImg = room.activeImages[room.currentRound];

  io.to(roomId).emit('round_started', {
    round: room.currentRound,
    timeLeft: room.timeLeft,
    players: room.players,
    currentImageUrl: currentImg.url,
    category: room.category
  });

  io.to(roomId).emit('chat_message', { sender: "System", text: `Round ${room.currentRound + 1} starting! (${room.category.toUpperCase()}) What is this image?`, isSystem: true });

  room.timerInterval = setInterval(() => {
    room.timeLeft -= 1;
    io.to(roomId).emit('timer_update', room.timeLeft);

    if (room.timeLeft <= 0) {
      endRound(roomId);
    }
  }, 1000);
};

const endRound = (roomId) => {
  const room = rooms[roomId];
  if (!room || room.status !== 'playing') return;

  clearInterval(room.timerInterval);
  room.status = 'round_end';

  const currentAnswer = room.activeImages[room.currentRound].answer;
  io.to(roomId).emit('chat_message', { sender: "System", text: `Round Over! The answer was: ${currentAnswer}`, isSystem: true });
  io.to(roomId).emit('round_ended');

  setTimeout(() => {
    if (!rooms[roomId]) return; // Failsafe if room was deleted during timeout

    if (room.currentRound + 1 < room.activeImages.length) {
      room.currentRound += 1;
      startGameLoop(roomId);
    } else {
      room.status = 'lobby';
      room.currentRound = 0;
      io.to(roomId).emit('chat_message', { sender: "System", text: `Game Over! Thanks for playing.`, isSystem: true });
      io.to(roomId).emit('game_over');
    }
  }, 5000);
};

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // CREATE ROOM
  socket.on('create_room', (playerName) => {
    const roomId = generateRoomCode();
    rooms[roomId] = {
      id: roomId,
      status: 'lobby',
      currentRound: 0,
      timeLeft: 30,
      players: [],
      activeImages: [],
      category: 'random',
      totalRounds: 3,
      timerInterval: null
    };
    joinRoomLogic(socket, roomId, playerName);
  });

  // JOIN EXISTING ROOM
  socket.on('join_room', (code, playerName) => {
    const roomId = code.toUpperCase().trim();
    if (rooms[roomId]) {
      joinRoomLogic(socket, roomId, playerName);
    } else {
      socket.emit('error_message', 'Room not found. Please check the code.');
    }
  });

  // REJOIN ROOM (on page refresh)
  socket.on('rejoin_room', (code, playerName) => {
    const roomId = code.toUpperCase().trim();
    if (rooms[roomId]) {
      joinRoomLogic(socket, roomId, playerName, true);
    } else {
      socket.emit('rejoin_failed');
    }
  });

  const joinRoomLogic = (socket, roomId, playerName, isRejoin = false) => {
    socket.join(roomId);
    socketRoomMap[socket.id] = roomId;

    const room = rooms[roomId];

    // Cancel pending room deletion if someone is joining back
    if (room._deleteTimeout) {
      clearTimeout(room._deleteTimeout);
      delete room._deleteTimeout;
    }

    const name = (playerName && playerName.trim()) ? playerName.trim().substring(0, 12) : `Player_${socket.id.substring(0, 4)}`;

    // Check if this player had a saved score from a recent disconnect
    const dcKey = `${roomId}:${name}`;
    const savedScore = disconnectedPlayers[dcKey]?.score || 0;
    delete disconnectedPlayers[dcKey];

    const newPlayer = { id: socket.id, name, score: savedScore, hasGuessed: false };
    room.players.push(newPlayer);

    socket.emit('joined_room', roomId);
    socket.emit('initial_state', {
      status: room.status,
      currentRound: room.currentRound,
      timeLeft: room.timeLeft,
      players: room.players,
      category: room.category,
      currentImageUrl: room.status !== 'lobby' ? room.activeImages[room.currentRound]?.url : undefined
    });

    io.to(roomId).emit('leaderboard_update', room.players);
    if (!isRejoin) {
      io.to(roomId).emit('chat_message', { sender: "System", text: `${newPlayer.name} joined the room.`, isSystem: true });
    } else {
      io.to(roomId).emit('chat_message', { sender: "System", text: `${newPlayer.name} reconnected.`, isSystem: true });
    }
  };

  // GAME CONTROLS
  socket.on('start_game', (selectedCategory = 'random', totalRounds = 3) => {
    const roomId = socketRoomMap[socket.id];
    if (roomId && rooms[roomId].status === 'lobby') {
      rooms[roomId].status = 'starting'; // Prevent double clicks
      rooms[roomId].currentRound = 0;
      rooms[roomId].category = selectedCategory.toLowerCase();
      rooms[roomId].totalRounds = Math.min(Math.max(parseInt(totalRounds) || 3, 3), 10);
      rooms[roomId].players.forEach(p => p.score = 0);
      io.to(roomId).emit('game_starting');
      startGameLoop(roomId);
    }
  });

  socket.on('submit_guess', (guessText) => {
    const roomId = socketRoomMap[socket.id];
    if (!roomId) return;

    const room = rooms[roomId];
    if (room.status !== 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.hasGuessed) return;

    const guess = guessText.toLowerCase().trim();
    const currentImg = room.activeImages[room.currentRound];

    const aliasesArray = Array.isArray(currentImg.aliases) ? currentImg.aliases : (currentImg.aliases || "").split(',').map(s => s.trim());

    if (guess === currentImg.answer.toLowerCase() || aliasesArray.includes(guess)) {
      const pointsEarned = room.timeLeft * 10;
      player.score += pointsEarned;
      player.hasGuessed = true;

      io.to(roomId).emit('chat_message', { sender: "System", text: `${player.name} guessed correctly! (+${pointsEarned} pts)`, isSystem: true, isCorrect: true });
      io.to(roomId).emit('leaderboard_update', room.players);

      if (room.players.every(p => p.hasGuessed)) {
        endRound(roomId);
      }
    } else {
      io.to(roomId).emit('chat_message', { sender: player.name, text: guessText });
    }
  });

  // CLEANUP ON DISCONNECT
  socket.on('disconnect', () => {
    const roomId = socketRoomMap[socket.id];
    if (roomId && rooms[roomId]) {
      const player = rooms[roomId].players.find(p => p.id === socket.id);

      // Save score for reconnection (expires after 60s)
      if (player) {
        const dcKey = `${roomId}:${player.name}`;
        disconnectedPlayers[dcKey] = { score: player.score, timestamp: Date.now() };
        setTimeout(() => { delete disconnectedPlayers[dcKey]; }, 60000);
      }

      rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
      io.to(roomId).emit('leaderboard_update', rooms[roomId].players);
      io.to(roomId).emit('chat_message', { sender: "System", text: `A player left the room.`, isSystem: true });

      // If room is empty, schedule deletion (grace period for reconnects)
      if (rooms[roomId].players.length === 0) {
        clearInterval(rooms[roomId].timerInterval);
        rooms[roomId]._deleteTimeout = setTimeout(() => {
          if (rooms[roomId] && rooms[roomId].players.length === 0) {
            delete rooms[roomId];
            console.log(`Room ${roomId} deleted (empty after grace period)`);
          }
        }, 15000); // 15 second grace period
      }
    }
    delete socketRoomMap[socket.id];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Unblur Game Server running on port ${PORT}`);
});