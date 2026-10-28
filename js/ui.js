'use strict';

/* ============================================================
   ПЕПЕЛЬНЫЙ ПРЕДЕЛ — интерфейс
   ============================================================ */
const UI = (() => {
  let screen = { name: 'map', areaId: null, cityId: null };
  let selectedClass = 'warrior';
  let itemCache = Object.create(null);
  let resultShown = false;
  let hudClock = 0;
  let lastStatusKey = '';
  let saveTO = null;
  let currentNpc = null;
  let pendingCommonSell = [];
  let tooltipOn = false;
  let audioCtx = null;
  let lastFrame = performance.now();
  const el = {};

  const CLASS_QUOTES = {
    pepel: 'Мы не герои. Мы просто не успели уйти.',
    springs: 'Смерть — это очень сильная забывчивость.',
    copper: 'Медь поёт, когда рядом ложь.',
    gate: 'Врат не открывали. Хмарь стучит.',
  };

  /* ---------- helpers ---------- */
  const $ = s => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = n => Math.round(n).toLocaleString('ru-RU');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
  const hexA = (hex, a) => {
    if (!hex || hex[0] !== '#') return `rgba(220,180,130,${a})`;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const pct = (v, max) => max > 0 ? clamp(v / max * 100, 0, 100) : 0;
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  };
  const rar = r => RARITIES[r] || RARITIES.common;
  const statLine = (k, v) => `${STAT_LABELS[k] || k} ${v > 0 ? '+' : ''}${PCT_STATS.has(k) ? v + '%' : Math.round(v)}`;
  const cssRarity = r => `r-${r || 'common'}`;
  const playerClass = () => CLASSES[Game.state.player.classId];

  function itemTip(item) {
    if (!item) return '';
    itemCache[item.uid] = item;
    return `data-tip-uid="${item.uid}"`;
  }

  function sectionTitle(title, extra = '') {
    return `<div class="section-title"><h2>${title}</h2><span class="rule"></span>${extra}</div>`;
  }

  function progressBar(value, max, cls = '') {
    return `<div class="progress-line ${cls}"><i style="width:${pct(value, max)}%"></i></div>`;
  }

  function areaLvlRange(area) {
    const levels = area.mobs.map(id => MOBS[id].lvl);
    levels.push(MOBS[area.boss].lvl);
    return `${Math.min(...levels)}–${Math.max(...levels)}`;
  }

  function artBackdrop(area, cls) {
    const p = area.palette;
    const ridge1 = 'polygon(0 100%,0 62%,9% 47%,19% 63%,31% 38%,43% 58%,55% 29%,66% 54%,78% 41%,89% 60%,100% 44%,100% 100%)';
    const ridge2 = 'polygon(0 100%,0 32%,15% 45%,32% 25%,51% 41%,70% 22%,86% 38%,100% 27%,100% 100%)';
    return `<div class="${cls}" style="background:
      radial-gradient(95% 120% at 62% 18%, ${hexA(p.accent, 0.22)}, transparent 62%),
      linear-gradient(180deg, ${p.skyTop} 0%, ${p.skyBot} 100%);">
      <div style="position:absolute;left:0;right:0;bottom:0;height:72%;background:${p.mountain};clip-path:${ridge1};opacity:.82"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:34%;background:${p.ground};clip-path:${ridge2};opacity:.96"></div>
      <div class="area-fog"></div>
      <div class="area-emblem">${area.glyph || area.icon}</div>
    </div>`;
  }

  /* ---------- звук ---------- */
  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try { audioCtx = new Ctx(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.025, when = 0, slideTo = null) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + when;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function playSound(name) {
    if (!Game.state || !Game.state.settings.sound) return;
    switch (name) {
      case 'click': tone(640, 0.05, 'triangle', 0.018); break;
      case 'skill': tone(420, 0.12, 'triangle', 0.025, 0, 620); break;
      case 'hit': tone(150, 0.08, 'square', 0.02, 0, 90); break;
      case 'crit': tone(95, 0.16, 'sawtooth', 0.03, 0, 50); break;
      case 'hurt': tone(190, 0.12, 'triangle', 0.028, 0, 120); break;
      case 'heal': tone(520, 0.12, 'sine', 0.025); tone(680, 0.16, 'sine', 0.02, 0.08); break;
      case 'shield': tone(330, 0.18, 'sine', 0.02, 0, 500); break;
      case 'buy': tone(660, 0.08, 'triangle', 0.02); tone(880, 0.12, 'triangle', 0.018, 0.08); break;
      case 'loot': tone(780, 0.09, 'sine', 0.022); break;
      case 'victory': [392, 523, 659, 784].forEach((f, i) => tone(f, 0.22, 'triangle', 0.025, i * 0.13)); break;
      case 'defeat': tone(180, 0.55, 'sawtooth', 0.028, 0, 70); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'sine', 0.026, i * 0.1)); break;
      case 'enemySkill': tone(110, 0.2, 'sawtooth', 0.02, 0, 70); break;
      case 'storm': tone(80, 0.4, 'sawtooth', 0.025, 0, 55); break;
      case 'deny': tone(170, 0.09, 'square', 0.02, 0, 120); break;
      case 'flee': tone(300, 0.16, 'triangle', 0.02, 0, 160); break;
      default: break;
    }
  }

  /* ---------- жизненный цикл ---------- */
  function cacheEls() {
    el.main = $('#main');
    el.sidebar = $('#sidebar');
    el.modal = $('#modal');
    el.intro = $('#intro');
    el.tooltip = $('#tooltip');
    el.toasts = $('#toasts');
    el.save = $('#saveState');
    el.sound = $('#soundBtn');
    el.reset = $('#resetBtn');
    el.brand = $('#brandGo');
  }

  function init() {
    cacheEls();
    buildEmbers();
    bindEvents();
    const has = Game.init();
    updateSoundBtn();
    if (has) {
      screen = { name: 'map', areaId: null, cityId: null };
      render();
    } else {
      showIntro();
      renderSidebar();
    }
    requestAnimationFrame(frame);
  }

  function buildEmbers() {
    const host = document.getElementById('bgEmbers');
    if (!host) return;
    for (let i = 0; i < 20; i++) {
      const d = document.createElement('div');
      d.className = 'ember-dot';
      d.style.left = `${Math.random() * 100}%`;
      d.style.animationDuration = `${14 + Math.random() * 22}s`;
      d.style.animationDelay = `${-Math.random() * 30}s`;
      d.style.width = d.style.height = `${1.5 + Math.random() * 2.5}px`;
      d.style.setProperty('--drift', `${-60 + Math.random() * 120}px`);
      host.appendChild(d);
    }
  }

  function saveFlash() {
    if (!el.save) return;
    el.save.classList.add('flash');
    el.save.textContent = 'сохранено';
    clearTimeout(saveTO);
    saveTO = setTimeout(() => el.save && el.save.classList.remove('flash'), 1100);
  }

  function toast(text, type = '') {
    if (!el.toasts) return;
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.innerHTML = text;
    el.toasts.appendChild(node);
    while (el.toasts.children.length > 4) el.toasts.firstElementChild.remove();
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 320);
    }, 3600);
  }

  function updateSoundBtn() {
    if (!el.sound) return;
    const on = Game.state ? Game.state.settings.sound : true;
    el.sound.textContent = on ? '🔊' : '🔇';
    el.sound.title = on ? 'Звук включён' : 'Звук выключен';
  }

  /* ---------- навигация ---------- */
  function guardBattle() {
    if (screen.name === 'battle' && Game.battle && !Game.battle.result) {
      toast('Бой ещё идёт. Победи, отступи или сдайся.', 'bad');
      playSound('deny');
      return false;
    }
    if (Game.battle && Game.battle.result) Game.leaveBattle();
    BattleScene.destroy();
    return true;
  }

  function navigate(tab) {
    if (!Game.state) return;
    if (!guardBattle()) return;
    if (tab === 'map') openMap();
    else if (tab === 'city') openCity(Game.state.lastCity);
    else if (tab === 'inventory') { screen = { name: 'inventory' }; render(); }
    else if (tab === 'character') { screen = { name: 'character' }; render(); }
    else if (tab === 'lore') { screen = { name: 'lore' }; render(); }
    playSound('click');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openMap() {
    if (!guardBattle()) return;
    screen = { name: 'map', areaId: null, cityId: null };
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openCity(cityId) {
    if (!guardBattle()) return;
    const city = CITIES.find(c => c.id === cityId) || CITIES.find(c => c.id === Game.state.lastCity);
    if (!city) return;
    if (Game.state.player.level < city.reqLevel) {
      toast(`Нужен ${city.reqLevel}-й уровень, чтобы войти в «${city.name}».`, 'bad');
      playSound('deny');
      return;
    }
    Game.visitCity(city.id);
    screen = { name: 'city', cityId: city.id };
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openLocation(areaId) {
    if (!guardBattle()) return;
    const area = AREAS.find(a => a.id === areaId);
    if (!area) return;
    if (Game.state.player.level < area.reqLevel) {
      toast(`Нужен ${area.reqLevel}-й уровень для «${area.name}».`, 'bad');
      playSound('deny');
      return;
    }
    screen = { name: 'location', areaId: area.id };
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openBattle() {
    if (!Game.battle) return;
    resultShown = false;
    screen = { name: 'battle', areaId: Game.battle.areaId };
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- сайдбар ---------- */
  function renderSidebar() {
    if (!el.sidebar) return;
    if (!Game.state) { el.sidebar.innerHTML = ''; return; }
    const p = Game.state.player;
    const s = Game.getStats();
    const cls = CLASSES[p.classId];
    const inBattle = screen.name === 'battle' && Game.battle;
    const hp = inBattle ? Math.max(0, Math.ceil(Game.battle.hp)) : s.maxHp;
    const xpNeed = Game.xpNeeded(p.level);
    const xpPct = p.level >= MAX_LEVEL ? 100 : pct(p.xp, xpNeed);
    const hpPct = pct(hp, s.maxHp);
    const active = screen.name === 'location' || screen.name === 'battle' ? 'map' : screen.name;
    const title = Game.state.progress.title;
    const quote = CLASS_QUOTES[Game.state.lastCity] || CLASS_QUOTES.pepel;

    const nav = [
      { id: 'map', icon: '🗺', label: 'Карта мира' },
      { id: 'city', icon: '🏙', label: 'Город' },
      { id: 'inventory', icon: '🎒', label: 'Инвентарь' },
      { id: 'character', icon: '🧝', label: 'Герой' },
      { id: 'lore', icon: '📖', label: 'Кодекс' },
    ].map(n => `<button class="nav-btn ${active === n.id ? 'active' : ''}" data-nav="${n.id}">
      <span class="nav-icon">${n.icon}</span>${n.label}
      ${n.id === 'inventory' && p.inventory.length ? `<span class="nav-badge">${p.inventory.length}</span>` : ''}
    </button>`).join('');

    el.sidebar.innerHTML = `
      <div class="hero-card">
        <div class="hero-top">
          <div class="hero-avatar">${cls.icon}<span class="lvl">${p.level}</span></div>
          <div class="grow">
            <div class="hero-name">${esc(p.name)}</div>
            <div class="hero-class">${esc(cls.role)} · ${esc(cls.name)}</div>
            ${title ? `<div class="hero-title">«${esc(title)}»</div>` : ''}
          </div>
        </div>
        <div class="mt-16">
          <div class="bar-labels"><span>Здоровье</span><b id="sbHpText">${fmt(hp)} / ${fmt(s.maxHp)}</b></div>
          <div class="bar hp"><div class="bar-fill" id="sbHpFill" style="width:${hpPct}%"></div></div>
          <div class="bar-labels"><span>Опыт</span><b>${p.level >= MAX_LEVEL ? 'максимум' : `${fmt(p.xp)} / ${fmt(xpNeed)}`}</b></div>
          <div class="bar xp"><div class="bar-fill" style="width:${xpPct}%"></div></div>
        </div>
      </div>
      <div class="sidebar-nav">${nav}</div>
      <div class="side-stats">
        <div class="side-stat"><span>Атака</span><b>${fmt(s.atk)}</b></div>
        <div class="side-stat"><span>Броня</span><b>${fmt(s.armor)}</b></div>
        <div class="side-stat"><span>Золото</span><b>${fmt(p.gold)}</b></div>
        <div class="side-stat"><span>Убийства</span><b>${fmt(Game.state.stats.kills)}</b></div>
      </div>
      <div class="side-quote">${esc(quote)}</div>
    `;
  }

  /* ---------- главный render ---------- */
  function render() {
    if (!Game.state) return;
    hideTooltip();
    clearResultOverlay();
    resultShown = false;
    itemCache = Object.create(null);
    lastStatusKey = '';
    renderSidebar();
    if (screen.name !== 'battle') BattleScene.destroy();

    let html = '';
    if (screen.name === 'map') html = renderMap();
    else if (screen.name === 'city') html = renderCity();
    else if (screen.name === 'location') html = renderLocation();
    else if (screen.name === 'battle') html = renderBattle();
    else if (screen.name === 'inventory') html = renderInventory();
    else if (screen.name === 'character') html = renderCharacter();
    else if (screen.name === 'lore') html = renderLore();

    el.main.innerHTML = html;
    afterRender();
  }

  function afterRender() {
    if (screen.name === 'battle') {
      const canvas = document.getElementById('battleCanvas');
      if (canvas && Game.battle) {
        const area = AREAS.find(a => a.id === Game.battle.areaId);
        BattleScene.init(canvas, Game.battle.areaId, Game.battle.enemy, Game.state.player.classId);
      }
      const box = document.getElementById('logBox');
      if (box && Game.battle) {
        box.innerHTML = Game.battle.logs.map(logEntryHTML).join('') || '<div class="log-empty">Тишина перед ударом…</div>';
        box.scrollTop = box.scrollHeight;
      }
      renderBattleConsumables();
      syncBattle(true);
    }
  }

  /* ---------- карта ---------- */
  function renderMap() {
    const p = Game.state.player;
    const cities = CITIES.map(c => {
      const unlocked = p.level >= c.reqLevel;
      return `<article class="city-card ${unlocked ? '' : 'locked'}" ${unlocked ? `data-city="${c.id}"` : `data-city="${c.id}"`}>
        <div class="city-glow"></div>
        <div class="city-glyph">${c.glyph}</div>
        <div class="city-epi">${esc(c.epithet)}</div>
        <h3>${esc(c.name)}</h3>
        <div class="city-meta"><span>${unlocked ? 'Войти в город' : `Откроется на ${c.reqLevel} ур.`}</span></div>
      </article>`;
    }).join('');

    const areas = AREAS.map(a => {
      const unlocked = p.level >= a.reqLevel;
      const kills = Game.areaKills(a.id);
      const bossKilled = (Game.state.progress.bosses[a.boss] || 0) > 0;
      return `<article class="area-card ${unlocked ? '' : 'locked'}" data-area="${a.id}">
        ${artBackdrop(a, 'area-art')}
        <div class="area-body">
          <div class="area-region">${esc(a.region)}</div>
          <h3>${esc(a.name)}</h3>
          <p>${esc(a.desc)}</p>
          <div class="area-foot">
            <span class="lvl">Ур. ${areaLvlRange(a)} · ${a.mobs.length} противника</span>
            <span class="chip ${bossKilled ? 'unlock' : ''}">${bossKilled ? '☠ босс повержен' : `до босса ${Math.min(kills, a.killsForBoss)}/${a.killsForBoss}`}</span>
          </div>
          ${unlocked ? progressBar(kills, a.killsForBoss, 'mt-8') : ''}
        </div>
        ${unlocked ? '' : `<div class="lock-note">Нужен ${a.reqLevel}-й уровень</div>`}
      </article>`;
    }).join('');

    const raidAvail = Game.raidUnlocked();
    return `<section class="screen">
      <div class="screen-head">
        <div>
          <div class="eyebrow">Кромка мира · ${Game.state.lore.length}/${LORE_ORDER.length} записей кодекса</div>
          <h1 class="title-xl">Карта Предела</h1>
          <p class="subtitle">Четыре огня на краю пепла. Выбирай, куда идти, — но помни, что Хмарь спрашивает каждого, кто заходит слишком далеко.</p>
        </div>
        <div class="flex">
          <button class="btn btn-small" data-nav="lore">📖 Кодекс</button>
          <button class="btn btn-small btn-ghost" data-nav="inventory">🎒 Снаряжение</button>
        </div>
      </div>

      <div class="map-lore">
        <p class="lore-text">${esc(LORE.world.text)}</p>
        <div class="lore-rule"></div>
        <div class="flex spread flex-wrap">
          <span class="tag">Хроника · запись первая</span>
          <button class="btn btn-small btn-ghost" data-nav="lore">Читать кодекс →</button>
        </div>
      </div>

      ${sectionTitle('Города', '<span class="count">убежища</span>')}
      <div class="city-grid">${cities}</div>

      ${sectionTitle('Земли Предела', '<span class="count">опасные тропы</span>')}
      <div class="area-grid">${areas}</div>

      ${sectionTitle('Сердце Хмари', '<span class="count">рейд</span>')}
      <div class="raid-card">
        <div class="raid-sub">Финальная песня · ур. ${RAID.reqLevel}+</div>
        <h3>${RAID.name}</h3>
        <p>${esc(RAID.desc)}</p>
        <div class="raid-waves">${RAID.waves.map((w, i) => `<span class="wave-pill">${i + 1}. ${esc(w.label)}</span>`).join('')}</div>
        <div class="flex spread flex-wrap">
          <span class="small ${raidAvail ? 'green' : 'dim'}">${raidAvail ? `Рейд доступен · вход ${RAID.entryGold} золота` : 'Требования: 12 уровень и победа над Стражем Врат'}</span>
          <button class="btn ${raidAvail ? 'btn-primary' : 'btn-ghost'}" data-action="raid-open">${Game.state.progress.raidClears ? `Пройден ×${Game.state.progress.raidClears}` : 'Собрать рейд'}</button>
        </div>
      </div>
    </section>`;
  }

  /* ---------- локация ---------- */
  function renderLocation() {
    const area = AREAS.find(a => a.id === screen.areaId);
    if (!area) return renderMap();
    const kills = Game.areaKills(area.id);
    const boss = MOBS[area.boss];
    const bossReady = Game.bossUnlocked(area.id);
    const bossKilled = (Game.state.progress.bosses[area.boss] || 0) > 0;

    const mobs = area.mobs.map(id => {
      const m = MOBS[id];
      return `<div class="mob-row">
        <div class="mob-glyph">${m.icon}</div>
        <div class="grow">
          <div class="mob-name">${esc(m.name)}</div>
          <div class="mob-meta"><span>ур. <b>${m.lvl}</b></span><span>HP <b>${fmt(m.hp)}</b></span><span>атака <b>${m.atk}</b></span><span>опыт <b>${m.xp}</b></span><span>золото <b>${m.gold}</b></span></div>
        </div>
        <div class="mob-side">
          <span class="drop-note">шанс лута ${Math.round((m.dropChance || 0) * 100)}%</span>
          <button class="btn btn-small" data-action="hunt" data-area-id="${area.id}" data-mob-id="${id}">Охотиться</button>
        </div>
      </div>`;
    }).join('');

    return `<section class="screen">
      <div class="screen-head" style="margin-bottom:14px">
        <div class="eyebrow" style="margin:0">${esc(area.region)} · ${esc(area.name)}</div>
        <div class="flex">
          <button class="btn btn-small btn-ghost" data-action="back-map">← Карта</button>
          <button class="btn btn-small btn-ghost" data-nav="city">🏙 В город</button>
        </div>
      </div>
      <div class="loc-hero">
        ${artBackdrop(area, 'loc-art')}
        <div class="eyebrow">${esc(area.region)}</div>
        <h1>${esc(area.name)}</h1>
        <p class="loc-sub">${esc(area.desc)}</p>
        <div class="loc-stats">
          <div class="loc-stat">Уровень<b>${areaLvlRange(area)}</b></div>
          <div class="loc-stat">Зачистка<b>${Math.min(kills, area.killsForBoss)} / ${area.killsForBoss}</b></div>
          <div class="loc-stat">Босс<b class="${bossKilled ? 'green' : ''}">${bossKilled ? 'повержен' : bossReady ? 'доступен' : 'запечатан'}</b></div>
          <div class="loc-stat">Добыча<b>${MOBS[area.mobs[0]].gold}–${boss.gold} зл.</b></div>
        </div>
      </div>

      <div class="grid g2">
        <div>
          ${sectionTitle('Охота', '<span class="count">выбери цель</span>')}
          <div class="hunt-list">${mobs}</div>
          <div class="card pad mt-16">
            <div class="tag">Слух</div>
            <p class="muted mt-8" style="line-height:1.6">${esc(MOBS[area.mobs[0]].blurb)}</p>
            <div class="divider"></div>
            <p class="small dim">${esc(area.lootHint)}</p>
          </div>
        </div>
        <div>
          ${sectionTitle('Босс локации', `<span class="chip ${bossKilled ? 'unlock' : ''}">${bossKilled ? 'побеждён' : bossReady ? 'готов' : 'запечатан'}</span>`)}
          <div class="boss-card">
            <div class="boss-head">
              <div class="boss-glyph">${boss.icon}</div>
              <div>
                <div class="boss-role">☠ Босс · ур. ${boss.lvl}</div>
                <h3>${esc(boss.name)}</h3>
              </div>
            </div>
            <p class="boss-desc">${esc(boss.blurb)}</p>
            <div class="boss-foot">
              <div class="grow" style="min-width:150px">
                <div class="bar-labels"><span>Печать ослаблена</span><b>${Math.min(kills, area.killsForBoss)} / ${area.killsForBoss}</b></div>
                ${progressBar(kills, area.killsForBoss)}
              </div>
              <button class="btn ${bossReady ? 'btn-primary' : ''}" data-action="boss" data-area-id="${area.id}" ${bossReady ? '' : 'disabled'}>
                ${bossReady ? 'Сразиться с боссом' : `Ещё ${Math.max(0, area.killsForBoss - kills)} ${plural(Math.max(0, area.killsForBoss - kills), 'победа', 'победы', 'побед')}`}
              </button>
            </div>
            ${bossKilled ? `<div class="chip unlock mt-12">Побеждён: ${Game.state.progress.bosses[area.boss]} ${plural(Game.state.progress.bosses[area.boss], 'раз', 'раза', 'раз')} · можно повторить</div>` : ''}
          </div>
          <div class="card pad mt-16">
            <div class="tag">Награда за голову</div>
            <div class="grid g3 mt-12">
              <div class="stat-box"><span>Опыт</span><b>${fmt(boss.xp)}</b></div>
              <div class="stat-box"><span>Золото</span><b>${fmt(boss.gold)}</b></div>
              <div class="stat-box"><span>Добыча</span><b>эпик+</b></div>
            </div>
            <p class="small dim mt-12">Босс всегда оставляет снаряжение эпического качества или лучше.</p>
          </div>
        </div>
      </div>
    </section>`;
  }

  /* ---------- город ---------- */
  function renderCity() {
    const city = CITIES.find(c => c.id === screen.cityId) || CITIES.find(c => c.id === Game.state.lastCity);
    if (!city) return renderMap();
    const npcs = NPCS.filter(n => n.city === city.id);
    const merchants = MERCHANTS.filter(m => m.city === city.id);
    const contracts = Game.state.contracts;

    const npcHtml = npcs.map(n => {
      const gifted = !!Game.state.npcGifts[n.id];
      return `<div class="npc-card" data-action="npc" data-id="${n.id}">
        <div class="npc-face" style="color:${n.color}">${n.icon}</div>
        <div class="grow">
          <h4>${esc(n.name)}</h4>
          <div class="npc-role">${esc(n.role)}</div>
          <div class="npc-line">${esc(n.lines[0])}</div>
          <div class="npc-gift">${gifted ? '✦ подарок получен' : '🎁 можно попросить помощи'}</div>
        </div>
      </div>`;
    }).join('');

    const merchantHtml = merchants.map(m => `<div class="merchant-card" data-action="merchant" data-id="${m.id}">
      <div class="m-icon">${m.icon}</div>
      <h4>${esc(m.name)}</h4>
      <div class="m-role">${esc(m.role)}</div>
      <p class="m-desc">${esc(m.desc)}</p>
      <div class="m-go">Открыть лавку →</div>
    </div>`).join('');

    const contractHtml = contracts.map(c => {
      const done = c.progress >= c.need;
      return `<div class="contract-card ${done ? 'done' : ''}">
        <div class="contract-icon">${c.icon}</div>
        <div class="grow">
          <div class="c-title">${esc(c.title)}</div>
          <div class="c-sub">${esc(c.desc)}</div>
          ${progressBar(c.progress, c.need, 'mt-8')}
        </div>
        <div class="c-reward"><b>${fmt(c.reward.gold)}</b> зл.<br>${fmt(c.reward.xp)} опыта${c.reward.item ? '<br>+ редкий предмет' : ''}</div>
        <div>${done
          ? `<button class="btn btn-small btn-primary" data-action="claim" data-id="${c.id}">Забрать</button>`
          : `<span class="chip">${Math.min(c.progress, c.need)} / ${c.need}</span>`}</div>
      </div>`;
    }).join('');

    const refreshCost = 25 + Game.state.player.level * 3;
    const raidBlock = city.id === 'gate' ? `<div class="mt-22">
      ${sectionTitle('Рейд', '<span class="count">за вратами</span>')}
      <div class="raid-card">
        <div class="raid-sub">Сердце Хмари · ур. ${RAID.reqLevel}+</div>
        <h3>${RAID.name}</h3>
        <p>${esc(RAID.desc)}</p>
        <div class="raid-waves">${RAID.waves.map((w, i) => `<span class="wave-pill">${i + 1}. ${esc(w.label)}</span>`).join('')}</div>
        <div class="flex spread flex-wrap">
          <span class="small ${Game.raidUnlocked() ? 'green' : 'dim'}">${Game.raidUnlocked() ? `Вход: ${RAID.entryGold} золота · пройден ${Game.state.progress.raidClears} раз` : 'Нужен 12 ур. и победа над Стражем Врат'}</span>
          <button class="btn ${Game.raidUnlocked() ? 'btn-primary' : 'btn-ghost'}" data-action="raid-open">${Game.state.progress.raidClears ? 'Войти снова' : 'Собрать рейд'}</button>
        </div>
      </div>
    </div>` : '';

    return `<section class="screen">
      <div class="city-hero">
        <div class="city-glyph-big">${city.glyph}</div>
        <div class="eyebrow">${esc(city.epithet)}</div>
        <h1>${esc(city.name)}</h1>
        <p class="subtitle">${esc(city.desc)}</p>
        <div class="hero-tags">${city.tags.map(t => `<span class="chip ember">${esc(t)}</span>`).join('')}</div>
      </div>

      ${sectionTitle('Люди', '<span class="count">у кого можно спросить</span>')}
      <div class="npc-grid">${npcHtml}</div>

      ${sectionTitle('Лавки', '<span class="count">купить и продать</span>')}
      <div class="merchant-grid">${merchantHtml}</div>

      ${sectionTitle('Доска контрактов', `<button class="btn btn-small btn-ghost" data-action="refresh-contracts">Обновить · ${refreshCost} зл.</button>`)}
      <div class="card pad">
        <div class="contract-list">${contractHtml || '<div class="inv-empty-note">Контрактов нет. Обнови доску.</div>'}</div>
        <div class="small dim mt-12">Контракты общие для всех городов: награду можно забрать на любой доске.</div>
      </div>

      ${raidBlock}
    </section>`;
  }

  /* ---------- бой ---------- */
  function renderBattle() {
    const b = Game.battle;
    if (!b) return renderMap();
    const p = Game.state.player;
    const cls = CLASSES[p.classId];
    const area = AREAS.find(a => a.id === b.areaId);
    const areaName = b.type === 'raid'
      ? `${RAID.name} · волна ${(b.raidIndex || 0) + 1}/${RAID.waves.length}`
      : (area ? area.name : 'Предел');
    const typeLabel = b.type === 'raid' ? 'рейд' : b.type === 'boss' ? 'босс' : 'охота';
    const e = b.enemy;
    const skills = cls.skills;

    const skillButtons = skills.map((sk, i) => {
      const locked = p.level < sk.unlock;
      return `<button class="skill-btn ${locked ? 'locked' : ''}" data-action="skill" data-skill="${sk.id}" title="${esc(sk.desc)} · ${sk.cost} энергии" ${locked ? 'disabled' : ''}>
        <span class="sk-key">${i + 1}</span>
        <span class="sk-icon">${sk.icon}</span>
        <span class="sk-name">${esc(sk.name)}</span>
        <span class="sk-cost">${locked ? `ур. ${sk.unlock}` : `${sk.cost} эн.`}</span>
        <span class="cd-veil hidden"></span>
      </button>`;
    }).join('');

    return `<section class="screen battle-screen">
      <div class="battle-top">
        <div class="b-title">⚔ <b>${esc(areaName)}</b> · ${typeLabel}${e.boss ? ' · <span style="color:#e07a6c">босс</span>' : ''}</div>
        <div class="flex">
          <button class="btn btn-small btn-ghost" data-action="toggle-auto" id="autoBtn">⚙ Автобой: выкл</button>
          <button class="btn btn-small btn-blood" data-action="flee" ${b.type !== 'normal' ? 'disabled title="Из боя с боссом или рейдом нельзя отступить"' : 'title="Попытаться сбежать (70%)"'}>Отступить</button>
        </div>
      </div>

      <div class="battle-scene" id="battleScene">
        <canvas id="battleCanvas"></canvas>
        <div class="scene-vignette"></div>
        <div class="enemy-plate">
          <div class="ep-name">${esc(e.name)}</div>
          <div class="ep-sub">${e.boss ? '☠ босс' : 'противник'} · уровень ${e.lvl}</div>
          <div class="bar"><div class="bar-fill" id="enemyHpFill" style="width:100%"></div></div>
          <div class="ep-hp" id="enemyHpText">${fmt(e.hp)} / ${fmt(e.maxHp)}</div>
        </div>
        <div class="windup hidden" id="windupBox">
          <div class="w-text" id="windupText">Враг готовит удар…</div>
          <div class="w-bar"><i id="windupFill"></i></div>
        </div>
        <div id="resultSlot"></div>
      </div>

      <div class="battle-grid">
        <div class="battle-panel">
          <div class="player-strip">
            <div class="player-mini">
              <div class="pm-avatar">${cls.icon}</div>
              <div class="grow">
                <div class="pm-name">${esc(p.name)}</div>
                <div class="pm-class">${esc(cls.role)} · ур. ${p.level}</div>
                <div class="bar hp thin"><div class="bar-fill" id="pHpFill" style="width:100%"></div></div>
              </div>
            </div>
            <div class="battle-bars">
              <div class="bar-row"><span class="bar-label">HP</span><div class="bar hp"><div class="bar-fill" id="pBarHpFill" style="width:100%"></div></div><span class="bar-val" id="pBarHpText"></span></div>
              <div class="bar-row"><span class="bar-label">Энер</span><div class="bar energy"><div class="bar-fill" id="pEnergyFill" style="width:100%"></div></div><span class="bar-val" id="pEnergyText"></span></div>
            </div>
            <div class="stance-box">
              <div class="stance"><span>Атака</span><b>${fmt(Game.getStats().atk)}</b></div>
              <div class="stance"><span>Броня</span><b>${fmt(Game.getStats().armor)}</b></div>
            </div>
          </div>
          <div class="status-row" id="statusRow"></div>
          <div class="skillbar">${skillButtons}
            <button class="skill-btn util" data-action="potion" id="potionBtn" title="Выпить лечебный отвар">
              <span class="sk-key">5</span>
              <span class="sk-icon">🧪</span>
              <span class="sk-name">Отвар</span>
              <span class="sk-cost" id="potionCount">×0</span>
            </button>
          </div>
          <div class="flex flex-wrap mt-12" id="consumablesRow"></div>
          <div class="small dim mt-12">Клавиши 1–4 — умения. Отвары и бомбы действуют мгновенно и не тратят ход.</div>
        </div>

        <div class="battle-side">
          <div class="log-box" id="logBox"></div>
          <div class="card pad" style="padding:11px 13px">
            <div class="tag">Памятка</div>
            <p class="small dim mt-8" style="line-height:1.55">1–4 — умения, отвар — мгновенно. Автобой сам применяет умения и лечится, когда здоровье падает ниже трети.</p>
          </div>
        </div>
      </div>
    </section>`;
  }

  function logEntryHTML(entry) {
    const sec = Math.floor((entry.t || 0) / 1000);
    const stamp = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    return `<div class="log-entry ${entry.cls || ''}"><span class="t">${stamp}</span>${esc(entry.text)}</div>`;
  }

  function appendLog(entry) {
    if (screen.name !== 'battle') return;
    const box = document.getElementById('logBox');
    if (!box) return;
    if (box.querySelector('.log-empty')) box.innerHTML = '';
    const div = document.createElement('div');
    div.innerHTML = logEntryHTML(entry);
    box.appendChild(div.firstElementChild);
    while (box.children.length > 70) box.firstElementChild.remove();
    box.scrollTop = box.scrollHeight;
  }

  function renderBattleConsumables() {
    const row = document.getElementById('consumablesRow');
    if (!row) return;
    const items = Game.getConsumables().filter(it => {
      const c = CONSUMABLES[it.cid];
      return c && !c.healPct;
    });
    if (!items.length) {
      row.innerHTML = '<span class="small dim">Дополнительных расходников нет.</span>';
      return;
    }
    row.innerHTML = items.map(it => {
      const c = CONSUMABLES[it.cid];
      return `<button class="btn btn-small" data-action="use-item" data-uid="${it.uid}" title="${esc(c.desc)}">${it.icon} ${esc(c.name)} · ${it.qty}</button>`;
    }).join('');
  }

  function syncBattle(force = false) {
    const b = Game.battle;
    if (!b || screen.name !== 'battle') return;
    const stats = Game.getStats();
    const enemyPct = pct(b.enemy.hp, b.enemy.maxHp);
    const hpPct = pct(b.hp, b.maxHp);
    const enPct = pct(b.energy, b.maxEnergy);

    const set = (id, prop, value) => {
      const node = document.getElementById(id);
      if (!node) return;
      if (prop === 'width') node.style.width = `${value}%`;
      else if (prop === 'text') node.textContent = value;
    };
    set('enemyHpFill', 'width', enemyPct);
    set('enemyHpText', 'text', `${fmt(Math.max(0, b.enemy.hp))} / ${fmt(b.enemy.maxHp)}`);
    set('pHpFill', 'width', hpPct);
    set('pBarHpFill', 'width', hpPct);
    set('pBarHpText', 'text', `${fmt(Math.max(0, b.hp))} / ${fmt(b.maxHp)}`);
    set('pEnergyFill', 'width', enPct);
    set('pEnergyText', 'text', `${Math.floor(b.energy)} / ${Math.floor(b.maxEnergy)}`);
    if (screen.name === 'battle') {
      set('sbHpFill', 'width', hpPct);
      set('sbHpText', 'text', `${fmt(Math.max(0, b.hp))} / ${fmt(b.maxHp)}`);
    }

    const windBox = document.getElementById('windupBox');
    if (windBox) {
      if (b.enemyWindup) {
        windBox.classList.remove('hidden');
        const wt = document.getElementById('windupText');
        if (wt) wt.textContent = b.enemyWindup.warn;
        const wf = document.getElementById('windupFill');
        if (wf) wf.style.transform = `scaleX(${clamp(b.enemyWindup.remaining / b.enemyWindup.total, 0, 1)})`;
      } else {
        windBox.classList.add('hidden');
      }
    }

    const statuses = [];
    if (b.shield > 0) statuses.push(`<span class="status-pill shield">🛡 щит ${fmt(b.shield)}</span>`);
    for (const bf of b.buffs) {
      const label = bf.stat === 'atk' ? 'атака' : bf.stat === 'armor' ? 'броня' : 'уклонение';
      statuses.push(`<span class="status-pill buff">↑ ${label} +${bf.pct}% · ${Math.ceil(bf.remaining)}с</span>`);
    }
    if (b.playerStun > 0) statuses.push(`<span class="status-pill stun">✶ оглушён ${b.playerStun.toFixed(1)}с</span>`);
    for (const d of b.dots) statuses.push(`<span class="status-pill ${d.kind}">${d.kind === 'burn' ? '🔥' : d.kind === 'poison' ? '☠' : '🩸'} ${d.dps}/с · ${Math.ceil(d.remaining)}с</span>`);
    const key = statuses.join('|');
    if (key !== lastStatusKey) {
      lastStatusKey = key;
      const row = document.getElementById('statusRow');
      if (row) row.innerHTML = statuses.join('') || '<span class="small dim">Статусов нет</span>';
    }

    const skills = CLASSES[Game.state.player.classId].skills;
    for (const sk of skills) {
      const btn = document.querySelector(`.skill-btn[data-skill="${sk.id}"]`);
      if (!btn) continue;
      const locked = Game.state.player.level < sk.unlock;
      const cd = b.cooldowns[sk.id] || 0;
      const veil = btn.querySelector('.cd-veil');
      if (veil) {
        if (cd > 0.05) { veil.classList.remove('hidden'); veil.textContent = Math.ceil(cd); }
        else veil.classList.add('hidden');
      }
      btn.classList.toggle('locked', locked);
      btn.classList.toggle('no-energy', !locked && b.energy < sk.cost);
      btn.disabled = locked || cd > 0.05 || b.playerStun > 0 || !!b.result;
    }

    const potionBtn = document.getElementById('potionBtn');
    if (potionBtn) {
      const potion = Game.getConsumables().find(it => {
        const c = CONSUMABLES[it.cid];
        return c && c.healPct;
      });
      const count = potion ? potion.qty : 0;
      const cnt = document.getElementById('potionCount');
      if (cnt) cnt.textContent = `×${count}`;
      if (potion) potionBtn.dataset.uid = potion.uid;
      else delete potionBtn.dataset.uid;
      potionBtn.disabled = !potion || !!b.result;
    }

    const autoBtn = document.getElementById('autoBtn');
    if (autoBtn) autoBtn.textContent = `⚙ Автобой: ${b.auto ? 'вкл' : 'выкл'}`;
    if (force) { /* noop */ }
  }

  function clearResultOverlay() {
    document.querySelectorAll('body > .result-overlay').forEach(n => n.remove());
    const modalOpen = el.modal && !el.modal.classList.contains('hidden');
    if (!modalOpen) document.body.style.overflow = '';
  }

  function showResult() {
    const b = Game.battle;
    if (!b || !b.result || resultShown) return;
    resultShown = true;
    const r = b.result;
    const type = b.type;
    const old = document.querySelector('body > .result-overlay');
    if (old) old.remove();

    let actions = '';
    if (r.wave) {
      actions = `<button class="btn btn-primary" data-result="continue">Следующая волна →</button>`;
    } else if (r.win) {
      if (type === 'raid') {
        actions = `<button class="btn btn-primary" data-result="raid-city">Вернуться в Порог</button><button class="btn" data-result="map">На карту</button>`;
      } else if (type === 'boss') {
        actions = `<button class="btn btn-primary" data-result="location">К локации</button><button class="btn" data-result="city">В город</button><button class="btn btn-ghost" data-result="map">На карту</button>`;
      } else {
        actions = `<button class="btn btn-primary" data-result="again">Ещё бой</button><button class="btn" data-result="location">К локации</button><button class="btn btn-ghost" data-result="city">В город</button>`;
      }
    } else if (r.fled) {
      actions = `<button class="btn btn-primary" data-result="location">К локации</button><button class="btn" data-result="city">В город</button><button class="btn btn-ghost" data-result="map">На карту</button>`;
    } else {
      actions = `<button class="btn btn-primary" data-result="city">Очнуться в городе</button><button class="btn" data-result="map">На карту</button>`;
    }

    const loot = (r.items || []).map(it => `<div class="reward-item ${cssRarity(it.rarity)}">
      <span class="ri-icon">${it.icon}</span>
      <div class="grow">
        <span class="rarity-text ${cssRarity(it.rarity)}">${esc(it.name)}</span>${it.qty > 1 ? ` ×${it.qty}` : ''}
        ${it.soldFor ? `<div class="small dim">Инвентарь полон — продано за ${fmt(it.soldFor)} зл.</div>` : ''}
      </div>
    </div>`).join('');

    const icon = r.wave ? '🌫️' : r.win ? (type === 'raid' ? '♛' : '🏆') : r.fled ? '🌪️' : '💀';
    const resClass = r.win || r.wave ? 'win' : 'lose';
    const stats = r.wave ? '' : `<div class="result-stats">
      ${r.gold ? `<div class="result-stat"><span>золото</span><b>+${fmt(r.gold)}</b></div>` : ''}
      ${r.xp ? `<div class="result-stat"><span>опыт</span><b>+${fmt(r.xp)}</b></div>` : ''}
      ${r.goldLost ? `<div class="result-stat"><span>потеряно</span><b>−${fmt(r.goldLost)}</b></div>` : ''}
    </div>`;

    const overlay = document.createElement('div');
    overlay.className = 'result-overlay';
    overlay.innerHTML = `<div class="result-card ${resClass}">
      <div class="res-icon">${icon}</div>
      <h2>${esc(r.title)}</h2>
      <div class="res-sub">${esc(r.subtitle || '')}</div>
      ${stats}
      ${r.levels ? `<div class="chip ember mt-8">Новый уровень!</div>` : ''}
      ${loot ? `<div class="reward-list">${loot}</div>` : ''}
      ${r.tip ? `<p class="small dim mt-8">${esc(r.tip)}</p>` : ''}
      ${r.win && !r.wave && type === 'raid' ? `<p class="small dim mt-8">Титул: «Погасивший Хор». Королева умолкла — но Хмарь всё ещё помнит.</p>` : ''}
      <div class="result-actions">${actions}</div>
    </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }

  function handleResultAction(action) {
    const b = Game.battle;
    if (!b) return;
    const areaId = b.areaId;
    clearResultOverlay();
    if (action === 'continue') {
      Game.nextRaidWave();
      resultShown = false;
      render();
      return;
    }
    if (action === 'again') {
      Game.leaveBattle();
      const res = Game.startHunt(areaId);
      if (res.ok) openBattle();
      else { toast(res.msg || 'Не удалось начать бой.', 'bad'); openLocation(areaId); }
      return;
    }
    if (action === 'location') {
      Game.leaveBattle();
      openLocation(areaId);
      return;
    }
    if (action === 'city' || action === 'raid-city') {
      Game.leaveBattle();
      openCity(action === 'raid-city' ? 'gate' : Game.state.lastCity);
      return;
    }
    if (action === 'map') {
      Game.leaveBattle();
      openMap();
    }
  }

  /* ---------- инвентарь ---------- */
  function renderInventory() {
    const p = Game.state.player;
    const s = Game.getStats();
    const cls = playerClass();

    const slotHtml = slot => {
      const it = p.equipment[slot.id];
      const inner = it
        ? `<div class="es-icon">${it.icon}</div>
           <div class="grow"><div class="es-slot">${slot.name}</div><div class="es-name rarity-text ${cssRarity(it.rarity)}">${esc(it.name)}</div><div class="small dim">ур. ${it.level}</div></div>
           <span class="rarity-pip" style="background:${rar(it.rarity).color}"></span>`
        : `<div class="es-icon">${slot.icon}</div><div class="grow"><div class="es-slot">${slot.name}</div><div class="es-empty">пусто</div></div>`;
      return `<div class="equip-slot ${it ? 'filled ' + cssRarity(it.rarity) : ''}"
        data-action="${it ? 'open-equipped' : 'empty-slot'}" ${it ? `data-slot="${slot.id}" ${itemTip(it)}` : ''}>${inner}</div>`;
    };

    let cells = '';
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const it = p.inventory[i];
      if (!it) { cells += '<div class="inv-item empty"></div>'; continue; }
      const isCons = it.type === 'consumable';
      cells += `<div class="inv-item ${cssRarity(it.rarity)}" data-action="open-item" data-uid="${it.uid}" ${itemTip(it)}>
        ${isCons ? '' : `<span class="ii-lvl">ур.${it.level}</span>`}
        <div class="ii-icon">${it.icon}</div>
        <div class="ii-name">${esc(it.name)}</div>
        ${isCons ? `<span class="ii-qty">${it.qty}</span>` : ''}
      </div>`;
    }

    const commons = p.inventory.filter(it => it.type === 'gear' && it.rarity === 'common').length;

    return `<section class="screen">
      <div class="screen-head">
        <div>
          <div class="eyebrow">Снаряжение · ${p.inventory.length}/${INVENTORY_SIZE}</div>
          <h1 class="title-xl">Инвентарь</h1>
          <p class="subtitle">Каждая вещь помнит своего владельца. Выбирай, чью память тебе нести дальше.</p>
        </div>
        <div class="flex">
          <span class="chip ember">💰 ${fmt(p.gold)} золота</span>
        </div>
      </div>

      <div class="inv-layout">
        <div class="equip-panel">
          <div class="flex spread" style="margin-bottom:12px">
            <h3 style="font-size:21px">Экипировка</h3>
            <span class="chip">${esc(cls.role)}</span>
          </div>
          <div class="equip-body">
            <div class="equip-col">${SLOTS.map(slotHtml).join('')}</div>
          </div>
          <div class="divider"></div>
          <div class="stats-grid">
            <div class="stat-box"><span>Атака</span><b>${fmt(s.atk)}</b></div>
            <div class="stat-box"><span>Броня</span><b>${fmt(s.armor)}</b></div>
            <div class="stat-box"><span>Крит</span><b>${s.crit}%</b></div>
            <div class="stat-box"><span>Уклонение</span><b>${s.dodge}%</b></div>
          </div>
        </div>

        <div class="inv-panel">
          <div class="inv-head">
            <h3>Сумка</h3>
            <div class="flex">
              <button class="btn btn-small btn-ghost" data-action="sell-common" ${commons ? '' : 'disabled'}>Продать обычное (${commons})</button>
            </div>
          </div>
          <div class="inv-grid">${cells}</div>
          <div class="inv-foot">
            <span>${p.inventory.length} / ${INVENTORY_SIZE} ячеек занято</span>
            <span>Нажми на предмет, чтобы надеть, продать или изучить.</span>
          </div>
        </div>
      </div>

      <div class="card pad mt-16">
        <div class="flex spread flex-wrap">
          <div class="tag">Общие характеристики</div>
          <span class="small dim">+${fmt(s.lifesteal)}% похищения жизни · +${fmt(s.goldFind)}% золота · +${fmt(s.xpFind)}% опыта</span>
        </div>
        <div class="stats-grid mt-12">
          <div class="stat-box"><span>Здоровье</span><b>${fmt(s.maxHp)}</b></div>
          <div class="stat-box"><span>Энергия</span><b>${fmt(s.energyMax)}</b></div>
          <div class="stat-box"><span>Крит. урон</span><b>${s.critDmg}%</b></div>
          <div class="stat-box"><span>Скорость атаки</span><b>${(1 / s.attackInterval).toFixed(1)}/с</b></div>
        </div>
      </div>
    </section>`;
  }

  /* ---------- персонаж ---------- */
  function renderCharacter() {
    const p = Game.state.player;
    const cls = CLASSES[p.classId];
    const s = Game.getStats();
    const st = Game.state.stats;

    const attrs = [
      { id: 'str', name: 'Сила', desc: `атака +${cls.attrDmg.str} · здоровье +3` },
      { id: 'agi', name: 'Ловкость', desc: `атака +${cls.attrDmg.agi} · крит +0.25% · уклонение +0.2%` },
      { id: 'int', name: 'Интеллект', desc: `атака +${cls.attrDmg.int} · энергия +2` },
      { id: 'vit', name: 'Живучесть', desc: 'здоровье +9 · броня +0.6' },
    ];

    const attrHtml = attrs.map(a => `<div class="attr-row">
      <span class="ar-name">${a.name}</span>
      <span class="ar-val">${p.attrs[a.id]}</span>
      <span class="ar-desc">${a.desc}</span>
      <button class="btn btn-small" data-action="attr" data-attr="${a.id}" ${p.points <= 0 ? 'disabled' : ''}>+</button>
    </div>`).join('');

    const skills = cls.skills.map(sk => {
      const locked = p.level < sk.unlock;
      return `<div class="skill-card ${locked ? 'locked' : ''}">
        <div class="sc-icon">${sk.icon}</div>
        <div class="grow">
          <h4>${esc(sk.name)} ${locked ? `<span class="small dim">· с ${sk.unlock} ур.</span>` : ''}</h4>
          <p>${esc(sk.desc)}</p>
          <div class="sc-meta"><span>${sk.cost} энергии</span><span>КД ${sk.cd} сек</span><span>${locked ? 'закрыто' : 'доступно'}</span></div>
        </div>
      </div>`;
    }).join('');

    return `<section class="screen">
      <div class="screen-head">
        <div>
          <div class="eyebrow">${esc(cls.role)} · ${esc(cls.name)}</div>
          <h1 class="title-xl">${esc(p.name)}</h1>
          <p class="subtitle">${esc(cls.desc)}</p>
        </div>
        <div class="flex">
          <span class="chip ember">Уровень ${p.level}</span>
          ${Game.state.progress.title ? `<span class="chip">«${esc(Game.state.progress.title)}»</span>` : ''}
          <span class="chip">${fmt(p.xp)} / ${p.level >= MAX_LEVEL ? '∞' : fmt(Game.xpNeeded(p.level))} опыта</span>
        </div>
      </div>

      <div class="grid g2">
        <div>
          <div class="card pad">
            <div class="flex spread">
              <h3 style="font-size:22px">Характеристики</h3>
              <span class="points-note">${p.points > 0 ? `свободных очков: ${p.points}` : 'очков нет'}</span>
            </div>
            <div class="attr-list mt-12">${attrHtml}</div>
            <p class="small dim mt-12">За каждый уровень — 2 очка. Каждое очко меняет игру: атака, здоровье, крит, энергия.</p>
          </div>

          <div class="card pad mt-16">
            <h3 style="font-size:22px;margin-bottom:12px">Умения класса</h3>
            <div class="skill-cards">${skills}</div>
          </div>
        </div>

        <div>
          <div class="card pad">
            <h3 style="font-size:22px;margin-bottom:12px">Боевые показатели</h3>
            <div class="stats-grid">
              <div class="stat-box"><span>Атака</span><b>${fmt(s.atk)}</b></div>
              <div class="stat-box"><span>Здоровье</span><b>${fmt(s.maxHp)}</b></div>
              <div class="stat-box"><span>Броня</span><b>${fmt(s.armor)}</b></div>
              <div class="stat-box"><span>Крит. шанс</span><b>${s.crit}%</b></div>
              <div class="stat-box"><span>Крит. урон</span><b>${s.critDmg}%</b></div>
              <div class="stat-box"><span>Уклонение</span><b>${s.dodge}%</b></div>
              <div class="stat-box"><span>Энергия</span><b>${fmt(s.energyMax)}</b></div>
              <div class="stat-box"><span>Реген энергии</span><b>${s.energyRegen}/с</b></div>
              <div class="stat-box"><span>Похищение жизни</span><b>${s.lifesteal}%</b></div>
              <div class="stat-box"><span>Находка золота</span><b>${s.goldFind}%</b></div>
            </div>
          </div>

          <div class="card pad mt-16">
            <h3 style="font-size:22px;margin-bottom:12px">Путь</h3>
            <div class="contract-list">
              <div class="contract-card"><div class="contract-icon">⚔</div><div class="grow"><div class="c-title">Убито противников</div><div class="c-sub">обычные и боссы</div></div><b>${fmt(st.kills)}</b></div>
              <div class="contract-card"><div class="contract-icon">☠</div><div class="grow"><div class="c-title">Побеждено боссов</div><div class="c-sub">печати локаций</div></div><b>${fmt(st.bossKills)}</b></div>
              <div class="contract-card"><div class="contract-icon">🩸</div><div class="grow"><div class="c-title">Смертей</div><div class="c-sub">пепел помнит</div></div><b>${fmt(st.deaths)}</b></div>
              <div class="contract-card"><div class="contract-icon">♛</div><div class="grow"><div class="c-title">Рейдов пройдено</div><div class="c-sub">Сердце Хмари</div></div><b>${fmt(Game.state.progress.raidClears)}</b></div>
            </div>
            ${Game.state.progress.title ? `<div class="divider"></div><div class="flex"><span class="tag">Титул</span><span class="chip ember">«${esc(Game.state.progress.title)}»</span></div>` : ''}
          </div>
        </div>
      </div>
    </section>`;
  }

  /* ---------- кодекс ---------- */
  function renderLore() {
    const unlocked = Game.state.lore;
    const cards = LORE_ORDER.map(id => {
      const entry = LORE[id];
      const open = unlocked.includes(id);
      const hint = entry.cat === 'Место' ? 'Посетите это место.'
        : entry.cat === 'Тварь' ? 'Победите этого противника.'
        : entry.cat === 'Лицо' ? 'Поговорите с этим человеком.'
        : 'Откроется по ходу истории.';
      return `<div class="lore-card ${open ? '' : 'locked'}">
        <div class="lore-cat">${entry.cat}</div>
        <h3>${open ? esc(entry.title) : '???'}</h3>
        ${open ? `<p>${esc(entry.text)}</p>` : `<p>Запись ещё не открыта. ${hint}</p>`}
        ${open ? '' : `<div class="lore-hint">${hint}</div>`}
      </div>`;
    }).join('');

    return `<section class="screen">
      <div class="screen-head">
        <div>
          <div class="eyebrow">Память · ${unlocked.length}/${LORE_ORDER.length}</div>
          <h1 class="title-xl">Кодекс Предела</h1>
          <p class="subtitle">Здесь записано то, что ещё можно вспомнить. Пока мы читаем имена вслух, Хмарь не может забрать их окончательно.</p>
        </div>
        <div style="min-width:180px">
          ${progressBar(unlocked.length, LORE_ORDER.length)}
          <div class="small dim mt-8">открыто ${unlocked.length} из ${LORE_ORDER.length}</div>
        </div>
      </div>
      <div class="lore-grid">${cards}</div>
    </section>`;
  }

  /* ---------- модалки ---------- */
  function openModal(html, wide = false) {
    if (!el.modal) return;
    hideTooltip();
    el.modal.classList.remove('hidden');
    el.modal.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">
      <button class="modal-close" data-action="close-modal" title="Закрыть">✕</button>
      ${html}
    </div>`;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!el.modal) return;
    el.modal.classList.add('hidden');
    el.modal.innerHTML = '';
    document.body.style.overflow = '';
    currentNpc = null;
    hideTooltip();
  }

  function openNpc(id) {
    const npc = NPCS.find(n => n.id === id);
    if (!npc) return;
    currentNpc = id;
    const talk = Game.talkNPC(id);
    const line = talk.ok ? talk.line : npc.lines[0];
    const gifted = !!Game.state.npcGifts[id];
    const loreOpen = npc.lore && Game.state.lore.includes(npc.lore);
    openModal(`<div class="modal-sub">${esc(npc.role)}</div>
      <h2>${esc(npc.name)}</h2>
      <div class="dialog">
        <div class="npc-face" style="color:${npc.color}">${npc.icon}</div>
        <div class="dialog-text">${esc(line)}</div>
      </div>
      ${loreOpen ? `<div class="gift-note">Запись в кодексе: «${esc(LORE[npc.lore].title)}»</div>` : ''}
      <div class="dialog-actions mt-12">
        <button class="btn" data-action="npc-talk" data-id="${id}">Расспросить ещё</button>
        ${gifted
          ? `<span class="chip unlock">✦ помощь уже получена</span>`
          : `<button class="btn btn-primary" data-action="npc-gift" data-id="${id}">Принять помощь · ${esc(npc.giftText)}</button>`}
      </div>`);
  }

  function openShop(id) {
    const m = MERCHANTS.find(x => x.id === id);
    if (!m) return;
    const shop = Game.ensureShop(id);
    const p = Game.state.player;
    const stock = shop.stock || [];
    const rows = stock.map((entry, index) => {
      if (entry.kind === 'gear') {
        const it = entry.item;
        return `<div class="shop-item ${cssRarity(it.rarity)}" data-action="shop-item" data-shop="${id}" data-index="${index}" ${itemTip(it)} title="Открыть: ${esc(it.name)}">
          <div class="si-icon">${it.icon}</div>
          <div class="grow">
            <div class="si-name rarity-text ${cssRarity(it.rarity)}">${esc(it.name)}</div>
            <div class="si-sub">${SLOT_MAP[it.slot].name} · ур. ${it.level} · ${rar(it.rarity).name}</div>
          </div>
          <div class="si-price">${fmt(entry.price)} зл.</div>
        </div>`;
      }
      const c = CONSUMABLES[entry.cid];
      return `<div class="shop-item" data-action="shop-item" data-shop="${id}" data-index="${index}" title="Открыть: ${esc(c.name)}">
        <div class="si-icon">${c.icon}</div>
        <div class="grow">
          <div class="si-name">${esc(c.name)}</div>
          <div class="si-sub">${esc(c.desc)} · осталось ${entry.stock}</div>
        </div>
        <div class="si-price">${fmt(entry.price)} зл.</div>
      </div>`;
    }).join('');

    const restock = 25 + p.level * 2;
    openModal(`<div class="modal-sub">${esc(m.role)}</div>
      <h2>${esc(m.name)}</h2>
      <p class="mt-8" style="font-family:var(--font-display);font-style:italic;font-size:17px;color:#c9b9a5">«${esc(m.greeting)}»</p>
      <div class="shop-balance mt-16">
        <div><span class="tag">Твой кошелёк</span><div class="gold-big">${fmt(p.gold)} <span class="small muted">золота</span></div></div>
        <button class="btn btn-small btn-ghost" data-action="refresh-shop" data-shop="${id}">Обновить товар · ${restock} зл.</button>
      </div>
      <div class="shop-grid">${rows || '<div class="inv-empty-note">Полки пусты. Обнови товар.</div>'}</div>
      <div class="small dim mt-16">Нажми на вещь, чтобы рассмотреть её перед покупкой. Продать снаряжение можно в инвентаре.</div>`, true);
  }

  function itemStatsHTML(item) {
    if (!item || item.type === 'consumable') return '';
    const rows = Object.entries(item.stats).map(([k, v]) => `<div><span>${STAT_LABELS[k] || k}</span><b>${PCT_STATS.has(k) ? '+' + v + '%' : '+' + Math.round(v)}</b></div>`).join('');
    const eq = Game.state.player.equipment[item.slot];
    let compare = '';
    if (eq && eq.uid !== item.uid) {
      const deltas = [];
      const keys = new Set([...Object.keys(item.stats), ...Object.keys(eq.stats)]);
      for (const k of keys) {
        const d = (item.stats[k] || 0) - (eq.stats[k] || 0);
        if (Math.abs(d) > 0.001) {
          deltas.push(`<span class="${d > 0 ? 'up' : 'down'}">${STAT_LABELS[k]} ${d > 0 ? '+' : ''}${PCT_STATS.has(k) ? d.toFixed(1) + '%' : Math.round(d)}</span>`);
        }
      }
      compare = `<div class="it-compare">Надето: ${esc(eq.name)}<br>${deltas.join(' · ') || 'характеристики совпадают'}</div>`;
    } else if (!eq) {
      compare = `<div class="it-compare">Слот пуст</div>`;
    }
    return `<div class="it-stats mt-12">${rows}</div>${compare}`;
  }

  function openShopEntryModal(shopId, index) {
    const m = MERCHANTS.find(x => x.id === shopId);
    const shop = Game.ensureShop(shopId);
    if (!m || !shop) return;
    const entry = shop.stock[index];
    if (!entry) { toast('Товар уже разобрали.', 'dim'); return; }
    const p = Game.state.player;
    if (entry.kind === 'gear') {
      const it = entry.item;
      openModal(`<div class="modal-sub">${esc(m.name)} · ${SLOT_MAP[it.slot].name} · уровень ${it.level}</div>
        <h2 class="rarity-text ${cssRarity(it.rarity)}">${esc(it.name)}</h2>
        ${itemStatsHTML(it)}
        <div class="small dim mt-12">Цена: <b class="gold">${fmt(entry.price)} зл.</b> · продажа: ${Math.round(it.value * 0.35)} зл.</div>
        <div class="dialog-actions mt-22">
          <button class="btn btn-primary" data-action="buy" data-shop="${shopId}" data-index="${index}" ${p.gold < entry.price ? 'disabled' : ''}>Купить за ${fmt(entry.price)} зл.</button>
          <button class="btn btn-ghost" data-action="close-modal">Отмена</button>
        </div>`);
    } else {
      const c = CONSUMABLES[entry.cid];
      openModal(`<div class="modal-sub">${esc(m.name)} · расходник</div>
        <h2>${esc(c.name)}</h2>
        <p class="muted mt-12" style="line-height:1.6">${esc(c.desc)}</p>
        <div class="small dim mt-12">Цена: <b class="gold">${fmt(entry.price)} зл.</b> · в наличии: ${entry.stock}</div>
        <div class="dialog-actions mt-22">
          <button class="btn btn-primary" data-action="buy" data-shop="${shopId}" data-index="${index}" ${p.gold < entry.price ? 'disabled' : ''}>Купить за ${fmt(entry.price)} зл.</button>
          <button class="btn btn-ghost" data-action="close-modal">Отмена</button>
        </div>`);
    }
  }

  function openItemModal(item, equipped, slotId = null) {
    if (!item) return;
    hideTooltip();
    const c = item.type === 'consumable' ? CONSUMABLES[item.cid] : null;
    const stats = c
      ? `<p class="muted mt-12">${esc(c.desc)}</p>`
      : itemStatsHTML(item);
    const baseValue = c ? c.value : (item.value || 0);
    const value = Math.round(baseValue * 0.35 * (item.type === 'consumable' ? (item.qty || 1) : 1));
    const sellLabel = item.type === 'consumable' && item.qty > 1 ? `Продать всё (+${value} зл.)` : `Продать (+${value} зл.)`;
    const actions = item.type === 'consumable'
      ? `<button class="btn" data-action="item-sell" data-uid="${item.uid}">${sellLabel}</button>
         <span class="chip">действует в бою</span>`
      : equipped
        ? `<button class="btn btn-primary" data-action="item-unequip" data-slot="${slotId || item.slot}">Снять</button>
           <span class="chip">надето</span>`
        : `<button class="btn btn-primary" data-action="item-equip" data-uid="${item.uid}">Надеть</button>
           <button class="btn" data-action="item-sell" data-uid="${item.uid}">${sellLabel}</button>`;
    openModal(`<div class="modal-sub">${item.type === 'consumable' ? 'Расходник' : (SLOT_MAP[item.slot] ? SLOT_MAP[item.slot].name : 'Предмет')} · ${item.type === 'consumable' ? rar(item.rarity).name : 'уровень ' + item.level}</div>
      <h2 class="rarity-text ${cssRarity(item.rarity)}">${esc(item.name)}</h2>
      ${stats}
      <div class="small dim mt-12">Стоимость: ${fmt(baseValue)} зл. · продажа: ${value} зл.</div>
      <div class="dialog-actions mt-22">${actions}<button class="btn btn-ghost" data-action="close-modal">Закрыть</button></div>`);
  }

  function openSellConfirm(item) {
    const value = Math.round((item.value || 10) * 0.35);
    openModal(`<div class="modal-sub">${rar(item.rarity).name} предмет</div>
      <h2 class="rarity-text ${cssRarity(item.rarity)}">${esc(item.name)}</h2>
      <p class="muted mt-12">Вещь редкая. Точно продать её за ${value} золота? Вернуть будет нельзя.</p>
      <div class="dialog-actions mt-22">
        <button class="btn btn-blood" data-action="sell-confirm" data-uid="${item.uid}">Продать за ${value} зл.</button>
        <button class="btn btn-ghost" data-action="close-modal">Оставить</button>
      </div>`);
  }

  function openRaidModal() {
    const p = Game.state.player;
    const unlocked = Game.raidUnlocked();
    const canPay = p.gold >= RAID.entryGold;
    const clears = Game.state.progress.raidClears;
    openModal(`<div class="modal-sub">Рейд · ${RAID.reqLevel}+</div>
      <h2>${RAID.name}</h2>
      <p class="muted mt-12" style="line-height:1.6">${esc(RAID.desc)}</p>
      <div class="raid-waves mt-12">${RAID.waves.map((w, i) => `<span class="wave-pill">${i + 1}. ${esc(w.label)}</span>`).join('')}</div>
      <div class="card pad mt-16" style="background:rgba(255,255,255,.02)">
        <div class="grid g2">
          <div class="stat-box"><span>Вход</span><b>${RAID.entryGold} зл.</b></div>
          <div class="stat-box"><span>Пройдено</span><b>${clears}</b></div>
          <div class="stat-box"><span>Награда</span><b>${fmt(RAID.rewardGold)}+ зл.</b></div>
          <div class="stat-box"><span>Добыча</span><b>легендарная</b></div>
        </div>
      </div>
      ${unlocked
        ? (canPay ? `<div class="gift-note">Ставка списывается сразу. Отступить из рейда нельзя.</div>` : `<div class="small red mt-12">Не хватает ${RAID.entryGold - p.gold} золота.</div>`)
        : `<div class="small red mt-12">Нужны 12-й уровень и победа над Стражем Врат.</div>`}
      <div class="dialog-actions mt-22">
        <button class="btn btn-primary" data-action="raid-start" ${unlocked && canPay ? '' : 'disabled'}>Войти в Сердце Хмари</button>
        <button class="btn btn-ghost" data-action="close-modal">Отступить</button>
      </div>`, true);
  }

  function openResetModal() {
    openModal(`<div class="modal-sub">Огонь можно зажечь заново</div>
      <h2>Начать с начала?</h2>
      <p class="muted mt-12" style="line-height:1.6">Весь прогресс — уровень, снаряжение, золото, кодекс — будет удалён. Это не откат, а новый костёр.</p>
      <div class="dialog-actions mt-22">
        <button class="btn btn-blood" data-action="reset-confirm">Стереть прогресс</button>
        <button class="btn btn-ghost" data-action="close-modal">Оставить как есть</button>
      </div>`);
  }

  function openSellCommonModal() {
    const inv = Game.state.player.inventory;
    pendingCommonSell = inv.filter(it => it.type === 'gear' && it.rarity === 'common');
    if (!pendingCommonSell.length) { toast('Обычных предметов в сумке нет.', 'dim'); return; }
    const total = pendingCommonSell.reduce((sum, it) => sum + Game.shopSellPrice(it), 0);
    openModal(`<div class="modal-sub">Скупка снаряжения</div>
      <h2>Продать обычное?</h2>
      <p class="muted mt-12">Будет продано предметов: ${pendingCommonSell.length}. Выручка: <b class="gold">${fmt(total)} золота</b>.</p>
      <div class="dialog-actions mt-22">
        <button class="btn btn-primary" data-action="sell-common-confirm">Продать</button>
        <button class="btn btn-ghost" data-action="close-modal">Отмена</button>
      </div>`);
  }

  /* ---------- интро ---------- */
  function showIntro() {
    if (!el.intro) return;
    selectedClass = 'warrior';
    const cards = Object.values(CLASSES).map(c => `<div class="class-card ${selectedClass === c.id ? 'selected' : ''}" data-class="${c.id}">
      <div class="cc-icon">${c.icon}</div>
      <h3>${c.name}</h3>
      <div class="cc-role">${c.role}</div>
      <p>${c.desc}</p>
      <div class="cc-stats">
        <span>HP <b>${c.base.hp}</b></span>
        <span>атака <b>${c.base.atk}</b></span>
        <span>броня <b>${c.base.armor}</b></span>
        <span>крит <b>${c.base.crit}%</b></span>
      </div>
    </div>`).join('');

    el.intro.classList.remove('hidden');
    el.intro.innerHTML = `<div class="intro-inner">
      <div class="intro-kicker">текстовая ролевая игра</div>
      <h1>Пепельный Предел</h1>
      <p class="intro-sub">Хмарь стёрла имена городов и лица людей. Остался Предел — четыре огня на кромке пепла. Ты — один из тех, кто ещё помнит своё имя. Пока помнишь.</p>
      <div class="intro-rule"></div>
      <div class="intro-block">
        <div class="intro-label">Выбери, кем ты был до пепла</div>
        <div class="class-grid">${cards}</div>
      </div>
      <div class="intro-form">
        <input class="name-input" id="introName" maxlength="18" placeholder="Имя героя" autocomplete="off">
        <button class="btn btn-primary" data-action="start-game">Зажечь свой огонь →</button>
      </div>
      <p class="small dim center mt-16">Прогресс сохраняется в этом браузере. Звук можно выключить позже.</p>
    </div>`;
    document.body.style.overflow = '';
  }

  function startGame() {
    const input = document.getElementById('introName');
    const name = input ? input.value : '';
    Game.newGame(name, selectedClass);
    if (el.intro) {
      el.intro.classList.add('hidden');
      el.intro.innerHTML = '';
    }
    screen = { name: 'map', areaId: null, cityId: null };
    render();
    updateSoundBtn();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    playSound('levelup');
    toast(`<b>${esc(Game.state.player.name)}</b>, Предел ждёт. Начни с Пепельных полей.`, 'good');
  }

  /* ---------- тултип ---------- */
  function tooltipHTML(item) {
    if (!item) return '';
    const isCons = item.type === 'consumable';
    const c = isCons ? CONSUMABLES[item.cid] : null;
    const flavor = {
      common: 'Пепел ещё не тронул эту вещь.',
      uncommon: 'Ещё помнит руки прежнего хозяина.',
      rare: 'На металле проступает чужое имя.',
      epic: 'Вещь помнит больше, чем её владелец.',
      legendary: 'Пепел обходит её стороной.',
    }[item.rarity] || '';
    let stats = '';
    if (isCons) {
      stats = `<div class="it-stats"><div><span>${esc(c.desc)}</span></div></div>`;
    } else {
      stats = `<div class="it-stats">${Object.entries(item.stats).map(([k, v]) => `<div><span>${STAT_LABELS[k] || k}</span><b>${PCT_STATS.has(k) ? '+' + v + '%' : '+' + Math.round(v)}</b></div>`).join('')}</div>`;
      const eq = Game.state.player.equipment[item.slot];
      if (eq && eq.uid !== item.uid) {
        const deltas = [];
        const keys = new Set([...Object.keys(item.stats), ...Object.keys(eq.stats)]);
        for (const k of keys) {
          const d = (item.stats[k] || 0) - (eq.stats[k] || 0);
          if (Math.abs(d) > 0.001) deltas.push(`<span class="${d > 0 ? 'up' : 'down'}">${STAT_LABELS[k]} ${d > 0 ? '+' : ''}${PCT_STATS.has(k) ? d.toFixed(1) + '%' : Math.round(d)}</span>`);
        }
        stats += `<div class="it-compare">Надето: ${esc(eq.name)}<br>${deltas.join(' · ') || 'характеристики совпадают'}</div>`;
      } else if (!eq) {
        stats += `<div class="it-compare">Слот пуст</div>`;
      }
    }
    const value = isCons ? Math.round(c.value * 0.35 * (item.qty || 1)) : Math.round((item.value || 0) * 0.35);
    return `<div class="it-name rarity-text ${cssRarity(item.rarity)}">${esc(item.name)}</div>
      <div class="it-meta">${isCons ? 'расходник' : SLOT_MAP[item.slot].name + ' · уровень ' + item.level} · ${rar(item.rarity).name}</div>
      ${stats}
      <div class="it-flavor">${esc(flavor)}</div>
      <div class="it-value">Продажа: ${value} зл.</div>`;
  }

  function showTooltip(item, x, y) {
    if (!item || !el.tooltip) return;
    el.tooltip.innerHTML = tooltipHTML(item);
    el.tooltip.classList.remove('hidden');
    tooltipOn = true;
    positionTooltip(x, y);
  }

  function positionTooltip(x, y) {
    if (!el.tooltip || !tooltipOn) return;
    const r = el.tooltip.getBoundingClientRect();
    let tx = x + 18;
    let ty = y + 18;
    if (tx + r.width > window.innerWidth - 10) tx = x - r.width - 18;
    if (ty + r.height > window.innerHeight - 10) ty = y - r.height - 18;
    el.tooltip.style.left = `${Math.max(10, tx)}px`;
    el.tooltip.style.top = `${Math.max(10, ty)}px`;
  }

  function hideTooltip() {
    if (el.tooltip) el.tooltip.classList.add('hidden');
    tooltipOn = false;
  }

  /* ---------- события ---------- */
  function bindEvents() {
    document.addEventListener('click', onClick);
    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mouseout', onMouseOut);
    document.addEventListener('mousemove', e => { if (tooltipOn) positionTooltip(e.clientX, e.clientY); });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', () => ensureAudio(), { once: true });
    window.addEventListener('scroll', hideTooltip, { passive: true });
    if (el.sound) el.sound.addEventListener('click', toggleSound);
    if (el.reset) el.reset.addEventListener('click', openResetModal);
    if (el.brand) el.brand.addEventListener('click', () => { if (Game.state) openMap(); });
  }

  function toggleSound() {
    if (!Game.state) return;
    Game.state.settings.sound = !Game.state.settings.sound;
    Game.save();
    updateSoundBtn();
    if (Game.state.settings.sound) playSound('click');
  }

  function onMouseOver(e) {
    const target = e.target.closest('[data-tip-uid]');
    if (!target) return;
    const item = itemCache[target.dataset.tipUid];
    if (!item) return;
    showTooltip(item, e.clientX, e.clientY);
  }

  function onMouseOut(e) {
    const target = e.target.closest('[data-tip-uid]');
    if (!target) return;
    if (e.relatedTarget && target.contains(e.relatedTarget)) return;
    hideTooltip();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (el.modal && !el.modal.classList.contains('hidden')) { closeModal(); return; }
    }
    if (!Game.state || !Game.battle || screen.name !== 'battle') return;
    if (el.modal && !el.modal.classList.contains('hidden')) return;
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (Game.battle.result) return;
    if (/^[1-4]$/.test(e.key)) {
      e.preventDefault();
      const skill = CLASSES[Game.state.player.classId].skills[Number(e.key) - 1];
      if (skill) tryUseSkill(skill.id);
    }
  }

  function tryUseSkill(id) {
    const res = Game.useSkill(id);
    if (!res.ok && res.msg) { toast(res.msg, 'bad'); playSound('deny'); }
    else if (res.ok) {
      const btn = document.querySelector(`.skill-btn[data-skill="${id}"]`);
      if (btn) { btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 320); }
    }
    syncBattle();
  }

  function onClick(e) {
    const modalWrap = e.target.closest('.modal-wrap');
    if (modalWrap && e.target === modalWrap) { closeModal(); return; }

    const nav = e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); navigate(nav.dataset.nav); return; }

    const classCard = e.target.closest('[data-class]');
    if (classCard) {
      selectedClass = classCard.dataset.class;
      document.querySelectorAll('.class-card').forEach(c => c.classList.toggle('selected', c.dataset.class === selectedClass));
      playSound('click');
      return;
    }

    const cityCard = e.target.closest('[data-city]');
    if (cityCard) {
      const city = CITIES.find(c => c.id === cityCard.dataset.city);
      if (city) openCity(city.id);
      return;
    }

    const areaCard = e.target.closest('[data-area]');
    if (areaCard) {
      openLocation(areaCard.dataset.area);
      return;
    }

    const resultBtn = e.target.closest('[data-result]');
    if (resultBtn) {
      e.preventDefault();
      handleResultAction(resultBtn.dataset.result);
      return;
    }

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    switch (action) {
      case 'close-modal': closeModal(); break;
      case 'start-game': startGame(); break;
      case 'reset-confirm':
        Game.reset();
        closeModal();
        screen = { name: 'map', areaId: null, cityId: null };
        if (el.sidebar) el.sidebar.innerHTML = '';
        if (el.main) el.main.innerHTML = '';
        showIntro();
        break;
      case 'back-map': openMap(); break;
      case 'hunt': {
        const areaId = actionEl.dataset.areaId || screen.areaId;
        const res = Game.startHunt(areaId, actionEl.dataset.mobId);
        if (res.ok) { playSound('click'); openBattle(); }
        else toast(res.msg || 'Не удалось начать бой.', 'bad');
        break;
      }
      case 'boss': {
        const areaId = actionEl.dataset.areaId || screen.areaId;
        const res = Game.startBoss(areaId);
        if (res.ok) { playSound('click'); openBattle(); }
        else toast(res.msg || 'Босс ещё запечатан.', 'bad');
        break;
      }
      case 'flee': {
        const res = Game.flee();
        if (!res.ok) toast(res.msg || 'Отступить не удалось.', 'bad');
        else playSound('flee');
        break;
      }
      case 'toggle-auto': {
        Game.toggleAuto();
        syncBattle();
        break;
      }
      case 'skill': tryUseSkill(actionEl.dataset.skill); break;
      case 'potion': {
        const uid = actionEl.dataset.uid;
        if (!uid) { toast('Лечебных отваров нет.', 'bad'); break; }
        const res = Game.useConsumable(uid, true);
        if (!res.ok && res.msg) toast(res.msg, 'bad');
        else { playSound('heal'); renderBattleConsumables(); syncBattle(); }
        break;
      }
      case 'use-item': {
        const res = Game.useConsumable(actionEl.dataset.uid, true);
        if (!res.ok && res.msg) toast(res.msg, 'bad');
        else { playSound('loot'); renderBattleConsumables(); syncBattle(); }
        break;
      }
      case 'npc': openNpc(actionEl.dataset.id); playSound('click'); break;
      case 'npc-talk': if (currentNpc) { openNpc(currentNpc); playSound('click'); } break;
      case 'npc-gift': {
        const id = actionEl.dataset.id;
        const res = Game.claimGift(id);
        if (res.ok) {
          toast(`Получено: ${esc(res.text)}.`, 'good');
          playSound('loot');
          syncSidebarQuiet();
          openNpc(id);
        } else toast(res.msg || 'Подарок уже получен.', 'bad');
        break;
      }
      case 'merchant': openShop(actionEl.dataset.id); playSound('click'); break;
      case 'shop-item': openShopEntryModal(actionEl.dataset.shop, Number(actionEl.dataset.index)); playSound('click'); break;
      case 'buy': {
        const res = Game.buyShopItem(actionEl.dataset.shop, Number(actionEl.dataset.index));
        if (res.ok) { playSound('buy'); toast('Покупка добавлена в инвентарь.', 'good'); openShop(actionEl.dataset.shop); syncSidebarQuiet(); }
        else { toast(res.msg || 'Покупка не удалась.', 'bad'); playSound('deny'); }
        break;
      }
      case 'refresh-shop': {
        const res = Game.refreshShop(actionEl.dataset.shop);
        if (res.ok) { playSound('buy'); openShop(actionEl.dataset.shop); syncSidebarQuiet(); }
        else toast(res.msg || 'Недостаточно золота.', 'bad');
        break;
      }
      case 'claim': {
        const res = Game.claimContract(actionEl.dataset.id);
        if (res.ok) {
          toast(`Контракт закрыт: +${res.gold} золота, +${res.xp} опыта.${res.lootNote}`, 'good');
          playSound('loot');
          render();
          if (res.levels) playSound('levelup');
        } else toast(res.msg || 'Награда недоступна.', 'bad');
        break;
      }
      case 'refresh-contracts': {
        const res = Game.refreshContracts();
        if (res.ok) { playSound('buy'); render(); }
        else toast(res.msg || 'Недостаточно золота.', 'bad');
        break;
      }
      case 'attr': {
        const res = Game.spendPoint(actionEl.dataset.attr);
        if (res.ok) { playSound('click'); render(); }
        else if (res.msg) toast(res.msg, 'bad');
        break;
      }
      case 'open-item': {
        const item = Game.state.player.inventory.find(it => it.uid === actionEl.dataset.uid);
        if (item) openItemModal(item, false);
        break;
      }
      case 'open-equipped': {
        const slotId = actionEl.dataset.slot || actionEl.dataset.equippedSlot;
        const item = Game.state.player.equipment[slotId];
        if (item) openItemModal(item, true, slotId);
        break;
      }
      case 'empty-slot': toast('Этот слот пуст. Надень предмет из сумки.', 'dim'); break;
      case 'item-equip': {
        const res = Game.equip(actionEl.dataset.uid);
        if (res.ok) { closeModal(); render(); toast(res.msg, 'good'); playSound('click'); }
        else toast(res.msg || 'Не удалось надеть.', 'bad');
        break;
      }
      case 'item-unequip': {
        const res = Game.unequip(actionEl.dataset.slot);
        if (res.ok) { closeModal(); render(); playSound('click'); }
        else toast(res.msg || 'Не удалось снять.', 'bad');
        break;
      }
      case 'item-sell': {
        const item = Game.state.player.inventory.find(it => it.uid === actionEl.dataset.uid);
        if (!item) break;
        if (['rare', 'epic', 'legendary'].includes(item.rarity)) { openSellConfirm(item); break; }
        const res = Game.sellItem(actionEl.dataset.uid);
        if (res.ok) { closeModal(); render(); toast(`Продано: ${esc(res.name)} за ${res.price} золота.`, 'loot'); playSound('buy'); }
        break;
      }
      case 'sell-confirm': {
        const res = Game.sellItem(actionEl.dataset.uid);
        if (res.ok) { closeModal(); render(); toast(`Продано: ${esc(res.name)} за ${res.price} золота.`, 'loot'); playSound('buy'); }
        break;
      }
      case 'item-use': {
        const res = Game.useConsumable(actionEl.dataset.uid, false);
        if (!res.ok) toast(res.msg || 'Нельзя использовать.', 'bad');
        break;
      }
      case 'sell-common': openSellCommonModal(); break;
      case 'sell-common-confirm': {
        let sum = 0;
        let count = 0;
        for (const it of pendingCommonSell) {
          const res = Game.sellItem(it.uid);
          if (res.ok) { sum += res.price; count++; }
        }
        pendingCommonSell = [];
        closeModal();
        render();
        toast(`Продано предметов: ${count}, выручка: ${sum} золота.`, 'loot');
        playSound('buy');
        break;
      }
      case 'raid-open': openRaidModal(); playSound('click'); break;
      case 'raid-start': {
        const res = Game.startRaid();
        if (res.ok) { closeModal(); openBattle(); }
        else toast(res.msg || 'Рейд недоступен.', 'bad');
        break;
      }
      default: break;
    }
  }

  function syncSidebarQuiet() {
    // мягкое обновление золота/счётчиков без смены экрана
    if (!el.sidebar) return;
    const p = Game.state.player;
    const nodes = el.sidebar.querySelectorAll('.side-stat b');
    if (nodes.length >= 4) {
      nodes[0].textContent = fmt(Game.getStats().atk);
      nodes[1].textContent = fmt(Game.getStats().armor);
      nodes[2].textContent = fmt(p.gold);
      nodes[3].textContent = fmt(Game.state.stats.kills);
    }
  }

  /* ---------- боевые эффекты ---------- */
  function fx(name, data = {}) {
    BattleScene.handle(name, data);
    switch (name) {
      case 'hitEnemy': playSound(data.crit ? 'crit' : 'hit'); break;
      case 'hitPlayer': playSound('hurt'); break;
      case 'healPlayer': if (!data.quiet) playSound('heal'); break;
      case 'enemySkill': playSound('enemySkill'); break;
      case 'shield': playSound('shield'); break;
      case 'storm': playSound('storm'); break;
      case 'victory': playSound('victory'); break;
      case 'death': playSound('defeat'); break;
      case 'levelup': playSound('levelup'); break;
      default: break;
    }
  }

  /* ---------- цикл ---------- */
  function frame(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (screen.name === 'battle' && Game.battle) {
      if (!Game.battle.result) Game.tick(dt);
      BattleScene.update(dt);
      BattleScene.draw();
      hudClock += dt;
      if (hudClock > 0.08) {
        hudClock = 0;
        syncBattle();
      }
      if (Game.battle.result && !resultShown) {
        showResult();
        syncBattle();
      }
    }
    requestAnimationFrame(frame);
  }

  return { init, render, renderSidebar, toast, saveFlash, fx, onLog: appendLog };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', UI.init);
} else {
  UI.init();
}
