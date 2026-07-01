(() => {
  "use strict";

  const LEVEL_SECONDS = 20;
  const TAU = Math.PI * 2;
  const fieldCanvas = document.createElement("canvas");
  const fieldCtx = fieldCanvas.getContext("2d", { alpha: false });

  const liquidPalette = {
    blue: [17, 158, 190],
    blueDeep: [7, 115, 153],
    blueLight: [147, 222, 231],
    pink: [255, 117, 138],
    pinkDeep: [203, 77, 101],
    pinkLight: [255, 186, 201],
    boundary: [43, 39, 86],
    boundaryLight: [233, 252, 255],
  };

  let width = 1;
  let height = 1;
  let lowWidth = 150;
  let lowHeight = 270;
  let imageData = null;
  let values = new Float32Array(lowWidth * lowHeight);
  let nxByX = new Float32Array(lowWidth);
  let nyByY = new Float32Array(lowHeight);
  let rowBlueR = new Float32Array(lowHeight);
  let rowBlueG = new Float32Array(lowHeight);
  let rowBlueB = new Float32Array(lowHeight);
  let rowLightSin = new Float32Array(lowHeight);
  let rowLightCos = new Float32Array(lowHeight);
  let rowShimmerSin = new Float32Array(lowHeight);
  let rowShimmerCos = new Float32Array(lowHeight);
  let colPinkR = new Float32Array(lowWidth);
  let colPinkG = new Float32Array(lowWidth);
  let colPinkB = new Float32Array(lowWidth);
  let colLightSin = new Float32Array(lowWidth);
  let colLightCos = new Float32Array(lowWidth);
  let colShimmerSin = new Float32Array(lowWidth);
  let colShimmerCos = new Float32Array(lowWidth);
  let renderedTime = Number.NaN;
  let qualityScale = 1;
  let frameStepSeconds = 1 / 60;
  let contoursEnabled = true;
  let contourSegments = new Float32Array(1024);
  let contourSegmentCount = 0;
  let contourRenderedTime = Number.NaN;
  const pixelColor = [0, 0, 0];

  const PATTERNS = {
    WAVE_CENTER: {
      type: "wave",
      angleStart: 0,
      angleEnd: 0.04,
      amp: 0.072,
      freq: 1.5,
      offsetAmp: 0.052,
      cycles: 0.95,
      scale: 1.08,
    },
    WAVE_TIDE: {
      type: "wave",
      angleStart: 0.04,
      angleEnd: 0.11,
      amp: 0.086,
      freq: 1.52,
      offsetAmp: 0.068,
      cycles: 0.98,
      scale: 1.04,
    },
    ROTATE_TOP_TO_SIDE: {
      type: "rotate",
      angleStart: Math.PI / 2,
      angleEnd: 0,
      amp: 0.075,
      freq: 1.45,
      offsetAmp: 0.04,
      cycles: 0.55,
      scale: 0.98,
    },
    ROTATE_SIDE_TO_DIAGONAL: {
      type: "rotate",
      angleStart: 0,
      angleEnd: -Math.PI / 3.2,
      amp: 0.095,
      freq: 1.7,
      offsetAmp: 0.055,
      cycles: 0.65,
      scale: 0.96,
    },
    ISLAND_PINK: {
      type: "island",
      sign: -1,
      baseAngle: -0.12,
      cornerX: 0.16,
      cornerY: 0.2,
      centerX: 0.51,
      centerY: 0.5,
      radius: 0.37,
      baseBias: 0.42,
    },
    ISLAND_BLUE: {
      type: "island",
      sign: 1,
      baseAngle: Math.PI / 2 + 0.12,
      cornerX: 0.84,
      cornerY: 0.78,
      centerX: 0.48,
      centerY: 0.52,
      radius: 0.37,
      baseBias: -0.42,
    },
    FOLD: {
      type: "fold",
      angleStart: -Math.PI / 4,
      amp: 0.072,
      freq: 1.55,
      phase: 0.2,
    },
    ORBIT: {
      type: "orbit",
      angleStart: 0.25,
      amp: 0.062,
      freq: 1.36,
      phase: 1.2,
    },
    BRAID: {
      type: "braid",
      angleStart: Math.PI / 2,
      amp: 0.078,
      freq: 1.55,
      phase: 2.4,
    },
  };

  const LEVEL_PATTERN_IDS = [
    "WAVE_CENTER",
    "WAVE_TIDE",
    "ROTATE_TOP_TO_SIDE",
    "ROTATE_SIDE_TO_DIAGONAL",
    "ISLAND_PINK",
    "ISLAND_BLUE",
    "FOLD",
    "ORBIT",
    "BRAID",
  ];
  const HIGH_PATTERN_IDS = ["ISLAND_PINK", "FOLD", "ISLAND_BLUE", "ORBIT", "BRAID"];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function ease01(value) {
    return smoothstep(0, 1, value);
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function blob(x, y, cx, cy, radius, power) {
    const dx = x - cx;
    const dy = y - cy;
    return Math.exp(-(dx * dx + dy * dy) / Math.max(0.001, radius * radius)) * power;
  }

  function ovalBlob(x, y, cx, cy, rx, ry, power) {
    const dx = (x - cx) / Math.max(0.001, rx);
    const dy = (y - cy) / Math.max(0.001, ry);
    return Math.exp(-(dx * dx + dy * dy)) * power;
  }

  function levelInfo(t) {
    const levelFloat = Math.max(0, t / LEVEL_SECONDS);
    const level = Math.max(1, Math.floor(levelFloat) + 1);
    const continuous = Math.max(1, 1 + levelFloat);
    const local = levelFloat - Math.floor(levelFloat);
    return { level, continuous, local };
  }

  function patternIdForLevel(level) {
    if (level <= LEVEL_PATTERN_IDS.length) return LEVEL_PATTERN_IDS[level - 1];
    return HIGH_PATTERN_IDS[(level - LEVEL_PATTERN_IDS.length - 1) % HIGH_PATTERN_IDS.length];
  }

  function buildFrameState(t) {
    const info = levelInfo(t);
    const pattern = PATTERNS[patternIdForLevel(info.level)];
    const nextPattern = PATTERNS[patternIdForLevel(info.level + 1)];
    let transitionStart = 0.66;
    if (pattern.type === "wave" && nextPattern.type === "wave") transitionStart = 0.42;
    if (pattern.type !== "island" && nextPattern.type === "island") transitionStart = 0.94;
    if (pattern.type === "island") transitionStart = 0.82;
    return {
      info,
      local: ease01(info.local),
      flow: t * 0.34,
      pattern,
      nextPattern,
      transition: smoothstep(transitionStart, 0.995, info.local),
    };
  }

  function splitAxisField(x, y, angle, offset, amp, freq, phase, scale = 1) {
    const dx = x - 0.5;
    const dy = y - 0.5;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const along = dx * -ny + dy * nx;
    const line = dx * nx + dy * ny - offset;
    const waveBody = along + 0.5;
    const ampLife =
      1 +
      Math.sin(waveBody * TAU * 0.74 + phase * 0.37) * 0.14 +
      Math.sin(waveBody * TAU * 1.18 - phase * 0.21) * 0.055;
    const liveAmp = amp * ampLife;
    const softDrift = Math.sin(waveBody * TAU * 0.42 + phase * 0.31) * amp * 0.12;
    const wave =
      Math.sin(waveBody * freq * TAU + phase) * liveAmp +
      Math.sin(waveBody * freq * TAU * 0.48 - phase * 0.62) * liveAmp * 0.2 +
      Math.sin(waveBody * freq * TAU * 1.72 + phase * 0.44) * amp * 0.045;
    return (line + softDrift + wave) * scale;
  }

  function flowWarp(x, y, flow, strength = 1) {
    const phase = flow * TAU;
    return {
      x:
        x +
        Math.sin(y * TAU * 0.82 + phase * 0.92) * 0.018 * strength +
        Math.sin((x + y) * TAU * 0.46 - phase * 0.66) * 0.012 * strength,
      y:
        y +
        Math.cos(x * TAU * 0.78 - phase * 0.78) * 0.0153 * strength +
        Math.sin((x - y) * TAU * 0.52 + phase * 0.58) * 0.009 * strength,
    };
  }

  function wavePatternField(x, y, local, flow, pattern) {
    const progress = ease01(local);
    const phase = flow * TAU * pattern.cycles + local * TAU * 0.12 + (pattern.phase || 0);
    const angle = mix(pattern.angleStart, pattern.angleEnd, progress) + Math.sin(flow * TAU * 0.18) * 0.012;
    const offset = Math.sin(flow * TAU * 0.72 + (pattern.phase || 0)) * pattern.offsetAmp;
    return splitAxisField(x, y, angle, offset, pattern.amp, pattern.freq, phase, pattern.scale);
  }

  function islandPosition(local, flow, pattern) {
    let travel = 0;
    if (local < 0.28) {
      travel = smoothstep(0.02, 0.28, local);
    } else if (local < 0.68) {
      travel = 1;
    } else {
      travel = 1 - smoothstep(0.7, 0.94, local);
    }
    const hold = smoothstep(0.18, 0.3, local) * (1 - smoothstep(0.68, 0.86, local));
    const breathe = Math.sin(flow * TAU * 0.92) * 0.018 * hold;
    return {
      x: mix(pattern.cornerX, pattern.centerX, travel) + breathe,
      y: mix(pattern.cornerY, pattern.centerY, travel) - breathe * 0.75,
      hold,
    };
  }

  function islandPatternField(x, y, local, flow, pattern) {
    const p = islandPosition(local, flow, pattern);
    const visible = 1 - smoothstep(0.96, 1, local);
    const base = pattern.baseBias + Math.sin(flow * TAU * 0.46) * 0.035;
    const radius = pattern.radius * (1 + Math.sin(flow * TAU * 0.72) * 0.035);
    const warpedX = x + Math.sin((y - p.y) * TAU * 0.72 + flow * TAU * 0.55) * 0.034;
    const warpedY = y + Math.cos((x - p.x) * TAU * 0.68 - flow * TAU * 0.48) * 0.03;
    const lobeA = Math.sin(flow * TAU * 0.38) * 0.065;
    const lobeB = Math.cos(flow * TAU * 0.31) * 0.058;
    const lobeC = Math.sin(flow * TAU * 0.27 + 1.6) * 0.05;
    const main = ovalBlob(warpedX, warpedY, p.x, p.y, radius * 1.04, radius * 0.78, 1.08);
    const topLobe = ovalBlob(warpedX, warpedY, p.x + lobeA, p.y - radius * 0.43, radius * 0.66, radius * 0.48, 0.55);
    const sideLobe = ovalBlob(warpedX, warpedY, p.x - radius * 0.47, p.y + lobeB, radius * 0.56, radius * 0.7, 0.47);
    const lowLobe = ovalBlob(warpedX, warpedY, p.x + radius * 0.34, p.y + radius * 0.4 + lobeC, radius * 0.62, radius * 0.45, 0.4);
    const biteA = ovalBlob(warpedX, warpedY, p.x + radius * 0.62, p.y - radius * 0.05, radius * 0.38, radius * 0.46, 0.14);
    const biteB = ovalBlob(warpedX, warpedY, p.x - radius * 0.1, p.y + radius * 0.65, radius * 0.42, radius * 0.34, 0.12);
    const surround = ovalBlob(warpedX, warpedY, p.x, p.y, radius * 1.95, radius * 1.58, 0.38);
    return base + pattern.sign * visible * (main + topLobe + sideLobe + lowLobe - biteA - biteB - surround);
  }

  function foldPatternField(x, y, local, flow, pattern) {
    const phase = flow * TAU * 0.32 + pattern.phase;
    const close = Math.sin(local * Math.PI);
    const base = splitAxisField(x, y, pattern.angleStart + Math.sin(phase) * 0.075, 0, pattern.amp, pattern.freq, phase, 0.56);
    return (
      base +
      blob(x, y, mix(0.18, 0.43, close), mix(0.22, 0.5, close), 0.5, 0.48) +
      blob(x, y, 0.68 - close * 0.1, 0.18 + close * 0.18, 0.56, 0.3) -
      blob(x, y, mix(0.82, 0.57, close), mix(0.78, 0.5, close), 0.5, 0.48) -
      blob(x, y, 0.32 + close * 0.1, 0.82 - close * 0.18, 0.56, 0.3)
    );
  }

  function orbitPatternField(x, y, local, flow, pattern) {
    const phase = flow * TAU * 0.28 + pattern.phase;
    const base = splitAxisField(x, y, pattern.angleStart + Math.sin(phase * 0.5) * 0.085, 0, pattern.amp, pattern.freq, phase * 0.4, 0.44);
    return (
      base +
      blob(x, y, 0.5 + Math.cos(phase) * 0.16, 0.5 + Math.sin(phase) * 0.2, 0.54, 0.76) -
      blob(x, y, 0.5 + Math.cos(phase + Math.PI) * 0.16, 0.5 + Math.sin(phase + Math.PI) * 0.2, 0.54, 0.76)
    );
  }

  function braidPatternField(x, y, local, flow, pattern) {
    const phase = flow * TAU * 0.26 + pattern.phase;
    const base = splitAxisField(x, y, pattern.angleStart + Math.sin(phase * 0.45) * 0.16, Math.sin(phase * 0.5) * 0.014, pattern.amp, pattern.freq, phase * 0.48, 0.52);
    return (
      base +
      ovalBlob(x, y, 0.3 + Math.sin(phase) * 0.055, 0.26 + local * 0.22, 0.5, 0.35, 0.4) +
      ovalBlob(x, y, 0.68 + Math.sin(phase + 1.7) * 0.05, 0.8 - local * 0.22, 0.46, 0.35, 0.32) -
      ovalBlob(x, y, 0.7 + Math.sin(phase + Math.PI) * 0.055, 0.28 + local * 0.22, 0.5, 0.35, 0.4) -
      ovalBlob(x, y, 0.32 + Math.sin(phase + 4.4) * 0.05, 0.78 - local * 0.22, 0.46, 0.35, 0.32)
    );
  }

  function patternField(x, y, local, flow, pattern) {
    if (pattern.type === "island") return islandPatternField(x, y, local, flow, pattern);
    if (pattern.type === "fold") return foldPatternField(x, y, local, flow, pattern);
    if (pattern.type === "orbit") return orbitPatternField(x, y, local, flow, pattern);
    if (pattern.type === "braid") return braidPatternField(x, y, local, flow, pattern);
    return wavePatternField(x, y, local, flow, pattern);
  }

  function liquidField(x, y, frameState) {
    const warped = flowWarp(x, y, frameState.flow, frameState.pattern.type === "wave" ? 1.15 : 0.85);
    const current = patternField(warped.x, warped.y, frameState.local, frameState.flow, frameState.pattern);
    if (frameState.transition <= 0) return current;
    return mix(current, patternField(warped.x, warped.y, 0, frameState.flow, frameState.nextPattern), frameState.transition);
  }

  function resize(nextWidth, nextHeight) {
    width = Math.max(1, nextWidth || 1);
    height = Math.max(1, nextHeight || 1);
    lowWidth = Math.round(clamp((width / 3.35) * qualityScale, 78, 174));
    lowHeight = Math.round(clamp((height / 3.35) * qualityScale, 132, 310));
    fieldCanvas.width = lowWidth;
    fieldCanvas.height = lowHeight;
    imageData = fieldCtx.createImageData(lowWidth, lowHeight);
    values = new Float32Array(lowWidth * lowHeight);
    nxByX = new Float32Array(lowWidth);
    nyByY = new Float32Array(lowHeight);
    rowBlueR = new Float32Array(lowHeight);
    rowBlueG = new Float32Array(lowHeight);
    rowBlueB = new Float32Array(lowHeight);
    rowLightSin = new Float32Array(lowHeight);
    rowLightCos = new Float32Array(lowHeight);
    rowShimmerSin = new Float32Array(lowHeight);
    rowShimmerCos = new Float32Array(lowHeight);
    colPinkR = new Float32Array(lowWidth);
    colPinkG = new Float32Array(lowWidth);
    colPinkB = new Float32Array(lowWidth);
    colLightSin = new Float32Array(lowWidth);
    colLightCos = new Float32Array(lowWidth);
    colShimmerSin = new Float32Array(lowWidth);
    colShimmerCos = new Float32Array(lowWidth);
    for (let x = 0; x < lowWidth; x += 1) nxByX[x] = x / Math.max(1, lowWidth - 1);
    for (let y = 0; y < lowHeight; y += 1) nyByY[y] = y / Math.max(1, lowHeight - 1);
    renderedTime = Number.NaN;
    contourSegmentCount = 0;
    contourRenderedTime = Number.NaN;
  }

  function updateShadeCaches(t) {
    const lightPhase = t * 0.7;
    const shimmerPhase = t * 1.6;
    for (let y = 0; y < lowHeight; y += 1) {
      const ny = nyByY[y];
      const blueMix = 0.28 + 0.22 * Math.sin(ny * 5.6 + t);
      rowBlueR[y] = mix(liquidPalette.blueDeep[0], liquidPalette.blueLight[0], blueMix);
      rowBlueG[y] = mix(liquidPalette.blueDeep[1], liquidPalette.blueLight[1], blueMix);
      rowBlueB[y] = mix(liquidPalette.blueDeep[2], liquidPalette.blueLight[2], blueMix);
      rowLightSin[y] = Math.sin(ny * 3.4);
      rowLightCos[y] = Math.cos(ny * 3.4);
      rowShimmerSin[y] = Math.sin(ny * 15);
      rowShimmerCos[y] = Math.cos(ny * 15);
    }
    for (let x = 0; x < lowWidth; x += 1) {
      const nx = nxByX[x];
      const pinkMix = 0.32 + 0.2 * Math.cos(nx * 5.1 - t * 0.7);
      colPinkR[x] = mix(liquidPalette.pinkDeep[0], liquidPalette.pinkLight[0], pinkMix);
      colPinkG[x] = mix(liquidPalette.pinkDeep[1], liquidPalette.pinkLight[1], pinkMix);
      colPinkB[x] = mix(liquidPalette.pinkDeep[2], liquidPalette.pinkLight[2], pinkMix);
      colLightSin[x] = Math.sin(nx * 6.2 + lightPhase);
      colLightCos[x] = Math.cos(nx * 6.2 + lightPhase);
      colShimmerSin[x] = Math.sin(nx * 15 + shimmerPhase);
      colShimmerCos[x] = Math.cos(nx * 15 + shimmerPhase);
    }
  }

  function shadePixel(field, x, y, band) {
    const amount = smoothstep(-band, band, field);
    let r = mix(colPinkR[x], rowBlueR[y], amount);
    let g = mix(colPinkG[x], rowBlueG[y], amount);
    let b = mix(colPinkB[x], rowBlueB[y], amount);
    const boundary = Math.exp(-Math.abs(field) / 0.032);
    const hardLine = Math.exp(-Math.abs(field) / 0.013);
    const shimmer = 0.5 + (colShimmerSin[x] * rowShimmerCos[y] + colShimmerCos[x] * rowShimmerSin[y]) * 0.5;
    const boundaryMix = boundary * 0.1;
    r = mix(r, liquidPalette.boundary[0], boundaryMix);
    g = mix(g, liquidPalette.boundary[1], boundaryMix);
    b = mix(b, liquidPalette.boundary[2], boundaryMix);
    const lineMix = hardLine * (0.12 + shimmer * 0.04);
    r = mix(r, liquidPalette.boundaryLight[0], lineMix);
    g = mix(g, liquidPalette.boundaryLight[1], lineMix);
    b = mix(b, liquidPalette.boundaryLight[2], lineMix);
    const cleanLight = 0.94 + 0.055 * (colLightSin[x] * rowLightCos[y] + colLightCos[x] * rowLightSin[y]);
    pixelColor[0] = clamp(r * cleanLight, 0, 255);
    pixelColor[1] = clamp(g * cleanLight, 0, 255);
    pixelColor[2] = clamp(b * cleanLight, 0, 255);
    return pixelColor;
  }

  function updateFrame(t) {
    if (!imageData) resize(width, height);
    const data = imageData.data;
    const frameState = buildFrameState(t);
    const band = 0.078 + Math.sin(t * 0.34) * 0.006;
    updateShadeCaches(t);
    let offset = 0;
    for (let y = 0; y < lowHeight; y += 1) {
      const ny = nyByY[y];
      for (let x = 0; x < lowWidth; x += 1) {
        const field = liquidField(nxByX[x], ny, frameState);
        values[y * lowWidth + x] = field;
        const color = shadePixel(field, x, y, band);
        data[offset] = color[0];
        data[offset + 1] = color[1];
        data[offset + 2] = color[2];
        data[offset + 3] = 255;
        offset += 4;
      }
    }
    fieldCtx.putImageData(imageData, 0, 0);
    renderedTime = t;
  }

  function quantizeTime(t) {
    const safeTime = Number.isFinite(t) ? Math.max(0, t) : 0;
    const step = Math.max(1 / 60, frameStepSeconds);
    return Math.floor(safeTime / step) * step;
  }

  function ensureFrame(t) {
    const frameTime = quantizeTime(t);
    if (!Number.isFinite(renderedTime) || Math.abs(renderedTime - frameTime) > 0.001) {
      updateFrame(frameTime);
    }
    return renderedTime;
  }

  function valueAtGrid(x, y) {
    return values[y * lowWidth + x];
  }

  function sampleField(x, y, t) {
    ensureFrame(t);
    const gx = clamp(x / Math.max(1, width), 0, 1) * (lowWidth - 1);
    const gy = clamp(y / Math.max(1, height), 0, 1) * (lowHeight - 1);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(lowWidth - 1, x0 + 1);
    const y1 = Math.min(lowHeight - 1, y0 + 1);
    const tx = gx - x0;
    const ty = gy - y0;
    const a = mix(valueAtGrid(x0, y0), valueAtGrid(x1, y0), tx);
    const b = mix(valueAtGrid(x0, y1), valueAtGrid(x1, y1), tx);
    return mix(a, b, ty);
  }

  function pushContourSegment(ax, ay, bx, by) {
    const offset = contourSegmentCount * 4;
    if (offset + 4 > contourSegments.length) {
      const next = new Float32Array(contourSegments.length * 2);
      next.set(contourSegments);
      contourSegments = next;
    }
    contourSegments[offset] = ax;
    contourSegments[offset + 1] = ay;
    contourSegments[offset + 2] = bx;
    contourSegments[offset + 3] = by;
    contourSegmentCount += 1;
  }

  function collectContourSegments() {
    contourSegmentCount = 0;
    const sx = width / lowWidth;
    const sy = height / lowHeight;
    for (let y = 0; y < lowHeight - 1; y += 1) {
      for (let x = 0; x < lowWidth - 1; x += 1) {
        const v0 = valueAtGrid(x, y);
        const v1 = valueAtGrid(x + 1, y);
        const v2 = valueAtGrid(x + 1, y + 1);
        const v3 = valueAtGrid(x, y + 1);
        let px0 = 0;
        let py0 = 0;
        let px1 = 0;
        let py1 = 0;
        let px2 = 0;
        let py2 = 0;
        let px3 = 0;
        let py3 = 0;
        let pointCount = 0;
        if ((v0 < 0) !== (v1 < 0)) {
          const a = Math.abs(v0) / Math.max(0.0001, Math.abs(v0) + Math.abs(v1));
          px0 = (x + a) * sx;
          py0 = y * sy;
          pointCount = 1;
        }
        if ((v1 < 0) !== (v2 < 0)) {
          const a = Math.abs(v1) / Math.max(0.0001, Math.abs(v1) + Math.abs(v2));
          if (pointCount === 0) {
            px0 = (x + 1) * sx;
            py0 = (y + a) * sy;
          } else if (pointCount === 1) {
            px1 = (x + 1) * sx;
            py1 = (y + a) * sy;
          } else {
            px2 = (x + 1) * sx;
            py2 = (y + a) * sy;
          }
          pointCount += 1;
        }
        if ((v3 < 0) !== (v2 < 0)) {
          const a = Math.abs(v3) / Math.max(0.0001, Math.abs(v3) + Math.abs(v2));
          if (pointCount === 0) {
            px0 = (x + a) * sx;
            py0 = (y + 1) * sy;
          } else if (pointCount === 1) {
            px1 = (x + a) * sx;
            py1 = (y + 1) * sy;
          } else if (pointCount === 2) {
            px2 = (x + a) * sx;
            py2 = (y + 1) * sy;
          } else {
            px3 = (x + a) * sx;
            py3 = (y + 1) * sy;
          }
          pointCount += 1;
        }
        if ((v0 < 0) !== (v3 < 0)) {
          const a = Math.abs(v0) / Math.max(0.0001, Math.abs(v0) + Math.abs(v3));
          if (pointCount === 0) {
            px0 = x * sx;
            py0 = (y + a) * sy;
          } else if (pointCount === 1) {
            px1 = x * sx;
            py1 = (y + a) * sy;
          } else if (pointCount === 2) {
            px2 = x * sx;
            py2 = (y + a) * sy;
          } else {
            px3 = x * sx;
            py3 = (y + a) * sy;
          }
          pointCount += 1;
        }
        if (pointCount === 2) {
          pushContourSegment(px0, py0, px1, py1);
        } else if (pointCount === 4) {
          pushContourSegment(px0, py0, px1, py1);
          pushContourSegment(px2, py2, px3, py3);
        }
      }
    }
  }

  function strokeSegments(ctx, color, lineWidth, dash = null, dashOffset = 0) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (dash) {
      ctx.setLineDash(dash);
      ctx.lineDashOffset = dashOffset;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (let i = 0; i < contourSegmentCount; i += 1) {
      const offset = i * 4;
      ctx.moveTo(contourSegments[offset], contourSegments[offset + 1]);
      ctx.lineTo(contourSegments[offset + 2], contourSegments[offset + 3]);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawContours(ctx, t) {
    if (!contoursEnabled) return;
    if (!Number.isFinite(contourRenderedTime) || Math.abs(contourRenderedTime - renderedTime) > 0.001) {
      collectContourSegments();
      contourRenderedTime = renderedTime;
    }
    if (!contourSegmentCount) return;
    strokeSegments(ctx, "rgba(29, 35, 72, 0.22)", qualityScale < 0.7 ? 1.7 : 2);
    strokeSegments(ctx, "rgba(246, 253, 255, 0.44)", qualityScale < 0.7 ? 0.82 : 1);
    strokeSegments(ctx, "rgba(255, 190, 210, 0.16)", 0.45);
  }

  function setQuality(options = {}) {
    const nextScale = clamp(Number(options.scale ?? options.quality ?? qualityScale), 0.42, 1);
    const frameFps = clamp(Number(options.fps ?? options.frameFps ?? 60), 24, 60);
    const frameSkip = clamp(Math.round(Number(options.frameSkip ?? 1)), 1, 5);
    const nextFrameStep = (1 / frameFps) * frameSkip;
    const nextContoursEnabled = options.contours !== false;
    const scaleChanged = Math.abs(nextScale - qualityScale) > 0.01;
    const timingChanged = Math.abs(nextFrameStep - frameStepSeconds) > 0.001;
    const contourChanged = nextContoursEnabled !== contoursEnabled;
    qualityScale = nextScale;
    frameStepSeconds = nextFrameStep;
    contoursEnabled = nextContoursEnabled;
    if (scaleChanged) {
      resize(width, height);
    } else if (timingChanged || contourChanged) {
      renderedTime = Number.NaN;
      contourSegmentCount = 0;
      contourRenderedTime = Number.NaN;
    }
  }

  function render(ctx, t, nextWidth = width, nextHeight = height, options = null) {
    if (options) {
      setQuality(options);
    }
    if (Math.abs(nextWidth - width) > 0.5 || Math.abs(nextHeight - height) > 0.5 || !imageData) {
      resize(nextWidth, nextHeight);
    }
    const frameTime = ensureFrame(t);
    ctx.drawImage(fieldCanvas, 0, 0, width, height);
    drawContours(ctx, frameTime);
  }

  function colorIndexAt(x, y, t) {
    return sampleField(x, y, t) >= 0 ? 0 : 1;
  }

  function mixAt(x, y, t) {
    return 1 - smoothstep(-0.078, 0.078, sampleField(x, y, t));
  }

  window.PaopaoBackgroundEngine = {
    resize,
    setQuality,
    render,
    colorIndexAt,
    mixAt,
    fieldAt: sampleField,
    levelAt: (t) => levelInfo(t).level,
  };
})();
