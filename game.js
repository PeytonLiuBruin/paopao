(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const curtain = document.getElementById("curtain");
  const startButton = document.getElementById("startButton");
  const endStats = document.getElementById("endStats");
  const waterFill = document.getElementById("waterFill");
  const scoreEl = document.getElementById("score");
  const mistakeDots = Array.from(document.querySelectorAll(".mistakes span"));

  const palette = [
    { name: "雾青", color: "#a8c9c3", deep: "#789f98", light: "#d9e8e4" },
    { name: "睡莲粉", color: "#d8b8c7", deep: "#ac8999", light: "#f1dde5" },
  ];

  const openTone = makeOpenTone();
  const maxMistakes = 8;
  const baseWaterDrain = 4.7;
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
    nextSpawnAt: 0,
    openUntil: 0,
    flash: 0,
    bubbles: [],
    particles: [],
    ripples: [],
    hints: [],
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

  function makeOpenTone() {
    return {
      name: "全",
      color: mixHex(palette[0].color, palette[1].color, 0.5),
      deep: mixHex(palette[0].deep, palette[1].deep, 0.48),
      light: mixHex(palette[0].light, palette[1].light, 0.46),
    };
  }

  function updateHud() {
    waterFill.style.width = `${Math.max(0, Math.min(100, state.water))}%`;
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
    state.nextSpawnAt = 240;
    state.openUntil = 0;
    state.flash = 0;
    state.bubbles = [];
    state.particles = [];
    state.ripples = [];
    state.hints = [];
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
    const timePart = Math.min(1, state.elapsed / 95000);
    const scorePart = Math.min(1, state.score / 120);
    return Math.max(timePart, scorePart * 0.72);
  }

  function spawnBubble(forceSmall = false) {
    const d = difficulty();
    const margin = 72;
    const edgeNames = ["left", "right", "bottom", "top"];
    const edge = edgeNames[Math.floor(Math.random() * edgeNames.length)];
    const superChance = 0.028 + d * 0.022;
    const isSuper = Math.random() < superChance;
    const smallWave = forceSmall || (d > 0.45 && Math.random() < d * 0.5);
    const largeMin = 34 - d * 12;
    const largeMax = 62 - d * 22;
    const smallMin = 13;
    const smallMax = 25;
    const radius = smallWave ? rand(smallMin, smallMax) : rand(largeMin, largeMax);
    const speed = rand(18 + d * 20, 46 + d * 46);
    let x;
    let y;
    let vx;
    let vy;

    if (edge === "left") {
      x = -radius;
      y = rand(margin, state.height - margin);
      vx = speed * rand(0.55, 1.15);
      vy = rand(-22, 22);
    } else if (edge === "right") {
      x = state.width + radius;
      y = rand(margin, state.height - margin);
      vx = -speed * rand(0.55, 1.15);
      vy = rand(-22, 22);
    } else if (edge === "bottom") {
      x = rand(margin, state.width - margin);
      y = state.height + radius;
      vx = rand(-24, 24);
      vy = -speed * rand(0.65, 1.25);
    } else {
      x = rand(margin, state.width - margin);
      y = -radius;
      vx = rand(-22, 22);
      vy = speed * rand(0.45, 0.9);
    }

    const colorIndex = pickColorIndex();
    state.bubbles.push({
      x,
      y,
      vx,
      vy,
      radius,
      baseRadius: radius,
      colorIndex,
      isSuper,
      wobble: rand(0, Math.PI * 2),
      wobbleSpeed: rand(1.1, 2.2),
      drift: rand(-1, 1),
      age: 0,
      spin: rand(-1.6, 1.6),
      edge,
    });

    const hintColor = isSuper ? openTone.color : palette[colorIndex].color;
    state.hints.push({ edge, color: hintColor, alpha: 0.55, age: 0 });
  }

  function spawnWave() {
    const d = difficulty();
    const baseInterval = Math.max(310, 1280 - d * 870 - Math.min(250, state.score * 3));
    state.nextSpawnAt = state.elapsed + baseInterval * rand(0.76, 1.18);

    let count = 1;
    if (d > 0.42 && Math.random() < d * 0.54) count += Math.floor(rand(2, 5 + d * 4));
    if (d > 0.72 && Math.random() < 0.36) count += Math.floor(rand(2, 5));

    for (let index = 0; index < count; index += 1) {
      spawnBubble(count > 2 || index > 0);
    }
  }

  function activateOpenMode(x, y) {
    state.openUntil = Math.max(state.openUntil, state.elapsed + 6200);
    state.flash = Math.max(state.flash, 0.55);
    state.bubbles.forEach((bubble) => {
      bubble.colorIndex = -1;
    });
    for (let index = 0; index < 34; index += 1) {
      makeParticle(x, y, openTone.color, rand(80, 260), rand(0, Math.PI * 2), rand(0.45, 0.95), true);
    }
    state.ripples.push({ x, y, radius: 12, age: 0, life: 0.7, color: openTone.color });
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
    const color = bubble.isSuper || isOpen || bubble.colorIndex === -1 ? openTone : palette[bubble.colorIndex];
    state.bubbles.splice(index, 1);
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
    if (state.openUntil > state.elapsed || bubble.isSuper || bubble.colorIndex === -1) {
      return true;
    }

    return bubble.colorIndex === backgroundColorIndexAt(bubble.x, bubble.y);
  }

  function handlePointer(event) {
    event.preventDefault();
    if (!state.running) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
      const bubble = state.bubbles[i];
      const dx = x - bubble.x;
      const dy = y - bubble.y;
      const hitRadius = bubble.radius + 8;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        if (canPopBubble(bubble)) {
          popBubble(bubble, i);
        } else {
          missTap();
        }
        return;
      }
    }
  }

  function update(dt) {
    if (!state.running) return;

    state.elapsed += dt * 1000;
    const d = difficulty();
    state.water -= (baseWaterDrain + d * 3.6) * dt;
    state.flash = Math.max(0, state.flash - dt * 1.9);

    while (state.elapsed >= state.nextSpawnAt) {
      spawnWave();
    }

    for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
      const bubble = state.bubbles[i];
      bubble.age += dt;
      bubble.wobble += bubble.wobbleSpeed * dt;
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
    const isOpen = state.openUntil > state.elapsed || bubble.colorIndex === -1;
    const color = bubble.isSuper || isOpen ? openTone : palette[bubble.colorIndex];
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
    const fillHeight = Math.max(18, h * (state.water / 100) * 0.24);
    const y = h - fillHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, h);
    gradient.addColorStop(0, "rgba(217, 232, 228, 0.7)");
    gradient.addColorStop(1, "rgba(168, 201, 195, 0.46)");

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, y);
    for (let x = 0; x <= state.width + 18; x += 18) {
      const wave = Math.sin(x * 0.055 + state.visualTime * 0.006) * 4 + Math.sin(x * 0.023 + state.visualTime * 0.003) * 6;
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
  canvas.addEventListener("pointerdown", handlePointer, { passive: false });
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
