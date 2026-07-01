(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const buildVersion = "1.1.11";
  const curtain = document.getElementById("curtain");
  const startButton = document.getElementById("startButton");
  const titleMark = document.querySelector(".title-mark");
  const startTransition = document.getElementById("startTransition");
  const endStats = document.getElementById("endStats");
  const waterFill = document.getElementById("waterFill");
  const waterValue = document.getElementById("waterValue");
  const waterBlock = document.querySelector(".water-block");
  const heartBubbles = Array.from(document.querySelectorAll(".heart-bubble"));
  const comboChip = document.getElementById("comboChip");
  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("timeValue");
  const difficultyEl = document.getElementById("difficultyLevel");
  const clearSkillButton = document.getElementById("clearSkill");
  const clearSkillValue = document.getElementById("clearSkillValue");
  const perfDebug = document.getElementById("perfDebug");
  const debugLevelSelect = document.getElementById("debugLevel");
  const debugJumpButton = document.getElementById("debugJump");
  const debugStageInfo = document.getElementById("debugStageInfo");
  const bubbleAtlas = new Image();
  const bombBubbleImage = new Image();
  bombBubbleImage.src = "./assets/bomb-bubble.png";
  const bleachBubbleImage = new Image();
  bleachBubbleImage.src = "./assets/bleach-bubble.png";
  const catBubbleImage = new Image();
  catBubbleImage.src = "./assets/cat-bubble.png";
  const bubbleSpriteCell = 192;
  const bubbleSpriteCols = 5;
  const targetFrameMs = 1000 / 60;
  const maxActiveBubbles = 12;
  const spawnProtectionSeconds = 2.5;
  const spawnProtectionIterations = 4;
  const spawnProtectionStiffness = 0.68;
  const spawnProtectionRestitution = 0.08;
  const spawnProtectionFriction = 0.026;
  const maxParticles = 72;
  const maxRipples = 32;
  const maxBlasts = 4;
  const maxFloaters = 10;
  const maxHints = 10;
  const debugUpdateMs = 500;
  const performanceProfiles = [
    {
      name: "high",
      dprCap: 1,
      maxCanvasPixels: 520000,
      backgroundScale: 0.9,
      backgroundFps: 60,
      backgroundFrameSkip: 1,
      targetFps: 60,
      contours: true,
      particles: maxParticles,
      ripples: maxRipples,
      blasts: maxBlasts,
      floaters: maxFloaters,
      hints: maxHints,
      effectChance: 0.86,
      bubbleDetail: 0.82,
      textureOverlay: false,
      fullScreenOverlays: true,
      smoothingQuality: "high",
    },
    {
      name: "balanced",
      dprCap: 1,
      maxCanvasPixels: 440000,
      backgroundScale: 0.78,
      backgroundFps: 60,
      backgroundFrameSkip: 1,
      targetFps: 60,
      contours: true,
      particles: 48,
      ripples: 22,
      blasts: maxBlasts,
      floaters: 8,
      hints: 7,
      effectChance: 0.72,
      bubbleDetail: 0.72,
      textureOverlay: false,
      fullScreenOverlays: true,
      smoothingQuality: "medium",
    },
    {
      name: "saver",
      dprCap: 1,
      maxCanvasPixels: 360000,
      backgroundScale: 0.66,
      backgroundFps: 60,
      backgroundFrameSkip: 1,
      targetFps: 60,
      contours: true,
      particles: 28,
      ripples: 14,
      blasts: 3,
      floaters: 6,
      hints: 5,
      effectChance: 0.58,
      bubbleDetail: 0.68,
      textureOverlay: false,
      fullScreenOverlays: false,
      smoothingQuality: "low",
    },
    {
      name: "cool",
      dprCap: 1,
      maxCanvasPixels: 300000,
      backgroundScale: 0.5,
      backgroundFps: 60,
      backgroundFrameSkip: 1,
      targetFps: 60,
      contours: false,
      particles: 14,
      ripples: 8,
      blasts: 2,
      floaters: 4,
      hints: 3,
      effectChance: 0.34,
      bubbleDetail: 0.52,
      textureOverlay: false,
      fullScreenOverlays: false,
      smoothingQuality: "low",
    },
  ];
  const waterBudgetRounds = [
    { count: 10, total: 300 },
    { count: 18, total: 250 },
    { count: 26, total: 200 },
    { count: 34, total: 150 },
    { count: 42, total: 150 },
    { count: 50, total: 120 },
  ];
  const stageDurationMs = 20000;
  const stageEndGraceMs = 3000;

  const palette = [
    { name: "湖雾蓝", color: "#6eafc0", deep: "#3f7f91", light: "#cbe8ef" },
    { name: "雾玫粉", color: "#d8899d", deep: "#a05f73", light: "#f0c7d3" },
  ];
  const backgroundPalette = [
    { color: "#8fcbd4", deep: "#62aeba", light: "#d8f0f3" },
    { color: "#ee9fac", deep: "#d88798", light: "#f7c9d0" },
  ];

  const openTone = makeOpenTone();
  const clearTone = makeClearTone();
  const whiteTone = makeWhiteTone();
  const bombTone = makeBombTone();
  const boundaryTone = "#c9b7d7";
  const waterPressureCap = 132;
  const comboBaseWindow = 2350;
  const comboMinWindow = 1450;
  const decolorDuration = 4200;
  const decolorWarningMs = 1500;
  const bleachRequiredHits = 3;
  const bleachLifetimeMs = 5000;
  const catBubbleMinLevel = 1;
  const catBubbleCooldownMs = 60000;
  const catBubbleRollIntervalMs = 10000;
  const catBubbleTapRequired = 4;
  const catBubbleHoldMs = 760;
  const catBubbleWaterGain = 25;
  const correctWaterGain = 0.1;
  const mistakeWaterPenalty = 25;
  const customPackStorageKey = "paopao.customBubblePack.v1";
  const customPackSchema = "paopao-bubble-pack@1";
  const fairMatchDwell = 2;
  const clearSkillMaxUses = 3;
  const edgeCycle = ["left", "right", "bottom", "top"];
  const spawnRegions = [
    { edge: "left", min: 0.14, max: 0.38, aimX: 0.68, aimY: 0.32 },
    { edge: "left", min: 0.36, max: 0.64, aimX: 0.68, aimY: 0.5 },
    { edge: "left", min: 0.62, max: 0.86, aimX: 0.66, aimY: 0.68 },
    { edge: "right", min: 0.14, max: 0.38, aimX: 0.32, aimY: 0.32 },
    { edge: "right", min: 0.36, max: 0.64, aimX: 0.32, aimY: 0.5 },
    { edge: "right", min: 0.62, max: 0.86, aimX: 0.34, aimY: 0.68 },
    { edge: "top", min: 0.18, max: 0.42, aimX: 0.36, aimY: 0.7 },
    { edge: "top", min: 0.44, max: 0.72, aimX: 0.58, aimY: 0.7 },
    { edge: "bottom", min: 0.18, max: 0.42, aimX: 0.36, aimY: 0.3 },
    { edge: "bottom", min: 0.44, max: 0.72, aimX: 0.58, aimY: 0.3 },
  ];
  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    running: false,
    lastTime: 0,
    visualTime: 0,
    elapsed: 0,
    score: 0,
    correctBubbleCount: 0,
    poppedCount: 0,
    water: 100,
    waterPressure: 0,
    hiddenLeak: 0,
    hiddenLeakActive: false,
    wrongStreak: 0,
    lastUsefulActionAt: 0,
    combo: 0,
    bestCombo: 0,
    comboPulse: 0,
    comboUntil: 0,
    comboRecoveryUntil: 0,
    comboRecoveryPower: 0,
    clearSkillCharge: 1,
    clearSkillUses: 0,
    waterRoundIndex: 0,
    waterRoundSpawned: 0,
    waterOpportunityCount: 0,
    stagePlan: null,
    stageLevel: 1,
    stageStartAt: 0,
    stageFinalSpawnAt: 0,
    stageSpawned: 0,
    stageTargetSpawned: 0,
    stageCorrectPops: 0,
    stageMissedTargets: 0,
    stageWrongPops: 0,
    bombComboProgress: 0,
    bombComboTarget: 18,
    bombSpawnCursor: 0,
    difficultyTier: 0,
    difficultyFlash: 0,
    openPopCount: 0,
    colorCursor: 0,
    edgeCursor: 0,
    nextPowerAt: 22000,
    nextStreamAt: 18000,
    nextSpawnAt: 0,
    bubbleCounter: 0,
    customBubblePack: null,
    customPackStatus: "",
    customPackLastSpawnAt: 0,
    customHoldPointerId: null,
    customHoldBubbleUid: null,
    customHoldX: 0,
    customHoldY: 0,
    catBubbleCounter: 0,
    catBubbleSpawned: 0,
    lastCatBubbleAt: -Infinity,
    nextCatBubbleRollAt: 0,
    catMistakeCounting: false,
    catMistakeCount: 0,
    catMistakeTarget: 0,
    catHoldPointerId: null,
    catHoldBubbleId: null,
    catHoldX: 0,
    catHoldY: 0,
    openUntil: 0,
    flash: 0,
    mistakeFlash: 0,
    bubbles: [],
    particles: [],
    ripples: [],
    blasts: [],
    floaters: [],
    hints: [],
    spawnFlow: null,
    spawnFlowIndex: 0,
    backgroundFlow: {
      phase: "hold",
      elapsed: 0,
      step: 0,
      current: null,
      from: null,
      target: null,
      hold: 14000,
      duration: 9000,
    },
    activePointerId: null,
    lastSwipeX: 0,
    lastSwipeY: 0,
  };

  let audioContext;
  let introRunning = false;
  let frameRequest = 0;
  let lastFrameTime = 0;
  let perfFrames = 0;
  let perfFps = 0;
  let perfLastTime = 0;
  let perfLastUpdate = 0;
  let lastHudWater = null;
  let waterGainUntil = 0;
  let waterDrainUntil = 0;
  let waterShockUntil = 0;
  let waterCriticalUntil = 0;
  let lastWaterBand = "safe";
  let waterLowVibrationArmed = true;
  let performanceTier = initialPerformanceTier();
  let initialTier = performanceTier;
  let performanceWorkMs = targetFrameMs * 0.35;
  let performanceSlowSince = 0;
  let performanceCoolSince = 0;
  let performanceLastChangeAt = 0;
  let performanceLastResizeDpr = 1;
  const frameStatSize = 600;
  const frameIntervals = new Float32Array(frameStatSize);
  const frameWorkTimes = new Float32Array(frameStatSize);
  let frameStatIndex = 0;
  let frameStatCount = 0;
  let frameJankCount = 0;
  let frameWorstMs = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const profile = currentPerformanceProfile();
    state.width = Math.max(1, rect.width);
    state.height = Math.max(1, rect.height);
    state.dpr = desiredCanvasDpr();
    performanceLastResizeDpr = state.dpr;
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = profile.smoothingQuality;
    if (window.PaopaoBackgroundEngine) {
      window.PaopaoBackgroundEngine.setQuality?.({
        scale: profile.backgroundScale,
        fps: profile.backgroundFps,
        frameSkip: profile.backgroundFrameSkip,
        contours: profile.contours,
      });
      window.PaopaoBackgroundEngine.resize(state.width, state.height);
    }
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickColorIndex() {
    return Math.floor(Math.random() * palette.length);
  }

  function choose(list) {
    return list[Math.floor(rand(0, list.length))];
  }

  function normalizeRange(value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
    const source = Array.isArray(value) ? value : [value, value];
    const fallbackSource = Array.isArray(fallback) ? fallback : [fallback, fallback];
    const first = Number.isFinite(Number(source[0])) ? Number(source[0]) : Number(fallbackSource[0]);
    const second = Number.isFinite(Number(source[1])) ? Number(source[1]) : Number(fallbackSource[1] ?? fallbackSource[0]);
    const low = clamp(Math.min(first, second), min, max);
    const high = clamp(Math.max(first, second), min, max);
    return [low, high];
  }

  function pickRange(range, fallback = 0) {
    const normalized = normalizeRange(range, fallback);
    return rand(normalized[0], normalized[1]);
  }

  function normalizeCustomPath(path) {
    if (!path || typeof path !== "object") {
      return { mode: "auto", points: [], curve: 0.68 };
    }
    const mode = path.mode === "draw" ? "draw" : path.mode === "points" ? "points" : "auto";
    const rawCurve = Number(path.curve ?? path.smoothness ?? 0.68);
    const curve = Number.isFinite(rawCurve) ? clamp(rawCurve, 0, 1) : 0.68;
    const points = (Array.isArray(path.points) ? path.points : [])
      .map((point) => ({
        x: clamp(Number(point?.x), 0, 1),
        y: clamp(Number(point?.y), 0, 1),
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .slice(0, 96);
    return {
      mode: points.length >= 2 ? mode : "auto",
      points: points.length >= 2 ? simplifyCustomPath(points) : [],
      curve,
    };
  }

  function simplifyCustomPath(points) {
    if (points.length <= 48) return points;
    const simplified = [points[0]];
    const step = (points.length - 1) / 46;
    for (let index = 1; index < 47; index += 1) {
      simplified.push(points[Math.round(index * step)]);
    }
    simplified.push(points[points.length - 1]);
    return simplified;
  }

  function normalizeCustomBubbleTemplate(template, index) {
    if (!template || typeof template !== "object") return null;
    const trajectoryChoices = ["straight", "softS", "arc", "zigzag", "spray", "fan", "sGroup", "arcDuo"];
    const edgeChoices = ["random", "left", "right", "top", "bottom"];
    const colorChoices = ["auto", "random", "background", "left", "right"];
    const tapCount = clamp(Math.round(Number(template.tapCount ?? template.tapRequired ?? 1)), 0, 9);
    const count = normalizeRange(template.count ?? template.repeat, [1, 1], 1, 12);
    const size = normalizeRange(template.size ?? template.radius, [30, 44], 14, 86);
    const bubbleCount = Math.round((count[0] + count[1]) * 0.5);
    const sizes = Array.from({ length: bubbleCount }, (_, sizeIndex) => {
      const raw = Array.isArray(template.sizes) ? Number(template.sizes[sizeIndex]) : NaN;
      return clamp(Math.round(Number.isFinite(raw) ? raw : (size[0] + size[1]) * 0.5), 14, 86);
    });
    return {
      id: String(template.id || `bubble-${index + 1}`),
      label: String(template.label || template.name || `Bubble ${index + 1}`).slice(0, 28),
      weight: clamp(Number(template.weight ?? 1), 0.05, 20),
      levelMin: clamp(Math.round(Number(template.levelMin ?? template.minLevel ?? 1)), 1, 99),
      levelMax: clamp(Math.round(Number(template.levelMax ?? template.maxLevel ?? 99)), 1, 99),
      count,
      spacing: normalizeRange(template.spacing ?? template.spacingPx, [8, 18], 0, 80),
      spacingMs: normalizeRange(template.spacingMs ?? template.delayMs, [70, 130], 0, 1400),
      size,
      sizes,
      speed: normalizeRange(template.speed, [48, 82], 8, 260),
      tapCount: tapCount <= 0 ? 1 : tapCount,
      holdMs: 0,
      edge: edgeChoices.includes(template.edge) ? template.edge : "random",
      lane: normalizeRange(template.lane, [0.22, 0.78], 0.08, 0.92),
      aimX: normalizeRange(template.aimX ?? template.aim?.x, [0.3, 0.7], 0.05, 0.95),
      aimY: normalizeRange(template.aimY ?? template.aim?.y, [0.24, 0.76], 0.05, 0.95),
      trajectory: trajectoryChoices.includes(template.trajectory) ? template.trajectory : "straight",
      amplitude: normalizeRange(template.amplitude, [0, 12], 0, 64),
      frequency: normalizeRange(template.frequency, [1.4, 2.6], 0.4, 8),
      arcBend: normalizeRange(template.arcBend, [0, 0], -110, 110),
      arcLife: normalizeRange(template.arcLife, [2.1, 3.2], 0.5, 8),
      colorMode: colorChoices.includes(template.colorMode ?? template.color) ? (template.colorMode ?? template.color) : "auto",
      path: normalizeCustomPath(template.path),
    };
  }

  function normalizeCustomBubblePack(input) {
    let pack = input;
    if (typeof pack === "string") {
      try {
        pack = JSON.parse(pack);
      } catch {
        return null;
      }
    }
    if (!pack || typeof pack !== "object") return null;
    const bubbles = (Array.isArray(pack.bubbles) ? pack.bubbles : [])
      .map(normalizeCustomBubbleTemplate)
      .filter(Boolean);
    if (!bubbles.length) return null;
    const spawn = pack.spawn && typeof pack.spawn === "object" ? pack.spawn : {};
    return {
      schema: customPackSchema,
      name: String(pack.name || "Custom bubble pack").slice(0, 40),
      description: String(pack.description || "").slice(0, 160),
      spawn: {
        minLevel: clamp(Math.round(Number(spawn.minLevel ?? 1)), 1, 99),
        chance: clamp(Number(spawn.chance ?? 0.72), 0, 1),
        intervalMs: normalizeRange(spawn.intervalMs, [520, 920], 160, 2400),
        maxActive: clamp(Math.round(Number(spawn.maxActive ?? maxActiveBubbles)), 1, maxActiveBubbles),
      },
      bubbles,
    };
  }

  function loadCustomBubblePack() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pack") === "off") {
      return null;
    }
    if (params.get("pack") === "clear") {
      try {
        window.localStorage.removeItem(customPackStorageKey);
      } catch {
        return null;
      }
      return null;
    }
    try {
      return normalizeCustomBubblePack(window.localStorage.getItem(customPackStorageKey));
    } catch {
      return null;
    }
  }

  function saveCustomBubblePack(pack) {
    const normalized = normalizeCustomBubblePack(pack);
    try {
      if (normalized) {
        window.localStorage.setItem(customPackStorageKey, JSON.stringify(normalized));
      } else {
        window.localStorage.removeItem(customPackStorageKey);
      }
    } catch {
      return null;
    }
    return normalized;
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

  function isLikelyMobileDevice() {
    try {
      return window.matchMedia?.("(pointer: coarse)").matches || Math.min(window.innerWidth, window.innerHeight) <= 760;
    } catch {
      return Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 760;
    }
  }

  function initialPerformanceTier() {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    const dpr = window.devicePixelRatio || 1;
    const mobile = isLikelyMobileDevice();
    if (cores <= 2 || memory <= 2) return 2;
    if (mobile && (cores <= 4 || memory <= 3 || dpr >= 2.5)) return 1;
    return 0;
  }

  function currentPerformanceProfile() {
    return performanceProfiles[clamp(Math.round(performanceTier), 0, performanceProfiles.length - 1)] ?? performanceProfiles[0];
  }

  function desiredCanvasDpr() {
    const rawDpr = window.devicePixelRatio || 1;
    const profile = currentPerformanceProfile();
    const area = Math.max(1, state.width * state.height);
    const areaCap = Math.sqrt((profile.maxCanvasPixels || 900000) / area);
    return Math.max(1, Math.min(rawDpr, profile.dprCap, areaCap));
  }

  function currentTargetFrameMs() {
    return 1000 / clamp(currentPerformanceProfile().targetFps || 60, 30, 60);
  }

  function thermalTierFloor() {
    if (!state.running || !isLikelyMobileDevice()) return initialTier;
    const minutes = state.elapsed / 60000;
    if (minutes >= 42) return Math.max(initialTier, 2);
    if (minutes >= 18) return Math.max(initialTier, 1);
    return initialTier;
  }

  function applyPerformanceProfile() {
    const profile = currentPerformanceProfile();
    if (window.PaopaoBackgroundEngine) {
      window.PaopaoBackgroundEngine.setQuality?.({
        scale: profile.backgroundScale,
        fps: profile.backgroundFps,
        frameSkip: profile.backgroundFrameSkip,
        contours: profile.contours,
      });
    }
    const nextDpr = desiredCanvasDpr();
    if (state.width > 0 && Math.abs(nextDpr - performanceLastResizeDpr) > 0.04) {
      resize();
    }
    trimRuntimeEffects();
  }

  function setPerformanceTier(nextTier, now = performance.now()) {
    const clamped = clamp(Math.round(nextTier), 0, performanceProfiles.length - 1);
    if (clamped === performanceTier) return;
    performanceTier = clamped;
    performanceLastChangeAt = now;
    performanceSlowSince = 0;
    performanceCoolSince = 0;
    applyPerformanceProfile();
  }

  function effectLimit(name) {
    const value = currentPerformanceProfile()[name];
    if (Number.isFinite(value)) return Math.max(0, Math.floor(value));
    if (name === "ripples") return maxRipples;
    if (name === "blasts") return maxBlasts;
    if (name === "floaters") return maxFloaters;
    if (name === "hints") return maxHints;
    return maxParticles;
  }

  function allowDecorativeEffect(priority = 1) {
    const chance = currentPerformanceProfile().effectChance;
    return chance >= 1 || Math.random() < clamp(chance * priority, 0, 1);
  }

  function updateAdaptivePerformance(now, frameElapsedMs, workMs) {
    performanceWorkMs = performanceWorkMs * 0.88 + workMs * 0.12;
    const floor = thermalTierFloor();
    if (performanceTier < floor && now - performanceLastChangeAt > 3500) {
      setPerformanceTier(floor, now);
      return;
    }

    const frameBudget = currentTargetFrameMs();
    const targetFps = currentPerformanceProfile().targetFps || 60;
    const slowFrame = frameElapsedMs > frameBudget * 1.7 || performanceWorkMs > frameBudget * 0.72 || (perfFps > 0 && perfFps < targetFps * 0.78);
    const coolFrame = performanceWorkMs < frameBudget * 0.4 && (!perfFps || perfFps >= targetFps * 0.94);

    if (slowFrame) {
      performanceSlowSince ||= now;
      performanceCoolSince = 0;
    } else if (coolFrame) {
      performanceCoolSince ||= now;
      performanceSlowSince = 0;
    } else {
      performanceSlowSince = 0;
      performanceCoolSince = 0;
    }

    if (performanceSlowSince && now - performanceSlowSince > 3600 && now - performanceLastChangeAt > 6200) {
      setPerformanceTier(performanceTier + 1, now);
    } else if (
      performanceCoolSince &&
      now - performanceCoolSince > 18000 &&
      now - performanceLastChangeAt > 14000 &&
      performanceTier > floor
    ) {
      setPerformanceTier(performanceTier - 1, now);
    }
  }

  function trimArray(list, maxLength) {
    if (list.length > maxLength) {
      list.splice(0, list.length - maxLength);
    }
  }

  function trimRuntimeEffects() {
    trimArray(state.particles, effectLimit("particles"));
    trimArray(state.ripples, effectLimit("ripples"));
    trimArray(state.blasts, effectLimit("blasts"));
    trimArray(state.floaters, effectLimit("floaters"));
    trimArray(state.hints, effectLimit("hints"));
  }

  function resetFrameStats() {
    frameStatIndex = 0;
    frameStatCount = 0;
    frameJankCount = 0;
    frameWorstMs = 0;
  }

  function recordFrameStats(frameMs, workMs) {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    const target = currentTargetFrameMs();
    frameIntervals[frameStatIndex] = frameMs;
    frameWorkTimes[frameStatIndex] = Number.isFinite(workMs) ? workMs : 0;
    frameStatIndex = (frameStatIndex + 1) % frameStatSize;
    frameStatCount = Math.min(frameStatSize, frameStatCount + 1);
    frameWorstMs = Math.max(frameWorstMs, frameMs);
    if (frameMs > target * 1.55 || frameMs > 28) {
      frameJankCount += 1;
    }
  }

  function percentile(sorted, percent) {
    if (!sorted.length) return 0;
    const index = clamp(Math.ceil(sorted.length * percent) - 1, 0, sorted.length - 1);
    return sorted[index];
  }

  function frameStatsSummary() {
    if (!frameStatCount) {
      return { p95: 0, p99: 0, avgWork: performanceWorkMs, jank: 0, worst: 0 };
    }
    const frames = Array.from(frameIntervals.slice(0, frameStatCount)).sort((a, b) => a - b);
    let workTotal = 0;
    for (let i = 0; i < frameStatCount; i += 1) {
      workTotal += frameWorkTimes[i];
    }
    return {
      p95: percentile(frames, 0.95),
      p99: percentile(frames, 0.99),
      avgWork: workTotal / frameStatCount,
      jank: frameJankCount,
      worst: frameWorstMs,
    };
  }

  function clearRuntimeEffects() {
    state.bubbles = [];
    state.particles = [];
    state.ripples = [];
    state.blasts = [];
    state.floaters = [];
    state.hints = [];
    state.activePointerId = null;
    state.customHoldPointerId = null;
    state.customHoldBubbleUid = null;
    state.catHoldPointerId = null;
    state.catHoldBubbleId = null;
  }

  function updatePerfDebug(now = performance.now(), force = false) {
    if (!perfDebug || (!force && now - perfLastUpdate < debugUpdateMs)) return;
    perfLastUpdate = now;
    const profile = currentPerformanceProfile();
    const megapixels = ((canvas.width * canvas.height) / 1000000).toFixed(2);
    const stats = frameStatsSummary();
    perfDebug.textContent =
      `FPS ${Math.round(perfFps || 0)}/${profile.targetFps} ${profile.name} ` +
      `p95 ${stats.p95.toFixed(1)} p99 ${stats.p99.toFixed(1)} ` +
      `j${stats.jank} max${stats.worst.toFixed(0)} ` +
      `w${stats.avgWork.toFixed(1)} dpr${state.dpr.toFixed(2)} ${megapixels}MP`;
  }

  function scheduleLoop() {
    if (frameRequest || document.hidden || !state.running) return;
    frameRequest = requestAnimationFrame(loop);
  }

  function displayDifficultyLevel() {
    return Math.max(1, state.stageLevel || 1);
  }

  function targetCorrectRateForLevel(level) {
    return clamp(
      0.55 +
        (level - 1) * 0.03 +
        smoothstep(2, 7, level) * 0.09 +
        smoothstep(7, 13, level) * 0.07 +
        smoothstep(13, 24, level) * 0.02,
      0.55,
      0.98,
    );
  }

  function bubbleCountForLevel(level) {
    const budget = waterBudgetRounds[Math.min(level - 1, waterBudgetRounds.length - 1)];
    if (level <= waterBudgetRounds.length) return budget.count;
    const extra = level - waterBudgetRounds.length;
    return Math.round(clamp(budget.count + extra * 3, budget.count, 78));
  }

  function levelWaterDrainRate(level) {
    const p = clamp((level - 1) / 14, 0, 1);
    return clamp(
      1.16 +
        p * 1.15 +
        smoothstep(1, 5, level) * 0.42 +
        smoothstep(5, 11, level) * 0.34,
      1.16,
      3.05,
    );
  }

  function stageWaterBudgetForLevel(level) {
    const targetBubbles = Math.max(1, Math.round(bubbleCountForLevel(level) * targetCorrectRateForLevel(level)));
    const sustain = level <= 3 ? 1.16 : level <= 8 ? 1.03 : level <= 15 ? 0.92 : 0.88;
    const perTargetFloor = level <= 3 ? 0.16 : level <= 8 ? 0.085 : 0.052;
    return levelWaterDrainRate(level) * (stageDurationMs / 1000) * sustain + targetBubbles * perTargetFloor;
  }

  function averageBubbleMissPenaltyForLevel(level) {
    const p = clamp((level - 1) / 14, 0, 1);
    return clamp(
      0.62 +
        p * 1.18 +
        smoothstep(2, 8, level) * 0.34 +
        smoothstep(7, 16, level) * 0.22,
      0.62,
      2.36,
    );
  }

  function stageTypeWeights(level) {
    const cappedLevel = Math.min(level, 10);
    if (level <= 1) {
      return {
        bigRise: 0.3,
        bigSide: 0.24,
        normal: 0.46,
        crossArc: 0,
        machine: 0,
        sGroup: 0,
      };
    }
    const weights = {
      bigRise: level <= 3 ? 0.16 : level <= 7 ? 0.13 : 0.09,
      bigSide: level <= 3 ? 0.14 : level <= 7 ? 0.13 : 0.1,
      normal: level <= 3 ? 0.24 : level <= 6 ? 0.2 : 0.15,
      crossArc: level >= 2 ? 0.24 + cappedLevel * 0.018 : 0,
      machine: level >= 3 ? 0.14 + cappedLevel * 0.016 : 0,
      sGroup: level >= 2 ? 0.1 + cappedLevel * 0.014 : 0,
    };
    return weights;
  }

  function makeStagePlan(level) {
    const totalBubbles = bubbleCountForLevel(level);
    const correctRate = targetCorrectRateForLevel(level);
    const targetBubbles = Math.max(1, Math.round(totalBubbles * correctRate));
    const naturalDrainBudget = levelWaterDrainRate(level) * (stageDurationMs / 1000) * 1.06;
    const baseMissPenalty = averageBubbleMissPenaltyForLevel(level);
    const rewardCap = clamp(2.35 - smoothstep(4, 15, level) * 0.72, 1.42, 2.35);
    const baseCorrectWater = clamp(
      (naturalDrainBudget / totalBubbles + (1 - correctRate) * baseMissPenalty) / correctRate,
      0.16,
      rewardCap,
    );
    const baseWrongPenalty = baseMissPenalty * (1.58 + smoothstep(3, 12, level) * 0.28);
    const totalWater = baseCorrectWater * targetBubbles;
    return {
      level,
      totalBubbles,
      targetBubbles,
      correctRate,
      totalWater,
      perTargetWater: baseCorrectWater,
      baseCorrectWater,
      baseMissPenalty,
      baseWrongPenalty,
      weights: stageTypeWeights(level),
    };
  }

  function resetStagePlan(level = displayDifficultyLevel()) {
    state.stageLevel = level;
    state.stagePlan = makeStagePlan(level);
    state.stageStartAt = state.elapsed;
    state.stageFinalSpawnAt = 0;
    state.stageSpawned = 0;
    state.stageTargetSpawned = 0;
    state.stageCorrectPops = 0;
    state.stageMissedTargets = 0;
    state.stageWrongPops = 0;
    state.spawnFlow = null;
    state.spawnFlowIndex = 0;
    state.waterPressure = 0;
    state.nextSpawnAt = Math.min(state.nextSpawnAt || state.elapsed + 140, state.elapsed + 180);
  }

  function stageElapsedMs() {
    return Math.max(0, state.elapsed - state.stageStartAt);
  }

  function stageRemainingBubbles() {
    if (!state.stagePlan) return 0;
    return Math.max(0, state.stagePlan.totalBubbles - state.stageSpawned);
  }

  function stageCompletion() {
    if (!state.stagePlan) return 0;
    return clamp(state.stageSpawned / Math.max(1, state.stagePlan.totalBubbles), 0, 1);
  }

  function activeStageTargetCount() {
    return state.bubbles.reduce(
      (count, bubble) =>
        count +
        (bubble.stageLevel === state.stageLevel && bubble.colorIndex >= 0 && !bubble.isWhite && (bubble.waterValue ?? 0) > 0 ? 1 : 0),
      0,
    );
  }

  function applyStageAccuracyGate() {
    return true;
  }

  function maybeAdvanceStage() {
    if (!state.stagePlan) {
      resetStagePlan(1);
      return;
    }
    if (stageRemainingBubbles() > 0) return;
    if (!state.stageFinalSpawnAt) state.stageFinalSpawnAt = state.elapsed;
    const activeTargets = activeStageTargetCount();
    const graceDone = state.elapsed - state.stageFinalSpawnAt >= stageEndGraceMs;
    if (activeTargets > 0 && !graceDone) return;
    const nextLevel = state.stageLevel + 1;
    triggerDifficultyUp(nextLevel - 1);
    resetStagePlan(nextLevel);
  }

  function backgroundTimingForLevel(level) {
    const p = clamp((level - 1) / 14, 0, 1);
    const earlyMotion = smoothstep(1, 4, level);
    const midMotion = smoothstep(3, 8, level);
    const lateMotion = smoothstep(7, 16, level);
    return {
      hold: clamp(6200 - earlyMotion * 1700 - midMotion * 2200 - lateMotion * 1800 - p * 800, 360, 6200),
      duration: clamp(7800 - earlyMotion * 500 - midMotion * 700 + lateMotion * 2200, 5400, 9800),
    };
  }

  function makeBackgroundLayout(level, step = 0) {
    const p = clamp((level - 1) / 18, 0, 1);
    const motion = 0.68 + smoothstep(1, 5, level) * 1.04 + smoothstep(7, 18, level) * 0.26;
    const turn = smoothstep(1.2, 7, level);
    const baseAngle = turn * Math.PI * 0.5;
    const angleSway = (0.075 + smoothstep(2, 7, level) * 0.25 + smoothstep(7, 18, level) * 0.08) * Math.sin(step * 0.72);
    const lateRoll = smoothstep(5, 18, level) * Math.sin(step * 0.37 + 0.8) * 0.32;
    const mode = step % 8;
    const splitAmp = level < 2 ? 0.075 : level < 4 ? 0.13 : level < 6 ? 0.18 : level < 8 ? 0.24 : 0.28 + p * 0.05;
    const curveAmp = level < 2 ? 0.06 : level < 4 ? 0.105 : level < 6 ? 0.15 : level < 8 ? 0.19 : 0.23 + p * 0.035;
    const width = level < 4 ? 0.03 : clamp(0.032 + Math.sin(step * 0.48) * (0.005 + p * 0.013), 0.023, 0.056);
    const splitWave = [0.18, -0.34, 0.48, -0.28, 0.62, -0.46, 0.3, -0.2][mode];
    const curveWave = [0.34, -0.28, 0.46, -0.58, 0.72, -0.42, 0.5, -0.32][mode];
    return {
      split: clamp(0.5 + splitAmp * splitWave * motion, 0.28, 0.72),
      angle: clamp(baseAngle + angleSway + lateRoll, -0.16, Math.PI * 0.5),
      curve: curveAmp * curveWave * motion,
      phase: ((step * (level >= 7 ? 0.105 : 0.15)) % 1) + 0.08,
      freq: 0.58 + (mode % 4) * 0.08 + p * 0.18,
      width,
    };
  }

  function mixBackgroundLayout(from, to, amount) {
    return {
      split: from.split + (to.split - from.split) * amount,
      angle: (from.angle ?? 0) + ((to.angle ?? 0) - (from.angle ?? 0)) * amount,
      curve: from.curve + (to.curve - from.curve) * amount,
      phase: from.phase + (to.phase - from.phase) * amount,
      freq: from.freq + (to.freq - from.freq) * amount,
      width: from.width + (to.width - from.width) * amount,
    };
  }

  function ensureBackgroundFlow() {
    const flow = state.backgroundFlow;
    if (flow.current) return;
    const initial = makeBackgroundLayout(1, 0);
    flow.phase = "hold";
    flow.elapsed = 0;
    flow.step = 0;
    flow.current = initial;
    flow.from = initial;
    flow.target = initial;
    Object.assign(flow, backgroundTimingForLevel(1));
  }

  function resetBackgroundFlow() {
    state.backgroundFlow.current = null;
    ensureBackgroundFlow();
  }

  function updateBackgroundFlow(dt) {
    ensureBackgroundFlow();
    const flow = state.backgroundFlow;
    const level = displayDifficultyLevel();
    const timing = backgroundTimingForLevel(level);
    flow.elapsed += dt * 1000;

    if (flow.phase === "hold") {
      flow.hold = timing.hold;
      if (flow.elapsed < flow.hold) return;
      flow.phase = "move";
      flow.elapsed = 0;
      flow.duration = timing.duration;
      flow.from = { ...flow.current };
      flow.step += 1;
      flow.target = makeBackgroundLayout(level, flow.step);
      return;
    }

    const amount = smoothstep(0, 1, flow.elapsed / Math.max(1, flow.duration));
    flow.current = mixBackgroundLayout(flow.from, flow.target, amount);
    if (flow.elapsed >= flow.duration) {
      flow.current = { ...flow.target };
      flow.phase = "hold";
      flow.elapsed = 0;
      flow.hold = timing.hold;
    }
  }

  function backgroundLayoutAt() {
    ensureBackgroundFlow();
    return state.backgroundFlow.current;
  }

  function backgroundAxes(layout = backgroundLayoutAt()) {
    const cornerPower = levelThreeCornerPower();
    const cornerElapsed = Math.max(0, state.elapsed - state.stageStartAt);
    const cornerAngle = Math.PI * 0.31 + Math.sin(cornerElapsed / 6200) * 0.035;
    const angle = (layout.angle ?? 0) + (cornerAngle - (layout.angle ?? 0)) * cornerPower;
    return {
      nx: Math.cos(angle),
      ny: Math.sin(angle),
      tx: -Math.sin(angle),
      ty: Math.cos(angle),
    };
  }

  function levelThreeCornerPower() {
    if (displayDifficultyLevel() !== 3) return 0;
    return smoothstep(0, 2600, Math.max(0, state.elapsed - state.stageStartAt));
  }

  function levelThreeCornerTravel() {
    const elapsed = Math.max(0, state.elapsed - state.stageStartAt);
    return smoothstep(0, 1, clamp(elapsed / 15800, 0, 1));
  }

  function bellCurve(value, center, width) {
    const distance = (value - center) / Math.max(0.001, width);
    return Math.exp(-distance * distance * 0.5);
  }

  function levelFiveTidePower() {
    if (displayDifficultyLevel() !== 5) return 0;
    return smoothstep(0, 2600, Math.max(0, state.elapsed - state.stageStartAt));
  }

  function backgroundBoundaryOffsetAt(tangent, layout = backgroundLayoutAt(), time = state.visualTime) {
    const levelAmount = clamp((displayDifficultyLevel() - 1) / 9, 0, 1);
    const u = tangent + 0.5;
    const curve = Math.sin((u * layout.freq + layout.phase) * Math.PI * 2) * layout.curve;
    const broad = Math.sin((u * 0.42 + layout.phase * 0.62 + 0.18) * Math.PI * 2) * layout.curve * 0.52;
    const smallFlow = Math.sin(u * Math.PI * 2.1 + time / 36000) * (0.008 + levelAmount * 0.008);
    const breathe = Math.sin(time / 26000) * (0.012 + levelAmount * 0.012);
    const cornerPower = levelThreeCornerPower();
    const cornerTime = Math.max(0, state.elapsed - state.stageStartAt);
    const cornerTravel = levelThreeCornerTravel();
    const cornerWidth = 0.62;
    const retreatCorner = bellCurve(tangent, -0.72, cornerWidth);
    const arrivingCorner = bellCurve(tangent, 0.72, cornerWidth);
    const travelingCorner = bellCurve(tangent, -0.72 + cornerTravel * 1.44, 0.52);
    const retreatStrength = 0.2 + (1 - cornerTravel) * 0.16;
    const arrivingStrength = 0.2 + cornerTravel * 0.16;
    const cornerSweep = (cornerTravel - 0.5) * 0.085;
    const cornerWave =
      Math.sin(tangent * Math.PI * 2.3 + cornerTime / 860) * 0.026 +
      Math.sin(tangent * Math.PI * 4.1 - cornerTime / 1320 + 0.7) * 0.012;
    const cornerFlow =
      cornerPower *
      (arrivingCorner * arrivingStrength -
        retreatCorner * retreatStrength +
        travelingCorner * 0.08 +
        cornerSweep +
        cornerWave * 0.72);
    const tidePower = levelFiveTidePower();
    const tideTime = Math.max(0, state.elapsed - state.stageStartAt);
    const tide =
      tidePower *
      (Math.sin(u * Math.PI * 3.15 + tideTime / 760) * 0.038 +
        Math.sin(u * Math.PI * 5.2 - tideTime / 1180 + 0.6) * 0.018 +
        Math.sin(tideTime / 1320) * 0.022);
    return layout.split - 0.5 + curve + broad + smallFlow + breathe + cornerFlow + tide;
  }

  function backgroundSignedAt(x, y, time = state.visualTime) {
    if (window.PaopaoBackgroundEngine) {
      return window.PaopaoBackgroundEngine.fieldAt(x, y, backgroundEngineTimeSeconds(time));
    }
    const layout = backgroundLayoutAt();
    const axes = backgroundAxes(layout);
    const px = state.width > 0 ? x / state.width - 0.5 : 0;
    const py = state.height > 0 ? y / state.height - 0.5 : 0;
    const tangent = px * axes.tx + py * axes.ty;
    const normal = px * axes.nx + py * axes.ny;
    return normal - backgroundBoundaryOffsetAt(tangent, layout, time);
  }

  function backgroundMixAt(x, y, time = state.visualTime) {
    if (window.PaopaoBackgroundEngine) {
      return window.PaopaoBackgroundEngine.mixAt(x, y, backgroundEngineTimeSeconds(time));
    }
    const layout = backgroundLayoutAt();
    const softness = layout.width;
    return smoothstep(-softness, softness, backgroundSignedAt(x, y, time));
  }

  function backgroundColorIndexAt(x, y) {
    if (window.PaopaoBackgroundEngine) {
      return window.PaopaoBackgroundEngine.colorIndexAt(x, y, backgroundEngineTimeSeconds());
    }
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

  function bleachExitTarget(edge, radius, fromX, fromY) {
    const margin = Math.max(64, radius * 2.6);
    if (edge === "left") return { x: state.width + margin, y: clamp(fromY + rand(-state.height * 0.18, state.height * 0.18), margin, state.height - margin) };
    if (edge === "right") return { x: -margin, y: clamp(fromY + rand(-state.height * 0.18, state.height * 0.18), margin, state.height - margin) };
    if (edge === "top") return { x: clamp(fromX + rand(-state.width * 0.18, state.width * 0.18), margin, state.width - margin), y: state.height + margin };
    return { x: clamp(fromX + rand(-state.width * 0.18, state.width * 0.18), margin, state.width - margin), y: -margin };
  }

  function randomBleachDashTarget(bubble, forceExit = false) {
    const margin = Math.max(58, bubble.baseRadius * 2.2);
    if (forceExit) {
      const edge = edgeCycle[Math.floor(rand(0, edgeCycle.length))];
      return pointFromEdge(edge, bubble.baseRadius, edge === "left" || edge === "right" ? rand(margin, state.height - margin) : rand(margin, state.width - margin));
    }
    const minDash = Math.min(state.width, state.height) * 0.38;
    let target = { x: rand(margin, state.width - margin), y: rand(Math.max(112, margin), state.height - margin) };
    for (let attempt = 0; attempt < 6; attempt += 1) {
      target = { x: rand(margin, state.width - margin), y: rand(Math.max(112, margin), state.height - margin) };
      if (Math.hypot(target.x - bubble.x, target.y - bubble.y) >= minDash) break;
    }
    return target;
  }

  function setBleachDash(bubble, forceExit = false) {
    const d = difficulty();
    const target = randomBleachDashTarget(bubble, forceExit);
    const speed = forceExit ? rand(260 + d * 60, 340 + d * 80) : rand(210 + d * 52, 292 + d * 64);
    const velocity = aimedVelocity(bubble.x, bubble.y, target, speed, 8);
    bubble.vx = velocity.vx;
    bubble.vy = velocity.vy;
    bubble.steerTarget = target;
    bubble.retargetAt = bubble.age + rand(0.48, 0.82);
    bubble.wobbleSpeed = rand(2.1, 3.2);
    bubble.drift = rand(-0.12, 0.12);
    bubble.bleachEscaping = forceExit;
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

  function pickBombComboTarget() {
    return Math.round(rand(18, 42));
  }

  function resetBombComboTimer() {
    state.bombComboProgress = 0;
    state.bombComboTarget = pickBombComboTarget();
  }

  function currentWaterBudgetRound() {
    return waterBudgetRounds[Math.min(state.waterRoundIndex, waterBudgetRounds.length - 1)];
  }

  function bubbleDifficultyValueWeight(radius, speed, options = {}) {
    const sizeWeight = clamp(42 / Math.max(16, radius), 0.68, 1.52);
    const speedWeight = clamp(speed / 88, 0.62, 1.58);
    const streamWeight = options.isStream ? 1.08 : 1;
    const largeEase = radius >= 56 ? 0.9 : 1;
    const smallPressure = radius <= 26 ? 1.08 : 1;
    return clamp((sizeWeight * 0.56 + speedWeight * 0.44) * streamWeight * largeEase * smallPressure, 0.58, 1.82);
  }

  function nextBubbleWaterProfile(radius, speed, options = {}) {
    const level = displayDifficultyLevel();
    if (!state.stagePlan || state.stagePlan.level !== level) {
      resetStagePlan(level);
    }
    const plan = state.stagePlan;
    const weight = bubbleDifficultyValueWeight(radius, speed, options);
    const waterValue = clamp(plan.baseCorrectWater * (0.72 + weight * 0.26), 0.1, 2.45);
    const missPenalty = clamp(plan.baseMissPenalty * (0.72 + weight * 0.3), 0.22, 3.35);
    const wrongPenalty = clamp(plan.baseWrongPenalty * (0.76 + weight * 0.34), missPenalty * 1.28, 5.25);
    state.waterRoundSpawned += 1;
    state.waterOpportunityCount += 1;
    state.stageTargetSpawned += 1;
    return {
      waterValue,
      missPenalty,
      wrongPenalty,
      difficultyWeight: weight,
    };
  }

  function comboWaterBoost(base) {
    if (state.combo <= 1) return 0;
    return base * Math.min(0.24, (state.combo - 1) * 0.013);
  }

  function comboWaterBonus() {
    return Math.min(0.8, Math.floor(Math.max(0, state.combo - 1) / 5) * 0.16);
  }

  function comboScoreBonus() {
    return Math.min(4, Math.floor(Math.max(0, state.combo - 1) / 5));
  }

  function comboWindow() {
    return Math.max(comboMinWindow, comboBaseWindow - Math.min(620, state.combo * 22));
  }

  function comboRank() {
    if (state.combo >= 32) return "SSS";
    if (state.combo >= 24) return "SS";
    if (state.combo >= 17) return "S";
    if (state.combo >= 11) return "A";
    if (state.combo >= 7) return "B";
    if (state.combo >= 4) return "C";
    if (state.combo >= 2) return "D";
    return "";
  }

  function comboRankStyle(rank = comboRank()) {
    const styles = {
      D: { color: "#b9e8f5", scale: 1.02, shadow: "#73c8dd" },
      C: { color: "#9ff0d2", scale: 1.1, shadow: "#5cc9a8" },
      B: { color: "#ffe08a", scale: 1.2, shadow: "#e0a83d" },
      A: { color: "#ffb5cf", scale: 1.34, shadow: "#e06f98" },
      S: { color: "#ff9f74", scale: 1.52, shadow: "#f15f4e" },
      SS: { color: "#d99dff", scale: 1.72, shadow: "#9965e7" },
      SSS: { color: "#fff2a3", scale: 1.95, shadow: "#ff78c8" },
    };
    return styles[rank] ?? { color: "#ffffff", scale: 1, shadow: "#ffffff" };
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
    if (state.combo <= 0) return 0;
    return clamp((state.comboUntil - state.elapsed) / comboWindow(), 0, 1);
  }

  function chargeClearSkill(amount) {
    if (state.clearSkillUses >= clearSkillMaxUses) {
      state.clearSkillCharge = 0;
      return;
    }
    if (state.clearSkillCharge >= 1) return;
    state.clearSkillCharge = clamp(state.clearSkillCharge + amount, 0, 1);
  }

  function clearSkillChargeForBubble(bubble) {
    if (!bubble) return 0.01;
    return bubble.baseRadius <= 30 ? 0.005 : 0.01;
  }

  function chargeClearSkillByBubble(bubble) {
    if (state.clearSkillUses <= 0) return;
    chargeClearSkill(clearSkillChargeForBubble(bubble));
  }

  function chargeClearSkillByBubbles(bubbles) {
    if (!bubbles?.length || state.clearSkillUses <= 0) return;
    const amount = bubbles.reduce((sum, bubble) => sum + clearSkillChargeForBubble(bubble), 0);
    chargeClearSkill(amount);
  }

  function registerCombo({ chargeSkill = true } = {}) {
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.comboPulse = 1;
    state.comboUntil = Number.POSITIVE_INFINITY;
    if (chargeSkill) {
      state.bombComboProgress += 1;
      if (state.combo >= 14 && state.bombComboProgress >= state.bombComboTarget) {
        if (spawnComboBomb()) {
          resetBombComboTimer();
        } else {
          state.bombComboProgress = state.bombComboTarget;
        }
      }
    }
  }

  function armComboRecovery(comboValue) {
    const levelFactor = smoothstep(4, 12, displayDifficultyLevel());
    if (!state.running || comboValue < 4 || levelFactor <= 0) return;
    const comboFactor = clamp((comboValue - 3) / 26, 0.18, 1);
    state.comboRecoveryUntil = Math.max(state.comboRecoveryUntil, state.elapsed + 4600 + levelFactor * 1200);
    state.comboRecoveryPower = Math.max(state.comboRecoveryPower, (0.08 + comboFactor * 0.16) * levelFactor);
  }

  function resetCombo({ recovery = true } = {}) {
    if (recovery) {
      armComboRecovery(state.combo);
    }
    state.combo = 0;
    state.comboPulse = 0;
    state.comboUntil = 0;
    resetBombComboTimer();
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

  function waterBandFor(value) {
    if (value <= 8) return "critical";
    if (value <= 18) return "danger";
    if (value <= 32) return "low";
    if (value <= 48) return "warn";
    return "safe";
  }

  function waterBandRank(band) {
    if (band === "critical") return 4;
    if (band === "danger") return 3;
    if (band === "low") return 2;
    if (band === "warn") return 1;
    return 0;
  }

  function redDotHeartSrc(filled) {
    const fill = filled ? "#f43645" : "rgba(255,255,255,0.18)";
    const stroke = filled ? "#fff3f5" : "rgba(255,255,255,0.58)";
    const inner = filled ? "#ff7580" : "rgba(255,255,255,0.28)";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="23" fill="${fill}" stroke="${stroke}" stroke-width="5"/><circle cx="24" cy="22" r="7" fill="${inner}"/></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  function updateHud() {
    const water = Math.round(Math.max(0, Math.min(100, state.water)));
    const exactWater = Math.max(0, Math.min(100, state.water));
    const openActive = state.openUntil > state.elapsed && state.running;
    if (lastHudWater !== null) {
      const diff = exactWater - lastHudWater;
      if (diff > 0.05) {
        waterGainUntil = state.elapsed + clamp(420 + diff * 42, 420, 820);
      } else if (diff < -0.012) {
        const drop = Math.abs(diff);
        waterDrainUntil = state.elapsed + clamp(340 + drop * 48, 360, 860);
        if (drop >= 0.34) {
          waterShockUntil = state.elapsed + clamp(240 + drop * 44, 280, 720);
        }
      }
    }
    const waterBand = waterBandFor(water);
    const bandRank = waterBandRank(waterBand);
    const previousBandRank = waterBandRank(lastWaterBand);
    if (state.running && exactWater < 30 && waterLowVibrationArmed) {
      waterLowVibrationArmed = false;
      waterCriticalUntil = Math.max(waterCriticalUntil, state.elapsed + 520);
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    } else if (exactWater > 36) {
      waterLowVibrationArmed = true;
    }
    if (state.running && bandRank > previousBandRank) {
      waterCriticalUntil = state.elapsed + (waterBand === "critical" ? 980 : waterBand === "danger" ? 720 : 440);
      if ((waterBand === "danger" || waterBand === "critical") && navigator.vibrate) {
        navigator.vibrate(waterBand === "critical" ? [18, 36, 18] : 18);
      }
    }
    lastWaterBand = waterBand;
    lastHudWater = exactWater;
    heartBubbles.forEach((heart, index) => {
      heart.src = redDotHeartSrc(exactWater >= (index + 1) * 25);
    });
    waterFill.style.width = `${water}%`;
    waterValue.textContent = `${water}%`;
    waterBlock.classList.toggle("warn", water <= 48);
    waterBlock.classList.toggle("low", water <= 32);
    waterBlock.classList.toggle("danger", water <= 18);
    waterBlock.classList.toggle("critical", water <= 8);
    waterBlock.classList.toggle("pulse", state.comboPulse > 0.16);
    waterBlock.classList.toggle("open", openActive);
    waterBlock.classList.toggle("combo-hot", state.combo >= 5);
    waterBlock.classList.toggle("gain", state.running && state.elapsed < waterGainUntil);
    waterBlock.classList.toggle("drain", state.running && state.elapsed < waterDrainUntil && state.elapsed >= waterGainUntil);
    waterBlock.classList.toggle("shock", state.running && state.elapsed < waterShockUntil);
    waterBlock.classList.toggle("critical-flash", state.running && state.elapsed < waterCriticalUntil);
    comboChip.style.setProperty("--combo-left", comboProgress().toFixed(3));
    const rank = comboRank();
    comboChip.dataset.rank = rank;
    comboChip.classList.toggle("active", state.combo > 1);
    comboChip.classList.toggle("ranked", Boolean(rank));
    comboChip.classList.toggle("expiring", state.combo > 1 && comboProgress() < 0.32);
    comboChip.classList.toggle("surge", state.combo >= 4 && state.comboPulse > 0.14);
    comboChip.classList.toggle("milestone", state.combo >= 5 && state.combo % 5 === 0 && state.comboPulse > 0.2);
    comboChip.textContent = openActive
      ? state.combo > 1
        ? `x${state.combo}`
        : "续水"
      : state.combo > 1
        ? `x${state.combo}`
        : "";
    scoreEl.textContent = String(state.correctBubbleCount);
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
    updateDebugPanel();
  }

  function resetGame() {
    state.running = true;
    state.lastTime = performance.now();
    state.elapsed = 0;
    state.score = 0;
    state.correctBubbleCount = 0;
    state.poppedCount = 0;
    state.water = 100;
    lastHudWater = null;
    waterGainUntil = 0;
    waterDrainUntil = 0;
    waterShockUntil = 0;
    waterCriticalUntil = 0;
    lastWaterBand = "safe";
    waterLowVibrationArmed = true;
    state.waterPressure = 0;
    state.hiddenLeak = 0;
    state.hiddenLeakActive = false;
    state.wrongStreak = 0;
    state.lastUsefulActionAt = 0;
    resetCombo({ recovery: false });
    state.bestCombo = 0;
    state.comboRecoveryUntil = 0;
    state.comboRecoveryPower = 0;
    state.clearSkillCharge = 1;
    state.clearSkillUses = 0;
    state.waterRoundIndex = 0;
    state.waterRoundSpawned = 0;
    state.waterOpportunityCount = 0;
    state.stageLevel = 1;
    state.stageStartAt = 0;
    state.stageFinalSpawnAt = 0;
    state.stagePlan = null;
    state.stageSpawned = 0;
    state.stageTargetSpawned = 0;
    state.stageCorrectPops = 0;
    state.stageMissedTargets = 0;
    state.stageWrongPops = 0;
    resetBombComboTimer();
    state.bombSpawnCursor = 0;
    state.difficultyTier = 0;
    state.difficultyFlash = 0;
    state.openPopCount = 0;
    state.colorCursor = pickColorIndex();
    state.edgeCursor = Math.floor(rand(0, edgeCycle.length));
    state.nextPowerAt = 22000;
    state.nextStreamAt = 40000;
    state.nextSpawnAt = 120;
    state.bubbleCounter = 0;
    state.customBubblePack = loadCustomBubblePack();
    state.customPackStatus = state.customBubblePack ? `PACK ${state.customBubblePack.name}` : "";
    state.customPackLastSpawnAt = 0;
    state.customHoldPointerId = null;
    state.customHoldBubbleUid = null;
    state.customHoldX = 0;
    state.customHoldY = 0;
    state.catBubbleCounter = 0;
    state.catBubbleSpawned = 0;
    state.lastCatBubbleAt = -Infinity;
    state.nextCatBubbleRollAt = 0;
    state.catMistakeCounting = false;
    state.catMistakeCount = 0;
    state.catMistakeTarget = Math.floor(rand(10, 21));
    state.catHoldPointerId = null;
    state.catHoldBubbleId = null;
    state.catHoldX = 0;
    state.catHoldY = 0;
    state.spawnFlow = null;
    state.spawnFlowIndex = 0;
    resetStagePlan(1);
    resetBackgroundFlow();
    state.openUntil = 0;
    state.flash = 0;
    state.mistakeFlash = 0;
    clearRuntimeEffects();
    state.lastSwipeX = 0;
    state.lastSwipeY = 0;
    if (titleMark) {
      titleMark.textContent = "泡泡补水";
    }
    updateHud();
    curtain.classList.add("hidden");
    endStats.textContent = "";
    lastFrameTime = performance.now();
    perfFrames = 0;
    perfLastTime = lastFrameTime;
    performanceWorkMs = currentTargetFrameMs() * 0.35;
    performanceSlowSince = 0;
    performanceCoolSince = 0;
    resetFrameStats();
    applyPerformanceProfile();
    draw();
    updatePerfDebug(lastFrameTime, true);
    scheduleLoop();
  }

  function endGame() {
    if (!state.running) return;
    waterShockUntil = Math.max(waterShockUntil, state.elapsed + 720);
    waterCriticalUntil = Math.max(waterCriticalUntil, state.elapsed + 1100);
    lastWaterBand = "critical";
    if (navigator.vibrate) {
      navigator.vibrate([22, 38, 22]);
    }
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
    clearRuntimeEffects();
    updateHud();
    draw();
    updatePerfDebug(performance.now(), true);
  }

  function difficulty() {
    const level = displayDifficultyLevel();
    const levelPart = clamp((level - 1) / 18, 0, 1);
    const latePart = smoothstep(10, 30, level);
    const stagePart = smoothstep(0.08, 0.92, stageCompletion());
    const scorePart = smoothstep(12, 220, state.score);
    return clamp(levelPart * 0.92 + latePart * 0.36 + stagePart * 0.1 + scorePart * 0.12, 0, 1.42);
  }

  function difficultyTier(value) {
    return Math.max(0, displayDifficultyLevel() - 1);
  }

  function triggerDifficultyUp(tier) {
    state.difficultyTier = tier;
    state.difficultyFlash = 1;
    state.flash = Math.max(state.flash, 0.3);
  }

  function requiredCorrectRate() {
    return state.stagePlan?.correctRate ?? targetCorrectRateForLevel(displayDifficultyLevel());
  }

  function baseWaterDrainRate() {
    const level = displayDifficultyLevel();
    const p = clamp((level - 1) / 18, 0, 1);
    const stageTension = smoothstep(0.55, 1, stageCompletion()) * (0.08 + p * 0.2);
    return clamp(levelWaterDrainRate(level) + stageTension, 1.16, 3.32);
  }

  function waterPressureHorizon() {
    return 7.8 - clamp((displayDifficultyLevel() - 1) / 18, 0, 1) * 2.2;
  }

  function waterDrainRate() {
    const pressureRate = state.waterPressure / waterPressureHorizon();
    return baseWaterDrainRate() + pressureRate * requiredCorrectRate() * 0.18 + hiddenLeakDrainRate();
  }

  function hiddenLeakWrongLimit() {
    const level = displayDifficultyLevel();
    if (level >= 9) return 2;
    if (level >= 4) return 3;
    return 4;
  }

  function hiddenLeakIdleLimit() {
    const level = displayDifficultyLevel();
    return 9000 - smoothstep(1, 8, level) * 2600 - smoothstep(8, 16, level) * 1300;
  }

  function hiddenLeakDrainRate() {
    if (!state.hiddenLeakActive && state.hiddenLeak <= 0) return 0;
    const level = displayDifficultyLevel();
    const p = clamp((level - 1) / 14, 0, 1);
    return state.hiddenLeak * (1.55 + p * 1.05 + smoothstep(5, 12, level) * 0.55);
  }

  function noteUsefulAction() {
    state.lastUsefulActionAt = state.elapsed;
    state.wrongStreak = 0;
    state.hiddenLeak = 0;
    state.hiddenLeakActive = false;
  }

  function noteWrongAction() {
    state.wrongStreak += 1;
    if (state.wrongStreak >= hiddenLeakWrongLimit()) {
      state.hiddenLeakActive = true;
      state.hiddenLeak = Math.max(state.hiddenLeak, clamp(0.46 + (state.wrongStreak - hiddenLeakWrongLimit()) * 0.18, 0, 1));
    }
  }

  function updateHiddenLeak(dt) {
    if (!state.running) return;
    const idleOver = state.elapsed - state.lastUsefulActionAt - hiddenLeakIdleLimit();
    if (idleOver > 0) {
      state.hiddenLeakActive = true;
      state.hiddenLeak = Math.max(state.hiddenLeak, clamp(idleOver / 4200, 0.18, 1));
    }
    if (!state.hiddenLeakActive) {
      state.hiddenLeak = Math.max(0, state.hiddenLeak - dt * 2.6);
      return;
    }
    state.hiddenLeak = clamp(state.hiddenLeak + dt * 0.18, 0, 1);
  }

  function drainWater(dt) {
    const pressureRate = state.waterPressure / waterPressureHorizon();
    state.waterPressure = Math.max(0, state.waterPressure - pressureRate * dt);
  }

  function formatWaterGain(value) {
    const rounded = Math.round(value * 10) / 10;
    return Math.abs(rounded - Math.round(rounded)) < 0.05 ? String(Math.round(rounded)) : rounded.toFixed(1);
  }

  function addWater(amount, options = {}) {
    const applied = correctWaterGain;
    state.water = Math.min(100, state.water + applied);
    return applied;
  }

  function relieveWaterPressureOnCorrect(appliedWaterGain, bubble) {
    if (state.waterPressure <= 0 || !isStageTargetBubble(bubble)) return;
    const levelHelp = smoothstep(5, 14, displayDifficultyLevel());
    const recoveryHelp = state.elapsed < state.comboRecoveryUntil ? 1.45 : 1;
    const relief = (0.08 + appliedWaterGain * 0.1 + levelHelp * 0.14) * recoveryHelp;
    state.waterPressure = Math.max(0, state.waterPressure - relief);
  }

  function waterOpportunityValue(bubble) {
    if (bubble.isClear) return 8;
    if (bubble.isBleach) return 3.6;
    if (bubble.isBomb) return 4.2;
    if (bubble.isWhite) return bubble.baseRadius <= 27 || bubble.isStream ? 1.4 : 2.2;
    return bubble.waterValue ?? (bubble.baseRadius <= 27 ? 3.7 : 5.35);
  }

  function isSpecialBubble(bubble) {
    return Boolean(bubble && (bubble.isSuper || bubble.isClear || bubble.isBleach || bubble.isBomb || bubble.isCat));
  }

  function noteWaterOpportunity(bubble) {
    if (!bubble || bubble.colorIndex < 0) return;
  }

  function recordStageCorrect(bubble) {
    if (!state.stagePlan || !bubble) return;
    if (bubble.colorIndex < 0 || bubble.isWhite || (bubble.waterValue ?? 0) <= 0) return;
    state.correctBubbleCount += 1;
    if (bubble.stageLevel !== state.stageLevel) return;
    state.stageCorrectPops = Math.min(state.stageCorrectPops + 1, state.stagePlan.totalBubbles);
  }

  function isStageTargetBubble(bubble) {
    return Boolean(bubble && bubble.colorIndex >= 0 && !bubble.isWhite && (bubble.waterValue ?? 0) > 0);
  }

  function stageMistakePenalty(type, bubble) {
    if (bubble) {
      const value = type === "wrong" ? bubble.wrongPenalty : bubble.missPenalty;
      if (Number.isFinite(value) && value > 0) return value;
    }
    const level = displayDifficultyLevel();
    const p = clamp((level - 1) / 18, 0, 1);
    const late = smoothstep(10, 26, level);
    const sizeFactor = bubble ? clamp(bubble.baseRadius / 42, 0.62, 1.25) : 1;
    if (type === "wrong") return (4.4 + p * 5.8 + late * 2.6) * sizeFactor;
    return (1.35 + p * 3.15 + late * 1.65) * sizeFactor;
  }

  function penalizeStageMistake(bubble, type) {
    if (!isStageTargetBubble(bubble)) return;
    const penalty = mistakeWaterPenalty;
    if (bubble.stageLevel === state.stageLevel) {
      if (type === "wrong") state.stageWrongPops += 1;
      if (type === "miss") state.stageMissedTargets += 1;
    }
    if (type === "wrong" && displayDifficultyLevel() >= catBubbleMinLevel) {
      if (!state.catMistakeCounting) {
        state.catMistakeCounting = true;
        state.catMistakeCount = 0;
        state.catMistakeTarget = Math.floor(rand(10, 21));
      }
      state.catMistakeCount += 1;
    }
    state.waterPressure = Math.min(waterPressureCap, state.waterPressure + penalty * 0.85);
    state.water = Math.max(0, state.water - penalty);
    if (state.water <= 0) {
      endGame();
    }
  }

  function bubbleRadiusRange(d, kind = "normal") {
    const shrink = smoothstep(0.04, 1, d);
    const ranges = {
      normal: [47, 55, 27, 35],
      large: [60, 70, 39, 50],
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

  function radiusForArchetype(type) {
    const base = clamp(Math.min(state.width, state.height) * 0.125, 48, 68);
    if (type === "bigRise") return base * rand(0.9, 1.0);
    if (type === "bigSide") return base * rand(0.8, 0.9);
    if (type === "machine") return rand(20, 30);
    if (type === "sGroup") return rand(30, 42);
    if (type === "small") return rand(26, 36);
    return rand(38, 50);
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
    if (state.bubbles.length >= maxActiveBubbles) return false;
    const d = difficulty();
    const margin = 72;
    const edge = pickSpawnEdge(options.edge);
    const kind = forcedKind === "open" ? "normal" : (forcedKind ?? "normal");
    if (kind === "normal" && !options.ignoreStageBudget && state.stagePlan && state.stageSpawned >= state.stagePlan.totalBubbles) {
      return false;
    }
    const isSuper = false;
    const isClear = kind === "clear";
    const isBleach = kind === "bleach";
    const isBomb = kind === "bomb";
    const isCat = kind === "cat";
    const forcedSize = options.sizeKind ?? null;
    const smallWave =
      options.isStream ||
      forcedSize === "small" ||
      (forcedSize !== "normal" && (forceSmall || (d > 0.58 && Math.random() < (d - 0.42) * 0.34)));
    const radiusKind = forcedSize === "large" ? "large" : smallWave ? "small" : "normal";
    const radius = options.radius ?? (isBleach ? radiusForDifficulty(d, "normal") * rand(0.9, 1.04) : radiusForDifficulty(d, radiusKind));
    const speed = options.speed ?? (isBleach ? rand(74 + d * 18, 104 + d * 26) : rand(24 + d * 18, 50 + d * 42));
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
    const waterProfile =
      kind === "normal"
        ? options.waterProfile ?? nextBubbleWaterProfile(radius, speed, {
            isStream: options.isStream,
            sizeKind: radiusKind,
            streamPattern: options.streamPattern,
          })
        : { waterValue: 0, missPenalty: 0, wrongPenalty: 0, difficultyWeight: 1 };
    const waterValue = kind === "normal" ? (options.waterValue ?? waterProfile.waterValue) : 0;
    const spriteColorIndex = colorIndex >= 0 ? colorIndex : pickColorIndex();
    const spriteIndex = options.spriteIndex ?? pickBubbleSprite(spriteColorIndex, radius, smallWave);
    const target =
      options.target ??
      (isBleach
        ? bleachExitTarget(edge, radius, x, y)
        : kind === "normal"
        ? matchingPointForColorFromEdge(colorIndex, edge, y, x)
        : {
            x: rand(state.width * 0.24, state.width * 0.76),
            y: rand(state.height * 0.24, state.height * 0.72),
          });
    const velocity = options.velocity ?? aimedVelocity(x, y, target, speed, isBleach ? 6 : kind === "normal" ? 12 : 26);
    const customHoldRequiredMs = Math.max(0, Math.round(options.holdRequiredMs ?? options.customHoldRequiredMs ?? 0));
    const customTapRequired = Math.max(0, Math.round(options.tapRequired ?? options.customTapRequired ?? 1));
    const spawnProtectMass = spawnProtectionMassForRadius(radius);
    const bubble = {
      uid: ++state.bubbleCounter,
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
      spawnProtectMass,
      spawnProtectInvMass: 1 / spawnProtectMass,
      waterValue,
      missPenalty: waterProfile.missPenalty ?? 0,
      wrongPenalty: waterProfile.wrongPenalty ?? 0,
      difficultyWeight: waterProfile.difficultyWeight ?? 1,
      colorIndex,
      stageLevel: kind === "normal" ? state.stageLevel : 0,
      isSuper,
      isClear,
      isBleach,
      isBomb,
      isCat,
      customLabel: options.customLabel ?? "",
      customHits: 0,
      customTapRequired: customTapRequired <= 0 && customHoldRequiredMs <= 0 ? 1 : customTapRequired,
      customHoldMs: 0,
      customHoldRequiredMs,
      catId: isCat ? ++state.catBubbleCounter : 0,
      catHits: 0,
      catHoldMs: 0,
      catTapRequired: options.catTapRequired ?? catBubbleTapRequired,
      catHoldRequiredMs: options.catHoldRequiredMs ?? catBubbleHoldMs,
      bleachHits: 0,
      bleachRequiredHits,
      bleachExpireAt: isBleach ? state.elapsed + bleachLifetimeMs : 0,
      bleachHitCooldownUntil: 0,
      bleachEscaping: false,
      isWhite: Boolean(options.isWhite),
      whiteUntil: options.whiteUntil ?? 0,
      restoreState: null,
      matchDwell: 0,
      fairPassComplete: kind !== "normal",
      isStream: Boolean(options.isStream),
      streamPattern: options.streamPattern ?? "float",
      streamPhase: options.streamPhase ?? rand(0, Math.PI * 2),
      streamAmplitude: options.streamAmplitude ?? 0,
      streamFrequency: options.streamFrequency ?? 3.6,
      arcBend: options.arcBend ?? 0,
      arcLife: options.arcLife ?? 2.8,
      customPath: options.customPath ?? null,
      openReady: false,
      wobble: rand(0, Math.PI * 2),
      wobbleSpeed: options.isStream ? rand(0.6, 1.05) : rand(1.1, 2.2),
      drift: options.isStream ? rand(-0.28, 0.28) : rand(-1, 1),
      age: -(options.delay ?? 0),
      wasReady: false,
      spin: rand(-1.6, 1.6),
      edge,
    };
    state.bubbles.push(bubble);
    if (kind === "normal" && !options.ignoreStageBudget) {
      state.stageSpawned += 1;
      if (state.stagePlan && state.stageSpawned >= state.stagePlan.totalBubbles) {
        state.stageFinalSpawnAt = state.elapsed + Math.max(0, options.delay ?? 0) * 1000;
      }
    }
    noteWaterOpportunity(bubble);

    const hintColor = isBomb
      ? bombTone.light
      : isBleach
        ? whiteTone.light
        : isCat
          ? "#fff6d6"
          : isClear
            ? clearTone.color
            : isSuper
              ? openTone.color
              : palette[colorIndex].color;
    if (!options.quietHint) {
      makeSpawnHint(edge, x, y, radius, hintColor, 0.46);
    }
    return true;
  }

  function pointFromEdge(edge, radius, offset) {
    const margin = Math.max(64, Math.min(92, state.width * 0.2));
    if (edge === "left") return { x: -radius, y: clamp(offset, margin, state.height - margin) };
    if (edge === "right") return { x: state.width + radius, y: clamp(offset, margin, state.height - margin) };
    if (edge === "top") return { x: clamp(offset, margin, state.width - margin), y: -radius };
    return { x: clamp(offset, margin, state.width - margin), y: state.height + radius };
  }

  function hasActiveCatBubble() {
    return state.bubbles.some((bubble) => bubble.isCat);
  }

  function catBubbleById(catId) {
    return state.bubbles.find((bubble) => bubble.isCat && bubble.catId === catId) ?? null;
  }

  function spawnCatBubble(reason = "level") {
    if (!state.running || displayDifficultyLevel() < catBubbleMinLevel) return false;
    if (hasActiveCatBubble()) return false;
    if (state.bubbles.length >= maxActiveBubbles) return false;

    const d = difficulty();
    const edge = pickSpawnEdge();
    const radius = clamp(radiusForDifficulty(d, "large") * rand(1.08, 1.22), 46, 72);
    const offset =
      edge === "left" || edge === "right"
        ? rand(state.height * 0.28, state.height * 0.72)
        : rand(state.width * 0.24, state.width * 0.76);
    const start = pointFromEdge(edge, radius, offset);
    const target = {
      x: rand(state.width * 0.28, state.width * 0.72),
      y: rand(state.height * 0.28, state.height * 0.72),
    };
    const speed = rand(32 + d * 8, 48 + d * 12);
    const velocity = aimedVelocity(start.x, start.y, target, speed, 8);
    const spawned = spawnBubble(false, "cat", {
      edge,
      x: start.x,
      y: start.y,
      target,
      velocity,
      radius,
      speed,
      quietHint: false,
    });

    if (spawned) {
      state.catBubbleSpawned += 1;
      state.lastCatBubbleAt = state.elapsed;
      state.ripples.push({
        x: clamp(start.x, 0, state.width),
        y: clamp(start.y, 0, state.height),
        radius: radius * 0.7,
        age: 0,
        life: 0.48,
        color: "#fff6d6",
        power: reason === "mistake" ? 0.98 : 0.72,
      });
    }
    return spawned;
  }

  function maybeActivateCatBubbleSystem() {
    if (displayDifficultyLevel() < catBubbleMinLevel) return;
    if (state.water > 75 || hasActiveCatBubble()) return;
    if (state.elapsed - (state.lastCatBubbleAt ?? -Infinity) < catBubbleCooldownMs) return;
    if (state.elapsed < (state.nextCatBubbleRollAt ?? 0)) return;
    state.nextCatBubbleRollAt = state.elapsed + catBubbleRollIntervalMs;
    const chance = state.water <= 25 ? 0.25 : 0.1;
    if (Math.random() < chance) {
      spawnCatBubble(state.water <= 25 ? "critical" : "low");
    }
  }

  function spawnComboBomb() {
    if (!state.running || state.bubbles.length >= maxActiveBubbles) return false;
    const d = difficulty();
    const edge = edgeCycle[state.bombSpawnCursor % edgeCycle.length];
    state.bombSpawnCursor += 1;
    const radius = radiusForDifficulty(d, "stream") * rand(0.72, 0.9);
    const horizontal = edge === "left" || edge === "right";
    const anchor =
      (horizontal ? state.height : state.width) *
      clamp(0.5 + Math.sin(state.combo * 0.47 + state.bombSpawnCursor) * 0.24, 0.22, 0.78);
    const start = pointFromEdge(edge, radius, anchor);
    const target = horizontal
      ? {
          x: edge === "left" ? state.width * 0.76 : state.width * 0.24,
          y: clamp(anchor + Math.sin(state.combo * 0.31) * state.height * 0.13, state.height * 0.22, state.height * 0.78),
        }
      : {
          x: clamp(anchor + Math.cos(state.combo * 0.29) * state.width * 0.13, state.width * 0.22, state.width * 0.78),
          y: edge === "top" ? state.height * 0.72 : state.height * 0.28,
        };
    const speed = rand(148 + d * 42, 196 + d * 62);
    const velocity = aimedVelocity(start.x, start.y, target, speed, 2);
    return spawnBubble(false, "bomb", {
      edge,
      x: start.x,
      y: start.y,
      target,
      velocity,
      radius,
      speed,
    });
  }

  function makeSpawnHint(edge, x, y, radius, color, alpha = 0.36, count = 1) {
    return;
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
    trimArray(state.hints, effectLimit("hints"));
  }

  function spawnBubbleStream(d) {
    const edge = pickSpawnEdge();
    const streamLevel = displayDifficultyLevel();
    const sameColorStream = streamLevel <= 1;
    const streamColorIndex = sameColorStream ? pickBalancedColorIndex() : null;
    const pattern = sameColorStream ? "spray" : d > 0.38 && Math.random() < 0.46 + d * 0.2 ? "zigzag" : "spray";
    const desiredCount =
      streamLevel <= 3
        ? Math.round(rand(10, 14))
        : streamLevel === 4
          ? Math.round(rand(13 + d * 2, 18 + d * 3))
          : Math.round(rand(16 + d * 2, 22 + d * 3));
    const count = Math.min(desiredCount, Math.max(0, maxActiveBubbles - state.bubbles.length));
    if (count <= 0) return;
    const radius = radiusForDifficulty(d, "stream");
    const cadence =
      streamLevel <= 3
        ? rand(0.078, 0.105)
        : sameColorStream
          ? rand(0.058, 0.078)
          : rand(0.064, 0.09);
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
        arcBend: (lane > 0 ? 1 : -1) * rand(10 + d * 6, 24 + d * 10),
        arcLife: rand(1.9, 2.7),
        delay: pulse * cadence + (i % 2) * cadence * 0.36,
        quietHint: true,
      });
    }
  }

  function spawnBubbleCluster(d, maxCount = 4) {
    const edge = pickSpawnEdge();
    const count = Math.min(maxCount, Math.max(0, maxActiveBubbles - state.bubbles.length), Math.round(rand(2, 3 + d * 2)));
    if (count <= 0) return;
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

  function spawnBubbleFan(d, maxCount = 4) {
    const edge = pickSpawnEdge();
    const count = Math.min(maxCount, Math.max(0, maxActiveBubbles - state.bubbles.length), Math.round(rand(3, 4 + d * 2)));
    if (count <= 0) return;
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

  function spawnAxisLength(edge) {
    return edge === "left" || edge === "right" ? state.height : state.width;
  }

  function pointFromSpawnRegion(region, radius, progress, jitter = 0.035) {
    const axis = spawnAxisLength(region.edge);
    const center = region.start + (region.end - region.start) * smoothstep(0, 1, progress);
    const drift = Math.sin(progress * Math.PI * 2 + region.phase) * (region.max - region.min) * 0.08;
    const offset = clamp((center + drift + rand(-jitter, jitter)) * axis, region.min * axis, region.max * axis);
    return pointFromEdge(region.edge, radius, offset);
  }

  function makeSpawnRegion(base, phase = 0) {
    const span = base.max - base.min;
    const center = rand(base.min + span * 0.24, base.max - span * 0.24);
    const drift = rand(-span * 0.32, span * 0.32);
    return {
      ...base,
      start: clamp(center - drift * 0.5, base.min, base.max),
      end: clamp(center + drift * 0.5, base.min, base.max),
      phase: rand(0, Math.PI * 2) + phase,
    };
  }

  function oppositeEdge(edge) {
    if (edge === "left") return "right";
    if (edge === "right") return "left";
    if (edge === "top") return "bottom";
    return "top";
  }

  function createSpawnFlow() {
    const level = displayDifficultyLevel();
    if (!state.stagePlan || state.stagePlan.level !== level) {
      resetStagePlan(level);
    }
    const d = difficulty();
    const type = chooseSpawnArchetype(level, d);
    const forcedEdge =
      type === "bigRise"
        ? "bottom"
        : type === "bigSide"
          ? Math.random() < 0.5 ? "left" : "right"
          : null;
    const candidates = forcedEdge ? spawnRegions.filter((region) => region.edge === forcedEdge) : spawnRegions;
    const primaryIndex = (state.spawnFlowIndex * (level < 4 ? 3 : 4) + Math.floor(rand(0, Math.min(3, candidates.length)))) % candidates.length;
    const primaryBase = candidates[primaryIndex];
    const secondaryBase =
      type === "crossArc"
        ? spawnRegions.filter((region) => region.edge === oppositeEdge(primaryBase.edge))[
            (primaryIndex + Math.floor(rand(0, 3))) % spawnRegions.filter((region) => region.edge === oppositeEdge(primaryBase.edge)).length
          ]
        : Math.random() < (level <= 1 ? 0.18 : level < 4 ? 0.52 : 0.58)
          ? spawnRegions[(primaryIndex + Math.floor(rand(3, spawnRegions.length - 1))) % spawnRegions.length]
          : null;
    state.spawnFlowIndex += 1;
    return {
      startAt: state.elapsed,
      duration:
        level <= 1
          ? rand(4300, 6800)
          : type === "machine" || type === "crossArc" || type === "sGroup"
            ? rand(2400, 4000)
            : rand(3000, 5600) - d * 380,
      primary: makeSpawnRegion(primaryBase),
      secondary: secondaryBase ? makeSpawnRegion(secondaryBase, 1.4) : null,
      type,
      share: rand(0.72, 0.86),
      peak: rand(0.42, 0.62),
      usedBurst: false,
      usedLarge: false,
    };
  }

  function chooseSpawnArchetype(level, d) {
    const weights = state.stagePlan?.weights ?? stageTypeWeights(level);
    const choices = Object.entries(weights)
      .map(([type, weight]) => [type, Math.max(0, weight * rand(0.94, 1.06) + d * 0.02)])
      .filter(([, weight]) => weight > 0);
    const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * total;
    for (const [type, weight] of choices) {
      roll -= weight;
      if (roll <= 0) return type;
    }
    return "normal";
  }

  function ensureSpawnFlow() {
    if (!state.spawnFlow || state.elapsed >= state.spawnFlow.startAt + state.spawnFlow.duration) {
      state.spawnFlow = createSpawnFlow();
    }
    return state.spawnFlow;
  }

  function spawnFlowProgress(flow) {
    return clamp((state.elapsed - flow.startAt) / Math.max(1, flow.duration), 0, 1);
  }

  function spawnFlowRhythm(flow) {
    const progress = spawnFlowProgress(flow);
    const pulse = Math.sin(progress * Math.PI);
    const peak = Math.exp(-Math.pow((progress - flow.peak) / 0.18, 2));
    return clamp(0.48 + pulse * 0.62 + peak * 0.36, 0.42, 1.62);
  }

  function scheduleFlowSpawn(flow, count = 1) {
    const d = difficulty();
    const remaining = Math.max(1, stageRemainingBubbles());
    const remainingMs = Math.max(700, state.stageStartAt + stageDurationMs - state.elapsed);
    const budgetInterval = remainingMs / remaining;
    const base =
      flow.type === "bigRise"
        ? 1120
        : flow.type === "bigSide"
          ? 980
          : flow.type === "crossArc"
            ? 620
          : flow.type === "machine" && !flow.usedBurst
            ? 420
            : flow.type === "sGroup"
              ? 680
              : 760;
    const flowInterval = (base * rand(0.82, 1.18)) / spawnFlowRhythm(flow) - d * 130;
    const interval = clamp(Math.min(flowInterval, budgetInterval * rand(0.72, 1.08)), 180, 1320);
    state.nextSpawnAt = state.elapsed + interval + Math.max(0, count - 1) * 52;
  }

  function pickFlowRegion(flow) {
    if (flow.type === "bigRise" || flow.type === "bigSide" || flow.type === "machine" || flow.type === "sGroup" || flow.type === "crossArc") return flow.primary;
    return flow.secondary && Math.random() > flow.share ? flow.secondary : flow.primary;
  }

  function activeLargeBubbleCount() {
    return state.bubbles.reduce((count, bubble) => count + (bubble.age >= -0.2 && bubble.baseRadius >= 42 ? 1 : 0), 0);
  }

  function spawnPointCrowded(x, y, radius, colorIndex) {
    for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
      const other = state.bubbles[i];
      if (other.age < -1) continue;
      const dx = x - other.x;
      const dy = y - other.y;
      const bigOrDifferent = radius >= 36 || other.baseRadius >= 36 || (colorIndex >= 0 && other.colorIndex >= 0 && colorIndex !== other.colorIndex);
      const minDistance = (radius + other.baseRadius) * (bigOrDifferent ? 0.82 : 0.54);
      if (dx * dx + dy * dy < minDistance * minDistance) return true;
    }
    return false;
  }

  function customTemplatesForLevel(level) {
    const pack = state.customBubblePack;
    if (!pack || level < pack.spawn.minLevel) return [];
    return pack.bubbles.filter((template) => level >= template.levelMin && level <= template.levelMax && template.weight > 0);
  }

  function chooseCustomTemplate(templates) {
    const total = templates.reduce((sum, template) => sum + template.weight, 0);
    let roll = Math.random() * total;
    for (const template of templates) {
      roll -= template.weight;
      if (roll <= 0) return template;
    }
    return templates[templates.length - 1] ?? null;
  }

  function edgeForCustomTemplate(template) {
    return template.edge === "random" ? pickSpawnEdge() : template.edge;
  }

  function customColorIndex(template, start) {
    if (template.colorMode === "left") return 0;
    if (template.colorMode === "right") return 1;
    if (template.colorMode === "random") return pickColorIndex();
    if (template.colorMode === "background") {
      return backgroundColorIndexAt(clamp(start.x, 0, state.width), clamp(start.y, 0, state.height));
    }
    return pickBalancedColorIndex();
  }

  function customStartPoint(template, edge, radius, index, count) {
    const axis = spawnAxisLength(edge);
    const center = pickRange(template.lane, 0.5);
    const laneSpread = count > 1 ? (index - (count - 1) / 2) * rand(0.026, 0.048) : 0;
    const lane = clamp(center + laneSpread, 0.08, 0.92);
    return pointFromEdge(edge, radius, lane * axis);
  }

  function customTargetPoint(template, edge, start, colorIndex) {
    if (template.colorMode === "auto" && Math.random() < 0.38) {
      return matchingPointForColorFromEdge(colorIndex, edge, start.y, start.x);
    }
    return {
      x: pickRange(template.aimX, 0.5) * state.width,
      y: pickRange(template.aimY, 0.5) * state.height,
    };
  }

  function customTrajectoryOptions(template, index) {
    const trajectory = template.trajectory;
    const amplitude = pickRange(template.amplitude, 0);
    const frequency = pickRange(template.frequency, 1.8);
    const arcBend = pickRange(template.arcBend, 0);
    const useStream = trajectory !== "straight" || amplitude > 0;
    const streamPattern =
      trajectory === "straight"
        ? "float"
        : trajectory === "arc"
          ? "arcDrift"
          : trajectory === "fan"
            ? "fan"
            : trajectory;
    return {
      isStream: useStream,
      streamPattern,
      streamAmplitude: trajectory === "straight" ? amplitude * 0.35 : amplitude,
      streamFrequency: frequency,
      streamPhase: index * 0.58 + rand(0, Math.PI * 2),
      arcBend,
      arcLife: pickRange(template.arcLife, 2.6),
    };
  }

  function pathEdgeFromPoint(point) {
    const left = point.x;
    const right = state.width - point.x;
    const top = point.y;
    const bottom = state.height - point.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) return "left";
    if (min === right) return "right";
    if (min === top) return "top";
    return "bottom";
  }

  function customPathForTemplate(template, radius, speed, index, count) {
    const points = template.path?.points;
    if (!points || points.length < 2) return null;
    const first = points[0];
    const last = points[points.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const spacing = pickRange(template.spacing, 12);
    const stagger = count > 1 ? (index % 2 === 0 ? 1 : -1) * Math.ceil(index / 2) : 0;
    const laneGap = Math.min(radius * 0.82 + spacing * 0.42, radius + 34);
    const wiggle = Math.sin((state.bubbleCounter + index * 17.13) * 1.618) * Math.min(radius * 0.1, Math.max(1.5, spacing * 0.16));
    const offsetAmount = stagger * laneGap + wiggle;
    const offsetX = (-dy / length) * offsetAmount;
    const offsetY = (dx / length) * offsetAmount;
    const pixelPoints = points.map((point) => ({
      x: clamp(point.x * state.width + offsetX, radius * 0.35, state.width - radius * 0.35),
      y: clamp(point.y * state.height + offsetY, radius * 0.35, state.height - radius * 0.35),
    }));
    const motionPoints = sampleCurvedCustomPath(pixelPoints, template.path.curve ?? 0.68, {
      minX: radius * 0.35,
      maxX: state.width - radius * 0.35,
      minY: radius * 0.35,
      maxY: state.height - radius * 0.35,
    });
    const segments = [];
    let totalLength = 0;
    for (let i = 1; i < motionPoints.length; i += 1) {
      const segmentLength = Math.hypot(motionPoints[i].x - motionPoints[i - 1].x, motionPoints[i].y - motionPoints[i - 1].y);
      totalLength += segmentLength;
      segments.push(totalLength);
    }
    const duration = clamp(totalLength / Math.max(12, speed), 0.85, 9.5);
    return {
      mode: template.path.mode,
      points: motionPoints,
      segments,
      totalLength,
      duration,
    };
  }

  function sampleCurvedCustomPath(points, curve = 0.68, bounds = {}) {
    if (!points || points.length < 2) return points || [];
    const strength = clamp(curve, 0, 1);
    if (strength <= 0.01) return points;
    const sampled = [points[0]];
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = clamp(Math.ceil(distance / 18), 5, 16);
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        sampled.push(clampPathPoint(blendCurvedPoint(points, p0, p1, p2, p3, t, strength), bounds));
      }
    }
    return simplifyPixelPath(sampled, 112);
  }

  function blendCurvedPoint(allPoints, p0, p1, p2, p3, t, strength) {
    const lineX = p1.x + (p2.x - p1.x) * t;
    const lineY = p1.y + (p2.y - p1.y) * t;
    if (allPoints.length === 2) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const bend = Math.sin(t * Math.PI) * distance * 0.18 * strength;
      return { x: lineX - (dy / distance) * bend, y: lineY + (dx / distance) * bend };
    }
    const t2 = t * t;
    const t3 = t2 * t;
    const curveX =
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    const curveY =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    return {
      x: lineX + (curveX - lineX) * strength,
      y: lineY + (curveY - lineY) * strength,
    };
  }

  function clampPathPoint(point, bounds) {
    return {
      x: clamp(point.x, bounds.minX ?? 0, bounds.maxX ?? state.width),
      y: clamp(point.y, bounds.minY ?? 0, bounds.maxY ?? state.height),
    };
  }

  function simplifyPixelPath(points, maxPoints) {
    if (points.length <= maxPoints) return points;
    const simplified = [points[0]];
    const step = (points.length - 1) / (maxPoints - 2);
    for (let index = 1; index < maxPoints - 1; index += 1) {
      simplified.push(points[Math.round(index * step)]);
    }
    simplified.push(points[points.length - 1]);
    return simplified;
  }

  function pointAtCustomPath(path, amount) {
    const points = path.points;
    if (!points?.length) return null;
    if (points.length === 1 || amount <= 0) return points[0];
    if (amount >= 1) return points[points.length - 1];
    const targetLength = path.totalLength * amount;
    let previousLength = 0;
    for (let i = 1; i < points.length; i += 1) {
      const currentLength = path.segments[i - 1];
      if (targetLength <= currentLength) {
        const segmentLength = Math.max(0.001, currentLength - previousLength);
        const t = clamp((targetLength - previousLength) / segmentLength, 0, 1);
        return {
          x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
          y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
        };
      }
      previousLength = currentLength;
    }
    return points[points.length - 1];
  }

  function customTemplateRadius(template, index) {
    const customSize = Array.isArray(template.sizes) ? Number(template.sizes[index]) : NaN;
    return Number.isFinite(customSize) ? clamp(customSize, 14, 86) : pickRange(template.size, 38);
  }

  function customGroupDelay(template, index, speed) {
    if (index <= 0) return 0;
    const spacing = pickRange(template.spacing, 12);
    let distance = 0;
    for (let i = 1; i <= index; i += 1) {
      const previous = customTemplateRadius(template, i - 1);
      const current = customTemplateRadius(template, i);
      distance += previous + current + spacing;
    }
    return distance / Math.max(12, speed);
  }

  function advanceCustomPathBubble(bubble, dt) {
    const path = bubble.customPath;
    if (!path?.points?.length) return false;
    path.elapsed = Math.min(path.duration, (path.elapsed ?? 0) + dt);
    const amount = clamp(path.elapsed / Math.max(0.001, path.duration), 0, 1);
    const point = pointAtCustomPath(path, amount);
    const next = pointAtCustomPath(path, Math.min(1, amount + 0.012));
    if (!point) return false;
    if (next) {
      bubble.vx = (next.x - point.x) / 0.012 / path.duration;
      bubble.vy = (next.y - point.y) / 0.012 / path.duration;
    }
    bubble.x = point.x;
    bubble.y = point.y;
    if (path.elapsed >= path.duration) {
      bubble.customPath = null;
    }
    return true;
  }

  function spawnCustomTemplateBubble(template, index, count) {
    const radius = customTemplateRadius(template, index);
    const speed = pickRange(template.speed, 68);
    const customPath = customPathForTemplate(template, radius, speed, index, count);
    const edge = customPath ? pathEdgeFromPoint(customPath.points[0]) : edgeForCustomTemplate(template);
    let start = customPath ? customPath.points[0] : customStartPoint(template, edge, radius, index, count);
    let colorIndex = customColorIndex(template, start);
    for (let attempt = 0; !customPath && attempt < 5 && spawnPointCrowded(start.x, start.y, radius, colorIndex); attempt += 1) {
      start = customStartPoint(template, edge, radius, index + attempt * 0.37, count + attempt * 0.2);
      colorIndex = customColorIndex(template, start);
    }
    if (spawnPointCrowded(start.x, start.y, radius, colorIndex)) return false;

    const target = customPath ? customPath.points[customPath.points.length - 1] : customTargetPoint(template, edge, start, colorIndex);
    const velocity = aimedVelocity(start.x, start.y, target, speed, 4);
    return spawnBubble(radius <= 28, "normal", {
      edge,
      x: start.x,
      y: start.y,
      colorIndex,
      target,
      velocity,
      radius,
      speed,
      ...(customPath ? {} : customTrajectoryOptions(template, index)),
      customPath,
      delay: customGroupDelay(template, index, speed),
      tapRequired: template.tapCount,
      holdRequiredMs: 0,
      customLabel: template.label,
      quietHint: index > 0,
    });
  }

  function scheduleCustomPackSpawn(count = 1) {
    const pack = state.customBubblePack;
    const interval = pickRange(pack?.spawn?.intervalMs, [520, 920]);
    state.nextSpawnAt = state.elapsed + interval + Math.max(0, count - 1) * 52;
  }

  function trySpawnCustomPackWave(remainingStage) {
    const pack = state.customBubblePack;
    if (!pack || remainingStage <= 0) return false;
    if (state.bubbles.length >= Math.min(maxActiveBubbles, pack.spawn.maxActive)) return false;
    if (Math.random() > pack.spawn.chance) return false;
    const templates = customTemplatesForLevel(displayDifficultyLevel());
    const template = chooseCustomTemplate(templates);
    if (!template) return false;

    const desiredCount = Math.round(pickRange(template.count, 1));
    const count = Math.min(desiredCount, remainingStage, Math.max(0, maxActiveBubbles - state.bubbles.length));
    let spawned = 0;
    for (let index = 0; index < count; index += 1) {
      if (spawnCustomTemplateBubble(template, index, count)) spawned += 1;
    }
    if (spawned <= 0) return false;
    state.customPackLastSpawnAt = state.elapsed;
    state.customPackStatus = `${pack.name} · ${template.label}`;
    scheduleCustomPackSpawn(spawned);
    return true;
  }

  function targetForArchetype(flow, region, start, colorIndex) {
    if (flow.type === "bigRise") {
      return {
        x: clamp(start.x + rand(-state.width * 0.12, state.width * 0.12), state.width * 0.16, state.width * 0.84),
        y: -state.height * rand(0.08, 0.18),
      };
    }
    if (flow.type === "bigSide") {
      const toRight = region.edge === "left";
      return {
        x: toRight ? state.width + state.width * 0.14 : -state.width * 0.14,
        y: clamp(start.y + rand(-state.height * 0.08, state.height * 0.08), state.height * 0.18, state.height * 0.82),
      };
    }
    return matchingPointForColorFromEdge(colorIndex, region.edge, start.y, start.x);
  }

  function speedForArchetype(type, sizeKind, d) {
    if (type === "bigRise") return rand(30 + d * 16, 46 + d * 24);
    if (type === "bigSide") return rand(42 + d * 20, 62 + d * 32);
    if (type === "machine") return rand(104 + d * 44, 142 + d * 62);
    if (type === "crossArc") return rand(78 + d * 34, 104 + d * 48);
    if (type === "sGroup") return rand(58 + d * 34, 82 + d * 48);
    if (sizeKind === "small") return rand(66 + d * 34, 90 + d * 48);
    return rand(48 + d * 26, 74 + d * 38);
  }

  function spawnFlowBubble(flow, options = {}) {
    const d = difficulty();
    const level = displayDifficultyLevel();
    let region = options.region ?? pickFlowRegion(flow);
    const progress = spawnFlowProgress(flow);
    const sizeKind =
      options.sizeKind ??
      (flow.type === "bigRise" || flow.type === "bigSide"
        ? "large"
        : flow.type === "sGroup"
          ? Math.random() < 0.68 ? "small" : "normal"
          : Math.random() < 0.52 ? "small" : "normal");
    const radius =
      options.radius ??
      (flow.type === "bigRise" || flow.type === "bigSide" || flow.type === "sGroup"
        ? radiusForArchetype(flow.type)
        : radiusForArchetype(sizeKind));
    let colorIndex = options.colorIndex ?? pickBalancedColorIndex();
    let start = pointFromSpawnRegion(region, radius, progress);
    if (options.colorIndex === undefined && (flow.type === "bigRise" || flow.type === "bigSide")) {
      colorIndex = backgroundColorIndexAt(clamp(start.x, 0, state.width), clamp(start.y, 0, state.height));
    }
    for (let attempt = 0; attempt < 6 && spawnPointCrowded(start.x, start.y, radius, colorIndex); attempt += 1) {
      region = attempt > 2 && flow.secondary ? flow.secondary : region;
      start = pointFromSpawnRegion(region, radius, clamp(progress + attempt * 0.05, 0, 1), 0.06);
    }
    if (spawnPointCrowded(start.x, start.y, radius, colorIndex)) return false;
    if (options.colorIndex === undefined && (flow.type === "bigRise" || flow.type === "bigSide")) {
      colorIndex = backgroundColorIndexAt(clamp(start.x, 0, state.width), clamp(start.y, 0, state.height));
    }

    const target = targetForArchetype(flow, region, start, colorIndex);
    const speed = speedForArchetype(flow.type, sizeKind, d);
    const velocity = aimedVelocity(start.x, start.y, target, speed, flow.type === "bigRise" || flow.type === "bigSide" ? 3 : 8);
    const curvedMotion = level >= 2 && flow.type !== "machine";
    const motionRoll = Math.random();
    const motionIsStream = flow.type === "sGroup" || (curvedMotion && motionRoll < (flow.type === "bigRise" ? 0.38 : 0.74));
    const motionPattern = flow.type === "sGroup" ? "sGroup" : motionRoll < 0.42 ? "softS" : "arcDrift";
    const motionAmplitude = flow.type === "sGroup" ? rand(16, 28) : motionIsStream ? rand(5 + d * 4, 13 + d * 9) : 0;
    const motionFrequency = flow.type === "sGroup" ? rand(2.1, 3.0) : rand(1.25, 2.25 + d * 0.45);
    const motionArc =
      curvedMotion && Math.random() < (flow.type === "bigRise" ? 0.44 : 0.68)
        ? (Math.random() < 0.5 ? -1 : 1) * rand(18 + d * 8, 42 + d * 18)
        : 0;
    const spawned = spawnBubble(sizeKind === "small", "normal", {
      edge: region.edge,
      x: start.x,
      y: start.y,
      colorIndex,
      target,
      velocity,
      radius,
      speed,
      sizeKind,
      isStream: motionIsStream,
      streamPattern: motionPattern,
      streamAmplitude: motionAmplitude,
      streamFrequency: motionFrequency,
      arcBend: options.arcBend ?? motionArc,
      arcLife: options.arcLife ?? rand(2.15, 3.35),
      quietHint: Boolean(options.quietHint),
      delay: options.delay ?? 0,
    });
    if (spawned && sizeKind === "large") flow.usedLarge = true;
    return spawned;
  }

  function spawnFlowGun(flow, maxAllowed = maxActiveBubbles) {
    const d = difficulty();
    const region = flow.primary;
    const sameColor = displayDifficultyLevel() <= 1;
    const colorIndex = sameColor ? pickBalancedColorIndex() : null;
    const count = Math.min(Math.round(rand(4, 7)), maxAllowed, Math.max(0, maxActiveBubbles - state.bubbles.length));
    const radius = radiusForArchetype("machine");
    const base = pointFromSpawnRegion(region, radius, spawnFlowProgress(flow), 0.012);
    makeSpawnHint(region.edge, base.x, base.y, radius, sameColor ? palette[colorIndex].light : clearTone.light, 0.34, count);
    const inward = edgeDirection(region.edge);
    const horizontal = region.edge === "left" || region.edge === "right";
    const perp = horizontal ? { x: 0, y: 1 } : { x: 1, y: 0 };
    const fan = rand(-0.32, 0.32);
    let spawned = 0;
    for (let i = 0; i < count; i += 1) {
      const pickedColor = sameColor ? colorIndex : pickBalancedColorIndex();
      const lane = (i - (count - 1) / 2) * radius * rand(0.82, 1.05);
      const start = {
        x: base.x + perp.x * lane - inward.x * i * radius * 0.72,
        y: base.y + perp.y * lane - inward.y * i * radius * 0.72,
      };
      const target = {
        x: start.x + (inward.x + perp.x * fan) * state.width * rand(0.72, 1.08),
        y: start.y + (inward.y + perp.y * fan) * state.height * rand(0.72, 1.08),
      };
      const speed = speedForArchetype("machine", "small", d) * rand(0.94, 1.12);
      const velocity = aimedVelocity(start.x, start.y, target, speed, 3);
      const didSpawn = spawnBubble(true, "normal", {
        edge: region.edge,
        x: start.x,
        y: start.y,
        colorIndex: pickedColor,
        target,
        velocity,
        radius: radius * radiusJitter(d, 0.04, 0.12),
        speed,
        isStream: true,
        streamPattern: "spray",
        streamAmplitude: 4 + d * 5,
        streamFrequency: 2.8 + d,
        streamPhase: i * 0.48,
        arcBend: (i % 2 === 0 ? 1 : -1) * rand(14 + d * 5, 28 + d * 10),
        arcLife: rand(1.8, 2.55),
        delay: i * rand(0.11, 0.15),
        quietHint: true,
      });
      if (didSpawn) spawned += 1;
    }
    flow.usedBurst = true;
    return spawned;
  }

  function spawnFlowCrossArc(flow, maxAllowed = maxActiveBubbles) {
    const d = difficulty();
    const capacity = Math.max(0, maxActiveBubbles - state.bubbles.length);
    const total = Math.min(Math.round(rand(5, 8)), maxAllowed, capacity);
    if (total <= 1) return 0;

    const regions = [flow.primary, flow.secondary ?? flow.primary];
    const firstCount = Math.ceil(total / 2);
    const counts = [firstCount, total - firstCount];
    let spawned = 0;

    for (let side = 0; side < 2; side += 1) {
      const region = regions[side];
      const sideCount = counts[side];
      if (!region || sideCount <= 0) continue;

      const inward = edgeDirection(region.edge);
      const horizontal = region.edge === "left" || region.edge === "right";
      const perp = horizontal ? { x: 0, y: 1 } : { x: 1, y: 0 };
      const radius = radiusForDifficulty(d, "stream") * rand(1.08, 1.34);
      const base = pointFromSpawnRegion(region, radius, spawnFlowProgress(flow), 0.018);
      const curveSign = side === 0 ? 1 : -1;
      const stringColor = Math.random() < (displayDifficultyLevel() <= 1 ? 0.82 : displayDifficultyLevel() <= 4 ? 0.34 : 0.46)
        ? pickBalancedColorIndex()
        : null;

      for (let i = 0; i < sideCount; i += 1) {
        const colorIndex = stringColor ?? pickBalancedColorIndex();
        const lane = (i - (sideCount - 1) / 2) * radius * rand(0.78, 1.04);
        const forward = i * radius * rand(0.58, 0.82);
        const start = {
          x: base.x + perp.x * lane - inward.x * forward,
          y: base.y + perp.y * lane - inward.y * forward,
        };
        if (spawnPointCrowded(start.x, start.y, radius, colorIndex)) continue;

        const target = {
          x: start.x + inward.x * state.width * rand(0.7, 0.98) + perp.x * curveSign * state.width * rand(0.1, 0.18),
          y: start.y + inward.y * state.height * rand(0.7, 0.98) + perp.y * curveSign * state.height * rand(0.1, 0.18),
        };
        const speed = speedForArchetype("crossArc", "small", d) * rand(0.9, 1.12);
        const velocity = aimedVelocity(start.x, start.y, target, speed, 4);
        const didSpawn = spawnBubble(true, "normal", {
          edge: region.edge,
          x: start.x,
          y: start.y,
          colorIndex,
          target,
          velocity,
          radius,
          speed,
          isStream: true,
          streamPattern: "arcDuo",
          streamAmplitude: 2 + d * 5,
          streamFrequency: 1.4 + d * 0.5,
          streamPhase: i * 0.34 + side * Math.PI,
          arcBend: curveSign * rand(36 + d * 8, 58 + d * 18),
          arcLife: rand(2.0, 2.8),
          delay: i * rand(0.08, 0.12) + side * 0.07,
          quietHint: true,
        });
        if (didSpawn) spawned += 1;
      }
    }

    flow.usedBurst = true;
    return spawned;
  }

  function spawnFlowSGroup(flow, maxAllowed = maxActiveBubbles) {
    const count = Math.min(Math.round(rand(3, 4)), maxAllowed, Math.max(0, maxActiveBubbles - state.bubbles.length));
    if (count <= 0) return 0;
    const region = flow.primary;
    const colorIndex = Math.random() < (displayDifficultyLevel() <= 2 ? 0.22 : 0.38) ? pickBalancedColorIndex() : null;
    let spawned = 0;
    for (let i = 0; i < count; i += 1) {
      if (spawnFlowBubble(flow, {
        region,
        sizeKind: Math.random() < 0.65 ? "small" : "normal",
        colorIndex: colorIndex ?? pickBalancedColorIndex(),
        delay: i * rand(0.075, 0.12),
        quietHint: i > 0,
      })) {
        spawned += 1;
      }
    }
    flow.usedBurst = true;
    return spawned;
  }

  function spawnWave() {
    const d = difficulty();
    const level = displayDifficultyLevel();
    if (!state.stagePlan || state.stagePlan.level !== level) {
      resetStagePlan(level);
    }
    const flow = ensureSpawnFlow();
    const remainingStage = stageRemainingBubbles();

    if (remainingStage <= 0) {
      state.nextSpawnAt = Math.max(state.nextSpawnAt, state.elapsed + 360);
      return;
    }

    if (state.bubbles.length >= maxActiveBubbles) {
      scheduleFlowSpawn(flow);
      return;
    }

    if (trySpawnCustomPackWave(remainingStage)) {
      return;
    }

    if (state.elapsed >= state.nextPowerAt && state.bubbles.length >= 2 && state.bubbles.length <= maxActiveBubbles - 1) {
      spawnBubble(false, "bleach");
      state.nextPowerAt = state.elapsed + rand(28000 - d * 4200, 44000 - d * 6200);
      scheduleFlowSpawn(flow);
      return;
    }

    if (level >= 2 && flow.type === "crossArc" && !flow.usedBurst && state.bubbles.length <= 6) {
      const count = spawnFlowCrossArc(flow, remainingStage);
      scheduleFlowSpawn(flow, Math.max(1, count));
      return;
    }

    if (level >= 3 && flow.type === "machine" && !flow.usedBurst && state.bubbles.length <= 7) {
      const count = spawnFlowGun(flow, remainingStage);
      scheduleFlowSpawn(flow, Math.max(1, count));
      return;
    }

    if (level >= 2 && flow.type === "sGroup" && !flow.usedBurst && state.bubbles.length <= 8) {
      const count = spawnFlowSGroup(flow, remainingStage);
      scheduleFlowSpawn(flow, Math.max(1, count));
      return;
    }

    let count = 1;
    if (flow.type === "normal" && level >= 5 && spawnFlowRhythm(flow) > 1.32 && state.bubbles.length <= 6 && Math.random() < 0.24 + d * 0.1) count += 1;
    if (level <= 2) count = 1;
    count = Math.min(count, remainingStage, Math.max(0, maxActiveBubbles - state.bubbles.length));
    if (count <= 0) return;

    for (let index = 0; index < count; index += 1) {
      spawnFlowBubble(flow, { delay: index * rand(0.075, 0.12), quietHint: index > 0 });
    }
    scheduleFlowSpawn(flow, count);
  }

  function activateOpenMode(x, y) {
    state.openUntil = Math.max(state.openUntil, state.elapsed + 6200);
    state.openPopCount = 0;
    state.flash = Math.max(state.flash, 0.38);
    state.bubbles.forEach((bubble) => {
      bubble.isSuper = false;
      bubble.openReady = true;
    });
    for (let index = 0; index < 16; index += 1) {
      makeParticle(x, y, openTone.color, rand(80, 260), rand(0, Math.PI * 2), rand(0.45, 0.95), true);
    }
    state.ripples.push({ x, y, radius: 12, age: 0, life: 0.7, color: openTone.color, power: 1.25 });
  }

  function activateClearScreen(origin) {
    const cleared = [];
    const waiting = [];
    state.bubbles.forEach((bubble) => {
      if (bubble.isCat) {
        waiting.push(bubble);
      } else if (bubble.age >= 0) {
        cleared.push(bubble);
      } else {
        waiting.push(bubble);
      }
    });
    state.bubbles = waiting;
    for (let i = 0; i < cleared.length; i += 1) {
      registerCombo({ chargeSkill: false });
      recordStageCorrect(cleared[i]);
    }
    chargeClearSkillByBubbles(cleared);
    state.poppedCount += cleared.length;
    state.score += cleared.length;
    addWater(Math.min(24, 8 + cleared.length * 1.55 + comboWaterBonus()));
    state.nextSpawnAt = Math.min(state.nextSpawnAt, state.elapsed + rand(240, 520));
    state.flash = Math.max(state.flash, 0.82);
    state.blasts.push({
      x: origin.x,
      y: origin.y,
      radius: 16,
      maxRadius: Math.max(state.width, state.height) * 1.08,
      speed: 920,
      age: 0,
      life: 0.96,
      color: clearTone.light,
      accentColor: palette[0].light,
      fillAlpha: 0.26,
      decorative: true,
      rings: 3,
    });
    state.ripples.push({ x: origin.x, y: origin.y, radius: origin.radius * 1.15, age: 0, life: 0.82, color: clearTone.color, power: 1.55 });
    state.ripples.push({ x: state.width * 0.5, y: state.height * 0.5, radius: Math.min(state.width, state.height) * 0.22, age: 0, life: 0.56, color: clearTone.light, power: 1.15 });

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

      if (index < 8) {
        for (let i = 0; i < 3; i += 1) {
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

    makeFloatText(origin.x + 18, origin.y - 42, `CLEAR x${Math.max(1, cleared.length)}`, clearTone.light, 1.34);
    for (let i = 0; i < 30; i += 1) {
      makeParticle(origin.x, origin.y, i % 2 === 0 ? clearTone.color : palette[i % 4 === 0 ? 0 : 1].light, rand(160, 420), rand(0, Math.PI * 2), rand(0.42, 0.98), i % 3 === 0);
    }
  }

  function useClearSkill() {
    if (!state.running || state.clearSkillUses >= clearSkillMaxUses || state.clearSkillCharge < 1 || state.bubbles.length <= 0) return;
    noteUsefulAction();
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
      if (isSpecialBubble(bubble)) {
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
    for (let i = 0; i < 14; i += 1) {
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
      radius: 14,
      maxRadius: Math.max(state.width, state.height) * 0.86,
      speed: 620,
      age: 0,
      life: 1.18,
      color: bombTone.light,
      accentColor: "#ffffff",
      fillAlpha: 0.22,
      rings: 3,
    });
    state.flash = Math.max(state.flash, 0.3);
    state.ripples.push({ x: origin.x, y: origin.y, radius: 22, age: 0, life: 0.56, color: bombTone.light, power: 1.45 });
    state.ripples.push({ x: origin.x, y: origin.y, radius: 38, age: 0, life: 0.42, color: "#ffffff", power: 0.85 });
    for (let i = 0; i < 24; i += 1) {
      makeParticle(origin.x, origin.y, i % 2 === 0 ? bombTone.light : whiteTone.light, rand(120, 340), rand(0, Math.PI * 2), rand(0.3, 0.72), i % 5 === 0);
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
    chargeClearSkillByBubble(bubble);
    registerCombo({ chargeSkill: false });
    recordStageCorrect(bubble);
    state.score += bubble.isWhite ? 1 : 1;
    addWater(bubble.isWhite ? 1.1 : Math.min(2.4, (bubble.waterValue ?? 1.8) * 0.42));
    state.ripples.push({
      x: bubble.x,
      y: bubble.y,
      radius: bubble.radius * 0.4,
      age: 0,
      life: 0.24,
      color: color.light,
      power: 0.72,
    });
    for (let i = 0; i < 3; i += 1) {
      makeParticle(bubble.x, bubble.y, color.light, rand(70, 190), rand(0, Math.PI * 2), rand(0.18, 0.38), i === 0);
    }
    playPop(popSoundKindForBubble(bubble), rand(0, 0.045));
  }

  function makeParticle(x, y, color, speed, angle, life, sparkle = false) {
    const limit = effectLimit("particles");
    if (limit <= 0 || !allowDecorativeEffect(sparkle ? 0.72 : 1)) return;
    if (state.particles.length >= limit) {
      state.particles.splice(0, state.particles.length - limit + 1);
    }
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

  function makeFloatText(x, y, text, color, scale = 1, options = {}) {
    const limit = effectLimit("floaters");
    if (limit <= 0) return;
    if (state.floaters.length >= limit) {
      state.floaters.splice(0, state.floaters.length - limit + 1);
    }
    state.floaters.push({
      x,
      y,
      text,
      color,
      scale,
      fontFamily: options.fontFamily ?? null,
      italic: Boolean(options.italic),
      stroke: options.stroke ?? null,
      shadow: options.shadow ?? null,
      age: 0,
      life: options.life ?? 0.78,
      vy: options.vy ?? -34,
    });
  }

  function makeComboFloatText(x, y, text, rank, scaleBoost = 1) {
    const style = comboRankStyle(rank);
    makeFloatText(x, y, text, style.color, style.scale * scaleBoost, {
      fontFamily: '"Brush Script MT", "Segoe Script", "Comic Sans MS", "Arial Rounded MT Bold", cursive',
      italic: true,
      stroke: "rgba(15, 25, 37, 0.64)",
      shadow: style.shadow,
      life: 0.92,
      vy: -38,
    });
  }

  function comboFeedbackAt(x, y, color) {
    if (state.combo < 3) return;
    const milestone = state.combo >= 5 && state.combo % 5 === 0;
    const mega = state.combo >= 10 && state.combo % 10 === 0;
    const strong = state.combo >= 8;
    if (!milestone && !mega && !allowDecorativeEffect(0.55)) return;
    const power = mega ? 1.26 : milestone ? 0.98 : strong ? 0.72 : 0.5;
    state.ripples.push({
      x,
      y,
      radius: mega ? 30 : milestone ? 22 : 14,
      age: 0,
      life: mega ? 0.42 : milestone ? 0.34 : 0.24,
      color: color.light,
      power,
    });
    if (strong && allowDecorativeEffect(0.7)) {
      state.ripples.push({
        x,
        y,
        radius: mega ? 14 : 10,
        age: 0,
        life: 0.22,
        color: "#ffffff",
        power: mega ? 0.72 : 0.42,
      });
    }
    if (milestone) {
      const rank = comboRank() || "B";
      const text = `${rank} x${state.combo}!`;
      makeComboFloatText(x, y - 30, text, rank, mega ? 1.12 : 1);
      state.flash = Math.max(state.flash, mega ? 0.2 : 0.14);
    } else if (state.combo === 3) {
      const rank = comboRank();
      makeComboFloatText(x, y - 22, `${rank} x${state.combo}`, rank, 0.86);
    } else if (state.combo >= 7 && state.combo % 3 === 1) {
      const rank = comboRank();
      if (rank) {
        makeComboFloatText(x, y - 22, `${rank} x${state.combo}`, rank, 0.92);
      } else {
        makeFloatText(x, y - 22, `x${state.combo}`, color.light, Math.min(1.42, 1.08 + state.combo * 0.014));
      }
    }
  }

  function vibratePop(base = 12) {
    if (!navigator.vibrate) return;
    if (state.combo >= 10 && state.combo % 5 === 0) {
      navigator.vibrate([10, 18, 12]);
      return;
    }
    const duration = Math.round(base + Math.min(14, Math.max(0, state.combo - 2) * 1.35));
    navigator.vibrate(duration);
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

  function finishCatBubble(bubble, reason = "tap") {
    const index = state.bubbles.indexOf(bubble);
    if (index < 0) return;
    state.bubbles.splice(index, 1);
    if (state.catHoldBubbleId === bubble.catId) {
      state.catHoldPointerId = null;
      state.catHoldBubbleId = null;
    }
    state.poppedCount += 1;
    state.score += 1;
    const beforeWater = state.water;
    state.water = Math.min(100, state.water + catBubbleWaterGain);
    const appliedWaterGain = state.water - beforeWater;
    state.flash = Math.max(state.flash, 0.24);
    state.ripples.push({
      x: bubble.x,
      y: bubble.y,
      radius: bubble.radius * 0.78,
      age: 0,
      life: 0.46,
      color: "#fff6d6",
      power: 0.92,
    });
    makeFloatText(bubble.x, bubble.y - bubble.radius * 0.9, appliedWaterGain > 0 ? "+1" : "MAX", "#fff6d6", 1.08);
    for (let i = 0; i < 14; i += 1) {
      makeParticle(bubble.x, bubble.y, i % 2 === 0 ? "#fff6d6" : "#f4c1d6", rand(58, 172), rand(0, Math.PI * 2), rand(0.26, 0.56), i % 5 === 0);
    }
    vibratePop(reason === "hold" ? 22 : 14);
    playCatMeow(reason === "hold" ? "hold" : "clear");
    updateHud();
  }

  function hitCatBubble(bubble, pointerId, hitX, hitY) {
    noteUsefulAction();
    bubble.catHits = Math.min((bubble.catHits ?? 0) + 1, bubble.catTapRequired ?? catBubbleTapRequired);
    bubble.catHoldMs = Math.max(0, bubble.catHoldMs ?? 0);
    state.catHoldPointerId = pointerId ?? state.activePointerId;
    state.catHoldBubbleId = bubble.catId;
    state.catHoldX = hitX;
    state.catHoldY = hitY;

    const remaining = Math.max(0, (bubble.catTapRequired ?? catBubbleTapRequired) - bubble.catHits);
    state.ripples.push({
      x: bubble.x,
      y: bubble.y,
      radius: bubble.radius * (0.44 + bubble.catHits * 0.06),
      age: 0,
      life: 0.22,
      color: "#fff6d6",
      power: 0.58,
    });
    if (remaining > 0) {
      makeFloatText(bubble.x, bubble.y - bubble.radius, `${bubble.catHits}/${bubble.catTapRequired ?? catBubbleTapRequired}`, "#fff6d6", 0.92);
      vibratePop(7);
      playCatMeow("tap");
      return;
    }

    finishCatBubble(bubble, "tap");
  }

  function updateCatBubbleHold(dt) {
    if (state.catHoldPointerId === null || state.catHoldBubbleId === null) return;
    const bubble = catBubbleById(state.catHoldBubbleId);
    if (!bubble || bubble.age < 0) {
      state.catHoldPointerId = null;
      state.catHoldBubbleId = null;
      return;
    }

    const dx = state.catHoldX - bubble.x;
    const dy = state.catHoldY - bubble.y;
    const inside = dx * dx + dy * dy <= (bubble.radius * 1.08) * (bubble.radius * 1.08);
    if (!inside) {
      bubble.catHoldMs = Math.max(0, (bubble.catHoldMs ?? 0) - dt * 600);
      return;
    }

    bubble.catHoldMs = Math.min((bubble.catHoldRequiredMs ?? catBubbleHoldMs), (bubble.catHoldMs ?? 0) + dt * 1000);
    if (bubble.catHoldMs >= (bubble.catHoldRequiredMs ?? catBubbleHoldMs)) {
      finishCatBubble(bubble, "hold");
    }
  }

  function customBubbleNeedsClear(bubble) {
    if (!bubble || bubble.isCat || bubble.isBleach || bubble.isBomb || bubble.isClear) return false;
    const tapRequired = bubble.customTapRequired ?? 1;
    const holdRequired = bubble.customHoldRequiredMs ?? 0;
    return tapRequired > 1 || tapRequired === 0 || holdRequired > 0;
  }

  function customBubbleByUid(uid) {
    return state.bubbles.find((bubble) => bubble.uid === uid) ?? null;
  }

  function clearCustomHoldForBubble(bubble) {
    if (!bubble || state.customHoldBubbleUid !== bubble.uid) return;
    state.customHoldPointerId = null;
    state.customHoldBubbleUid = null;
  }

  function finishCustomBubble(bubble, hitX, hitY, reason = "tap") {
    const index = state.bubbles.indexOf(bubble);
    if (index < 0) return;
    clearCustomHoldForBubble(bubble);
    popBubble(bubble, index, hitX, hitY);
    if (reason === "hold") {
      state.flash = Math.max(state.flash, 0.16);
    }
  }

  function hitCustomBubble(bubble, pointerId, hitX, hitY) {
    noteUsefulAction();
    const tapRequired = bubble.customTapRequired ?? 1;
    const holdRequired = bubble.customHoldRequiredMs ?? 0;
    if (holdRequired > 0) {
      state.customHoldPointerId = pointerId ?? state.activePointerId;
      state.customHoldBubbleUid = bubble.uid;
      state.customHoldX = hitX;
      state.customHoldY = hitY;
    }
    if (tapRequired > 0) {
      bubble.customHits = Math.min((bubble.customHits ?? 0) + 1, tapRequired);
    }
    const hits = bubble.customHits ?? 0;
    const color = bubble.colorIndex >= 0 ? palette[bubble.colorIndex] : openTone;
    state.ripples.push({
      x: bubble.x,
      y: bubble.y,
      radius: bubble.radius * (0.38 + Math.min(0.32, hits * 0.08)),
      age: 0,
      life: 0.2,
      color: color.light,
      power: 0.48,
    });
    if (tapRequired > 0 && hits >= tapRequired) {
      finishCustomBubble(bubble, hitX, hitY, "tap");
      return;
    }
    const label = tapRequired > 0 ? `${hits}/${tapRequired}` : "HOLD";
    makeFloatText(bubble.x, bubble.y - bubble.radius, label, color.light, 0.9);
    vibratePop(6);
    playPop("small");
    updateHud();
  }

  function updateCustomBubbleHold(dt) {
    if (state.customHoldPointerId === null || state.customHoldBubbleUid === null) return;
    const bubble = customBubbleByUid(state.customHoldBubbleUid);
    if (!bubble || bubble.age < 0 || !customBubbleNeedsClear(bubble)) {
      state.customHoldPointerId = null;
      state.customHoldBubbleUid = null;
      return;
    }
    const required = bubble.customHoldRequiredMs ?? 0;
    if (required <= 0) return;

    const dx = state.customHoldX - bubble.x;
    const dy = state.customHoldY - bubble.y;
    const inside = dx * dx + dy * dy <= (bubble.radius * 1.08) * (bubble.radius * 1.08);
    if (!inside || !canPopBubble(bubble, state.customHoldX, state.customHoldY)) {
      bubble.customHoldMs = Math.max(0, (bubble.customHoldMs ?? 0) - dt * 700);
      return;
    }

    bubble.customHoldMs = Math.min(required, (bubble.customHoldMs ?? 0) + dt * 1000);
    if (bubble.customHoldMs >= required) {
      finishCustomBubble(bubble, state.customHoldX, state.customHoldY, "hold");
    }
  }

  function hitBleachBubble(bubble, index, hitX, hitY) {
    if (state.elapsed < (bubble.bleachHitCooldownUntil ?? 0)) return;
    bubble.bleachHitCooldownUntil = state.elapsed + 140;
    bubble.bleachHits = Math.min((bubble.bleachHits ?? 0) + 1, bubble.bleachRequiredHits ?? bleachRequiredHits);
    registerCombo();

    const remaining = Math.max(0, (bubble.bleachRequiredHits ?? bleachRequiredHits) - bubble.bleachHits);
    if (remaining > 0) {
      bubble.baseRadius = Math.max(18, bubble.baseRadius * 0.76);
      bubble.radius = bubble.baseRadius;
    }

    state.flash = Math.max(state.flash, remaining > 0 ? 0.12 : 0.24);
    state.ripples.push({
      x: bubble.x,
      y: bubble.y,
      radius: bubble.radius * 0.46,
      age: 0,
      life: 0.22,
      color: whiteTone.light,
      power: remaining > 0 ? 0.62 : 0.86,
    });
    makePunctureSplash(bubble, hitX, hitY, whiteTone, remaining > 0 ? 9 : 18, bubble.baseRadius <= 27, false);

    if (remaining > 0) {
      setBleachDash(bubble, false);
      makeFloatText(bubble.x, bubble.y - bubble.radius, `${bubble.bleachHits}/3`, whiteTone.light, 0.94);
      comboFeedbackAt(bubble.x, bubble.y, whiteTone);
      vibratePop(10);
      playPop("small");
      updateHud();
      return;
    }

    state.bubbles.splice(index, 1);
    state.poppedCount += 1;
    chargeClearSkillByBubble(bubble);
    state.score += 1;
    addWater(3.6);
    decolorBubbles(bubble);
    comboFeedbackAt(bubble.x, bubble.y, whiteTone);
    vibratePop(16);
    playPop("clear");
    updateHud();
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

    noteUsefulAction();
    if (bubble.isBleach) {
      hitBleachBubble(bubble, index, hitX, hitY);
      return;
    }

    clearCustomHoldForBubble(bubble);
    state.bubbles.splice(index, 1);
    state.poppedCount += 1;
    chargeClearSkillByBubble(bubble);
    registerCombo();
    recordStageCorrect(bubble);

    if (bubble.isClear) {
      makeFloatText(bubble.x, bubble.y - bubble.radius, `x${state.combo} 清屏`, clearTone.light, 1.08);
      activateClearScreen(bubble);
      comboFeedbackAt(bubble.x, bubble.y, clearTone);
      vibratePop(24);
      playPop("clear");
      updateHud();
      return;
    }

    if (bubble.isBomb) {
      state.score += 1;
      addWater(3.8);
      makeFloatText(bubble.x, bubble.y - bubble.radius, "扩散", bombTone.light, 1.08);
      startBombBlast(bubble);
      comboFeedbackAt(bubble.x, bubble.y, bombTone);
      vibratePop(20);
      playPop("super");
      updateHud();
      return;
    }

    if (isOpen && !bubble.isSuper) {
      state.openPopCount += 1;
    }

    const baseBudgetWater = bubble.waterValue ?? (isSmall ? 3 : 4.2);
    const waterGain = bubble.isWhite
      ? isSmall ? 1.5 : 2.5
      : bubble.isSuper
      ? 16
      : isOpen
        ? baseBudgetWater * 0.72 + comboWaterBoost(baseBudgetWater) * 0.7
        : baseBudgetWater + comboWaterBoost(baseBudgetWater);
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
    const appliedWaterGain = addWater(waterGain);
    relieveWaterPressureOnCorrect(appliedWaterGain, bubble);
    state.flash = Math.max(state.flash, bubble.isSuper ? 0.46 : isSmall ? 0.16 : 0.28);
    makeFloatText(
      bubble.x,
      bubble.y - bubble.radius * 0.72,
      bubble.isWhite ? "+1分" : state.combo > 1 ? `x${state.combo} +${formatWaterGain(appliedWaterGain)}` : `+${formatWaterGain(appliedWaterGain)}`,
      isOpen ? openTone.light : color.light,
      Math.min(1.34, 0.96 + state.combo * 0.012),
    );

    const amount = bubble.isSuper ? 46 : isSmall ? 9 + Math.round(bubble.radius * 0.16) : Math.round(16 + bubble.radius * 0.55);
    makePunctureSplash(bubble, hitX, hitY, color, amount, isSmall, bubble.isSuper);
    comboFeedbackAt(bubble.x, bubble.y, color);

    if (bubble.isSuper) {
      activateOpenMode(bubble.x, bubble.y);
    }

    vibratePop(bubble.isSuper ? 24 : isSmall ? 7 : 14);
    playPop(bubble.isSuper ? "super" : isSmall ? "small" : "large");
  }

  function missBubble(bubble, index, isTap) {
    noteWrongAction();
    penalizeStageMistake(bubble, "wrong");
    state.bubbles.splice(index, 1);
    resetCombo();
    state.ripples.push({
      x: bubble.x,
      y: bubble.y,
      radius: bubble.radius * 0.32,
      age: 0,
      life: 0.26,
      color: colorWithAlpha("#20384f", 0.48),
      power: 0.5,
    });
    state.ripples.push({
      x: bubble.x,
      y: bubble.y,
      radius: bubble.radius * 0.12,
      age: 0,
      life: 0.18,
      color: colorWithAlpha("#f4fbff", 0.42),
      power: 0.28,
    });
    state.mistakeFlash = Math.max(state.mistakeFlash, 0.22);
    makeFloatText(bubble.x, bubble.y - bubble.radius * 0.72, "偏了", "#eefbff", 0.72, {
      life: 0.42,
      vy: -18,
      stroke: "rgba(15, 33, 43, 0.46)",
      shadow: "rgba(15, 33, 43, 0.18)",
    });

    for (let i = 0; i < 5; i += 1) {
      makeParticle(
        bubble.x,
        bubble.y,
        i % 2 === 0 ? colorWithAlpha("#20384f", 0.5) : colorWithAlpha("#eefbff", 0.4),
        rand(28, 78),
        rand(0, Math.PI * 2),
        rand(0.14, 0.24),
      );
    }

    if (isTap && navigator.vibrate) {
      navigator.vibrate(8);
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
      bubble.isCat ||
      bubble.isWhite ||
      bubble.colorIndex === -1
    ) {
      return true;
    }

    const point = bubbleCheckPoint(bubble, hitX, hitY);
    return bubble.colorIndex === backgroundColorIndexAt(point.x, point.y);
  }

  function bubbleHasMatchingPatch(bubble) {
    if (!isStageTargetBubble(bubble)) return false;
    const r = bubble.radius * 0.58;
    const points = [
      { x: bubble.x, y: bubble.y },
      { x: bubble.x - r, y: bubble.y },
      { x: bubble.x + r, y: bubble.y },
      { x: bubble.x, y: bubble.y - r },
      { x: bubble.x, y: bubble.y + r },
    ];
    return points.some((point) => {
      if (point.x < 0 || point.x > state.width || point.y < 0 || point.y > state.height) return false;
      return backgroundColorIndexAt(point.x, point.y) === bubble.colorIndex;
    });
  }

  function updateBubbleMatchDwell(bubble, dt) {
    if (!isStageTargetBubble(bubble)) return;
    if (bubbleHasMatchingPatch(bubble)) {
      bubble.wasReady = true;
      bubble.matchDwell = Math.min(fairMatchDwell, (bubble.matchDwell ?? 0) + dt);
      if (bubble.matchDwell >= fairMatchDwell) {
        bubble.fairPassComplete = true;
      }
    }
  }

  function needsFairColorPass(bubble) {
    return isStageTargetBubble(bubble) && !bubble.fairPassComplete;
  }

  function steerBubbleTowardMatch(bubble, dt, d) {
    if (bubble.isSuper || bubble.isClear || bubble.isBleach || bubble.isBomb || bubble.isWhite || bubble.colorIndex < 0) return;
    const matchingNow = bubbleHasMatchingPatch(bubble);
    if (matchingNow && !needsFairColorPass(bubble)) {
      return;
    }

    if (matchingNow) {
      const speed = Math.hypot(bubble.vx, bubble.vy);
      const maxComfortSpeed = bubble.isStream ? 92 + d * 18 : 58 + d * 20;
      if (speed > maxComfortSpeed) {
        const damp = Math.max(0.82, 1 - dt * 0.72);
        bubble.vx *= damp;
        bubble.vy *= damp;
      }
      return;
    }

    const urgency = needsFairColorPass(bubble)
      ? smoothstep(0.28, 1.7 - d * 0.35, bubble.age)
      : smoothstep(1.15, 4.1 - d * 1.25, bubble.age);
    if (urgency <= 0) return;

    const targetExpired = !bubble.steerTarget || bubble.age >= bubble.retargetAt;
    const targetInvalid = bubble.steerTarget && backgroundColorIndexAt(bubble.steerTarget.x, bubble.steerTarget.y) !== bubble.colorIndex;
    if (targetExpired || targetInvalid) {
      bubble.steerTarget = matchingPointForColorFromEdge(bubble.colorIndex, bubble.edge, bubble.y, bubble.x);
      bubble.retargetAt = bubble.age + (needsFairColorPass(bubble) ? rand(0.55, 1.05) : rand(1.1, 2.0));
    }

    const target = bubble.steerTarget;
    const speed = Math.max(28, Math.hypot(bubble.vx, bubble.vy));
    const desired = aimedVelocity(bubble.x, bubble.y, target, speed, 0);
    const correction = needsFairColorPass(bubble)
      ? Math.min(0.11, dt * (0.75 + urgency * 2.4))
      : Math.min(0.038, dt * (0.22 + urgency * 0.92));
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
    const minSpeed = bubble.isCat ? 18 + d * 8 : bubble.isStream ? 64 + d * 28 : 30 + d * 42;
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

  function pullBubbleBackForFairPass(bubble, d, dt) {
    if (!needsFairColorPass(bubble)) return false;
    const margin = bubble.radius * 1.35;
    const nearExit =
      bubble.x < margin ||
      bubble.x > state.width - margin ||
      bubble.y < margin ||
      bubble.y > state.height - margin;
    if (!nearExit) return false;

    const targetInvalid = !bubble.steerTarget || backgroundColorIndexAt(bubble.steerTarget.x, bubble.steerTarget.y) !== bubble.colorIndex;
    if (targetInvalid) {
      bubble.steerTarget = matchingPointForColorFromEdge(bubble.colorIndex, bubble.edge, bubble.y, bubble.x);
      bubble.retargetAt = bubble.age + rand(0.45, 0.9);
    }

    const speed = Math.max(bubble.isStream ? 88 + d * 24 : 62 + d * 24, Math.hypot(bubble.vx, bubble.vy));
    const desired = aimedVelocity(bubble.x, bubble.y, bubble.steerTarget, speed, 0);
    const correction = Math.min(0.2, dt * (1.8 + d * 1.2));
    bubble.vx += (desired.vx - bubble.vx) * correction;
    bubble.vy += (desired.vy - bubble.vy) * correction;
    return true;
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

  function spawnProtectionMassForRadius(radius) {
    return Math.max(0.35, radius * radius * 0.00072);
  }

  function bubbleHasSpawnProtection(bubble) {
    return bubble.age >= 0 && bubble.age <= spawnProtectionSeconds && !bubble.customPath;
  }

  function bubbleCanProtectSpawn(bubble) {
    return bubble.age >= 0 && !bubble.customPath;
  }

  function resolveSpawnProtectionPair(a, b, dt) {
    const aActive = bubbleHasSpawnProtection(a);
    const bActive = bubbleHasSpawnProtection(b);
    if ((!aActive && !bActive) || !bubbleCanProtectSpawn(a) || !bubbleCanProtectSpawn(b)) return;

    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let distance = Math.hypot(dx, dy);
    let nx = 1;
    let ny = 0;
    if (distance > 0.001) {
      nx = dx / distance;
      ny = dy / distance;
    } else {
      const angle = (a.uid - b.uid) * 1.37;
      nx = Math.cos(angle);
      ny = Math.sin(angle);
      distance = 0.01;
      dx = nx * distance;
      dy = ny * distance;
    }

    const radiusSum = a.baseRadius + b.baseRadius;
    const streamPair = a.isStream || b.isStream;
    const largePair = a.baseRadius >= 42 || b.baseRadius >= 42;
    const restScale = streamPair ? 0.72 : largePair ? 0.86 : 0.82;
    const minDistance = radiusSum * restScale;
    if (distance >= minDistance) return;

    const aInvMass = aActive ? a.spawnProtectInvMass : 0;
    const bInvMass = bActive ? b.spawnProtectInvMass : 0;
    const totalInvMass = aInvMass + bInvMass;
    if (totalInvMass <= 0) return;

    const overlap = minDistance - distance;
    const pressure = overlap / Math.max(minDistance, 1);
    const stiffness = clamp(0.44 + pressure * 1.6, 0.44, spawnProtectionStiffness);
    const correction = (overlap * stiffness) / totalInvMass;
    a.x -= nx * correction * aInvMass;
    a.y -= ny * correction * aInvMass;
    b.x += nx * correction * bInvMass;
    b.y += ny * correction * bInvMass;

    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const normalVelocity = rvx * nx + rvy * ny;
    if (normalVelocity < 0) {
      const impulse = (-(1 + spawnProtectionRestitution) * normalVelocity) / totalInvMass;
      a.vx -= nx * impulse * aInvMass;
      a.vy -= ny * impulse * aInvMass;
      b.vx += nx * impulse * bInvMass;
      b.vy += ny * impulse * bInvMass;
    }

    const tx = -ny;
    const ty = nx;
    const tangentVelocity = rvx * tx + rvy * ty;
    const tangentImpulse = (-tangentVelocity * spawnProtectionFriction) / totalInvMass;
    a.vx -= tx * tangentImpulse * aInvMass;
    a.vy -= ty * tangentImpulse * aInvMass;
    b.vx += tx * tangentImpulse * bInvMass;
    b.vy += ty * tangentImpulse * bInvMass;

    if (dt > 0 && pressure > 0.08) {
      const settle = Math.min(18, (overlap / dt) * 0.018);
      a.vx -= nx * settle * aInvMass;
      a.vy -= ny * settle * aInvMass;
      b.vx += nx * settle * bInvMass;
      b.vy += ny * settle * bInvMass;
    }
  }

  function solveSpawnProtection(dt) {
    const activeCount = state.bubbles.reduce((count, bubble) => count + (bubbleHasSpawnProtection(bubble) ? 1 : 0), 0);
    if (activeCount <= 0) return;

    for (let iteration = 0; iteration < spawnProtectionIterations; iteration += 1) {
      for (let i = 0; i < state.bubbles.length; i += 1) {
        const a = state.bubbles[i];
        if (!bubbleCanProtectSpawn(a)) continue;
        for (let j = i + 1; j < state.bubbles.length; j += 1) {
          resolveSpawnProtectionPair(a, state.bubbles[j], dt);
        }
      }
    }
  }

  function tryPopAt(x, y, isTap, pointerId = null) {
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
        if (bubble.isCat) {
          if (isTap) {
            hitCatBubble(bubble, pointerId, x, y);
          }
          return true;
        }
        if (canPopBubble(bubble, x, y)) {
          if (customBubbleNeedsClear(bubble)) {
            if (isTap) {
              hitCustomBubble(bubble, pointerId, x, y);
            }
          } else {
            popBubble(bubble, i, x, y);
          }
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
    tryPopAt(x, y, true, event.pointerId);
  }

  function handlePointerMove(event) {
    event.preventDefault();
    if (!state.running || state.activePointerId !== event.pointerId) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (state.catHoldPointerId === event.pointerId) {
      state.catHoldX = x;
      state.catHoldY = y;
    }
    if (state.customHoldPointerId === event.pointerId) {
      state.customHoldX = x;
      state.customHoldY = y;
    }
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
    if (state.catHoldPointerId === event.pointerId) {
      state.catHoldPointerId = null;
      state.catHoldBubbleId = null;
    }
    if (state.customHoldPointerId === event.pointerId) {
      state.customHoldPointerId = null;
      state.customHoldBubbleUid = null;
    }
  }

  function update(dt) {
    if (!state.running) return;

    state.elapsed += dt * 1000;
    updateBackgroundFlow(dt);
    maybeAdvanceStage();
    maybeActivateCatBubbleSystem();
    const d = difficulty();
    const tier = difficultyTier(d);
    if (tier > state.difficultyTier) {
      triggerDifficultyUp(tier);
    }
    updateHiddenLeak(dt);
    drainWater(dt);
    state.flash = Math.max(0, state.flash - dt * 1.9);
    state.mistakeFlash = Math.max(0, state.mistakeFlash - dt * 4.2);
    state.difficultyFlash = Math.max(0, state.difficultyFlash - dt * 0.9);
    state.comboPulse = Math.max(0, state.comboPulse - dt * 2.6);
    if (state.combo > 1) {
      comboChip.style.setProperty("--combo-left", comboProgress().toFixed(3));
      comboChip.classList.remove("expiring");
    }

    while (state.elapsed >= state.nextSpawnAt) {
      spawnWave();
    }
    maybeAdvanceStage();
    maybeActivateCatBubbleSystem();
    updateCatBubbleHold(dt);
    updateCustomBubbleHold(dt);

    for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
      const bubble = state.bubbles[i];
      bubble.age += dt;
      if (bubble.age < 0) {
        continue;
      }
      if (bubble.isBleach) {
        const expireAt = bubble.bleachExpireAt || state.elapsed + bleachLifetimeMs;
        if (!bubble.bleachEscaping && state.elapsed >= expireAt - 950) {
          setBleachDash(bubble, true);
        }
        if (state.elapsed >= expireAt) {
          state.ripples.push({
            x: bubble.x,
            y: bubble.y,
            radius: bubble.radius * 0.48,
            age: 0,
            life: 0.24,
            color: whiteTone.light,
            power: 0.5,
          });
          state.bubbles.splice(i, 1);
          continue;
        }
      }
      if (bubble.isWhite && bubble.whiteUntil > 0 && state.elapsed >= bubble.whiteUntil) {
        restoreDecoloredBubble(bubble);
      }
      bubble.wobble += bubble.wobbleSpeed * dt;
      updateBubbleMatchDwell(bubble, dt);
      if (!bubble.customPath) {
        steerBubbleTowardMatch(bubble, dt, d);
        keepBubbleMoving(bubble, d);
        separateBubbleFromNeighbors(bubble, i, d, dt);
      }
      const speed = Math.max(1, Math.hypot(bubble.vx, bubble.vy));
      const streamWave = bubble.isStream
        ? Math.sin(bubble.age * bubble.streamFrequency + bubble.streamPhase) *
          bubble.streamAmplitude *
          (bubble.streamPattern === "spray" ? 0.32 : 0.68)
        : 0;
      const perpX = -bubble.vy / speed;
      const perpY = bubble.vx / speed;
      const sway = Math.sin(bubble.wobble) * (bubble.isStream ? 4 + d * 5 : 12 + d * 16);
      const arcPush = bubble.arcBend
        ? Math.sin(clamp(bubble.age / Math.max(0.4, bubble.arcLife), 0, 1) * Math.PI) * bubble.arcBend
        : 0;
      const curvePush = streamWave + arcPush;
      if (!advanceCustomPathBubble(bubble, dt)) {
        bubble.x += (bubble.vx + sway * bubble.drift + perpX * curvePush) * dt;
        bubble.y += (bubble.vy + (bubble.isStream ? 0 : Math.cos(bubble.wobble * 0.7) * 10) + perpY * curvePush) * dt;
      }
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

      pullBubbleBackForFairPass(bubble, d, dt);
      if (outside && needsFairColorPass(bubble)) {
        continue;
      }

      if (outside && (bubble.hasEntered || bubble.age > 4.5)) {
        penalizeStageMistake(bubble, "miss");
        state.bubbles.splice(i, 1);
      }
    }

    solveSpawnProtection(dt);

    for (let i = state.blasts.length - 1; i >= 0; i -= 1) {
      const blast = state.blasts[i];
      blast.age += dt;
      blast.radius += blast.speed * dt;

      if (!blast.decorative) {
        for (let j = state.bubbles.length - 1; j >= 0; j -= 1) {
          const bubble = state.bubbles[j];
          if (bubble.age < 0 || isSpecialBubble(bubble)) {
            continue;
          }
          const dx = bubble.x - blast.x;
          const dy = bubble.y - blast.y;
          const hitRadius = blast.radius + bubble.radius * 0.45;
          if (dx * dx + dy * dy <= hitRadius * hitRadius) {
            burstBubbleByBlast(bubble, j);
          }
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
    if (!state.width) return 0;
    let bestX = state.width * 0.5;
    let bestDistance = Infinity;
    const samples = 34;
    const left = -state.width * 0.18;
    const right = state.width * 1.18;
    for (let i = 0; i <= samples; i += 1) {
      const x = left + ((right - left) * i) / samples;
      const distance = Math.abs(backgroundSignedAt(x, y, time));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestX = x;
      }
    }
    return bestX;
  }

  function backgroundBoundaryXAtY(y, time, preferredX = null) {
    return backgroundBoundaryGuideX(y, time);
  }

  function backgroundBoundaryPoints(time) {
    const layout = backgroundLayoutAt();
    const axes = backgroundAxes(layout);
    const steps = 72;
    const span = 1.12;
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const tangent = -span + (span * 2 * i) / steps;
      const normal = backgroundBoundaryOffsetAt(tangent, layout, time);
      const px = axes.tx * tangent + axes.nx * normal;
      const py = axes.ty * tangent + axes.ny * normal;
      points.push({
        x: (px + 0.5) * state.width,
        y: (py + 0.5) * state.height,
      });
    }
    return points;
  }

  function traceBackgroundBoundary(points) {
    if (!points.length) return;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i += 1) {
      const current = points[i];
      const next = points[i + 1];
      ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) * 0.5, (current.y + next.y) * 0.5);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  function drawBackgroundBoundary(time, d, points = null) {
    const boundaryPoints = points ?? backgroundBoundaryPoints(time);
    const levelAmount = clamp((displayDifficultyLevel() - 1) / 9, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    traceBackgroundBoundary(boundaryPoints);
    ctx.shadowColor = colorWithAlpha("#ffffff", 0.11);
    ctx.shadowBlur = 3 + levelAmount * 2;
    ctx.strokeStyle = colorWithAlpha(boundaryTone, 0.12 + levelAmount * 0.035);
    ctx.lineWidth = 2.2 + levelAmount * 0.9;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = colorWithAlpha("#ffffff", 0.08 + levelAmount * 0.02);
    ctx.lineWidth = 0.65;
    ctx.stroke();
    const cornerPower = levelThreeCornerPower();
    if (cornerPower > 0) {
      ctx.setLineDash([24, 28]);
      ctx.lineDashOffset = -time * 0.018;
      ctx.beginPath();
      traceBackgroundBoundary(boundaryPoints);
      ctx.strokeStyle = colorWithAlpha("#eafcff", 0.095 * cornerPower);
      ctx.lineWidth = 4.4;
      ctx.stroke();
      ctx.setLineDash([10, 34]);
      ctx.lineDashOffset = time * 0.012;
      ctx.beginPath();
      traceBackgroundBoundary(boundaryPoints);
      ctx.strokeStyle = colorWithAlpha(boundaryTone, 0.055 * cornerPower);
      ctx.lineWidth = 2.1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const tidePower = levelFiveTidePower();
    if (tidePower > 0) {
      ctx.setLineDash([18, 24]);
      ctx.lineDashOffset = -time * 0.028;
      ctx.beginPath();
      traceBackgroundBoundary(boundaryPoints);
      ctx.strokeStyle = colorWithAlpha("#eafcff", 0.13 * tidePower);
      ctx.lineWidth = 5.2;
      ctx.stroke();
      ctx.setLineDash([8, 28]);
      ctx.lineDashOffset = time * 0.018;
      ctx.beginPath();
      traceBackgroundBoundary(boundaryPoints);
      ctx.strokeStyle = colorWithAlpha("#20384f", 0.06 * tidePower);
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawBackground() {
    if (window.PaopaoBackgroundEngine) {
      const profile = currentPerformanceProfile();
      window.PaopaoBackgroundEngine.render(ctx, backgroundEngineTimeSeconds(), state.width, state.height, {
        scale: profile.backgroundScale,
        fps: profile.backgroundFps,
        frameSkip: profile.backgroundFrameSkip,
        contours: profile.contours,
      });
      return;
    }
    const time = state.visualTime;
    const d = difficulty();
    const openAmount = state.openUntil > state.elapsed ? 0.16 : 0;
    const points = backgroundBoundaryPoints(time);
    const axes = backgroundAxes();
    const blue = mixHex(backgroundPalette[0].color, openTone.light, openAmount * 0.08);
    const pink = mixHex(backgroundPalette[1].color, openTone.light, openAmount * 0.08);
    const far = 2.2;

    ctx.fillStyle = pink;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.save();
    ctx.beginPath();
    traceBackgroundBoundary(points);
    const last = points[points.length - 1];
    const first = points[0];
    ctx.lineTo(last.x - axes.nx * state.width * far, last.y - axes.ny * state.height * far);
    ctx.lineTo(first.x - axes.nx * state.width * far, first.y - axes.ny * state.height * far);
    ctx.closePath();
    ctx.fillStyle = blue;
    ctx.fill();
    ctx.restore();

    drawBackgroundBoundary(time, d, points);
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
    const profile = currentPerformanceProfile();
    const detail = profile.bubbleDetail;
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
    const squash = Math.sin(bubble.age * 1.32 + bubble.skinPhase) * (bubble.isStream ? 0.038 : 0.06) * detail;
    const pulse = Math.sin(bubble.age * 2.1 + bubble.skinPhase) * 0.018 * detail;
    const driftRotation =
      bubble.skinRotation +
      Math.sin(bubble.wobble * 0.54 + bubble.skinPhase) * 0.16 * detail +
      bubble.age * bubble.skinSpin * 0.07;
    const points = bubble.isStream ? (detail < 0.65 ? 7 : detail < 0.9 ? 8 : 10) : detail < 0.65 ? 9 : detail < 0.9 ? 11 : 14;
    const wobbleAmount = (bubble.isStream ? 0.04 : 0.068) * detail;

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

    ctx.shadowColor = colorWithAlpha(color.deep, 0.26);
    ctx.shadowBlur = r * (detail < 0.65 ? 0.2 : 0.44);
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
    if (profile.textureOverlay && bubbleAtlas.complete && bubbleAtlas.naturalWidth > 0) {
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
    if (detail >= 0.65) {
      const sheen = ctx.createLinearGradient(-r, -r, r, r);
      sheen.addColorStop(0, "rgba(255,255,255,0.34)");
      sheen.addColorStop(0.28, "rgba(255,255,255,0)");
      sheen.addColorStop(0.72, "rgba(255,255,255,0.12)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha *= 0.7;
      ctx.fillStyle = sheen;
      ctx.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8);
    }
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
    traceShape(1.06);
    ctx.strokeStyle = colorWithAlpha(color.deep, bubble.isWhite ? 0.16 : 0.22);
    ctx.lineWidth = Math.max(1.4, r * 0.07);
    ctx.stroke();
    traceShape(1.01);
    ctx.strokeStyle = colorWithAlpha(color.light, 0.68);
    ctx.lineWidth = Math.max(1.4, r * 0.062);
    ctx.stroke();
    if (detail >= 0.78) {
      traceShape(0.92);
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = Math.max(1, r * 0.032);
      ctx.stroke();
    }

    ctx.globalAlpha *= 0.72;
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.38, r * 0.25, r * 0.08, -0.62, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    if (detail >= 0.6) {
      ctx.beginPath();
      ctx.arc(r * 0.36, r * 0.22, r * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.fill();
    }
    ctx.restore();

    return true;
  }

  function drawBombTexture(bubble, x, y, r, alpha = 1) {
    if (!bombBubbleImage.complete || bombBubbleImage.naturalWidth <= 0) return false;
    const aspect = bombBubbleImage.naturalHeight / bombBubbleImage.naturalWidth;
    const drawWidth = r * 2.62;
    const drawHeight = drawWidth * aspect;
    const bodyCenterY = drawHeight * 0.64;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(bubble.wobble * 0.8) * 0.06 + bubble.spin * 0.035);
    ctx.globalAlpha *= alpha;
    ctx.shadowColor = colorWithAlpha(bombTone.light, 0.38);
    ctx.shadowBlur = r * 0.55;
    ctx.drawImage(bombBubbleImage, -drawWidth * 0.5, -bodyCenterY, drawWidth, drawHeight);
    ctx.shadowBlur = 0;
    ctx.restore();
    return true;
  }

  function drawBleachTexture(bubble, x, y, r, alpha = 1) {
    if (!bleachBubbleImage.complete || bleachBubbleImage.naturalWidth <= 0) return false;
    const drawSize = r * 2.38;
    const pulse = Math.sin(bubble.age * 2.1 + bubble.skinPhase) * 0.018;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(bubble.wobble * 0.7 + bubble.skinPhase) * 0.045 + bubble.spin * 0.018);
    ctx.scale(1 + pulse, 1 - pulse * 0.6);
    ctx.globalAlpha *= alpha;
    ctx.drawImage(bleachBubbleImage, -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize);
    ctx.restore();
    return true;
  }

  function drawCatBubbleTexture(bubble, x, y, r, alpha = 1) {
    const holdProgress = clamp((bubble.catHoldMs ?? 0) / (bubble.catHoldRequiredMs ?? catBubbleHoldMs), 0, 1);
    const tapProgress = clamp((bubble.catHits ?? 0) / (bubble.catTapRequired ?? catBubbleTapRequired), 0, 1);
    const progress = Math.max(holdProgress, tapProgress);
    const pulse = Math.sin(bubble.age * 2.1 + bubble.skinPhase) * 0.018;
    const drawSize = r * 2.48;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(bubble.wobble * 0.62 + bubble.skinPhase) * 0.04 + bubble.spin * 0.012);
    ctx.scale(1 + pulse, 1 - pulse * 0.55);
    ctx.globalAlpha *= alpha;
    ctx.shadowColor = "rgba(255, 246, 214, 0.34)";
    ctx.shadowBlur = r * 0.55;
    if (catBubbleImage.complete && catBubbleImage.naturalWidth > 0) {
      ctx.drawImage(catBubbleImage, -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize);
    } else {
      const fallback = ctx.createRadialGradient(-r * 0.34, -r * 0.42, r * 0.08, 0, 0, r);
      fallback.addColorStop(0, "rgba(255, 255, 255, 0.96)");
      fallback.addColorStop(0.48, "rgba(255, 232, 196, 0.55)");
      fallback.addColorStop(1, "rgba(116, 77, 48, 0.42)");
      ctx.fillStyle = fallback;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    if (progress > 0) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(x, y, r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.strokeStyle = "rgba(255, 246, 214, 0.82)";
      ctx.lineWidth = Math.max(3, r * 0.085);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r + 10, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = Math.max(1.4, r * 0.035);
      ctx.stroke();
      ctx.restore();
    }
    return true;
  }

  function drawCustomBubbleProgress(bubble, x, y, r, color) {
    if (!customBubbleNeedsClear(bubble)) return;
    const tapRequired = bubble.customTapRequired ?? 1;
    const holdRequired = bubble.customHoldRequiredMs ?? 0;
    const tapProgress = tapRequired > 0 ? clamp((bubble.customHits ?? 0) / tapRequired, 0, 1) : 0;
    const holdProgress = holdRequired > 0 ? clamp((bubble.customHoldMs ?? 0) / holdRequired, 0, 1) : 0;
    const progress = Math.max(tapProgress, holdProgress);
    ctx.save();
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y, r + 8, 0, Math.PI * 2);
    ctx.strokeStyle = colorWithAlpha(color.light, 0.18);
    ctx.lineWidth = Math.max(1.6, r * 0.04);
    ctx.stroke();
    if (progress > 0) {
      ctx.beginPath();
      ctx.arc(x, y, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.strokeStyle = colorWithAlpha("#ffffff", 0.76);
      ctx.lineWidth = Math.max(2.2, r * 0.065);
      ctx.stroke();
    }
    if (tapRequired > 1 || tapRequired === 0) {
      ctx.font = `800 ${Math.max(10, Math.round(r * 0.34))}px "Arial Rounded MT Bold", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(2.4, r * 0.1);
      ctx.strokeStyle = "rgba(18, 37, 48, 0.56)";
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      const text = tapRequired > 0 ? `${bubble.customHits ?? 0}/${tapRequired}` : "H";
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
    }
    ctx.restore();
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

    if (openActive && !bubble.isSuper && !bubble.isClear && !bubble.isBleach && !bubble.isBomb && !bubble.isCat && !bubble.isWhite) {
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

    const catTextured = bubble.isCat && drawCatBubbleTexture(bubble, x, y, r, whiteAlpha);
    const bombTextured = !catTextured && bubble.isBomb && drawBombTexture(bubble, x, y, r, whiteAlpha);
    const bleachTextured = !catTextured && !bombTextured && bubble.isBleach && drawBleachTexture(bubble, x, y, r, whiteAlpha);
    if (!catTextured && !bombTextured && !bleachTextured) {
      if (!drawBubbleSpriteBody(bubble, color, x, y, r, whiteAlpha)) {
        drawProceduralBubbleBody(body, color, x, y, r);
      }
    }

    if (bubble.isBomb && !bombTextured) {
      drawBombMark(x, y, r);
    } else if (bubble.isBleach && !bleachTextured) {
      drawBleachMark(x, y, r);
    } else if (bubble.isClear) {
      drawClearMark(x, y, r);
    }

    drawCustomBubbleProgress(bubble, x, y, r, color);

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
    ctx.shadowColor = colorWithAlpha(clearTone.light, 0.52);
    ctx.shadowBlur = r * 0.18;
    ctx.strokeStyle = "rgba(255,255,255,0.94)";
    ctx.lineWidth = Math.max(3, r * 0.11);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.28, y);
    ctx.lineTo(x + r * 0.28, y);
    ctx.moveTo(x, y - r * 0.28);
    ctx.lineTo(x, y + r * 0.28);
    ctx.stroke();
    ctx.shadowBlur = 0;

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
    ctx.shadowColor = colorWithAlpha(bombTone.light, 0.54);
    ctx.shadowBlur = r * 0.2;
    ctx.strokeStyle = "rgba(255,255,255,0.94)";
    ctx.fillStyle = colorWithAlpha(bombTone.deep, 0.84);
    ctx.lineWidth = Math.max(2.4, r * 0.095);
    ctx.beginPath();
    ctx.arc(x, y + r * 0.08, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.18, y - r * 0.16);
    ctx.quadraticCurveTo(x + r * 0.32, y - r * 0.44, x + r * 0.06, y - r * 0.48);
    ctx.stroke();
    ctx.restore();
  }

  function drawBlasts() {
    state.blasts.forEach((blast) => {
      const t = blast.age / blast.life;
      const fade = Math.max(0, 1 - t);
      const color = blast.color ?? bombTone.light;
      const accent = blast.accentColor ?? "#ffffff";
      const rings = blast.rings ?? 1;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = fade * (blast.decorative ? 0.72 : 0.82);
      ctx.strokeStyle = color;
      ctx.shadowColor = colorWithAlpha(color, 0.44);
      ctx.shadowBlur = 14 + 12 * fade;
      ctx.lineWidth = (blast.decorative ? 12 : 10) * fade + 2.4;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, blast.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      for (let i = 1; i < rings; i += 1) {
        const innerRadius = Math.max(4, blast.radius - i * (blast.decorative ? 34 : 26));
        ctx.globalAlpha = fade * (blast.decorative ? 0.26 : 0.34) * (1 - i * 0.18);
        ctx.strokeStyle = i % 2 === 0 ? color : accent;
        ctx.lineWidth = Math.max(1.4, (blast.decorative ? 5.2 : 4.2) * fade);
        ctx.beginPath();
        ctx.arc(blast.x, blast.y, innerRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = fade * (blast.fillAlpha ?? 0.16);
      ctx.fillStyle = color;
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
      const pop = 1 + Math.sin(Math.min(1, t * 2.2) * Math.PI) * 0.14;
      const size = 18 * floater.scale * pop;
      ctx.save();
      ctx.globalAlpha = alpha;
      const fontFamily = floater.fontFamily ?? '"Arial Rounded MT Bold", "PingFang SC", "Microsoft YaHei UI", ui-rounded, sans-serif';
      ctx.font = `${floater.italic ? "italic " : ""}1000 ${size}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(3.2, size * (floater.fontFamily ? 0.16 : 0.2));
      ctx.strokeStyle = floater.stroke ?? "rgba(20, 48, 66, 0.26)";
      ctx.shadowColor = colorWithAlpha(floater.shadow ?? "#ffffff", (floater.shadow ? 0.46 : 0.16) * alpha);
      ctx.shadowBlur = floater.shadow ? 14 : 10;
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

  function drawWaterStressOverlay() {
    const water = clamp(state.water, 0, 100);
    const mood = smoothstep(86, 14, water);
    const warn = smoothstep(52, 18, water);
    const danger = smoothstep(24, 0, water);
    const feedbackLive = state.running || water <= 0;
    const shock = feedbackLive && state.elapsed < waterShockUntil ? clamp((waterShockUntil - state.elapsed) / 560, 0, 1) : 0;
    const alert = feedbackLive && state.elapsed < waterCriticalUntil ? clamp((waterCriticalUntil - state.elapsed) / 980, 0, 1) : 0;
    const strength = clamp(mood * 0.34 + warn * 0.46 + danger * 0.54 + shock * 0.32 + alert * 0.34, 0, 1);
    if (strength <= 0.01) return;
    if (!currentPerformanceProfile().fullScreenOverlays && strength < 0.62) return;

    const minSide = Math.min(state.width, state.height);
    const maxSide = Math.max(state.width, state.height);
    const pulse = 0.5 + Math.sin(state.visualTime / (danger > 0.28 ? 132 : 220)) * 0.5;
    const alpha = clamp((0.025 + mood * 0.055 + warn * 0.075 + danger * 0.1) * (0.78 + pulse * 0.22) + shock * 0.08 + alert * 0.1, 0, 0.28);
    const edge = Math.max(18, minSide * (0.055 + danger * 0.035 + shock * 0.025));

    ctx.save();
    const shadeAlpha = clamp((0.014 + mood * 0.092 + danger * 0.055 + shock * 0.035) * (0.94 + pulse * 0.06), 0, 0.18);
    const shade = ctx.createLinearGradient(0, 0, 0, state.height);
    shade.addColorStop(0, colorWithAlpha("#18364b", shadeAlpha * 0.76));
    shade.addColorStop(0.38, colorWithAlpha("#25455b", shadeAlpha * 0.28));
    shade.addColorStop(0.66, colorWithAlpha("#17364a", shadeAlpha * 0.34));
    shade.addColorStop(1, colorWithAlpha("#0f2839", shadeAlpha * 0.82));
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, state.width, state.height);

    const centerLift = ctx.createRadialGradient(
      state.width * 0.5,
      state.height * 0.42,
      minSide * 0.1,
      state.width * 0.5,
      state.height * 0.46,
      maxSide * 0.54,
    );
    centerLift.addColorStop(0, colorWithAlpha("#ffffff", clamp(0.012 + mood * 0.026, 0, 0.045)));
    centerLift.addColorStop(0.72, "rgba(255, 255, 255, 0)");
    centerLift.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = centerLift;
    ctx.fillRect(0, 0, state.width, state.height);

    const vignette = ctx.createRadialGradient(
      state.width * 0.5,
      state.height * 0.48,
      minSide * 0.24,
      state.width * 0.5,
      state.height * 0.52,
      maxSide * 0.74,
    );
    vignette.addColorStop(0, "rgba(255, 255, 255, 0)");
    vignette.addColorStop(0.62, colorWithAlpha("#e5f6fb", alpha * 0.2));
    vignette.addColorStop(1, colorWithAlpha("#243d55", alpha));
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, state.width, state.height);

    const edgeAlpha = clamp(0.035 + warn * 0.045 + danger * 0.055 + shock * 0.06 + alert * 0.06, 0, 0.2);
    const edgeColor = danger > 0.18 ? "#20384f" : "#dff6fb";
    let gradient = ctx.createLinearGradient(0, 0, edge, 0);
    gradient.addColorStop(0, colorWithAlpha(edgeColor, edgeAlpha));
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, edge, state.height);

    gradient = ctx.createLinearGradient(state.width, 0, state.width - edge, 0);
    gradient.addColorStop(0, colorWithAlpha(edgeColor, edgeAlpha));
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(state.width - edge, 0, edge, state.height);

    gradient = ctx.createLinearGradient(0, 0, 0, edge);
    gradient.addColorStop(0, colorWithAlpha(edgeColor, edgeAlpha * 0.78));
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, edge);

    gradient = ctx.createLinearGradient(0, state.height, 0, state.height - edge);
    gradient.addColorStop(0, colorWithAlpha(edgeColor, edgeAlpha * 0.9));
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, state.height - edge, state.width, edge);

    if (water <= 8 || alert > 0.35) {
      ctx.globalAlpha = clamp((danger * 0.06 + alert * 0.08) * (0.65 + pulse * 0.35), 0, 0.14);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, state.width, state.height);
    }
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

  function drawMistakeFlash() {
    if (state.mistakeFlash <= 0) return;
    const alpha = state.mistakeFlash * 0.16;
    ctx.save();
    const edge = Math.max(18, Math.min(state.width, state.height) * 0.075);
    let gradient = ctx.createLinearGradient(0, 0, edge, 0);
    gradient.addColorStop(0, colorWithAlpha("#20384f", alpha));
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, edge, state.height);

    gradient = ctx.createLinearGradient(state.width, 0, state.width - edge, 0);
    gradient.addColorStop(0, colorWithAlpha("#20384f", alpha));
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(state.width - edge, 0, edge, state.height);

    ctx.globalAlpha = state.mistakeFlash * 0.035;
    ctx.fillStyle = "#eefbff";
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.restore();
  }

  function drawBuildVersion() {
    ctx.save();
    ctx.font = "800 9px \"Arial Rounded MT Bold\", \"PingFang SC\", \"Microsoft YaHei UI\", ui-rounded, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "rgba(20, 48, 66, 0.34)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.strokeText(buildVersion, state.width * 0.5, state.height - 8);
    ctx.fillText(buildVersion, state.width * 0.5, state.height - 8);
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
    ctx.font = "1000 24px \"Arial Rounded MT Bold\", \"PingFang SC\", \"Microsoft YaHei UI\", ui-rounded, sans-serif";
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
    drawWaterStressOverlay();
    state.bubbles.forEach(drawBubble);
    drawRipples();
    drawBlasts();
    drawParticles();
    drawFloaters();
    drawDifficultyBurst();
    drawBuildVersion();
    drawMistakeFlash();
    drawFlash();
  }

  function loop(now) {
    frameRequest = 0;
    if (document.hidden || !state.running) {
      updatePerfDebug(now, true);
      return;
    }

    if (lastFrameTime && now - lastFrameTime < currentTargetFrameMs() - 1) {
      scheduleLoop();
      return;
    }

    const targetStep = currentTargetFrameMs();
    const elapsed = lastFrameTime ? now - lastFrameTime : targetStep;
    const dt = Math.min(0.05, Math.max(0, elapsed / 1000 || targetStep / 1000));
    lastFrameTime = now;
    state.lastTime = now;
    state.visualTime += dt * 1000;
    const workStart = performance.now();
    update(dt);
    trimRuntimeEffects();
    if (state.running) {
      draw();
    }
    const workMs = performance.now() - workStart;
    recordFrameStats(elapsed, workMs);

    perfFrames += 1;
    if (!perfLastTime) perfLastTime = now;
    if (now - perfLastTime >= 1000) {
      perfFps = (perfFrames * 1000) / (now - perfLastTime);
      perfFrames = 0;
      perfLastTime = now;
    }
    updateAdaptivePerformance(now, elapsed, workMs);
    updatePerfDebug(now);
    scheduleLoop();
  }

  function playPop(kind = "large", delayOffset = 0) {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume?.();
      const now = audioContext.currentTime + delayOffset;
      const isSpecial = kind === "super" || kind === "clear";
      const comboLevel = Math.max(0, state.combo - 1);
      const comboTier = Math.min(4, Math.floor(comboLevel / 4));
      const pitchLift = Math.min(isSpecial ? 0.12 : 0.24, comboLevel * 0.017);
      const comboGain = 1 + Math.min(0.2, comboLevel * 0.014);
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
        const accentVolume = Math.min(0.027, 0.007 + comboLevel * 0.00135);
        const accentStart = chime * (1 + Math.min(0.2, comboLevel * 0.009)) * lift;
        playTone("sine", accentStart, accentStart * 1.06, accentVolume, 0.062, duration * 0.4, 0.014, 2050);
        if (state.combo >= 4) {
          playTone(
            "sine",
            accentStart * (1.18 + comboTier * 0.035),
            accentStart * (1.2 + comboTier * 0.04),
            Math.min(0.016, accentVolume * 0.72),
            0.064,
            duration * 0.62,
            0.018,
            2100,
          );
        }
      }
      if (state.combo >= 5 && state.combo % 5 === 0) {
        const milestoneBase = chime * (1.18 + comboTier * 0.035) * lift;
        playTone("sine", milestoneBase, milestoneBase * 1.14, 0.021, 0.11, 0.044, 0.016, 2350);
        playTone("triangle", milestoneBase * 1.48, milestoneBase * 1.58, 0.011, 0.14, 0.08, 0.018, 2550);
        if (state.combo >= 10) {
          playTone("sine", milestoneBase * 1.92, milestoneBase * 2.02, 0.007, 0.11, 0.13, 0.018, 2800);
        }
      }
    } catch {
      audioContext = null;
    }
  }

  function playCatMeow(kind = "tap", delayOffset = 0) {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume?.();
      const now = audioContext.currentTime + delayOffset;
      const strong = kind === "clear" || kind === "hold";
      const start = strong ? 520 : 590;
      const middle = strong ? 760 : 690;
      const end = strong ? 430 : 500;
      const length = strong ? 0.34 : 0.18;
      const peak = strong ? 0.034 : 0.018;

      const osc = audioContext.createOscillator();
      const formant = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(start, now);
      osc.frequency.exponentialRampToValueAtTime(middle, now + length * 0.32);
      osc.frequency.exponentialRampToValueAtTime(end, now + length * 0.92);
      formant.type = "bandpass";
      formant.frequency.setValueAtTime(strong ? 1180 : 1280, now);
      formant.frequency.exponentialRampToValueAtTime(strong ? 860 : 980, now + length);
      formant.Q.setValueAtTime(6.5, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.028);
      gain.gain.exponentialRampToValueAtTime(peak * 0.62, now + length * 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
      osc.connect(formant);
      formant.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(now);
      osc.stop(now + length + 0.04);

      const purr = audioContext.createOscillator();
      const purrGain = audioContext.createGain();
      purr.type = "triangle";
      purr.frequency.setValueAtTime(strong ? 92 : 118, now);
      purr.frequency.exponentialRampToValueAtTime(strong ? 76 : 96, now + length);
      purrGain.gain.setValueAtTime(0.0001, now);
      purrGain.gain.exponentialRampToValueAtTime(peak * 0.22, now + 0.02);
      purrGain.gain.exponentialRampToValueAtTime(0.0001, now + length * 0.86);
      purr.connect(purrGain);
      purrGain.connect(audioContext.destination);
      purr.start(now);
      purr.stop(now + length);
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
    const count = Math.round(clamp(spread / 20, 28, 42) * clamp(currentPerformanceProfile().effectChance, 0.48, 1));
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

  function setBackgroundToLevel(level) {
    const flow = state.backgroundFlow;
    const layout = makeBackgroundLayout(level, Math.max(0, level * 2));
    flow.phase = "hold";
    flow.elapsed = 0;
    flow.step = Math.max(flow.step, level * 2);
    flow.current = layout;
    flow.from = layout;
    flow.target = layout;
    Object.assign(flow, backgroundTimingForLevel(level));
  }

  function backgroundEngineTimeSeconds(time = state.visualTime) {
    if (state.running || state.elapsed > 0) {
      return Math.max(0, state.elapsed / 1000);
    }
    return Math.max(0, time / 1000);
  }

  function updateDebugPanel() {
    if (!debugStageInfo) return;
    const plan = state.stagePlan;
    if (debugLevelSelect && document.activeElement !== debugLevelSelect) {
      debugLevelSelect.value = String(displayDifficultyLevel());
    }
    debugStageInfo.textContent = plan
      ? `hit ${state.stageCorrectPops}/${plan.targetBubbles} miss ${state.stageMissedTargets} wrong ${state.stageWrongPops} spawn ${state.stageSpawned}/${plan.totalBubbles} avg +${plan.baseCorrectWater.toFixed(2)} -${plan.baseMissPenalty.toFixed(2)}`
      : "-";
  }

  function jumpToDebugLevel(level) {
    const targetLevel = Math.max(1, Math.round(level));
    if (!state.running) {
      resetGame();
    }
    clearRuntimeEffects();
    resetCombo({ recovery: false });
    state.comboRecoveryUntil = 0;
    state.comboRecoveryPower = 0;
    state.elapsed = Math.max(0, (targetLevel - 1) * stageDurationMs);
    state.water = 100;
    state.waterPressure = 0;
    state.hiddenLeak = 0;
    state.hiddenLeakActive = false;
    state.wrongStreak = 0;
    state.lastUsefulActionAt = state.elapsed;
    lastHudWater = null;
    waterGainUntil = 0;
    waterDrainUntil = 0;
    waterShockUntil = 0;
    waterCriticalUntil = 0;
    lastWaterBand = "safe";
    waterLowVibrationArmed = true;
    state.difficultyTier = Math.max(0, targetLevel - 1);
    state.nextPowerAt = state.elapsed + 26000;
    state.nextSpawnAt = state.elapsed + 120;
    state.openUntil = 0;
    resetBombComboTimer();
    resetStagePlan(targetLevel);
    setBackgroundToLevel(targetLevel);
    curtain.classList.add("hidden");
    updateHud();
    draw();
    scheduleLoop();
  }

  function initDebugControls() {
    if (!debugLevelSelect || !debugJumpButton) return;
    if (debugLevelSelect.options.length === 0) {
      for (let level = 1; level <= 12; level += 1) {
        const option = document.createElement("option");
        option.value = String(level);
        option.textContent = `Lv ${level}`;
        debugLevelSelect.append(option);
      }
    }
    debugJumpButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      jumpToDebugLevel(Number(debugLevelSelect.value || 1));
    });
    updateDebugPanel();
  }

  function updateCustomPackDevStatus(statusEl) {
    if (!statusEl) return;
    const pack = state.customBubblePack;
    statusEl.textContent = pack ? `${pack.name} · ${pack.bubbles.length} templates` : "No custom pack";
  }

  function initCustomPackDevPanel() {
    state.customBubblePack = loadCustomBubblePack();
    const params = new URLSearchParams(window.location.search);
    const shouldShow = params.has("dev") || Boolean(state.customBubblePack);
    if (!shouldShow) return;

    const panel = document.createElement("section");
    panel.className = "dev-pack-panel";
    const status = document.createElement("span");
    status.className = "dev-pack-status";
    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.textContent = "导入";
    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.textContent = "清空";
    const editorButton = document.createElement("button");
    editorButton.type = "button";
    editorButton.textContent = "编辑器";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.hidden = true;
    panel.append(status, importButton, clearButton, editorButton, input);
    document.body.append(panel);
    updateCustomPackDevStatus(status);

    importButton.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const normalized = saveCustomBubblePack(String(reader.result || ""));
        state.customBubblePack = normalized;
        state.customPackStatus = normalized ? `PACK ${normalized.name}` : "Pack import failed";
        state.nextSpawnAt = Math.min(state.nextSpawnAt || state.elapsed + 120, state.elapsed + 120);
        updateCustomPackDevStatus(status);
      });
      reader.readAsText(file);
      input.value = "";
    });
    clearButton.addEventListener("click", () => {
      state.customBubblePack = saveCustomBubblePack(null);
      state.customPackStatus = "";
      updateCustomPackDevStatus(status);
    });
    editorButton.addEventListener("click", () => {
      window.location.href = "./editor.html";
    });
  }

  initCustomPackDevPanel();
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
  window.addEventListener("resize", () => {
    resize();
    if (!state.running) {
      draw();
      updatePerfDebug(performance.now(), true);
    }
  });
  window.addEventListener("orientationchange", () => {
    resize();
    if (!state.running) {
      draw();
      updatePerfDebug(performance.now(), true);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (frameRequest) {
        cancelAnimationFrame(frameRequest);
        frameRequest = 0;
      }
      return;
    }
    lastFrameTime = performance.now();
    if (state.running) {
      scheduleLoop();
    } else {
      draw();
      updatePerfDebug(lastFrameTime, true);
    }
  });

  resize();
  initDebugControls();
  updateHud();
  draw();
  updatePerfDebug(performance.now(), true);
})();
