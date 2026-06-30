(() => {
  "use strict";

  const storageKey = "paopao.customBubblePack.v1";
  const schema = "paopao-bubble-pack@1";
  const edgeCycle = ["left", "right", "top", "bottom"];
  const colors = {
    blue: { color: "#6eafc0", deep: "#3f7f91", light: "#cbe8ef" },
    pink: { color: "#d8899d", deep: "#a05f73", light: "#f0c7d3" },
    ink: "#183240",
  };

  const $ = (selector) => document.querySelector(selector);
  const canvas = $("#previewCanvas");
  const ctx = canvas.getContext("2d");
  const templateInputs = [...document.querySelectorAll("[data-template]")];
  const sliderInputs = [...document.querySelectorAll("[data-slider]")];
  const sliderOutputs = [...document.querySelectorAll("[data-slider-value]")];
  const packControls = {
    name: $("#packName"),
    description: $("#packDescription"),
    minLevel: $("#spawnMinLevel"),
    chance: $("#spawnChance"),
    intervalMin: $("#intervalMin"),
    intervalMax: $("#intervalMax"),
    maxActive: $("#maxActive"),
  };

  const defaultPack = {
    schema,
    name: "Soft rhythm bubbles",
    description: "带随机性的开发者泡泡组合。",
    spawn: {
      minLevel: 1,
      chance: 0.78,
      intervalMs: [440, 880],
      maxActive: 9,
    },
    bubbles: [
      {
        id: "slow-arc",
        label: "慢弧大泡",
        weight: 1.1,
        levelMin: 1,
        levelMax: 99,
        count: [1, 1],
        spacingMs: [90, 130],
        size: [42, 58],
        speed: [38, 64],
        tapCount: 1,
        holdMs: 0,
        edge: "bottom",
        lane: [0.18, 0.82],
        aimX: [0.22, 0.78],
        aimY: [0.12, 0.38],
        trajectory: "arc",
        amplitude: [4, 12],
        frequency: [1.2, 2.0],
        arcBend: [-58, 58],
        arcLife: [2.4, 3.8],
        colorMode: "auto",
        path: {
          mode: "points",
          curve: 0.78,
          points: [
            { x: 0.5, y: 0.98 },
            { x: 0.45, y: 0.76 },
            { x: 0.56, y: 0.54 },
            { x: 0.5, y: 0.28 },
          ],
        },
      },
      {
        id: "double-tap",
        label: "双击小泡",
        weight: 0.85,
        levelMin: 2,
        levelMax: 99,
        count: [2, 3],
        spacingMs: [80, 150],
        size: [24, 32],
        speed: [76, 116],
        tapCount: 2,
        holdMs: 0,
        edge: "random",
        lane: [0.24, 0.76],
        aimX: [0.25, 0.75],
        aimY: [0.24, 0.76],
        trajectory: "softS",
        amplitude: [8, 18],
        frequency: [1.8, 3.0],
        arcBend: [-24, 24],
        arcLife: [1.8, 3.0],
        colorMode: "auto",
      },
      {
        id: "hold-line",
        label: "按住泡",
        weight: 0.5,
        levelMin: 4,
        levelMax: 99,
        count: [1, 1],
        spacingMs: [70, 120],
        size: [36, 48],
        speed: [36, 58],
        tapCount: 0,
        holdMs: 680,
        edge: "left",
        lane: [0.26, 0.72],
        aimX: [0.62, 0.88],
        aimY: [0.22, 0.76],
        trajectory: "straight",
        amplitude: [0, 4],
        frequency: [1, 1.6],
        arcBend: [0, 0],
        arcLife: [2.4, 3.2],
        colorMode: "background",
        path: {
          mode: "draw",
          curve: 0.9,
          points: [
            { x: 0.08, y: 0.38 },
            { x: 0.22, y: 0.34 },
            { x: 0.38, y: 0.44 },
            { x: 0.58, y: 0.4 },
            { x: 0.82, y: 0.52 },
          ],
        },
      },
      {
        id: "s-group",
        label: "小 S 组",
        weight: 0.8,
        levelMin: 3,
        levelMax: 99,
        count: [3, 4],
        spacingMs: [70, 110],
        size: [22, 34],
        speed: [64, 98],
        tapCount: 1,
        holdMs: 0,
        edge: "right",
        lane: [0.2, 0.82],
        aimX: [0.12, 0.45],
        aimY: [0.18, 0.84],
        trajectory: "sGroup",
        amplitude: [14, 28],
        frequency: [2.1, 3.4],
        arcBend: [-36, 36],
        arcLife: [1.7, 2.8],
        colorMode: "random",
      },
    ],
  };

  let pack = normalizePack(readStoredPack() || defaultPack);
  let selectedId = pack.bubbles[0]?.id || "";
  let statusTimer = 0;
  let drawMode = "preview";
  let isDrawingPath = false;
  let activePointIndex = -1;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeRange(value, fallback, min, max) {
    const source = Array.isArray(value) ? value : [value, value];
    const fallbackSource = Array.isArray(fallback) ? fallback : [fallback, fallback];
    const a = clamp(number(source[0], fallbackSource[0]), min, max);
    const b = clamp(number(source[1], fallbackSource[1] ?? fallbackSource[0]), min, max);
    return [Math.min(a, b), Math.max(a, b)];
  }

  function simplifyPath(points, maxPoints = 72) {
    const clean = points
      .map((point) => ({ x: clamp(number(point?.x, 0), 0, 1), y: clamp(number(point?.y, 0), 0, 1) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (clean.length <= maxPoints) return clean;
    const result = [clean[0]];
    const step = (clean.length - 1) / (maxPoints - 2);
    for (let index = 1; index < maxPoints - 1; index += 1) {
      result.push(clean[Math.round(index * step)]);
    }
    result.push(clean[clean.length - 1]);
    return result;
  }

  function normalizePath(path) {
    if (!path || typeof path !== "object") {
      return { mode: "auto", points: [], curve: 0.68 };
    }
    const points = simplifyPath(Array.isArray(path.points) ? path.points : []);
    const rawCurve = number(path.curve ?? path.smoothness, 0.68);
    return {
      mode: points.length > 0 ? (path.mode === "draw" ? "draw" : "points") : "auto",
      points,
      curve: clamp(rawCurve, 0, 1),
    };
  }

  function normalizeTemplate(template, index) {
    return {
      id: String(template.id || `bubble-${Date.now()}-${index}`),
      label: String(template.label || `泡泡 ${index + 1}`).slice(0, 28),
      weight: clamp(number(template.weight, 1), 0.05, 20),
      levelMin: clamp(Math.round(number(template.levelMin, 1)), 1, 99),
      levelMax: clamp(Math.round(number(template.levelMax, 99)), 1, 99),
      count: normalizeRange(template.count, [1, 1], 1, 8),
      spacingMs: normalizeRange(template.spacingMs, [70, 130], 0, 1400),
      size: normalizeRange(template.size, [30, 44], 14, 86),
      speed: normalizeRange(template.speed, [48, 82], 8, 260),
      tapCount: clamp(Math.round(number(template.tapCount, 1)), 0, 9),
      holdMs: clamp(Math.round(number(template.holdMs, 0)), 0, 5000),
      edge: edgeCycle.includes(template.edge) ? template.edge : template.edge === "random" ? "random" : "random",
      lane: normalizeRange(template.lane, [0.22, 0.78], 0.08, 0.92),
      aimX: normalizeRange(template.aimX, [0.3, 0.7], 0.05, 0.95),
      aimY: normalizeRange(template.aimY, [0.24, 0.76], 0.05, 0.95),
      trajectory: ["straight", "softS", "arc", "zigzag", "spray", "fan", "sGroup", "arcDuo"].includes(template.trajectory)
        ? template.trajectory
        : "straight",
      amplitude: normalizeRange(template.amplitude, [0, 12], 0, 64),
      frequency: normalizeRange(template.frequency, [1.4, 2.6], 0.4, 8),
      arcBend: normalizeRange(template.arcBend, [0, 0], -110, 110),
      arcLife: normalizeRange(template.arcLife, [2.1, 3.2], 0.5, 8),
      colorMode: ["auto", "random", "background", "left", "right"].includes(template.colorMode) ? template.colorMode : "auto",
      path: normalizePath(template.path),
    };
  }

  function normalizePack(source) {
    const raw = source && typeof source === "object" ? source : defaultPack;
    const bubbles = (Array.isArray(raw.bubbles) ? raw.bubbles : defaultPack.bubbles).map(normalizeTemplate);
    return {
      schema,
      name: String(raw.name || defaultPack.name).slice(0, 40),
      description: String(raw.description || "").slice(0, 160),
      spawn: {
        minLevel: clamp(Math.round(number(raw.spawn?.minLevel, 1)), 1, 99),
        chance: clamp(number(raw.spawn?.chance, 0.72), 0, 1),
        intervalMs: normalizeRange(raw.spawn?.intervalMs, [520, 920], 160, 2400),
        maxActive: clamp(Math.round(number(raw.spawn?.maxActive, 10)), 1, 10),
      },
      bubbles: bubbles.length ? bubbles : defaultPack.bubbles.map(normalizeTemplate),
    };
  }

  function readStoredPack() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function selectedTemplate() {
    return pack.bubbles.find((template) => template.id === selectedId) || pack.bubbles[0];
  }

  function valueAtPath(target, path) {
    return path.split(".").reduce((value, key) => value?.[key], target);
  }

  function setValueAtPath(target, path, value) {
    const parts = path.split(".");
    let cursor = target;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index];
      cursor[key] = Array.isArray(cursor[key]) ? [...cursor[key]] : cursor[key] || {};
      cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
  }

  function syncPackControls() {
    packControls.name.value = pack.name;
    packControls.description.value = pack.description;
    packControls.minLevel.value = pack.spawn.minLevel;
    packControls.chance.value = pack.spawn.chance;
    packControls.intervalMin.value = pack.spawn.intervalMs[0];
    packControls.intervalMax.value = pack.spawn.intervalMs[1];
    packControls.maxActive.value = pack.spawn.maxActive;
  }

  function readPackControls() {
    pack.name = packControls.name.value.trim() || "Custom bubble pack";
    pack.description = packControls.description.value.trim();
    pack.spawn.minLevel = clamp(Math.round(number(packControls.minLevel.value, 1)), 1, 99);
    pack.spawn.chance = clamp(number(packControls.chance.value, 0.72), 0, 1);
    pack.spawn.intervalMs = normalizeRange([packControls.intervalMin.value, packControls.intervalMax.value], [520, 920], 160, 2400);
    pack.spawn.maxActive = clamp(Math.round(number(packControls.maxActive.value, 10)), 1, 10);
    syncPackControls();
    refresh();
  }

  function syncTemplateForm() {
    const template = selectedTemplate();
    if (!template) return;
    templateInputs.forEach((input) => {
      const value = valueAtPath(template, input.dataset.template);
      input.value = value ?? "";
    });
    syncQuickSliders();
  }

  function spreadRange(value, ratio, min, max, integer = false) {
    const low = clamp(value * (1 - ratio), min, max);
    const high = clamp(value * (1 + ratio), min, max);
    return integer ? [Math.round(low), Math.round(high)] : [Number(low.toFixed(2)), Number(high.toFixed(2))];
  }

  function syncQuickSliders() {
    const template = selectedTemplate();
    if (!template) return;
    const sliderValues = {
      size: Math.round(mid(template.size)),
      speed: Math.round(mid(template.speed)),
      count: Math.round(mid(template.count)),
      tapCount: template.tapCount,
      holdMs: template.holdMs,
      amplitude: Math.round(mid(template.amplitude)),
      pathCurve: Math.round((template.path?.curve ?? 0.68) * 100),
      weight: template.weight,
    };
    sliderInputs.forEach((input) => {
      input.value = sliderValues[input.dataset.slider] ?? input.value;
    });
    sliderOutputs.forEach((output) => {
      const key = output.dataset.sliderValue;
      const value = sliderValues[key];
      output.value = key === "weight" ? Number(value).toFixed(2) : key === "holdMs" ? `${value}ms` : key === "pathCurve" ? `${value}%` : String(value);
      output.textContent = output.value;
    });
  }

  function updateTemplateFromSlider(input) {
    const template = selectedTemplate();
    if (!template) return;
    const key = input.dataset.slider;
    const value = number(input.value, 0);
    if (key === "size") template.size = spreadRange(value, 0.16, 14, 86);
    if (key === "speed") template.speed = spreadRange(value, 0.18, 8, 260);
    if (key === "count") template.count = [Math.round(value), Math.round(value)];
    if (key === "tapCount") template.tapCount = Math.round(value);
    if (key === "holdMs") template.holdMs = Math.round(value);
    if (key === "amplitude") template.amplitude = spreadRange(value, 0.24, 0, 64);
    if (key === "pathCurve") template.path = normalizePath({ ...(template.path || {}), curve: value / 100 });
    if (key === "weight") template.weight = Number(value.toFixed(2));
    const index = pack.bubbles.indexOf(template);
    pack.bubbles[index] = normalizeTemplate(template, index);
    selectedId = pack.bubbles[index].id;
    syncTemplateForm();
    refresh();
  }

  function readTemplateInput(input) {
    const template = selectedTemplate();
    if (!template) return;
    const value = input.type === "number" ? number(input.value, 0) : input.value;
    setValueAtPath(template, input.dataset.template, value);
    const index = pack.bubbles.indexOf(template);
    pack.bubbles[index] = normalizeTemplate(template, index);
    selectedId = pack.bubbles[index].id;
    syncTemplateForm();
    refresh();
  }

  function renderTemplateList() {
    const list = $("#templateList");
    list.replaceChildren(
      ...pack.bubbles.map((template) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `template-card${template.id === selectedId ? " active" : ""}`;
        button.innerHTML = `
          <strong>${escapeHtml(template.label)}</strong>
          <span>w ${template.weight.toFixed(2)}</span>
          <span>Lv ${template.levelMin}-${template.levelMax}</span>
          <span>${template.path?.points?.length >= 2 ? `${template.path.mode} ${Math.round((template.path.curve ?? 0.68) * 100)}%` : template.trajectory}</span>
        `;
        button.addEventListener("click", () => {
          selectedId = template.id;
          refresh();
        });
        return button;
      }),
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function refresh() {
    pack = normalizePack(pack);
    if (!pack.bubbles.some((template) => template.id === selectedId)) {
      selectedId = pack.bubbles[0]?.id || "";
    }
    renderTemplateList();
    syncTemplateForm();
    updateJsonOutput();
    $("#previewName").textContent = pack.name;
    $("#previewMeta").textContent = `${pack.bubbles.length} templates · ${(pack.spawn.chance * 100).toFixed(0)}%`;
  }

  function updateJsonOutput() {
    $("#jsonOutput").value = JSON.stringify(pack, null, 2);
  }

  function setStatus(message) {
    window.clearTimeout(statusTimer);
    $("#statusLine").textContent = message;
    statusTimer = window.setTimeout(() => {
      $("#statusLine").textContent = "READY";
    }, 2200);
  }

  function setDrawMode(mode) {
    drawMode = mode;
    activePointIndex = -1;
    isDrawingPath = false;
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
    const hints = {
      preview: "预览模式：只看组合运动。切到点路径或手绘后可直接在手机画布上编辑。",
      points: "点路径：在手机画布上连续点几个位置，泡泡会沿这些点移动。",
      draw: "手绘：按住并拖动，画出泡泡移动轨迹。",
    };
    $("#drawHint").textContent = hints[mode] || hints.preview;
  }

  function canvasPointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
    };
  }

  function currentPathPoints() {
    return [...(selectedTemplate()?.path?.points || [])];
  }

  function setCurrentPath(points, mode = drawMode, quiet = false) {
    const template = selectedTemplate();
    if (!template) return;
    template.path = normalizePath({
      mode: mode === "draw" ? "draw" : "points",
      points,
      curve: template.path?.curve ?? 0.68,
    });
    const index = pack.bubbles.indexOf(template);
    pack.bubbles[index] = normalizeTemplate(template, index);
    selectedId = pack.bubbles[index].id;
    updateJsonOutput();
    renderTemplateList();
    if (!quiet) {
      const count = pack.bubbles[index].path.points.length;
      setStatus(count >= 2 ? `路径 ${count} 点` : "至少需要 2 个点");
    }
  }

  function nearestPathPointIndex(point) {
    const template = selectedTemplate();
    const points = template?.path?.points || [];
    if (!points.length) return -1;
    const rect = canvas.getBoundingClientRect();
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    points.forEach((candidate, index) => {
      const dx = (candidate.x - point.x) * rect.width;
      const dy = (candidate.y - point.y) * rect.height;
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestDistance <= 22 ? bestIndex : -1;
  }

  function updatePathPoint(index, point, quiet = false) {
    const points = currentPathPoints();
    if (index < 0 || index >= points.length) return;
    points[index] = point;
    setCurrentPath(points, "points", quiet);
  }

  function beginCanvasEdit(event) {
    if (drawMode === "preview") return;
    event.preventDefault();
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic pointer events do not always own capture; real pointer input still benefits.
    }
    const point = canvasPointFromEvent(event);
    if (drawMode === "points") {
      activePointIndex = nearestPathPointIndex(point);
      if (activePointIndex >= 0) {
        updatePathPoint(activePointIndex, point, true);
      } else {
        const points = [...currentPathPoints(), point];
        activePointIndex = points.length - 1;
        setCurrentPath(points, "points");
      }
      return;
    }
    isDrawingPath = true;
    activePointIndex = -1;
    setCurrentPath([point], "draw", true);
  }

  function moveCanvasEdit(event) {
    if (drawMode === "points" && activePointIndex >= 0) {
      event.preventDefault();
      updatePathPoint(activePointIndex, canvasPointFromEvent(event), true);
      return;
    }
    if (!isDrawingPath || drawMode !== "draw") return;
    event.preventDefault();
    const points = currentPathPoints();
    const point = canvasPointFromEvent(event);
    const last = points[points.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.008) {
      points.push(point);
      setCurrentPath(points, "draw", true);
    }
  }

  function endCanvasEdit(event) {
    if (drawMode === "points" && activePointIndex >= 0) {
      event.preventDefault();
      try {
        canvas.releasePointerCapture?.(event.pointerId);
      } catch {}
      activePointIndex = -1;
      setStatus("Path point updated");
      return;
    }
    if (!isDrawingPath) return;
    event.preventDefault();
    try {
      canvas.releasePointerCapture?.(event.pointerId);
    } catch {}
    isDrawingPath = false;
    activePointIndex = -1;
    setCurrentPath(currentPathPoints(), "draw");
  }

  function undoPathPoint() {
    const template = selectedTemplate();
    if (!template) return;
    const points = currentPathPoints();
    points.pop();
    setCurrentPath(points, template.path?.mode || "points");
  }

  function clearPath() {
    const template = selectedTemplate();
    if (!template) return;
    template.path = { mode: "auto", points: [] };
    const index = pack.bubbles.indexOf(template);
    pack.bubbles[index] = normalizeTemplate(template, index);
    selectedId = pack.bubbles[index].id;
    refresh();
    setStatus("已清空当前模板路径");
  }

  function makeTemplate() {
    const base = normalizeTemplate(
      {
        id: `bubble-${Date.now()}`,
        label: "新泡泡",
        weight: 1,
        levelMin: 1,
        levelMax: 99,
        count: [1, 2],
        spacingMs: [80, 130],
        size: [28, 42],
        speed: [52, 86],
        tapCount: 1,
        holdMs: 0,
        edge: "random",
        lane: [0.24, 0.76],
        aimX: [0.28, 0.72],
        aimY: [0.22, 0.78],
        trajectory: "softS",
        amplitude: [6, 16],
        frequency: [1.6, 2.6],
        arcBend: [-24, 24],
        arcLife: [2, 3],
        colorMode: "auto",
      },
      pack.bubbles.length,
    );
    pack.bubbles.push(base);
    selectedId = base.id;
    refresh();
  }

  function duplicateTemplate() {
    const template = selectedTemplate();
    if (!template) return;
    const copy = normalizeTemplate(JSON.parse(JSON.stringify(template)), pack.bubbles.length);
    copy.id = `${template.id}-copy-${Date.now()}`;
    copy.label = `${template.label} copy`.slice(0, 28);
    pack.bubbles.push(copy);
    selectedId = copy.id;
    refresh();
  }

  function deleteTemplate() {
    if (pack.bubbles.length <= 1) {
      setStatus("至少保留一个模板");
      return;
    }
    pack.bubbles = pack.bubbles.filter((template) => template.id !== selectedId);
    selectedId = pack.bubbles[0].id;
    refresh();
  }

  function saveToGame() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(normalizePack(pack)));
      setStatus("已保存到游戏");
    } catch {
      setStatus("保存失败，浏览器阻止了 localStorage");
    }
  }

  function exportJson() {
    const json = JSON.stringify(normalizePack(pack), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug(pack.name)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("JSON 已导出");
  }

  function slug(value) {
    return String(value || "paopao-bubble-pack")
      .trim()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40);
  }

  function importJsonFile(file) {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const imported = JSON.parse(String(reader.result || ""));
        pack = normalizePack(imported);
        selectedId = pack.bubbles[0].id;
        syncPackControls();
        refresh();
        setStatus("JSON 已导入");
      } catch {
        setStatus("JSON 无法解析");
      }
    });
    reader.readAsText(file);
  }

  function mid(range) {
    return (number(range?.[0], 0) + number(range?.[1], 0)) * 0.5;
  }

  function hash(value) {
    let result = 0;
    for (let index = 0; index < value.length; index += 1) {
      result = (result * 31 + value.charCodeAt(index)) >>> 0;
    }
    return result;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function edgeForPreview(template, index) {
    return template.edge === "random" ? edgeCycle[(hash(template.id) + index) % edgeCycle.length] : template.edge;
  }

  function pointFromEdge(edge, radius, lane, width, height) {
    const x = lane * width;
    const y = lane * height;
    if (edge === "left") return { x: -radius, y };
    if (edge === "right") return { x: width + radius, y };
    if (edge === "top") return { x, y: -radius };
    return { x, y: height + radius };
  }

  function previewStart(template, index, count, radius, width, height) {
    const edge = edgeForPreview(template, index);
    const lane = clamp(mid(template.lane) + (index - (count - 1) / 2) * 0.045, 0.08, 0.92);
    return { edge, ...pointFromEdge(edge, radius, lane, width, height) };
  }

  function previewTarget(template, width, height) {
    return {
      x: mid(template.aimX) * width,
      y: mid(template.aimY) * height,
    };
  }

  function pixelPathForTemplate(template, index, count, radius, width, height) {
    const points = template.path?.points || [];
    if (points.length < 2) return null;
    const first = points[0];
    const last = points[points.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const offset = count > 1 ? (index - (count - 1) / 2) * radius * 0.72 : 0;
    const ox = (-dy / length) * offset;
    const oy = (dx / length) * offset;
    const pixelPoints = points.map((point) => ({
      x: clamp(point.x * width + ox, radius * 0.35, width - radius * 0.35),
      y: clamp(point.y * height + oy, radius * 0.35, height - radius * 0.35),
    }));
    return sampleCurvedPreviewPath(pixelPoints, template.path?.curve ?? 0.68, {
      minX: radius * 0.35,
      maxX: width - radius * 0.35,
      minY: radius * 0.35,
      maxY: height - radius * 0.35,
    });
  }

  function pointOnPolyline(points, t) {
    if (!points?.length) return { x: 0, y: 0 };
    if (points.length === 1 || t <= 0) return points[0];
    if (t >= 1) return points[points.length - 1];
    const lengths = [];
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      lengths.push(total);
    }
    const target = total * t;
    let prev = 0;
    for (let i = 1; i < points.length; i += 1) {
      if (target <= lengths[i - 1]) {
        const segment = Math.max(0.001, lengths[i - 1] - prev);
        const amount = clamp((target - prev) / segment, 0, 1);
        return {
          x: points[i - 1].x + (points[i].x - points[i - 1].x) * amount,
          y: points[i - 1].y + (points[i].y - points[i - 1].y) * amount,
        };
      }
      prev = lengths[i - 1];
    }
    return points[points.length - 1];
  }

  function sampleCurvedPreviewPath(points, curve = 0.68, bounds = {}) {
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
        sampled.push(clampPreviewPathPoint(blendPreviewCurvePoint(points, p0, p1, p2, p3, step / steps, strength), bounds));
      }
    }
    return sampled;
  }

  function blendPreviewCurvePoint(points, p0, p1, p2, p3, t, strength) {
    const lineX = p1.x + (p2.x - p1.x) * t;
    const lineY = p1.y + (p2.y - p1.y) * t;
    if (points.length === 2) {
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

  function clampPreviewPathPoint(point, bounds) {
    return {
      x: clamp(point.x, bounds.minX ?? 0, bounds.maxX ?? canvas.getBoundingClientRect().width),
      y: clamp(point.y, bounds.minY ?? 0, bounds.maxY ?? canvas.getBoundingClientRect().height),
    };
  }

  function pointOnPath(template, start, target, t) {
    const x = start.x + (target.x - start.x) * t;
    const y = start.y + (target.y - start.y) * t;
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    const amp = mid(template.amplitude);
    const freq = mid(template.frequency);
    const arc = mid(template.arcBend) * Math.sin(Math.PI * t);
    let wave = 0;
    if (template.trajectory === "softS" || template.trajectory === "sGroup") {
      wave = Math.sin(t * Math.PI * 2 * freq) * amp * Math.sin(Math.PI * t);
    } else if (template.trajectory === "zigzag") {
      wave = Math.sin(t * Math.PI * 2 * freq) >= 0 ? amp : -amp;
      wave *= Math.sin(Math.PI * t);
    } else if (template.trajectory === "spray" || template.trajectory === "fan") {
      wave = Math.sin(t * Math.PI * freq + 0.4) * amp * 0.56;
    } else if (template.trajectory === "arc" || template.trajectory === "arcDuo") {
      wave = arc;
    }
    return {
      x: x + nx * (wave + (template.trajectory !== "arc" ? arc : 0)),
      y: y + ny * (wave + (template.trajectory !== "arc" ? arc : 0)),
    };
  }

  function drawBubble(point, radius, color, template) {
    const body = ctx.createRadialGradient(point.x - radius * 0.35, point.y - radius * 0.42, radius * 0.08, point.x, point.y, radius);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.24, color.light);
    body.addColorStop(0.66, color.color);
    body.addColorStop(1, color.deep);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.52)";
    ctx.lineWidth = Math.max(1.5, radius * 0.05);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.beginPath();
    ctx.ellipse(point.x - radius * 0.32, point.y - radius * 0.38, radius * 0.2, radius * 0.08, -0.5, 0, Math.PI * 2);
    ctx.fill();

    if (template.tapCount > 1 || template.tapCount === 0 || template.holdMs > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.72)";
      ctx.lineWidth = Math.max(2, radius * 0.08);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 7, -Math.PI / 2, Math.PI * 1.2);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(20,43,54,0.58)";
      ctx.lineWidth = 3;
      ctx.font = `900 ${Math.max(10, radius * 0.36)}px "Arial Rounded MT Bold", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = template.tapCount > 1 ? String(template.tapCount) : template.tapCount === 0 ? "H" : `${Math.round(template.holdMs / 100) / 10}s`;
      ctx.strokeText(text, point.x, point.y);
      ctx.fillText(text, point.x, point.y);
    }
  }

  function drawPreview(now) {
    resizeCanvas();
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const flow = Math.sin(now / 2800) * 0.06;
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#77bdc8");
    bg.addColorStop(clamp(0.48 + flow, 0.36, 0.64), "#92cad0");
    bg.addColorStop(clamp(0.54 + flow, 0.4, 0.7), "#d599ac");
    bg.addColorStop(1, "#be8297");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      const y = height * (0.18 + i * 0.18);
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(width * 0.3, y + Math.sin(now / 1200 + i) * 36, width * 0.62, y - 42, width, y + 18);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const active = selectedTemplate();
    pack.bubbles.forEach((template, templateIndex) => {
      const selected = template.id === active?.id;
      drawTemplatePreview(template, templateIndex, selected, now, width, height);
    });
    requestAnimationFrame(drawPreview);
  }

  function drawTemplatePreview(template, templateIndex, selected, now, width, height) {
    const count = Math.min(4, Math.max(1, Math.round(mid(template.count))));
    const radius = mid(template.size) * (selected ? 1 : 0.8);
    const color = template.colorMode === "right" ? colors.pink : template.colorMode === "left" ? colors.blue : templateIndex % 2 ? colors.pink : colors.blue;
    ctx.save();
    ctx.globalAlpha = selected ? 1 : 0.28;
    for (let index = 0; index < count; index += 1) {
      const customPath = pixelPathForTemplate(template, index, count, radius, width, height);
      const start = customPath ? customPath[0] : previewStart(template, index, count, radius, width, height);
      const target = customPath ? customPath[customPath.length - 1] : previewTarget(template, width, height);
      ctx.beginPath();
      if (customPath) {
        customPath.forEach((point, step) => {
          if (step === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
      } else {
        for (let step = 0; step <= 32; step += 1) {
          const point = pointOnPath(template, start, target, step / 32);
          if (step === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
      }
      ctx.strokeStyle = selected ? "rgba(255,255,255,0.68)" : "rgba(255,255,255,0.36)";
      ctx.lineWidth = selected ? 2.6 : 1.4;
      ctx.stroke();

      const speed = mid(template.speed);
      const t = (now / clamp(4200 - speed * 12, 1500, 4200) + index * 0.18 + templateIndex * 0.07) % 1;
      const point = customPath ? pointOnPolyline(customPath, t) : pointOnPath(template, start, target, t);
      drawBubble(point, radius, color, template);
    }
    if (selected) {
      drawPathHandles(template, width, height);
    }
    ctx.restore();
  }

  function drawPathHandles(template, width, height) {
    const points = template.path?.points || [];
    if (!points.length) return;
    ctx.save();
    ctx.globalAlpha = 1;
    if (points.length >= 2) {
      ctx.beginPath();
      points.forEach((point, index) => {
        const x = point.x * width;
        const y = point.y * height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.setLineDash([5, 7]);
      ctx.strokeStyle = "rgba(24,50,64,0.34)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    points.forEach((point, index) => {
      const x = point.x * width;
      const y = point.y * height;
      ctx.beginPath();
      ctx.arc(x, y, index === 0 || index === points.length - 1 ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = index === 0 ? "#ffffff" : index === points.length - 1 ? "#173443" : "rgba(255,255,255,0.86)";
      ctx.fill();
      ctx.strokeStyle = index === points.length - 1 ? "#ffffff" : "#173443";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    ctx.restore();
  }

  Object.values(packControls).forEach((control) => {
    control.addEventListener("input", readPackControls);
  });
  templateInputs.forEach((input) => {
    input.addEventListener("input", () => readTemplateInput(input));
    input.addEventListener("change", () => readTemplateInput(input));
  });
  sliderInputs.forEach((input) => {
    input.addEventListener("input", () => updateTemplateFromSlider(input));
  });
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => setDrawMode(button.dataset.mode));
  });
  $("#undoPathPoint").addEventListener("click", undoPathPoint);
  $("#clearPath").addEventListener("click", clearPath);
  canvas.addEventListener("pointerdown", beginCanvasEdit, { passive: false });
  canvas.addEventListener("pointermove", moveCanvasEdit, { passive: false });
  canvas.addEventListener("pointerup", endCanvasEdit, { passive: false });
  canvas.addEventListener("pointercancel", endCanvasEdit, { passive: false });
  $("#addTemplate").addEventListener("click", makeTemplate);
  $("#duplicateTemplate").addEventListener("click", duplicateTemplate);
  $("#deleteTemplate").addEventListener("click", deleteTemplate);
  $("#savePack").addEventListener("click", saveToGame);
  $("#exportPack").addEventListener("click", exportJson);
  $("#importPack").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", (event) => {
    const file = event.currentTarget.files?.[0];
    if (file) importJsonFile(file);
    event.currentTarget.value = "";
  });
  $("#resetPack").addEventListener("click", () => {
    pack = normalizePack(defaultPack);
    selectedId = pack.bubbles[0].id;
    syncPackControls();
    refresh();
    setStatus("已载入示例组合");
  });
  $("#jsonOutput").addEventListener("change", (event) => {
    try {
      pack = normalizePack(JSON.parse(event.currentTarget.value));
      selectedId = pack.bubbles[0].id;
      syncPackControls();
      refresh();
      setStatus("已从文本更新");
    } catch {
      setStatus("文本不是有效 JSON");
      updateJsonOutput();
    }
  });
  window.addEventListener("resize", resizeCanvas);

  syncPackControls();
  setDrawMode("preview");
  refresh();
  requestAnimationFrame(drawPreview);
})();
