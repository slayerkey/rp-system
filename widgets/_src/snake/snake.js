(() => {
  "use strict";

  const CREATOR_URL = "https://marketplace.elgato.com/maker/packrat";
  const STORAGE_FIELD = "packratSnake";
  const SCORE_PER_FOOD = 10;
  const INPUT_QUEUE_LIMIT = 2;

  const SLOT_CONFIGS = {
    "s-h": { cols: 32, rows: 11 },
    "s-v": { cols: 24, rows: 12 },
    "m-h": { cols: 24, rows: 18 },
    "m-v": { cols: 18, rows: 24 },
    "l-h": { cols: 42, rows: 16 },
    "l-v": { cols: 16, rows: 42 },
    "xl-h": { cols: 64, rows: 16 },
    "xl-v": { cols: 16, rows: 64 }
  };

  const VECTORS = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }
  };
  const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
  const ARROW_KEYS = { ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left" };

  const els = {
    body: document.body,
    boardShell: document.getElementById("boardShell"),
    canvas: document.getElementById("gameCanvas"),
    score: document.getElementById("scoreValue"),
    highScore: document.getElementById("highScoreValue"),
    status: document.getElementById("statusText"),
    speed: document.getElementById("speedLabel"),
    hint: document.getElementById("controlHint"),
    pause: document.getElementById("pauseButton"),
    restart: document.getElementById("restartButton"),
    primary: document.getElementById("primaryButton"),
    overlayKicker: document.getElementById("overlayKicker"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    packrat: document.getElementById("packratLink"),
    touchZones: Array.from(document.querySelectorAll(".touch-zone"))
  };
  const ctx = els.canvas.getContext("2d", { alpha: false });

  let slot = detectSlot();
  let config = SLOT_CONFIGS[slot];
  let snake = [];
  let direction = "right";
  let inputQueue = [];
  let food = null;
  let score = 0;
  let highScore = 0;
  let state = "ready";
  let timer = 0;
  let boardMetrics = { width: 0, height: 0, cell: 1, ox: 0, oy: 0, dpr: 1 };
  let pointerStart = null;
  let destroyed = false;

  function detectSlot() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w >= 2200) return "xl-h";
    if (h >= 2200) return "xl-v";
    if (w >= 1400) return "l-h";
    if (h >= 1400) return "l-v";
    if (h < 500 && w >= 780) return "s-h";
    if (h < 500) return "s-v";
    if (w >= 780) return "m-h";
    return "m-v";
  }

  function readIcueProperty(name, fallback) {
    try {
      if (Object.prototype.hasOwnProperty.call(window, name)) {
        const value = window[name];
        if (value !== undefined && value !== null && value !== "") return value;
      }
    } catch (_) {}
    return fallback;
  }

  function storageKey() {
    try {
      return typeof uniqueId !== "undefined" && uniqueId ? String(uniqueId) : "com.packrat.snake.preview";
    } catch (_) {
      return "com.packrat.snake.preview";
    }
  }

  function readStorageRoot() {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeStorageRoot(root) {
    try { localStorage.setItem(storageKey(), JSON.stringify(root)); } catch (_) {}
  }

  function loadPersistence() {
    const root = readStorageRoot();
    const saved = root[STORAGE_FIELD];
    if (!saved || typeof saved !== "object") return;
    highScore = Math.max(0, Number(saved.highScore) || 0);
    const snap = saved.snapshot;
    if (!snap || snap.slot !== slot || !Array.isArray(snap.snake) || !snap.snake.length) return;
    if (!isValidSnapshot(snap)) return;
    snake = snap.snake.map(p => ({ x: p.x, y: p.y }));
    food = snap.food && Number.isInteger(snap.food.x) && Number.isInteger(snap.food.y)
      ? { x: snap.food.x, y: snap.food.y }
      : chooseFood(snake, config.cols, config.rows);
    score = Math.max(0, Number(snap.score) || 0);
    direction = VECTORS[snap.direction] ? snap.direction : "right";
    inputQueue = [];
    state = "paused";
  }

  function isValidSnapshot(snap) {
    const seen = new Set();
    for (const p of snap.snake) {
      if (!p || !Number.isInteger(p.x) || !Number.isInteger(p.y)) return false;
      if (p.x < 0 || p.y < 0 || p.x >= config.cols || p.y >= config.rows) return false;
      const key = `${p.x},${p.y}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
    if (snap.food) {
      if (!Number.isInteger(snap.food.x) || !Number.isInteger(snap.food.y)) return false;
      if (snap.food.x < 0 || snap.food.y < 0 || snap.food.x >= config.cols || snap.food.y >= config.rows) return false;
      if (seen.has(`${snap.food.x},${snap.food.y}`)) return false;
    }
    return true;
  }

  function savePersistence() {
    const root = readStorageRoot();
    root[STORAGE_FIELD] = {
      highScore,
      snapshot: (state === "playing" || state === "paused")
        ? { slot, snake, food, score, direction, state: "paused" }
        : null
    };
    writeStorageRoot(root);
  }

  function initialSnake() {
    const len = Math.max(4, Math.min(7, Math.floor(config.cols / 7)));
    const cy = Math.floor(config.rows / 2);
    const cx = Math.max(len + 1, Math.floor(config.cols * 0.28));
    const body = [];
    for (let i = 0; i < len; i++) body.push({ x: cx - i, y: cy });
    return body;
  }

  function chooseFood(occupied, cols, rows, random = Math.random) {
    const taken = new Set(occupied.map(p => `${p.x},${p.y}`));
    const freeCount = cols * rows - taken.size;
    if (freeCount <= 0) return null;
    let target = Math.min(freeCount - 1, Math.floor(Math.max(0, Math.min(.999999999, Number(random()) || 0)) * freeCount));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (taken.has(`${x},${y}`)) continue;
        if (target === 0) return { x, y };
        target--;
      }
    }
    return null;
  }

  function resetGame(nextState = "ready") {
    clearTimer();
    config = SLOT_CONFIGS[slot];
    snake = initialSnake();
    direction = "right";
    inputQueue = [];
    score = 0;
    food = chooseFood(snake, config.cols, config.rows);
    state = nextState;
    updateUI();
    draw();
    savePersistence();
  }

  function startGame() {
    if (state === "paused" && snake.length) {
      state = "playing";
    } else if (state === "gameover" || state === "won" || state === "ready") {
      resetGame("playing");
    } else {
      state = "playing";
    }
    updateUI();
    scheduleNext();
    savePersistence();
  }

  function pauseGame() {
    if (state === "playing") {
      state = "paused";
      clearTimer();
      savePersistence();
    } else if (state === "paused") {
      state = "playing";
      scheduleNext();
    }
    updateUI();
    draw();
  }

  function queueDirection(next) {
    if (!VECTORS[next] || state !== "playing") return false;
    const basis = inputQueue.length ? inputQueue[inputQueue.length - 1] : direction;
    if (next === basis || next === OPPOSITE[basis]) return false;
    if (inputQueue.length >= INPUT_QUEUE_LIMIT) return false;
    inputQueue.push(next);
    flashDirection(next);
    return true;
  }

  function flashDirection(next) {
    const zone = els.touchZones.find(el => el.dataset.direction === next);
    if (!zone) return;
    zone.classList.add("is-active");
    setTimeout(() => zone.classList.remove("is-active"), 90);
  }

  function step() {
    if (state !== "playing") return;
    if (inputQueue.length) direction = inputQueue.shift();
    const v = VECTORS[direction];
    const head = snake[0];
    const next = { x: head.x + v.x, y: head.y + v.y };

    if (next.x < 0 || next.y < 0 || next.x >= config.cols || next.y >= config.rows) {
      finish("gameover");
      return;
    }

    const eating = food && next.x === food.x && next.y === food.y;
    const collisionBody = eating ? snake : snake.slice(0, -1);
    if (collisionBody.some(p => p.x === next.x && p.y === next.y)) {
      finish("gameover");
      return;
    }

    snake.unshift(next);
    if (eating) {
      score += SCORE_PER_FOOD;
      highScore = Math.max(highScore, score);
      food = chooseFood(snake, config.cols, config.rows);
      if (!food) {
        finish("won");
        return;
      }
    } else {
      snake.pop();
    }

    updateUI();
    draw();
    savePersistence();
    scheduleNext();
  }

  function finish(reason) {
    clearTimer();
    state = reason;
    highScore = Math.max(highScore, score);
    inputQueue = [];
    updateUI();
    draw();
    savePersistence();
  }

  function speedLevel() {
    return Math.min(10, 1 + Math.floor(score / 40));
  }

  function tickInterval() {
    return Math.max(68, 205 - (speedLevel() - 1) * 15);
  }

  function scheduleNext() {
    clearTimer();
    if (state !== "playing" || destroyed) return;
    timer = window.setTimeout(step, tickInterval());
  }

  function clearTimer() {
    if (timer) window.clearTimeout(timer);
    timer = 0;
  }

  function updateUI() {
    els.body.dataset.state = state;
    els.body.dataset.slot = slot;
    els.score.textContent = String(score);
    els.highScore.textContent = String(highScore);
    els.speed.textContent = `SPEED ${speedLevel()}`;

    const theme = String(readIcueProperty("themePreset", "matrix"));
    els.body.dataset.theme = ["matrix","ice","ember","mono"].includes(theme) ? theme : "matrix";
    const guides = Boolean(readIcueProperty("showTouchGuides", true));
    els.body.dataset.guides = guides ? "on" : "off";

    if (state === "ready") {
      els.status.textContent = "READY";
      els.overlayKicker.textContent = "CLASSIC GAME";
      els.overlayTitle.textContent = "Snake";
      els.overlayText.textContent = "Swipe, tap the edge arrows, or use your keyboard arrow keys. Eat. Grow. Don't fold.";
      els.primary.textContent = "Play";
    } else if (state === "playing") {
      els.status.textContent = "LIVE";
    } else if (state === "paused") {
      els.status.textContent = "PAUSED";
      els.overlayKicker.textContent = `SCORE ${score}`;
      els.overlayTitle.textContent = "Paused";
      els.overlayText.textContent = "Your run is saved locally. Resume whenever you're ready.";
      els.primary.textContent = "Resume";
    } else if (state === "gameover") {
      els.status.textContent = "GAME OVER";
      els.overlayKicker.textContent = score >= highScore && score > 0 ? "NEW BEST" : `SCORE ${score}`;
      els.overlayTitle.textContent = "Game over";
      els.overlayText.textContent = score ? `You reached ${score}. The next run starts clean.` : "That wall was closer than it looked.";
      els.primary.textContent = "Play again";
    } else if (state === "won") {
      els.status.textContent = "BOARD CLEARED";
      els.overlayKicker.textContent = "PERFECT RUN";
      els.overlayTitle.textContent = "You filled it.";
      els.overlayText.textContent = `Final score: ${score}. There is literally nowhere left to put food.`;
      els.primary.textContent = "Play again";
    }
  }

  function resizeCanvas() {
    slot = detectSlot();
    const newConfig = SLOT_CONFIGS[slot];
    const changedGrid = config && (newConfig.cols !== config.cols || newConfig.rows !== config.rows);
    config = newConfig;
    els.body.dataset.slot = slot;

    const rect = els.boardShell.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    els.canvas.width = Math.max(1, Math.floor(width * dpr));
    els.canvas.height = Math.max(1, Math.floor(height * dpr));
    els.canvas.style.width = `${width}px`;
    els.canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cell = Math.min(width / config.cols, height / config.rows);
    const boardWidth = cell * config.cols;
    const boardHeight = cell * config.rows;
    boardMetrics = {
      width,
      height,
      cell,
      ox: (width - boardWidth) / 2,
      oy: (height - boardHeight) / 2,
      dpr
    };

    if (changedGrid && snake.length) {
      highScore = Math.max(highScore, score);
      resetGame(state === "playing" ? "paused" : "ready");
    } else {
      draw();
    }
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rr);
  }

  function draw() {
    if (!ctx || !boardMetrics.width) return;
    const { width, height, cell, ox, oy } = boardMetrics;
    const styles = getComputedStyle(els.body);
    const bg = styles.getPropertyValue("--bg").trim() || "#030705";
    const accent = styles.getPropertyValue("--accent").trim() || "#2be86a";
    const foodColor = styles.getPropertyValue("--food").trim() || "#f5ff58";
    const gridColor = styles.getPropertyValue("--grid").trim() || "rgba(255,255,255,.035)";

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= config.cols; x++) {
      const px = Math.round(ox + x * cell) + .5;
      ctx.moveTo(px, oy);
      ctx.lineTo(px, oy + config.rows * cell);
    }
    for (let y = 0; y <= config.rows; y++) {
      const py = Math.round(oy + y * cell) + .5;
      ctx.moveTo(ox, py);
      ctx.lineTo(ox + config.cols * cell, py);
    }
    ctx.stroke();

    if (food) {
      const cx = ox + (food.x + .5) * cell;
      const cy = oy + (food.y + .5) * cell;
      const r = Math.max(3.2, cell * .25);
      ctx.save();
      ctx.shadowColor = foodColor;
      ctx.shadowBlur = Math.min(18, cell * .55);
      ctx.fillStyle = foodColor;
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      roundRect(-r, -r, r * 2, r * 2, Math.max(2, r * .34));
      ctx.fill();
      ctx.restore();
    }

    for (let i = snake.length - 1; i >= 0; i--) {
      const p = snake[i];
      const pad = Math.max(1.2, cell * .10);
      const x = ox + p.x * cell + pad;
      const y = oy + p.y * cell + pad;
      const size = Math.max(1, cell - pad * 2);
      const alpha = i === 0 ? 1 : Math.max(.28, .86 - i * .018);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = accent;
      roundRect(x, y, size, size, Math.max(2, cell * .22));
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (snake[0]) {
      const head = snake[0];
      const cx = ox + (head.x + .5) * cell;
      const cy = oy + (head.y + .5) * cell;
      const v = VECTORS[direction];
      const side = { x: -v.y, y: v.x };
      const forward = cell * .18;
      const spread = cell * .15;
      const eyeR = Math.max(1.2, cell * .045);
      ctx.fillStyle = "#001d09";
      for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + v.x * forward + side.x * spread * sign, cy + v.y * forward + side.y * spread * sign, eyeR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function directionFromGesture(dx, dy) {
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return null;
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
    return dy > 0 ? "down" : "up";
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
    try { els.boardShell.setPointerCapture(event.pointerId); } catch (_) {}
  }

  function onPointerUp(event) {
    if (!pointerStart || (pointerStart.id !== undefined && event.pointerId !== pointerStart.id)) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    const next = directionFromGesture(dx, dy);
    if (next) {
      event.preventDefault();
      queueDirection(next);
    }
  }

  function onKeyDown(event) {
    const next = ARROW_KEYS[event.key];
    if (!next) return;
    if (event.repeat) return;
    event.preventDefault();
    queueDirection(next);
  }

  function openCreatorPage() {
    try {
      if (window.plugins && window.plugins.Linkprovider && typeof pluginLinkprovider_initialized !== "undefined" && pluginLinkprovider_initialized) {
        window.plugins.Linkprovider.open(CREATOR_URL);
        return;
      }
    } catch (_) {}
    try { window.open(CREATOR_URL, "_blank"); } catch (_) {}
  }

  function wireEvents() {
    els.primary.addEventListener("click", startGame);
    els.pause.addEventListener("click", pauseGame);
    els.restart.addEventListener("click", () => resetGame("ready"));
    els.packrat.addEventListener("click", openCreatorPage);

    for (const zone of els.touchZones) {
      zone.addEventListener("pointerdown", event => {
        event.preventDefault();
        event.stopPropagation();
        if (state === "ready" || state === "gameover" || state === "won") startGame();
        queueDirection(zone.dataset.direction);
      });
    }

    els.boardShell.addEventListener("pointerdown", onPointerDown);
    els.boardShell.addEventListener("pointerup", onPointerUp);
    els.boardShell.addEventListener("pointercancel", () => { pointerStart = null; });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pagehide", savePersistence);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state === "playing") pauseGame();
    });
  }

  function applyIcueUpdate() {
    updateUI();
    draw();
  }

  function setFixture(fixture) {
    clearTimer();
    if (fixture.slot && SLOT_CONFIGS[fixture.slot]) {
      slot = fixture.slot;
      config = SLOT_CONFIGS[slot];
      els.body.dataset.slot = slot;
    }
    if (Array.isArray(fixture.snake)) snake = fixture.snake.map(p => ({ x: p.x, y: p.y }));
    if (fixture.food === null) food = null;
    else if (fixture.food) food = { x: fixture.food.x, y: fixture.food.y };
    if (Number.isFinite(fixture.score)) score = fixture.score;
    if (Number.isFinite(fixture.highScore)) highScore = fixture.highScore;
    if (fixture.direction && VECTORS[fixture.direction]) direction = fixture.direction;
    inputQueue = Array.isArray(fixture.inputQueue) ? fixture.inputQueue.filter(x => VECTORS[x]).slice(0, INPUT_QUEUE_LIMIT) : [];
    if (fixture.state) state = fixture.state;
    updateUI();
    draw();
  }

  const qaApi = {
    getState: () => ({
      slot, config: { ...config }, snake: snake.map(p => ({...p})), food: food ? {...food} : null,
      score, highScore, direction, inputQueue: [...inputQueue], state, interval: tickInterval(),
      metrics: { ...boardMetrics }
    }),
    queueDirection,
    step,
    reset: (next = "ready") => resetGame(next),
    start: startGame,
    pause: pauseGame,
    setFixture,
    save: savePersistence,
    chooseFood: (occupied, cols, rows, randomValue = .5) =>
      chooseFood(occupied, cols, rows, () => randomValue),
    draw,
    benchmark: (iterations = 250) => {
      const start = performance.now();
      for (let i = 0; i < iterations; i++) draw();
      const totalMs = performance.now() - start;
      return { iterations, totalMs, averageMs: totalMs / iterations };
    }
  };
  window.__PACKRAT_SNAKE__ = qaApi;

  function init() {
    config = SLOT_CONFIGS[slot];
    snake = initialSnake();
    direction = "right";
    inputQueue = [];
    score = 0;
    food = chooseFood(snake, config.cols, config.rows);
    state = "ready";
    loadPersistence();
    wireEvents();
    updateUI();
    resizeCanvas();
    draw();
  }

  window.icueEvents = {
    onICUEInitialized: applyIcueUpdate,
    onDataUpdated: applyIcueUpdate
  };

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(els.boardShell);
  }

  init();
})();
