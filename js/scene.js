'use strict';

/* ============================================================
   БОЕВАЯ СЦЕНА: фон, актёры, клипы анимации, эффекты
   Scene.play(события) проигрывает то, что посчитал бой.
   ============================================================ */

const Scene = (() => {
  const { alpha, mix, dark, TAU } = Art;
  let cv = null, c = null, W = 800, H = 420, dpr = 1;
  let raf = 0, last = 0, time = 0;
  let bgCanvas = null, sceneId = 'fields';
  let actors = {};
  let particles = [], floats = [], rings = [], slashes = [], bolts = [], ash = [], flashes = [];
  let shake = 0, hitStop = 0, tint = 0, tintColor = '#ff0000', zoom = 0;
  let onHud = null;
  let speedMul = 1;
  let minion = null;
  let targetKey = null;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = t => 1 - (1 - t) * (1 - t);
  const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const wait = ms => new Promise(r => setTimeout(r, ms / speedMul));

  /* ---------- палитры сцен ---------- */
  const SCENES = {
    fields: { top: '#1c1612', mid: '#6b3a1f', low: '#2a1a10', ground: '#17110c', groundEdge: '#3a2416', hill: '#241a13', hill2: '#35241a', fog: '#e8a060', ember: '#ffab55', props: 'fields' },
    farm: { top: '#151210', mid: '#57402a', low: '#241810', ground: '#14100b', groundEdge: '#33261a', hill: '#1e1712', hill2: '#2c2118', fog: '#c8a880', ember: '#ffcf8a', props: 'farm' },
    barrow: { top: '#10121a', mid: '#3a3f55', low: '#1c1c28', ground: '#0f0f15', groundEdge: '#2a2a38', hill: '#171821', hill2: '#22232f', fog: '#a0a8c8', ember: '#ffe08a', props: 'barrow' },
    bog: { top: '#0e1512', mid: '#3a4f3c', low: '#1a2a20', ground: '#0f1a16', groundEdge: '#2c4034', hill: '#142018', hill2: '#1f2e24', fog: '#a8c8a0', ember: '#b8f0c0', props: 'bog', water: '#5a8a78' },
    baths: { top: '#14161c', mid: '#59606a', low: '#2a2e34', ground: '#1a1d22', groundEdge: '#3e444c', hill: '#1c2026', hill2: '#2a2f36', fog: '#dce4e8', ember: '#f0f4f8', props: 'baths', water: '#8aa8b8' },
    shafts: { top: '#07060a', mid: '#2a1e16', low: '#14100c', ground: '#100c09', groundEdge: '#2a2018', hill: '#0a0807', hill2: '#15100c', fog: '#c8a070', ember: '#ffd27a', props: 'shafts' },
    foundry: { top: '#120806', mid: '#7a3014', low: '#2c1208', ground: '#160c08', groundEdge: '#40200e', hill: '#100806', hill2: '#1e100a', fog: '#ff9a50', ember: '#ffb45a', props: 'foundry' },
    vein: { top: '#06100e', mid: '#2a4238', low: '#10201c', ground: '#0c1412', groundEdge: '#4a3a24', hill: '#0a1210', hill2: '#141e1a', fog: '#7fe0c0', ember: '#7fe0c0', props: 'vein' },
    road: { top: '#16140f', mid: '#6a5a44', low: '#2a241c', ground: '#16130e', groundEdge: '#3a3226', hill: '#1c1812', hill2: '#2a241c', fog: '#c8b898', ember: '#e8d8b0', props: 'road' },
    gates: { top: '#120f0a', mid: '#5a4830', low: '#241c12', ground: '#14100a', groundEdge: '#3c2e1c', hill: '#16110b', hill2: '#241b10', fog: '#e8c478', ember: '#ffe08a', props: 'gates' },
    ashtar: { top: '#2a2628', mid: '#8a8078', low: '#3e3834', ground: '#22201e', groundEdge: '#5a5450', hill: '#34302e', hill2: '#4a4644', fog: '#f0e8dc', ember: '#ffb46a', props: 'ashtar' },
    bells: { top: '#0a1018', mid: '#2c4a60', low: '#14242f', ground: '#0a151c', groundEdge: '#20384a', hill: '#0f1b24', hill2: '#182a36', fog: '#8fc4dc', ember: '#a8e8ff', props: 'bells', water: '#4a88a8' },
  };

  /* ---------- инициализация ---------- */
  function mount(canvas, sceneKey, hudCb) {
    cv = canvas;
    c = cv.getContext('2d');
    sceneId = SCENES[sceneKey] ? sceneKey : 'fields';
    onHud = hudCb;
    resize();
    actors = {}; particles = []; floats = []; rings = []; slashes = []; bolts = []; flashes = [];
    minion = null;
    ash = [];
    for (let i = 0; i < 46; i++) ash.push({ x: Math.random(), y: Math.random(), s: rand(0.6, 2.4), v: rand(4, 18), d: rand(0, TAU), e: Math.random() < 0.3 });
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
    if (!resize.bound) {
      window.addEventListener('resize', () => { if (cv) resize(); });
      resize.bound = true;
    }
  }

  function unmount() {
    cancelAnimationFrame(raf);
    Object.values(actors).forEach(endClip);
    if (minion) endClip(minion);
    bolts.forEach(b => b.done());
    bolts = [];
    cv = null; c = null;
    actors = {};
  }

  function setSpeed(s) { speedMul = s; }

  function resize() {
    if (!cv) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    W = Math.max(320, r.width); H = Math.max(240, r.height);
    cv.width = W * dpr; cv.height = H * dpr;
    buildBackground();
    layout();
  }

  /* ---------- фон ---------- */
  function ridge(g, base, amp, color, seed) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W + 12; x += 12) {
      const y = base + Math.sin(x * 0.011 + seed) * amp + Math.sin(x * 0.031 + seed * 2.3) * amp * 0.45 + Math.sin(x * 0.087 + seed) * amp * 0.12;
      g.lineTo(x, y);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  }

  function deadTree(g, x, y, s, col) {
    g.strokeStyle = col; g.lineCap = 'round';
    const br = (x0, y0, a, l, w) => {
      if (w < 0.7) return;
      const x1 = x0 + Math.sin(a) * l, y1 = y0 - Math.cos(a) * l;
      g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      br(x1, y1, a + 0.55 + Math.random() * 0.2, l * 0.68, w * 0.62);
      br(x1, y1, a - 0.5 - Math.random() * 0.2, l * 0.7, w * 0.6);
    };
    br(x, y, 0.05, 40 * s, 6 * s);
  }

  function ruin(g, x, y, s, col) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 58 * s); g.lineTo(x + 18 * s, y - 80 * s); g.lineTo(x + 34 * s, y - 62 * s);
    g.lineTo(x + 34 * s, y - 42 * s); g.lineTo(x + 54 * s, y - 42 * s); g.lineTo(x + 54 * s, y - 30 * s); g.lineTo(x + 66 * s, y - 24 * s); g.lineTo(x + 66 * s, y); g.closePath(); g.fill();
  }

  function mill(g, x, y, s, col, light) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x - 24 * s, y); g.lineTo(x - 16 * s, y - 90 * s); g.lineTo(x, y - 110 * s); g.lineTo(x + 16 * s, y - 90 * s); g.lineTo(x + 24 * s, y); g.closePath(); g.fill();
    g.strokeStyle = col; g.lineWidth = 3 * s;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.4;
      g.beginPath(); g.moveTo(x, y - 86 * s); g.lineTo(x + Math.cos(a) * 62 * s, y - 86 * s + Math.sin(a) * 62 * s); g.stroke();
    }
    g.fillStyle = light; g.fillRect(x - 3 * s, y - 62 * s, 6 * s, 9 * s);
  }

  function beacon(g, x, y, s, col, glow) {
    const gr = g.createRadialGradient(x, y - 120 * s, 2, x, y - 120 * s, 90 * s);
    gr.addColorStop(0, alpha(glow, 0.5)); gr.addColorStop(1, alpha(glow, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y - 120 * s, 90 * s, 0, TAU); g.fill();
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x - 16 * s, y); g.lineTo(x - 8 * s, y - 112 * s); g.lineTo(x + 8 * s, y - 112 * s); g.lineTo(x + 16 * s, y); g.closePath(); g.fill();
    g.fillRect(x - 12 * s, y - 126 * s, 24 * s, 16 * s);
    g.fillStyle = glow; g.fillRect(x - 6 * s, y - 122 * s, 12 * s, 9 * s);
  }

  function reeds(g, x, y, n, col) {
    g.strokeStyle = col; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const rx = x + (i - n / 2) * 7 + Math.random() * 4, h = 34 + Math.random() * 40, lean = (Math.random() - 0.5) * 16;
      g.lineWidth = 1.6; g.beginPath(); g.moveTo(rx, y); g.quadraticCurveTo(rx + lean * 0.3, y - h * 0.6, rx + lean, y - h); g.stroke();
      if (i % 3 === 0) { g.lineWidth = 4; g.beginPath(); g.moveTo(rx + lean * 0.9, y - h + 2); g.lineTo(rx + lean, y - h - 8); g.stroke(); }
    }
  }

  function bathhall(g, x, y, s, col, glow) {
    g.fillStyle = col;
    g.fillRect(x - 96 * s, y - 16 * s, 192 * s, 16 * s);
    g.fillRect(x - 86 * s, y - 92 * s, 172 * s, 10 * s);
    g.beginPath(); g.moveTo(x - 76 * s, y - 92 * s); g.quadraticCurveTo(x, y - 164 * s, x + 76 * s, y - 92 * s); g.closePath(); g.fill();
    for (let i = -3; i <= 3; i++) {
      if (i === 2) continue; // одна колонна рухнула
      g.fillRect(x + i * 26 * s - 5 * s, y - 84 * s, 10 * s, 70 * s);
    }
    g.fillStyle = alpha(glow, 0.5);
    g.beginPath(); g.arc(x, y - 50 * s, 18 * s, Math.PI, 0); g.fill();
    g.fillRect(x - 18 * s, y - 50 * s, 36 * s, 36 * s);
  }

  function belltower(g, x, y, s, col, glow) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x - 22 * s, y + 8); g.lineTo(x - 17 * s, y - 118 * s); g.lineTo(x + 17 * s, y - 118 * s); g.lineTo(x + 26 * s, y + 8); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x - 24 * s, y - 118 * s); g.lineTo(x, y - 162 * s); g.lineTo(x + 24 * s, y - 118 * s); g.closePath(); g.fill();
    g.fillRect(x - 1.5 * s, y - 180 * s, 3 * s, 20 * s); g.fillRect(x - 6 * s, y - 174 * s, 12 * s, 2.4 * s);
    g.fillStyle = alpha(glow, 0.7);
    g.beginPath(); g.arc(x, y - 94 * s, 9 * s, Math.PI, 0); g.fill(); g.fillRect(x - 9 * s, y - 94 * s, 18 * s, 18 * s);
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x - 7 * s, y - 80 * s); g.quadraticCurveTo(x - 6 * s, y - 94 * s, x, y - 95 * s); g.quadraticCurveTo(x + 6 * s, y - 94 * s, x + 7 * s, y - 80 * s); g.closePath(); g.fill();
  }

  function timbers(g, col, glow) {
    g.fillStyle = col;
    for (const [fx, sc] of [[0.1, 1], [0.38, 0.72], [0.66, 0.72], [0.92, 1]]) {
      const x = W * fx, h = H * 0.62 * sc, base = H * 0.76, w = 12 * sc;
      g.fillRect(x - w / 2 - 44 * sc, base - h, w, h);
      g.fillRect(x - w / 2 + 44 * sc, base - h, w, h);
      g.fillRect(x - 56 * sc, base - h - 8 * sc, 112 * sc, 14 * sc);
      const lg = g.createRadialGradient(x, base - h + 26 * sc, 2, x, base - h + 26 * sc, 54 * sc);
      lg.addColorStop(0, alpha(glow, 0.65)); lg.addColorStop(1, alpha(glow, 0));
      g.fillStyle = lg; g.beginPath(); g.arc(x, base - h + 26 * sc, 54 * sc, 0, TAU); g.fill();
      g.fillStyle = col;
    }
    g.fillStyle = col; g.fillRect(0, 0, W, H * 0.1);
  }

  function chimneys(g, col, glow) {
    for (const [fx, h, w] of [[0.1, 0.62, 34], [0.26, 0.5, 26], [0.78, 0.72, 40], [0.93, 0.5, 26]]) {
      const x = W * fx, base = H * 0.76, top = base - H * h;
      g.fillStyle = col;
      g.beginPath(); g.moveTo(x - w * 0.6, base); g.lineTo(x - w * 0.36, top); g.lineTo(x + w * 0.36, top); g.lineTo(x + w * 0.6, base); g.closePath(); g.fill();
      const fg = g.createRadialGradient(x, top, 2, x, top, w * 2.2);
      fg.addColorStop(0, alpha(glow, 0.8)); fg.addColorStop(1, alpha(glow, 0));
      g.fillStyle = fg; g.beginPath(); g.arc(x, top, w * 2.2, 0, TAU); g.fill();
    }
    g.fillStyle = alpha(glow, 0.5);
    g.fillRect(W * 0.4, H * 0.68, W * 0.2, 4);
  }

  function copperSpikes(g, col, glow) {
    for (let i = 0; i < 16; i++) {
      const x = Math.random() * W, h = 40 + Math.random() * 110, w = 10 + Math.random() * 18, base = H * 0.76, lean = (Math.random() - 0.5) * 30;
      g.fillStyle = Math.random() < 0.5 ? col : mix(col, '#a0683c', 0.45);
      g.beginPath(); g.moveTo(x - w / 2, base); g.lineTo(x + lean, base - h); g.lineTo(x + w / 2, base); g.closePath(); g.fill();
      g.strokeStyle = alpha(glow, 0.35); g.lineWidth = 1; g.beginPath(); g.moveTo(x, base); g.lineTo(x + lean, base - h); g.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const x = Math.random() * W, h = 30 + Math.random() * 90;
      g.fillStyle = mix(col, '#a0683c', 0.3);
      g.beginPath(); g.moveTo(x - 14, 0); g.lineTo(x, h); g.lineTo(x + 14, 0); g.closePath(); g.fill();
    }
  }

  function wrecks(g, col) {
    for (const [fx, sc, flip] of [[0.1, 1, 1], [0.36, 0.6, -1], [0.62, 0.5, 1], [0.9, 0.9, -1]]) {
      const x = W * fx, y = H * 0.74;
      g.save(); g.translate(x, y); g.scale(sc * flip, sc); g.fillStyle = col;
      g.fillRect(-50, -40, 100, 22);
      g.beginPath(); g.moveTo(-54, -40); g.quadraticCurveTo(0, -92, 54, -40); g.closePath(); g.fill();
      g.strokeStyle = col; g.lineWidth = 5;
      for (const wx of [-32, 30]) { g.beginPath(); g.arc(wx, -13, 14, 0, TAU); g.stroke(); }
      g.lineWidth = 4; g.beginPath(); g.moveTo(52, -24); g.lineTo(92, -12); g.stroke();
      g.restore();
    }
  }

  function bronzeGate(g, col, glow) {
    const x = W * 0.5, base = H * 0.76, w = W * 0.34, h = H * 0.62;
    g.fillStyle = col;
    g.fillRect(x - w * 0.72, base - h * 0.86, w * 0.2, h * 0.86);
    g.fillRect(x + w * 0.52, base - h * 0.86, w * 0.2, h * 0.86);
    g.beginPath(); g.moveTo(x - w * 0.5, base); g.lineTo(x - w * 0.5, base - h * 0.7); g.quadraticCurveTo(x, base - h * 1.1, x + w * 0.5, base - h * 0.7); g.lineTo(x + w * 0.5, base); g.closePath(); g.fill();
    g.strokeStyle = alpha(glow, 0.45); g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - h * 0.9); g.stroke();
    g.fillStyle = alpha(glow, 0.3);
    for (let r = 0; r < 4; r++) for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      g.beginPath(); g.arc(x + i * w * 0.12, base - 30 - r * h * 0.16, 7, 0, TAU); g.fill();
    }
  }

  function whiteTowers(g, col, glow) {
    for (let i = 0; i < 15; i++) {
      const x = W * (i + 0.5) / 15 + (Math.random() - 0.5) * 30, h = H * (0.3 + Math.random() * 0.46), w = 16 + Math.random() * 22, base = H * 0.74;
      const c0 = mix(col, '#d8d0c4', 0.25 + Math.random() * 0.5);
      g.fillStyle = c0;
      g.beginPath(); g.moveTo(x - w / 2, base); g.lineTo(x - w * 0.36, base - h); g.lineTo(x, base - h - w); g.lineTo(x + w * 0.36, base - h); g.lineTo(x + w / 2, base); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, base - h, w * 0.3, h);
      g.fillStyle = alpha(glow, 0.7);
      for (let k = 0; k < 4; k++) if (Math.random() < 0.6) g.fillRect(x - 2, base - h + 8 + k * h * 0.22, 4, 8);
    }
  }

  function buildBackground() {
    const s = SCENES[sceneId];
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = W * dpr; bgCanvas.height = H * dpr;
    const g = bgCanvas.getContext('2d');
    g.scale(dpr, dpr);
    const sky = g.createLinearGradient(0, 0, 0, H * 0.78);
    sky.addColorStop(0, s.top); sky.addColorStop(0.72, s.mid); sky.addColorStop(1, s.low);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // тусклое солнце в пепле
    const sx = W * (sceneId === 'barrow' || sceneId === 'bells' ? 0.2 : sceneId === 'gates' ? 0.5 : 0.62), sy = H * 0.44;
    const sg = g.createRadialGradient(sx, sy, 8, sx, sy, H * 0.55);
    sg.addColorStop(0, alpha(s.fog, 0.5)); sg.addColorStop(0.2, alpha(s.fog, 0.18)); sg.addColorStop(1, alpha(s.fog, 0));
    g.fillStyle = sg; g.fillRect(0, 0, W, H);
    const seedBase = sceneId.length * 1.7;
    ridge(g, H * 0.5, 24, mix(s.hill2, s.mid, 0.35), seedBase);
    if (s.props === 'barrow') beacon(g, W * 0.82, H * 0.52, 0.8, s.hill, s.ember);
    ridge(g, H * 0.58, 20, s.hill2, seedBase + 2);
    if (s.props === 'farm') { mill(g, W * 0.72, H * 0.62, 1, s.hill, s.ember); ruin(g, W * 0.1, H * 0.64, 0.9, s.hill); ruin(g, W * 0.3, H * 0.64, 0.55, s.hill); }
    if (s.props === 'fields') { deadTree(g, W * 0.08, H * 0.66, 1.2, s.hill); deadTree(g, W * 0.88, H * 0.65, 1.4, s.hill); ruin(g, W * 0.44, H * 0.64, 0.5, s.hill); }
    if (s.props === 'barrow') { for (const [x, sc] of [[0.1, 1.2], [0.28, 0.8], [0.58, 0.7]]) { g.fillStyle = s.hill; g.beginPath(); g.ellipse(W * x, H * 0.66, 62 * sc, 30 * sc, 0, Math.PI, 0); g.fill(); g.fillRect(W * x - 4, H * 0.66 - 52 * sc, 8, 26 * sc); } }
    if (s.props === 'shafts') timbers(g, s.hill2, s.ember);
    if (s.props === 'foundry') chimneys(g, s.hill, s.ember);
    if (s.props === 'vein') copperSpikes(g, s.hill2, s.ember);
    if (s.props === 'road') wrecks(g, s.hill);
    if (s.props === 'gates') bronzeGate(g, s.hill, s.ember);
    if (s.props === 'ashtar') whiteTowers(g, s.hill2, s.ember);
    if (s.props === 'bog') { deadTree(g, W * 0.82, H * 0.66, 1.3, s.hill); deadTree(g, W * 0.2, H * 0.67, 0.9, s.hill); }
    if (s.props === 'baths') { bathhall(g, W * 0.56, H * 0.68, 1, s.hill, s.ember); ruin(g, W * 0.1, H * 0.68, 0.7, s.hill); }
    if (s.props === 'bells') { belltower(g, W * 0.76, H * 0.72, 1.05, s.hill, s.ember); ruin(g, W * 0.14, H * 0.72, 0.6, s.hill); }
    ridge(g, H * 0.66, 12, s.hill, seedBase + 4);
    if (s.props === 'bog') { reeds(g, W * 0.06, H * 0.74, 12, s.hill); reeds(g, W * 0.94, H * 0.75, 14, s.hill); reeds(g, W * 0.46, H * 0.72, 7, s.hill2); }
    // земля
    const gy = H * 0.74;
    const gr = g.createLinearGradient(0, gy, 0, H);
    gr.addColorStop(0, s.groundEdge); gr.addColorStop(0.25, s.ground); gr.addColorStop(1, dark(s.ground, 0.4));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 10; x += 10) g.lineTo(x, gy + Math.sin(x * 0.02) * 3);
    g.lineTo(W, H); g.closePath(); g.fill();
    // камешки и трава
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * W, y = gy + 6 + Math.pow(Math.random(), 1.4) * (H - gy - 6);
      const d = (y - gy) / (H - gy);
      g.fillStyle = Math.random() < 0.5 ? alpha(s.groundEdge, 0.6) : 'rgba(0,0,0,.35)';
      g.fillRect(x, y, 1.5 + d * 6, 1 + d * 2);
    }
    // свет за спинами: силуэты должны читаться на тёмной земле
    for (const fx of [0.24, 0.72]) {
      const sp = g.createRadialGradient(W * fx, H * 0.72, 6, W * fx, H * 0.72, H * 0.48);
      sp.addColorStop(0, alpha(s.fog, 0.3)); sp.addColorStop(1, alpha(s.fog, 0));
      g.fillStyle = sp; g.fillRect(0, 0, W, H);
    }
    // виньетка
    const v = g.createRadialGradient(W / 2, H * 0.6, H * 0.3, W / 2, H * 0.6, W * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.62)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }

  /* ---------- актёры ---------- */
  function makeActor(key, opts) {
    return Object.assign({ key, x: 0, y: 0, scale: 1, dir: 1, pose: Object.assign({}, Art.IDLE_POSE), clip: null, flash: 0, flashCol: '#ffffff', alpha: 1, dead: false, deadT: 0, intro: 0, shieldV: 0, seed: Math.random() * 10, statusFx: 0, glow: 0 }, opts);
  }

  function addHero(hero) { actors.hero = makeActor('hero', { kind: 'hero', hero, dir: 1, intro: 1 }); layout(); }

  function addEnemy(u, spawning) {
    actors[u.key] = makeActor(u.key, { kind: 'enemy', unit: u, dir: -1, intro: spawning ? 1 : 0.7 });
    layout();
  }

  function removeMinion() { minion = null; }
  function addMinion() { minion = makeActor('minion', { kind: 'minion', dir: 1, intro: 1 }); layout(); }

  function layout() {
    const base = clamp(H / 400, 0.7, 1.45);
    const gy = H * 0.9;
    if (actors.hero) { actors.hero.x = W * 0.24; actors.hero.y = gy; actors.hero.scale = base * 1.06; }
    if (minion) { minion.x = W * 0.12; minion.y = gy - 12; minion.scale = base * 0.82; }
    const list = Object.values(actors).filter(a => a.kind === 'enemy' && !a.gone);
    const n = list.length;
    const slots = n === 1 ? [[0.72, 0]] : n === 2 ? [[0.6, 0.01], [0.84, -0.04]] : n === 3 ? [[0.52, 0.01], [0.7, -0.06], [0.88, 0]] : [[0.48, 0.01], [0.62, -0.06], [0.76, 0], [0.9, -0.06]];
    list.forEach((a, i) => {
      const [fx, fy] = slots[Math.min(i, slots.length - 1)];
      a.targetX = W * fx;
      if (!a.x) a.x = W * fx + 60;
      a.y = gy + H * fy;
      a.scale = base * (a.unit.size || 1) * 1.08 * (n >= 4 ? 0.8 : n === 3 ? 0.88 : 1);
    });
  }

  function actorPos(key) {
    const a = actors[key] || (key === 'minion' ? minion : null);
    if (!a) return { x: W / 2, y: H / 2, top: H / 3 };
    const h = (a.kind === 'enemy' ? shapeHeight(a.unit) : 150) * a.scale;
    return { x: a.x + (a.pose.dx || 0), y: a.y - h * 0.5, top: a.y - h, scale: a.scale, feet: a.y };
  }

  function shapeHeight(u) {
    return { wolf: 86, rat: 60, bird: 90, spirit: 96, moth: 90, scarecrow: 150, leech: 52, toad: 76, catfish: 104, voice: 196, crawler: 62, golem: 142, furnace: 150, crystal: 110, heart: 170, question: 150 }[u.shape] || 150;
  }

  /* Широкие твари: на сколько от них держаться и какая у них метка под ногами */
  const WIDE = { wolf: 70, rat: 70, leech: 62, toad: 58, catfish: 86, crawler: 56, golem: 56, furnace: 76, crystal: 50, heart: 78 };
  const halfWidth = u => (u && WIDE[u.shape]) || 42;
  const standOff = u => ((u && WIDE[u.shape]) ? 96 + WIDE[u.shape] * 0.8 : 104);

  /* Экранные прямоугольники врагов для выбора цели мышью */
  function hitTest(px, py) {
    const list = Object.values(actors).filter(a => a.kind === 'enemy' && !a.dead);
    let best = null;
    for (const a of list) {
      const h = shapeHeight(a.unit) * a.scale;
      const w = halfWidth(a.unit) * a.scale;
      if (Math.abs(px - a.x) < w && py > a.y - h - 26 && py < a.y + 14) best = a.key;
    }
    return best;
  }

  function enemyScreen(key) {
    const a = actors[key];
    if (!a) return null;
    const h = shapeHeight(a.unit) * a.scale;
    return { x: a.x / W, top: (a.y - h) / H, feet: a.y / H };
  }

  /* ---------- клипы ---------- */
  const CLIPS = {
    slash: { dur: 560, hit: 0.5, go: 0.86, keys: [[0, {}], [0.3, { go: 0.82, as: -2.3, ae: 0.5, lean: -0.05, wr: -0.3 }], [0.5, { go: 0.88, as: 1.5, ae: 0.1, lean: 0.34, wr: 0.2, fh: 0.5, bh: -0.5 }], [0.72, { go: 0.8, as: 1.1, ae: 0.3, lean: 0.2 }], [1, {}]] },
    overhead: { dur: 700, hit: 0.56, go: 0.86, keys: [[0, {}], [0.38, { go: 0.82, dy: -36, as: -3, ae: 0.2, lean: -0.18, crouch: 0.1 }], [0.56, { go: 0.88, dy: 0, as: 1.25, ae: 0, lean: 0.42, crouch: 0.6, fh: 0.65, bh: -0.55 }], [0.76, { go: 0.82, as: 1.1, lean: 0.3, crouch: 0.4 }], [1, {}]] },
    thrust: { dur: 440, hit: 0.48, go: 0.88, keys: [[0, {}], [0.28, { go: 0.8, as: 0.2, ae: 1.5, lean: -0.05 }], [0.48, { go: 0.9, as: 1.6, ae: 0, lean: 0.3, fh: 0.6, bh: -0.5 }], [0.72, { go: 0.8, as: 1.2, lean: 0.14 }], [1, {}]] },
    double: { dur: 680, hit: 0.34, hit2: 0.62, go: 0.88, keys: [[0, {}], [0.2, { go: 0.84, as: -1.4, lean: 0 }], [0.34, { go: 0.88, as: 1.6, ae: 0, lean: 0.3, fh: 0.5, bh: -0.5 }], [0.5, { go: 0.86, as: -1.6, lean: 0.1 }], [0.62, { go: 0.9, as: 1.5, ae: 0.1, lean: 0.34 }], [0.82, { go: 0.8, as: 1, lean: 0.1 }], [1, {}]] },
    sweep: { dur: 620, hit: 0.5, go: 0.82, all: true, keys: [[0, {}], [0.3, { go: 0.78, as: -1.9, ae: 0.3, lean: -0.2, crouch: 0.2 }], [0.5, { go: 0.84, as: 2.5, ae: 0.1, lean: 0.3, crouch: 0.3, fh: 0.5, bh: -0.5, wr: 0.5 }], [0.74, { go: 0.8, as: 1.8, lean: 0.2 }], [1, {}]] },
    dash: { dur: 480, hit: 0.46, go: 0.94, keys: [[0, {}], [0.18, { go: 0.2, crouch: 0.4, lean: 0.4, as: -0.8 }], [0.46, { go: 0.96, as: 1.5, ae: 0, lean: 0.46, fh: 0.7, bh: -0.6, crouch: 0.2 }], [0.74, { go: 0.9, as: 1.2 }], [1, {}]] },
    lunge: { dur: 540, hit: 0.46, go: 0.9, keys: [[0, {}], [0.26, { go: 0.5, lean: -0.1, crouch: 0.4, bs: -1 }], [0.46, { go: 0.92, lean: 0.5, bs: 1.5, be: 0.1, fh: 0.6, bh: -0.6 }], [0.76, { go: 0.8, lean: 0.2 }], [1, {}]] },
    guardup: { dur: 420, hit: 0.5, go: 0, keys: [[0, {}], [0.5, { bs: 1.2, be: 1.7, as: 0.7, ae: 1.5, crouch: 0.5, lean: 0.16 }], [0.8, { bs: 1.1, be: 1.6, as: 0.7, ae: 1.4, crouch: 0.45, lean: 0.12 }], [1, {}]] },
    cast: { dur: 640, hit: 0.56, go: 0, ranged: true, keys: [[0, {}], [0.4, { as: -2.6, ae: 0.4, bs: -1.2, be: 0.6, lean: -0.16, head: -0.16, wr: 0.2 }], [0.56, { as: 1.6, ae: 0, bs: -0.6, lean: 0.24, wr: 0 }], [0.8, { as: 1.3, ae: 0.2, lean: 0.12 }], [1, {}]] },
    sweepcast: { dur: 660, hit: 0.56, go: 0, ranged: true, all: true, keys: [[0, {}], [0.38, { as: -1.6, bs: -2, be: 0.3, lean: -0.2, head: -0.2 }], [0.56, { as: 2.1, ae: 0.1, bs: 1.5, be: 0.2, lean: 0.2 }], [0.8, { as: 1.7, bs: 1.1, lean: 0.1 }], [1, {}]] },
    shout: { dur: 560, hit: 0.5, go: 0, ranged: true, keys: [[0, {}], [0.3, { crouch: 0.4, lean: 0.2, as: 0.2, bs: 0.2 }], [0.5, { as: -2.4, ae: 0.3, bs: -2.4, be: 0.3, lean: -0.16, head: -0.3, crouch: 0 }], [0.8, { as: -2, bs: -2, lean: -0.1 }], [1, {}]] },
    throw: { dur: 520, hit: 0.5, go: 0, ranged: true, keys: [[0, {}], [0.34, { as: -2.3, ae: 1, lean: -0.2 }], [0.5, { as: 1.8, ae: 0, lean: 0.3, fh: 0.4 }], [1, {}]] },
    drink: { dur: 520, hit: 0.6, go: 0, ranged: true, keys: [[0, {}], [0.5, { bs: 0.8, be: 2.5, head: -0.32, lean: -0.08 }], [0.8, { bs: 0.8, be: 2.4, head: -0.3 }], [1, {}]] },
    ebite: { dur: 540, hit: 0.5, go: 0.8, enemy: true, keys: [[0, {}], [0.3, { go: 0.4, lean: -0.14, jaw: 0.3, as: -1.6, ae: 0.6, flap: 0.5 }], [0.5, { go: 0.84, lean: 0.4, jaw: 1, as: 1.5, ae: 0, flap: 1, fh: 0.5, bh: -0.4 }], [0.75, { go: 0.7, lean: 0.2, jaw: 0.3 }], [1, {}]] },
    eheavy: { dur: 820, hit: 0.62, go: 0.84, enemy: true, keys: [[0, {}], [0.45, { go: 0.5, dy: -30, lean: -0.34, jaw: 0.7, as: -3, ae: 0.2, flap: 1.3, crouch: 0.1 }], [0.62, { go: 0.88, dy: 0, lean: 0.5, jaw: 1, as: 1.3, ae: 0, flap: 0, crouch: 0.6, fh: 0.6, bh: -0.5 }], [0.82, { go: 0.74, lean: 0.25, jaw: 0.3, crouch: 0.3 }], [1, {}]] },
    ecast: { dur: 600, hit: 0.56, go: 0, ranged: true, enemy: true, keys: [[0, {}], [0.4, { lean: -0.16, as: -2.4, ae: 0.5, jaw: 0.8, head: -0.2, bs: -1.2 }], [0.56, { lean: 0.22, as: 1.5, ae: 0, jaw: 1 }], [1, {}]] },
    hit: { dur: 260, keys: [[0, {}], [0.2, { dx: -12, lean: -0.3, head: -0.2 }], [1, {}]] },
    bighit: { dur: 420, keys: [[0, {}], [0.2, { dx: -26, lean: -0.5, head: -0.34, crouch: 0.4 }], [1, {}]] },
    dodge: { dur: 340, keys: [[0, {}], [0.4, { dx: -30, dy: -6, lean: -0.3 }], [1, {}]] },
    spawn: { dur: 500, keys: [[0, { dy: 60, alpha: 0 }], [1, {}]] },
  };

  function interpPose(a, clip, p) {
    const base = Art.IDLE_POSE;
    const keys = clip.keys;
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
    const [t0, k0] = keys[i], [t1, k1] = keys[i + 1];
    const q = easeInOut(clamp((p - t0) / (t1 - t0 || 1), 0, 1));
    const out = {};
    for (const f in base) {
      const v0 = k0[f] != null ? k0[f] : base[f];
      const v1 = k1[f] != null ? k1[f] : base[f];
      out[f] = v0 + (v1 - v0) * q;
    }
    return out;
  }

  /* Запускает клип, возвращает промис на момент удара и на конец */
  /* Прерванный клип обязан отчитаться, иначе проигрыватель будет ждать его вечно */
  function endClip(a) {
    const an = a.clip;
    if (!an) return;
    if (an.onHit) { an.onHit(); an.onHit = null; }
    if (an.onEnd) { an.onEnd(); an.onEnd = null; }
    a.clip = null;
  }

  function playClip(a, name, opts = {}) {
    endClip(a);
    const clip = CLIPS[name] || CLIPS.hit;
    const anim = { name, clip, t: 0, dur: clip.dur / (opts.fast ? 1.5 : 1), targetX: opts.targetX };
    a.clip = anim;
    let hitRes;
    const hitP = new Promise(r => { hitRes = r; });
    anim.hitAt = clip.hit || 0.5;
    anim.onHit = hitRes;
    anim.endP = new Promise(r => { anim.onEnd = r; });
    return { hitP, endP: anim.endP };
  }

  function updateActor(a, dt) {
    const now = time + a.seed;
    if (a.clip) {
      const an = a.clip;
      an.t += dt * 1000;
      const p = clamp(an.t / an.dur, 0, 1);
      a.pose = interpPose(a, an.clip, p);
      if (an.onHit && p >= an.hitAt) { an.onHit(); an.onHit = null; }
      if (p >= 1) endClip(a);
    } else if (!a.dead) {
      // дыхание
      const br = Math.sin(now * 2) * 0.012;
      a.pose = Object.assign({}, Art.IDLE_POSE, {
        lean: Art.IDLE_POSE.lean + br, as: Art.IDLE_POSE.as + Math.sin(now * 1.6) * 0.04, bs: Art.IDLE_POSE.bs - Math.sin(now * 1.4) * 0.03,
        crouch: Math.sin(now * 2) * 0.03, head: Math.sin(now * 0.9) * 0.03,
      });
      if (a.windup) a.pose = Object.assign(a.pose, { lean: -0.16, as: -1.9, ae: 0.6, jaw: 0.4, crouch: 0.25 });
    }
    if (a.flash > 0) a.flash = Math.max(0, a.flash - dt * 4.5);
    if (a.intro > 0) a.intro = Math.max(0, a.intro - dt * 2.2);
    if (a.dead) a.deadT = Math.min(1, a.deadT + dt * 1.1);
    if (a.kind === 'enemy' && a.targetX != null) a.x += (a.targetX - a.x) * Math.min(1, dt * 5);
    if (a.statusFx > 0) a.statusFx = Math.max(0, a.statusFx - dt);
  }

  /* ---------- рисование ---------- */
  function drawActor(a) {
    const pose = a.pose;
    let px = a.x + (pose.dx || 0) * a.scale * a.dir;
    const py = a.y + (pose.dy || 0) * a.scale;
    if (a.clip && a.clip.clip.go && pose.go) {
      const tgtX = a.clip.targetX != null ? a.clip.targetX : px;
      px += (tgtX - a.x) * pose.go;
    }
    a.screenX = px;
    let al = a.alpha * (pose.alpha != null ? pose.alpha : 1);
    if (a.dead) al *= 1 - Math.pow(a.deadT, 2);
    if (al <= 0.01) return;
    if (a.intro > 0) al *= 1 - a.intro;

    // тень
    c.save();
    c.globalAlpha = 0.55 * al * (a.dead ? 1 - a.deadT : 1);
    c.fillStyle = '#000';
    c.beginPath();
    const hs = a.kind === 'enemy' ? halfWidth(a.unit) * 0.82 : 34;
    c.ellipse(px, a.y + 2, hs * a.scale, 8 * a.scale, 0, 0, TAU);
    c.fill();
    c.restore();

    c.save();
    c.globalAlpha = al;
    c.translate(px, py + (a.intro ? a.intro * 40 : 0));
    c.scale(a.scale * a.dir, a.scale);
    if (a.dead) {
      c.rotate(-a.deadT * 1.45 * (a.unit ? -1 : 1) * 0 - a.deadT * 1.45);
      c.translate(0, a.deadT * 20);
    }
    if (a.kind === 'hero') Art.drawHero(c, a.hero, pose, time + a.seed);
    else if (a.kind === 'minion') Art.skeleton(c, pose, time + a.seed);
    else Art.drawEnemy(c, a.unit, pose, time + a.seed);
    c.restore();

    // вспышка от удара поверх силуэта
    if (a.flash > 0) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = a.flash * 0.75;
      const h = (a.kind === 'enemy' ? shapeHeight(a.unit) : 150) * a.scale;
      const g = c.createRadialGradient(px, a.y - h / 2, 4, px, a.y - h / 2, h * 0.75);
      g.addColorStop(0, a.flashCol); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(px, a.y - h / 2, h * 0.75, 0, TAU); c.fill();
      c.restore();
    }

    // щит
    if (a.shieldV > 0) {
      c.save();
      const h = 130 * a.scale;
      c.globalAlpha = 0.28 + Math.sin(time * 4) * 0.05;
      c.strokeStyle = '#ffd590'; c.lineWidth = 2.4;
      c.fillStyle = 'rgba(255,200,120,.08)';
      c.beginPath(); c.ellipse(px, a.y - h / 2, h * 0.42, h * 0.66, 0, 0, TAU); c.fill(); c.stroke();
      c.restore();
    }
  }

  function spawnBurst(x, y, col, n = 12, pow = 140, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.up ? rand(-2.6, -0.5) : rand(0, TAU);
      const v = rand(pow * 0.3, pow);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.3, 0.8), t: 0, s: rand(1.4, o.s || 3.4), col, g: o.g != null ? o.g : 260, add: o.add !== false });
    }
  }

  function floatText(x, y, text, col, size = 20, o = {}) {
    floats.push({ x: x + rand(-14, 14), y, text, col, size, t: 0, life: o.life || 1.1, vy: o.vy || -54, weight: o.weight || 800 });
  }

  function update(dt) {
    time += dt;
    for (const k in actors) updateActor(actors[k], dt);
    if (minion) updateActor(minion, dt);
    for (const a of ash) {
      a.y += a.v * dt / H; a.x += Math.sin(time * 0.6 + a.d) * dt * 0.012;
      if (a.y > 1) { a.y = -0.02; a.x = Math.random(); }
    }
    particles = particles.filter(p => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; return p.t < p.life; });
    floats = floats.filter(f => { f.t += dt; f.y += f.vy * dt; f.vy *= 0.97; return f.t < f.life; });
    rings = rings.filter(r => { r.t += dt; return r.t < r.life; });
    slashes = slashes.filter(s => { s.t += dt; return s.t < s.life; });
    flashes = flashes.filter(s => { s.t += dt; return s.t < s.life; });
    bolts = bolts.filter(b => {
      b.t += dt;
      const p = clamp(b.t / b.dur, 0, 1);
      const px = b.x0 + (b.x1 - b.x0) * p;
      const py = b.y0 + (b.y1 - b.y0) * p - Math.sin(p * Math.PI) * (b.arc || 0);
      b.x = px; b.y = py;
      if (Math.random() < 0.9) particles.push({ x: px, y: py, vx: rand(-20, 20), vy: rand(-20, 20), life: rand(0.2, 0.5), t: 0, s: rand(1.5, b.r * 0.5), col: b.col, g: 0, add: true });
      if (p >= 1) { b.done(); return false; }
      return true;
    });
    if (shake > 0) shake = Math.max(0, shake - dt * 42);
    if (tint > 0) tint = Math.max(0, tint - dt * 1.8);
    if (zoom > 0) zoom = Math.max(0, zoom - dt * 0.35);
  }

  function render() {
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.save();
    if (shake > 0) c.translate(rand(-shake, shake), rand(-shake, shake));
    if (zoom > 0) { const z = 1 + zoom; c.translate(W / 2, H * 0.68); c.scale(z, z); c.translate(-W / 2, -H * 0.68); }
    if (bgCanvas) c.drawImage(bgCanvas, 0, 0, W, H);

    // туман за спинами
    const s = SCENES[sceneId];
    c.save();
    c.globalAlpha = 0.14;
    for (let i = 0; i < 3; i++) {
      const x = ((time * (6 + i * 3) + i * 300) % (W + 400)) - 200;
      const g = c.createRadialGradient(x, H * 0.7, 10, x, H * 0.7, 240);
      g.addColorStop(0, s.fog); g.addColorStop(1, alpha(s.fog, 0));
      c.fillStyle = g; c.fillRect(x - 240, H * 0.45, 480, 300);
    }
    c.restore();

    const list = Object.values(actors).sort((a, b) => a.y - b.y);
    // метка текущей цели под ногами
    const tg = targetKey && actors[targetKey];
    if (tg && !tg.dead) {
      const rx = (halfWidth(tg.unit) + (WIDE[tg.unit && tg.unit.shape] ? 6 : 0)) * tg.scale;
      c.save();
      c.strokeStyle = alpha('#ffb46a', 0.55 + Math.sin(time * 4) * 0.25);
      c.lineWidth = 2.4;
      c.setLineDash([9, 7]);
      c.lineDashOffset = -time * 22;
      c.beginPath(); c.ellipse(tg.x, tg.y + 3, rx, rx * 0.25, 0, 0, TAU); c.stroke();
      c.restore();
    }
    if (minion) drawActor(minion);
    for (const a of list) if (!a.gone) drawActor(a);

    // вода по щиколотку поверх ног
    if (s.water) {
      const wy = H * 0.86;
      c.save();
      const wg = c.createLinearGradient(0, wy - 6, 0, H);
      wg.addColorStop(0, alpha(s.water, 0)); wg.addColorStop(0.2, alpha(s.water, 0.34)); wg.addColorStop(1, alpha(dark(s.water, 0.5), 0.55));
      c.fillStyle = wg; c.fillRect(0, wy - 6, W, H - wy + 6);
      c.strokeStyle = alpha(s.fog, 0.3); c.lineWidth = 1.2;
      for (let i = 0; i < 12; i++) {
        const y = wy + i * ((H - wy) / 12) + Math.sin(time + i) * 1.4;
        c.setLineDash([26 + i * 5, 34 + i * 5]);
        c.lineDashOffset = -((time * (6 + i) + i * 90) % 220);
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      }
      c.setLineDash([]);
      c.restore();
    }

    // эффекты
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const r of rings) {
      if (r.t < 0) continue; // волна с задержкой ещё не началась
      const p = r.t / r.life;
      c.globalAlpha = (1 - p) * (r.a || 0.9);
      c.strokeStyle = r.col; c.lineWidth = (r.w || 3) * (1 - p) + 0.4;
      c.beginPath(); c.ellipse(r.x, r.y, r.r * easeOut(p), r.r * easeOut(p) * (r.flat || 1), 0, 0, TAU); c.stroke();
    }
    for (const sl of slashes) {
      const p = sl.t / sl.life;
      c.save();
      c.translate(sl.x, sl.y);
      c.rotate(sl.rot);
      c.globalAlpha = 1 - p;
      const grad = c.createLinearGradient(-sl.r, 0, sl.r, 0);
      grad.addColorStop(0, alpha(sl.col, 0)); grad.addColorStop(0.7, sl.col); grad.addColorStop(1, '#ffffff');
      c.fillStyle = grad;
      c.beginPath();
      const a0 = -1.25, a1 = 1.25 * (0.25 + easeOut(p) * 0.75) * 2 - 1.25;
      c.arc(0, 0, sl.r, a0, a1);
      c.arc(sl.r * 0.13, 0, sl.r * 0.86, a1, a0, true);
      c.closePath(); c.fill();
      c.restore();
    }
    for (const b of bolts) {
      c.globalAlpha = 1;
      const g = c.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r * 3);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, b.col); g.addColorStop(1, alpha(b.col, 0));
      c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r * 3, 0, TAU); c.fill();
    }
    for (const p of particles) {
      const k = 1 - p.t / p.life;
      c.globalAlpha = k;
      c.fillStyle = p.col;
      c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s * k + 0.6, p.s * k + 0.6);
    }
    for (const f of flashes) {
      c.globalAlpha = (1 - f.t / f.life) * f.a;
      const g = c.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r);
      g.addColorStop(0, f.col); g.addColorStop(1, alpha(f.col, 0));
      c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, f.r, 0, TAU); c.fill();
    }
    c.restore();

    // пепел
    c.save();
    for (const a of ash) {
      c.globalAlpha = a.e ? 0.75 : 0.32;
      c.fillStyle = a.e ? s.ember : '#b8a890';
      c.fillRect(a.x * W, a.y * H, a.s, a.s);
    }
    c.restore();
    c.restore();

    if (tint > 0) {
      c.fillStyle = alpha(tintColor, tint * 0.28);
      c.fillRect(0, 0, W, H);
    }

    // цифры
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const f of floats) {
      const p = f.t / f.life;
      const scale = p < 0.14 ? 0.7 + p * 4 : 1.25 - Math.min(0.25, (p - 0.14) * 1.2);
      c.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      c.font = `${f.weight} ${Math.round(f.size * scale)}px Manrope, sans-serif`;
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.85)';
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.col;
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
  }

  function loop(now) {
    if (!cv) return;
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (hitStop > 0) { hitStop -= dt; dt *= 0.08; }
    update(dt * speedMul);
    render();
    raf = requestAnimationFrame(loop);
  }

  /* ---------- проигрывание событий боя ---------- */
  const KIND_COLOR = { phys: '#ffe0b0', fire: '#ff9a3c', dark: '#9fd4c9', sound: '#d7b6ff', poison: '#8bd14a', bleed: '#e05050', burn: '#ff8a3c' };

  function fxOnTarget(fx, x, y, scale = 1) {
    if (fx === 'impact') { spawnBurst(x, y, '#ffcf8a', 16, 220); rings.push({ x, y: y + 30, r: 70 * scale, col: '#ffcf8a', t: 0, life: 0.34, flat: 0.32, w: 5 }); shake = Math.max(shake, 9); }
    else if (fx === 'arc') { slashes.push({ x, y, r: 56 * scale, rot: rand(-0.9, -0.3), col: '#ffe0b0', t: 0, life: 0.24 }); spawnBurst(x, y, '#ffe0b0', 8, 150); }
    else if (fx === 'fire') { spawnBurst(x, y, '#ff8a3c', 22, 170, { up: true, g: -60 }); flashes.push({ x, y, r: 66 * scale, col: '#ff8a3c', a: 0.7, t: 0, life: 0.3 }); }
    else if (fx === 'firewave') { spawnBurst(x, y + 20, '#ff9a3c', 26, 180, { up: true, g: -80 }); flashes.push({ x, y, r: 80 * scale, col: '#ff6a2c', a: 0.7, t: 0, life: 0.34 }); }
    else if (fx === 'meteor') { spawnBurst(x, y + 30, '#ffcf6a', 44, 300); flashes.push({ x, y: y + 20, r: 120 * scale, col: '#ffb040', a: 0.9, t: 0, life: 0.42 }); rings.push({ x, y: y + 34, r: 130 * scale, col: '#ffcf8a', t: 0, life: 0.45, flat: 0.3, w: 6 }); shake = Math.max(shake, 15); }
    else if (fx === 'poison') { spawnBurst(x, y, '#8bd14a', 16, 90, { up: true, g: -40 }); }
    else if (fx === 'curse') { spawnBurst(x, y, '#9fd4c9', 14, 80, { up: true, g: -30 }); rings.push({ x, y, r: 48 * scale, col: '#9fd4c9', t: 0, life: 0.4 }); }
    else if (fx === 'drain') { spawnBurst(x, y, '#d06060', 14, 110); }
    else if (fx === 'note' || fx === 'wave') { for (let i = 0; i < 3; i++) rings.push({ x, y, r: (34 + i * 22) * scale, col: '#d7b6ff', t: -i * 0.06, life: 0.42 + i * 0.06, w: 3 }); }
    else spawnBurst(x, y, '#ffe0b0', 8, 120);
  }

  function projectile(from, to, col, r = 7, arc = 20, dur = 0.24) {
    return new Promise(done => bolts.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y, x: from.x, y: from.y, col, r, arc, dur, t: 0, done }));
  }

  const FX_COLOR = { fire: '#ff8a3c', firewave: '#ff8a3c', bolt: '#ffb46a', meteor: '#ffcf6a', poison: '#8bd14a', curse: '#9fd4c9', drain: '#d06060', note: '#d7b6ff', wave: '#d7b6ff', arc: '#ffe0b0' };

  /* Один ход: клип актёра + удары, что идут за ним */
  async function playAct(ev, hits, rest) {
    const a = actors[ev.who];
    if (!a) { hits.forEach(applyHit); return; }
    const isHero = ev.who === 'hero';
    const tgtKey = ev.target;
    let animName = ev.anim;
    const shape = a.kind === 'enemy' ? a.unit.shape : 'humanoid';
    if (a.kind === 'enemy' && a.windup) a.windup = false;
    let targetX = a.x;
    const clip0 = CLIPS[animName] || CLIPS.slash;
    if (clip0.go) {
      if (tgtKey === 'hero' && actors.hero) targetX = actors.hero.x + standOff(a.unit) * actors.hero.scale;
      else if (actors[tgtKey]) targetX = actors[tgtKey].x - standOff(actors[tgtKey].unit) * actors[tgtKey].scale;
      else if (tgtKey === 'all') targetX = W * 0.6;
    }
    const { hitP, endP } = playClip(a, animName, { targetX, fast: ev.fast });
    await hitP;

    const fx = ev.fx;
    if (clip0.ranged && !ev.noBolt && (hits.length || fx)) {
      const col = FX_COLOR[fx] || (a.kind === 'enemy' ? a.unit.accent : '#ffb46a');
      const fromY = actorPos(ev.who).top + 40 * a.scale;
      const from = { x: a.screenX || a.x, y: fromY };
      if (tgtKey !== 'hero' || !isHero) {
        const keys = tgtKey === 'all' ? (ev.keys || []) : [tgtKey];
        if (fx === 'meteor') {
          await Promise.all(keys.slice(0, 3).map(k => { const p = actorPos(k); return projectile({ x: p.x + 120, y: -40 }, { x: p.x, y: p.y + 20 }, col, 12, 0, 0.32); }));
        } else if (tgtKey === 'all' && (fx === 'wave' || fx === 'firewave')) {
          keys.forEach(k => fxOnTarget(fx, actorPos(k).x, actorPos(k).y, actors[k] ? actors[k].scale : 1));
        } else if (keys.length && keys[0] !== 'hero') {
          await Promise.all(keys.slice(0, 4).map(k => projectile(from, actorPos(k), col, fx === 'fire' ? 9 : 6)));
        } else if (!isHero) {
          await projectile(from, actorPos('hero'), col, 7);
        }
      }
    }
    // эффект на себя
    if (tgtKey === 'hero' && isHero && fx) {
      const p = actorPos('hero');
      if (fx === 'shield') { rings.push({ x: p.x, y: p.y, r: 70, col: '#ffd590', t: 0, life: 0.4, w: 4 }); spawnBurst(p.x, p.y, '#ffd590', 12, 110); }
      if (fx === 'buff') { spawnBurst(p.x, p.feet, '#ffb545', 18, 130, { up: true, g: -40 }); rings.push({ x: p.x, y: p.feet, r: 66, col: '#ffb545', t: 0, life: 0.45, flat: 0.3, w: 4 }); }
      if (fx === 'heal') { spawnBurst(p.x, p.feet, '#7ee0a0', 20, 110, { up: true, g: -70 }); }
      if (fx === 'smoke') { for (let i = 0; i < 14; i++) particles.push({ x: p.x + rand(-30, 30), y: p.feet - rand(0, 40), vx: rand(-30, 30), vy: rand(-40, -10), life: rand(0.5, 1), t: 0, s: rand(8, 22), col: 'rgba(160,170,180,.35)', g: 0, add: false }); }
      if (fx === 'summon') { spawnBurst(W * 0.12, p.feet, '#9fd4c9', 20, 110, { up: true, g: -30 }); }
    }

    let hitIdx = 0;
    for (const h of hits) {
      if (hits.length > 1 && hitIdx > 0 && !clip0.all) await wait(animName === 'double' ? 140 : 90);
      applyHit(h, fx);
      hitIdx++;
    }
    await endP;
  }

  function applyHit(e, fx) {
    const a = actors[e.who];
    const p = actorPos(e.who);
    if (!a) return;
    if (e.t === 'hit') {
      if (onHud) onHud(e);
      if (e.dot) {
        floatText(p.x, p.top - 4, `${e.dmg}`, KIND_COLOR[e.kind] || '#fff', 16);
        a.flash = 0.5; a.flashCol = KIND_COLOR[e.kind] || '#ff5a5a';
        return;
      }
      const col = e.crit ? '#ffd24a' : (e.who === 'hero' ? '#ff7a6a' : '#fff4e0');
      if (e.dmg > 0) floatText(p.x, p.top - 6, `${e.dmg}${e.crit ? '!' : ''}`, col, e.crit ? 30 : 22);
      if (e.absorbed > 0) floatText(p.x + 34, p.top + 12, `−${e.absorbed}`, '#ffd590', 14);
      if (fx && actorPos(e.who)) fxOnTarget(fx, p.x, p.y, a.scale);
      else spawnBurst(p.x, p.y, e.who === 'hero' ? '#c43c3c' : '#c8b49a', e.crit ? 16 : 9, e.crit ? 220 : 150);
      a.flash = e.crit ? 1 : 0.7;
      a.flashCol = e.crit ? '#ffd24a' : '#ffffff';
      if (!a.dead) playClip(a, e.crit || e.heavy ? 'bighit' : 'hit');
      shake = Math.max(shake, e.crit ? 11 : e.heavy ? 13 : 4.5);
      hitStop = Math.max(hitStop, e.crit || e.heavy ? 0.1 : 0.035);
      if (e.who === 'hero' && (e.heavy || e.dmg > 0)) { tint = Math.max(tint, e.heavy ? 0.8 : 0.35); tintColor = '#c02020'; }
      if (e.crit) zoom = 0.03;
      if (e.guarded) { spawnBurst(p.x + 20, p.y, '#ffe0b0', 12, 170); floatText(p.x, p.top - 26, 'Блок', '#ffe0b0', 14); }
      Sfx.hit(e.crit, e.heavy, e.kind);
    }
  }

  /* Главный проигрыватель: группирует удары вокруг act */
  async function play(events, hud) {
    let i = 0;
    while (i < events.length) {
      const e = events[i];
      if (e.t === 'act') {
        const hits = [];
        const rest = [];
        let j = i + 1;
        for (; j < events.length; j++) {
          const n = events[j];
          if (n.t === 'act' || n.t === 'heroTurn') break;
          if (n.t === 'hit' && !n.dot) hits.push(n);
          else rest.push(n);
          if (n.t === 'hit' && hits.length > 12) break;
        }
        const until = j;
        Sfx.swing(e);
        if (hud) hud({ t: 'actor', who: e.who, name: e.name, heavy: e.heavy });
        await playAct(e, hits, rest);
        for (let k = i + 1; k < until; k++) {
          const n = events[k];
          if (n.t === 'hit' && !n.dot) continue;
          await applyEvent(n, hud);
        }
        await wait(e.fast ? 60 : 170);
        i = until;
        continue;
      }
      await applyEvent(e, hud);
      i++;
    }
  }

  async function applyEvent(e, hud) {
    const a = actors[e.who];
    const p = e.who ? actorPos(e.who) : null;
    switch (e.t) {
      case 'hit': applyHit(e); await wait(170); break;
      case 'dodge':
        floatText(p.x, p.top - 6, 'Мимо', '#a8c8e0', 19);
        if (a) playClip(a, 'dodge');
        Sfx.miss();
        break;
      case 'heal':
        if (hud) hud(e);
        if (!e.quiet) { floatText(p.x, p.top, `+${e.n}`, '#7ee0a0', 21); spawnBurst(p.x, p.feet, '#7ee0a0', 14, 100, { up: true, g: -70 }); Sfx.heal(); }
        else floatText(p.x + 24, p.top + 10, `+${e.n}`, '#7ee0a0', 14);
        break;
      case 'shield':
        if (hud) hud(e);
        floatText(p.x, p.top - 2, `+${e.n} щит`, '#ffd590', 16);
        rings.push({ x: p.x, y: p.y, r: 60, col: '#ffd590', t: 0, life: 0.34, w: 3 });
        Sfx.shield();
        break;
      case 'status': {
        const def = STATUSES[e.s];
        if (hud) hud(e);
        floatText(p.x, p.top - 18, def.name, def.color, 14, { weight: 700 });
        break;
      }
      case 'float': {
        const colors = { good: '#7ee0a0', bad: '#ff7a6a', info: '#c8d0d8', dot: (e.s && STATUSES[e.s].color) || '#fff' };
        floatText(p.x, p.top - 24, e.text, colors[e.cls] || '#fff', 14, { weight: 700 });
        if (e.cls === 'dot') await wait(110);
        break;
      }
      case 'interrupt':
        if (a) { a.windup = false; a.flash = 1; a.flashCol = '#ffd24a'; }
        floatText(p.x, p.top - 30, 'Замах сорван!', '#ffd24a', 22);
        spawnBurst(p.x, p.y, '#ffd24a', 22, 230);
        shake = Math.max(shake, 10);
        Sfx.interrupt();
        await wait(220);
        break;
      case 'warn':
        if (a) a.windup = true;
        Sfx.warn();
        break;
      case 'die':
        if (a) { endClip(a); a.dead = true; a.deadT = 0; a.windup = false; }
        Sfx.die(e.who === 'hero');
        if (p) spawnBurst(p.x, p.y, '#b8a890', 24, 140, { up: true, g: 40 });
        await wait(e.who === 'hero' ? 900 : 300);
        if (a && e.who !== 'hero') { a.gone = true; layout(); }
        break;
      case 'phase':
        if (hud) hud(e);
        shake = Math.max(shake, 13);
        if (a) { a.flash = 1; a.flashCol = a.unit.accent; }
        Sfx.phase();
        await wait(1500);
        break;
      case 'spawn': {
        const u = hud && hud({ t: 'getUnit', key: e.who });
        if (u) addEnemy(u, true);
        await wait(300);
        break;
      }
      case 'summon':
        addMinion();
        break;
      case 'unsummon':
        removeMinion();
        break;
      case 'minionHit': {
        if (minion) {
          const tk = actors[e.target];
          playClip(minion, 'slash', { targetX: tk ? tk.x - 60 : minion.x + 200 });
          await wait(280);
        }
        break;
      }
      case 'fx':
        if (e.who === 'all') Object.values(actors).filter(x => x.kind === 'enemy' && !x.dead).forEach(x => { const q = actorPos(x.key); fxOnTarget(e.fx, q.x, q.y, x.scale); });
        else { const q = actorPos(e.who); fxOnTarget(e.fx === 'phoenix' ? 'meteor' : e.fx, q.x, q.y, 1); }
        await wait(240);
        break;
      case 'log': case 'res': case 'heroTurn': case 'flee':
        if (hud) hud(e);
        break;
      default:
        if (hud) hud(e);
    }
  }

  function setTarget(key) { targetKey = key; }

  function setShield(key, v) {
    if (actors[key]) actors[key].shieldV = v;
  }

  function celebrate() {
    const p = actorPos('hero');
    spawnBurst(p.x, p.feet, '#ffd27a', 40, 240, { up: true, g: -30 });
    rings.push({ x: p.x, y: p.feet, r: 140, col: '#ffd27a', t: 0, life: 0.7, flat: 0.3, w: 5 });
  }

  return { mount, unmount, addHero, addEnemy, addMinion, removeMinion, play, hitTest, enemyScreen, actorPos, setSpeed, setShield, setTarget, celebrate };
})();

/* ============================================================
   ЗВУК: короткий синтез без файлов
   ============================================================ */
const Sfx = (() => {
  let ctx = null, enabled = true, drone = null;
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(f, dur, type = 'sine', vol = 0.05, slide = null, when = 0) {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.08, freq = 1200, when = 0) {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime + when;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(); s.buffer = buf;
    const fl = a.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = freq;
    const g = a.createGain(); g.gain.value = vol;
    s.connect(fl).connect(g).connect(a.destination); s.start(t);
  }
  return {
    set(v) { enabled = v; },
    get on() { return enabled; },
    click() { tone(520, 0.05, 'triangle', 0.025); },
    hit(crit, heavy, kind) {
      noise(0.1, crit ? 0.2 : 0.12, kind === 'fire' ? 700 : 1800);
      tone(heavy ? 90 : 150, heavy ? 0.26 : 0.1, 'square', crit || heavy ? 0.07 : 0.035, 50);
      if (crit) tone(1100, 0.1, 'triangle', 0.04, 700);
    },
    swing(e) { if (e.ranged || e.anim === 'cast') tone(300, 0.22, 'sawtooth', 0.016, 820); else noise(0.09, 0.05, 3200); },
    miss() { noise(0.12, 0.05, 4200); },
    heal() { tone(520, 0.18, 'sine', 0.04, 880); tone(780, 0.2, 'sine', 0.03, 1040, 0.07); },
    shield() { tone(240, 0.2, 'triangle', 0.05, 400); },
    warn() { tone(170, 0.32, 'sawtooth', 0.03, 120); },
    interrupt() { tone(1300, 0.12, 'square', 0.05, 340); noise(0.12, 0.13, 2600); },
    die(hero) { tone(hero ? 150 : 200, hero ? 0.8 : 0.3, 'sawtooth', 0.05, 50); },
    phase() { tone(70, 0.9, 'sawtooth', 0.08, 42); noise(0.5, 0.1, 500); },
    forge() {
      noise(0.08, 0.2, 3400); tone(1760, 0.5, 'triangle', 0.05, 1600); tone(2640, 0.32, 'sine', 0.03, 2500, 0.02);
      noise(0.06, 0.12, 4200, 0.16); tone(1980, 0.4, 'triangle', 0.03, 1800, 0.16);
    },
    win() { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.22, 'triangle', 0.045, null, i * 0.09)); },
    level() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.05, null, i * 0.1)); },
    step() { noise(0.06, 0.05, 700); },
    coin() { tone(1200, 0.07, 'square', 0.022, 1700); },
    bad() { tone(160, 0.3, 'sawtooth', 0.04, 90); },
  };
})();
