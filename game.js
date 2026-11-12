'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
  '#b0bec5', // Tuerca - gris metálico
];

// Colores más saturados para el tema claro
const COLORS_LIGHT = [
  null,
  '#00acc1', // I
  '#f9a825', // O
  '#8e24aa', // T
  '#43a047', // S
  '#e53935', // Z
  '#1e88e5', // J
  '#fb8c00', // L
  '#607d8b', // Tuerca
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca (hueco central)
];

const NUT = 8;

// ---- Skins ----
// Cada skin define paletas (oscuro/claro), una función drawBlock y el brillo del aro de la tuerca.
const NEON_COLORS = [null, '#00f0ff', '#fff200', '#d400ff', '#39ff14', '#ff073a', '#2979ff', '#ff9100', '#e0e0e0'];
const PASTEL_COLORS = [null, '#a8e6ef', '#fff1a8', '#d9b8f0', '#b5ead7', '#ffb3ba', '#b5d0ff', '#ffd6a5', '#cfd8dc'];
const PASTEL_COLORS_LIGHT = [null, '#7fd3e0', '#f5d76e', '#c39be0', '#8fd6b8', '#f58f9a', '#8fb4f5', '#f5b878', '#90a4ae'];
const PIXEL_COLORS = [null, '#29c5d6', '#f2c230', '#9c4fc0', '#4caf50', '#d94b4b', '#3f7fd6', '#e8860c', '#8d9ca5'];

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    palette: light => (light ? COLORS_LIGHT : COLORS),
    glow: 0,
    drawBlock(context, x, y, color, size) {
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    palette: () => NEON_COLORS,
    glow: 10,
    drawBlock(context, x, y, color, size) {
      const px = x * size + 2, py = y * size + 2, s = size - 4;
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = 'rgba(0,0,0,0.85)';
      context.fillRect(px, py, s, s);
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px, py, s, s);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.fillStyle = color;
      context.globalAlpha *= 0.35;
      context.fillRect(px + 3, py + 3, s - 6, s - 6);
    },
  },
  pastel: {
    palette: light => (light ? PASTEL_COLORS_LIGHT : PASTEL_COLORS),
    glow: 0,
    drawBlock(context, x, y, color, size) {
      roundRectPath(context, x * size + 1.5, y * size + 1.5, size - 3, size - 3, size * 0.28);
      context.fillStyle = color;
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.35)';
      roundRectPath(context, x * size + 5, y * size + 4, size - 10, size * 0.18, size * 0.08);
      context.fill();
    },
  },
  pixel: {
    palette: () => PIXEL_COLORS,
    glow: 0,
    drawBlock(context, x, y, color, size) {
      const px = x * size, py = y * size, u = size / 6; // rejilla de 6x6 "píxeles"
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      // luz arriba/izquierda, sombra abajo/derecha
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(px, py, size, u);
      context.fillRect(px, py, u, size);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(px, py + size - u, size, u);
      context.fillRect(px + size - u, py, u, size);
      // textura de damero
      context.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 1; i < 5; i++)
        for (let j = 1; j < 5; j++)
          if ((i + j) % 2 === 0) context.fillRect(px + i * u, py + j * u, u, u);
    },
  },
};
const DEFAULT_SKIN = 'retro';

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let gridColor = '#22222e';
let pieceColors = COLORS;
let skinName = DEFAULT_SKIN;
let currentTheme = 'dark';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.save();
  context.globalAlpha = alpha ?? 1;
  SKINS[skinName].drawBlock(context, x, y, pieceColors[colorIndex], size);
  context.restore(); // restaura alpha, shadowBlur y shadowColor
}

// Aro que marca el hueco central de la tuerca (cx, cy en coordenadas de celda)
function drawNutRing(context, cx, cy, size, alpha) {
  const glow = SKINS[skinName].glow;
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.strokeStyle = pieceColors[NUT];
  context.lineWidth = size * 0.15;
  if (glow) {
    context.shadowColor = pieceColors[NUT];
    context.shadowBlur = glow;
  }
  context.beginPath();
  context.arc((cx + 0.5) * size, (cy + 0.5) * size, size * 0.32, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // aro de las tuercas ya fijadas: celda vacía rodeada por 4 bloques de tuerca
  for (let r = 1; r < ROWS - 1; r++)
    for (let c = 1; c < COLS - 1; c++)
      if (!board[r][c] && board[r - 1][c] === NUT && board[r + 1][c] === NUT &&
          board[r][c - 1] === NUT && board[r][c + 1] === NUT)
        drawNutRing(ctx, c, r, BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  if (current.type === NUT) drawNutRing(ctx, current.x + 1, gy + 1, BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  if (current.type === NUT) drawNutRing(ctx, current.x + 1, current.y + 1, BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  if (next.type === NUT) drawNutRing(nextCtx, offX + 1, offY + 1, NB);
}

function refreshStyle() {
  const light = currentTheme === 'light';
  const root = document.documentElement;
  root.dataset.theme = light ? 'light' : 'dark';
  root.dataset.skin = skinName;
  pieceColors = SKINS[skinName].palette(light);
  gridColor = getComputedStyle(root).getPropertyValue('--grid').trim() || gridColor;
  // En pausa/game over el loop está detenido: redibujar manualmente
  if (board && current && next) { draw(); drawNext(); }
}

function applyTheme(theme) {
  currentTheme = theme === 'light' ? 'light' : 'dark';
  themeToggle.checked = currentTheme === 'light';
  refreshStyle();
}

function applySkin(name) {
  skinName = SKINS[name] ? name : DEFAULT_SKIN;
  skinSelect.value = skinName;
  refreshStyle();
}

function loadTheme() {
  try { return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; }
  catch (e) { return 'dark'; }
}

function loadSkin() {
  try {
    const s = localStorage.getItem('skin');
    return SKINS[s] ? s : DEFAULT_SKIN;
  } catch (e) { return DEFAULT_SKIN; }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // endGame/pausa no pueden cancelar el frame en curso: no reprogramar aquí
  if (gameOver || paused) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === themeToggle || e.target === skinSelect) return;
  if (e.target.closest && e.target.closest('input, select, textarea, button')) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => {
  restartBtn.blur(); // si no, el guard del keydown ignoraría las teclas
  init();
});

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  applyTheme(theme);
  try { localStorage.setItem('theme', theme); } catch (e) { /* ignorar */ }
  themeToggle.blur();
});

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  try { localStorage.setItem('skin', skinName); } catch (e) { /* ignorar */ }
  skinSelect.blur();
});

skinName = loadSkin();
applySkin(skinName);
applyTheme(loadTheme());
init();
