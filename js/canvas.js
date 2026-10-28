'use strict';

/* ============================================================
   Визуализация боя на canvas
   ============================================================ */
const BattleScene = (() => {
  let cv = null, ctx = null;
  let W = 0, H = 0, dpr = 1;
  let palette = null;
  let areaId = '';
  let enemyRef = null;
  let classId = 'warrior';
  let time = 0;
  let shake = 0, flash = 0, flashColor = '#ff6a4a';
  let playerFlash = 0, enemyFlash = 0;
  let playerLunge = 0, enemyLunge = 0;
  let playerDeath = 0, enemyDeath = 0;
  let castGlow = 0, chargeGlow = 0;
  let particles = [], texts = [], projectiles = [], slashes = [], rings = [];
  let ash = [];
  let observer = null;

  const RAID_PALETTE = {
    skyTop: '#170c11', skyBot: '#521a26', ground: '#10080a',
    fog: 'rgba(220, 80, 100, .09)', accent: '#e06070', ember: '#ff9da9', mountain: '#201016',
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  function alpha(hex, a) {
    if (!hex || hex[0] !== '#') return `rgba(200,200,200,${a})`;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function mix(hex, hex2, k) {
    const a = parseInt(hex.slice(1), 16), b = parseInt(hex2.slice(1), 16);
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return `rgb(${Math.round(ar + (br - ar) * k)},${Math.round(ag + (bg - ag) * k)},${Math.round(ab + (bb - ab) * k)})`;
  }

  function init(canvas, aId, enemy, cId) {
    cv = canvas;
    ctx = cv.getContext('2d');
    areaId = aId || '';
    enemyRef = enemy;
    classId = cId || 'warrior';
    const area = AREAS.find(a => a.id === areaId);
    palette = area ? area.palette : RAID_PALETTE;
    time = 0; shake = 0; flash = 0;
    playerFlash = 0; enemyFlash = 0;
    playerLunge = 0; enemyLunge = 0;
    playerDeath = 0; enemyDeath = 0;
    castGlow = 0; chargeGlow = 0;
    particles = []; texts = []; projectiles = []; slashes = []; rings = []; ash = [];
    resize();
    if (!observer && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => resize());
    }
    if (observer) observer.disconnect();
    if (observer) observer.observe(cv.parentElement || cv);
    window.removeEventListener('resize', resize);
    window.addEventListener('resize', resize);
  }

  function destroy() {
    if (observer) observer.disconnect();
    window.removeEventListener('resize', resize);
    cv = null; ctx = null; W = 0; H = 0;
  }

  function resize() {
    if (!cv || !cv.isConnected) return;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!ash.length) {
      for (let i = 0; i < 52; i++) {
        ash.push({
          x: Math.random() * W, y: Math.random() * H,
          r: rand(0.6, 2.2), vx: rand(-7, 14), vy: rand(7, 26),
          a: rand(0.09, 0.35), ph: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  function baseScale() { return clamp(H / 355, 0.72, 1.16); }
  function playerPos() { return { x: W * 0.27, y: H * 0.795 }; }
  function enemyPos() { return { x: W * 0.735, y: H * 0.795 }; }
  function enemyScale() {
    if (!enemyRef) return baseScale();
    return baseScale() * (enemyRef.size || 1) * 1.02;
  }

  /* ---------------- эффекты ---------------- */
  function spawnBurst(x, y, color, count = 10, power = 90) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = rand(0.25, 1) * power;
      particles.push({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 30,
        life: rand(0.35, 0.85), max: 0.85, size: rand(1.2, 3.4),
        color, gravity: 150,
      });
    }
  }

  function spawnText(x, y, text, color, size = 17) {
    texts.push({ x, y, text, color, size, life: 1.15, max: 1.15, vy: -38, vx: rand(-6, 6) });
  }

  function handle(name, data = {}) {
    if (!ctx) return;
    const p = playerPos(), e = enemyPos();
    const s = baseScale();
    const es = enemyScale();
    const ec = { x: e.x, y: e.y - 52 * es };
    const pc = { x: p.x, y: p.y - 52 * s };

    switch (name) {
      case 'playerAttack':
        playerLunge = 1;
        if (classId === 'mage') {
          projectiles.push({ x: pc.x + 12 * s, y: pc.y - 10 * s, tx: ec.x, ty: ec.y, t: 0, dur: 0.28, color: '#b57bff', type: 'orb' });
        } else {
          slashes.push({ x: ec.x - 10, y: ec.y, r: 34 * s, life: 0.22, max: 0.22, color: CLASSES[classId].color, rot: rand(-0.5, 0.3) });
        }
        break;
      case 'skill': {
        castGlow = 1;
        const col = CLASSES[classId].color;
        rings.push({ x: pc.x, y: p.y - 30 * s, r: 8, maxR: 70 * s, life: 0.44, max: 0.44, color: col, width: 2 });
        if (classId === 'mage') {
          projectiles.push({ x: pc.x + 10 * s, y: pc.y - 22 * s, tx: ec.x, ty: ec.y, t: 0, dur: 0.3, color: col, type: 'orb' });
        } else {
          playerLunge = 1;
          slashes.push({ x: ec.x, y: ec.y, r: 42 * s, life: 0.26, max: 0.26, color: col, rot: rand(-0.7, 0.2) });
        }
        break;
      }
      case 'hitEnemy': {
        enemyFlash = 0.13;
        shake = Math.max(shake, data.crit ? 10 : 4.5);
        const dmg = Math.round(data.dmg || 0);
        if (dmg) spawnText(ec.x + rand(-14, 14), ec.y - 8 * es, `−${dmg}`, data.crit ? '#ffb14f' : '#ffe3c4', data.crit ? 25 : 18);
        spawnBurst(ec.x + rand(-10, 10), ec.y + rand(-12, 12), data.crit ? '#ffb14f' : '#e8c49c', data.crit ? 20 : 10, data.crit ? 160 : 95);
        break;
      }
      case 'hitPlayer': {
        playerFlash = 0.22;
        shake = Math.max(shake, 6);
        flash = Math.max(flash, 0.5);
        flashColor = '#c94a35';
        const dmg = Math.round(data.dmg || 0);
        if (dmg) spawnText(pc.x + rand(-10, 10), pc.y - 4 * s, `−${dmg}`, '#ff8f7f', 18);
        spawnBurst(pc.x, pc.y, '#c8553f', 12, 110);
        break;
      }
      case 'healPlayer': {
        const amt = Math.round(data.amount || 0);
        if (amt) spawnText(pc.x, pc.y - 18 * s, `+${amt}`, '#8fe19b', 17);
        rings.push({ x: pc.x, y: p.y - 20 * s, r: 10, maxR: 55 * s, life: 0.5, max: 0.5, color: '#7fd68a', width: 2 });
        break;
      }
      case 'healEnemy': {
        const amt = Math.round(data.amount || 0);
        if (amt) spawnText(ec.x, ec.y - 12 * es, `+${amt}`, '#a6df9b', 16);
        rings.push({ x: ec.x, y: e.y - 30 * es, r: 8, maxR: 50 * es, life: 0.5, max: 0.5, color: '#8fce83', width: 2 });
        break;
      }
      case 'dodge': {
        const t = data.target === 'player' ? pc : ec;
        spawnText(t.x, t.y - 20, 'мимо', '#a9c7d6', 15);
        break;
      }
      case 'dotHit': {
        const t = data.target === 'player' ? pc : ec;
        const col = data.kind === 'burn' ? '#ff9a53' : data.kind === 'poison' ? '#9bdc86' : '#e07a6c';
        spawnText(t.x + rand(-12, 12), t.y + rand(-4, 8), `−${Math.round(data.dmg || 0)}`, col, 14);
        break;
      }
      case 'shield':
        rings.push({ x: pc.x, y: p.y - 38 * s, r: 20, maxR: 75 * s, life: 0.55, max: 0.55, color: '#7fbde8', width: 3 });
        break;
      case 'shieldHit': {
        const amt = Math.round(data.amount || 0);
        if (amt) spawnText(pc.x + rand(-8, 8), pc.y - 4 * s, `щит −${amt}`, '#8ecdf0', 14);
        rings.push({ x: pc.x, y: p.y - 34 * s, r: 18, maxR: 50 * s, life: 0.35, max: 0.35, color: '#8ecdf0', width: 2 });
        break;
      }
      case 'buff':
        rings.push({ x: pc.x, y: p.y - 18 * s, r: 8, maxR: 58 * s, life: 0.5, max: 0.5, color: '#e8c070', width: 2 });
        break;
      case 'energy':
        spawnText(pc.x, pc.y - 20 * s, '+энергия', '#7fd0d8', 13);
        break;
      case 'enemyWindup':
        chargeGlow = 1;
        break;
      case 'enemySkill':
        enemyLunge = 1;
        enemyFlash = 0.1;
        shake = Math.max(shake, 7);
        spawnBurst(ec.x, ec.y, enemyRef ? enemyRef.accent : '#ff9a6a', 18, 140);
        break;
      case 'enemyAttack':
        enemyLunge = 1;
        break;
      case 'storm':
        flash = Math.max(flash, 0.65);
        flashColor = '#d15a52';
        for (let i = 0; i < 8; i++) {
          spawnBurst(rand(W * 0.2, W * 0.8), rand(H * 0.2, H * 0.6), '#d78a70', 2, 50);
        }
        break;
      case 'enrage':
        chargeGlow = 1.4;
        rings.push({ x: ec.x, y: e.y - 40 * es, r: 20, maxR: 110 * es, life: 0.7, max: 0.7, color: '#ff7a55', width: 3 });
        break;
      case 'victory':
        enemyDeath = 0.0001;
        spawnBurst(ec.x, ec.y, '#e8c070', 30, 190);
        break;
      case 'death':
        playerDeath = 0.0001;
        flash = 0.9; flashColor = '#8f2c22';
        break;
      case 'levelup':
        rings.push({ x: pc.x, y: p.y - 40 * s, r: 10, maxR: 110 * s, life: 0.9, max: 0.9, color: '#ffc46b', width: 3 });
        spawnBurst(pc.x, pc.y - 30 * s, '#ffc46b', 18, 100);
        break;
      default:
        break;
    }
  }

  function update(dt) {
    time += dt;
    shake = Math.max(0, shake - dt * 34);
    flash = Math.max(0, flash - dt * 1.8);
    playerFlash = Math.max(0, playerFlash - dt);
    enemyFlash = Math.max(0, enemyFlash - dt);
    playerLunge = Math.max(0, playerLunge - dt * 4.6);
    enemyLunge = Math.max(0, enemyLunge - dt * 4.2);
    castGlow = Math.max(0, castGlow - dt * 2.4);
    chargeGlow = Math.max(0, chargeGlow - dt * 1.8);
    if (playerDeath > 0) playerDeath = Math.min(1, playerDeath + dt * 0.6);
    if (enemyDeath > 0) enemyDeath = Math.min(1, enemyDeath + dt * 0.9);

    for (let i = ash.length - 1; i >= 0; i--) {
      const a = ash[i];
      a.x += (a.vx + Math.sin(time + a.ph) * 6) * dt;
      a.y += a.vy * dt;
      if (a.y > H + 5) { a.y = -5; a.x = Math.random() * W; }
      if (a.x > W + 5) a.x = -5;
      if (a.x < -5) a.x = W + 5;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.life -= dt;
      if (t.life <= 0) { texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.x += t.vx * dt;
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.t += dt;
      if (pr.t >= pr.dur) {
        spawnBurst(pr.tx, pr.ty, pr.color, 8, 70);
        projectiles.splice(i, 1);
      }
    }
    for (let i = slashes.length - 1; i >= 0; i--) {
      slashes[i].life -= dt;
      if (slashes[i].life <= 0) slashes.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].life -= dt;
      if (rings[i].life <= 0) rings.splice(i, 1);
    }
  }

  /* ---------------- рисование фона ---------------- */
  function ridge(yBase, amp, color, phase) {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += W / 16) {
      const n = Math.sin(x * 0.008 + phase) * amp
        + Math.sin(x * 0.021 + phase * 2.3) * amp * 0.42
        + Math.sin(x * 0.003 + phase * 0.6) * amp * 0.7;
      ctx.lineTo(x, yBase - Math.abs(n));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, palette.skyTop);
    sky.addColorStop(0.62, palette.skyBot);
    sky.addColorStop(1, palette.ground);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W * 0.66, H * 0.42, 10, W * 0.66, H * 0.42, W * 0.5);
    glow.addColorStop(0, alpha(palette.ember, 0.17));
    glow.addColorStop(0.45, alpha(palette.accent, 0.07));
    glow.addColorStop(1, alpha(palette.accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = 0.55;
    ridge(H * 0.66, H * 0.13, alpha(palette.mountain, 0.55), 2.4);
    ctx.globalAlpha = 0.8;
    ridge(H * 0.73, H * 0.08, alpha(palette.mountain, 0.85), 5.1);
    ctx.globalAlpha = 1;

    const ground = ctx.createLinearGradient(0, H * 0.72, 0, H);
    ground.addColorStop(0, mix(palette.ground, palette.mountain, 0.35));
    ground.addColorStop(1, palette.skyTop);
    ctx.fillStyle = ground;
    ctx.fillRect(0, H * 0.755, W, H * 0.245);

    ctx.strokeStyle = alpha(palette.accent, 0.09);
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = H * 0.79 + i * 13;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y + 2);
      ctx.stroke();
    }

    drawSetDressing();

    const fogY = H * 0.78;
    const fog = ctx.createLinearGradient(0, fogY - 48, 0, fogY + 40);
    fog.addColorStop(0, alpha(palette.fog, 0));
    fog.addColorStop(0.5, palette.fog);
    fog.addColorStop(1, alpha(palette.fog, 0));
    ctx.fillStyle = fog;
    ctx.fillRect(0, fogY - 48, W, 90);
  }

  function drawSetDressing() {
    ctx.save();
    ctx.strokeStyle = alpha(palette.mountain, 0.95);
    ctx.fillStyle = alpha(palette.mountain, 0.9);
    ctx.lineCap = 'round';

    if (areaId === 'ash_fields') {
      for (const x of [W * 0.08, W * 0.16, W * 0.5, W * 0.9]) {
        const h = 38 + (x % 27);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, H * 0.77);
        ctx.lineTo(x + (x / W - 0.5) * 9, H * 0.77 - h);
        ctx.stroke();
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, H * 0.77 - h * 0.55);
        ctx.lineTo(x - 11, H * 0.77 - h * 0.8);
        ctx.moveTo(x, H * 0.77 - h * 0.7);
        ctx.lineTo(x + 12, H * 0.77 - h * 0.9);
        ctx.stroke();
      }
      ctx.fillRect(W * 0.6, H * 0.68, 10, H * 0.1);
      ctx.fillRect(W * 0.8, H * 0.71, 18, H * 0.07);
    } else if (areaId === 'quiet_springs') {
      ctx.strokeStyle = alpha(palette.accent, 0.16);
      for (const x of [W * 0.06, W * 0.2, W * 0.88, W * 0.95]) {
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * 4, H * 0.78);
          ctx.quadraticCurveTo(x + i * 7 - 7, H * 0.71, x + i * 5 + 2, H * 0.65 - i * 2);
          ctx.stroke();
        }
      }
      const pool = ctx.createRadialGradient(W * 0.52, H * 0.83, 2, W * 0.52, H * 0.83, W * 0.2);
      pool.addColorStop(0, alpha(palette.accent, 0.16));
      pool.addColorStop(1, alpha(palette.accent, 0));
      ctx.fillStyle = pool;
      ctx.fillRect(W * 0.3, H * 0.76, W * 0.45, H * 0.16);
    } else if (areaId === 'copper_mine') {
      ctx.lineWidth = 5;
      ctx.strokeStyle = alpha('#3a2518', 0.95);
      ctx.beginPath();
      ctx.moveTo(W * 0.55, H * 0.78); ctx.lineTo(W * 0.55, H * 0.58);
      ctx.lineTo(W * 0.78, H * 0.6); ctx.lineTo(W * 0.78, H * 0.78);
      ctx.moveTo(W * 0.55, H * 0.62); ctx.lineTo(W * 0.78, H * 0.66);
      ctx.stroke();
      ctx.fillStyle = alpha('#160e0a', 0.95);
      ctx.beginPath();
      ctx.moveTo(W * 0.6, H * 0.77);
      ctx.lineTo(W * 0.6, H * 0.68);
      ctx.quadraticCurveTo(W * 0.67, H * 0.61, W * 0.74, H * 0.68);
      ctx.lineTo(W * 0.74, H * 0.77);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = alpha(palette.accent, 0.22);
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(W * 0.06 + i * 9, H * 0.77 - i * 8);
        ctx.lineTo(W * 0.06 + i * 9, H * 0.77);
        ctx.stroke();
      }
    } else if (areaId === 'ash_road') {
      ctx.fillStyle = alpha('#211923', 0.9);
      ctx.fillRect(W * 0.42, H * 0.48, 12, H * 0.3);
      ctx.fillRect(W * 0.65, H * 0.48, 12, H * 0.3);
      ctx.fillRect(W * 0.42, H * 0.48, W * 0.245, 10);
      ctx.fillStyle = alpha('#120d15', 1);
      ctx.fillRect(W * 0.455, H * 0.52, W * 0.19, H * 0.26);
      ctx.strokeStyle = alpha(palette.accent, 0.22);
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const x = W * 0.08 + i * W * 0.035;
        ctx.beginPath();
        ctx.moveTo(x, H * 0.77);
        ctx.lineTo(x + 3, H * 0.72 - (i % 3) * 3);
        ctx.stroke();
      }
    } else {
      // Сердце Хмари
      const cx = W * 0.6, cy = H * 0.48;
      ctx.strokeStyle = alpha('#8d3c4c', 0.35);
      ctx.lineWidth = 3;
      for (let r = 60; r < 160; r += 26) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + Math.sin(time * 0.6 + r) * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = alpha('#2a1219', 0.9);
      for (let i = 0; i < 7; i++) {
        const x = W * 0.1 + i * W * 0.13;
        const h = 30 + (i % 3) * 24;
        ctx.beginPath();
        ctx.moveTo(x, H * 0.77);
        ctx.lineTo(x + 4, H * 0.77 - h);
        ctx.lineTo(x + 9, H * 0.77);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawAsh() {
    ctx.save();
    for (const a of ash) {
      ctx.globalAlpha = a.a * (0.6 + Math.sin(time * 1.4 + a.ph) * 0.4);
      ctx.fillStyle = palette.ember;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------- персонажи ---------------- */
  function drawPlayer() {
    const p = playerPos();
    const s = baseScale();
    const p2 = { x: p.x + playerLunge * 34 * s, y: p.y };
    const cls = CLASSES[classId];
    const col = cls.color;
    const dead = playerDeath;
    const bob = Math.sin(time * 2.1) * 1.7;

    ctx.save();
    ctx.translate(p2.x, p2.y + bob);
    if (dead > 0) {
      ctx.globalAlpha = 1 - dead * 0.8;
      ctx.translate(0, dead * 10);
      ctx.rotate(dead * 0.28);
    }
    ctx.scale(s, s);

    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 31, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // сияние класса
    const glow = ctx.createRadialGradient(0, -46, 2, 0, -46, 62);
    glow.addColorStop(0, alpha(col, 0.10 + castGlow * 0.16));
    glow.addColorStop(1, alpha(col, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(-70, -110, 140, 120);

    // ноги
    ctx.strokeStyle = '#241b15';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, -27); ctx.lineTo(-9, -2);
    ctx.moveTo(7, -27); ctx.lineTo(9, -2);
    ctx.stroke();
    ctx.strokeStyle = '#3b2a20';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-9, -2); ctx.lineTo(-13, 0);
    ctx.moveTo(9, -2); ctx.lineTo(13, 0);
    ctx.stroke();

    // плащ
    const capeSwing = Math.sin(time * 1.8) * 3;
    ctx.fillStyle = mix(col, '#0d0a08', 0.68);
    ctx.beginPath();
    ctx.moveTo(-18, -60);
    ctx.quadraticCurveTo(-25, -28, -22 + capeSwing, -3);
    ctx.lineTo(-5, -9);
    ctx.lineTo(0, -3);
    ctx.lineTo(8, -10);
    ctx.lineTo(22 + capeSwing, -2);
    ctx.quadraticCurveTo(24, -30, 18, -60);
    ctx.closePath();
    ctx.fill();

    // тело
    const body = ctx.createLinearGradient(0, -62, 0, -20);
    body.addColorStop(0, mix(col, '#3a2a20', 0.35));
    body.addColorStop(1, mix(col, '#120e0b', 0.75));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-15, -60);
    ctx.quadraticCurveTo(-18, -40, -11, -25);
    ctx.lineTo(11, -25);
    ctx.quadraticCurveTo(18, -40, 15, -60);
    ctx.closePath();
    ctx.fill();

    // ремень
    ctx.strokeStyle = '#19110c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-12, -34); ctx.lineTo(12, -34);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.fillRect(-2, -36, 4, 4);

    // плечи
    ctx.fillStyle = mix(col, '#0f0b09', 0.45);
    ctx.beginPath();
    ctx.ellipse(-15, -57, 7, 5, -0.3, 0, Math.PI * 2);
    ctx.ellipse(15, -57, 7, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // голова и капюшон
    ctx.fillStyle = '#c8ad90';
    ctx.beginPath();
    ctx.arc(0, -71, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mix(col, '#1a130f', 0.62);
    ctx.beginPath();
    ctx.arc(0, -73, 11, Math.PI * 0.92, Math.PI * 2.08);
    ctx.quadraticCurveTo(11, -61, 3, -62);
    ctx.quadraticCurveTo(-3, -58, -11, -63);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffcf8a';
    ctx.beginPath();
    ctx.arc(3.5, -71, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // оружие
    if (classId === 'mage') {
      ctx.strokeStyle = '#5b4030';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(19, -66); ctx.lineTo(23, -4);
      ctx.stroke();
      const orb = ctx.createRadialGradient(19, -72, 1, 19, -72, 9);
      orb.addColorStop(0, '#fff0c4');
      orb.addColorStop(0.4, col);
      orb.addColorStop(1, alpha(col, 0));
      ctx.fillStyle = orb;
      ctx.beginPath();
      ctx.arc(19, -72, 9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const swing = playerLunge * 0.9;
      ctx.save();
      ctx.translate(18, -44);
      ctx.rotate(-0.65 + swing);
      ctx.fillStyle = '#4b3728';
      ctx.fillRect(-2, -2, 4, 11);
      ctx.fillStyle = '#c9d2d8';
      ctx.beginPath();
      ctx.moveTo(-2, -2);
      ctx.lineTo(-1, -30);
      ctx.lineTo(2, -35);
      ctx.lineTo(3, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = alpha(col, 0.7);
      ctx.fillRect(-5, -5, 10, 3);
      ctx.restore();
    }

    // эффект удара
    if (playerFlash > 0) {
      ctx.globalAlpha = playerFlash * 1.15;
      ctx.fillStyle = '#ff7d66';
      ctx.beginPath();
      ctx.ellipse(0, -46, 24, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // полоска здоровья над головой
    const live = (typeof Game !== 'undefined') ? Game.battle : null;
    const livePct = live ? live.hp / live.maxHp : 1;
    drawHeadBar(p2.x, p2.y - 100 * s, 66 * s, 5, livePct, col, `Ур. ${Game.state.player.level}`);
  }

  function drawEnemy() {
    if (!enemyRef) return;
    const e = enemyPos();
    const s = enemyScale();
    const dead = enemyDeath;
    const bob = Math.sin(time * 1.6 + 1) * 2;
    const x = e.x - enemyLunge * 30 * s;
    const y = e.y + bob;

    ctx.save();
    ctx.translate(x, y);
    if (dead > 0) {
      ctx.globalAlpha = 1 - dead * 0.85;
      ctx.translate(0, dead * 18);
      ctx.rotate(dead * -0.12);
    }
    ctx.scale(s, s);

    // аура босса
    if (enemyRef.boss) {
      const pulse = 0.55 + Math.sin(time * 1.7) * 0.2;
      const aura = ctx.createRadialGradient(0, -46, 4, 0, -46, 85);
      aura.addColorStop(0, alpha(enemyRef.accent, 0.10));
      aura.addColorStop(0.6, alpha(enemyRef.accent, 0.05 * pulse));
      aura.addColorStop(1, alpha(enemyRef.accent, 0));
      ctx.fillStyle = aura;
      ctx.fillRect(-100, -150, 200, 160);
      ctx.strokeStyle = alpha(enemyRef.accent, 0.10 + chargeGlow * 0.25);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, -46, 62, 62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // тень
    const shadowW = enemyRef.shape === 'bird' ? 24 : 38;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath();
    ctx.ellipse(0, 5, shadowW, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const tint = enemyRef.tint || '#8a7a6a';
    const accent = enemyRef.accent || '#ffb35e';

    if (enemyRef.shape === 'beast') drawBeast(tint, accent);
    else if (enemyRef.shape === 'bird') drawBird(tint, accent);
    else if (enemyRef.shape === 'spirit') drawSpirit(tint, accent);
    else if (enemyRef.shape === 'construct') drawConstruct(tint, accent);
    else drawHumanoid(tint, accent);

    if (enemyFlash > 0) {
      ctx.globalAlpha = enemyFlash * 1.15;
      ctx.fillStyle = '#fff7e8';
      ctx.beginPath();
      ctx.ellipse(0, -42, 30, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (chargeGlow > 0.2) {
      ctx.strokeStyle = alpha(accent, chargeGlow * 0.4);
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const r = 40 + i * 10 + Math.sin(time * 9 + i) * 3;
        ctx.beginPath();
        ctx.arc(0, -46, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();

    // полоса здоровья и имя
    const top = y - (enemyRef.shape === 'beast' ? 74 : 104) * s - 22;
    drawHeadBar(e.x, top, Math.min(150, 100 * s), 6,
      enemyRef.hp / enemyRef.maxHp, '#d15a46', `Ур. ${enemyRef.lvl}`);
  }

  function drawBeast(tint, accent) {
    ctx.strokeStyle = mix(tint, '#0c0907', 0.55);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, -28); ctx.lineTo(-24, -2);
    ctx.moveTo(-10, -28); ctx.lineTo(-12, -1);
    ctx.moveTo(15, -28); ctx.lineTo(17, -2);
    ctx.moveTo(25, -28); ctx.lineTo(29, -1);
    ctx.stroke();

    ctx.strokeStyle = tint;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-30, -34);
    ctx.quadraticCurveTo(-52, -46, -48, -60);
    ctx.stroke();

    const body = ctx.createLinearGradient(0, -55, 0, -15);
    body.addColorStop(0, tint);
    body.addColorStop(1, mix(tint, '#100b08', 0.55));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(-2, -34, 34, 21, 0.03, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = mix(tint, '#100b08', 0.22);
    ctx.beginPath();
    ctx.moveTo(16, -48);
    ctx.quadraticCurveTo(34, -56, 44, -44);
    ctx.lineTo(47, -34);
    ctx.quadraticCurveTo(36, -26, 22, -32);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.moveTo(20, -50); ctx.lineTo(21, -62); ctx.lineTo(29, -51);
    ctx.moveTo(35, -50); ctx.lineTo(39, -61); ctx.lineTo(44, -48);
    ctx.fill();

    ctx.fillStyle = '#160f0b';
    ctx.beginPath();
    ctx.moveTo(44, -42); ctx.lineTo(53, -37); ctx.lineTo(44, -33);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(33, -46, 2.6, 0, Math.PI * 2);
    ctx.fill();
    const eyeGlow = ctx.createRadialGradient(33, -46, 0, 33, -46, 9);
    eyeGlow.addColorStop(0, alpha(accent, 0.55));
    eyeGlow.addColorStop(1, alpha(accent, 0));
    ctx.fillStyle = eyeGlow;
    ctx.beginPath(); ctx.arc(33, -46, 9, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = alpha(tint, 0.8);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-20 + i * 8, -50 + i * 1.5);
      ctx.quadraticCurveTo(-16 + i * 8, -42, -18 + i * 8, -35);
      ctx.stroke();
    }

    if (enemyRef.size > 1.2) {
      ctx.strokeStyle = '#d9cbb3';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(24, -58); ctx.lineTo(18, -72);
      ctx.moveTo(39, -58); ctx.lineTo(47, -71);
      ctx.stroke();
    }
  }

  function drawBird(tint, accent) {
    ctx.translate(0, -18);
    const flap = Math.sin(time * 5) * 12;
    ctx.fillStyle = mix(tint, '#100b08', 0.35);
    ctx.beginPath();
    ctx.moveTo(-8, -38);
    ctx.quadraticCurveTo(-48, -64 - flap, -68, -32 - flap);
    ctx.quadraticCurveTo(-38, -28, -10, -26);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -38);
    ctx.quadraticCurveTo(48, -64 - flap, 66, -32 - flap);
    ctx.quadraticCurveTo(38, -28, 10, -26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.ellipse(0, -36, 15, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -60, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#201510';
    ctx.beginPath();
    ctx.moveTo(-4, -62); ctx.lineTo(-18, -58); ctx.lineTo(-3, -55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(-3, -62, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = mix(tint, '#0d0907', 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -18); ctx.lineTo(-9, -6);
    ctx.moveTo(8, -18); ctx.lineTo(9, -6);
    ctx.stroke();
    ctx.strokeStyle = alpha(tint, 0.7);
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-26 - i * 7, -34 - flap * 0.6);
      ctx.lineTo(-40 - i * 8, -26 - flap * 0.5);
      ctx.stroke();
    }
  }

  function drawHumanoid(tint, accent) {
    // ноги
    ctx.strokeStyle = mix(tint, '#0d0907', 0.62);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, -30); ctx.lineTo(-9, -2);
    ctx.moveTo(7, -30); ctx.lineTo(9, -2);
    ctx.stroke();

    // роба / тело
    const body = ctx.createLinearGradient(0, -72, 0, -24);
    body.addColorStop(0, tint);
    body.addColorStop(1, mix(tint, '#0c0807', 0.6));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-14, -70);
    ctx.quadraticCurveTo(-23, -46, -19, -24);
    ctx.lineTo(19, -24);
    ctx.quadraticCurveTo(23, -46, 14, -70);
    ctx.closePath();
    ctx.fill();

    // руки
    ctx.strokeStyle = mix(tint, '#0d0907', 0.35);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-13, -64); ctx.lineTo(-24, -40);
    ctx.moveTo(13, -64); ctx.lineTo(22, -42);
    ctx.stroke();

    // голова
    ctx.fillStyle = mix(tint, '#d8c0a2', 0.28);
    ctx.beginPath();
    ctx.arc(0, -82, 9, 0, Math.PI * 2);
    ctx.fill();

    // капюшон
    ctx.fillStyle = mix(tint, '#0f0a08', 0.5);
    ctx.beginPath();
    ctx.arc(0, -84, 12, Math.PI * 0.95, Math.PI * 2.08);
    ctx.quadraticCurveTo(12, -70, 4, -72);
    ctx.quadraticCurveTo(-2, -68, -12, -74);
    ctx.closePath();
    ctx.fill();

    // глаза
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(-3, -82, 1.5, 0, Math.PI * 2);
    ctx.arc(3, -82, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // оружие
    ctx.save();
    ctx.translate(23, -46);
    ctx.rotate(-0.5 + Math.sin(time * 1.2) * 0.04);
    ctx.fillStyle = '#35261c';
    ctx.fillRect(-1.5, 0, 3, 12);
    ctx.fillStyle = '#aeb6bd';
    ctx.beginPath();
    ctx.moveTo(-1.5, 1); ctx.lineTo(0, -28); ctx.lineTo(2.5, 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // свечение глаз вокруг
    const eg = ctx.createRadialGradient(0, -82, 0, 0, -82, 18);
    eg.addColorStop(0, alpha(accent, 0.20));
    eg.addColorStop(1, alpha(accent, 0));
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(0, -82, 18, 0, Math.PI * 2); ctx.fill();

    if (enemyRef.boss) {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(-10, -93); ctx.lineTo(-6, -100); ctx.lineTo(-2, -93);
      ctx.lineTo(2, -101); ctx.lineTo(5, -93); ctx.lineTo(9, -100); ctx.lineTo(11, -92);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawSpirit(tint, accent) {
    const float = Math.sin(time * 1.7) * 4;
    ctx.translate(0, float);
    const aura = ctx.createRadialGradient(0, -48, 2, 0, -48, 62);
    aura.addColorStop(0, alpha(accent, 0.18));
    aura.addColorStop(1, alpha(accent, 0));
    ctx.fillStyle = aura;
    ctx.fillRect(-70, -120, 140, 125);

    // хвост-дыхание
    const body = ctx.createLinearGradient(0, -80, 0, -2);
    body.addColorStop(0, mix(tint, '#f0e6d6', 0.15));
    body.addColorStop(0.5, tint);
    body.addColorStop(1, alpha(tint, 0));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-13, -68);
    ctx.quadraticCurveTo(-24, -48, -18, -30);
    ctx.quadraticCurveTo(-30, -26, -10, -12);
    ctx.quadraticCurveTo(-4, -20, 0, -3);
    ctx.quadraticCurveTo(6, -22, 13, -12);
    ctx.quadraticCurveTo(30, -28, 19, -33);
    ctx.quadraticCurveTo(24, -50, 13, -68);
    ctx.closePath();
    ctx.fill();

    // руки
    ctx.strokeStyle = alpha(tint, 0.55);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-13, -58); ctx.quadraticCurveTo(-30, -50, -27, -38);
    ctx.moveTo(13, -58); ctx.quadraticCurveTo(30, -50, 27, -38);
    ctx.stroke();

    // голова-маска
    ctx.fillStyle = mix(tint, '#f4ead9', 0.3);
    ctx.beginPath();
    ctx.ellipse(0, -78, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha('#1a0d12', 0.8);
    ctx.beginPath();
    ctx.ellipse(0, -76, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(-3, -78, 1.8, 0, Math.PI * 2);
    ctx.arc(3, -78, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // венец
    if (enemyRef.boss) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -80, 15, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const ang = Math.PI * 1.2 + i * 0.35;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 15, -80 + Math.sin(ang) * 15);
        ctx.lineTo(Math.cos(ang) * 21, -80 + Math.sin(ang) * 21);
        ctx.stroke();
      }
    }

    for (let i = 0; i < 5; i++) {
      const ang = time * 0.8 + i * 1.3;
      const rx = Math.cos(ang) * (20 + i * 3);
      const ry = Math.sin(ang * 0.8) * 10 - 40;
      ctx.fillStyle = alpha(accent, 0.35);
      ctx.beginPath();
      ctx.arc(rx, ry, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawConstruct(tint, accent) {
    const body = ctx.createLinearGradient(0, -80, 0, -20);
    body.addColorStop(0, tint);
    body.addColorStop(1, mix(tint, '#0d0907', 0.55));
    ctx.fillStyle = body;
    // ноги
    ctx.fillRect(-19, -34, 14, 32);
    ctx.fillRect(5, -34, 14, 32);
    // корпус
    ctx.beginPath();
    ctx.moveTo(-24, -78); ctx.lineTo(24, -78); ctx.lineTo(28, -34); ctx.lineTo(-28, -34);
    ctx.closePath();
    ctx.fill();
    // плечи
    ctx.fillStyle = mix(tint, '#0e0907', 0.3);
    ctx.beginPath();
    ctx.ellipse(-28, -72, 12, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(28, -72, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // руки
    ctx.fillStyle = mix(tint, '#0e0907', 0.42);
    ctx.fillRect(-41, -70, 11, 38);
    ctx.fillRect(30, -70, 11, 38);
    // голова
    ctx.fillStyle = mix(tint, '#0e0907', 0.18);
    ctx.fillRect(-11, -93, 22, 16);
    // трещины
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-8, -76); ctx.lineTo(2, -62); ctx.lineTo(-4, -50); ctx.lineTo(8, -38);
    ctx.moveTo(14, -74); ctx.lineTo(9, -60);
    ctx.stroke();
    const eg = ctx.createRadialGradient(0, -86, 0, 0, -86, 22);
    eg.addColorStop(0, alpha(accent, 0.4));
    eg.addColorStop(1, alpha(accent, 0));
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(0, -86, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(-4, -86, 2, 0, Math.PI * 2);
    ctx.arc(5, -86, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHeadBar(x, y, width, height, pct, color, note) {
    const w = Math.max(54, width);
    ctx.save();
    ctx.fillStyle = 'rgba(8,6,5,.65)';
    ctx.fillRect(x - w / 2, y, w, height);
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, mix(color, '#381512', 0.4));
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2 + 1, y + 1, Math.max(0, (w - 2) * clamp(pct, 0, 1)), Math.max(1, height - 2));
    if (note) {
      ctx.fillStyle = 'rgba(226,210,190,.75)';
      ctx.font = '600 9px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(note, x, y - 4);
    }
    ctx.restore();
  }

  /* ---------------- эффекты ---------------- */
  function drawEffects() {
    for (const pr of projectiles) {
      const t = clamp(pr.t / pr.dur, 0, 1);
      const x = pr.x + (pr.tx - pr.x) * t;
      const y = pr.y + (pr.ty - pr.y) * t - Math.sin(t * Math.PI) * 26;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 13);
      g.addColorStop(0, '#fff4da');
      g.addColorStop(0.35, pr.color);
      g.addColorStop(1, alpha(pr.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = alpha(pr.color, 0.4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const sl of slashes) {
      const k = 1 - sl.life / sl.max;
      ctx.save();
      ctx.translate(sl.x, sl.y);
      ctx.rotate(sl.rot);
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = sl.color;
      ctx.shadowColor = sl.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3 * (1 - k * 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, sl.r, -0.9 + k * 0.5, 0.7 + k * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    for (const r of rings) {
      const k = 1 - r.life / r.max;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + (r.maxR - r.r) * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const t of texts) {
      const a = clamp(t.life / t.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = Math.min(1, a * 1.7);
      ctx.font = `800 ${t.size}px Manrope, Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  function draw() {
    if (!ctx || !W || !H) return;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0.5) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);

    drawBackground();
    drawAsh();

    const p = playerPos();
    const e = enemyPos();
    const s = baseScale();
    // отражённый свет под персонажами
    const pg = ctx.createRadialGradient(p.x, p.y - 20, 4, p.x, p.y - 20, 100);
    pg.addColorStop(0, alpha(CLASSES[classId].color, 0.08));
    pg.addColorStop(1, alpha(CLASSES[classId].color, 0));
    ctx.fillStyle = pg;
    ctx.fillRect(p.x - 110, p.y - 130, 220, 140);
    if (enemyRef) {
      const eg = ctx.createRadialGradient(e.x, e.y - 30, 4, e.x, e.y - 30, 120);
      eg.addColorStop(0, alpha(enemyRef.accent, 0.07));
      eg.addColorStop(1, alpha(enemyRef.accent, 0));
      ctx.fillStyle = eg;
      ctx.fillRect(e.x - 130, e.y - 160, 260, 170);
    }

    drawPlayer();
    drawEnemy();
    drawEffects();

    ctx.restore();

    if (flash > 0) {
      ctx.globalAlpha = flash * 0.22;
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (playerDeath > 0 || enemyDeath > 0) {
      const d = Math.max(playerDeath, enemyDeath * 0.5);
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(5,3,3,${0.45 * d})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return { init, destroy, update, draw, handle };
})();
