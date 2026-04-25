import { useState, useEffect } from "react";
import "./index.css";

import catImg from "./assets/Cat.png";
import slotImg from "./assets/Placement_Box.png";
import badgeImg from "./assets/Levels and Score.png";

import redTile from "./assets/red.png";
import blueTile from "./assets/blue.png";
import orangeTile from "./assets/orange.png";
import pinkTile from "./assets/pink.png";
import purpleTile from "./assets/purpule.png";

import bgDesktop from "./assets/Desktop_JustDivide_Game_2.png";

function App() {
  // ── State ─────────────────────────────────────────────
  const [grid, setGrid]                 = useState(Array(16).fill(null));
  const [queue, setQueue]               = useState([12, 8, 4]);
  const [selectedTile, setSelectedTile] = useState(null);
  const [score, setScore]               = useState(0);
  const [bestScore, setBestScore]       = useState(() => Number(localStorage.getItem("bestScore")) || 0);
  const [level, setLevel]               = useState(1);
  const [trashCount, setTrashCount]     = useState(10);
  const [keepVal, setKeepVal]           = useState(null);
  const [undoStack, setUndoStack]       = useState([]);
  const [hintCount, setHintCount]       = useState(3);
  const [hintCell, setHintCell]         = useState(null);
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [dragOverCell, setDragOverCell] = useState(null);
  const [time, setTime]                 = useState(0);
  const [gameOver, setGameOver]         = useState(false);
  const [gameStarted, setGameStarted]   = useState(false);
  const [showLevelUp, setShowLevelUp]   = useState(false);
  const [paused, setPaused]             = useState(false);
  const [logs, setLogs]                 = useState([]);

  // ── Tile pools per level ───────────────────────────────
  function getTilePool(lvl) {
    if (lvl <= 1) return [2, 3, 4, 5, 6, 8, 9, 10, 12];
    if (lvl === 2) return [4, 6, 8, 9, 10, 12, 15, 16, 18];
    if (lvl === 3) return [6, 8, 10, 12, 15, 16, 18, 20, 24];
    return [8, 10, 12, 15, 16, 18, 20, 24, 30, 32];
  }

  function getRandomTile(lvl = level) {
    const pool = getTilePool(lvl);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function getTileImage(value) {
    const tiles = [redTile, blueTile, orangeTile, pinkTile, purpleTile];
    return tiles[value % tiles.length];
  }

  // ── Helpers ────────────────────────────────────────────
  function addLog(text) {
    setLogs((prev) => [...prev.slice(-11), text]);
  }

  function getPos(index) {
    const row = Math.floor(index / 4) + 1;
    const col = (index % 4) + 1;
    return `(${row},${col})`;
  }

  function formatTime(s) {
    const m   = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  function getNeighbors(index) {
    const list = [];
    const row  = Math.floor(index / 4);
    const col  = index % 4;
    if (row > 0) list.push(index - 4);
    if (col < 3) list.push(index + 1);
    if (row < 3) list.push(index + 4);
    if (col > 0) list.push(index - 1);
    return list;
  }

  // ── Merge logic ────────────────────────────────────────
  function resolveMerge(board, placedIndex) {
    const placedVal = board[placedIndex];
    const neighbors = getNeighbors(placedIndex);
    let equalTarget = null;
    let bestTarget  = null;
    let biggest     = -1;

    for (let i of neighbors) {
      const val = board[i];
      if (val === null) continue;
      if (val === placedVal) { equalTarget = i; break; }
      const larger  = Math.max(val, placedVal);
      const smaller = Math.min(val, placedVal);
      if (larger % smaller === 0 && val > biggest) { biggest = val; bestTarget = i; }
    }

    if (equalTarget !== null) {
      addLog(`Equal merge → both removed`);
      board[placedIndex] = null;
      board[equalTarget] = null;
      return 5;
    }

    if (bestTarget !== null) {
      const a       = board[placedIndex];
      const b       = board[bestTarget];
      const larger  = Math.max(a, b);
      const smaller = Math.min(a, b);
      const result  = larger / smaller;
      const largerIndex  = a > b ? placedIndex : bestTarget;
      const smallerIndex = a > b ? bestTarget  : placedIndex;
      addLog(`Divide ${larger} ÷ ${smaller} → ${result} at ${getPos(largerIndex)}`);
      board[smallerIndex] = null;
      board[largerIndex]  = result === 1 ? null : result;
      return 3;
    }

    addLog(`No merge at ${getPos(placedIndex)}`);
    return 0;
  }

  // ── Place tile ─────────────────────────────────────────
  function placeTile(index) {
    if (grid[index] !== null || gameOver || selectedTile === null) return;

    setHintCell(null);
    if (!gameStarted) setGameStarted(true);

    setUndoStack((prev) => [
      ...prev.slice(-9),
      { grid: [...grid], queue: [...queue], score, trashCount, keepVal },
    ]);

    const current  = queue[0];
    const newGrid  = [...grid];
    newGrid[index] = current;

    const gained = resolveMerge(newGrid, index);
    setGrid([...newGrid]);
    setScore((prev) => prev + gained + 1);
    setQueue((prev) => [...prev.slice(1), getRandomTile()]);
    setSelectedTile(null);

    const isFull = newGrid.every((cell) => cell !== null);
    if (isFull) {
      const hasValidMerge = newGrid.some((val, idx) => {
        if (val === null) return false;
        return getNeighbors(idx).some((n) => {
          const nval = newGrid[n];
          if (nval === null) return false;
          if (nval === val) return true;
          const larger  = Math.max(val, nval);
          const smaller = Math.min(val, nval);
          return larger % smaller === 0;
        });
      });
      if (!hasValidMerge) {
        setGameOver(true);
        localStorage.removeItem("gameState");
      }
    }
  }

  // ── Keep tile ──────────────────────────────────────────
  function keepTile() {
    if (keepVal === null) {
      setKeepVal(queue[0]);
      setQueue([...queue.slice(1), getRandomTile()]);
    } else {
      const top      = queue[0];
      const newQueue = [...queue];
      newQueue[0]    = keepVal;
      setKeepVal(top);
      setQueue(newQueue);
    }
  }

  // ── Trash tile ─────────────────────────────────────────
  function trashTile(e) {
    e?.stopPropagation();
    if (trashCount <= 0) return;
    addLog(`Trashed ${queue[0]}`);
    setQueue([...queue.slice(1), getRandomTile()]);
    setTrashCount((prev) => { addLog(`Trash left: ${prev - 1}`); return prev - 1; });
  }

  // ── Undo ───────────────────────────────────────────────
  function undoMove() {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setGrid(last.grid);
    setQueue(last.queue);
    setScore(last.score);
    setTrashCount(last.trashCount);
    setKeepVal(last.keepVal);
    setUndoStack((prev) => prev.slice(0, -1));
    setSelectedTile(null);
    addLog(`↩️ Undo`);
  }

  // ── Hint ───────────────────────────────────────────────
  function showHint() {
    if (!hintsEnabled || hintCount <= 0 || gameOver) return;
    const current  = queue[0];
    let bestIndex  = null;
    let bestGained = -1;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] !== null) continue;
      const testGrid = [...grid];
      testGrid[i]    = current;
      let gained     = 0;
      for (let n of getNeighbors(i)) {
        const val = testGrid[n];
        if (val === null) continue;
        if (val === current) { gained = 5; break; }
        const larger  = Math.max(val, current);
        const smaller = Math.min(val, current);
        if (larger % smaller === 0) gained = Math.max(gained, 3);
      }
      if (gained > bestGained) { bestGained = gained; bestIndex = i; }
    }
    setHintCell(bestIndex);
    setHintCount((prev) => prev - 1);
  }

  // ── Drag ───────────────────────────────────────────────
  function handleDragStart(e, num) {
    e.dataTransfer.setData("text/plain", String(num));
    e.dataTransfer.effectAllowed = "move";
    setSelectedTile(0);
  }

  // ── Effects ────────────────────────────────────────────

  // Timer
  useEffect(() => {
    if (!gameStarted || gameOver || paused) return;
    const interval = setInterval(() => setTime((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [gameStarted, gameOver, paused]);

  // Level up every 10 points
  useEffect(() => {
    const newLevel = Math.floor(score / 10) + 1;
    if (newLevel > level) {
      setLevel(newLevel);
      setTrashCount((prev) => prev + 1);
      setShowLevelUp(true);
      addLog(`🎉 Level Up! Now Level ${newLevel}`);
    }
  }, [score, level]);

  // Auto-hide level up popup
  useEffect(() => {
    if (!showLevelUp) return;
    const t = setTimeout(() => setShowLevelUp(false), 3000);
    return () => clearTimeout(t);
  }, [showLevelUp]);

  // Best score persistence
  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem("bestScore", String(score));
    }
  }, [score]);

  // Save game state
  useEffect(() => {
    if (!gameStarted) return;
    localStorage.setItem("gameState", JSON.stringify(
      { grid, queue, score, level, trashCount, keepVal, time }
    ));
  }, [grid, queue, score, level, trashCount, keepVal, time, gameStarted]);

  // Load saved state on mount
  useEffect(() => {
    const saved = localStorage.getItem("gameState");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        setGrid(s.grid); setQueue(s.queue); setScore(s.score);
        setLevel(s.level); setTrashCount(s.trashCount);
        setKeepVal(s.keepVal); setTime(s.time);
        setGameStarted(true);
      } catch { localStorage.removeItem("gameState"); }
    } 
  }, []);

  // ── Reset ──────────────────────────────────────────────
  function resetGame() {
    setGrid(Array(16).fill(null));
    setQueue([getRandomTile(1), getRandomTile(1), getRandomTile(1)]);
    setScore(0); setTime(0); setLevel(1); setTrashCount(10);
    setGameOver(false); setGameStarted(false); setKeepVal(null);
    setHintCount(3); setHintCell(null); setUndoStack([]);
    setSelectedTile(null); setPaused(false);
    localStorage.removeItem("gameState");
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      const tag = document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "z" || e.key === "Z") {
        setUndoStack((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          setGrid(last.grid); setQueue(last.queue); setScore(last.score);
          setTrashCount(last.trashCount); setKeepVal(last.keepVal);
          setSelectedTile(null);
          return prev.slice(0, -1);
        });
      }
      if (e.key === "r" || e.key === "R") {
        setGrid(Array(16).fill(null));
        setQueue([getRandomTile(1), getRandomTile(1), getRandomTile(1)]);
        setScore(0); setTime(0); setLevel(1); setTrashCount(10);
        setGameOver(false); setGameStarted(false); setKeepVal(null);
        setHintCount(3); setHintCell(null); setUndoStack([]);
        setSelectedTile(null); setPaused(false);
        localStorage.removeItem("gameState");
      }
      if (e.key === "g" || e.key === "G") setHintsEnabled((p) => !p);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="app" style={{ backgroundImage: `url(${bgDesktop})` }}>

      {/* ── Header ── */}
      <header className="top-bar">
        {/* Pause — top left corner */}
        <button
          className="corner-btn pause-corner"
          onClick={() => setPaused((p) => !p)}
          disabled={!gameStarted || gameOver}
          title="Pause"
        >
          {paused ? "▶" : "⏸"}
        </button>

        {/* Title + timer + subtitle — center */}
        <div className="title-wrap">
          <h1>JUST DIVIDE</h1>
          <div className="timer">⏱ {formatTime(time)}</div>
          <p className="subtitle">DIVIDE WITH THE NUMBERS TO SOLVE THE ROWS AND COLUMNS.</p>
        </div>

        {/* Hint — top right corner */}
        <button
          className={`corner-btn hint-corner${!hintsEnabled ? " hint-off" : ""}`}
          onClick={showHint}
          disabled={hintCount <= 0 || !gameStarted || hintCell !== null || !hintsEnabled}
          title={`Hint (G) — ${hintsEnabled ? "ON" : "OFF"} — x${hintCount}`}
        >
          <span className="hint-q">?</span>
          <span className="hint-count">x{hintCount}</span>
        </button>
      </header>

      {/* ── Slim HUD — undo only ── */}
      <div className="hud">
        <button className="undo-btn" onClick={undoMove} disabled={undoStack.length === 0}>
          ↩️ Undo x{undoStack.length}
        </button>
      </div>

      {/* ── Pause overlay ── */}
      {paused && (
        <div className="overlay">
          <div className="score-screen">
            <h2>⏸ Paused</h2>
            <p>⏱ Time: {formatTime(time)}</p>
            <p>⭐ Score: {score}</p>
            <button onClick={() => setPaused(false)}>▶ Resume</button>
            <button className="restart-btn" onClick={resetGame}>🔄 Restart</button>
          </div>
        </div>
      )}

      <main className="game-layout">

        {/* ── Board ── */}
        <section className="board-side">
          <img
            style={{ width: "570px", zIndex: "5" }}
            src={catImg} alt="cat"
            className="cat-img"
            draggable={false}
          />

          <div className="cat-zone">
            <div className="badge-wrap left-badge">
              <img src={badgeImg} alt="" className="badge-img" draggable={false} />
              <span>LEVEL {level}</span>
            </div>
            <div className="badge-wrap right-badge">
              <img src={badgeImg} alt="" className="badge-img" draggable={false} />
              <span>SCORE {score}</span>
            </div>
          </div>

          <div className="board-frame">
            <div className="grid">
              {grid.map((value, index) => (
                <div
                  key={index}
                  draggable={false}
                  className={[
                    "cell",
                    hintCell === index                             ? "hint-cell"      : "",
                    dragOverCell === index && grid[index] === null ? "drag-over-cell" : "",
                  ].join(" ")}
                  onClick={() => placeTile(index)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCell(index); }}
                  onDragEnter={(e) => { e.preventDefault(); setDragOverCell(index); }}
                  onDragLeave={() => setDragOverCell(null)}
                  onDrop={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    setDragOverCell(null); placeTile(index);
                  }}
                >
                  <img src={slotImg} alt="" className="slot-img" draggable={false} />
                  {value !== null && (
                    <div className="tile-on-board">
                      <img src={getTileImage(value)} alt="" className="real-tile-img" draggable={false} />
                      <span>{value}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Panel ── */}
        <aside className="panel">

          {/* Keep */}
          <div
            className="keep-zone"
            onClick={keepTile}
            onDragOver={(e) => e.preventDefault()}
            onDrop={keepTile}
          >
            <div className="keep-slot">
              {keepVal !== null && (
                <>
                  <img src={getTileImage(keepVal)} alt="" className="queue-tile-img" draggable={false} />
                  <span>{keepVal}</span>
                </>
              )}
            </div>
            <p className="keep-label">KEEP</p>
          </div>

          {/* Queue — 3 tiles vertical */}
          <div className="queue">
            {queue.slice(0, 3).map((num, i) => (
              <div
                key={i}
                className={[
                  "tile queue-tile",
                  i === 0 ? "active-tile" : "preview-tile",
                  selectedTile === 0 && i === 0 ? "selected-tile" : "",
                ].join(" ")}
                draggable={i === 0}
                onDragStart={(e) => i === 0 && handleDragStart(e, num)}
                onDragEnd={() => setDragOverCell(null)}
                onClick={() => i === 0 && setSelectedTile(0)}
              >
                <img
                  src={getTileImage(num)}
                  alt=""
                  className={`queue-tile-img${i > 0 ? " grey-tile" : ""}`}
                  draggable={false}
                />
                <span>{num}</span>
              </div>
            ))}
          </div>

          {/* Trash */}
          <div
            className="trash-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={trashTile}
            onClick={trashTile}
          >
            <p className="trash-label">TRASH</p>
            <div className="special-tile">
              <img src={redTile} alt="" className="queue-tile-img" draggable={false} />
              <span>🗑 x{trashCount}</span>
            </div>
          </div>

        </aside>

      </main>

      {/* ── Level up popup ── */}
      {showLevelUp && (
        <div className="levelup-popup">🎉 LEVEL UP! Now Level {level}</div>
      )}

      {/* ── Game over overlay ── */}
      {gameOver && (
        <div className="overlay">
          <div className="score-screen">
            <h2>Game Over!</h2>
            <p>🏆 Level: {level}</p>
            <p>⏱ Time: {formatTime(time)}</p>
            <p>⭐ Score: {score}</p>
            <p>🥇 Best: {bestScore}</p>
            <button onClick={resetGame}>Play Again</button>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;