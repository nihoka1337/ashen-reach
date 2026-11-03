'use strict';

/* ============================================================
   РИСОВАННЫЕ ФОНЫ: карта Предела и панорама Острога
   Рисуются один раз на canvas; метки поверх — обычные кнопки.
   ============================================================ */

const Paint = (() => {
  const { alpha, mix, dark } = Art;

  /* Детерминированный шум, чтобы карта не менялась между входами */
  function seeded(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  function setup(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    const W = Math.max(300, r.width), H = Math.max(200, r.height);
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    return { c, W, H };
  }

  /* ---------- карта мира ---------- */
  function worldMap(cv, opts = {}) {
    const { c, W, H } = setup(cv);
    const rnd = seeded(7331);

    c.fillStyle = '#0d0f12';
    c.fillRect(0, 0, W, H);

    // море — мелкая штриховка
    c.strokeStyle = 'rgba(120,140,150,.07)';
    c.lineWidth = 1;
    for (let y = 0; y < H; y += 9) {
      c.beginPath();
      for (let x = 0; x < W; x += 16) c.lineTo(x, y + Math.sin(x * 0.04 + y) * 1.4);
      c.stroke();
    }

    // материк: контур из сглаженных точек
    const pts = [];
    const n = 54;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const wob = 0.86 + rnd() * 0.16 + Math.sin(a * 3 + 1) * 0.06 + Math.sin(a * 7) * 0.03;
      pts.push([W * 0.5 + Math.cos(a) * W * 0.465 * wob, H * 0.5 + Math.sin(a) * H * 0.47 * wob]);
    }
    const trace = () => {
      c.beginPath();
      pts.forEach((p, i) => {
        const nx = pts[(i + 1) % n];
        const mx = (p[0] + nx[0]) / 2, my = (p[1] + nx[1]) / 2;
        i ? c.quadraticCurveTo(p[0], p[1], mx, my) : c.moveTo(mx, my);
      });
      c.closePath();
    };
    trace();
    c.save();
    c.shadowColor = 'rgba(200,170,120,.25)'; c.shadowBlur = 18;
    const land = c.createRadialGradient(W * 0.32, H * 0.72, 40, W * 0.5, H * 0.5, W * 0.6);
    land.addColorStop(0, '#39301f'); land.addColorStop(0.5, '#2c2a20'); land.addColorStop(1, '#201f1b');
    c.fillStyle = land;
    c.fill();
    c.restore();
    trace();
    c.strokeStyle = 'rgba(214,188,140,.5)'; c.lineWidth = 2; c.stroke();

    c.save();
    trace();
    c.clip();

    // леса и пустоши: россыпь значков
    for (let i = 0; i < 300; i++) {
      const x = rnd() * W, y = rnd() * H;
      const v = rnd();
      if (v < 0.5) {
        c.strokeStyle = 'rgba(180,160,120,.12)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 2, y - 5); c.lineTo(x + 4, y); c.stroke();
      } else {
        c.fillStyle = 'rgba(0,0,0,.14)';
        c.fillRect(x, y, 2 + rnd() * 7, 1);
      }
    }

    // горы
    const ranges = [[0.62, 0.72, 11], [0.86, 0.54, 8], [0.48, 0.2, 10], [0.2, 0.2, 7]];
    for (const [fx, fy, count] of ranges) {
      for (let i = 0; i < count; i++) {
        const x = W * fx + (rnd() - 0.5) * W * 0.16;
        const y = H * fy + (rnd() - 0.5) * H * 0.13;
        const s = 11 + rnd() * 14;
        c.fillStyle = '#34312a';
        c.beginPath(); c.moveTo(x - s, y + s * 0.7); c.lineTo(x, y - s); c.lineTo(x + s, y + s * 0.7); c.closePath(); c.fill();
        c.fillStyle = '#1b1a16';
        c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s, y + s * 0.7); c.lineTo(x + s * 0.1, y + s * 0.7); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(214,188,140,.35)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x - s * 0.34, y - s * 0.34); c.lineTo(x, y - s); c.lineTo(x + s * 0.22, y - s * 0.56); c.stroke();
      }
    }

    // Ключи: озёра и разливы вокруг Верхнего Ключа
    const sprX = W * REGIONS[1].x / 100, sprY = H * REGIONS[1].y / 100;
    for (const [dx, dy, rx, ry] of [[-0.1, 0.08, 0.06, 0.05], [0.09, 0.13, 0.08, 0.05], [-0.05, -0.15, 0.09, 0.07], [0.02, 0.03, 0.035, 0.03], [0.17, -0.02, 0.04, 0.05]]) {
      c.save();
      c.translate(sprX + dx * W, sprY + dy * H);
      c.beginPath(); c.ellipse(0, 0, rx * W, ry * H, rnd() * 0.5, 0, Math.PI * 2);
      const lk = c.createRadialGradient(0, 0, 2, 0, 0, rx * W);
      lk.addColorStop(0, 'rgba(60,110,120,.5)'); lk.addColorStop(1, 'rgba(50,80,90,.16)');
      c.fillStyle = lk; c.fill();
      c.strokeStyle = 'rgba(150,200,210,.28)'; c.lineWidth = 1; c.stroke();
      c.restore();
    }

    // дороги
    const road = (a, b, col = 'rgba(214,180,120,.55)') => {
      c.strokeStyle = col; c.lineWidth = 2; c.setLineDash([6, 6]);
      c.beginPath(); c.moveTo(a[0] * W / 100, a[1] * H / 100);
      const mx = (a[0] + b[0]) / 2 + (a[1] - b[1]) * 0.12, my = (a[1] + b[1]) / 2 + (b[0] - a[0]) * 0.12;
      c.quadraticCurveTo(mx * W / 100, my * H / 100, b[0] * W / 100, b[1] * H / 100);
      c.stroke();
      c.setLineDash([]);
    };
    const city = REGIONS[0];
    const springsOpen = Game.state && Game.regionOpen('springs');
    for (const id of ZONE_ORDER) {
      const reg = REGIONS.find(r => r.id === ZONES[id].region);
      if (Game.state && Game.regionOpen(reg.id)) road([reg.x, reg.y], [ZONES[id].x, ZONES[id].y]);
    }
    const closed = 'rgba(160,140,110,.22)';
    road([city.x, city.y], [REGIONS[1].x, REGIONS[1].y], springsOpen ? undefined : closed);
    const opened = id => Game.state && Game.regionOpen(id);
    road([REGIONS[1].x, REGIONS[1].y], [REGIONS[2].x, REGIONS[2].y], opened('copper') ? undefined : closed);
    road([REGIONS[2].x, REGIONS[2].y], [REGIONS[3].x, REGIONS[3].y], opened('gate') ? undefined : closed);

    // Хмарь над центром и востоком
    const fog = c.createRadialGradient(W * 0.68, H * 0.32, 30, W * 0.62, H * 0.36, W * 0.56);
    fog.addColorStop(0, 'rgba(120,112,130,.78)');
    fog.addColorStop(0.5, 'rgba(90,86,100,.55)');
    fog.addColorStop(0.85, 'rgba(70,68,80,.16)');
    fog.addColorStop(1, 'rgba(60,60,70,0)');
    c.fillStyle = fog;
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, d = rnd();
      const x = W * 0.66 + Math.cos(a) * W * 0.34 * d, y = H * 0.33 + Math.sin(a) * H * 0.34 * d;
      const r = 20 + rnd() * 54;
      const g = c.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, 'rgba(150,145,160,.12)'); g.addColorStop(1, 'rgba(150,145,160,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }

    // Аш-Тар
    const ax = W * 0.62, ay = H * 0.2;
    c.fillStyle = 'rgba(20,16,20,.9)';
    for (const [dx, h] of [[-22, 22], [-10, 36], [2, 28], [14, 40], [26, 18]]) {
      c.beginPath(); c.moveTo(ax + dx - 4, ay + 6); c.lineTo(ax + dx - 3, ay - h); c.lineTo(ax + dx + 2, ay - h + 6); c.lineTo(ax + dx + 4, ay + 6); c.closePath(); c.fill();
    }
    // где Хмарь отогнали, карта снова видна
    const clearings = { springs: 'rgba(48,62,58,', copper: 'rgba(62,50,38,', gate: 'rgba(54,48,44,' };
    for (const r of REGIONS) {
      if (!clearings[r.id] || !(Game.state && Game.regionOpen(r.id))) continue;
      const rx = W * r.x / 100, ry = H * r.y / 100;
      const cl = c.createRadialGradient(rx, ry, 20, rx, ry, W * 0.24);
      cl.addColorStop(0, clearings[r.id] + '.86)'); cl.addColorStop(0.65, clearings[r.id] + '.5)'); cl.addColorStop(1, clearings[r.id] + '0)');
      c.fillStyle = cl; c.fillRect(0, 0, W, H);
    }
    c.fillStyle = 'rgba(255,120,60,.55)';
    c.beginPath(); c.arc(ax + 4, ay - 4, 3, 0, Math.PI * 2); c.fill();
    c.font = 'italic 600 14px "Cormorant Garamond", serif';
    c.fillStyle = 'rgba(232,216,188,.5)';
    c.textAlign = 'center';
    if (!(Game.state && Game.regionOpen('gate'))) c.fillText('Аш-Тар', ax, ay + 22);
    c.fillStyle = 'rgba(232,216,188,.32)';
    c.font = 'italic 500 22px "Cormorant Garamond", serif';
    c.fillText('С е р а я   Х м а р ь', W * 0.72, H * 0.44);

    c.restore();

    // рамка и роза ветров
    c.strokeStyle = 'rgba(214,188,140,.3)'; c.lineWidth = 1;
    c.strokeRect(8, 8, W - 16, H - 16);
    const rx = W - 56, ry = H - 56;
    c.strokeStyle = 'rgba(214,188,140,.5)';
    c.beginPath(); c.arc(rx, ry, 22, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(214,188,140,.75)';
    for (let i = 0; i < 4; i++) {
      c.save(); c.translate(rx, ry); c.rotate(i * Math.PI / 2);
      c.beginPath(); c.moveTo(0, -27); c.lineTo(4, -4); c.lineTo(-4, -4); c.closePath(); c.fill();
      c.restore();
    }
    c.font = '700 11px Manrope, sans-serif';
    c.fillText('С', rx, ry - 30);
  }

  /* ---------- панорама Ключей: сваи, купола, пар и неподвижная вода ---------- */
  function springsView(cv) {
    const { c, W, H } = setup(cv);
    const rnd = seeded(9177);
    const sky = c.createLinearGradient(0, 0, 0, H * 0.72);
    sky.addColorStop(0, '#0c1319'); sky.addColorStop(0.55, '#24404e'); sky.addColorStop(1, '#6f9aa4');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(220,240,255,${rnd() * 0.5})`; c.fillRect(rnd() * W, rnd() * H * 0.4, 1.3, 1.3); }
    const mx = W * 0.8, my = H * 0.17;
    const mg = c.createRadialGradient(mx, my, 6, mx, my, H * 0.34);
    mg.addColorStop(0, 'rgba(226,240,240,.95)'); mg.addColorStop(0.1, 'rgba(210,230,235,.4)'); mg.addColorStop(1, 'rgba(200,220,230,0)');
    c.fillStyle = mg; c.beginPath(); c.arc(mx, my, H * 0.34, 0, Math.PI * 2); c.fill();
    const hills = (b, amp, col, s) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, b * H + Math.sin(x * 0.009 + s) * amp + Math.sin(x * 0.031 + s) * amp * 0.3);
      c.lineTo(W, H); c.closePath(); c.fill();
    };
    hills(0.52, 22, '#1f3440', 2.1);
    hills(0.6, 12, '#16262f', 4);
    const wy = H * 0.68;
    const col = '#0e181e', col2 = '#16232b', glow = 'rgba(255,214,150,.75)';
    const hut = (fx, w, h, stilts = 3, up = 0) => {
      const x = W * fx, y = wy - up;
      c.strokeStyle = col; c.lineWidth = 3;
      for (let i = 0; i < stilts; i++) { const sx = x - w / 2 + 4 + i * (w - 8) / Math.max(1, stilts - 1); c.beginPath(); c.moveTo(sx, y - 2); c.lineTo(sx, wy + 16); c.stroke(); }
      c.fillStyle = col2; c.fillRect(x - w / 2, y - h, w, h);
      c.fillStyle = col; c.beginPath(); c.moveTo(x - w * 0.62, y - h); c.lineTo(x, y - h - w * 0.42); c.lineTo(x + w * 0.62, y - h); c.closePath(); c.fill();
      c.fillRect(x - w * 0.62, y - 2, w * 1.24, 4);
      c.fillStyle = glow; c.fillRect(x - 3, y - h * 0.68, 6, 7);
    };
    // Верхний Ключ: монастырь на скале
    const ax = W * 0.26, ay = wy - 16;
    c.fillStyle = col; c.beginPath(); c.moveTo(ax - 90, wy + 6); c.lineTo(ax - 62, ay - 46); c.lineTo(ax + 56, ay - 40); c.lineTo(ax + 94, wy + 6); c.closePath(); c.fill();
    c.fillStyle = col2; c.fillRect(ax - 42, ay - 96, 84, 56);
    c.fillStyle = col; c.beginPath(); c.arc(ax, ay - 96, 34, Math.PI, 0); c.fill();
    c.fillRect(ax - 2, ay - 150, 4, 24);
    c.fillStyle = glow; c.beginPath(); c.arc(ax, ay - 68, 8, Math.PI, 0); c.fill(); c.fillRect(ax - 8, ay - 68, 16, 14);
    // пар над источником
    for (let i = 0; i < 16; i++) {
      const yy = ay - 108 - i * 10;
      c.fillStyle = `rgba(210,230,235,${0.2 - i * 0.012})`;
      c.beginPath(); c.arc(ax + 56 + Math.sin(i * 0.8) * 8 + i * 2, yy + 60, 8 + i * 1.5, 0, Math.PI * 2); c.fill();
    }
    hut(0.47, 80, 54, 4, 12);
    hut(0.58, 46, 30, 3, 4);
    hut(0.38, 46, 34, 3, 6);
    hut(0.1, 54, 34, 3, 6);
    hut(0.9, 50, 34, 3, 8);
    // меняльный мост
    c.strokeStyle = col; c.lineWidth = 5;
    c.beginPath(); c.moveTo(W * 0.14, wy + 4); c.quadraticCurveTo(W * 0.3, wy - 24, W * 0.42, wy + 4); c.stroke();
    c.lineWidth = 2;
    for (let i = 1; i < 8; i++) { const p = i / 8, bx = W * 0.14 + p * W * 0.28, by = wy + 4 - Math.sin(p * Math.PI) * 14; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, by - 10); c.stroke(); }
    // плот
    c.fillStyle = col; c.fillRect(W * 0.64, wy + 16, W * 0.13, 8);
    c.fillStyle = col2; c.fillRect(W * 0.68, wy - 8, W * 0.05, 24);
    c.beginPath(); c.moveTo(W * 0.665, wy - 8); c.lineTo(W * 0.705, wy - 28); c.lineTo(W * 0.745, wy - 8); c.closePath(); c.fillStyle = col; c.fill();
    c.fillStyle = glow; c.fillRect(W * 0.7, wy + 2, 7, 7);
    // вода с отражениями
    const wg = c.createLinearGradient(0, wy, 0, H);
    wg.addColorStop(0, 'rgba(70,110,122,.82)'); wg.addColorStop(1, '#0a1419');
    c.fillStyle = wg; c.fillRect(0, wy + 8, W, H - wy - 8);
    c.strokeStyle = 'rgba(210,235,240,.14)'; c.lineWidth = 1;
    for (let i = 0; i < 40; i++) { const y = wy + 12 + rnd() * (H - wy - 12), x = rnd() * W, l = 14 + rnd() * 70; c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.stroke(); }
    c.fillStyle = 'rgba(226,240,240,.2)'; c.fillRect(mx - 16, wy + 10, 32, H - wy);
    const v = c.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, W * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  /* ---------- панорама Скола: копёр, отвалы, дым плавилен ---------- */
  function copperView(cv) {
    const { c, W, H } = setup(cv);
    const rnd = seeded(5511);
    const sky = c.createLinearGradient(0, 0, 0, H * 0.8);
    sky.addColorStop(0, '#120e0c'); sky.addColorStop(0.5, '#3e2a1e'); sky.addColorStop(1, '#a0623a');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { const x = W * 0.84 + i * 7 - rnd() * 40, y = H * 0.32 - i * 11, r = 12 + i * 3; c.fillStyle = `rgba(30,24,20,${0.5 - i * 0.015})`; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
    const hills = (b, amp, col, s) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, b * H + Math.abs(Math.sin(x * 0.008 + s)) * -amp + Math.sin(x * 0.04 + s) * 5); c.lineTo(W, H); c.closePath(); c.fill(); };
    hills(0.6, 70, '#2a1c14', 1);
    hills(0.68, 44, '#1c130e', 2.4);
    const wy = H * 0.74, col = '#110c09', col2 = '#1a130e', glow = 'rgba(255,190,110,.8)';
    c.fillStyle = col; c.fillRect(0, wy, W, H - wy);
    // копёр
    const hx = W * 0.24;
    c.strokeStyle = col; c.lineWidth = 7;
    c.beginPath(); c.moveTo(hx - 50, wy); c.lineTo(hx, wy - H * 0.46); c.lineTo(hx + 50, wy); c.moveTo(hx - 30, wy - H * 0.2); c.lineTo(hx + 30, wy - H * 0.2); c.moveTo(hx, wy - H * 0.46); c.lineTo(hx + 90, wy); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.arc(hx, wy - H * 0.46, 20, 0, Math.PI * 2); c.stroke();
    c.fillStyle = col2; c.fillRect(hx - 34, wy - 40, 68, 40);
    c.fillStyle = glow; c.fillRect(hx - 5, wy - 28, 10, 12);
    const hut = (fx, w, h) => {
      const x = W * fx;
      c.fillStyle = col2; c.fillRect(x - w / 2, wy - h, w, h);
      c.fillStyle = col; c.beginPath(); c.moveTo(x - w * 0.6, wy - h); c.lineTo(x + w * 0.6, wy - h - 10); c.lineTo(x + w * 0.6, wy - h); c.closePath(); c.fill();
      c.fillStyle = glow; c.fillRect(x - 3, wy - h * 0.66, 6, 8);
    };
    hut(0.4, 58, 32); hut(0.5, 92, 50); hut(0.6, 44, 28); hut(0.68, 66, 58); hut(0.76, 40, 26); hut(0.84, 78, 44); hut(0.94, 44, 30);
    // клетки птичника
    for (const [dx, dy] of [[-22, -70], [4, -78], [24, -68]]) { c.strokeStyle = 'rgba(255,220,120,.6)'; c.lineWidth = 1.4; c.strokeRect(W * 0.68 + dx - 5, wy + dy, 10, 12); }
    // вагонетки
    c.strokeStyle = 'rgba(160,110,70,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, wy + 22); c.lineTo(W, wy + 22); c.stroke();
    c.fillStyle = col2; for (const f of [0.3, 0.34, 0.72]) c.fillRect(W * f, wy + 8, 28, 13);
    const v = c.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, W * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  /* ---------- панорама Порога: стена, частокол и белые башни вдали ---------- */
  function gateView(cv) {
    const { c, W, H } = setup(cv);
    const rnd = seeded(7123);
    const sky = c.createLinearGradient(0, 0, 0, H * 0.75);
    sky.addColorStop(0, '#1e1a1c'); sky.addColorStop(0.55, '#5a4c44'); sky.addColorStop(1, '#c09a70');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    // Хмарь и башни вдалеке
    const fog = c.createRadialGradient(W * 0.72, H * 0.38, 20, W * 0.72, H * 0.38, W * 0.5);
    fog.addColorStop(0, 'rgba(170,160,170,.8)'); fog.addColorStop(1, 'rgba(120,110,120,0)');
    c.fillStyle = fog; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) {
      const x = W * 0.54 + i * W * 0.03, h = H * (0.14 + rnd() * 0.22);
      c.fillStyle = `rgba(226,218,206,${0.3 + rnd() * 0.3})`;
      c.beginPath(); c.moveTo(x - 5, H * 0.56); c.lineTo(x - 3, H * 0.56 - h); c.lineTo(x, H * 0.56 - h - 7); c.lineTo(x + 3, H * 0.56 - h); c.lineTo(x + 5, H * 0.56); c.closePath(); c.fill();
    }
    c.fillStyle = '#2a221c'; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, H * 0.58 + Math.sin(x * 0.012) * 10); c.lineTo(W, H); c.closePath(); c.fill();
    const wy = H * 0.72, col = '#120e0b', col2 = '#1b1510', glow = 'rgba(255,190,110,.8)';
    // стена с зубцами и вышками
    c.fillStyle = col2; c.fillRect(W * 0.52, wy - 92, W * 0.48, 92 + (H - wy));
    for (let x = W * 0.52; x < W; x += 24) c.fillRect(x, wy - 104, 14, 14);
    for (const fx of [0.6, 0.86]) { c.fillStyle = col; c.fillRect(W * fx - 22, wy - 150, 44, 150); for (const d of [-22, -6, 10]) c.fillRect(W * fx + d, wy - 162, 12, 12); c.fillStyle = glow; c.fillRect(W * fx - 4, wy - 124, 8, 12); }
    c.fillStyle = col; c.fillRect(0, wy, W, H - wy);
    // частокол
    c.fillStyle = col;
    for (let x = 0; x < W * 0.52; x += 11) { const h = 38 + rnd() * 8; c.beginPath(); c.moveTo(x, wy); c.lineTo(x, wy - h); c.lineTo(x + 5, wy - h - 8); c.lineTo(x + 10, wy - h); c.lineTo(x + 10, wy); c.closePath(); c.fill(); }
    // келья, оружейная, кухня с дымом
    c.fillStyle = col2; c.fillRect(W * 0.18, wy - 64, 62, 64); c.beginPath(); c.moveTo(W * 0.18 - 6, wy - 64); c.lineTo(W * 0.18 + 31, wy - 92); c.lineTo(W * 0.18 + 68, wy - 64); c.closePath(); c.fill();
    c.fillStyle = 'rgba(190,210,230,.55)'; c.fillRect(W * 0.18 + 26, wy - 44, 10, 14);
    c.fillStyle = col2; c.fillRect(W * 0.4, wy - 48, 90, 48);
    c.fillStyle = 'rgba(255,130,50,.7)'; c.fillRect(W * 0.4 + 12, wy - 20, 20, 20);
    c.fillStyle = col2; c.fillRect(W * 0.56, wy - 44, 70, 44);
    c.fillStyle = glow; c.fillRect(W * 0.56 + 28, wy - 28, 10, 12);
    for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(160,150,140,${0.3 - i * 0.022})`; c.beginPath(); c.arc(W * 0.56 + 50 + Math.sin(i) * 7 + i * 2, wy - 56 - i * 11, 6 + i * 1.3, 0, Math.PI * 2); c.fill(); }
    const v = c.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, W * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  /* ---------- панорама Острога ---------- */
  function cityView(cv, kind) {
    if (kind === 'springs') return springsView(cv);
    if (kind === 'copper') return copperView(cv);
    if (kind === 'gate') return gateView(cv);
    const { c, W, H } = setup(cv);
    const rnd = seeded(4242);
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#16121a'); sky.addColorStop(0.45, '#4c2b22'); sky.addColorStop(0.72, '#a1552c'); sky.addColorStop(1, '#2a1a12');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    // звёзды сквозь пепел
    for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,230,190,${rnd() * 0.5})`; c.fillRect(rnd() * W, rnd() * H * 0.4, 1.3, 1.3); }
    // стена Хмари на горизонте
    const fog = c.createLinearGradient(W, 0, W * 0.3, 0);
    fog.addColorStop(0, 'rgba(70,64,80,.85)'); fog.addColorStop(1, 'rgba(70,64,80,0)');
    c.fillStyle = fog; c.fillRect(0, H * 0.2, W, H * 0.5);

    const hills = (b, amp, col, s) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, b * H + Math.sin(x * 0.01 + s) * amp + Math.sin(x * 0.033 + s) * amp * 0.3);
      c.lineTo(W, H); c.closePath(); c.fill();
    };
    hills(0.62, 18, '#2f1e16', 1.2);
    hills(0.7, 12, '#1f150f', 3);

    // свет маяка
    const bx = W * 0.72, by = H * 0.16;
    const g = c.createRadialGradient(bx, by, 4, bx, by, H * 0.55);
    g.addColorStop(0, 'rgba(255,190,110,.75)'); g.addColorStop(0.2, 'rgba(255,160,80,.26)'); g.addColorStop(1, 'rgba(255,140,60,0)');
    c.fillStyle = g; c.beginPath(); c.arc(bx, by, H * 0.55, 0, Math.PI * 2); c.fill();

    // стена
    const wy = H * 0.74;
    c.fillStyle = '#17110d';
    c.fillRect(0, wy, W, H - wy);
    for (let x = 0; x < W; x += 22) c.fillRect(x, wy - 9, 13, 10);
    c.strokeStyle = 'rgba(255,200,140,.06)'; c.lineWidth = 1;
    for (let y = wy + 10; y < H; y += 11) for (let x = (y % 22); x < W; x += 30) { c.strokeRect(x, y, 28, 11); }

    const col = '#120d0a', col2 = '#1c1410';
    const house = (fx, w, h, roof = true) => {
      const x = W * fx, y = wy;
      c.fillStyle = col2; c.fillRect(x - w / 2, y - h, w, h + 2);
      if (roof) { c.fillStyle = col; c.beginPath(); c.moveTo(x - w * 0.62, y - h); c.lineTo(x, y - h - w * 0.5); c.lineTo(x + w * 0.62, y - h); c.closePath(); c.fill(); }
      c.fillStyle = 'rgba(255,170,90,.65)';
      c.fillRect(x - 3, y - h * 0.62, 6, 7);
    };
    // часовня
    { const x = W * 0.12, y = wy, h = H * 0.28;
      c.fillStyle = col2; c.beginPath(); c.moveTo(x - 26, y); c.lineTo(x - 26, y - h * 0.5); c.lineTo(x, y - h); c.lineTo(x + 26, y - h * 0.5); c.lineTo(x + 26, y); c.closePath(); c.fill();
      c.fillStyle = 'rgba(160,190,230,.5)'; c.beginPath(); c.arc(x, y - h * 0.5, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = col; c.fillRect(x - 2, y - h - 16, 4, 18); c.fillRect(x - 7, y - h - 11, 14, 3); }
    // кузница с дымом
    house(0.27, 78, 58);
    { const sx = W * 0.3; c.fillStyle = col; c.fillRect(sx, wy - 108, 11, 36);
      for (let i = 0; i < 12; i++) { const yy = wy - 110 - i * 9; c.fillStyle = `rgba(100,90,80,${0.3 - i * 0.022})`; c.beginPath(); c.arc(sx + 6 + Math.sin(i) * 7 + i * 1.6, yy, 6 + i * 1.2, 0, Math.PI * 2); c.fill(); }
      const fg = c.createRadialGradient(W * 0.27, wy - 12, 2, W * 0.27, wy - 12, 40); fg.addColorStop(0, 'rgba(255,130,50,.8)'); fg.addColorStop(1, 'rgba(255,100,40,0)'); c.fillStyle = fg; c.fillRect(W * 0.27 - 40, wy - 52, 80, 60); }
    house(0.38, 46, 34);
    house(0.47, 62, 44);
    house(0.56, 40, 30);
    house(0.64, 80, 56);
    house(0.8, 50, 40);

    // маяк
    c.fillStyle = col;
    c.beginPath(); c.moveTo(bx - 26, wy); c.lineTo(bx - 13, by + 16); c.lineTo(bx + 13, by + 16); c.lineTo(bx + 26, wy); c.closePath(); c.fill();
    c.fillRect(bx - 18, by + 8, 36, 10);
    c.fillStyle = '#ffd690'; c.fillRect(bx - 10, by - 12, 20, 21);
    c.fillStyle = col; c.beginPath(); c.moveTo(bx - 16, by - 12); c.lineTo(bx, by - 28); c.lineTo(bx + 16, by - 12); c.closePath(); c.fill();
    for (const ky of [0.3, 0.55, 0.78]) { c.fillStyle = 'rgba(255,170,90,.45)'; c.fillRect(bx - 3, by + (wy - by) * ky, 6, 9); }

    // ворота
    { const x = W * 0.88, y = wy;
      c.fillStyle = col2; c.fillRect(x - 34, y - 84, 22, 84); c.fillRect(x + 12, y - 84, 22, 84); c.fillRect(x - 34, y - 62, 68, 18);
      for (const d of [-34, -23, 12, 23]) c.fillRect(x + d, y - 92, 7, 9);
      c.fillStyle = '#0a0705'; c.fillRect(x - 12, y - 44, 24, 44);
      c.fillStyle = 'rgba(255,170,90,.8)'; c.beginPath(); c.arc(x - 40, y - 50, 3, 0, Math.PI * 2); c.arc(x + 40, y - 50, 3, 0, Math.PI * 2); c.fill(); }

    const v = c.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, W * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  return { worldMap, cityView };
})();
