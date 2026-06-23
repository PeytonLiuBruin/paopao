(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const curtain = document.getElementById("curtain");
  const startButton = document.getElementById("startButton");
  const endStats = document.getElementById("endStats");
  const waterFill = document.getElementById("waterFill");
  const waterValue = document.getElementById("waterValue");
  const waterBlock = document.querySelector(".water-block");
  const scoreEl = document.getElementById("score");
  const mistakeDots = Array.from(document.querySelectorAll(".mistakes span"));

  const palette = [
    { name: "湖雾蓝", color: "#8ebfcb", deep: "#5f91a0", light: "#d5e9ee" },
    { name: "雾玫粉", color: "#d9a2b2", deep: "#a87584", light: "#f1d4dc" },
  ];

  const openTone = makeOpenTone();
  const clearTone = makeClearTone();
  const maxMistakes = 8;
  const baseWaterDrain = 3.7;
  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    running: false,
    lastTime: 0,
    visualTime: 0,
    elapsed: 0,
    score: 0,
    water: 76,
    mistakes: 0,
    colorCursor: 0,
    nextClearAt: 12000,
    nextSpawnAt: 0,
    openUntil: 0,
    flash: 0,
    bubbles: [],
    particles: [],
    ripples: [],
    hints: [],
    activePointerId: null,
    lastSwipeX: 0,
    lastSwipeY: 0,
  };

  let audioContext;

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
      Math.sin(time / 18000) * 0.12 +
      Math.sin(ny * Math.PI * 2.2 + time / 13000) * 0.13 +
      Math.sin(ny * Math.PI * 5.1 - time / 21000) * 0.045
    );
  }

  function backgroundMixAt(x, y, time = state.visualTime) {
    const nx = state.width > 0 ? x / state.width : 0.5;
    const boundary = backgroundBoundaryForY(y, time);
    const softness = 0.13 + Math.sin(time / 24000) * 0.02;
    return smoothstep(boundary - softness, boundary + softness, nx);
  }

  function backgroundColorIndexAt(x, y) {
    return backgroundMixAt(x, y) >= 0.5 ? 1 : 0;
  }

  function matchingPointForColor(colorIndex, preferredY = null) {
    const top = Math.min(128, state.height * 0.2);
    const bottom = Math.max(top + 30, state.height - 118);
    const y = clamp(preferredY ?? rand(top, bottom), top, bottom);
    const boundaryX = clamp(backgroundBoundaryForY(y) * state.width, state.width * 0.24, state.width * 0.76);
    const padding = Math.max(44, Math.min(state.width * 0.16, 72));
    const buffer = state.width * 0.08;
    let minX = padding;
    let maxX = state.width - padding;

    if (colorIndex === 0) {
      maxX = Math.max(padding + 24, boundaryX - buffer);
    } else {
      minX = Math.min(state.width - padding - 24, boundaryX + buffer);
    }

    return { x: rand(minX, maxX), y };
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

  function updateHud() {
    const water = Math.round(Math.max(0, Math.min(100, state.water)));
    waterFill.style.width = `${water}%`;
    waterValue.textContent = `${water}%`;
    waterBlock.classList.toggle("low", water <= 28);
    scoreEl.textContent = String(state.score);
    mistakeDots.forEach((dot, index) => {
      dot.classList.toggle("used", index < state.mistakes);
    });
  }

  function resetGame() {
    state.running = true;
    state.lastTime = performance.now();
    state.elapsed = 0;
    state.score = 0;
    state.water = 76;
    state.mistakes = 0;
    state.colorCursor = pickColorIndex();
    state.nextClearAt = 14500;
    state.nextSpawnAt = 240;
    state.openUntil = 0;
    state.flash = 0;
    state.bubbles = [];
    state.particles = [];
    state.ripples = [];
    state.hints = [];
    state.activePointerId = null;
    state.lastSwipeX = 0;
    state.lastSwipeY = 0;
    updateHud();
    curtain.classList.add("hidden");
    endStats.textContent = "";
  }

  function endGame() {
    if (!state.running) return;
    state.running = false;
    curtain.classList.remove("hidden");
    startButton.textContent = "再来";
    endStats.textContent = `分数 ${state.score}`;
  }

  function difficulty() {
    const timePart = Math.min(1, state.elapsed / 150000);
    const scorePart = Math.min(1, state.score / 190);
    return Math.max(timePart, scorePart * 0.58);
  }

  function spawnBubble(forceSmall = false, forcedKind = null) {
    const d = difficulty();
    const margin = 72;
    const edgeNames = ["left", "right", "bottom", "top"];
    const edge = edgeNames[Math.floor(Math.random() * edgeNames.length)];
    const openActive = state.openUntil > state.elapsed;
    const superChance = openActive ? 0 : 0.018 + d * 0.014;
    const kind = forcedKind ?? (Math.random() < superChance ? "open" : "normal");
    const isSuper = kind === "open";
    const isClear = kind === "clear";
    const smallWave = forceSmall || (d > 0.58 && Math.random() < (d - 0.42) * 0.38);
    const largeMin = 36 - d * 9;
    const largeMax = 66 - d * 18;
    const smallMin = 13;
    const smallMax = 25;
    const radius = smallWave ? rand(smallMin, smallMax) : rand(largeMin, largeMax);
    const speed = rand(16 + d * 14, 39 + d * 34);
    let x;
    let y;

    if (edge === "left") {
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

    const colorIndex = kind === "normal" ? pickBalancedColorIndex() : -1;
    const target =
      kind === "normal"
        ? matchingPointForColor(colorIndex, y)
        : {
            x: rand(state.width * 0.24, state.width * 0.76),
            y: rand(state.height * 0.24, state.height * 0.72),
          };
    const velocity = aimedVelocity(x, y, target, speed, kind === "normal" ? 12 : 26);
    state.bubbles.push({
      x,
      y,
      vx: velocity.vx,
      vy: velocity.vy,
      radius,
      baseRadius: radius,
      colorIndex,
      isSuper,
      isClear,
      wobble: rand(0, Math.PI * 2),
      wobbleSpeed: rand(1.1, 2.2),
      drift: rand(-1, 1),
      age: 0,
      wasReady: false,
      spin: rand(-1.6, 1.6),
      edge,
    });

    const hintColor = isClear ? clearTone.color : isSuper ? openTone.color : palette[colorIndex].color;
    state.hints.push({ edge, color: hintColor, alpha: 0.55, age: 0 });
  }

  function spawnWave() {
    const d = difficulty();
    const baseInterval = Math.max(480, 1450 - d * 690 - Math.min(150, state.score * 1.6));
    state.nextSpawnAt = state.elapsed + baseInterval * rand(0.86, 1.24);

    let count = 1;
    if (d > 0.56 && Math.random() < (d - 0.42) * 0.42) count += Math.floor(rand(2, 4 + d * 3));
    if (d > 0.82 && Math.random() < 0.24) count += Math.floor(rand(2, 4));

    const clearableCount = state.bubbles.filter((bubble) => !bubble.isClear).length;
    const crowded = clearableCount >= 8 && state.elapsed >= state.nextClearAt - 6000;
    if ((state.elapsed >= state.nextClearAt || crowded) && clearableCount >= 3) {
      spawnBubble(false, "clear");
      state.nextClearAt = state.elapsed + rand(22000 - d * 4200, 31000 - d * 5200);
    }

    for (let index = 0; index < count; index += 1) {
      spawnBubble(count > 2 || index > 0);
    }
  }

  function activateOpenMode(x, y) {
    state.openUntil = Math.max(state.openUntil, state.elapsed + 6200);
    state.flash = Math.max(state.flash, 0.55);
    state.bubbles.forEach((bubble) => {
      bubble.isSuper = false;
      bubble.colorIndex = -1;
    });
    for (let index = 0; index < 34; index += 1) {
      makeParticle(x, y, openTone.color, rand(80, 260), rand(0, Math.PI * 2), rand(0.45, 0.95), true);
    }
    state.ripples.push({ x, y, radius: 12, age: 0, life: 0.7, color: openTone.color });
  }

  function activateClearScreen(origin) {
    const cleared = state.bubbles.splice(0);
    state.score += 6 + cleared.length * 2;
    state.water = Math.min(100, state.water + Math.min(24, 10 + cleared.length * 2));
    state.flash = Math.max(state.flash, 0.64);
    state.ripples.push({ x: origin.x, y: origin.y, radius: origin.radius, age: 0, life: 0.82, color: clearTone.color });

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

  function popBubble(bubble, index) {
    const isOpen = state.openUntil > state.elapsed;
    const color = bubble.isClear
      ? clearTone
      : bubble.isSuper || bubble.colorIndex === -1
        ? openTone
        : palette[bubble.colorIndex];
    state.bubbles.splice(index, 1);

    if (bubble.isClear) {
      activateClearScreen(bubble);
      if (navigator.vibrate) {
        navigator.vibrate(34);
      }
      playPop(true);
      updateHud();
      return;
    }

    state.score += bubble.isSuper ? 8 : isOpen ? 3 : 1;
    state.water = Math.min(100, state.water + (bubble.isSuper ? 16 : isOpen ? 8 : 6));
    state.flash = Math.max(state.flash, bubble.isSuper ? 0.52 : 0.28);
    state.ripples.push({
      x: bubble.x,
      y: bubble.y,
      radius: bubble.radius * 0.55,
      age: 0,
      life: bubble.isSuper ? 0.82 : 0.46,
      color: color.color,
    });

    const amount = bubble.isSuper ? 46 : Math.round(12 + bubble.radius * 0.45);
    for (let i = 0; i < amount; i += 1) {
      const angle = rand(-Math.PI, Math.PI);
      const speed = rand(70, bubble.isSuper ? 310 : 230);
      makeParticle(bubble.x, bubble.y, i % 3 === 0 ? color.light : palette[0].light, speed, angle, rand(0.38, 0.88));
    }

    if (bubble.isSuper) {
      activateOpenMode(bubble.x, bubble.y);
    }

    if (navigator.vibrate) {
      navigator.vibrate(bubble.isSuper ? 28 : 12);
    }
    playPop(bubble.isSuper);
  }

  function missTap() {
    state.mistakes += 1;
    updateHud();
    if (state.mistakes >= maxMistakes) {
      endGame();
    }
  }

  function canPopBubble(bubble) {
    if (state.openUntil > state.elapsed || bubble.isSuper || bubble.isClear || bubble.colorIndex === -1) {
      return true;
    }

    return bubble.colorIndex === backgroundColorIndexAt(bubble.x, bubble.y);
  }

  function steerBubbleTowardMatch(bubble, dt, d) {
    if (bubble.isSuper || bubble.isClear || bubble.colorIndex < 0) return;
    if (bubble.colorIndex === backgroundColorIndexAt(bubble.x, bubble.y)) {
      bubble.wasReady = true;
      return;
    }

    const urgency = smoothstep(1.15, 4.1 - d * 1.25, bubble.age);
    if (urgency <= 0) return;

    const target = matchingPointForColor(bubble.colorIndex, bubble.y);
    const speed = Math.max(28, Math.hypot(bubble.vx, bubble.vy));
    const desired = aimedVelocity(bubble.x, bubble.y, target, speed, 0);
    const correction = dt * (0.45 + urgency * 1.85);
    bubble.vx += (desired.vx - bubble.vx) * correction;
    bubble.vy += (desired.vy - bubble.vy) * correction;
  }

  function tryPopAt(x, y, allowMistake) {
    for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
      const bubble = state.bubbles[i];
      const dx = x - bubble.x;
      const dy = y - bubble.y;
      const hitRadius = bubble.radius + (allowMistake ? 8 : 14);
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        if (canPopBubble(bubble)) {
          popBubble(bubble, i);
        } else if (allowMistake) {
          missTap();
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
    state.water -= (baseWaterDrain + d * 2.45) * dt;
    state.flash = Math.max(0, state.flash - dt * 1.9);

    while (state.elapsed >= state.nextSpawnAt) {
      spawnWave();
    }

    for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
      const bubble = state.bubbles[i];
      bubble.age += dt;
      bubble.wobble += bubble.wobbleSpeed * dt;
      steerBubbleTowardMatch(bubble, dt, d);
      const sway = Math.sin(bubble.wobble) * (12 + d * 16);
      bubble.x += (bubble.vx + sway * bubble.drift) * dt;
      bubble.y += (bubble.vy + Math.cos(bubble.wobble * 0.7) * 10) * dt;
      bubble.radius = bubble.baseRadius * (1 + Math.sin(bubble.age * 4.2) * 0.028);

      const outside =
        bubble.x < -bubble.radius * 2 ||
        bubble.x > state.width + bubble.radius * 2 ||
        bubble.y < -bubble.radius * 2 ||
        bubble.y > state.height + bubble.radius * 2;

      if (outside) {
        state.bubbles.splice(i, 1);
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
      hint.alpha -= dt * 0.72;
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

  function drawBackground() {
    const time = state.visualTime;
    const openAmount = state.openUntil > state.elapsed ? 0.5 : 0;
    const rowHeight = 5;

    for (let y = 0; y < state.height; y += rowHeight) {
      const bandY = y + rowHeight * 0.5;
      const vertical = state.height > 0 ? bandY / state.height : 0.5;
      const boundary = backgroundBoundaryForY(bandY, time);
      const softness = 0.13 + Math.sin(time / 24000) * 0.02;
      const start = clamp(boundary - softness, 0, 1);
      const end = clamp(boundary + softness, 0, 1);
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
      gradient.addColorStop(0, colorA);
      gradient.addColorStop(start, colorA);
      gradient.addColorStop(end, colorB);
      gradient.addColorStop(1, colorB);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, y, state.width, rowHeight + 1);
    }

    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let y = -80; y < state.height + 120; y += 96) {
      const boundaryX = backgroundBoundaryForY(y, time) * state.width;
      ctx.fillStyle = colorWithAlpha(palette[0].light, 0.58);
      ctx.beginPath();
      ctx.ellipse(
        boundaryX - state.width * 0.16,
        y + Math.sin(time / 6200 + y) * 10,
        state.width * 0.42,
        22,
        -0.18,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = colorWithAlpha(palette[1].light, 0.52);
      ctx.beginPath();
      ctx.ellipse(
        boundaryX + state.width * 0.18,
        y + Math.cos(time / 7000 + y) * 10,
        state.width * 0.38,
        20,
        -0.18,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHints() {
    state.hints.forEach((hint) => {
      const alpha = Math.max(0, hint.alpha);
      const color = colorWithAlpha(hint.color, alpha);
      const size = Math.min(state.width, state.height) * 0.2;
      const gradient =
        hint.edge === "left" || hint.edge === "right"
          ? ctx.createLinearGradient(hint.edge === "left" ? 0 : state.width, 0, hint.edge === "left" ? size : state.width - size, 0)
          : ctx.createLinearGradient(0, hint.edge === "top" ? 0 : state.height, 0, hint.edge === "top" ? size : state.height - size);

      gradient.addColorStop(0, color);
      gradient.addColorStop(1, colorWithAlpha(hint.color, 0));
      ctx.fillStyle = gradient;

      if (hint.edge === "left") ctx.fillRect(0, 0, size, state.height);
      if (hint.edge === "right") ctx.fillRect(state.width - size, 0, size, state.height);
      if (hint.edge === "top") ctx.fillRect(0, 0, state.width, size);
      if (hint.edge === "bottom") ctx.fillRect(0, state.height - size, state.width, size);
    });
  }

  function drawBubble(bubble) {
    const color = bubble.isClear
      ? clearTone
      : bubble.isSuper || bubble.colorIndex === -1
        ? openTone
        : palette[bubble.colorIndex];
    const ready = canPopBubble(bubble);
    const x = bubble.x;
    const y = bubble.y;
    const r = bubble.radius;
    const body = ctx.createRadialGradient(x - r * 0.36, y - r * 0.42, r * 0.08, x, y, r);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.18, color.light);
    body.addColorStop(0.58, colorWithAlpha(color.color, 0.88));
    body.addColorStop(1, colorWithAlpha(color.deep, 0.72));

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(bubble.wobble) * 0.08 + bubble.spin * 0.05);
    ctx.translate(-x, -y);

    if (ready) {
      ctx.shadowColor = colorWithAlpha(color.light, 0.72);
      ctx.shadowBlur = r * 0.7;
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = colorWithAlpha(color.light, 0.34 + Math.sin(state.visualTime / 520) * 0.08);
      ctx.lineWidth = Math.max(2, r * 0.055);
      ctx.stroke();
    }

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

    if (bubble.isSuper) {
      drawStar(x, y, r * 0.42, palette[0].light, "rgba(255,255,255,0.78)");
      ctx.beginPath();
      ctx.arc(x, y, r * 0.68, 0, Math.PI * 2);
      ctx.strokeStyle = colorWithAlpha(palette[1].light, 0.34 + Math.sin(state.elapsed / 120) * 0.1);
      ctx.lineWidth = Math.max(2, r * 0.075);
      ctx.stroke();
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
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.52;
      ctx.strokeStyle = ripple.color;
      ctx.lineWidth = 5 * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawWaterSurface() {
    const h = state.height;
    const fillHeight = Math.max(9, h * (state.water / 100) * 0.055);
    const y = h - fillHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, h);
    gradient.addColorStop(0, "rgba(213, 233, 238, 0.22)");
    gradient.addColorStop(1, "rgba(142, 191, 203, 0.17)");

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, y);
    for (let x = 0; x <= state.width + 18; x += 18) {
      const wave = Math.sin(x * 0.055 + state.visualTime * 0.006) * 2 + Math.sin(x * 0.023 + state.visualTime * 0.003) * 2.4;
      ctx.lineTo(x, y + wave);
    }
    ctx.lineTo(state.width, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFlash() {
    if (state.flash <= 0) return;
    ctx.save();
    ctx.globalAlpha = state.flash * 0.24;
    ctx.fillStyle = state.openUntil > state.elapsed ? openTone.light : "#ffffff";
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.restore();
  }

  function draw() {
    drawBackground();
    drawHints();
    drawWaterSurface();
    state.bubbles.forEach(drawBubble);
    drawRipples();
    drawParticles();
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

  function playPop(superPop) {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      osc.type = "sine";
      osc.frequency.setValueAtTime(superPop ? 720 : 520, now);
      osc.frequency.exponentialRampToValueAtTime(superPop ? 1180 : 780, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(superPop ? 0.08 : 0.045, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      audioContext = null;
    }
  }

  startButton.addEventListener("click", resetGame);
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
