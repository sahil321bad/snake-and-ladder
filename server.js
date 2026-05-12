const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state storage
const games = {};

const SNAKES = { 99: 78, 95: 75, 92: 88, 89: 68, 74: 53, 64: 60, 62: 19, 49: 11, 46: 25, 16: 6 };
const LADDERS = { 2: 38, 7: 14, 8: 31, 15: 26, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98, 87: 94 };
const CELL_COUNT = 100;

function createGame(gameId) {
  games[gameId] = {
    players: {},
    positions: [1, 1],
    currentPlayer: 0,
    gameStarted: false,
    winner: null
  };
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create or join a game room
  socket.on('joinGame', (gameId) => {
    const room = io.sockets.adapter.rooms.get(gameId);

    if (!games[gameId]) {
      createGame(gameId);
    }

    const game = games[gameId];
    const playersInRoom = Object.keys(game.players).length;

    if (playersInRoom >= 2) {
      socket.emit('roomFull');
      return;
    }

    socket.join(gameId);

    // Assign player number
    let playerNum;
    if (playersInRoom === 0) {
      playerNum = 0;
      game.players[socket.id] = 'Player 1';
    } else {
      playerNum = 1;
      game.players[socket.id] = 'Player 2';
      game.gameStarted = true;
    }

    socket.playerNum = playerNum;
    socket.gameId = gameId;

    // Send initial game state
    socket.emit('playerAssigned', { playerNum, game: game });
    io.to(gameId).emit('gameState', game);

    console.log(`Player ${playerNum + 1} joined game ${gameId}`);
  });

  // Handle dice roll
  socket.on('rollDice', (data) => {
    const { gameId, roll, currentPlayer, target } = data;
    const game = games[gameId];

    if (!game || game.winner) return;

    // Validate current player matches
    if (game.currentPlayer !== currentPlayer) return;

    // Check for snake or ladder
    let finalPosition = target;
    let eventType = null;

    if (SNAKES[target]) {
      finalPosition = SNAKES[target];
      eventType = 'snake';
    } else if (LADDERS[target]) {
      finalPosition = LADDERS[target];
      eventType = 'ladder';
    }

    // Update game state
    game.positions[currentPlayer] = finalPosition;
    game.currentPlayer = 1 - currentPlayer;

    // Check win
    if (finalPosition === CELL_COUNT) {
      game.winner = currentPlayer;
      game.currentPlayer = -1; // No next player
    }

    // Broadcast to all players in room
    io.to(gameId).emit('gameState', {
      positions: [...game.positions],
      currentPlayer: game.currentPlayer,
      winner: game.winner
    });
    io.to(gameId).emit('playerMoved', {
      currentPlayer,
      roll,
      target,
      finalPosition,
      eventType,
      nextPlayer: game.currentPlayer
    });
  });

  // Handle reset
  socket.on('resetGame', (gameId) => {
    const game = games[gameId];
    if (game) {
      game.positions = [1, 1];
      game.currentPlayer = 0;
      game.winner = null;
      io.to(gameId).emit('gameState', game);
      io.to(gameId).emit('gameReset');
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const gameId = socket.gameId;
    if (gameId && games[gameId]) {
      const game = games[gameId];
      delete game.players[socket.id];

      if (Object.keys(game.players).length === 0) {
        delete games[gameId];
      } else {
        io.to(gameId).emit('playerDisconnected', { playerNum: socket.playerNum });
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});