# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no `package.json`, no build, no linter, no tests. The README and UI text are in Spanish; match that for user-facing strings.

## Running

Open `index.html` directly, or serve statically (`python -m http.server 8000`, then http://localhost:8000). Verify changes manually in the browser.

## Architecture

Three files: `index.html` (DOM + canvases), `style.css`, and `game.js` (all logic, one global script with `'use strict'`).

- `game.js` uses module-level mutable globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, …) declared on one line and (re)initialized in `init()`. Restart calls `init()` again, which cancels the previous animation frame.
- Board is a `ROWS×COLS` matrix; cell value `0` = empty, `1–8` = index into both `COLORS` and `PIECES` (the same index identifies the piece type, so the shape matrices embed their own color index). Piece 8 (`NUT`, the "Tuerca") is a 3×3 ring with an empty center; `drawNutRing` draws a circle over the hole (current piece, ghost, next preview, and locked nuts detected by 4 `NUT` orthogonal neighbors).
- Flow: `loop` (rAF, accumulates `dropAccum` against `dropInterval`) → `lockPiece` → `merge` → `clearLines` → `spawn` (promotes `next`, calls `endGame` if the new piece collides). Keyboard handler is a single `keydown` listener at the bottom.
- Pause/game-over both stop the loop via `cancelAnimationFrame` and reuse the same `#overlay` element; unpausing resets `lastTime` and calls `loop` directly.
- Rotation is `rotateCW` plus simple horizontal kicks `[0,-1,1,-2,2]` in `tryRotate` (not SRS). There is no 7-bag; `randomPiece` is uniform random.
- Scoring/speed: `LINE_SCORES × level`, hard drop +2/cell, soft drop +1/cell, level = `max(baseLevel, floor(lines/10)+1)` (`levelForLines`; `baseLevel` = `startLevel` captured in `init`, persisted in localStorage `startLevel`, chosen in the pause menu), `dropInterval = dropIntervalFor(level) = max(100, 1000 − (level−1)·90)`.
- Pause (`P`/`Esc`) shows a menu (`#pause-menu`: Reanudar, Reiniciar, Ver controles, Nivel inicial) inside `#overlay`; game over hides it and shows `#restart-btn`. Keys held/pressed while paused are in `blockedKeys` until their keyup. The pause-menu controls list duplicates the others too.

## Gotchas

- Canvas size is hardcoded in `index.html` (`#board` 300×600, `#next-canvas` 120×120). Changing `COLS`, `ROWS` or `BLOCK` in `game.js` requires updating the canvas `width`/`height` to match.
- `drawNext` uses its own block size (30) and assumes a 4×4 preview area.
- The controls list in `index.html` and the README controls table duplicate the key bindings in `game.js`; keep them in sync.
