/* ---------- Game State ---------- */
const state = {
  players: [
    {name: 'Player 1', color: 'red', position: 1, tokenEl: null, posEl: document.getElementById('pos0')},
    {name: 'Player 2', color: 'blue', position: 1, tokenEl: null, posEl: document.getElementById('pos1')}
  ],
  current: 0, // index
  dice: 0,
  snakes: {16:6,48:30,62:19,88:24,95:56,97:78},
  ladders: {2:38,7:14,8:31,15:26,21:42,28:84,36:44,51:67,71:91,78:98,87:94},
  mode: 'two', // future: 'single'
  theme: 'light',
  muted: false
};

/* ---------- DOM Elements ---------- */
const boardEl = document.getElementById('board');
const rollBtn = document.getElementById('rollBtn');
const resetBtn = document.getElementById('resetBtn');
const diceResultEl = document.getElementById('diceResult');
const diceAnimEl = document.getElementById('diceAnim');
const turnIndicatorEl = document.getElementById('turnIndicator');
const themeToggleBtn = document.getElementById('themeToggle');
const muteToggleBtn = document.getElementById('muteToggle');

const diceSound = document.getElementById('diceSound');
const ladderSound = document.getElementById('ladderSound');
const snakeSound = document.getElementById('snakeSound');
const winSound = document.getElementById('winSound');
const bgMusic = document.getElementById('bgMusic');

/* ---------- Helper Functions ---------- */
function saveState() {
  const toSave = {
    players: state.players.map(p => ({position: p.position})),
    current: state.current,
    theme: state.theme,
    muted: state.muted
  };
  localStorage.setItem('snlState', JSON.stringify(toSave));
}

function loadState() {
  const saved = localStorage.getItem('snlState');
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    state.players.forEach((p,i) => { p.position = data.players[i].position; });
    state.current = data.current;
    state.theme = data.theme;
    state.muted = data.muted;
    applyTheme();
    applyMute();
  } catch (_) {}
}

function applyTheme() {
  if (state.theme === 'dark') document.body.classList.add('dark');
  else document.body.classList.remove('dark');
  themeToggleBtn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

function applyMute() {
  const vol = state.muted ? 0 : 1;
  [diceSound, ladderSound, snakeSound, winSound, bgMusic].forEach(a => a.volume = vol);
  muteToggleBtn.textContent = state.muted ? '🔇' : '🔊';
}

function generateBoard() {
  boardEl.innerHTML = '';
  const BOARD_SIZE = 10;
  const displayOrder = [];
  // Generate cells in visual zigzag order (snake pattern)
  for (let row = 0; row < BOARD_SIZE; row++) {
    const base = row * BOARD_SIZE;
    const numbers = [];
    for (let n = 1; n <= BOARD_SIZE; n++) {
      numbers.push(base + n);
    }
    // Even rows go left→right, odd rows go right→left
    const leftToRight = (row % 2 === 0);
    if (!leftToRight) numbers.reverse();
    displayOrder.push(...numbers);
  }
  // Reverse so top row displays first (cell 1 at bottom)
  displayOrder.reverse();
  // Create cells in that visual order
  for (const i of displayOrder) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.num = i;
    const numDiv = document.createElement('div');
    numDiv.className = 'cell-number';
    numDiv.textContent = i;
    cell.appendChild(numDiv);
    boardEl.appendChild(cell);
  }
}

// Helper: compute center of a cell in board coordinates (snake pattern)
function getCellCenter(num) {
  const BOARD_SIZE = 10;
  const CELL_PERCENT = 100 / BOARD_SIZE;
  // Calculate row from bottom (row 0 = bottom)
  const row = Math.floor((num - 1) / BOARD_SIZE);
  // Column within the row (zigzag pattern)
  const colInRow = (num - 1) % BOARD_SIZE;
  // Even rows go left→right, odd rows go right→left
  const col = row % 2 === 0 ? colInRow : BOARD_SIZE - 1 - colInRow;
  // Calculate x, y as percentages
  const x = col * CELL_PERCENT + CELL_PERCENT / 2;
  const y = row * CELL_PERCENT + CELL_PERCENT / 2;
  // Convert to pixels
  const boardRect = boardEl.getBoundingClientRect();
  return {
    x: x * boardRect.width / 100,
    y: y * boardRect.height / 100
  };
}

function movePlayerAnimated(player, targetPos){
  const start = player.position;
  const step = targetPos > start ? 1 : -1;
  for(let pos = start + step; (step>0 ? pos <= targetPos : pos >= targetPos); pos += step){
    // highlight cell
    const cell = boardEl.querySelector(`.cell[data-num='${pos}']`);
    if(cell) cell.classList.add('highlight');
    const {x,y}=getCellCenter(pos);
    player.tokenEl.style.transform = `translate(${x}px,${y}px)`;
    player.position = pos;
    player.posEl.textContent = pos;
    // bounce effect
    player.tokenEl.classList.add('bounce');
    await new Promise(r=>setTimeout(r,300));
    player.tokenEl.classList.remove('bounce');
    if(cell) cell.classList.remove('highlight');
  }
}


function placeToken(player) {
  if (!player.tokenEl) {
    const token = document.createElement('div');
    token.className = `token ${player.color}`;
    boardEl.appendChild(token);
    player.tokenEl = token;
  }
  const pos = getCellCenter(player.position);
  player.tokenEl.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  player.posEl.textContent = player.position;
}

function animateDice(value) {
  diceAnimEl.textContent = value;
  diceAnimEl.classList.add('show');
  setTimeout(() => diceAnimEl.classList.remove('show'), 600);
}

function rollDiceAnimation(){
  // rollDice already performs dice animation and sound
  return Promise.resolve(rollDice());
}


function moveTokenSmooth(player, targetPos, callback) {
  const steps = Math.abs(targetPos - player.position);
  const direction = targetPos > player.position ? 1 : -1;
  let current = player.position;
  const moveOne = () => {
    if (current === targetPos) { callback && callback(); return; }
    current += direction;
    const pos = getCellCenter(current);
    player.tokenEl.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    player.position = current;
    player.posEl.textContent = current;
    setTimeout(moveOne, 250);
  };
  moveOne();
}

function animateSnake(startNum, endNum) {
  // Create an img element that follows the snake path
  const img = document.createElement('img');
  img.src = 'https://i.imgur.com/5XQZnGv.png'; // placeholder snake graphic
  img.className = 'snake-anim-img';
  boardEl.appendChild(img);

  const start = getCellCenter(startNum);
  const end   = getCellCenter(endNum);
  // Position at start
  img.style.left = `${start.x}px`;
  img.style.top  = `${start.y}px`;
  // Force layout so transition works
  img.offsetWidth;
  // Move to end using transform (smooth)
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  img.style.transform = `translate(${dx}px, ${dy}px)`;

  // Remove after animation (≈600ms)
  setTimeout(() => img.remove(), 700);
}

async function handleSnakesAndLadders(player){
  const sn = state.snakes[player.position];
  const ld = state.ladders[player.position];
  if (sn) {
    if (!state.muted) { snakeSound.currentTime=0; snakeSound.play(); }
    player.tokenEl.classList.add('shake');
    await new Promise(r=>setTimeout(r,400));
    player.tokenEl.classList.remove('shake');
    await movePlayerAnimated(player, sn);
  } else if (ld) {
    if (!state.muted) { ladderSound.currentTime=0; ladderSound.play(); }
    player.tokenEl.classList.add('glow');
    await new Promise(r=>setTimeout(r,400));
    player.tokenEl.classList.remove('glow');
    await movePlayerAnimated(player, ld);
  }
}




async function winAnimation(player){
  if(!state.muted){ winSound.currentTime=0; winSound.play(); }
  // token celebration bounce
  player.tokenEl.classList.add('bounce');
  // confetti via CDN
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js';
  script.onload=()=>{ confetti({particleCount:120, spread:70, origin:{y:0.6}}); };
  document.body.appendChild(script);
  // show win modal
  if(winModal){
    winModal.querySelector('.msg').textContent=`${player.name} wins! 🎉`;
    winModal.classList.add('show');
    // close on click
    winModal.addEventListener('click',()=>{ winModal.classList.remove('show'); });
  }
  await new Promise(r=>setTimeout(r,1500));
  player.tokenEl.classList.remove('bounce');
}


function nextTurn() {
  state.current = (state.current + 1) % state.players.length;
  updateTurnUI();
  saveState();
}

function updateTurnUI() {
  const activePlayer = state.players[state.current];
  turnIndicatorEl.textContent = `Turn: ${activePlayer.name}`;
  // highlight token
  state.players.forEach(p => {
    if (p.tokenEl) p.tokenEl.style.boxShadow = p === activePlayer ? '0 0 10px 4px #ffd600' : '0 0 4px rgba(0,0,0,.4)';
  });
}

async function playerTurn(){
  const player = state.players[state.current];
  // highlight active token
  if(player.tokenEl) player.tokenEl.classList.add('active-move');
  rollBtn.disabled = true;
  const roll = await rollDiceAnimation();
  const target = player.position + roll;
  if(target > 100){
    const bounce = 100 - (target - 100);
    await movePlayerAnimated(player, bounce);
  } else {
    await movePlayerAnimated(player, target);
  }
  await handleSnakesAndLadders(player);
  if(checkWin(player)){
    await winAnimation(player);
    // keep dice disabled after win
  } else {
    // next turn
    state.current = (state.current + 1) % state.players.length;
    updateTurnUI();
    saveState();
    rollBtn.disabled = false;
  }
  if(player.tokenEl) player.tokenEl.classList.remove('active-move');
  // AI handling (if next player is AI)
  const next = state.players[state.current];
  if(next.isAI && !checkWin(next)){
    setTimeout(playerTurn,800);
  }
}

function resetGame() {
  if (confirm('Reset the game?')) {
    localStorage.removeItem('snlState');
    location.reload();
  }
}

/* ---------- Event Listeners ---------- */
rollBtn.addEventListener('click', playerTurn);
resetBtn.addEventListener('click', resetGame);
themeToggleBtn.addEventListener('click', () => {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  saveState();
});
muteToggleBtn.addEventListener('click', () => {
  state.muted = !state.muted;
  applyMute();
  saveState();
});

/* ---------- Init ---------- */
function init() {
  generateBoard();
  loadState();
  // create tokens and place them
  state.players.forEach(p => placeToken(p));
  updateTurnUI();
  // start background music if not muted
  if (!state.muted) bgMusic.play();
}

init();
