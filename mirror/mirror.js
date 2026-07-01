(() => {
  "use strict";

  const canvas = document.getElementById("mirrorCanvas");
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const modeLabel = document.getElementById("modeLabel");
  const volumeLabel = document.getElementById("volumeLabel");
  const volumeScaleInput = document.getElementById("volumeScale");
  const burstButton = document.getElementById("burstButton");
  const statsEl = document.getElementById("stats");
  const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));

  const tau = Math.PI * 2;
  const maxBubbles = 84;
  const targetFrameMs = 1000 / 60;
  const physicsLifetime = 2.5;
  const collisionCellSize = 128;
  const collisionIterations = 6;
  const collisionStiffness = 0.72;
  const bubbleRestitution = 0.1;
  const collisionFriction = 0.035;
  const softWallStiffness = 0.42;
  const modes = ["corner", "edge", "range"];
  const palette = [
    { fill: "#89d5e1", deep: "#227d96", rim: "#d9f6fb" },
    { fill: "#f0abc0", deep: "#ad5f78", rim: "#ffe1ea" },
    { fill: "#d4eef3", deep: "#6da6b5", rim: "#ffffff" },
  ];
  const state = {
    width: 1,
    height: 1,
    dpr: 1,
    mode: "edge",
    volumeScale: 1,
    bubbles: [],
    emitters: [],
    nextBurstAt: 0,
    lastTime: 0,
    fps: 0,
    frames: 0,
    fpsAt: 0,
    burstId: 0,
    contactPairs: 0,
    physicsActive: 0,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function choose(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    state.width = Math.max(1, rect.width);
    state.height = Math.max(1, rect.height);
    state.dpr = 1;
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  function edgeVectors(edge) {
    if (edge === "left") return { inward: { x: 1, y: 0 }, tangent: { x: 0, y: 1 } };
    if (edge === "right") return { inward: { x: -1, y: 0 }, tangent: { x: 0, y: 1 } };
    if (edge === "top") return { inward: { x: 0, y: 1 }, tangent: { x: 1, y: 0 } };
    return { inward: { x: 0, y: -1 }, tangent: { x: 1, y: 0 } };
  }

  function edgeAxisLength(edge) {
    return edge === "left" || edge === "right" ? state.height : state.width;
  }

  function edgeBasePoint(edge, axisOffset, radius) {
    const margin = Math.max(20, radius * 0.7);
    if (edge === "left") return { x: -radius * 0.8, y: clamp(axisOffset, margin, state.height - margin) };
    if (edge === "right") return { x: state.width + radius * 0.8, y: clamp(axisOffset, margin, state.height - margin) };
    if (edge === "top") return { x: clamp(axisOffset, margin, state.width - margin), y: -radius * 0.8 };
    return { x: clamp(axisOffset, margin, state.width - margin), y: state.height + radius * 0.8 };
  }

  function makeEmitter(mode, pointer = null) {
    const minSide = Math.min(state.width, state.height);
    let edge = choose(["left", "right", "top", "bottom"]);
    let rangeStart = 0.2;
    let rangeEnd = 0.8;
    let cornerSign = Math.random() < 0.5 ? 0 : 1;

    if (pointer) {
      const distances = [
        { edge: "left", value: pointer.x },
        { edge: "right", value: state.width - pointer.x },
        { edge: "top", value: pointer.y },
        { edge: "bottom", value: state.height - pointer.y },
      ];
      edge = distances.sort((a, b) => a.value - b.value)[0].edge;
      const axis = edge === "left" || edge === "right" ? pointer.y / state.height : pointer.x / state.width;
      rangeStart = clamp(axis - 0.16, 0.04, 0.92);
      rangeEnd = clamp(axis + 0.16, 0.08, 0.96);
    } else if (mode === "corner") {
      edge = choose(["left", "right", "top", "bottom"]);
      const span = clamp(minSide / edgeAxisLength(edge) * rand(0.16, 0.26), 0.11, 0.28);
      rangeStart = cornerSign === 0 ? 0.04 : 1 - span - 0.04;
      rangeEnd = rangeStart + span;
    } else if (mode === "edge") {
      const center = rand(0.22, 0.78);
      const span = rand(0.16, 0.28);
      rangeStart = clamp(center - span * 0.5, 0.04, 0.9);
      rangeEnd = clamp(center + span * 0.5, 0.1, 0.96);
    } else {
      const center = rand(0.28, 0.72);
      const span = rand(0.34, 0.55);
      rangeStart = clamp(center - span * 0.5, 0.03, 0.78);
      rangeEnd = clamp(center + span * 0.5, 0.22, 0.97);
    }

    return {
      edge,
      mode,
      rangeStart,
      rangeEnd,
      born: performance.now(),
      life: 880,
    };
  }

  function volumeToRadius(volume) {
    return clamp(Math.cbrt(volume) * 21.5, 11, 54);
  }

  function volumeToMass(volume, radius) {
    return Math.max(0.28, volume * 0.82 + radius * radius * 0.00055);
  }

  function naturalVolume(index, count) {
    const centerBias = 1 + Math.sin((index / Math.max(1, count - 1)) * Math.PI) * rand(0.04, 0.28);
    const logShape = Math.exp(rand(-0.58, 0.62));
    const rareLarge = Math.random() < 0.14 ? rand(1.24, 1.74) : 1;
    return clamp(logShape * centerBias * rareLarge * state.volumeScale, 0.18, 5.8);
  }

  function clampPlacement(point, emitter, radius) {
    const axis = edgeAxisLength(emitter.edge);
    const start = emitter.rangeStart * axis;
    const end = emitter.rangeEnd * axis;
    const vectors = edgeVectors(emitter.edge);
    const depthMax = Math.max(34, radius * 2.4);

    if (emitter.edge === "left" || emitter.edge === "right") {
      const edgeX = emitter.edge === "left" ? -radius * 0.72 : state.width + radius * 0.72;
      const depth = (point.x - edgeX) * vectors.inward.x;
      point.x = edgeX + vectors.inward.x * clamp(depth, -radius * 0.2, depthMax);
      point.y = clamp(point.y, start, end);
    } else {
      const edgeY = emitter.edge === "top" ? -radius * 0.72 : state.height + radius * 0.72;
      const depth = (point.y - edgeY) * vectors.inward.y;
      point.y = edgeY + vectors.inward.y * clamp(depth, -radius * 0.2, depthMax);
      point.x = clamp(point.x, start, end);
    }
  }

  function overlapPenalty(candidate, radius, placed) {
    let penalty = 0;
    for (const other of placed) {
      const dx = candidate.x - other.x;
      const dy = candidate.y - other.y;
      const distance = Math.max(0.01, Math.hypot(dx, dy));
      const allowed = (radius + other.radius) * 0.82;
      if (distance < allowed) {
        const overlap = allowed - distance;
        penalty += overlap * overlap;
      }
    }
    return penalty;
  }

  function placeBubble(emitter, radius, progress, placed, count) {
    const axis = edgeAxisLength(emitter.edge);
    const vectors = edgeVectors(emitter.edge);
    const start = emitter.rangeStart * axis;
    const end = emitter.rangeEnd * axis;
    const span = Math.max(radius * 2.6, end - start);
    const centered = (progress - 0.5) * span;
    const depthBase = radius * rand(0.1, 0.82);
    let best = null;
    let bestPenalty = Infinity;

    for (let attempt = 0; attempt < 32; attempt += 1) {
      const wave = Math.sin(progress * Math.PI * 2 + attempt * 0.73) * radius * rand(0.05, 0.42);
      const axisOffset = (start + end) * 0.5 + centered + wave + rand(-radius * 0.7, radius * 0.7);
      const base = edgeBasePoint(emitter.edge, axisOffset, radius);
      const depth = depthBase + attempt * radius * 0.035 + rand(-radius * 0.22, radius * 0.28);
      const side = (attempt % 3 - 1) * radius * 0.28;
      const candidate = {
        x: base.x + vectors.inward.x * depth + vectors.tangent.x * side,
        y: base.y + vectors.inward.y * depth + vectors.tangent.y * side,
      };
      clampPlacement(candidate, emitter, radius);
      const penalty = overlapPenalty(candidate, radius, placed) + Math.abs(attempt - 2) * 0.12;
      if (penalty < bestPenalty) {
        best = candidate;
        bestPenalty = penalty;
        if (penalty < radius * 0.08) break;
      }
    }

    if (!best) {
      const base = edgeBasePoint(emitter.edge, rand(start, end), radius);
      best = { x: base.x + vectors.inward.x * radius * 0.4, y: base.y + vectors.inward.y * radius * 0.4 };
    }

    placed.push({ ...best, radius });
    relaxPlacements(emitter, placed, count <= 7 ? 5 : 8);
    return placed[placed.length - 1];
  }

  function relaxPlacements(emitter, placed, iterations) {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      for (let i = 0; i < placed.length; i += 1) {
        for (let j = i + 1; j < placed.length; j += 1) {
          const a = placed[i];
          const b = placed[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.max(0.01, Math.hypot(dx, dy));
          const allowedOverlap = 0.14 + Math.min(0.08, Math.abs(a.radius - b.radius) / Math.max(a.radius + b.radius, 1) * 0.18);
          const minDistance = (a.radius + b.radius) * (1 - allowedOverlap);
          if (distance >= minDistance) continue;
          const push = (minDistance - distance) * 0.54;
          const nx = dx / distance;
          const ny = dy / distance;
          const aWeight = b.radius / (a.radius + b.radius);
          const bWeight = a.radius / (a.radius + b.radius);
          a.x -= nx * push * aWeight;
          a.y -= ny * push * aWeight;
          b.x += nx * push * bWeight;
          b.y += ny * push * bWeight;
          clampPlacement(a, emitter, a.radius);
          clampPlacement(b, emitter, b.radius);
        }
      }
    }
  }

  function spawnBubbleString(pointer = null) {
    const mode = state.mode;
    const emitter = makeEmitter(mode, pointer);
    const count =
      mode === "corner"
        ? Math.round(rand(5, 9))
        : mode === "range"
          ? Math.round(rand(9, 14))
          : Math.round(rand(7, 11));
    const vectors = edgeVectors(emitter.edge);
    const placed = [];
    const paletteShift = Math.floor(rand(0, palette.length));
    const groupId = state.burstId++;

    for (let i = 0; i < count; i += 1) {
      const progress = count <= 1 ? 0.5 : i / (count - 1);
      const volume = naturalVolume(i, count);
      const radius = volumeToRadius(volume);
      const mass = volumeToMass(volume, radius);
      const placement = placeBubble(emitter, radius, progress, placed, count);
      const speed = rand(44, 86) * (1 + Math.min(0.28, radius / 160));
      const tangentDrift = (progress - 0.5) * rand(10, 34) + rand(-8, 8);
      const color = palette[(i + paletteShift) % palette.length];
      state.bubbles.push({
        x: placement.x,
        y: placement.y,
        radius,
        baseRadius: radius,
        volume,
        mass,
        invMass: 1 / mass,
        color,
        vx: vectors.inward.x * speed + vectors.tangent.x * tangentDrift,
        vy: vectors.inward.y * speed + vectors.tangent.y * tangentDrift - rand(0, 10),
        wobble: rand(0, tau),
        wobbleSpeed: rand(1.2, 2.4),
        age: 0,
        life: rand(6.5, 9.2),
        groupId,
        phase: rand(0, tau),
        pressure: 0,
        contactX: 0,
        contactY: 0,
        contactAngle: 0,
        squash: 0,
      });
    }

    state.emitters.push(emitter);
    if (state.bubbles.length > maxBubbles) {
      state.bubbles.splice(0, state.bubbles.length - maxBubbles);
    }
  }

  function resetBubbleContacts(bubbles) {
    state.contactPairs = 0;
    state.physicsActive = 0;
    for (const bubble of bubbles) {
      bubble.pressure = 0;
      bubble.contactX = 0;
      bubble.contactY = 0;
    }
  }

  function addBubbleContact(bubble, nx, ny, strength) {
    bubble.pressure += strength;
    bubble.contactX += nx * strength;
    bubble.contactY += ny * strength;
  }

  function buildCollisionGrid(bubbles) {
    const grid = new Map();
    const cells = [];

    for (let i = 0; i < bubbles.length; i += 1) {
      const bubble = bubbles[i];
      const cx = Math.floor(bubble.x / collisionCellSize);
      const cy = Math.floor(bubble.y / collisionCellSize);
      const key = `${cx}:${cy}`;
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
        cells.push({ cx, cy, bucket });
      }
      bucket.push(i);
    }

    return { grid, cells };
  }

  function solveBubblePair(a, b, dt, countContact) {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let distanceSq = dx * dx + dy * dy;
    let distance = Math.sqrt(distanceSq);
    let nx = 1;
    let ny = 0;

    if (distance > 0.0001) {
      nx = dx / distance;
      ny = dy / distance;
    } else {
      const angle = a.phase - b.phase || 0.73;
      nx = Math.cos(angle);
      ny = Math.sin(angle);
      distance = 0.01;
      distanceSq = distance * distance;
      dx = nx * distance;
      dy = ny * distance;
    }

    const radiusSum = a.baseRadius + b.baseRadius;
    const sizeDelta = Math.abs(a.baseRadius - b.baseRadius) / Math.max(radiusSum, 1);
    const allowedCompression = clamp(0.055 + sizeDelta * 0.035, 0.055, 0.09);
    const restDistance = radiusSum * (1 - allowedCompression);
    if (distanceSq >= restDistance * restDistance) return false;

    const overlap = restDistance - distance;
    const totalInvMass = a.invMass + b.invMass;
    if (totalInvMass <= 0) return false;

    const compression = overlap / Math.max(radiusSum, 1);
    const stiffness = clamp(0.42 + compression * 4.6, 0.42, collisionStiffness);
    const correction = (overlap * stiffness) / totalInvMass;
    a.x -= nx * correction * a.invMass;
    a.y -= ny * correction * a.invMass;
    b.x += nx * correction * b.invMass;
    b.y += ny * correction * b.invMass;

    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const normalVelocity = rvx * nx + rvy * ny;
    if (normalVelocity < 0) {
      const impulse = (-(1 + bubbleRestitution) * normalVelocity) / totalInvMass;
      a.vx -= nx * impulse * a.invMass;
      a.vy -= ny * impulse * a.invMass;
      b.vx += nx * impulse * b.invMass;
      b.vy += ny * impulse * b.invMass;
    }

    const tx = -ny;
    const ty = nx;
    const tangentVelocity = rvx * tx + rvy * ty;
    const tangentImpulse = (-tangentVelocity * collisionFriction) / totalInvMass;
    a.vx -= tx * tangentImpulse * a.invMass;
    a.vy -= ty * tangentImpulse * a.invMass;
    b.vx += tx * tangentImpulse * b.invMass;
    b.vy += ty * tangentImpulse * b.invMass;

    const pressure = compression * (1.2 + Math.min(0.8, overlap / 18));
    addBubbleContact(a, nx, ny, pressure);
    addBubbleContact(b, -nx, -ny, pressure);
    if (countContact) state.contactPairs += 1;
    return true;
  }

  function solveSoftWall(bubble, nx, ny, penetration) {
    if (penetration <= 0) return;
    const push = penetration * softWallStiffness;
    bubble.x += nx * push;
    bubble.y += ny * push;

    const normalVelocity = bubble.vx * nx + bubble.vy * ny;
    if (normalVelocity < 0) {
      bubble.vx -= nx * normalVelocity * 1.16;
      bubble.vy -= ny * normalVelocity * 1.16;
    }

    addBubbleContact(bubble, nx, ny, (penetration / Math.max(bubble.baseRadius, 1)) * 0.16);
  }

  function solveBubbleBounds(bubble) {
    const inset = bubble.baseRadius * 0.36;
    const minX = inset;
    const maxX = state.width - inset;
    const minY = inset;
    const maxY = state.height - inset;

    if (minX < maxX) {
      solveSoftWall(bubble, 1, 0, minX - bubble.x);
      solveSoftWall(bubble, -1, 0, bubble.x - maxX);
    }
    if (minY < maxY) {
      solveSoftWall(bubble, 0, 1, minY - bubble.y);
      solveSoftWall(bubble, 0, -1, bubble.y - maxY);
    }
  }

  function solveBubblePhysics(dt) {
    const bubbles = state.bubbles;
    resetBubbleContacts(bubbles);
    const activeBubbles = [];

    for (const bubble of bubbles) {
      if (bubble.age <= physicsLifetime) {
        activeBubbles.push(bubble);
      } else {
        bubble.squash += (0 - bubble.squash) * clamp(dt * 10, 0.08, 0.36);
      }
    }

    state.physicsActive = activeBubbles.length;
    if (activeBubbles.length < 2) {
      for (const bubble of activeBubbles) bubble.squash += (0 - bubble.squash) * clamp(dt * 10, 0.08, 0.36);
      return;
    }

    const neighborOffsets = [
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ];
    const iterations = activeBubbles.length > 64 ? collisionIterations - 1 : collisionIterations;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const { grid, cells } = buildCollisionGrid(activeBubbles);
      const countContact = iteration === 0;

      for (const cell of cells) {
        const bucket = cell.bucket;
        for (let a = 0; a < bucket.length; a += 1) {
          for (let b = a + 1; b < bucket.length; b += 1) {
            solveBubblePair(activeBubbles[bucket[a]], activeBubbles[bucket[b]], dt, countContact);
          }
        }

        for (const offset of neighborOffsets) {
          const neighbor = grid.get(`${cell.cx + offset[0]}:${cell.cy + offset[1]}`);
          if (!neighbor) continue;
          for (const ai of bucket) {
            for (const bi of neighbor) {
              solveBubblePair(activeBubbles[ai], activeBubbles[bi], dt, countContact);
            }
          }
        }
      }

      for (const bubble of activeBubbles) {
        solveBubbleBounds(bubble);
      }
    }

    for (const bubble of activeBubbles) {
      const contactLength = Math.hypot(bubble.contactX, bubble.contactY);
      if (contactLength > 0.0001) {
        bubble.contactAngle = Math.atan2(bubble.contactY, bubble.contactX);
      }
      const targetSquash = clamp(bubble.pressure * 0.95, 0, 0.17);
      bubble.squash += (targetSquash - bubble.squash) * clamp(dt * 24, 0.2, 0.72);
    }
  }

  function update(dt, now) {
    if (now >= state.nextBurstAt) {
      spawnBubbleString();
      state.nextBurstAt = now + rand(1180, 1780);
    }

    for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
      const bubble = state.bubbles[i];
      bubble.age += dt;
      bubble.wobble += bubble.wobbleSpeed * dt;
      bubble.vx *= 0.998;
      bubble.vy = bubble.vy * 0.998 - 2.5 * dt;
      bubble.x += (bubble.vx + Math.sin(bubble.wobble + bubble.phase) * bubble.baseRadius * 0.08) * dt;
      bubble.y += (bubble.vy + Math.cos(bubble.wobble * 0.8 + bubble.phase) * bubble.baseRadius * 0.05) * dt;
      bubble.radius = bubble.baseRadius * (1 + Math.sin(bubble.age * 3.1 + bubble.phase) * 0.018);
      if (
        bubble.age > bubble.life ||
        bubble.x < -bubble.radius * 4 ||
        bubble.x > state.width + bubble.radius * 4 ||
        bubble.y < -bubble.radius * 4 ||
        bubble.y > state.height + bubble.radius * 4
      ) {
        state.bubbles.splice(i, 1);
      }
    }

    solveBubblePhysics(dt);

    for (let i = state.emitters.length - 1; i >= 0; i -= 1) {
      if (now - state.emitters[i].born > state.emitters[i].life) {
        state.emitters.splice(i, 1);
      }
    }
  }

  function drawBackground(now) {
    const w = state.width;
    const h = state.height;
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#8fd0dc");
    gradient.addColorStop(0.52, "#4bb0c5");
    gradient.addColorStop(1, "#d98da4");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    const split = w * (0.48 + Math.sin(now * 0.00028) * 0.065);
    const pink = ctx.createRadialGradient(split - w * 0.18, h * 0.48, 8, split - w * 0.2, h * 0.48, Math.max(w, h) * 0.88);
    pink.addColorStop(0, "rgba(255, 156, 183, 0.76)");
    pink.addColorStop(0.72, "rgba(218, 105, 133, 0.5)");
    pink.addColorStop(1, "rgba(218, 105, 133, 0)");
    ctx.fillStyle = pink;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = "rgba(255,255,255,0.56)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let y = -20; y <= h + 20; y += 18) {
      const x = split + Math.sin(y * 0.018 + now * 0.0011) * w * 0.055;
      if (y === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawEmitters(now) {
    for (const emitter of state.emitters) {
      const t = clamp((now - emitter.born) / emitter.life, 0, 1);
      const alpha = (1 - t) * 0.28;
      const axis = edgeAxisLength(emitter.edge);
      const start = emitter.rangeStart * axis;
      const end = emitter.rangeEnd * axis;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      if (emitter.edge === "left") {
        ctx.moveTo(2, start);
        ctx.lineTo(2, end);
      } else if (emitter.edge === "right") {
        ctx.moveTo(state.width - 2, start);
        ctx.lineTo(state.width - 2, end);
      } else if (emitter.edge === "top") {
        ctx.moveTo(start, 2);
        ctx.lineTo(end, 2);
      } else {
        ctx.moveTo(start, state.height - 2);
        ctx.lineTo(end, state.height - 2);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBubble(bubble) {
    const r = bubble.radius;
    ctx.save();
    ctx.translate(bubble.x, bubble.y);
    ctx.rotate(bubble.contactAngle);
    ctx.scale(1 - bubble.squash, 1 + bubble.squash * 0.58);
    ctx.rotate(-bubble.contactAngle);
    ctx.rotate(Math.sin(bubble.wobble) * 0.05);
    ctx.scale(1 + Math.sin(bubble.wobble * 0.7) * 0.018, 1 - Math.sin(bubble.wobble * 0.7) * 0.014);

    const body = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.08, 0, 0, r * 1.08);
    body.addColorStop(0, "rgba(255,255,255,0.94)");
    body.addColorStop(0.22, bubble.color.rim);
    body.addColorStop(0.64, `${bubble.color.fill}a8`);
    body.addColorStop(1, `${bubble.color.deep}70`);

    ctx.shadowColor = `${bubble.color.deep}44`;
    ctx.shadowBlur = r * 0.28;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, tau);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.lineWidth = Math.max(1.2, r * 0.052);
    ctx.strokeStyle = "rgba(255,255,255,0.62)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, Math.PI * 0.16, Math.PI * 1.18);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.stroke();

    ctx.globalAlpha = 0.78;
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.36, r * 0.24, r * 0.08, -0.56, 0, tau);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(r * 0.3, r * 0.22, r * 0.13, 0, tau);
    ctx.fill();
    ctx.restore();
  }

  function draw(now) {
    drawBackground(now);
    drawEmitters(now);
    state.bubbles.forEach(drawBubble);
  }

  function updateLabels() {
    modeLabel.textContent = state.mode.toUpperCase();
    volumeLabel.textContent = state.volumeScale.toFixed(2);
    statsEl.textContent = `FPS ${Math.round(state.fps)}  bubbles ${state.bubbles.length}  physics ${state.physicsActive}  contacts ${state.contactPairs}`;
    modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === state.mode);
    });
  }

  function loop(now) {
    const elapsed = state.lastTime ? now - state.lastTime : targetFrameMs;
    if (elapsed < targetFrameMs - 1) {
      requestAnimationFrame(loop);
      return;
    }
    const dt = Math.min(0.05, elapsed / 1000);
    state.lastTime = now;
    update(dt, now);
    draw(now);

    state.frames += 1;
    if (!state.fpsAt) state.fpsAt = now;
    if (now - state.fpsAt >= 500) {
      state.fps = (state.frames * 1000) / (now - state.fpsAt);
      state.frames = 0;
      state.fpsAt = now;
      updateLabels();
    }
    requestAnimationFrame(loop);
  }

  function setMode(mode) {
    if (!modes.includes(mode)) return;
    state.mode = mode;
    updateLabels();
    spawnBubbleString();
    state.nextBurstAt = performance.now() + rand(900, 1300);
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  volumeScaleInput.addEventListener("input", () => {
    state.volumeScale = Number(volumeScaleInput.value) || 1;
    updateLabels();
  });

  burstButton.addEventListener("click", () => {
    spawnBubbleString();
    state.nextBurstAt = performance.now() + rand(900, 1300);
  });

  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    spawnBubbleString({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    state.nextBurstAt = performance.now() + rand(900, 1300);
  });

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    state.lastTime = performance.now();
  });

  resize();
  updateLabels();
  spawnBubbleString();
  state.nextBurstAt = performance.now() + 1200;
  requestAnimationFrame(loop);
})();
