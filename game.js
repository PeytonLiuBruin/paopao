(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const curtain = document.getElementById("curtain");
  const startButton = document.getElementById("startButton");
  const titleMark = document.querySelector(".title-mark");
  const startTransition = document.getElementById("startTransition");
  const endStats = document.getElementById("endStats");
  const waterFill = document.getElementById("waterFill");
  const waterValue = document.getElementById("waterValue");
  const waterBlock = document.querySelector(".water-block");
  const comboChip = document.getElementById("comboChip");
  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("timeValue");
  const difficultyEl = document.getElementById("difficultyLevel");
  const clearSkillButton = document.getElementById("clearSkill");
  const clearSkillValue = document.getElementById("clearSkillValue");
  const bubbleAtlas = new Image();
  bubbleAtlas.src = "./assets/bubble-atlas.png";
  const bubbleSpriteCell = 256;
  const bubbleSpriteCols = 5;

  const palette = [
    { name: "湖雾蓝", color: "#8ebfcb", deep: "#5f91a0", light: "#d5e9ee" },
    { name: "雾玫粉", color: "#d9a2b2", deep: "#a87584", light: "#f1d4dc" },
  ];

  const openTone = makeOpenTone();
  const clearTone = makeClearTone();
  const whiteTone = makeWhiteTone();
  const bombTone = makeBombTone();
  const boundaryTone = "#c9b7d7";
  const waterDrainStart = 2.15;
  const waterDrainPeak = 11.4;
  const comboBaseWindow = 2350;
  const comboMinWindow = 1450;
  const decolorDuration = 4200;
  const decolorWarningMs = 1500;
  const clearSkillMaxUses = 3;
  const edgeCycle = ["left", "right", "bottom", "top"];
  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    running: false,
    lastTime: 0,
    visualTime: 0,
    elapsed: 0,
    score: 0,
    poppedCount: 0,
    water: 76,
    combo: 0,
    bestCombo: 0,
    comboPulse: 0,
    comboUntil: 0,
    clearSkillCharge: 1,
    clearSkillUses: 0,
    difficultyTier: 0,
    difficultyFlash: 0,
    openPopCount: 0,
    colorCursor: 0,
    edgeCursor: 0,
    nextPowerAt: 9500,
    nextStreamAt: 18000,
    nextSpawnAt: 0,
    openUntil: 0,
    flash: 0,
    bubbles: [],
    particles: [],
    ripples: [],
    blasts: [],
    floaters: [],
    hints: [],
    activePointerId: null,
    lastSwipeX: 0,
    lastSwipeY: 0,
  };

  let audioContext;
  let introRunning = false;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    state.width = Math.max(1, rect.width);
    state.height = Math.max(1, rect.height);
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickColorIndex() {
    return Math.floor(Math.random() * palette.length);
  }

  function colorWithAlpha(hex, alpha) {
    const value = hex.replace("#", "");
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function mixHex(a, b, amount) {
    const read = (hex, start) => parseInt(hex.slice(start, start + 2), 16);
    const ar = read(a, 1);
    const ag = read(a, 3);
    const ab = read(a, 5);
    const br = read(b, 1);
    const bg = read(b, 3);
    const bb = read(b, 5);
    const blend = (x, y) => Math.round(x + (y - x) * amount).toString(16).padStart(2, "0");
    return `#${blend(ar, br)}${blend(ag, bg)}${blend(ab, bb)}`;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function backgroundBoundaryForY(y, time = state.visualTime) {
    const ny = state.height > 0 ? y / state.height : 0.5;
    return (
      0.5 +
      Math.sin(time / 22000) * 0.1 +
      Math.sin(ny * Math.PI * 1.55 + time / 15000) * 0.11 +
      Math.sin(ny * Math.PI * 3.2 - time / 26000) * 0.035
    );
  }

  function displayDifficultyLevel() {
    return Math.min(5, Math.floor(state.elapsed / 20000) + 1);
  }

  function backgroundFlowStage() {
    const seconds = state.elapsed / 1000;
    return Math.min(
      4,
      smoothstep(40, 58, seconds) +
        smoothstep(80, 104, seconds) +
        smoothstep(120, 150, seconds) +
        smoothstep(160, 196, seconds),
    );
  }

  function highFlowAmount() {
    return smoothstep(66, 126, state.elapsed / 1000);
  }

  function rotatedBackgroundPoint(nx, ny, time = state.visualTime) {
    const stage = backgroundFlowStage();
    if (stage <= 0) return { x: nx, y: ny };
    const cx = nx - 0.5;
    const cy = ny - 0.5;
    const seconds = state.elapsed / 1000;
    const highFlow = highFlowAmount();
    const slowRotation = (time / (210000 - stage * 14000)) * (0.45 + stage * 0.07);
    const fullTurn = highFlow * Math.max(0, seconds - 66) * ((Math.PI * 2) / 230);
    const angle = slowRotation + fullTurn;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: 0.5 + cx * cos - cy * sin,
      y: 0.5 + cx * sin + cy * cos,
    };
  }

  function backgroundMixAt(x, y, time = state.visualTime) {
    const nx = state.width > 0 ? x / state.width : 0.5;
    const ny = state.height > 0 ? y / state.height : 0.5;
    const stage = backgroundFlowStage();
    const rotated = rotatedBackgroundPoint(nx, ny, time);
    const fx = rotated.x;
    const fy = rotated.y;
    const cx = nx - 0.5;
    const cy = ny - 0.5;
    const d = difficulty();
    const boundary = backgroundBoundaryForY(y, time);
    const wave = smoothstep(0.08, 0.5, d);
    const stageMix = stage / 4;
    const highFlow = highFlowAmount();
    const radius = Math.hypot(cx, cy);
    const angle = Math.atan2(cy, cx);
    const diagonal = wave * (fy - 0.5) * (0.2 + Math.sin(time / 36000) * 0.055);
    const primaryFlow = smoothstep(0.16, 0.76, d) * Math.sin((fx * 0.72 + fy * 0.52) * Math.PI * 2 + time / 28000) * 0.12;
    const secondaryFlow = smoothstep(0.42, 1, d) * Math.sin((fx * 1.05 - fy * 0.58) * Math.PI * 2 - time / 42000) * 0.055;
    const broadSwell = wave * Math.sin((fx * 0.36 + fy * 0.92) * Math.PI * 2 - time / 48000) * 0.06;
    const rotationalRibbon =
      stage > 0
        ? Math.sin((fx * (0.62 + stage * 0.05) - fy * 0.42) * Math.PI * 2 + time / (62000 + stage * 9000)) *
          (0.018 + stageMix * 0.038)
        : 0;
    const slowCurl =
      stage > 1
        ? Math.sin((Math.hypot(cx, cy) * (1.08 + stage * 0.12) + fx * 0.18 - fy * 0.16) * Math.PI * 2 - time / 92000) *
          (0.012 + stageMix * 0.026)
        : 0;
    const orbitSwell =
      highFlow *
      Math.sin(angle + radius * Math.PI * 2.35 - time / 112000) *
      (0.012 + stageMix * 0.018);
    const wideCurrent =
      highFlow *
      Math.sin((fx * 0.3 + fy * 0.72) * Math.PI * 2 + Math.sin(time / 98000) * 0.86) *
      (0.016 + stageMix * 0.015);
    const counterCurrent =
      smoothstep(2.15, 3.7, stage) *
      Math.sin((fx * 0.74 - fy * 0.2 + radius * 0.14) * Math.PI * 2 - time / 156000) *
      0.018;
    const field =
      fx +
      diagonal +
      primaryFlow +
      secondaryFlow +
      broadSwell +
      rotationalRibbon +
      slowCurl +
      orbitSwell +
      wideCurrent +
      counterCurrent;
    const softness =
      0.23 +
      smoothstep(0.25, 1, d) * 0.035 +
      stageMix * 0.018 +
      highFlow * 0.018 +
      Math.sin(time / 32000) * 0.012;
    return smoothstep(boundary - softness, boundary + softness, field);
  }

  function backgroundColorIndexAt(x, y) {
    return backgroundMixAt(x, y) >= 0.5 ? 1 : 0;
  }

  function matchingPointForColor(colorIndex, preferredY = null) {
    const top = Math.min(128, state.height * 0.2);
    const bottom = Math.max(top + 30, state.height - 118);
    const y = clamp(preferredY ?? rand(top, bottom), top, bottom);
    const padding = Math.max(44, Math.min(state.width * 0.16, 72));
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const x = rand(padding, state.width - padding);
      if (backgroundColorIndexAt(x, y) === colorIndex) {
        return { x, y };
      }
    }

    const fallbackY = y;
    for (let x = padding; x <= state.width - padding; x += 18) {
      if (backgroundColorIndexAt(x, fallbackY) === colorIndex) {
        return { x, y: fallbackY };
      }
    }

    return { x: colorIndex === 0 ? padding : state.width - padding, y };
  }

  function matchingPointForColorFromEdge(colorIndex, edge, preferredY = null, preferredX = null) {
    const padding = Math.max(44, Math.min(state.width * 0.16, 72));
    const top = Math.min(128, state.height * 0.2);
    const bottom = Math.max(top + 30, state.height - 118);
    let minX = padding;
    let maxX = state.width - padding;
    let minY = top;
    let maxY = bottom;

    if (edge === "left") minX = Math.max(minX, state.width * 0.48);
    if (edge === "right") maxX = Math.min(maxX, state.width * 0.52);
    if (edge === "top") minY = Math.max(minY, state.height * 0.46);
    if (edge === "bottom") maxY = Math.min(maxY, state.height * 0.54);

    const fixedY = edge === "left" || edge === "right" ? clamp(preferredY ?? rand(top, bottom), top, bottom) : null;
    const fixedX = edge === "top" || edge === "bottom" ? clamp(preferredX ?? rand(padding, state.width - padding), padding, state.width - padding) : null;

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const x = fixedX ?? rand(minX, maxX);
      const y = fixedY ?? rand(minY, maxY);
      if (backgroundColorIndexAt(x, y) === colorIndex) {
        return { x, y };
      }
    }

    if (fixedY !== null) {
      for (let x = minX; x <= maxX; x += 16) {
        if (backgroundColorIndexAt(x, fixedY) === colorIndex) {
          return { x, y: fixedY };
        }
      }
    }

    if (fixedX !== null) {
      for (let y = minY; y <= maxY; y += 16) {
        if (backgroundColorIndexAt(fixedX, y) === colorIndex) {
          return { x: fixedX, y };
        }
      }
    }

    return matchingPointForColor(colorIndex, preferredY);
  }

  function aimedVelocity(fromX, fromY, target, speed, noise = 14) {
    const dx = target.x - fromX;
    const dy = target.y - fromY;
    const length = Math.max(1, Math.hypot(dx, dy));
    return {
      vx: (dx / length) * speed + rand(-noise, noise),
      vy: (dy / length) * speed + rand(-noise, noise),
    };
  }

  function pickBalancedColorIndex() {
    const colorIndex = state.colorCursor;
    state.colorCursor = 1 - state.colorCursor;
    return colorIndex;
  }

  function pickSpawnEdge(preferred = null) {
    if (preferred) return preferred;
    if (Math.random() < 0.78) {
      const edge = edgeCycle[state.edgeCursor % edgeCycle.length];
      state.edgeCursor += 1;
      return edge;
    }
    return edgeCycle[Math.floor(Math.random() * edgeCycle.length)];
  }

  function comboWaterBonus() {
    return Math.min(7, Math.floor(Math.max(0, state.combo - 1) / 4));
  }

  function comboScoreBonus() {
    return Math.min(4, Math.floor(Math.max(0, state.combo - 1) / 5));
  }

  function comboWindow() {
    return Math.max(comboMinWindow, comboBaseWindow - Math.min(620, state.combo * 22));
  }

  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function scoreBreakdown() {
    const seconds = Math.max(0, Math.floor(state.elapsed / 1000));
    const timeScore = seconds;
    const comboScore = state.bestCombo * 5;
    const popScore = state.score;
    return {
      timeScore,
      comboScore,
      popScore,
      total: timeScore + comboScore + popScore,
    };
  }

  function comboProgress() {
    if (state.combo <= 0 || state.comboUntil <= state.elapsed) return 0;
    return clamp((state.comboUntil - state.elapsed) / comboWindow(), 0, 1);
  }

  function chargeClearSkill(amount) {
    if (state.clearSkillUses >= clearSkillMaxUses) {
      state.clearSkillCharge = 0;
      return;
    }
    state.clearSkillCharge = clamp(state.clearSkillCharge + amount, 0, 1);
  }

  function registerCombo({ chargeSkill = true } = {}) {
    if (state.combo > 0 && state.comboUntil <= state.elapsed) {
      resetCombo();
    }
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.comboPulse = 1;
    state.comboUntil = state.elapsed + comboWindow();
    if (chargeSkill && state.combo > 1) {
      chargeClearSkill(0.022 + Math.min(0.028, state.combo * 0.0032));
    }
  }

  function resetCombo() {
    state.combo = 0;
    state.comboPulse = 0;
    state.comboUntil = 0;
  }

  function makeOpenTone() {
    return {
      name: "全",
      color: mixHex(palette[0].color, palette[1].color, 0.5),
      deep: mixHex(palette[0].deep, palette[1].deep, 0.48),
      light: mixHex(palette[0].light, palette[1].light, 0.46),
    };
  }

  function makeClearTone() {
    return {
      name: "清",
      color: mixHex(palette[0].light, palette[1].light, 0.5),
      deep: mixHex(palette[0].deep, palette[1].deep, 0.5),
      light: "#f7fbfa",
    };
  }

  function makeWhiteTone() {
    return {
      name: "白",
      color: "#f7fbfa",
      deep: "#bfd0d4",
      light: "#ffffff",
    };
  }

  function makeBombTone() {
    return {
      name: "爆",
      color: "#b7adb8",
      deep: "#6f6673",
      light: "#f0e8ee",
    };
  }

  function updateHud() {
    const water = Math.round(Math.max(0, Math.min(100, state.water)));
    const openActive = state.openUntil > state.elapsed && state.running;
    waterFill.style.width = `${water}%`;
    waterValue.textContent = `${water}%`;
    waterBlock.classList.toggle("low", water <= 28);
    waterBlock.classList.toggle("pulse", state.comboPulse > 0.16);
    waterBlock.classList.toggle("open", openActive);
    comboChip.style.setProperty("--combo-left", comboProgress().toFixed(3));
    comboChip.classList.toggle("active", state.combo > 1);
    comboChip.classList.toggle("expiring", state.combo > 1 && comboProgress() < 0.32);
    comboChip.textContent = openActive
      ? state.combo > 1
        ? `续水 x${state.combo}`
        : "续水"
      : state.combo > 1
        ? `连击 x${state.combo}`
        : "";
    scoreEl.textContent = String(state.score);
    timeEl.textContent = formatTime(state.elapsed);
    if (difficultyEl) {
      difficultyEl.textContent = `Lv ${displayDifficultyLevel()}`;
    }
    const skillReady = state.clearSkillCharge >= 1 && state.clearSkillUses < clearSkillMaxUses;
    clearSkillButton.style.setProperty("--clear-charge", state.clearSkillCharge.toFixed(3));
    clearSkillButton.classList.toggle("ready", skillReady);
    clearSkillButton.disabled = !state.running || !skillReady;
    clearSkillValue.textContent =
      state.clearSkillUses >= clearSkillMaxUses ? "DONE" : skillReady ? "READY" : `${Math.round(state.clearSkillCharge * 100)}%`;
  }

  function resetGame() {
    state.running = true;
    state.lastTime = performance.now();
    state.elapsed = 0;
    state.score = 0;
    state.poppedCount = 0;
    state.water = 76;
    resetCombo();
    state.bestCombo = 0;
    state.clearSkillCharge = 1;
    state.clearSkillUses = 0;
    state.difficultyTier = 0;
    state.difficultyFlash = 0;
    state.openPopCount = 0;
    state.colorCursor = pickColorIndex();
    state.edgeCursor = Math.floor(rand(0, edgeCycle.length));
    state.nextPowerAt = 9500;
    state.nextStreamAt = 40000;
    state.nextSpawnAt = 240;
    state.openUntil = 0;
    state.flash = 0;
    state.bubbles = [];
    state.particles = [];
    state.ripples = [];
    state.blasts = [];
    state.floaters = [];
    state.hints = [];
    state.activePointerId = null;
    state.lastSwipeX = 0;
    state.lastSwipeY = 0;
    if (titleMark) {
      titleMark.textContent = "泡泡补水";
    }
    updateHud();
    curtain.classList.add("hidden");
    endStats.textContent = "";
  }

  function endGame() {
    if (!state.running) return;
    state.running = false;
    curtain.classList.remove("hidden");
    if (titleMark) {
      titleMark.textContent = "游戏结束";
    }
    startButton.textContent = "再来";
    const stats = scoreBreakdown();
    const rows = [
      ["时间分数", `${formatTime(state.elapsed)}  +${stats.timeScore}`],
      ["最高连击分数", `x${state.bestCombo}  +${stats.comboScore}`],
      ["戳破泡泡数分数", `${state.poppedCount}个  +${stats.popScore}`],
      ["总分", stats.total],
    ];
    endStats.replaceChildren(
      ...rows.map(([label, value]) => {
        const row = document.createElement("span");
        const name = document.createElement("b");
        const score = document.createElement("strong");
        name.textContent = label;
        score.textContent = value;
        row.append(name, score);
        return row;
      }),
    );
  }

  function difficulty() {
    const seconds = state.elapsed / 1000;
    const timePart = smoothstep(8, 128, seconds);
    const scorePart = smoothstep(24, 280, state.score);
    return clamp(timePart * 0.9 + scorePart * 0.28, 0, 1);
  }

  function difficultyTier(value) {
    return Math.min(5, Math.floor(state.elapsed / 20000));
  }

  function triggerDifficultyUp(tier) {
    state.difficultyTier = tier;
    state.difficultyFlash = 1;
    state.flash = Math.max(state.flash, 0.3);
  }

  function waterDrainRate() {
    const seconds = state.elapsed / 1000;
    const warmup = smoothstep(4, 32, seconds);
    const climb = smoothstep(30, 132, seconds);
    const latePush = smoothstep(112, 230, seconds);
    const scorePressure = smoothstep(45, 230, state.score) * 1.35;
    return Math.min(waterDrainPeak, waterDrainStart + warmup * 2.25 + climb * 4.05 + latePush * 3.35 + scorePressure);
  }

  function bubbleRadiusRange(d, kind = "normal") {
    const shrink = smoothstep(0.04, 1, d);
    const ranges = {
      normal: [47, 55, 27, 35],
      small: [35, 42, 20, 27],
      stream: [18, 22, 17, 20],
      cluster: [36, 44, 23, 31],
      fan: [28, 35, 19, 25],
    };
    const [startMin, startMax, endMin, endMax] = ranges[kind] ?? ranges.normal;
    const min = startMin + (endMin - startMin) * shrink;
    const max = startMax + (endMax - startMax) * shrink;
    return {
      min: Math.max(15, min),
      max: Math.max(17, max),
    };
  }

  function radiusForDifficulty(d, kind = "normal") {
    const range = bubbleRadiusRange(d, kind);
    return rand(range.min, range.max);
  }

  function radiusJitter(d, base = 0.04, extra = 0.11) {
    const amount = base + smoothstep(0.34, 1, d) * extra;
    return rand(1 - amount, 1 + amount);
  }

  function pickBubbleSprite(colorIndex, radius, isStream) {
    const base = colorIndex === 1 ? 5 : 0;
    if (isStream || radius < 24) {
      return base + (Math.random() < 0.68 ? 2 : 1);
    }
    if (radius < 34) {
      return base + (Math.random() < 0.54 ? 1 : 4);
    }
    const choices = [0, 0, 1, 3, 4];
    return base + choices[Math.floor(rand(0, choices.length))];
  }

  function spawnBubble(forceSmall = false, forcedKind = null, options = {}) {
    const d = difficulty();
    const margin = 72;
    const edge = pickSpawnEdge(options.edge);
    const kind = forcedKind === "open" ? "normal" : (forcedKind ?? "normal");
    const isSuper = false;
    const isClear = kind === "clear";
    const isBleach = kind === "bleach";
    const isBomb = kind === "bomb";
    const forcedSize = options.sizeKind ?? null;
    const smallWave =
      options.isStream ||
      forcedSize === "small" ||
      (forcedSize !== "normal" && (forceSmall || (d > 0.58 && Math.random() < (d - 0.42) * 0.34)));
    const radius = options.radius ?? radiusForDifficulty(d, smallWave ? "small" : "normal");
    const speed = options.speed ?? rand(24 + d * 18, 50 + d * 42);
    let x;
    let y;

    if (options.x !== undefined && options.y !== undefined) {
      x = options.x;
      y = options.y;
    } else if (edge === "left") {
      x = -radius;
      y = rand(margin, state.height - margin);
    } else if (edge === "right") {
      x = state.width + radius;
      y = rand(margin, state.height - margin);
    } else if (edge === "bottom") {
      x = rand(margin, state.width - margin);
      y = state.height + radius;
    } else {
      x = rand(margin, state.width - margin);
      y = -radius;
    }

    const colorIndex = kind === "normal" ? (options.colorIndex ?? pickBalancedColorIndex()) : -1;
    const spriteColorIndex = colorIndex >= 0 ? colorIndex : pickColorIndex();
    const spriteIndex = options.spriteIndex ?? pickBubbleSprite(spriteColorIndex, radius, smallWave);
    const target =
      options.target ??
      (kind === "normal"
        ? matchingPointForColorFromEdge(colorIndex, edge, y, x)
        : {
            x: rand(state.width * 0.24, state.width * 0.76),
            y: rand(state.height * 0.24, state.height * 0.72),
          });
    const velocity = options.velocity ?? aimedVelocity(x, y, target, speed, kind === "normal" ? 12 : 26);
    state.bubbles.push({
      x,
      y,
      vx: velocity.vx,
      vy: velocity.vy,
      steerTarget: target,
      retargetAt: rand(1.2, 2.2),
      hasEntered: false,
      spriteIndex,
      skinRotation: rand(-0.22, 0.22),
      skinSpin: rand(-0.18, 0.18),
      skinPhase: rand(0, Math.PI * 2),
      radius,
      baseRadius: radius,
      colorIndex,
      isSuper,
      isClear,
      isBleach,
      isBomb,
      isWhite: Boolean(options.isWhite),
      whiteUntil: options.whiteUntil ?? 0,
      restoreState: null,
      isStream: Boolean(options.isStream),
      streamPattern: options.streamPattern ?? "float",
      streamPhase: options.streamPhase ?? rand(0, Math.PI * 2),
      streamAmplitude: options.streamAmplitude ?? 0,
      streamFrequency: options.streamFrequency ?? 3.6,
      openReady: false,
      wobble: rand(0, Math.PI * 2),
      wobbleSpeed: options.isStream ? rand(0.6, 1.05) : rand(1.1, 2.2),
      drift: options.isStream ? rand(-0.28, 0.28) : rand(-1, 1),
      age: -(options.delay ?? 0),
      wasReady: false,
      spin: rand(-1.6, 1.6),
      edge,
    });

    const hintColor = isBomb
      ? bombTone.light
      : isBleach
        ? whiteTone.light
        : isClear
          ? clearTone.color
          : isSuper
            ? openTone.color
            : palette[colorIndex].color;
    if (!options.quietHint) {
      makeSpawnHint(edge, x, y, radius, hintColor, 0.46);
    }
  }

  function pointFromEdge(edge, radius, offset) {
    const margin = Math.max(64, Math.min(92, state.width * 0.2));
    if (edge === "left") return { x: -radius, y: clamp(offset, margin, state.height - margin) };
    if (edge === "right") return { x: state.width + radius, y: clamp(offset, margin, state.height - margin) };
    if (edge === "top") return { x: clamp(offset, margin, state.width - margin), y: -radius };
    return { x: clamp(offset, margin, state.width - margin), y: state.height + radius };
  }

  function makeSpawnHint(edge, x, y, radius, color, alpha = 0.36, count = 1) {
    const size = clamp(radius * (3.15 + Math.min(2.35, Math.sqrt(count) * 0.5)), 34, 124);
    const depth = clamp(radius * (1.55 + Math.min(1.05, count * 0.04)), 22, 62);
    const inset = Math.max(12, depth * 0.62);
    const hintX = edge === "left" ? inset : edge === "right" ? state.width - inset : clamp(x, 0, state.width);
    const hintY = edge === "top" ? inset : edge === "bottom" ? state.height - inset : clamp(y, 0, state.height);
    state.hints.push({
      edge,
      x: hintX,
      y: hintY,
      size,
      depth,
      color,
      alpha,
      age: 0,
    });
  }

  function spawnBubbleStream(d) {
    const edge = pickSpawnEdge();
    const streamLevel = displayDifficultyLevel();
    const sameColorStream = streamLevel < 5;
    const streamColorIndex = sameColorStream ? pickBalancedColorIndex() : null;
    const pattern = sameColorStream ? "spray" : d > 0.38 && Math.random() < 0.46 + d * 0.2 ? "zigzag" : "spray";
    const count = Math.round(rand(15 + d * 4, 22 + d * 6));
    const radius = radiusForDifficulty(d, "stream");
    const cadence = sameColorStream ? rand(0.044, 0.06) : rand(0.052, 0.078);
    const laneGap = radius * rand(1.55, 1.85);
    const anchor =
      edge === "left" || edge === "right"
        ? rand(116, state.height - 132)
        : rand(102, state.width - 102);
    const speed = sameColorStream ? rand(96 + d * 14, 116 + d * 24) : rand(76 + d * 18, 100 + d * 36);
    const horizontal = edge === "left" || edge === "right";
    const mainX = edge === "left" ? 1 : edge === "right" ? -1 : 0;
    const mainY = edge === "top" ? 1 : edge === "bottom" ? -1 : 0;
    const perpX = horizontal ? 0 : 1;
    const perpY = horizontal ? 1 : 0;
    const nozzle = pointFromEdge(edge, radius, anchor);

    makeSpawnHint(edge, nozzle.x, nozzle.y, radius, sameColorStream ? palette[streamColorIndex].light : clearTone.light, 0.4, count);

    for (let i = 0; i < count; i += 1) {
      const colorIndex = sameColorStream ? streamColorIndex : pickBalancedColorIndex();
      const pulse = Math.floor(i / 2);
      const lane = i % 2 === 0 ? -1 : 1;
      const weave = Math.sin(pulse * 0.72) * radius * 0.18;
      const laneOffset = lane * laneGap * 0.52 + weave;
      const forwardOffset = pulse * radius * 0.24 + (i % 2) * radius * 0.08;
      const start = {
        x: nozzle.x - mainX * forwardOffset + perpX * laneOffset,
        y: nozzle.y - mainY * forwardOffset + perpY * laneOffset,
      };
      const crossOffset = -lane * laneGap * (1.55 + d * 0.2) + Math.sin(pulse * 0.58) * 16;
      const preferredY = horizontal ? start.y + crossOffset : null;
      const target = matchingPointForColorFromEdge(colorIndex, edge, preferredY, start.x + crossOffset);
      const velocity = aimedVelocity(start.x, start.y, target, speed + pulse * 0.8, 3);
      velocity.vx += perpX * -lane * (12 + d * 6);
      velocity.vy += perpY * -lane * (12 + d * 6);
      spawnBubble(true, "normal", {
        edge,
        x: start.x,
        y: start.y,
        colorIndex,
        target,
        velocity,
        radius: radius * (1 + lane * 0.018) * radiusJitter(d, 0.02, 0.04),
        speed,
        isStream: true,
        streamPattern: pattern,
        streamPhase: pulse * 0.72 + lane * 0.42,
        streamAmplitude: pattern === "zigzag" ? 8 + d * 12 : 4 + d * 6,
        streamFrequency: pattern === "zigzag" ? 4.4 + d * 1.2 : 2.8 + d,
        delay: pulse * cadence + (i % 2) * cadence * 0.36,
        quietHint: true,
      });
    }
  }

  function spawnBubbleCluster(d) {
    const edge = pickSpawnEdge();
    const count = Math.round(rand(2, 3 + d * 2));
    const radius = radiusForDifficulty(d, "cluster");
    const spacing = radius * rand(0.72, 1.04);
    const anchor =
      edge === "left" || edge === "right"
        ? rand(92, state.height - 104)
        : rand(82, state.width - 82);

    const hintPoint = pointFromEdge(edge, radius, anchor);
    makeSpawnHint(edge, hintPoint.x, hintPoint.y, radius, palette[state.colorCursor].light, 0.38, count);

    for (let i = 0; i < count; i += 1) {
      const colorIndex = pickBalancedColorIndex();
      const offset = anchor + (i - (count - 1) / 2) * spacing;
      const start = pointFromEdge(edge, radius, offset);
      const target = matchingPointForColorFromEdge(colorIndex, edge, edge === "left" || edge === "right" ? start.y : null, start.x);
      spawnBubble(false, "normal", {
        edge,
        x: start.x,
        y: start.y,
        colorIndex,
        target,
        radius: radius * radiusJitter(d, 0.035, 0.085),
        speed: rand(28 + d * 18, 48 + d * 32),
        quietHint: true,
      });
    }
  }

  function spawnBubbleFan(d) {
    const edge = pickSpawnEdge();
    const count = Math.round(rand(3, 4 + d * 2));
    const radius = radiusForDifficulty(d, "fan");
    const anchor =
      edge === "left" || edge === "right"
        ? rand(96, state.height - 112)
        : rand(86, state.width - 86);
    const start = pointFromEdge(edge, radius, anchor);

    makeSpawnHint(edge, start.x, start.y, radius, clearTone.light, 0.36, count);

    for (let i = 0; i < count; i += 1) {
      const colorIndex = pickBalancedColorIndex();
      const spread = (i - (count - 1) / 2) * rand(34, 52);
      const preferredY = edge === "left" || edge === "right" ? start.y + spread : null;
      const target = matchingPointForColorFromEdge(colorIndex, edge, preferredY, start.x + spread);
      const speed = rand(48 + d * 24, 70 + d * 36);
      const velocity = aimedVelocity(start.x, start.y, target, speed, 6);
      spawnBubble(true, "normal", {
        edge,
        x: start.x,
        y: start.y,
        colorIndex,
        target,
        velocity,
        radius: radius * radiusJitter(d, 0.035, 0.075),
        speed,
        isStream: true,
        streamPattern: "fan",
        streamPhase: i * 0.52,
        streamAmplitude: 6 + d * 8,
        streamFrequency: 2.4 + d,
        quietHint: true,
      });
    }
  }

  function spawnWave() {
    const d = difficulty();
    const baseInterval = Math.max(600, 1500 - d * 610 - Math.min(120, state.score * 1.15));
    state.nextSpawnAt = state.elapsed + baseInterval * rand(0.86, 1.24);

    if (displayDifficultyLevel() >= 3 && state.elapsed >= state.nextStreamAt && state.bubbles.length <= 15) {
      spawnBubbleStream(d);
      state.nextStreamAt = state.elapsed + rand(13000 - d * 3800, 21000 - d * 5600);
      return;
    }

    if (state.bubbles.length <= 13) {
      const varietyRoll = Math.random();
      if (d > 0.14 && varietyRoll < 0.18 + d * 0.12) {
        spawnBubbleCluster(d);
        return;
      }
      if (d > 0.32 && varietyRoll < 0.3 + d * 0.1) {
        spawnBubbleFan(d);
        return;
      }
    }

    let count = 1;
    if (d > 0.62 && Math.random() < (d - 0.5) * 0.36) count += Math.floor(rand(2, 4 + d * 2.4));
    if (d > 0.86 && Math.random() < 0.18) count += Math.floor(rand(2, 4));

    if (state.elapsed >= state.nextPowerAt && state.bubbles.length >= 2 && state.bubbles.length <= 18) {
      spawnBubble(false, Math.random() < 0.52 ? "bomb" : "bleach");
      state.nextPowerAt = state.elapsed + rand(11000 - d * 2800, 18000 - d * 3800);
    }

    const normalAnchorIndex = count > 1 ? Math.floor(rand(0, count)) : -1;
    for (let index = 0; index < count; index += 1) {
      const smallChance = clamp(0.08 + d * 0.48 + (index > 0 ? 0.1 : 0) + (count > 3 ? 0.08 : 0), 0.08, 0.7);
      const sizeKind = index === normalAnchorIndex ? "normal" : Math.random() < smallChance ? "small" : null;
      spawnBubble(false, null, { sizeKind });
    }
  }

  function activateOpenMode(x, y) {
    state.openUntil = Math.max(state.openUntil, state.elapsed + 6200);
    state.openPopCount = 0;
    state.flash = Math.max(state.flash, 0.38);
    state.bubbles.forEach((bubble) => {
      bubble.isSuper = false;
      bubble.openReady = true;
    });
    for (let index = 0; index < 26; index += 1) {
      makeParticle(x, y, openTone.color, rand(80, 260), rand(0, Math.PI * 2), rand(0.45, 0.95), true);
    }
    state.ripples.push({ x, y, radius: 12, age: 0, life: 0.7, color: openTone.color, power: 1.25 });
  }

  function activateClearScreen(origin) {
    const cleared = [];
    const waiting = [];
    state.bubbles.forEach((bubble) => {
      if (bubble.age >= 0) {
        cleared.push(bubble);
      } else {
        waiting.push(bubble);
      }
    });
    state.bubbles = waiting;
    for (let i = 0; i < cleared.length; i += 1) {
      registerCombo({ chargeSkill: false });
    }
    state.poppedCount += cleared.length;
    state.score += cleared.length;
    state.water = Math.min(100, state.water + Math.min(28, 10 + cleared.length * 2 + comboWaterBonus()));
    state.nextSpawnAt = Math.min(state.nextSpawnAt, state.elapsed + rand(240, 520));
    state.flash = Math.max(state.flash, 0.64);
    state.ripples.push({ x: origin.x, y: origin.y, radius: origin.radius, age: 0, life: 0.82, color: clearTone.color, power: 1.2 });

    cleared.forEach((bubble, index) => {
      const color = bubble.colorIndex >= 0 ? palette[bubble.colorIndex] : openTone;
      state.ripples.push({
        x: bubble.x,
        y: bubble.y,
        radius: bubble.radius * 0.42,
        age: 0,
        life: 0.36,
        color: color.color,
      });

      if (index < 14) {
        for (let i = 0; i < 5; i += 1) {
          makeParticle(
            bubble.x,
            bubble.y,
            i % 2 === 0 ? clearTone.light : color.light,
            rand(90, 240),
            rand(0, Math.PI * 2),
            rand(0.32, 0.7),
            i === 0,
          );
        }
      }
    });

    for (let i = 0; i < 42; i += 1) {
      makeParticle(origin.x, origin.y, clearTone.color, rand(130, 330), rand(0, Math.PI * 2), rand(0.42, 0.92), i % 3 === 0);
    }
  }

  function useClearSkill() {
    if (!state.running || state.clearSkillUses >= clearSkillMaxUses || state.clearSkillCharge < 1 || state.bubbles.length <= 0) return;
    state.clearSkillUses += 1;
    state.clearSkillCharge = 0;
    activateClearScreen({
      x: 54,
      y: Math.max(80, state.height - 70),
      radius: 32,
    });
    if (navigator.vibrate) {
      navigator.vibrate(28);
    }
    playPop("clear");
    updateHud();
  }

  function decolorBubbles(origin) {
    let changed = 0;
    state.bubbles.forEach((bubble) => {
      if (bubble.age < 0) {
        return;
      }
      if (!bubble.restoreState) {
        bubble.restoreState = {
          colorIndex: bubble.colorIndex,
          isSuper: bubble.isSuper,
          isBomb: bubble.isBomb,
          isBleach: bubble.isBleach,
          isClear: bubble.isClear,
          openReady: bubble.openReady,
          wasReady: bubble.wasReady,
        };
      }
      bubble.isWhite = true;
      bubble.isSuper = false;
      bubble.isBomb = false;
      bubble.isBleach = false;
      bubble.isClear = false;
      bubble.colorIndex = -1;
      bubble.openReady = true;
      bubble.whiteUntil = state.elapsed + decolorDuration;
      changed += 1;
      state.ripples.push({
        x: bubble.x,
        y: bubble.y,
        radius: bubble.radius * 0.34,
        age: 0,
        life: 0.28,
        color: whiteTone.color,
        power: 0.72,
      });
    });

    state.flash = Math.max(state.flash, 0.22);
    makeFloatText(origin.x, origin.y - origin.radius, `去色 ${changed}`, whiteTone.light, 1.08);
    for (let i = 0; i < 24; i += 1) {
      makeParticle(origin.x, origin.y, whiteTone.light, rand(80, 210), rand(0, Math.PI * 2), rand(0.26, 0.58), i % 5 === 0);
    }
  }

  function restoreDecoloredBubble(bubble) {
    const restore = bubble.restoreState;
    if (!restore) return;
    bubble.isWhite = false;
    bubble.colorIndex = restore.colorIndex;
    bubble.isSuper = restore.isSuper;
    bubble.isBomb = restore.isBomb;
    bubble.isBleach = restore.isBleach;
    bubble.isClear = restore.isClear;
    bubble.openReady = restore.openReady;
    bubble.wasReady = restore.wasReady;
    bubble.whiteUntil = 0;
    bubble.restoreState = null;
    state.ripples.push({
      x: bubble.x,
      y: bubble.y,
      radius: bubble.radius * 0.3,
      age: 0,
      life: 0.22,
      color: bubble.colorIndex >= 0 ? palette[bubble.colorIndex].light : openTone.light,
      power: 0.52,
    });
  }

  function startBombBlast(origin) {
    state.blasts.push({
      x: origin.x,
      y: origin.y,
      radius: 10,
      maxRadius: Math.max(state.width, state.height) * 0.78,
      speed: 520,
      age: 0,
      life: 1.15,
    });
    state.flash = Math.max(state.flash, 0.18);
    state.ripples.push({ x: origin.x, y: origin.y, radius: 18, age: 0, life: 0.48, color: bombTone.light, power: 1.1 });
    for (let i = 0; i < 26; i += 1) {
      makeParticle(origin.x, origin.y, i % 2 === 0 ? bombTone.light : whiteTone.light, rand(90, 260), rand(0, Math.PI * 2), rand(0.28, 0.62), i % 6 === 0);
    }
  }

  function popSoundKindForBubble(bubble) {
    if (bubble.isBomb || bubble.isSuper) return "super";
    if (bubble.isBleach || bubble.isClear) return "clear";
    return bubble.baseRadius <= 27 || bubble.isStream ? "small" : "large";
  }

  function burstBubbleByBlast(bubble, index) {
    const color = bubble.isWhite
      ? whiteTone
      : bubble.isBleach
        ? whiteTone
        : bubble.isBomb
          ? bombTone
          : bubble.isSuper || bubble.colorIndex < 0
            ? openTone
            : palette[bubble.colorIndex];
    state.bubbles.splice(index, 1);
    state.poppedCount += 1;
    registerCombo({ chargeSkill: false });
    state.score += bubble.isWhite ? 1 : 1;
    state.water = Math.min(100, state.water + (bubble.isWhite ? 1.5 : 2));
    state.ripples.push({
      x: bubble.x,
      y: bubble.y,
      radius: bubble.radius * 0.4,
      age: 0,
      life: 0.24,
      color: color.light,
      power: 0.72,
    });
    for (let i = 0; i < 5; i += 1) {
      makeParticle(bubble.x, bubble.y, color.light, rand(70, 190), rand(0, Math.PI * 2), rand(0.18, 0.38), i === 0);
    }
    playPop(popSoundKindForBubble(bubble), rand(0, 0.045));
  }

  function makeParticle(x, y, color, speed, angle, life, sparkle = false) {
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - rand(18, 58),
      radius: sparkle ? rand(2, 5) : rand(2.2, 6.2),
      color,
      age: 0,
      life,
      gravity: sparkle ? 96 : 180,
      sparkle,
    });
  }

  function makeFloatText(x, y, text, color, scale = 1) {
    state.floaters.push({
      x,
      y,
      text,
      color,
      scale,
      age: 0,
      life: 0.78,
      vy: -34,
    });
  }

  function makePunctureSplash(bubble, hitX, hitY, color, amount, isSmall, isSuper) {
    const dx = hitX - bubble.x;
    const dy = hitY - bubble.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const direction = distance > bubble.radius * 0.12 ? Math.atan2(dy, dx) : rand(-Math.PI, Math.PI);
    const originX = bubble.x + Math.cos(direction) * Math.min(distance, bubble.radius * 0.72);
    const originY = bubble.y + Math.sin(direction) * Math.min(distance, bubble.radius * 0.72);

    state.ripples.push({
      x: originX,
      y: originY,
      radius: bubble.radius * (isSmall ? 0.22 : 0.34),
      age: 0,
      life: isSuper ? 0.62 : isSmall ? 0.26 : 0.42,
      color: color.color,
      power: isSuper ? 1.25 : isSmall ? 0.66 : 0.86,
      puncture: true,
      angle: direction,
    });

    for (let i = 0; i < amount; i += 1) {
      const spread = isSmall ? 1.35 : 1.65;
      const angle = direction + rand(-spread, spread);
      const speed = isSmall ? rand(80, 178) : rand(72, isSuper ? 290 : 238);
      const life = isSmall ? rand(0.2, 0.44) : rand(0.34, 0.78);
      const particleColor = i % 3 === 0 ? color.light : palette[0].light;
      makeParticle(originX, originY, particleColor, speed, angle, life, isSuper && i % 4 === 0);
    }
  }

  function popBubble(bubble, index, hitX = bubble.x, hitY = bubble.y) {
    const isOpen = state.openUntil > state.elapsed;
    const isSmall = bubble.baseRadius <= 27 || bubble.isStream;
    const color = bubble.isWhite
      ? whiteTone
      : bubble.isBomb
        ? bombTone
        : bubble.isBleach
          ? whiteTone
          : bubble.isClear
      ? clearTone
      : bubble.isSuper || bubble.colorIndex === -1
        ? openTone
        : palette[bubble.colorIndex];
    state.bubbles.splice(index, 1);
    state.poppedCount += 1;
    registerCombo();

    if (bubble.isClear) {
      makeFloatText(bubble.x, bubble.y - bubble.radius, `x${state.combo} 清屏`, clearTone.light, 1.08);
      activateClearScreen(bubble);
      if (navigator.vibrate) {
        navigator.vibrate(34);
      }
      playPop("clear");
      updateHud();
      return;
    }

    if (bubble.isBleach) {
      state.score += 1;
      state.water = Math.min(100, state.water + 6);
      decolorBubbles(bubble);
      if (navigator.vibrate) {
        navigator.vibrate(18);
      }
      playPop("clear");
      updateHud();
      return;
    }

    if (bubble.isBomb) {
      state.score += 1;
      state.water = Math.min(100, state.water + 4);
      makeFloatText(bubble.x, bubble.y - bubble.radius, "扩散", bombTone.light, 1.08);
      startBombBlast(bubble);
      if (navigator.vibrate) {
        navigator.vibrate(24);
      }
      playPop("super");
      updateHud();
      return;
    }

    if (isOpen && !bubble.isSuper) {
      state.openPopCount += 1;
    }

    const waterGain = bubble.isWhite
      ? isSmall ? 1.5 : 2.5
      : bubble.isSuper
      ? 16
      : isOpen
        ? 7 + comboWaterBonus()
        : (isSmall ? 4 : 6) + comboWaterBonus();
    const scoreGain = bubble.isWhite
      ? 1
      : bubble.isSuper
      ? 8
      : isOpen
        ? state.openPopCount % 3 === 0
          ? 1
          : 0
        : 1 + comboScoreBonus();

    state.score += scoreGain;
    state.water = Math.min(100, state.water + waterGain);
    state.flash = Math.max(state.flash, bubble.isSuper ? 0.46 : isSmall ? 0.16 : 0.28);
    makeFloatText(
      bubble.x,
      bubble.y - bubble.radius * 0.72,
      bubble.isWhite ? "+1分" : state.combo > 1 ? `x${state.combo} +${waterGain}` : `+${waterGain}`,
      isOpen ? openTone.light : color.light,
      Math.min(1.34, 0.96 + state.combo * 0.012),
    );

    const amount = bubble.isSuper ? 46 : isSmall ? 9 + Math.round(bubble.radius * 0.16) : Math.round(16 + bubble.radius * 0.55);
    makePunctureSplash(bubble, hitX, hitY, color, amount, isSmall, bubble.isSuper);

    if (bubble.isSuper) {
      activateOpenMode(bubble.x, bubble.y);
    }

    if (navigator.vibrate) {
      navigator.vibrate(bubble.isSuper ? 28 : isSmall ? 7 : 15);
    }
    playPop(bubble.isSuper ? "super" : isSmall ? "small" : "large");
  }

  function missBubble(bubble, index, isTap) {
    const color = bubble.colorIndex >= 0 ? palette[bubble.colorIndex] : openTone;
    state.bubbles.splice(index, 1);
    resetCombo();
    state.ripples.push({
      x: bubble.x,
      y: bubble.y,
      radius: bubble.radius * 0.36,
      age: 0,
      life: 0.22,
      color: colorWithAlpha(color.deep, 0.42),
      power: 0.42,
    });
    state.flash = Math.max(state.flash, 0.045);

    for (let i = 0; i < 6; i += 1) {
      makeParticle(
        bubble.x,
        bubble.y,
        colorWithAlpha(color.deep, 0.5),
        rand(38, 96),
        rand(0, Math.PI * 2),
        rand(0.16, 0.3),
      );
    }

    if (isTap && navigator.vibrate) {
      navigator.vibrate(6);
    }
  }

  function bubbleCheckPoint(bubble, hitX = bubble.x, hitY = bubble.y) {
    const dx = hitX - bubble.x;
    const dy = hitY - bubble.y;
    const distance = Math.hypot(dx, dy);
    const maxDistance = Math.max(1, bubble.radius * 0.96);
    if (distance <= maxDistance) {
      return { x: hitX, y: hitY };
    }
    if (distance <= 0.001) {
      return { x: bubble.x, y: bubble.y };
    }
    const amount = maxDistance / distance;
    return {
      x: bubble.x + dx * amount,
      y: bubble.y + dy * amount,
    };
  }

  function canPopBubble(bubble, hitX = bubble.x, hitY = bubble.y) {
    if (
      state.openUntil > state.elapsed ||
      bubble.isSuper ||
      bubble.isClear ||
      bubble.isBleach ||
      bubble.isBomb ||
      bubble.isWhite ||
      bubble.colorIndex === -1
    ) {
      return true;
    }

    const point = bubbleCheckPoint(bubble, hitX, hitY);
    return bubble.colorIndex === backgroundColorIndexAt(point.x, point.y);
  }

  function steerBubbleTowardMatch(bubble, dt, d) {
    if (bubble.isSuper || bubble.isClear || bubble.isBleach || bubble.isBomb || bubble.isWhite || bubble.colorIndex < 0) return;
    if (bubble.colorIndex === backgroundColorIndexAt(bubble.x, bubble.y)) {
      bubble.wasReady = true;
      return;
    }

    const urgency = smoothstep(1.15, 4.1 - d * 1.25, bubble.age);
    if (urgency <= 0) return;

    const targetExpired = !bubble.steerTarget || bubble.age >= bubble.retargetAt;
    const targetInvalid = bubble.steerTarget && backgroundColorIndexAt(bubble.steerTarget.x, bubble.steerTarget.y) !== bubble.colorIndex;
    if (targetExpired || targetInvalid) {
      bubble.steerTarget = matchingPointForColorFromEdge(bubble.colorIndex, bubble.edge, bubble.y, bubble.x);
      bubble.retargetAt = bubble.age + rand(1.1, 2.0);
    }

    const target = bubble.steerTarget;
    const speed = Math.max(28, Math.hypot(bubble.vx, bubble.vy));
    const desired = aimedVelocity(bubble.x, bubble.y, target, speed, 0);
    const correction = Math.min(0.038, dt * (0.22 + urgency * 0.92));
    bubble.vx += (desired.vx - bubble.vx) * correction;
    bubble.vy += (desired.vy - bubble.vy) * correction;
  }

  function edgeDirection(edge) {
    if (edge === "left") return { x: 1, y: 0 };
    if (edge === "right") return { x: -1, y: 0 };
    if (edge === "top") return { x: 0, y: 1 };
    return { x: 0, y: -1 };
  }

  function keepBubbleMoving(bubble, d) {
    const speed = Math.hypot(bubble.vx, bubble.vy);
    const minSpeed = bubble.isStream ? 64 + d * 28 : 30 + d * 42;
    if (speed >= minSpeed) return;

    const direction =
      speed > 4
        ? { x: bubble.vx / speed, y: bubble.vy / speed }
        : edgeDirection(bubble.edge);
    const side = Math.sin(bubble.age * 1.25 + bubble.streamPhase) * (bubble.isStream ? 4 : 6);
    const targetVx = direction.x * minSpeed - direction.y * side;
    const targetVy = direction.y * minSpeed + direction.x * side;
    bubble.vx += (targetVx - bubble.vx) * 0.18;
    bubble.vy += (targetVy - bubble.vy) * 0.18;
  }

  function separateBubbleFromNeighbors(bubble, index, d, dt) {
    let pushX = 0;
    let pushY = 0;
    for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
      if (i === index) continue;
      const other = state.bubbles[i];
      if (other.age < 0) continue;
      const dx = bubble.x - other.x;
      const dy = bubble.y - other.y;
      const minDistance = (bubble.radius + other.radius) * 0.56;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq >= minDistance * minDistance) continue;
      const distance = Math.max(0.001, Math.sqrt(distanceSq));
      const amount = (minDistance - distance) / minDistance;
      if (distance > 0.01) {
        pushX += (dx / distance) * amount;
        pushY += (dy / distance) * amount;
      } else {
        const angle = bubble.age * 2.3 + index;
        pushX += Math.cos(angle) * amount;
        pushY += Math.sin(angle) * amount;
      }
    }

    if (pushX === 0 && pushY === 0) return;
    const force = (16 + d * 18) * dt;
    bubble.vx += pushX * force;
    bubble.vy += pushY * force;
  }

  function tryPopAt(x, y, isTap) {
    for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
      const bubble = state.bubbles[i];
      if (bubble.age < 0) {
        continue;
      }
      const dx = x - bubble.x;
      const dy = y - bubble.y;
      const latePrecision = smoothstep(0.48, 1, difficulty());
      const hitPadding = isTap ? 8 - latePrecision * 4.5 : 14 - latePrecision * 6.5;
      const hitRadius = bubble.radius + hitPadding;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        if (canPopBubble(bubble, x, y)) {
          popBubble(bubble, i, x, y);
        } else {
          missBubble(bubble, i, isTap);
        }
        return true;
      }
    }

    return false;
  }

  function handlePointerDown(event) {
    event.preventDefault();
    if (!state.running) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    state.activePointerId = event.pointerId;
    state.lastSwipeX = x;
    state.lastSwipeY = y;
    canvas.setPointerCapture?.(event.pointerId);
    tryPopAt(x, y, true);
  }

  function handlePointerMove(event) {
    event.preventDefault();
    if (!state.running || state.activePointerId !== event.pointerId) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const dx = x - state.lastSwipeX;
    const dy = y - state.lastSwipeY;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / 18));

    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      tryPopAt(state.lastSwipeX + dx * t, state.lastSwipeY + dy * t, false);
    }

    state.lastSwipeX = x;
    state.lastSwipeY = y;
  }

  function handlePointerEnd(event) {
    if (state.activePointerId === event.pointerId) {
      state.activePointerId = null;
      canvas.releasePointerCapture?.(event.pointerId);
    }
  }

  function update(dt) {
    if (!state.running) return;

    state.elapsed += dt * 1000;
    const d = difficulty();
    const tier = difficultyTier(d);
    if (tier > state.difficultyTier) {
      triggerDifficultyUp(tier);
    }
    state.water -= waterDrainRate() * dt;
    state.flash = Math.max(0, state.flash - dt * 1.9);
    state.difficultyFlash = Math.max(0, state.difficultyFlash - dt * 0.9);
    state.comboPulse = Math.max(0, state.comboPulse - dt * 2.6);
    if (state.combo > 0 && state.comboUntil <= state.elapsed) {
      resetCombo();
      updateHud();
    } else if (state.combo > 1) {
      comboChip.style.setProperty("--combo-left", comboProgress().toFixed(3));
      comboChip.classList.toggle("expiring", comboProgress() < 0.32);
    }

    while (state.elapsed >= state.nextSpawnAt) {
      spawnWave();
    }

    for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
      const bubble = state.bubbles[i];
      bubble.age += dt;
      if (bubble.age < 0) {
        continue;
      }
      if (bubble.isWhite && bubble.whiteUntil > 0 && state.elapsed >= bubble.whiteUntil) {
        restoreDecoloredBubble(bubble);
      }
      bubble.wobble += bubble.wobbleSpeed * dt;
      steerBubbleTowardMatch(bubble, dt, d);
      keepBubbleMoving(bubble, d);
      separateBubbleFromNeighbors(bubble, i, d, dt);
      const speed = Math.max(1, Math.hypot(bubble.vx, bubble.vy));
      const streamWave = bubble.isStream
        ? Math.sin(bubble.age * bubble.streamFrequency + bubble.streamPhase) *
          bubble.streamAmplitude *
          (bubble.streamPattern === "spray" ? 0.32 : 0.68)
        : 0;
      const perpX = -bubble.vy / speed;
      const perpY = bubble.vx / speed;
      const sway = Math.sin(bubble.wobble) * (bubble.isStream ? 4 + d * 5 : 12 + d * 16);
      bubble.x += (bubble.vx + sway * bubble.drift + perpX * streamWave) * dt;
      bubble.y += (bubble.vy + (bubble.isStream ? 0 : Math.cos(bubble.wobble * 0.7) * 10) + perpY * streamWave) * dt;
      bubble.radius = bubble.baseRadius * (1 + Math.sin(bubble.age * 4.2) * 0.028);

      const entered =
        bubble.x > bubble.radius * 0.25 &&
        bubble.x < state.width - bubble.radius * 0.25 &&
        bubble.y > bubble.radius * 0.25 &&
        bubble.y < state.height - bubble.radius * 0.25;
      if (entered) {
        bubble.hasEntered = true;
      } else if (!bubble.hasEntered && bubble.age > 0.18) {
        const inward = edgeDirection(bubble.edge);
        const currentSpeed = Math.max(40, Math.hypot(bubble.vx, bubble.vy));
        bubble.vx += (inward.x * currentSpeed - bubble.vx) * 0.12;
        bubble.vy += (inward.y * currentSpeed - bubble.vy) * 0.12;
      }

      const outside =
        bubble.x < -bubble.radius * 2 ||
        bubble.x > state.width + bubble.radius * 2 ||
        bubble.y < -bubble.radius * 2 ||
        bubble.y > state.height + bubble.radius * 2;

      if (outside && (bubble.hasEntered || bubble.age > 4.5)) {
        state.bubbles.splice(i, 1);
      }
    }

    for (let i = state.blasts.length - 1; i >= 0; i -= 1) {
      const blast = state.blasts[i];
      blast.age += dt;
      blast.radius += blast.speed * dt;

      for (let j = state.bubbles.length - 1; j >= 0; j -= 1) {
        const bubble = state.bubbles[j];
        if (bubble.age < 0) {
          continue;
        }
        const dx = bubble.x - blast.x;
        const dy = bubble.y - blast.y;
        const hitRadius = blast.radius + bubble.radius * 0.45;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          burstBubbleByBlast(bubble, j);
        }
      }

      if (blast.radius >= blast.maxRadius || blast.age >= blast.life) {
        state.blasts.splice(i, 1);
      }
    }

    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.age += dt;
      particle.vy += particle.gravity * dt;
      particle.vx *= 0.988;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.age >= particle.life) {
        state.particles.splice(i, 1);
      }
    }

    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const floater = state.floaters[i];
      floater.age += dt;
      floater.y += floater.vy * dt;
      floater.vy *= 0.985;
      if (floater.age >= floater.life) {
        state.floaters.splice(i, 1);
      }
    }

    for (let i = state.ripples.length - 1; i >= 0; i -= 1) {
      const ripple = state.ripples[i];
      ripple.age += dt;
      ripple.radius += dt * 220;
      if (ripple.age >= ripple.life) {
        state.ripples.splice(i, 1);
      }
    }

    for (let i = state.hints.length - 1; i >= 0; i -= 1) {
      const hint = state.hints[i];
      hint.age += dt;
      hint.alpha -= dt * 0.48;
      if (hint.alpha <= 0) {
        state.hints.splice(i, 1);
      }
    }

    if (state.water <= 0) {
      state.water = 0;
      endGame();
    }

    updateHud();
  }

  function backgroundBoundaryGuideX(y, time) {
    const baseX = backgroundBoundaryForY(y, time) * state.width;
    const ny = state.height > 0 ? y / state.height : 0.5;
    const stage = backgroundFlowStage();
    const highFlow = highFlowAmount();
    const slowOffset =
      Math.sin(ny * Math.PI * 1.35 + time / 118000) * state.width * 0.018 * highFlow +
      Math.sin(ny * Math.PI * 2.1 - time / 146000) * state.width * 0.012 * smoothstep(2, 4, stage);
    return clamp(baseX + slowOffset, state.width * 0.08, state.width * 0.92);
  }

  function backgroundBoundaryXAtY(y, time, preferredX = null) {
    const step = Math.max(8, state.width / 44);
    const guideX = backgroundBoundaryGuideX(y, time);
    const anchorX = preferredX ?? guideX;
    let previousX = 0;
    let previousValue = backgroundMixAt(previousX, y, time) - 0.5;
    let bestX = guideX;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestCrossX = null;
    let bestCrossScore = Number.POSITIVE_INFINITY;

    for (let x = step; x <= state.width + 0.1; x += step) {
      const sampleX = Math.min(x, state.width);
      const value = backgroundMixAt(sampleX, y, time) - 0.5;
      const fallbackScore =
        Math.abs(value) * 1.2 +
        (Math.abs(sampleX - anchorX) / Math.max(1, state.width)) * 0.2 +
        (Math.abs(sampleX - guideX) / Math.max(1, state.width)) * 0.08;
      if (fallbackScore < bestScore) {
        bestScore = fallbackScore;
        bestX = sampleX;
      }

      if (previousValue === 0 || value === 0 || Math.sign(previousValue) !== Math.sign(value)) {
        const amount = Math.abs(previousValue) / Math.max(0.0001, Math.abs(previousValue) + Math.abs(value));
        const crossX = previousX + (sampleX - previousX) * amount;
        const crossScore =
          Math.abs(crossX - anchorX) +
          Math.abs(crossX - guideX) * 0.25;
        if (crossScore < bestCrossScore) {
          bestCrossScore = crossScore;
          bestCrossX = crossX;
        }
      }

      previousX = sampleX;
      previousValue = value;
    }

    return bestCrossX ?? bestX;
  }

  function drawBackgroundBoundary(time, d) {
    const gap = Math.max(16, state.height / 42);
    const highFlow = highFlowAmount();
    let previousX = null;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let y = -gap; y <= state.height + gap; y += gap) {
      const x = backgroundBoundaryXAtY(y, time, previousX);
      previousX = x;
      if (y <= -gap + 0.1) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.shadowColor = colorWithAlpha(boundaryTone, 0.1);
    ctx.shadowBlur = 7 + d * 3;
    ctx.strokeStyle = colorWithAlpha(boundaryTone, 0.075 + d * 0.02 - highFlow * 0.018);
    ctx.lineWidth = 4.2 + d * 1.1;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = colorWithAlpha("#ffffff", 0.045);
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  function drawBackground() {
    const time = state.visualTime;
    const d = difficulty();
    const openAmount = state.openUntil > state.elapsed ? 0.16 : 0;
    const rowHeight = 3;
    const stops = 16;

    for (let y = 0; y < state.height; y += rowHeight) {
      const bandY = y + rowHeight * 0.5;
      const vertical = state.height > 0 ? bandY / state.height : 0.5;
      const colorA = mixHex(
        mixHex(palette[0].light, palette[0].deep, 0.16 + vertical * 0.34),
        openTone.light,
        openAmount * 0.18,
      );
      const colorB = mixHex(
        mixHex(palette[1].light, palette[1].deep, 0.15 + vertical * 0.35),
        openTone.light,
        openAmount * 0.18,
      );
      const gradient = ctx.createLinearGradient(0, 0, state.width, 0);
      for (let i = 0; i <= stops; i += 1) {
        const position = i / stops;
        const mix = smoothstep(0.03, 0.97, backgroundMixAt(position * state.width, bandY, time));
        gradient.addColorStop(position, mixHex(colorA, colorB, mix));
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, y, state.width, rowHeight + 1);
    }

    ctx.save();
    ctx.globalAlpha = 0.035 + d * 0.035;
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 5; i += 1) {
      const baseY = state.height * (0.1 + i * 0.22);
      const phase = time / (15000 + i * 2300) + i * 1.7;
      const color = i % 2 === 0 ? palette[0].light : palette[1].light;
      const thickness = 74 + d * 76 + i * 8;
      const left = -state.width * 0.16;
      const right = state.width * 1.16;
      const step = Math.max(42, state.width / 6);
      ctx.fillStyle = colorWithAlpha(color, 0.22);
      ctx.beginPath();
      for (let x = left; x <= right + 0.1; x += step) {
        const topY =
          baseY +
          Math.sin(x * 0.006 + phase) * (30 + d * 38) +
          Math.sin(x * 0.012 - phase * 0.55) * (10 + d * 14);
        if (x === left) {
          ctx.moveTo(x, topY);
        } else {
          ctx.lineTo(x, topY);
        }
      }
      for (let x = right; x >= left - 0.1; x -= step) {
        const bottomY =
          baseY +
          thickness +
          Math.sin(x * 0.005 + phase * 0.82) * (24 + d * 34) +
          Math.sin(x * 0.011 - phase * 0.47) * (8 + d * 12);
        ctx.lineTo(x, bottomY);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const stage = backgroundFlowStage();
    if (stage > 0) {
      ctx.save();
      ctx.translate(state.width * 0.5, state.height * 0.5);
      ctx.rotate((time / (170000 - stage * 14000)) * (0.6 + stage * 0.08));
      ctx.globalAlpha = 0.015 + stage * 0.006;
      ctx.globalCompositeOperation = "screen";
      const span = Math.max(state.width, state.height) * 1.55;
      for (let i = 0; i < 3; i += 1) {
        const offset = (i - 1) * span * 0.28 + Math.sin(time / (52000 + i * 9000)) * span * 0.06;
        const color = i % 2 === 0 ? palette[0].light : palette[1].light;
        const gradient = ctx.createLinearGradient(-span * 0.5, offset, span * 0.5, offset + span * 0.2);
        gradient.addColorStop(0, colorWithAlpha(color, 0));
        gradient.addColorStop(0.45, colorWithAlpha(color, 0.25));
        gradient.addColorStop(1, colorWithAlpha(color, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(-span, offset - span * 0.08);
        for (let x = -span; x <= span; x += span / 6) {
          const y = offset + Math.sin(x * 0.004 + time / (44000 + i * 6000)) * (22 + stage * 8);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(span, offset + span * 0.18);
        ctx.lineTo(-span, offset + span * 0.08);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 0.025 + d * 0.025;
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 3; i += 1) {
      const centerX =
        state.width * (0.2 + i * 0.3) +
        Math.sin(time / (18000 + i * 3200) + i * 1.4) * state.width * 0.16;
      const width = state.width * (0.54 + d * 0.16);
      const left = centerX - width * 0.5;
      const right = centerX + width * 0.5;
      const gradient = ctx.createLinearGradient(left, 0, right, 0);
      const color = i % 2 === 0 ? palette[1].light : palette[0].light;
      const step = Math.max(54, state.height / 8);
      gradient.addColorStop(0, colorWithAlpha(color, 0));
      gradient.addColorStop(0.5, colorWithAlpha(color, 0.3));
      gradient.addColorStop(1, colorWithAlpha(color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(left, -20);
      for (let y = -20; y <= state.height + 20; y += step) {
        const x = left + Math.sin(y * 0.006 + time / (21000 + i * 1900) + i) * state.width * 0.08;
        ctx.lineTo(x, y);
      }
      for (let y = state.height + 20; y >= -20; y -= step) {
        const x =
          right +
          Math.sin(y * 0.006 + time / (23000 + i * 2100) + i * 1.6) * state.width * 0.08;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    drawBackgroundBoundary(time, d);
  }

  function drawHints() {
    state.hints.forEach((hint) => {
      const alpha = Math.max(0, hint.alpha);
      const size = hint.size ?? Math.min(state.width, state.height) * 0.14;
      const depth = hint.depth ?? Math.max(18, size * 0.42);
      const x = hint.x ?? (hint.edge === "right" ? state.width : hint.edge === "left" ? 0 : state.width * 0.5);
      const y = hint.y ?? (hint.edge === "bottom" ? state.height : hint.edge === "top" ? 0 : state.height * 0.5);
      const pulse = 0.86 + Math.sin(hint.age * 8.5) * 0.08;
      const glow = ctx.createRadialGradient(x, y, 1, x, y, size * pulse);
      glow.addColorStop(0, colorWithAlpha(hint.color, alpha * 0.68));
      glow.addColorStop(0.38, colorWithAlpha(hint.color, alpha * 0.26));
      glow.addColorStop(1, colorWithAlpha(hint.color, 0));

      ctx.save();
      ctx.fillStyle = glow;
      ctx.beginPath();
      if (hint.edge === "left" || hint.edge === "right") {
        ctx.ellipse(x, y, depth, size, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(x, y, size, depth, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.lineCap = "round";
      ctx.strokeStyle = colorWithAlpha(hint.color, alpha * 0.52);
      ctx.lineWidth = Math.max(2.5, Math.min(7, depth * 0.2));
      ctx.beginPath();
      if (hint.edge === "left") {
        ctx.moveTo(1, y - size * 0.36);
        ctx.lineTo(1, y + size * 0.36);
      } else if (hint.edge === "right") {
        ctx.moveTo(state.width - 1, y - size * 0.36);
        ctx.lineTo(state.width - 1, y + size * 0.36);
      } else if (hint.edge === "top") {
        ctx.moveTo(x - size * 0.36, 1);
        ctx.lineTo(x + size * 0.36, 1);
      } else {
        ctx.moveTo(x - size * 0.36, state.height - 1);
        ctx.lineTo(x + size * 0.36, state.height - 1);
      }
      ctx.stroke();

      const beadRadius = clamp(depth * 0.22, 5, 11);
      ctx.beginPath();
      ctx.arc(x, y, beadRadius, 0, Math.PI * 2);
      ctx.fillStyle = colorWithAlpha(hint.color, alpha * 0.46);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, beadRadius * 0.48, 0, Math.PI * 2);
      ctx.fillStyle = colorWithAlpha("#ffffff", alpha * 0.36);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawProceduralBubbleBody(body, color, x, y, r) {
    ctx.shadowColor = colorWithAlpha(color.deep, 0.2);
    ctx.shadowBlur = r * 0.34;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1.5, r * 0.065);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.46)";
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(x - r * 0.28, y - r * 0.34, r * 0.22, r * 0.13, -0.55, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x + r * 0.26, y + r * 0.25, r * 0.58, Math.PI * 0.05, Math.PI * 0.55);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = Math.max(1, r * 0.045);
    ctx.stroke();
  }

  function drawBubbleSpriteBody(bubble, color, x, y, r, alpha) {
    const spriteIndex = bubble.spriteIndex ?? 0;
    const variant = spriteIndex % bubbleSpriteCols;
    const aspect =
      variant === 1
        ? { x: 0.92, y: 1.1 }
        : variant === 3
          ? { x: 1.06, y: 0.95 }
          : variant === 4
            ? { x: 0.96, y: 1.08 }
            : { x: 1, y: 1 };
    const squash = Math.sin(bubble.age * 1.32 + bubble.skinPhase) * (bubble.isStream ? 0.038 : 0.06);
    const pulse = Math.sin(bubble.age * 2.1 + bubble.skinPhase) * 0.018;
    const driftRotation =
      bubble.skinRotation +
      Math.sin(bubble.wobble * 0.54 + bubble.skinPhase) * 0.16 +
      bubble.age * bubble.skinSpin * 0.07;
    const points = bubble.isStream ? 14 : 18;
    const wobbleAmount = bubble.isStream ? 0.045 : 0.075;

    const traceShape = (scale = 1) => {
      ctx.beginPath();
      for (let i = 0; i <= points; i += 1) {
        const angle = (i / points) * Math.PI * 2;
        const wobble =
          Math.sin(angle * 2 + bubble.age * 1.35 + bubble.skinPhase) * wobbleAmount +
          Math.sin(angle * 3.2 - bubble.age * 0.92 + bubble.skinPhase * 0.7) * wobbleAmount * 0.52;
        const bias = variant === 4 ? Math.sin(angle - 0.8) * 0.045 : variant === 3 ? Math.sin(angle * 4 + 0.3) * 0.025 : 0;
        const rr = r * scale * (1 + wobble + bias + pulse);
        const px = Math.cos(angle) * rr;
        const py = Math.sin(angle) * rr;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          const prevAngle = ((i - 0.5) / points) * Math.PI * 2;
          const prevWobble =
            Math.sin(prevAngle * 2 + bubble.age * 1.35 + bubble.skinPhase) * wobbleAmount +
            Math.sin(prevAngle * 3.2 - bubble.age * 0.92 + bubble.skinPhase * 0.7) * wobbleAmount * 0.52;
          const prevBias = variant === 4 ? Math.sin(prevAngle - 0.8) * 0.045 : variant === 3 ? Math.sin(prevAngle * 4 + 0.3) * 0.025 : 0;
          const cr = r * scale * (1 + prevWobble + prevBias + pulse);
          ctx.quadraticCurveTo(Math.cos(prevAngle) * cr, Math.sin(prevAngle) * cr, px, py);
        }
      }
      ctx.closePath();
    };

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.rotate(driftRotation);
    ctx.scale(aspect.x * (1 + squash), aspect.y * (1 - squash * 0.48));

    ctx.shadowColor = colorWithAlpha(color.deep, 0.18);
    ctx.shadowBlur = r * 0.34;
    traceShape(1.02);
    const body = ctx.createRadialGradient(-r * 0.34, -r * 0.42, r * 0.08, 0, 0, r * 1.12);
    body.addColorStop(0, "rgba(255, 255, 255, 0.94)");
    body.addColorStop(0.22, colorWithAlpha(color.light, 0.76));
    body.addColorStop(0.62, colorWithAlpha(color.color, bubble.isWhite ? 0.25 : 0.42));
    body.addColorStop(1, colorWithAlpha(color.deep, 0.58));
    ctx.fillStyle = body;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.save();
    traceShape(1.03);
    ctx.clip();
    if (bubbleAtlas.complete && bubbleAtlas.naturalWidth > 0) {
      const sx = (spriteIndex % bubbleSpriteCols) * bubbleSpriteCell;
      const sy = Math.floor(spriteIndex / bubbleSpriteCols) * bubbleSpriteCell;
      const imageRadius = r * 1.55;
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha *= 0.28;
      ctx.drawImage(
        bubbleAtlas,
        sx,
        sy,
        bubbleSpriteCell,
        bubbleSpriteCell,
        -imageRadius,
        -imageRadius,
        imageRadius * 2,
        imageRadius * 2,
      );
    }
    const sheen = ctx.createLinearGradient(-r, -r, r, r);
    sheen.addColorStop(0, "rgba(255,255,255,0.34)");
    sheen.addColorStop(0.28, "rgba(255,255,255,0)");
    sheen.addColorStop(0.72, "rgba(255,255,255,0.12)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha *= 0.7;
    ctx.fillStyle = sheen;
    ctx.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8);
    ctx.restore();

    if (bubble.isWhite) {
      ctx.save();
      traceShape(1.02);
      ctx.clip();
      ctx.fillStyle = "rgba(255, 255, 255, 0.34)";
      ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
      ctx.restore();
    } else if (bubble.isSuper || bubble.isClear || bubble.isBleach || bubble.isBomb) {
      ctx.save();
      traceShape(1.02);
      ctx.clip();
      ctx.fillStyle = colorWithAlpha(color.light, 0.14);
      ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
      ctx.restore();
    }

    ctx.globalCompositeOperation = "source-over";
    traceShape(1.01);
    ctx.strokeStyle = colorWithAlpha(color.light, 0.58);
    ctx.lineWidth = Math.max(1.3, r * 0.06);
    ctx.stroke();
    traceShape(0.92);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = Math.max(1, r * 0.028);
    ctx.stroke();

    ctx.globalAlpha *= 0.72;
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.38, r * 0.25, r * 0.08, -0.62, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.36, r * 0.22, r * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fill();
    ctx.restore();

    return true;
  }

  function drawBubble(bubble) {
    if (bubble.age < 0) {
      return;
    }
    const openActive = state.openUntil > state.elapsed;
    const color = bubble.isWhite
      ? whiteTone
      : bubble.isBomb
        ? bombTone
        : bubble.isBleach
          ? whiteTone
          : bubble.isClear
            ? clearTone
            : bubble.isSuper || bubble.colorIndex === -1
              ? openTone
              : palette[bubble.colorIndex];
    const ready = canPopBubble(bubble);
    const x = bubble.x;
    const y = bubble.y;
    const r = bubble.radius;
    const whiteLeft = bubble.isWhite && bubble.whiteUntil > 0 ? Math.max(0, bubble.whiteUntil - state.elapsed) : 0;
    const whiteProgress = bubble.isWhite && bubble.whiteUntil > 0 ? clamp(whiteLeft / decolorDuration, 0, 1) : 1;
    const whiteWarning = bubble.isWhite && bubble.whiteUntil > 0 ? 1 - smoothstep(0, decolorWarningMs, whiteLeft) : 0;
    const whiteBlink = whiteWarning * (0.5 + Math.sin(state.visualTime / 82) * 0.5);
    const whiteAlpha = bubble.isWhite ? clamp(0.86 + whiteProgress * 0.1 - whiteBlink * 0.34, 0.48, 0.96) : 1;
    const body = ctx.createRadialGradient(x - r * 0.36, y - r * 0.42, r * 0.08, x, y, r);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.18, color.light);
    body.addColorStop(0.58, colorWithAlpha(color.color, 0.88));
    body.addColorStop(1, colorWithAlpha(color.deep, 0.72));

    if (bubble.isStream) {
      const speed = Math.max(1, Math.hypot(bubble.vx, bubble.vy));
      const tailX = -bubble.vx / speed;
      const tailY = -bubble.vy / speed;
      ctx.save();
      ctx.translate(x + tailX * r * 1.18, y + tailY * r * 1.18);
      ctx.rotate(Math.atan2(tailY, tailX));
      ctx.globalAlpha = 0.07 * whiteAlpha;
      ctx.fillStyle = color.light;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.48, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.13 * whiteAlpha;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(r * 0.18, -r * 0.04, Math.max(1.1, r * 0.055), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(bubble.wobble) * 0.08 + bubble.spin * 0.05);
    ctx.translate(-x, -y);

    if (bubble.isWhite && bubble.whiteUntil > 0) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(x, y, r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * whiteProgress);
      ctx.strokeStyle = colorWithAlpha(whiteTone.light, 0.34 + whiteWarning * 0.28);
      ctx.lineWidth = Math.max(2, r * 0.065);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = whiteAlpha;
    }

    if (ready) {
      ctx.shadowColor = colorWithAlpha(color.light, 0.72);
      ctx.shadowBlur = r * 0.7;
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = colorWithAlpha(color.light, 0.34 + Math.sin(state.visualTime / 520) * 0.08);
      ctx.lineWidth = Math.max(2, r * 0.055);
      ctx.stroke();
    }

    if (openActive && !bubble.isSuper && !bubble.isClear && !bubble.isBleach && !bubble.isBomb && !bubble.isWhite) {
      ctx.save();
      ctx.setLineDash([Math.max(5, r * 0.18), Math.max(4, r * 0.14)]);
      ctx.lineDashOffset = -state.visualTime * 0.018;
      ctx.beginPath();
      ctx.arc(x, y, r + 9, 0, Math.PI * 2);
      ctx.strokeStyle = colorWithAlpha(openTone.light, 0.4);
      ctx.lineWidth = Math.max(2, r * 0.045);
      ctx.stroke();
      ctx.restore();
    }

    if (!drawBubbleSpriteBody(bubble, color, x, y, r, whiteAlpha)) {
      drawProceduralBubbleBody(body, color, x, y, r);
    }

    if (bubble.isBomb) {
      drawBombMark(x, y, r);
    } else if (bubble.isBleach) {
      drawBleachMark(x, y, r);
    } else if (bubble.isClear) {
      drawClearMark(x, y, r);
    }

    ctx.restore();
  }

  function drawStar(x, y, outer, fill, stroke) {
    const inner = outer * 0.46;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? outer : inner;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.4, outer * 0.12);
    ctx.fill();
    ctx.stroke();
  }

  function drawClearMark(x, y, r) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.82)";
    ctx.lineWidth = Math.max(2.4, r * 0.09);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.28, y);
    ctx.lineTo(x + r * 0.28, y);
    ctx.moveTo(x, y - r * 0.28);
    ctx.lineTo(x, y + r * 0.28);
    ctx.stroke();

    ctx.strokeStyle = colorWithAlpha(palette[1].light, 0.52);
    ctx.lineWidth = Math.max(1.5, r * 0.045);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBleachMark(x, y, r) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - r * 0.16, y - r * 0.1, r * 0.08, 0, Math.PI * 2);
    ctx.arc(x + r * 0.12, y + r * 0.12, r * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fill();
    ctx.restore();
  }

  function drawBombMark(x, y, r) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.86)";
    ctx.fillStyle = colorWithAlpha(bombTone.deep, 0.72);
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.beginPath();
    ctx.arc(x, y + r * 0.08, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + r * 0.18, y - r * 0.16);
    ctx.quadraticCurveTo(x + r * 0.32, y - r * 0.44, x + r * 0.06, y - r * 0.48);
    ctx.stroke();
    ctx.restore();
  }

  function drawBlasts() {
    state.blasts.forEach((blast) => {
      const t = blast.age / blast.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t) * 0.58;
      ctx.strokeStyle = bombTone.light;
      ctx.lineWidth = 7 * (1 - t) + 2;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, blast.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = Math.max(0, 1 - t) * 0.16;
      ctx.fillStyle = bombTone.light;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, blast.radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawParticles() {
    state.particles.forEach((particle) => {
      const t = 1 - particle.age / particle.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = particle.color;
      if (particle.sparkle) {
        drawStar(particle.x, particle.y, particle.radius * 1.9, particle.color, "rgba(255,255,255,0.7)");
      } else {
        ctx.beginPath();
        ctx.ellipse(particle.x, particle.y, particle.radius * 0.78, particle.radius * 1.3, particle.vx * 0.006, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawRipples() {
    state.ripples.forEach((ripple) => {
      const t = ripple.age / ripple.life;
      const power = ripple.power ?? 1;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.52 * power;
      ctx.strokeStyle = ripple.color;
      ctx.lineWidth = (5 * (1 - t) + 1) * power;
      ctx.beginPath();
      if (ripple.puncture) {
        const angle = ripple.angle ?? 0;
        ctx.arc(ripple.x, ripple.y, ripple.radius, angle - 2.35, angle + 2.35);
        ctx.moveTo(ripple.x, ripple.y);
        ctx.lineTo(
          ripple.x + Math.cos(angle) * ripple.radius * (1.1 + t * 0.8),
          ripple.y + Math.sin(angle) * ripple.radius * (1.1 + t * 0.8),
        );
      } else {
        ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawFloaters() {
    state.floaters.forEach((floater) => {
      const t = floater.age / floater.life;
      const alpha = Math.max(0, 1 - t);
      const size = 18 * floater.scale;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${size}px Inter, "Microsoft YaHei", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(3, size * 0.18);
      ctx.strokeStyle = "rgba(20, 48, 66, 0.24)";
      ctx.fillStyle = floater.color;
      ctx.strokeText(floater.text, floater.x, floater.y);
      ctx.fillText(floater.text, floater.x, floater.y);
      ctx.restore();
    });
  }

  function drawWaterSurface() {
    const h = state.height;
    const level = clamp(state.water / 100, 0, 1);
    const fillHeight = Math.max(10, h * (0.018 + level * 0.022));
    const y = h - fillHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, h);
    gradient.addColorStop(0, "rgba(213, 233, 238, 0)");
    gradient.addColorStop(0.55, "rgba(213, 233, 238, 0.12)");
    gradient.addColorStop(1, "rgba(142, 191, 203, 0.18)");

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y, state.width, fillHeight);

    ctx.globalAlpha = 0.1 + level * 0.12;
    ctx.fillStyle = "#f7fbfa";
    ctx.fillRect(0, h - 2, state.width, 2);
    ctx.restore();
  }

  function drawFlash() {
    if (state.flash <= 0) return;
    ctx.save();
    ctx.globalAlpha = state.flash * 0.18;
    ctx.fillStyle = state.openUntil > state.elapsed ? openTone.light : "#ffffff";
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.restore();
  }

  function drawDifficultyBurst() {
    if (state.difficultyFlash <= 0) return;
    const t = 1 - state.difficultyFlash;
    const cx = state.width * 0.5;
    const cy = state.height * 0.5;
    const radius = Math.max(state.width, state.height) * (0.28 + t * 0.58);

    ctx.save();
    ctx.globalAlpha = state.difficultyFlash * 0.38;
    ctx.fillStyle = colorWithAlpha(clearTone.light, 0.36);
    ctx.fillRect(0, 0, state.width, state.height);

    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius + i * 42, 0, Math.PI * 2);
      ctx.strokeStyle = colorWithAlpha(i % 2 === 0 ? palette[0].light : palette[1].light, 0.62 - i * 0.14);
      ctx.lineWidth = 8 - i * 1.8;
      ctx.stroke();
    }

    ctx.globalAlpha = Math.min(1, state.difficultyFlash * 1.8);
    ctx.font = "900 24px Inter, \"Microsoft YaHei\", sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(20, 48, 66, 0.22)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeText("难度提升", cx, cy);
    ctx.fillText("难度提升", cx, cy);
    ctx.restore();
  }

  function draw() {
    drawBackground();
    drawHints();
    drawWaterSurface();
    state.bubbles.forEach(drawBubble);
    drawRipples();
    drawBlasts();
    drawParticles();
    drawFloaters();
    drawDifficultyBurst();
    drawFlash();
  }

  function loop(now) {
    const dt = Math.min(0.033, Math.max(0, (now - state.lastTime) / 1000 || 0));
    state.lastTime = now;
    state.visualTime += dt * 1000;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function playPop(kind = "large", delayOffset = 0) {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume?.();
      const now = audioContext.currentTime + delayOffset;
      const isSpecial = kind === "super" || kind === "clear";
      const comboLevel = Math.max(0, state.combo - 1);
      const pitchLift = Math.min(isSpecial ? 0.1 : 0.18, comboLevel * 0.014);
      const comboGain = 1 + Math.min(0.12, comboLevel * 0.01);
      const base = kind === "small" ? 610 : kind === "large" ? 430 : kind === "clear" ? 520 : 560;
      const chime = kind === "small" ? 1180 : kind === "large" ? 820 : kind === "clear" ? 1120 : 1200;
      const peak = (kind === "small" ? 0.018 : isSpecial ? 0.038 : 0.026) * comboGain;
      const duration = kind === "small" ? 0.078 : isSpecial ? 0.16 : 0.12;
      const lift = 1 + pitchLift;

      const playTone = (type, startFreq, endFreq, volume, length, delay = 0, attack = 0.014, cutoff = 1600) => {
        const osc = audioContext.createOscillator();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();
        const t = now + delay;
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(1, startFreq), t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + length * 0.62);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(cutoff, t);
        filter.Q.setValueAtTime(0.45, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), t + attack);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.46), t + length * 0.45);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(t);
        osc.stop(t + length + 0.02);
      };

      const playSoftClick = (volume, length, delay = 0) => {
        const sampleRate = audioContext.sampleRate;
        const buffer = audioContext.createBuffer(1, Math.max(1, Math.floor(sampleRate * length)), sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
          const fade = 1 - i / data.length;
          data[i] = (Math.random() * 2 - 1) * fade * fade * 0.55;
        }
        const source = audioContext.createBufferSource();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();
        const t = now + delay;
        source.buffer = buffer;
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(kind === "small" ? 1450 : 1050, t);
        filter.Q.setValueAtTime(0.55, t);
        gain.gain.setValueAtTime(Math.max(0.0001, volume), t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        source.start(t);
      };

      if (kind === "small") {
        playSoftClick(0.0024, 0.018);
      }
      playTone("sine", base * 1.08 * lift, base * 0.82 * lift, peak, duration, 0, 0.016, 1350);
      playTone("triangle", base * 1.55 * lift, base * 1.2 * lift, peak * 0.18, duration * 0.55, duration * 0.08, 0.018, 1500);
      if (comboLevel > 0) {
        const accentVolume = Math.min(0.016, 0.006 + comboLevel * 0.0009);
        const accentStart = chime * (1 + Math.min(0.12, comboLevel * 0.006)) * lift;
        playTone("sine", accentStart, accentStart * 1.04, accentVolume, 0.054, duration * 0.48, 0.016, 1700);
      }
      if (state.combo >= 5 && state.combo % 5 === 0) {
        playTone("sine", chime * 1.08 * lift, chime * 1.18 * lift, 0.012, 0.09, 0.058, 0.018, 1800);
      }
    } catch {
      audioContext = null;
    }
  }

  function playIntroSound() {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume?.();
      const now = audioContext.currentTime;
      for (let i = 0; i < 5; i += 1) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const t = now + i * 0.045;
        const start = 360 + i * 95;
        const end = start + 280 + i * 34;
        osc.type = i % 2 === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(start, t);
        osc.frequency.exponentialRampToValueAtTime(end, t + 0.12);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.028 - i * 0.002, t + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(t);
        osc.stop(t + 0.22);
      }
    } catch {
      audioContext = null;
    }
  }

  function buildStartTransition() {
    startTransition.replaceChildren();
    const ring = document.createElement("span");
    ring.className = "splash-ring";
    startTransition.append(ring);

    const spread = Math.max(state.width || window.innerWidth, state.height || window.innerHeight);
    const count = Math.round(clamp(spread / 13, 52, 72));
    for (let i = 0; i < count; i += 1) {
      const bubble = document.createElement("span");
      const angle = (i / count) * Math.PI * 2 + rand(-0.2, 0.2);
      const distance = rand(spread * 0.24, spread * 0.82);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const size = rand(16, 54) * (i % 9 === 0 ? 1.45 : 1);
      bubble.className = `start-bubble tone-${i % 3}`;
      bubble.style.setProperty("--x", `${x}px`);
      bubble.style.setProperty("--y", `${y}px`);
      bubble.style.setProperty("--x-mid", `${x * 0.7}px`);
      bubble.style.setProperty("--y-mid", `${y * 0.7}px`);
      bubble.style.setProperty("--drift", `${rand(-42, 42)}px`);
      bubble.style.setProperty("--size", `${size}px`);
      bubble.style.setProperty("--delay", `${rand(0, 260)}ms`);
      bubble.style.setProperty("--duration", `${rand(860, 1360)}ms`);
      bubble.style.setProperty("--end-scale", rand(0.86, 1.24).toFixed(2));
      startTransition.append(bubble);
    }
  }

  function playStartTransition() {
    if (introRunning) return;
    introRunning = true;
    startButton.disabled = true;
    endStats.textContent = "";
    curtain.classList.add("starting");
    buildStartTransition();
    startTransition.classList.remove("active");
    startTransition.getBoundingClientRect();
    startTransition.classList.add("active");
    playIntroSound();

    window.setTimeout(resetGame, 620);
    window.setTimeout(() => {
      curtain.classList.remove("starting");
      startTransition.classList.remove("active");
      startTransition.replaceChildren();
      startButton.disabled = false;
      introRunning = false;
    }, 1540);
  }

  startButton.addEventListener("click", playStartTransition);
  clearSkillButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    useClearSkill();
  });
  canvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
  canvas.addEventListener("pointermove", handlePointerMove, { passive: false });
  canvas.addEventListener("pointerup", handlePointerEnd);
  canvas.addEventListener("pointercancel", handlePointerEnd);
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);

  resize();
  updateHud();
  draw();
  requestAnimationFrame((now) => {
    state.lastTime = now;
    requestAnimationFrame(loop);
  });
})();
