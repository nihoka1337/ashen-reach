'use strict';

/* ============================================================
   ГРАФИКА: векторные куклы, снаряжение, иконки
   Вещи рисуются одним кодом и на герое, и в инвентаре,
   поэтому надетый меч выглядит так же, как его иконка.
   Кукла стоит ногами в (0,0), смотрит вправо, рост ≈ 150.
   ============================================================ */

const Art = (() => {
  const INK = '#0c0908';
  const TAU = Math.PI * 2;

  /* ---------- цвета ---------- */
  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, k) {
    const x = hexRgb(a), y = hexRgb(b);
    const c = x.map((v, i) => Math.round(v + (y[i] - v) * k));
    return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }
  const dark = (c, k = 0.35) => mix(c, '#000000', k);
  const light = (c, k = 0.25) => mix(c, '#ffffff', k);
  function alpha(hex, a) {
    const [r, g, b] = hexRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  /* Материал вещи: от редкости зависит отблеск, от тира — сталь */
  function material(item) {
    if (!item) return { metal: '#8a8f96', edge: '#c4c9cf', wood: '#5a3f2a', leather: '#5a4030', cloth: '#4a4038', glow: null };
    const rar = RARITIES[item.rarity] || RARITIES.common;
    const glow = item.rarity === 'common' ? null : rar.color;
    const ilvl = item.ilvl || 1;
    const metal = ilvl < 3 ? '#7c7a78' : ilvl < 6 ? '#8e8f96' : '#a3a0ac';
    return {
      metal: glow ? mix(metal, glow, item.rarity === 'legendary' ? 0.35 : 0.12) : metal,
      edge: glow ? mix('#d4d8dc', glow, 0.4) : '#c4c9cf',
      wood: '#5a3f2a', leather: mix('#5a4030', glow || '#5a4030', 0.12),
      cloth: mix('#463c34', glow || '#463c34', item.rarity === 'common' ? 0 : 0.3), glow,
    };
  }

  /* ---------- примитивы ---------- */
  function outlined(ctx, fill, lw = 2.4) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  function poly(ctx, pts, fill, lw) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    if (fill) outlined(ctx, fill, lw);
  }
  function circle(ctx, x, y, r, fill, lw) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    outlined(ctx, fill, lw);
  }

  /* Сужающаяся конечность. ang = 0 — вниз, плюс — вперёд */
  function limb(ctx, x, y, len, ang, w0, w1, fill) {
    const ex = x + Math.sin(ang) * len;
    const ey = y + Math.cos(ang) * len;
    const nx = Math.cos(ang), ny = -Math.sin(ang);
    ctx.beginPath();
    ctx.moveTo(x + nx * w0, y + ny * w0);
    ctx.lineTo(ex + nx * w1, ey + ny * w1);
    ctx.arc(ex, ey, w1, ang < 0 ? 0 : 0, TAU);
    ctx.lineTo(x - nx * w0, y - ny * w0);
    ctx.arc(x, y, w0, 0, TAU);
    ctx.closePath();
    // простая заливка без внутренних дуг
    ctx.beginPath();
    ctx.moveTo(x + nx * w0, y + ny * w0);
    ctx.lineTo(ex + nx * w1, ey + ny * w1);
    ctx.quadraticCurveTo(ex + Math.sin(ang) * w1 * 1.4, ey + Math.cos(ang) * w1 * 1.4, ex - nx * w1, ey - ny * w1);
    ctx.lineTo(x - nx * w0, y - ny * w0);
    ctx.quadraticCurveTo(x - Math.sin(ang) * w0 * 1.3, y - Math.cos(ang) * w0 * 1.3, x + nx * w0, y + ny * w0);
    ctx.closePath();
    outlined(ctx, fill);
    return [ex, ey];
  }

  /* ---------- оружие: рукоять в (0,0), клинок вверх ---------- */
  const WEAPON_DRAW = {
    sword(c, m) {
      poly(c, [[-3.5, -6], [3.5, -6], [3, -52], [0, -60], [-3, -52]], m.metal);
      c.strokeStyle = m.edge; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, -55); c.stroke();
      poly(c, [[-9, -8], [9, -8], [9, -4], [-9, -4]], m.leather);
      poly(c, [[-2, -4], [2, -4], [2, 9], [-2, 9]], m.wood);
      circle(c, 0, 11, 3, m.metal, 1.6);
    },
    axe(c, m) {
      poly(c, [[-2.4, 12], [2.4, 12], [2.2, -52], [-2.2, -52]], m.wood);
      c.beginPath(); c.moveTo(2, -50); c.quadraticCurveTo(24, -58, 24, -38); c.quadraticCurveTo(24, -26, 14, -28); c.quadraticCurveTo(8, -34, 2, -32); c.closePath();
      outlined(c, m.metal);
      c.strokeStyle = m.edge; c.lineWidth = 1.6; c.beginPath(); c.moveTo(22, -54); c.quadraticCurveTo(26, -40, 22, -30); c.stroke();
    },
    hammer(c, m) {
      poly(c, [[-2.4, 12], [2.4, 12], [2.4, -40], [-2.4, -40]], m.wood);
      poly(c, [[-15, -56], [15, -56], [17, -36], [-17, -36]], m.metal);
      poly(c, [[-15, -56], [15, -56], [14, -52], [-14, -52]], m.edge, 1);
    },
    spear(c, m) {
      poly(c, [[-1.8, 20], [1.8, 20], [1.6, -66], [-1.6, -66]], m.wood);
      poly(c, [[0, -90], [6, -70], [2, -64], [-2, -64], [-6, -70]], m.metal);
      c.strokeStyle = m.edge; c.lineWidth = 1.1; c.beginPath(); c.moveTo(0, -86); c.lineTo(0, -68); c.stroke();
    },
    dagger(c, m) {
      poly(c, [[-3, -5], [3, -5], [2, -28], [0, -35], [-2, -28]], m.metal);
      poly(c, [[-6, -6], [6, -6], [6, -3], [-6, -3]], m.leather);
      poly(c, [[-1.8, -3], [1.8, -3], [1.8, 7], [-1.8, 7]], m.wood);
    },
    saber(c, m) {
      c.beginPath(); c.moveTo(-2.5, -6); c.quadraticCurveTo(-6, -32, 8, -56); c.quadraticCurveTo(4, -32, 3.5, -6); c.closePath();
      outlined(c, m.metal);
      c.beginPath(); c.moveTo(-8, -4); c.quadraticCurveTo(0, 8, 8, -4); c.lineWidth = 2.4; c.strokeStyle = m.leather; c.stroke();
      poly(c, [[-2, -4], [2, -4], [2, 8], [-2, 8]], m.wood);
    },
    kris(c, m) {
      c.beginPath(); c.moveTo(-3, -5);
      c.quadraticCurveTo(-6, -12, -2, -17); c.quadraticCurveTo(2, -22, -1, -28); c.quadraticCurveTo(-3, -33, 0, -40);
      c.quadraticCurveTo(5, -33, 4, -27); c.quadraticCurveTo(6, -22, 3, -16); c.quadraticCurveTo(6, -10, 3, -5); c.closePath();
      outlined(c, m.metal);
      poly(c, [[-5, -6], [5, -6], [5, -3], [-5, -3]], m.leather);
      poly(c, [[-1.8, -3], [1.8, -3], [3, 7], [-1, 7]], m.wood);
    },
    staff(c, m) {
      poly(c, [[-2.2, 24], [2.2, 24], [1.8, -60], [-1.8, -60]], m.wood);
      c.beginPath(); c.moveTo(0, -60); c.quadraticCurveTo(-13, -72, -5, -82); c.quadraticCurveTo(5, -86, 7, -76); c.lineWidth = 3.4; c.strokeStyle = m.wood; c.stroke();
      circle(c, 0, -73, 5, m.glow || '#ff9a3c', 1.6);
    },
    wand(c, m) {
      poly(c, [[-1.6, 6], [1.6, 6], [1.1, -32], [-1.1, -32]], m.wood);
      poly(c, [[0, -44], [4, -36], [0, -30], [-4, -36]], m.glow || '#ff9a3c', 1.6);
    },
    scythe(c, m) {
      poly(c, [[-2, 26], [2, 26], [2, -62], [-2, -62]], m.wood);
      c.beginPath(); c.moveTo(0, -62); c.quadraticCurveTo(34, -70, 44, -46); c.quadraticCurveTo(28, -58, 0, -50); c.closePath();
      outlined(c, m.metal);
      c.strokeStyle = m.edge; c.lineWidth = 1.3; c.beginPath(); c.moveTo(42, -47); c.quadraticCurveTo(28, -64, 2, -60); c.stroke();
    },
    lyre(c, m) {
      c.beginPath(); c.moveTo(-10, 2); c.quadraticCurveTo(-18, -18, -11, -32); c.lineWidth = 4.4; c.strokeStyle = INK; c.stroke();
      c.lineWidth = 2.6; c.strokeStyle = m.metal; c.stroke();
      c.beginPath(); c.moveTo(10, 2); c.quadraticCurveTo(18, -18, 11, -32); c.lineWidth = 4.4; c.strokeStyle = INK; c.stroke();
      c.lineWidth = 2.6; c.strokeStyle = m.metal; c.stroke();
      poly(c, [[-11, -34], [11, -34], [11, -30], [-11, -30]], m.wood, 1.6);
      poly(c, [[-11, 0], [11, 0], [8, 8], [-8, 8]], m.wood, 1.6);
      c.strokeStyle = m.edge; c.lineWidth = 0.9;
      for (const x of [-6, -2, 2, 6]) { c.beginPath(); c.moveTo(x, -30); c.lineTo(x, 0); c.stroke(); }
    },
    fist() {},
    knife(c, m) { WEAPON_DRAW.dagger(c, m); },
    pitchfork(c, m) {
      poly(c, [[-1.8, 24], [1.8, 24], [1.6, -56], [-1.6, -56]], m.wood);
      poly(c, [[-10, -60], [10, -60], [10, -55], [-10, -55]], m.metal, 1.6);
      for (const x of [-9, 0, 9]) poly(c, [[x - 1.6, -60], [x + 1.6, -60], [x, -80]], m.metal, 1.4);
    },
    hook(c, m) {
      poly(c, [[-2, 28], [2, 28], [1.8, -70], [-1.8, -70]], m.wood);
      c.beginPath(); c.moveTo(0, -68); c.quadraticCurveTo(16, -84, 4, -96); c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
      c.lineWidth = 3; c.strokeStyle = m.metal; c.stroke();
    },
    stone(c, m) {
      poly(c, [[-2.2, 10], [2.2, 10], [2.2, -30], [-2.2, -30]], m.wood);
      circle(c, 0, -42, 18, '#8c8678');
      circle(c, 0, -42, 4, '#3e3a34', 1.6);
    },
  };

  const OFFHAND_DRAW = {
    shield(c, m) {
      c.beginPath(); c.moveTo(-15, -22); c.quadraticCurveTo(0, -27, 15, -22); c.lineTo(14, 8); c.quadraticCurveTo(0, 28, -14, 8); c.closePath();
      outlined(c, m.leather);
      c.beginPath(); c.moveTo(-10, -18); c.quadraticCurveTo(0, -22, 10, -18); c.lineTo(9, 6); c.quadraticCurveTo(0, 20, -9, 6); c.closePath();
      c.strokeStyle = m.metal; c.lineWidth = 2; c.stroke();
      circle(c, 0, -2, 4.4, m.metal, 1.6);
    },
    buckler(c, m) {
      circle(c, 0, 0, 13, m.metal);
      circle(c, 0, 0, 8, m.leather, 1.6);
      circle(c, 0, 0, 3, m.edge, 1.2);
    },
    tome(c, m) {
      poly(c, [[-11, -14], [11, -14], [11, 14], [-11, 14]], m.leather);
      poly(c, [[-8, -11], [8, -11], [8, 11], [-8, 11]], dark(m.leather, 0.2), 1);
      c.fillStyle = m.glow || '#c8b48a'; c.font = '11px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ᛉ', 0, 0);
    },
    lantern(c, m, t = 0) {
      c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -18); c.lineTo(0, -10); c.stroke();
      poly(c, [[-8, -11], [8, -11], [9, 9], [-9, 9]], m.metal);
      const flick = 0.75 + Math.sin(t * 9) * 0.1;
      poly(c, [[-5, -7], [5, -7], [6, 6], [-6, 6]], m.glow || '#ffcf7a', 1);
      c.fillStyle = alpha('#fff2c0', flick); c.beginPath(); c.arc(0, 0, 3.4, 0, TAU); c.fill();
    },
  };

  /* ---------- гуманоид ---------- */
  const IDLE_POSE = {
    go: 0, dx: 0, dy: 0, rot: 0, lean: 0.05, head: 0, as: 0.14, ae: 0.75, bs: 0.42, be: 0.75,
    fh: 0.2, fk: 0.12, bh: -0.2, bk: 0.26, wr: 0, crouch: 0, jaw: 0, flap: 0, alpha: 1,
  };

  /* Свечение заточки: ореол рисуется под вещью, по клинку ползут искры */
  const SHARP_COLORS = ['#ffb45a', '#ffd27a', '#8fe6ff'];
  const WEAPON_REACH = { sword: 58, axe: 52, hammer: 54, spear: 88, dagger: 33, saber: 54, kris: 38, staff: 82, wand: 42, scythe: 62, lyre: 34 };
  const sharpColor = level => SHARP_COLORS[Math.min(level, SHARP_COLORS.length) - 1];

  function sharpHalo(c, level, t, redraw) {
    const pulse = 0.75 + Math.sin(t * 3.4) * 0.25;
    // рисуем далеко за краем: на холст попадает только тень-ореол
    const m = c.getTransform();
    c.save();
    c.setTransform(m.a, m.b, m.c, m.d, m.e - 6000, m.f);
    c.shadowOffsetX = 6000;
    c.shadowColor = sharpColor(level);
    c.shadowBlur = (6 + level * 6) * pulse * Math.abs(m.d || 1);
    c.globalCompositeOperation = 'lighter';
    redraw();
    if (level > 1) redraw();
    c.restore();
  }

  function sharpSparks(c, level, t, reach) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = sharpColor(level);
    for (let i = 0; i < level * 3; i++) {
      const p = ((t * (0.35 + i * 0.04)) + i * 0.37) % 1;
      c.globalAlpha = Math.sin(p * Math.PI) * 0.9;
      c.beginPath();
      c.arc(Math.sin(i * 2.4 + t * 2) * (3 + level), -reach * p, 0.9 + (i % 3) * 0.4, 0, TAU);
      c.fill();
    }
    c.restore();
  }

  function drawGreathelm(c, m) {
    c.beginPath(); c.moveTo(-10, -9); c.lineTo(-10, 8); c.lineTo(10, 8); c.lineTo(10, -9); c.quadraticCurveTo(0, -14, -10, -9); c.closePath();
    outlined(c, m.metal);
    c.fillStyle = INK; c.fillRect(1, -2, 9, 2.4);
    c.fillRect(5, 0, 1.6, 6);
  }

  function drawHead(c, look, helmetItem, t) {
    const kind = helmetItem ? helmetItem.kind : (look.helmet || 'none');
    const m = material(helmetItem);
    const skin = look.skin || '#c2a68c';
    // лицо
    if (kind !== 'greathelm') {
      c.beginPath();
      c.moveTo(-8, -10); c.quadraticCurveTo(9, -14, 9.5, 0); c.lineTo(8, 7); c.quadraticCurveTo(0, 11, -7, 7); c.closePath();
      outlined(c, skin);
      if (look.faceless) {
        c.fillStyle = alpha('#d8d0bc', 0.8); c.beginPath(); c.ellipse(3, 0, 6, 8, 0, 0, TAU); c.fill();
      } else if (look.hollow) {
        c.fillStyle = look.eye || '#ff7c56';
        c.beginPath(); c.arc(4.5, -1, 1.7, 0, TAU); c.fill();
      } else {
        c.fillStyle = INK; c.fillRect(3, -2.4, 3.6, 2);
        c.fillStyle = dark(skin, 0.3); c.fillRect(2.5, 3.6, 5, 1.2);
      }
    }
    if (kind === 'none' || kind === 'crown') {
      if (look.hair) {
        c.beginPath();
        c.moveTo(-9, 4); c.quadraticCurveTo(-13, -14, 4, -13); c.quadraticCurveTo(10, -12, 9.5, -7);
        c.quadraticCurveTo(0, -8, -3, -3); c.quadraticCurveTo(-3, 2, -9, 4); c.closePath();
        outlined(c, look.hair, 2);
      }
    }
    if (kind === 'hood') {
      const col = helmetItem ? m.cloth : (look.cloth || '#463c34');
      c.beginPath();
      c.moveTo(-12, 10); c.quadraticCurveTo(-16, -16, 3, -16); c.quadraticCurveTo(13, -14, 12, -3); c.lineTo(5, -9); c.quadraticCurveTo(-3, -8, -3, 4); c.lineTo(-3, 11); c.closePath();
      outlined(c, col, 2.2);
    }
    if (kind === 'kettle') {
      c.beginPath(); c.moveTo(-9, -5); c.quadraticCurveTo(-8, -17, 2, -17); c.quadraticCurveTo(10, -17, 10, -5); c.closePath();
      outlined(c, m.metal, 2.2);
      c.beginPath(); c.moveTo(-14, -5); c.lineTo(15, -5); c.lineTo(13, -2); c.lineTo(-12, -2); c.closePath();
      outlined(c, m.edge, 1.8);
    }
    if (kind === 'greathelm') drawGreathelm(c, m);
    if (kind === 'crown') {
      poly(c, [[-9, -9], [-10, -16], [-5, -12], [0, -18], [5, -12], [10, -16], [9, -9]], m.glow || m.metal, 1.8);
    }
  }

  function drawTorso(c, look, chest, build) {
    const kind = chest ? chest.kind : (look.chest || 'leather');
    const m = material(chest);
    const base = look.cloth || '#4a4038';
    const col = chest ? (kind === 'robe' ? m.cloth : kind === 'leather' ? m.leather : m.metal) : base;
    const w = 15 * build;
    c.beginPath();
    c.moveTo(-w * 0.9, -46); c.quadraticCurveTo(0, -52, w, -46);
    c.quadraticCurveTo(w * 1.05, -22, w * 0.78, 0);
    c.lineTo(-w * 0.76, 0); c.quadraticCurveTo(-w * 1.02, -22, -w * 0.9, -46);
    c.closePath();
    outlined(c, col);
    // тень на спине
    c.save(); c.clip();
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(-w * 1.2, -52, w * 0.9, 60);
    c.restore();
    if (kind === 'mail') {
      c.fillStyle = alpha(m.edge, 0.4);
      for (let y = -42; y < -2; y += 5) for (let x = -w * 0.7 + (y % 2 ? 2 : 0); x < w * 0.8; x += 5) { c.beginPath(); c.arc(x, y, 1, 0, TAU); c.fill(); }
      poly(c, [[-w * 0.8, -6], [w * 0.8, -6], [w * 0.8, 0], [-w * 0.8, 0]], m.leather, 1.6);
    }
    if (kind === 'plate') {
      c.strokeStyle = alpha(m.edge, 0.6); c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(0, -46); c.lineTo(0, -6); c.stroke();
      c.beginPath(); c.moveTo(-w * 0.7, -22); c.quadraticCurveTo(0, -16, w * 0.7, -22); c.stroke();
      poly(c, [[-w * 0.8, -6], [w * 0.8, -6], [w * 0.8, 0], [-w * 0.8, 0]], m.leather, 1.6);
    }
    if (kind === 'leather') {
      c.strokeStyle = dark(col, 0.45); c.lineWidth = 2;
      c.beginPath(); c.moveTo(-w * 0.6, -44); c.lineTo(w * 0.6, -6); c.stroke();
      poly(c, [[-w * 0.82, -7], [w * 0.82, -7], [w * 0.8, -1], [-w * 0.8, -1]], dark(col, 0.5), 1.4);
    }
    if (kind === 'robe') {
      c.strokeStyle = look.trim || m.glow || '#c8b48a'; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(w * 0.42, -48); c.lineTo(w * 0.42, -2); c.stroke();
    }
    return { kind, col, m };
  }

  /* Главная функция куклы */
  function humanoid(c, look, gear, pose, t) {
    const b = look.build || 1;
    const weapon = gear.weapon, off = gear.offhand, chest = gear.chest, helmet = gear.helmet, gloves = gear.gloves, boots = gear.boots;
    const wm = material(weapon);
    const cloth = look.cloth || '#4a4038';
    const skin = look.skin || '#c2a68c';
    const crouch = pose.crouch || 0;
    const hipY = -70 + crouch * 14;
    const legW = 7 * b;
    const bootM = material(boots);
    const legCol = dark(cloth, 0.2);
    const bootKind = boots ? boots.kind : 'shoes';
    const bootCol = boots ? (bootKind === 'greaves' ? bootM.metal : bootM.leather) : dark(cloth, 0.55);

    const leg = (hip, knee, x, depth) => {
      const shade = depth ? dark(legCol, 0.28) : legCol;
      const k = limb(c, x, hipY, 36, hip, legW, legW * 0.75, shade);
      const a = limb(c, k[0], k[1], 34, hip - knee, legW * 0.72, legW * 0.55, depth ? dark(bootCol, 0.25) : bootCol);
      // ступня
      poly(c, [[a[0] - 5, a[1] - 3], [a[0] + 10, a[1] + 1], [a[0] + 10, a[1] + 5], [a[0] - 5, a[1] + 5]], depth ? dark(bootCol, 0.25) : bootCol, 2);
    };

    const gloveKind = gloves ? gloves.kind : null;
    const gm = material(gloves);
    const arm = (sAng, eAng, sx, sy, sleeve, gloveDark) => {
      // локоть гнётся назад: предплечье всегда идёт вперёд от плеча
      const e = limb(c, sx, sy, 26, sAng, 6 * b, 4.8 * b, sleeve);
      const hand = limb(c, e[0], e[1], 24, sAng + eAng, 4.6 * b, 3.8 * b, gloveKind ? (gloveKind === 'gauntlet' ? gm.metal : gm.leather) : (gloveDark ? dark(skin, 0.2) : skin));
      return { e, hand, ang: sAng + eAng };
    };

    c.save();
    c.translate(0, 0);

    const torsoLean = pose.lean || 0;
    const chestKind = chest ? chest.kind : (look.chest || 'leather');
    const sleeve = chest ? (chestKind === 'robe' ? material(chest).cloth : chestKind === 'leather' ? material(chest).leather : chestKind === 'plate' ? material(chest).metal : material(chest).metal) : cloth;

    // плащ висит за спиной, поэтому рисуется первым
    if (look.cape) {
      c.save(); c.translate(0, hipY); c.rotate(torsoLean);
      c.beginPath(); c.moveTo(-12, -48); c.quadraticCurveTo(-30 - Math.sin(t * 2) * 3, -10, -24 - Math.sin(t * 2.4) * 4, 30); c.lineTo(-4, 26); c.lineTo(-4, -46); c.closePath();
      outlined(c, look.cape);
      c.restore();
    }

    // Герой повёрнут к зрителю грудью: дальнее плечо впереди, ближнее сзади.
    // Дальняя нога и рука со щитом выдвинуты вперёд и лежат под корпусом.
    leg(pose.fh, pose.fk, 4, true);

    c.save();
    c.translate(0, hipY);
    c.rotate(torsoLean);
    const back = arm(pose.bs, pose.be, 9 * b, -42, dark(sleeve, 0.25), true);
    if (off) {
      c.save();
      c.translate(back.hand[0], back.hand[1]);
      c.rotate(-back.ang * 0.2);
      (OFFHAND_DRAW[off.kind] || OFFHAND_DRAW.shield)(c, material(off), t);
      c.restore();
    } else if (look.offKind) {
      c.save(); c.translate(back.hand[0], back.hand[1]);
      (OFFHAND_DRAW[look.offKind])(c, material({ rarity: 'rare', ilvl: 3 }), t);
      c.restore();
    }
    c.restore();

    leg(pose.bh, pose.bk, -3, false);

    // длинная мантия поверх ног
    if (chestKind === 'robe') {
      const m = material(chest);
      const col = chest ? m.cloth : cloth;
      c.beginPath();
      c.moveTo(-13 * b, hipY - 2); c.lineTo(13 * b, hipY - 2);
      c.quadraticCurveTo(18 * b + Math.sin(pose.fh) * 8, hipY + 30, 16 * b + Math.sin(pose.fh) * 10, hipY + 54);
      c.lineTo(-17 * b + Math.sin(pose.bh) * 8, hipY + 54);
      c.quadraticCurveTo(-18 * b, hipY + 30, -13 * b, hipY - 2);
      c.closePath();
      outlined(c, dark(col, 0.12));
      c.strokeStyle = look.trim || m.glow || '#c8b48a'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-16 * b, hipY + 50); c.lineTo(15 * b, hipY + 50); c.stroke();
    }

    // корпус
    c.save();
    c.translate(0, hipY);
    c.rotate(torsoLean);
    drawTorso(c, look, chest, b);

    // наплечник
    if (chestKind === 'plate' || chestKind === 'mail') {
      const m = material(chest);
      c.beginPath(); c.moveTo(-20 * b, -40); c.quadraticCurveTo(-22 * b, -54, -7 * b, -52); c.quadraticCurveTo(5, -50, 5, -42); c.quadraticCurveTo(-8, -38, -20 * b, -40); c.closePath();
      outlined(c, chest ? m.metal : '#6a6a6a');
    }

    // голова
    c.save();
    c.translate(3, -58);
    c.rotate(pose.head || 0);
    drawHead(c, look, helmet, t);
    c.restore();

    // ближняя рука с оружием лежит поверх корпуса
    const kind = weapon ? weapon.kind : look.weaponKind;
    const drawHeld = () => {
      if (kind === 'lyre') {
        // лиру держат за основание, струнами от себя
        c.save(); c.scale(0.86, 0.86); WEAPON_DRAW.lyre(c, wm); c.restore();
      } else {
        (WEAPON_DRAW[kind] || WEAPON_DRAW.sword)(c, wm);
      }
    };
    const front = arm(pose.as, pose.ae, -7 * b, -42, sleeve, false);
    if (weapon || look.weaponKind) {
      c.save();
      c.translate(front.hand[0], front.hand[1]);
      // кисть доворачивает оружие: на замахе клинок за плечом, на ударе вперёд
      const a = front.ang;
      const grip = kind === 'lyre' ? 0.2 + a * 0.12 : (a >= 0 ? a * 0.8 : a * 0.5) + (pose.wr || 0);
      c.rotate(grip);
      if (weapon && weapon.level) sharpHalo(c, weapon.level, t, drawHeld);
      drawHeld();
      if (wm.glow && (weapon && weapon.rarity !== 'uncommon') && kind !== 'lyre') {
        c.globalAlpha = 0.25 + Math.sin(t * 3) * 0.08;
        c.fillStyle = wm.glow;
        c.beginPath(); c.ellipse(0, -32, 7, 30, 0, 0, TAU); c.fill();
        c.globalAlpha = 1;
      }
      if (weapon && weapon.level) sharpSparks(c, weapon.level, t, WEAPON_REACH[kind] || 50);
      c.restore();
    }
    c.restore();
    c.restore();
  }

  /* ---------- звери ---------- */
  function wolf(c, u, pose, t) {
    const tint = u.tint, acc = u.accent;
    const walk = Math.sin(t * 3) * 0.05;
    const lean = pose.lean || 0;
    const jaw = pose.jaw || 0;
    c.save();
    c.rotate(lean * 0.6);
    const leg = (x, ph, dk) => {
      const col = dk ? dark(tint, 0.35) : dark(tint, 0.1);
      const k = limb(c, x, -34, 18, Math.sin(t * 3 + ph) * 0.1 + (pose.fh || 0) * 1.4, 6, 4.5, col);
      limb(c, k[0], k[1], 18, -0.2 + Math.sin(t * 3 + ph) * 0.06, 4.2, 3, dark(col, 0.2));
    };
    leg(-28, 1, true); leg(16, 3, true);
    // хвост
    c.beginPath(); c.moveTo(-40, -50); c.quadraticCurveTo(-62, -58 + walk * 40, -66, -36 + walk * 30); c.quadraticCurveTo(-54, -46, -38, -40); c.closePath();
    outlined(c, dark(tint, 0.15));
    // тело
    c.beginPath();
    c.moveTo(-42, -38); c.quadraticCurveTo(-46, -60, -24, -62); c.quadraticCurveTo(0, -56, 18, -66);
    c.quadraticCurveTo(32, -62, 30, -42); c.quadraticCurveTo(10, -30, -8, -32); c.quadraticCurveTo(-30, -28, -42, -38); c.closePath();
    outlined(c, tint);
    // шерсть
    c.strokeStyle = dark(tint, 0.4); c.lineWidth = 1.6;
    for (let i = 0; i < 7; i++) { const x = -34 + i * 9; c.beginPath(); c.moveTo(x, -58 + (i % 2) * 3); c.lineTo(x - 5, -49 + (i % 2) * 3); c.stroke(); }
    if (u.boss) {
      c.strokeStyle = acc; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-14, -60); c.lineTo(4, -38); c.moveTo(-4, -58); c.lineTo(8, -44); c.stroke();
    }
    leg(-20, 2.2, false); leg(24, 0.2, false);
    // голова
    c.save();
    c.translate(28, -60);
    c.rotate((pose.head || 0) + 0.1);
    // нижняя челюсть
    c.save(); c.translate(6, 6); c.rotate(jaw * 0.7);
    poly(c, [[-4, -1], [20, 0], [18, 5], [-3, 6]], dark(tint, 0.3));
    c.restore();
    c.beginPath();
    c.moveTo(-10, -8); c.lineTo(-6, -22); c.lineTo(0, -12); c.lineTo(6, -22); c.lineTo(10, -10);
    c.lineTo(30, -3); c.lineTo(30, 3); c.lineTo(6, 8); c.quadraticCurveTo(-8, 10, -12, 2); c.closePath();
    outlined(c, tint);
    c.fillStyle = acc; c.beginPath(); c.arc(10, -5, 2.4, 0, TAU); c.fill();
    c.fillStyle = alpha(acc, 0.25); c.beginPath(); c.arc(10, -5, 6, 0, TAU); c.fill();
    if (jaw > 0.2) { c.fillStyle = '#e8e0d0'; for (const x of [14, 20, 25]) { c.beginPath(); c.moveTo(x, 3); c.lineTo(x + 2, 8); c.lineTo(x + 4, 3); c.fill(); } }
    c.restore();
    c.restore();
  }

  function bird(c, u, pose, t) {
    const tint = u.tint, acc = u.accent;
    const flap = Math.sin(t * 7 + (pose.flap || 0)) * 0.55 + (pose.flap || 0) * 0.3;
    c.save();
    c.translate(0, -54 + Math.sin(t * 3) * 4);
    c.rotate(pose.lean || 0);
    const wing = (dir, dk) => {
      c.save(); c.translate(-2, -8); c.rotate(dir * (0.5 + flap));
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-30, -18, -58, -10); c.lineTo(-48, -2); c.lineTo(-52, 6); c.lineTo(-38, 4); c.lineTo(-38, 12); c.lineTo(-22, 8); c.quadraticCurveTo(-10, 8, 0, 6); c.closePath();
      outlined(c, dk ? dark(tint, 0.4) : dark(tint, 0.12));
      c.restore();
    };
    wing(1, true);
    c.beginPath(); c.moveTo(-24, 2); c.quadraticCurveTo(-8, -18, 14, -10); c.quadraticCurveTo(22, 4, 8, 14); c.quadraticCurveTo(-14, 16, -24, 2); c.closePath();
    outlined(c, tint);
    // голая шея и голова
    limb(c, 12, -8, 20, 2.2, 5, 4, '#a0604a');
    circle(c, 28, -20, 7.5, '#b0705a', 2);
    c.fillStyle = acc; c.beginPath(); c.arc(31, -22, 1.8, 0, TAU); c.fill();
    poly(c, [[34, -22], [48, -16], [34, -14]], '#d8b060', 1.8);
    wing(-1, false);
    limb(c, -2, 14, 12, 0.3, 2, 1.6, '#a88a50');
    limb(c, 6, 14, 12, 0.5, 2, 1.6, '#a88a50');
    c.restore();
  }

  function spirit(c, u, pose, t) {
    const tint = u.tint, acc = u.accent;
    c.save();
    c.translate(0, -48 + Math.sin(t * 2.6) * 5);
    c.rotate(pose.lean || 0);
    const grad = c.createRadialGradient(0, -6, 2, 0, 0, 46);
    grad.addColorStop(0, alpha(acc, 0.55)); grad.addColorStop(1, alpha(acc, 0));
    c.fillStyle = grad; c.beginPath(); c.arc(0, -4, 46, 0, TAU); c.fill();
    c.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * TAU;
      const fl = i > 3 && i < 9 ? 0 : Math.sin(t * 6 + i * 1.7) * 5;
      const r = (i >= 8 || i <= 4 ? 25 : 24) + fl;
      const x = Math.sin(a) * r * 0.86;
      const y = -Math.cos(a) * r * (i <= 2 || i >= 10 ? 1.5 : 0.92);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
    outlined(c, tint);
    c.fillStyle = acc; c.beginPath(); c.ellipse(0, 2, 14, 16, 0, 0, TAU); c.fill();
    c.fillStyle = '#fff2c0'; c.beginPath(); c.ellipse(0, 6, 7, 8, 0, 0, TAU); c.fill();
    c.fillStyle = INK; c.beginPath(); c.ellipse(-5, -3, 2.4, 3.6, 0, 0, TAU); c.ellipse(6, -3, 2.4, 3.6, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(1, 6, 3 + (pose.jaw || 0) * 3, 1.5 + (pose.jaw || 0) * 4, 0, 0, TAU); c.fill();
    c.restore();
  }

  function moth(c, u, pose, t) {
    const tint = u.tint, acc = u.accent;
    const f = Math.abs(Math.sin(t * 9)) * 0.75 + 0.25;
    c.save();
    c.translate(0, -52 + Math.sin(t * 4) * 7);
    c.rotate(pose.lean || 0);
    const wing = s => {
      c.save(); c.scale(s * f, 1);
      c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(24, -34, 42, -16); c.quadraticCurveTo(44, 2, 20, 8); c.quadraticCurveTo(34, 12, 28, 26); c.quadraticCurveTo(12, 28, 0, 8); c.closePath();
      outlined(c, tint);
      c.fillStyle = alpha(acc, 0.55); c.beginPath(); c.arc(27, -10, 6, 0, TAU); c.fill();
      c.fillStyle = INK; c.beginPath(); c.arc(27, -10, 2.2, 0, TAU); c.fill();
      c.restore();
    };
    wing(1); wing(-1);
    c.beginPath(); c.ellipse(0, 4, 5, 18, 0, 0, TAU); outlined(c, dark(tint, 0.35));
    circle(c, 0, -13, 4.6, dark(tint, 0.2), 1.8);
    c.strokeStyle = INK; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-2, -16); c.quadraticCurveTo(-8, -26, -12, -22); c.moveTo(2, -16); c.quadraticCurveTo(8, -26, 12, -22); c.stroke();
    c.restore();
  }

  function scarecrow(c, u, pose, t) {
    const tint = u.tint;
    const sway = Math.sin(t * 1.8) * 0.04 + (pose.lean || 0);
    c.save();
    c.rotate(sway);
    poly(c, [[-3, 0], [3, 0], [3, -120], [-3, -120]], '#4e3a26');
    // перекладина
    c.save(); c.translate(0, -98); c.rotate(-0.06 + (pose.as || 0) * 0.15);
    poly(c, [[-42, -3], [42, -3], [42, 3], [-42, 3]], '#4e3a26');
    c.restore();
    // лохмотья
    c.beginPath();
    c.moveTo(-34, -102); c.lineTo(34, -102); c.lineTo(28, -80); c.lineTo(18, -52 + Math.sin(t * 2) * 2); c.lineTo(8, -44); c.lineTo(0, -54); c.lineTo(-8, -40); c.lineTo(-18, -50 + Math.sin(t * 2.3) * 2); c.lineTo(-30, -78); c.closePath();
    outlined(c, tint);
    c.strokeStyle = dark(tint, 0.45); c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-18, -96); c.lineTo(-10, -60); c.moveTo(14, -98); c.lineTo(8, -60); c.stroke();
    // мешок-голова
    c.save(); c.translate(0, -118); c.rotate(0.14 + (pose.head || 0));
    c.beginPath(); c.moveTo(-13, 10); c.quadraticCurveTo(-18, -14, 0, -16); c.quadraticCurveTo(17, -14, 13, 10); c.closePath();
    outlined(c, '#b8a678');
    c.fillStyle = INK;
    c.beginPath(); c.arc(-4, -3, 2.6, 0, TAU); c.arc(7, -3, 2.6, 0, TAU); c.fill();
    c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-6, 5); for (let i = 0; i < 5; i++) c.lineTo(-6 + i * 3.5, 5 + (i % 2) * 2.6); c.stroke();
    poly(c, [[-14, -10], [14, -10], [22, -7], [-20, -7]], '#3a2c1c', 1.8);
    poly(c, [[-9, -9], [10, -9], [6, -24], [-6, -24]], '#3a2c1c', 1.8);
    c.restore();
    // вилы
    c.save(); c.translate(34, -94); c.rotate(0.14 + (pose.wr || 0));
    WEAPON_DRAW.pitchfork(c, material({ rarity: 'common', ilvl: 1 }));
    c.restore();
    c.restore();
  }

  /* ---------- твари Тихих Ключей ---------- */
  function leech(c, u, pose, t) {
    const tint = u.tint, acc = u.accent;
    const lunge = (pose.lean || 0) * 40;
    c.save();
    c.translate(lunge * 0.3, 0);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const p = i / (n - 1);
      const x = -46 + p * 86 + Math.sin(t * 3 + i * 0.9) * 2;
      const y = -12 - Math.sin(p * Math.PI) * 15 - Math.sin(t * 3 + i * 0.9) * 4 - (i > 4 ? lunge * 0.4 : 0);
      const r = 9 + Math.sin(p * Math.PI) * 10;
      c.beginPath(); c.ellipse(x, y, r * 0.95, r, 0, 0, TAU);
      outlined(c, i % 2 ? dark(tint, 0.14) : tint, 2.2);
    }
    // присоска с зубами
    const hx = 44 + Math.sin(t * 3) * 2, hy = -16 - lunge * 0.55;
    c.save(); c.translate(hx, hy); c.rotate(0.2 + (pose.head || 0));
    c.beginPath(); c.ellipse(4, 0, 11, 12 + (pose.jaw || 0) * 3, 0, 0, TAU); outlined(c, dark(tint, 0.35), 2.2);
    c.fillStyle = '#2a0d10'; c.beginPath(); c.ellipse(8, 0, 6, 8 + (pose.jaw || 0) * 3, 0, 0, TAU); c.fill();
    c.fillStyle = '#e8e0d0';
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; c.beginPath(); c.arc(8 + Math.cos(a) * 5, Math.sin(a) * 7, 1, 0, TAU); c.fill(); }
    c.restore();
    c.fillStyle = acc; c.beginPath(); c.arc(30, -29, 1.8, 0, TAU); c.fill();
    c.restore();
  }

  function toad(c, u, pose, t) {
    const tint = u.tint, acc = u.accent;
    const br = Math.sin(t * 2.6);
    const sack = 12 + br * 3 + (pose.jaw || 0) * 12;
    c.save();
    c.rotate((pose.lean || 0) * 0.4);
    limb(c, -32, -16, 16, -0.9, 8, 5, dark(tint, 0.3));
    limb(c, 20, -16, 16, 0.5, 6, 4, dark(tint, 0.3));
    c.beginPath();
    c.moveTo(-50, -6); c.quadraticCurveTo(-56, -52, -14, -64); c.quadraticCurveTo(30, -74, 44, -44); c.quadraticCurveTo(50, -18, 34, -4); c.quadraticCurveTo(-10, 4, -50, -6); c.closePath();
    outlined(c, tint);
    c.fillStyle = dark(tint, 0.28);
    for (const [x, y, r] of [[-30, -44, 5], [-14, -54, 4], [-36, -24, 4], [-8, -34, 3], [8, -56, 3]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    // горловой мешок
    c.beginPath(); c.ellipse(34, -16, sack, sack * 0.85, 0, 0, TAU); outlined(c, mix(tint, '#e8d8a8', 0.5), 2.2);
    // глаза и рот
    circle(c, 26, -62, 8, dark(tint, 0.1), 2);
    c.fillStyle = acc; c.beginPath(); c.arc(29, -62, 3.6, 0, TAU); c.fill();
    c.fillStyle = INK; c.fillRect(27, -63, 5, 1.6);
    c.strokeStyle = INK; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(14, -34); c.quadraticCurveTo(34, -30 + (pose.jaw || 0) * 6, 46, -38); c.stroke();
    limb(c, -24, -8, 12, 0.4, 7, 5, dark(tint, 0.15));
    limb(c, 22, -6, 10, 0.2, 5, 4, dark(tint, 0.15));
    c.restore();
  }

  function catfish(c, u, pose, t) {
    const tint = u.tint, acc = u.accent;
    const lean = pose.lean || 0;
    const sw = Math.sin(t * 2.2);
    c.save();
    c.translate(0, -56 + Math.sin(t * 1.6) * 4);
    c.rotate(lean * 0.55 - 0.05);
    // хвост
    c.save(); c.translate(-74, 2); c.rotate(sw * 0.3);
    c.beginPath(); c.moveTo(6, 0); c.quadraticCurveTo(-18, -14, -36, -24); c.quadraticCurveTo(-26, 0, -34, 22); c.quadraticCurveTo(-14, 12, 6, 0); c.closePath();
    outlined(c, dark(tint, 0.25));
    c.restore();
    // спинной плавник
    c.beginPath(); c.moveTo(-36, -26); c.quadraticCurveTo(-14, -56 - sw * 4, 12, -30); c.closePath(); outlined(c, dark(tint, 0.3));
    // тело
    c.beginPath();
    c.moveTo(-78, 2); c.quadraticCurveTo(-30, -38, 34, -30); c.quadraticCurveTo(70, -24, 76, 2); c.quadraticCurveTo(66, 30, 22, 32); c.quadraticCurveTo(-34, 32, -78, 2); c.closePath();
    outlined(c, tint);
    c.save(); c.clip();
    c.fillStyle = mix(tint, '#d8d8b8', 0.45);
    c.beginPath(); c.ellipse(4, 34, 74, 22, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(0,0,0,.2)';
    for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(-60 + i * 11, -8 + (i % 3) * 7, 3, 0, TAU); c.fill(); }
    c.restore();
    // боковой плавник
    c.save(); c.translate(-2, 14); c.rotate(0.6 + sw * 0.28);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-10, 26, -32, 30); c.quadraticCurveTo(-24, 8, -8, -4); c.closePath(); outlined(c, dark(tint, 0.25));
    c.restore();
    // пасть
    const jaw = pose.jaw || 0;
    c.fillStyle = '#1a0a0a';
    c.beginPath(); c.moveTo(40, 8); c.quadraticCurveTo(66, 4 - jaw * 6, 78, 3); c.quadraticCurveTo(70, 16 + jaw * 14, 42, 16 + jaw * 8); c.closePath(); c.fill();
    c.strokeStyle = INK; c.lineWidth = 2.2; c.stroke();
    // глаз
    circle(c, 44, -10, 6.5, '#d8d0a8', 2);
    c.fillStyle = acc; c.beginPath(); c.arc(46, -10, 3, 0, TAU); c.fill();
    // усы
    c.lineCap = 'round';
    for (const [x, y, a, l] of [[70, 5, 0.5, 38], [66, 12, 0.9, 46], [60, 15, 1.3, 34]]) {
      const wob = Math.sin(t * 2.4 + a * 4) * 8;
      c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l * 0.5, y + Math.sin(a) * l * 0.2 + wob, x + Math.cos(a) * l, y + Math.sin(a) * l + wob); c.stroke();
      c.strokeStyle = dark(tint, 0.1); c.lineWidth = 2; c.stroke();
    }
    c.restore();
  }

  /* Голос воды: столб воды, в котором проступают рты */
  function voiceColumn(c, u, pose, t) {
    const tint = u.tint, acc = u.accent;
    const lean = pose.lean || 0;
    c.save();
    c.rotate(lean * 0.35);
    const g = c.createRadialGradient(0, -80, 10, 0, -80, 110);
    g.addColorStop(0, alpha(acc, 0.4)); g.addColorStop(1, alpha(acc, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, -80, 110, 0, TAU); c.fill();
    c.beginPath();
    c.moveTo(-44, 4);
    for (let i = 0; i <= 10; i++) { const y = -i * 16; c.lineTo(-34 + i * 1.2 + Math.sin(t * 2.4 + i * 0.8) * 7, y); }
    c.quadraticCurveTo(0, -196 - Math.sin(t * 3) * 6, 22 + Math.sin(t * 2.2) * 6, -160);
    for (let i = 10; i >= 0; i--) { const y = -i * 16; c.lineTo(34 - i * 1.2 + Math.sin(t * 2.1 + i * 0.7) * 7, y); }
    c.lineTo(44, 4); c.closePath();
    outlined(c, tint);
    c.save(); c.clip();
    c.strokeStyle = alpha('#e8f6ff', 0.3); c.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const y = ((t * 26 + i * 30) % 210) - 195;
      c.beginPath(); c.moveTo(-40, y); c.quadraticCurveTo(0, y + 10 * Math.sin(i + t), 40, y - 2); c.stroke();
    }
    // рты открываются по очереди
    const jaw = pose.jaw || 0;
    for (const [x, y, ph] of [[-8, -130, 0], [12, -96, 1.7], [-12, -62, 3.1], [8, -28, 4.4]]) {
      const open = 0.25 + Math.max(0, Math.sin(t * 2.2 + ph)) * 0.7 + jaw * 0.5;
      c.fillStyle = '#071318'; c.beginPath(); c.ellipse(x, y, 10, 2.5 + open * 8, 0, 0, TAU); c.fill();
      c.strokeStyle = alpha(acc, 0.85); c.lineWidth = 1.4; c.stroke();
    }
    c.restore();
    // ленты-руки
    for (const [sx, dir] of [[26, 1], [-24, -1]]) {
      c.strokeStyle = INK; c.lineWidth = 11; c.lineCap = 'round';
      c.beginPath(); c.moveTo(sx, -110);
      c.quadraticCurveTo(sx + dir * 24, -110 - (pose.as || 0) * 18, sx + dir * 34 + Math.sin(t * 3) * 5, -76 - (pose.as || 0) * 30); c.stroke();
      c.strokeStyle = tint; c.lineWidth = 7; c.stroke();
    }
    c.restore();
  }

  /* ---------- твари Скола и Аш-Тара ---------- */
  function crawler(c, u, pose, t) {
    const tint = u.tint, acc = u.accent;
    const lunge = (pose.lean || 0) * 18;
    c.save();
    c.translate(lunge, 0);
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const x = -30 + i * 20;
        const wob = Math.sin(t * 7 + i * 1.6 + side) * 3;
        c.strokeStyle = INK; c.lineWidth = 6; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, -26); c.lineTo(x + side * 6 + wob, -38 + (side > 0 ? 6 : 0)); c.lineTo(x + side * 12 + wob, side > 0 ? 0 : -3); c.stroke();
        c.strokeStyle = dark(tint, side > 0 ? 0.1 : 0.4); c.lineWidth = 3; c.stroke();
      }
    }
    c.beginPath(); c.ellipse(-4, -30, 42, 26, 0, 0, TAU); outlined(c, tint);
    c.save(); c.clip();
    c.strokeStyle = dark(tint, 0.4); c.lineWidth = 2.4;
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-44 + i * 18, -60); c.quadraticCurveTo(-32 + i * 18, -30, -44 + i * 18, 0); c.stroke(); }
    c.fillStyle = alpha('#ffffff', 0.14); c.beginPath(); c.ellipse(-10, -44, 28, 8, -0.1, 0, TAU); c.fill();
    c.restore();
    c.beginPath(); c.ellipse(36, -26, 13, 12, 0, 0, TAU); outlined(c, dark(tint, 0.22));
    c.fillStyle = acc; for (const y of [-31, -22]) { c.beginPath(); c.arc(42, y, 2.4, 0, TAU); c.fill(); }
    c.strokeStyle = INK; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(47, -24); c.quadraticCurveTo(56, -20 + (pose.jaw || 0) * 6, 52, -12); c.moveTo(47, -29); c.quadraticCurveTo(58, -34 - (pose.jaw || 0) * 6, 56, -42); c.stroke();
    c.restore();
  }

  function golem(c, u, pose, t) {
    const tint = u.tint, acc = u.accent;
    const lean = pose.lean || 0;
    const heat = 0.55 + Math.sin(t * 2.4) * 0.25;
    c.save();
    c.rotate(lean * 0.5);
    const block = (x, y, w, h, f) => { poly(c, [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2 - 2], [x + w / 2 + 2, y + h / 2], [x - w / 2 - 2, y + h / 2 + 1]], f); };
    block(-16, -22, 22, 44, dark(tint, 0.35)); block(16, -22, 24, 44, dark(tint, 0.15));
    block(-2, -76, 66, 66, tint);
    c.fillStyle = alpha(acc, heat);
    for (const [x0, y0, x1, y1] of [[-22, -92, -4, -70], [-4, -70, -14, -48], [8, -96, 20, -66], [-4, -70, 12, -78]]) { c.strokeStyle = alpha(acc, heat); c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    block(0, -122, 34, 28, dark(tint, 0.1));
    c.fillStyle = acc; c.fillRect(2, -127, 11, 5);
    c.save(); c.translate(-38, -100); c.rotate((pose.bs || 0) * 0.5 - 0.15); block(0, 24, 22, 56, dark(tint, 0.3)); c.restore();
    c.save(); c.translate(34, -100); c.rotate(-((pose.as || 0) - 0.1) * 0.9);
    block(0, 22, 24, 52, dark(tint, 0.08));
    if (u.boss) {
      poly(c, [[-14, 48], [14, 48], [0, 94]], '#9a9aa4');
      c.strokeStyle = INK; c.lineWidth = 1.6;
      for (const y of [58, 68, 78]) { c.beginPath(); c.moveTo(-10 + (y - 48) * 0.3, y); c.lineTo(10 - (y - 48) * 0.3, y + 3); c.stroke(); }
    } else block(0, 58, 32, 24, dark(tint, 0.2));
    c.restore();
    c.restore();
  }

  function furnace(c, u, pose, t) {
    const tint = u.tint, acc = u.accent;
    const jaw = pose.jaw || 0;
    const fl = 0.8 + Math.sin(t * 7) * 0.12;
    c.save();
    c.rotate((pose.lean || 0) * 0.12);
    const g = c.createRadialGradient(10, -62, 4, 10, -62, 130);
    g.addColorStop(0, alpha(acc, 0.5 * fl)); g.addColorStop(1, alpha(acc, 0));
    c.fillStyle = g; c.beginPath(); c.arc(10, -62, 130, 0, TAU); c.fill();
    poly(c, [[-22, -130], [10, -130], [8, -196], [-20, -196]], dark(tint, 0.25));
    c.beginPath(); c.moveTo(-70, 0); c.lineTo(-66, -90); c.quadraticCurveTo(-30, -146, 28, -128); c.quadraticCurveTo(68, -110, 72, -60); c.lineTo(72, 0); c.closePath();
    outlined(c, tint);
    c.save(); c.clip();
    c.strokeStyle = dark(tint, 0.42); c.lineWidth = 1.6;
    for (let y = -130; y < 0; y += 14) { c.beginPath(); c.moveTo(-72, y); c.lineTo(76, y); c.stroke(); for (let x = -70 + (y % 28 ? 16 : 0); x < 76; x += 32) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 14); c.stroke(); } }
    c.restore();
    // устье и лицо
    const my = -60;
    c.beginPath(); c.moveTo(-30, my + 34); c.lineTo(-26, my - 18); c.quadraticCurveTo(14, my - 44, 52, my - 14); c.lineTo(56, my + 34 + jaw * 10); c.closePath();
    outlined(c, '#1a0a06');
    const inner = c.createRadialGradient(14, my + 8, 3, 14, my + 8, 48);
    inner.addColorStop(0, '#fff0b0'); inner.addColorStop(0.45, acc); inner.addColorStop(1, '#5a1a08');
    c.fillStyle = inner; c.beginPath(); c.moveTo(-24, my + 30); c.lineTo(-20, my - 14); c.quadraticCurveTo(14, my - 36, 48, my - 10); c.lineTo(52, my + 30 + jaw * 10); c.closePath(); c.fill();
    c.fillStyle = alpha('#3a0e04', 0.85);
    c.beginPath(); c.ellipse(2, my - 4, 6, 3.4, 0.2, 0, TAU); c.ellipse(28, my - 6, 6, 3.4, -0.2, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(16, my + 14, 12, 3 + jaw * 7, 0, 0, TAU); c.fill();
    poly(c, [[-34, my - 22 - jaw * 16], [58, my - 18 - jaw * 16], [58, my - 28 - jaw * 16], [-34, my - 32 - jaw * 16]], '#3a3430');
    c.restore();
  }

  function crystal(c, u, pose, t) {
    const tint = u.tint, acc = u.accent;
    c.save();
    c.rotate((pose.lean || 0) * 0.2);
    const g = c.createRadialGradient(0, -50, 4, 0, -50, 70);
    g.addColorStop(0, alpha(acc, 0.3 + Math.sin(t * 2) * 0.1)); g.addColorStop(1, alpha(acc, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, -50, 70, 0, TAU); c.fill();
    for (const [x, h, w, lean, d] of [[-30, 66, 18, -0.3, 0.3], [30, 74, 20, 0.28, 0.25], [-12, 112, 24, -0.1, 0.1], [14, 94, 22, 0.14, 0]]) {
      c.save(); c.translate(x, 0); c.rotate(lean);
      poly(c, [[-w / 2, 0], [w / 2, 0], [w / 2 - 2, -h * 0.76], [0, -h], [-w / 2 + 2, -h * 0.76]], dark(tint, d));
      c.fillStyle = alpha('#ffffff', 0.16); c.beginPath(); c.moveTo(-w / 2 + 2, -4); c.lineTo(-1, -4); c.lineTo(-1, -h * 0.94); c.lineTo(-w / 2 + 3, -h * 0.76); c.closePath(); c.fill();
      c.strokeStyle = alpha(acc, 0.65); c.lineWidth = 1.2; c.beginPath(); c.moveTo(w * 0.15, -8); c.lineTo(w * 0.08, -h * 0.7); c.stroke();
      c.restore();
    }
    c.restore();
  }

  function veinHeart(c, u, pose, t) {
    const tint = u.tint, acc = u.accent;
    const beat = 1 + Math.pow(Math.max(0, Math.sin(t * 2.6)), 8) * 0.08 + (pose.jaw || 0) * 0.05;
    c.save();
    c.translate(0, -92);
    c.rotate((pose.lean || 0) * 0.14);
    const g = c.createRadialGradient(0, 0, 8, 0, 0, 130);
    g.addColorStop(0, alpha(acc, 0.42)); g.addColorStop(1, alpha(acc, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 130, 0, TAU); c.fill();
    c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = 0.3 + i * 0.42, l = 80 + (i % 3) * 22, sw = Math.sin(t * 1.6 + i) * 6;
      c.strokeStyle = INK; c.lineWidth = 11;
      c.beginPath(); c.moveTo(0, 20); c.quadraticCurveTo(Math.cos(a) * l * 0.6 + sw, Math.sin(a) * l * 0.5 + 24, Math.cos(a) * l + sw, 92); c.stroke();
      c.strokeStyle = dark(tint, 0.15); c.lineWidth = 7; c.stroke();
    }
    c.scale(beat, beat);
    c.beginPath();
    c.moveTo(0, 62); c.quadraticCurveTo(-72, 18, -60, -28); c.quadraticCurveTo(-48, -62, -14, -46); c.quadraticCurveTo(0, -40, 8, -52); c.quadraticCurveTo(46, -74, 62, -30); c.quadraticCurveTo(72, 18, 0, 62); c.closePath();
    outlined(c, tint);
    c.save(); c.clip();
    c.strokeStyle = alpha(acc, 0.8); c.lineWidth = 2.4;
    for (const [x0, y0, x1, y1, x2, y2] of [[-40, -30, -14, 0, -22, 40], [26, -44, 10, -8, 20, 40], [-10, -36, 0, -6, -4, 30], [44, -14, 22, 10, 30, 28]]) { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x1, y1, x2, y2); c.stroke(); }
    c.fillStyle = alpha('#ffffff', 0.16); c.beginPath(); c.ellipse(-22, -24, 18, 10, -0.5, 0, TAU); c.fill();
    c.restore();
    c.restore();
  }

  /* Финальный враг: сам герой, только из пепла. Его вещи, его осанка, но лица нет */
  function questionFigure(c, u, pose, t) {
    const st = typeof Game !== 'undefined' && Game.state;
    const hero = st && st.hero;
    const look = hero ? Object.assign({}, CLASSES[hero.classId].look) : { build: 1 };
    Object.assign(look, { skin: '#e4dfd6', cloth: '#b4aea4', trim: u.accent, faceless: true, hollow: false, hair: '#9a948a', cape: '#8a8478' });
    const gear = {};
    if (hero) for (const k of ['weapon', 'offhand', 'chest', 'boots', 'gloves']) { const it = hero.equipment[k]; if (it) gear[k] = Object.assign({}, it, { rarity: 'common', level: 0 }); }
    if (!gear.weapon) look.weaponKind = 'sword';
    // пепел сыплется с него снизу вверх
    c.save();
    for (let i = 0; i < 26; i++) {
      const p = ((t * 0.14) + i * 0.073) % 1;
      c.globalAlpha = (1 - p) * 0.7;
      c.fillStyle = i % 4 ? '#c8c2b8' : u.accent;
      c.fillRect(Math.sin(i * 3.1 + t) * (24 + p * 30), -150 * p - 6, 2.4, 2.4);
    }
    c.restore();
    humanoid(c, look, gear, pose, t);
  }

  /* Как выглядят гуманоиды-враги */
  const ENEMY_LOOKS = {
    miner: u => ({ look: { skin: '#8a7a68', cloth: u.tint, helmet: 'kettle', chest: 'leather', build: 1.06, hollow: true, eye: u.accent }, weaponKind: 'axe' }),
    smelter: u => ({ look: { skin: '#a8805c', cloth: u.tint, trim: u.accent, helmet: 'hood', chest: 'robe', hollow: true, eye: u.accent, build: 1.02 }, weaponKind: 'hammer' }),
    copperman: u => ({ look: { skin: '#b07c48', cloth: '#7c5430', hair: '#4a7a68', chest: 'leather', hollow: true, eye: u.accent, build: 1 }, weaponKind: 'axe' }),
    driver: u => ({ look: { skin: '#7a7468', cloth: u.tint, helmet: 'hood', chest: 'leather', faceless: true, build: 1.02, cape: '#3a3630' }, weaponKind: 'saber' }),
    caravan: u => ({ look: { skin: '#8a8478', cloth: u.tint, helmet: 'kettle', chest: 'mail', hollow: true, eye: u.accent, build: 1.16, cape: '#3a3630' }, weaponKind: 'hook' }),
    gatekeeper: u => ({ look: { cloth: u.tint, chest: 'plate', helmet: 'greathelm', build: 1.14, cape: '#4a3a24', offKind: 'shield' }, weaponKind: 'spear' }),
    archer: u => ({ look: { skin: '#6a6a60', cloth: u.tint, helmet: 'hood', chest: 'leather', hollow: true, eye: u.accent, build: 0.96 }, weaponKind: 'spear' }),
    warden_gate: u => ({ look: { cloth: u.tint, chest: 'plate', helmet: 'greathelm', build: 1.24, cape: '#5a4426', offKind: 'shield' }, weaponKind: 'hammer' }),
    hor: u => ({ look: { skin: '#e8e4da', cloth: u.tint, trim: u.accent, helmet: 'crown', chest: 'robe', faceless: true, build: 1 }, weaponKind: 'staff' }),
    nameless: u => ({ look: { skin: '#14121a', cloth: u.tint, chest: 'leather', faceless: true, build: 1.04, cape: '#14121a' }, weaponKind: 'kris' }),
    drowned: u => ({ look: { skin: '#7d9188', cloth: u.tint, hair: '#27332c', chest: 'leather', build: 1.04, hollow: true, eye: u.accent }, weaponKind: 'hook' }),
    veiled: u => ({ look: { skin: '#c8c0b4', cloth: u.tint, trim: u.accent, chest: 'robe', helmet: 'hood', faceless: true, build: 0.96 }, weaponKind: 'wand' }),
    mirror: u => ({ look: { skin: '#b4c4d0', cloth: u.tint, trim: u.accent, chest: 'plate', faceless: true, build: 1 }, weaponKind: 'saber' }),
    ringer: u => ({ look: { skin: '#62756e', cloth: u.tint, hair: '#1e2a26', chest: 'mail', hollow: true, eye: u.accent, build: 1.16, cape: '#1c2a2c' }, weaponKind: 'hammer' }),
    abbess: u => ({ look: { skin: '#e2dccf', cloth: u.tint, trim: u.accent, chest: 'robe', helmet: 'hood', faceless: true, build: 1.14, offKind: 'tome', cape: '#222830' }, weaponKind: 'staff' }),
    robed: u => ({ look: { skin: '#a48b74', cloth: u.tint, trim: u.accent, helmet: 'hood', chest: 'robe', build: 0.96 }, weaponKind: 'knife' }),
    ragged: u => ({ look: { skin: '#4a3a30', cloth: u.tint, hair: '#1c1612', chest: 'leather', build: 0.98, hollow: true, eye: u.accent }, weaponKind: 'fist' }),
    ashen: u => ({ look: { skin: '#7a7078', cloth: u.tint, chest: 'leather', build: 1, hollow: true, eye: u.accent }, weaponKind: 'sword' }),
    knight: u => ({ look: { cloth: u.tint, chest: 'plate', helmet: 'greathelm', build: 1.1, cape: '#3a3f4e' }, weaponKind: 'sword', metal: true }),
    miller: u => ({ look: { skin: '#d8d0bc', cloth: '#a89f8c', trim: '#6a6250', chest: 'robe', faceless: true, helmet: 'none', build: 1.2 }, weaponKind: 'stone' }),
    keeper: u => ({ look: { skin: '#6a7078', cloth: '#3a4250', trim: '#ffe08a', chest: 'robe', helmet: 'hood', hollow: true, eye: '#ffe08a', build: 1.1, offKind: 'lantern', cape: '#2a303a' }, weaponKind: 'hook' }),
    shadow: u => ({ look: { skin: '#1a1820', cloth: '#1e1c26', chest: 'leather', hollow: true, eye: '#9a8ad0', build: 1, cape: '#16141c' }, weaponKind: 'sword' }),
  };

  function drawEnemy(c, u, pose, t) {
    const shape = u.shape;
    if (shape === 'wolf' || shape === 'rat') return wolf(c, u, pose, t);
    if (shape === 'bird') return bird(c, u, pose, t);
    if (shape === 'spirit') return spirit(c, u, pose, t);
    if (shape === 'moth') return moth(c, u, pose, t);
    if (shape === 'scarecrow') return scarecrow(c, u, pose, t);
    if (shape === 'leech') return leech(c, u, pose, t);
    if (shape === 'toad') return toad(c, u, pose, t);
    if (shape === 'catfish') return catfish(c, u, pose, t);
    if (shape === 'voice') return voiceColumn(c, u, pose, t);
    if (shape === 'crawler') return crawler(c, u, pose, t);
    if (shape === 'golem') return golem(c, u, pose, t);
    if (shape === 'furnace') return furnace(c, u, pose, t);
    if (shape === 'crystal') return crystal(c, u, pose, t);
    if (shape === 'heart') return veinHeart(c, u, pose, t);
    if (shape === 'question') return questionFigure(c, u, pose, t);
    const cfg = (ENEMY_LOOKS[u.look] || ENEMY_LOOKS.robed)(u);
    const gear = {};
    if (cfg.weaponKind) cfg.look.weaponKind = cfg.weaponKind;
    return humanoid(c, cfg.look, gear, pose, t);
  }

  function heroGear(equipment) {
    return {
      weapon: equipment.weapon, offhand: equipment.offhand, chest: equipment.chest,
      helmet: equipment.helmet, gloves: equipment.gloves, boots: equipment.boots,
    };
  }

  /* Кость-слуга Могильщика */
  function skeleton(c, pose, t) {
    const look = { skin: '#d8d4c4', cloth: '#a8a498', hollow: true, eye: '#9fd4c9', chest: 'leather', build: 0.72, weaponKind: 'sword' };
    humanoid(c, look, {}, pose, t);
  }

  /* ---------- иконки (кэшируются в data-URL) ---------- */
  const iconCache = new Map();

  function makeCanvas(size) {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    return cv;
  }

  function iconBackdrop(c, s, color) {
    if (!color) return;
    const g = c.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s * 0.58);
    g.addColorStop(0, alpha(color, 0.4)); g.addColorStop(1, alpha(color, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  }

  function drawGearIcon(c, it, s) {
    const m = material(it);
    c.save();
    c.translate(s / 2, s / 2);
    const k = s / 64;
    c.scale(k, k);
    const slot = it.slot;
    if (slot === 'weapon') {
      const kind = it.kind;
      const fit = { spear: 0.5, staff: 0.56, scythe: 0.56, sword: 0.68, hammer: 0.74, axe: 0.74, dagger: 1, kris: 0.98, saber: 0.72, wand: 0.92, lyre: 1 }[kind] || 0.7;
      c.rotate(kind === 'lyre' ? 0 : Math.PI / 4);
      const off = { spear: 34, staff: 28, scythe: 24, sword: 24, hammer: 24, axe: 22, dagger: 12, kris: 14, saber: 24, wand: 16, lyre: 13 }[kind] || 20;
      c.scale(fit, fit);
      c.translate(0, off);
      (WEAPON_DRAW[kind] || WEAPON_DRAW.sword)(c, m);
    } else if (slot === 'offhand') {
      c.scale(1.2, 1.2);
      (OFFHAND_DRAW[it.kind] || OFFHAND_DRAW.shield)(c, m, 0);
    } else if (slot === 'helmet') {
      c.scale(1.65, 1.65);
      c.translate(-1, 2);
      drawHead(c, { skin: '#2a221c', hair: null, cloth: m.cloth, hollow: true, eye: 'transparent' }, it, 0);
    } else if (slot === 'chest') {
      c.scale(0.78, 0.78);
      c.translate(0, 27);
      const col = it.kind === 'robe' ? m.cloth : it.kind === 'leather' ? m.leather : m.metal;
      limb(c, -15, -44, 22, -0.45, 5.6, 4.6, dark(col, 0.15));
      limb(c, 15, -44, 22, 0.45, 5.6, 4.6, dark(col, 0.15));
      drawTorso(c, { trim: m.glow || '#c8b48a' }, it, 1.2);
      if (it.kind === 'robe') {
        poly(c, [[-13, -2], [13, -2], [17, 18], [-17, 18]], dark(col, 0.12));
      }
    } else if (slot === 'gloves') {
      const col = it.kind === 'gauntlet' ? m.metal : m.leather;
      c.scale(1.1, 1.1);
      c.rotate(-0.25);
      limb(c, -12, -18, 18, 0.1, 7, 7, col);
      poly(c, [[-20, 0], [-4, 0], [-2, 14], [-18, 16]], col);
      for (let i = 0; i < 3; i++) limb(c, -17 + i * 5, 14, 7, 0, 2, 1.8, dark(col, 0.1));
      limb(c, -2, 4, 8, 1, 2.2, 1.8, dark(col, 0.1));
      c.translate(26, -8); c.rotate(0.3);
      limb(c, -12, -18, 18, 0.1, 7, 7, dark(col, 0.2));
      poly(c, [[-20, 0], [-4, 0], [-2, 14], [-18, 16]], dark(col, 0.2));
      for (let i = 0; i < 3; i++) limb(c, -17 + i * 5, 14, 7, 0, 2, 1.8, dark(col, 0.28));
    } else if (slot === 'boots') {
      const col = it.kind === 'greaves' ? m.metal : m.leather;
      c.scale(1.08, 1.08);
      for (const [x, y, sh] of [[-12, -18, 0.25], [6, -14, 0]]) {
        poly(c, [[x - 6, y], [x + 7, y], [x + 7, y + 24], [x + 18, y + 28], [x + 18, y + 34], [x - 6, y + 34]], dark(col, sh));
        c.strokeStyle = dark(col, 0.5); c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 6, y + 6); c.lineTo(x + 7, y + 6); c.stroke();
      }
    } else if (slot === 'ring') {
      c.beginPath(); c.arc(0, 4, 15, 0, TAU); c.lineWidth = 8; c.strokeStyle = INK; c.stroke();
      c.lineWidth = 5; c.strokeStyle = m.metal; c.stroke();
      poly(c, [[0, -22], [9, -13], [0, -4], [-9, -13]], m.glow || '#c88a5a', 2);
    } else if (slot === 'amulet') {
      c.beginPath(); c.moveTo(-14, -24); c.quadraticCurveTo(0, 8, 14, -24); c.lineWidth = 3.4; c.strokeStyle = INK; c.stroke();
      c.lineWidth = 1.6; c.strokeStyle = m.metal; c.stroke();
      circle(c, 0, 8, 12, m.metal);
      circle(c, 0, 8, 6.6, m.glow || '#7a5a3a', 1.6);
    }
    c.restore();
  }

  function itemIcon(it, size = 64) {
    if (!it) return '';
    if (it.type === 'consumable') return consumableIcon(it.cid, size);
    const key = `g_${it.slot}_${it.kind}_${it.rarity}_${Math.min(2, Math.floor((it.ilvl || 1) / 3))}_${it.level || 0}_${size}`;
    if (iconCache.has(key)) return iconCache.get(key);
    const cv = makeCanvas(size);
    const c = cv.getContext('2d');
    iconBackdrop(c, size, RARITIES[it.rarity].color);
    if (it.level) sharpHalo(c, it.level, 1.3, () => drawGearIcon(c, it, size));
    drawGearIcon(c, it, size);
    const url = cv.toDataURL();
    iconCache.set(key, url);
    return url;
  }

  function consumableIcon(cid, size = 64) {
    const key = `c_${cid}_${size}`;
    if (iconCache.has(key)) return iconCache.get(key);
    const d = CONSUMABLES[cid];
    const cv = makeCanvas(size);
    const c = cv.getContext('2d');
    iconBackdrop(c, size, d.tint);
    c.translate(size / 2, size / 2);
    c.scale(size / 64, size / 64);
    if (d.icon === 'potion') {
      poly(c, [[-5, -24], [5, -24], [5, -13], [16, 6], [16, 22], [-16, 22], [-16, 6], [-5, -13]], '#2a2a30');
      c.save();
      c.beginPath(); c.moveTo(-14, 6); c.lineTo(14, 6); c.lineTo(14, 20); c.lineTo(-14, 20); c.closePath(); c.fillStyle = d.tint; c.fill();
      c.restore();
      poly(c, [[-7, -28], [7, -28], [7, -22], [-7, -22]], '#6a4a30', 1.8);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-10, 8, 3, 9);
    } else if (d.icon === 'vial') {
      poly(c, [[-7, -24], [7, -24], [7, 18], [0, 24], [-7, 18]], '#2a2a30');
      c.fillStyle = d.tint; c.fillRect(-5, -6, 10, 22);
      poly(c, [[-9, -28], [9, -28], [9, -22], [-9, -22]], '#6a4a30', 1.8);
    } else if (d.icon === 'bomb') {
      circle(c, 0, 5, 17, '#3a3a40');
      c.fillStyle = alpha(d.tint, 0.65); c.beginPath(); c.arc(-5, -1, 6, 0, TAU); c.fill();
      c.strokeStyle = '#a88a50'; c.lineWidth = 3; c.beginPath(); c.moveTo(6, -11); c.quadraticCurveTo(14, -24, 20, -22); c.stroke();
      c.fillStyle = d.tint; c.beginPath(); c.arc(21, -24, 4, 0, TAU); c.fill();
    } else if (d.icon === 'bandage') {
      c.rotate(-0.4);
      circle(c, 0, 0, 18, d.tint);
      circle(c, 0, 0, 7, dark(d.tint, 0.4), 1.8);
      poly(c, [[10, 8], [26, 16], [26, 26], [6, 16]], d.tint);
    }
    const url = cv.toDataURL();
    iconCache.set(key, url);
    return url;
  }

  /* Значки умений и статусов: простые, но свои */
  const GLYPHS = {
    slash(c) { c.beginPath(); c.moveTo(-20, 20); c.quadraticCurveTo(8, 6, 20, -22); c.quadraticCurveTo(14, 10, -20, 20); c.fill(); },
    cleave(c) { c.beginPath(); c.arc(0, 26, 40, -2.6, -0.54); c.arc(0, 40, 44, -0.8, -2.34, true); c.closePath(); c.fill(); },
    hammer(c) { c.fillRect(-16, -22, 32, 16); c.fillRect(-3, -6, 6, 28); },
    stun(c) { for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - 1.57; star(c, Math.cos(a) * 15, Math.sin(a) * 8 - 4, 5.5); } },
    horn(c) { c.beginPath(); c.moveTo(-20, 12); c.quadraticCurveTo(-6, 4, 12, -14); c.lineTo(20, 2); c.quadraticCurveTo(-2, 8, -18, 18); c.closePath(); c.fill(); },
    fist(c) { c.fillRect(-14, -12, 28, 18); c.fillRect(-10, 6, 20, 14); for (const x of [-14, -7, 0, 7]) { c.clearRect(x + 6, -12, 1, 9); } },
    shield(c) { c.beginPath(); c.moveTo(0, -22); c.lineTo(18, -14); c.quadraticCurveTo(18, 10, 0, 22); c.quadraticCurveTo(-18, 10, -18, -14); c.closePath(); c.fill(); },
    armor(c) { c.beginPath(); c.moveTo(-18, -18); c.lineTo(-7, -22); c.lineTo(0, -15); c.lineTo(7, -22); c.lineTo(18, -18); c.lineTo(14, -2); c.lineTo(11, 22); c.lineTo(-11, 22); c.lineTo(-14, -2); c.closePath(); c.fill(); },
    counter(c) { c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 15, -2.6, 1.4); c.stroke(); c.beginPath(); c.moveTo(0, 22); c.lineTo(11, 8); c.lineTo(-7, 8); c.closePath(); c.fill(); },
    thorn(c) { for (let i = 0; i < 8; i++) { c.save(); c.rotate(i * TAU / 8); c.beginPath(); c.moveTo(-5, -8); c.lineTo(0, -24); c.lineTo(5, -8); c.fill(); c.restore(); } c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fill(); },
    drop(c) { c.beginPath(); c.moveTo(0, -22); c.quadraticCurveTo(18, 4, 12, 12); c.arc(0, 8, 13, 0.3, Math.PI - 0.3); c.quadraticCurveTo(-18, 4, 0, -22); c.fill(); },
    skull(c) { c.beginPath(); c.arc(0, -4, 17, 0, TAU); c.fill(); c.fillRect(-9, 8, 18, 12); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(-6, -4, 5, 0, TAU); c.arc(6, -4, 5, 0, TAU); c.fill(); c.fillRect(-1, 8, 2, 12); c.globalCompositeOperation = 'source-over'; },
    crown(c) { c.beginPath(); c.moveTo(-20, 14); c.lineTo(-22, -12); c.lineTo(-10, 0); c.lineTo(0, -18); c.lineTo(10, 0); c.lineTo(22, -12); c.lineTo(20, 14); c.closePath(); c.fill(); },
    flame(c) { c.beginPath(); c.moveTo(0, -24); c.quadraticCurveTo(20, -4, 14, 10); c.quadraticCurveTo(10, 22, 0, 22); c.quadraticCurveTo(-14, 22, -15, 8); c.quadraticCurveTo(-15, -2, -7, -8); c.quadraticCurveTo(-6, 0, -2, 0); c.quadraticCurveTo(4, -10, 0, -24); c.fill(); },
    spark(c) { star(c, 0, 0, 22); },
    wave(c) { for (const y of [-12, 2, 16]) { c.lineWidth = 5; c.beginPath(); c.moveTo(-20, y); c.quadraticCurveTo(-10, y - 10, 0, y); c.quadraticCurveTo(10, y + 10, 20, y); c.stroke(); } },
    meteor(c) { c.beginPath(); c.arc(8, 8, 12, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-2, 0); c.lineTo(-20, -20); c.lineTo(2, -10); c.lineTo(-6, -22); c.lineTo(16, -4); c.fill(); },
    wind(c) { c.lineWidth = 5; for (const [y, l] of [[-10, 15], [2, 19], [14, 11]]) { c.beginPath(); c.moveTo(-20, y); c.lineTo(l - 6, y); c.quadraticCurveTo(l + 4, y - 8, l - 2, y - 11); c.stroke(); } },
    eye(c) { c.beginPath(); c.moveTo(-22, 0); c.quadraticCurveTo(0, -20, 22, 0); c.quadraticCurveTo(0, 20, -22, 0); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over'; c.beginPath(); c.arc(0, 0, 3, 0, TAU); c.fill(); },
    dagger(c) { c.beginPath(); c.moveTo(0, -24); c.lineTo(5, 2); c.lineTo(-5, 2); c.closePath(); c.fill(); c.fillRect(-9, 2, 18, 4); c.fillRect(-2.5, 6, 5, 14); },
    vial(c) { c.beginPath(); c.moveTo(-5, -22); c.lineTo(5, -22); c.lineTo(5, -8); c.lineTo(15, 14); c.quadraticCurveTo(15, 22, 8, 22); c.lineTo(-8, 22); c.quadraticCurveTo(-15, 22, -15, 14); c.lineTo(-5, -8); c.closePath(); c.fill(); },
    scythe(c) { c.lineWidth = 4.5; c.beginPath(); c.moveTo(4, 24); c.lineTo(8, -20); c.stroke(); c.beginPath(); c.moveTo(8, -22); c.quadraticCurveTo(-20, -28, -24, -4); c.quadraticCurveTo(-12, -16, 8, -12); c.closePath(); c.fill(); },
    bone(c) { c.save(); c.rotate(-0.78); c.fillRect(-16, -4, 32, 8); for (const [x, y] of [[-17, -5], [-17, 5], [17, -5], [17, 5]]) { c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill(); } c.restore(); },
    note(c) { c.beginPath(); c.ellipse(-9, 14, 8.5, 6.5, -0.4, 0, TAU); c.fill(); c.fillRect(-2, -22, 4, 36); c.beginPath(); c.moveTo(2, -22); c.quadraticCurveTo(16, -14, 16, -2); c.quadraticCurveTo(10, -12, 2, -12); c.fill(); },
    guard(c) { GLYPHS.shield(c); },
  };

  function star(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const rr = i % 2 ? r * 0.3 : r;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
  }

  function glyph(name, color = '#e8d8bc', size = 64) {
    const key = `s_${name}_${color}_${size}`;
    if (iconCache.has(key)) return iconCache.get(key);
    const cv = makeCanvas(size);
    const c = cv.getContext('2d');
    c.translate(size / 2, size / 2);
    c.scale(size / 64, size / 64);
    c.fillStyle = color;
    c.strokeStyle = color;
    c.lineCap = 'round';
    (GLYPHS[name] || GLYPHS.spark)(c);
    const url = cv.toDataURL();
    iconCache.set(key, url);
    return url;
  }

  /* Наковальня в окне заточки: вещь светится, удар рассыпает искры */
  function forgeStage(cv, item, strike) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth || 400, H = cv.clientHeight || 150;
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d');
    const col = SHARP_COLORS[Math.min(item.level || 1, SHARP_COLORS.length) - 1];
    const sparks = [];
    if (strike) {
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * TAU, v = 60 + Math.random() * 300;
        sparks.push({ x: W / 2, y: H / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0.4 + Math.random() * 0.9, s: 1 + Math.random() * 2.4 });
      }
    }
    const t0 = performance.now();
    let last = t0;
    const frame = now => {
      if (!cv.isConnected) return;
      const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      const flash = strike ? Math.exp(-t * 3.2) : 0;
      const breathe = item.level ? 0.22 + item.level * 0.08 + Math.sin(t * 3) * 0.05 : 0.1;
      const g = c.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, H * (0.7 + flash));
      g.addColorStop(0, alpha(col, Math.min(1, breathe + flash))); g.addColorStop(1, alpha(col, 0));
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const s = H * 0.92;
      c.save();
      c.translate(W / 2 - s / 2, H / 2 - s / 2);
      if (item.level) sharpHalo(c, item.level, t, () => drawGearIcon(c, item, s));
      drawGearIcon(c, item, s);
      if (flash > 0.02) {
        c.save(); c.globalAlpha = flash; c.shadowColor = '#ffffff'; c.shadowBlur = 40 * flash; c.globalCompositeOperation = 'lighter';
        drawGearIcon(c, item, s);
        c.restore();
      }
      c.restore();
      if (strike && t < 0.7) {
        const p = t / 0.7;
        c.globalAlpha = 1 - p; c.strokeStyle = col; c.lineWidth = 4 * (1 - p) + 0.5;
        c.beginPath(); c.arc(W / 2, H / 2, 16 + p * W * 0.32, 0, TAU); c.stroke();
        c.globalAlpha = 1;
      }
      c.globalCompositeOperation = 'lighter';
      for (const p of sparks) {
        if (t > p.life) continue;
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 460 * dt;
        c.globalAlpha = 1 - t / p.life;
        c.fillStyle = Math.random() < 0.2 ? '#ffffff' : col;
        c.fillRect(p.x, p.y, p.s, p.s);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* Статичный портрет куклы для интерфейса */
  function portrait(canvas, draw, opts = {}) {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || canvas.width, H = canvas.clientHeight || canvas.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const c = canvas.getContext('2d');
    c.scale(dpr, dpr);
    c.clearRect(0, 0, W, H);
    const sc = (opts.scale || 1) * H / 190;
    c.translate(W / 2 + (opts.dx || 0), H - (opts.bottom != null ? opts.bottom : 10) * H / 190);
    c.scale(sc, sc);
    draw(c);
  }

  function heroLook(classId) {
    return Object.assign({}, CLASSES[classId].look, { trim: CLASSES[classId].color });
  }

  /* Рисует героя целиком: вид зависит от класса и надетых вещей */
  function drawHero(c, hero, pose, t) {
    const cls = CLASSES[hero.classId];
    const look = Object.assign({}, cls.look, { trim: cls.color, cape: cls.id === 'warrior' ? '#4a2a20' : cls.id === 'warden' ? '#232b28' : null });
    // без шлема виден родной головной убор класса
    humanoid(c, look, heroGear(hero.equipment), pose, t);
  }

  return {
    IDLE_POSE, humanoid, drawEnemy, drawHero, skeleton, itemIcon, consumableIcon, glyph, portrait, heroLook,
    alpha, mix, dark, light, INK, WEAPON_DRAW, material, TAU, forgeStage,
  };
})();
