const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bgIndexEl = document.getElementById('bg-index');
const levelEl = document.getElementById('level');
const gameOverEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const popText = document.getElementById('pop-text');
const bgFade = document.getElementById('bg-fade');
const boardWrap = document.querySelector('.board-wrap');

const GRID_SIZE = 20;
const CELL_SIZE = canvas.width / GRID_SIZE;
const TICK_MS = 115;

// Easy-to-replace background set.
const BACKGROUND_IMAGES = [
  'radial-gradient(circle at 20% 20%, #2a4d8f 0%, #11172f 45%, #090d1f 100%)',
  'linear-gradient(125deg, #19392b 0%, #245d43 42%, #102f24 100%)',
  'linear-gradient(140deg, #5f2727 0%, #803232 40%, #2e1212 100%)',
  'radial-gradient(circle at 80% 30%, #7144a6 0%, #2f1f50 48%, #130a22 100%)',
  'linear-gradient(120deg, #0f4c5c 0%, #1f6f8b 35%, #0a2f3a 100%)'
];

const state = {
  snake: [],
  dir: { x: 1, y: 0 },
  nextDir: { x: 1, y: 0 },
  food: { x: 10, y: 10 },
  score: 0,
  running: true,
  accumulator: 0,
  lastFrameTime: 0,
  backgroundIndex: 0,
  audioCtx: null
};

function resetGame() {
  state.snake = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 }
  ];
  state.dir = { x: 1, y: 0 };
  state.nextDir = { x: 1, y: 0 };
  state.score = 0;
  state.running = true;
  state.accumulator = 0;
  state.lastFrameTime = 0;
  state.backgroundIndex = 0;
  applyBackground(0, false);
  scoreEl.textContent = '0';
  bgIndexEl.textContent = '1';
  levelEl.textContent = '1';
  gameOverEl.classList.add('hidden');

  spawnFood();
  render();
}

// Re-roll a position until we find a cell not occupied by the snake.
function spawnFood() {
  const maxAttempts = GRID_SIZE * GRID_SIZE;
  let attempts = 0;
  let candidate;

  do {
    candidate = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };
    attempts += 1;

    if (attempts > maxAttempts) {
      // If no cell is available, the board is effectively full and the run ends.
      endGame();
      return;
    }
  } while (state.snake.some((part) => part.x === candidate.x && part.y === candidate.y));

  state.food = candidate;
}

function setDirection(x, y) {
  if (!state.running) return;

  // Compare against queued direction as well so rapid key presses cannot reverse
  // direction before the next tick is processed.
  if ((x === -state.dir.x && y === -state.dir.y) || (x === -state.nextDir.x && y === -state.nextDir.y)) {
    return;
  }

  state.nextDir = { x, y };
}

window.addEventListener('keydown', (event) => {
  const keyMap = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    w: [0, -1],
    s: [0, 1],
    a: [-1, 0],
    d: [1, 0],
    W: [0, -1],
    S: [0, 1],
    A: [-1, 0],
    D: [1, 0]
  };

  if (event.key in keyMap) {
    event.preventDefault();
    const [x, y] = keyMap[event.key];
    setDirection(x, y);
  }
});

restartBtn.addEventListener('click', resetGame);

// Fixed-step simulation with frame-time accumulator for consistent movement,
// even if rendering briefly stalls.
function gameLoop(timestamp) {
  if (!state.lastFrameTime) state.lastFrameTime = timestamp;
  let frameDelta = timestamp - state.lastFrameTime;
  state.lastFrameTime = timestamp;

  // Clamp giant frame gaps (tab switch / throttling) to avoid massive catch-up bursts.
  frameDelta = Math.min(frameDelta, 250);

  if (state.running) {
    state.accumulator += frameDelta;

    while (state.accumulator >= TICK_MS && state.running) {
      update();
      state.accumulator -= TICK_MS;
    }

    render();
  }

  requestAnimationFrame(gameLoop);
}

function update() {
  state.dir = state.nextDir;
  const head = state.snake[0];
  const newHead = { x: head.x + state.dir.x, y: head.y + state.dir.y };
  const isEating = newHead.x === state.food.x && newHead.y === state.food.y;

  if (hitWall(newHead) || hitSelf(newHead, isEating)) {
    endGame();
    return;
  }

  state.snake.unshift(newHead);

  if (isEating) {
    state.score += 1;
    scoreEl.textContent = String(state.score);
    playPopEffect();

    levelEl.textContent = String(Math.floor(state.score / 10) + 1);

    if (state.score % 10 === 0) {
      const nextBg = (state.backgroundIndex + 1) % BACKGROUND_IMAGES.length;
      state.backgroundIndex = nextBg;
      applyBackground(nextBg, true);
      bgIndexEl.textContent = String(nextBg + 1);
    }

    spawnFood();
  } else {
    state.snake.pop();
  }
}

function hitWall(pos) {
  return pos.x < 0 || pos.x >= GRID_SIZE || pos.y < 0 || pos.y >= GRID_SIZE;
}

function hitSelf(pos, isEating) {
  // When not eating, the tail moves away this tick, so moving into the current
  // tail cell should be allowed.
  const bodyToCheck = isEating ? state.snake : state.snake.slice(0, -1);
  return bodyToCheck.some((segment) => segment.x === pos.x && segment.y === pos.y);
}

function endGame() {
  state.running = false;
  finalScoreEl.textContent = String(state.score);
  gameOverEl.classList.remove('hidden');
}

function applyBackground(index, animate) {
  const background = BACKGROUND_IMAGES[index];
  document.body.style.backgroundImage = background;
  boardWrap.style.backgroundImage = background;

  if (animate) {
    bgFade.style.backgroundImage = background;
    bgFade.classList.remove('active');
    void bgFade.offsetWidth;
    bgFade.classList.add('active');
  }
}

function playPopEffect() {
  popText.classList.remove('show');
  void popText.offsetWidth;
  popText.classList.add('show');

  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  const now = state.audioCtx.currentTime;
  const osc = state.audioCtx.createOscillator();
  const gain = state.audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(700, now);
  osc.frequency.exponentialRampToValueAtTime(1000, now + 0.08);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

  osc.connect(gain);
  gain.connect(state.audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

function drawCell(x, y, color, radius = 0) {
  const px = x * CELL_SIZE;
  const py = y * CELL_SIZE;
  ctx.fillStyle = color;
  if (!radius) {
    ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
    return;
  }

  const r = Math.min(radius, CELL_SIZE / 2);
  ctx.beginPath();
  ctx.moveTo(px + r, py);
  ctx.arcTo(px + CELL_SIZE, py, px + CELL_SIZE, py + CELL_SIZE, r);
  ctx.arcTo(px + CELL_SIZE, py + CELL_SIZE, px, py + CELL_SIZE, r);
  ctx.arcTo(px, py + CELL_SIZE, px, py, r);
  ctx.arcTo(px, py, px + CELL_SIZE, py, r);
  ctx.closePath();
  ctx.fill();
}

function renderFoodW() {
  const x = state.food.x * CELL_SIZE;
  const y = state.food.y * CELL_SIZE;

  ctx.fillStyle = '#fff4bb';
  ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

  ctx.fillStyle = '#121212';
  ctx.font = `bold ${Math.floor(CELL_SIZE * 0.82)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Draw a literal letter W so food is unambiguous.
  ctx.fillText('W', x + CELL_SIZE / 2, y + CELL_SIZE / 2 + 1);
}

function renderGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(4, 10, 18, 0.58)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(210, 229, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID_SIZE; i += 1) {
    const pos = i * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(canvas.width, pos);
    ctx.stroke();
  }
}

function render() {
  renderGrid();

  state.snake.forEach((segment, index) => {
    const color = index === 0 ? '#7ef064' : '#45c64b';
    drawCell(segment.x, segment.y, color, 6);
  });

  renderFoodW();
}

resetGame();
requestAnimationFrame(gameLoop);
