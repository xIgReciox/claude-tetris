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

let gridColor = '#22222e';
let pieceColors = COLORS;

const recordsList = document.getElementById('records-list');
const bestComboEl = document.getElementById('best-combo');
const bestLinesEl = document.getElementById('best-lines');
const clearRecordsBtn = document.getElementById('clear-records-btn');
const gameoverRecords = document.getElementById('gameover-records');
const gameoverCombo = document.getElementById('gameover-combo');
const gameoverList = document.getElementById('gameover-list');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveRecordBtn = document.getElementById('save-record-btn');

const RECORDS_KEY = 'tetrisRecords';
const MAX_RECORDS = 5;
const MAX_NAME = 12;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxCombo, recordSaved, pendingRecord, highlightIdx;

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
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
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
  const color = pieceColors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

// Aro que marca el hueco central de la tuerca (cx, cy en coordenadas de celda)
function drawNutRing(context, cx, cy, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.strokeStyle = pieceColors[NUT];
  context.lineWidth = size * 0.15;
  context.beginPath();
  context.arc((cx + 0.5) * size, (cy + 0.5) * size, size * 0.32, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;
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

function applyTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  themeToggle.checked = light;
  pieceColors = light ? COLORS_LIGHT : COLORS;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  // En pausa/game over el loop está detenido: redibujar manualmente
  if (board && current && next) { draw(); drawNext(); }
}

function loadTheme() {
  try { return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; }
  catch (e) { return 'dark'; }
}

// ---- Records (localStorage) ----
function emptyRecords() {
  return { entries: [], bestCombo: 0, maxLines: 0 };
}

function toCount(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function sanitizeName(s) {
  const clean = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, MAX_NAME);
  return clean || 'Anónimo';
}

function normalizeRecords(raw) {
  const data = emptyRecords();
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.entries) ? raw.entries : []);
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const sc = toCount(e.score);
    if (!sc) continue;
    data.entries.push({
      name: sanitizeName(e.name),
      score: sc,
      lines: toCount(e.lines),
      combo: toCount(e.combo),
      date: typeof e.date === 'string' ? e.date.slice(0, 40) : '',
    });
  }
  data.entries.sort((a, b) => b.score - a.score);
  data.entries.length = Math.min(data.entries.length, MAX_RECORDS);
  data.bestCombo = Math.max(toCount(raw && raw.bestCombo), ...data.entries.map(e => e.combo));
  data.maxLines = Math.max(toCount(raw && raw.maxLines), ...data.entries.map(e => e.lines));
  return data;
}

function loadRecords() {
  try {
    const txt = localStorage.getItem(RECORDS_KEY);
    return normalizeRecords(txt ? JSON.parse(txt) : null);
  } catch (e) { return emptyRecords(); }
}

function saveRecords(data) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(data)); } catch (e) { /* ignorar */ }
}

function qualifies(data, sc) {
  if (sc <= 0) return false;
  return data.entries.length < MAX_RECORDS || sc > data.entries[data.entries.length - 1].score;
}

function renderList(listEl, entries, hlIdx, pendingIdx) {
  listEl.textContent = '';
  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'records-empty';
    li.textContent = 'Sin records';
    listEl.appendChild(li);
    return;
  }
  entries.forEach((e, i) => {
    const li = document.createElement('li');
    if (i === hlIdx || i === pendingIdx) li.className = 'highlight';
    const name = document.createElement('span');
    name.className = 'rec-name';
    name.textContent = `${i + 1}. ${e.name}`;
    const sc = document.createElement('span');
    sc.className = 'rec-score';
    sc.textContent = e.score.toLocaleString();
    li.append(name, sc);
    listEl.appendChild(li);
  });
}

function renderRecords() {
  const data = loadRecords();
  renderList(recordsList, data.entries, highlightIdx);
  bestComboEl.textContent = data.bestCombo;
  bestLinesEl.textContent = data.maxLines;
  return data;
}

function showGameOverRecords(data) {
  let entries = data.entries;
  let pendingIdx = -1;
  if (pendingRecord) {
    entries = data.entries.slice();
    pendingIdx = entries.findIndex(e => pendingRecord.score > e.score);
    if (pendingIdx < 0) pendingIdx = entries.length;
    entries.splice(pendingIdx, 0, { name: '???', score: pendingRecord.score });
    entries.length = Math.min(entries.length, MAX_RECORDS);
  }
  renderList(gameoverList, entries, highlightIdx, pendingIdx);
  gameoverCombo.textContent = `Mejor combo: ${maxCombo} · Récord combo: ${data.bestCombo} · Máx. líneas: ${data.maxLines}`;
  nameEntry.classList.toggle('hidden', !pendingRecord);
  gameoverRecords.classList.remove('hidden');
  if (pendingRecord) { nameInput.value = ''; nameInput.focus(); }
}

// Guarda la partida actual (una sola vez) con el nombre dado
function commitRecord(name) {
  if (recordSaved || !pendingRecord) return;
  recordSaved = true;
  const data = loadRecords();
  const entry = {
    name: sanitizeName(name),
    score: pendingRecord.score,
    lines: pendingRecord.lines,
    combo: pendingRecord.combo,
    date: new Date().toISOString(),
  };
  let idx = data.entries.findIndex(e => entry.score > e.score);
  if (idx < 0) idx = data.entries.length;
  data.entries.splice(idx, 0, entry);
  data.entries.length = Math.min(data.entries.length, MAX_RECORDS);
  highlightIdx = idx < MAX_RECORDS ? idx : -1;
  pendingRecord = null;
  saveRecords(data);
  const fresh = renderRecords();
  if (gameOver) showGameOverRecords(fresh);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  // Históricos (mejor combo / líneas máximas) se actualizan siempre, una vez por partida
  if (!recordSaved && !pendingRecord) {
    const data = loadRecords();
    data.bestCombo = Math.max(data.bestCombo, maxCombo);
    data.maxLines = Math.max(data.maxLines, lines);
    pendingRecord = qualifies(data, score) ? { score, lines, combo: maxCombo } : null;
    if (!pendingRecord) recordSaved = true;
    saveRecords(data);
    highlightIdx = -1;
    renderRecords();
    showGameOverRecords(data);
  }
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
    gameoverRecords.classList.add('hidden');
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
  // Si se reinicia sin confirmar el nombre, guardar como Anónimo
  if (pendingRecord) commitRecord(nameInput.value);
  combo = 0;
  maxCombo = 0;
  recordSaved = false;
  pendingRecord = null;
  highlightIdx = -1;
  gameoverRecords.classList.add('hidden');
  renderRecords();
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
  if (e.target === themeToggle) return;
  if (e.target && ['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(e.target.tagName)) return;
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

restartBtn.addEventListener('click', () => { restartBtn.blur(); init(); });

nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    commitRecord(nameInput.value);
    nameInput.blur();
  }
});
saveRecordBtn.addEventListener('click', () => { commitRecord(nameInput.value); saveRecordBtn.blur(); });

clearRecordsBtn.addEventListener('click', () => {
  clearRecordsBtn.blur();
  if (!confirm('¿Borrar todos los records guardados?')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) { /* ignorar */ }
  highlightIdx = -1;
  if (pendingRecord) { pendingRecord = null; recordSaved = true; }
  renderRecords();
  if (gameOver) showGameOverRecords(emptyRecords());
});

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  applyTheme(theme);
  try { localStorage.setItem('theme', theme); } catch (e) { /* ignorar */ }
  themeToggle.blur();
});

applyTheme(loadTheme());
init();
