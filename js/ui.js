'use strict';

/* ============================================================
   ИНТЕРФЕЙС: экраны, бой, вылазка, диалоги, магазины
   Всё управление идёт через data-act и таблицу ACT в конце файла.
   ============================================================ */

const UI = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const S = () => Game.state;
  const fmt = n => Math.round(n).toLocaleString('ru-RU');

  let tab = 'map';
  let battle = null; // { c, disp, target, busy, zone }
  let bagFilter = 'all';
  let pendingNode = null;

  /* ---------- уведомления ---------- */
  function toast(text, type = '') {
    const box = $('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = text;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => el.remove(), 4300);
  }

  function saveFlash() {
    const el = $('saveMark');
    if (!el) return;
    el.classList.add('on');
    clearTimeout(saveFlash.t);
    saveFlash.t = setTimeout(() => el.classList.remove('on'), 900);
  }

  function onLevelUp(level) {
    Sfx.level();
    toast(`<b>Уровень ${level}!</b> +3 очка характеристик, +1 очко таланта.`, 'level');
    if (battle) Scene.celebrate();
    syncTop();
  }

  /* ---------- общий каркас ---------- */
  const hub = () => HUBS[Game.hubId()];
  const TABS = () => [
    ['map', 'Карта'], ['city', hub().short], ['hero', 'Герой'], ['talents', 'Таланты'], ['journal', 'Журнал'], ['codex', 'Кодекс'],
  ];

  function shell(inner) {
    const st = S();
    const h = st.hero;
    const s = Game.heroStats();
    const inExp = !!st.expedition;
    const alerts = {
      hero: h.attrPoints > 0, talents: h.talentPoints > 0,
      journal: Object.keys(st.quests).some(id => Game.questStatus(id) === 'ready'),
      city: hubNpcs().some(n => npcMark(n.id)),
    };
    return `<header class="top">
      <button class="brand" data-act="goMap"><span class="sigil">ᛉ</span><span class="brand-t">Пепельный Предел</span></button>
      <nav class="tabs">${TABS().map(([id, name]) => {
        const locked = inExp && (id === 'map' || id === 'city');
        return `<button class="tab ${tab === id && !inExpRouteTab(id) ? 'on' : ''} ${alerts[id] ? 'alert' : ''}" data-act="tab" data-id="${id}" ${locked ? 'disabled title="Ты на вылазке"' : ''}>${name}</button>`;
      }).join('')}${inExp ? `<button class="tab route ${tab === 'route' ? 'on' : ''}" data-act="tab" data-id="route">Вылазка</button>` : ''}</nav>
      <div class="hud" id="hud">${hudHTML(s)}</div>
    </header>
    <main class="screen" id="screen">${inner}</main>`;
  }

  function inExpRouteTab() { return false; }

  function hudHTML(s) {
    const st = S();
    const h = st.hero;
    const xpN = Game.xpNeeded(h.level);
    return `<div class="hud-hero">
        <div class="hud-lvl" title="Уровень">${h.level}</div>
        <div class="hud-bars">
          <div class="bar hp" title="Здоровье"><i style="width:${Math.round(h.hp / s.maxHp * 100)}%"></i><span>${Math.round(h.hp)} / ${s.maxHp}</span></div>
          <div class="bar xp" title="Опыт: ${h.xp} / ${xpN}"><i style="width:${Math.round(h.xp / xpN * 100)}%"></i></div>
        </div>
      </div>
      <div class="hud-res"><span class="coin" title="Золото">${fmt(h.gold)}</span><span class="dust" title="Пепельная пыль: из неё кузнец улучшает вещи">${fmt(h.dust)}</span>
      <span id="saveMark" class="savemark" title="Прогресс сохранён">✓</span>
      <button class="ic" data-act="sound" title="Звук">${Sfx.on ? '♪' : '×'}</button>
      <button class="ic" data-act="resetAsk" title="Начать заново">⟲</button></div>`;
  }

  function syncTop() {
    if (!S()) return;
    const el = $('hud');
    if (el) el.innerHTML = hudHTML(Game.heroStats());
  }

  function render() {
    const app = $('app');
    if (!S()) { renderIntro(); return; }
    if (battle) return;
    if (S().expedition && (tab === 'map' || tab === 'city')) tab = 'route';
    if (!S().expedition && tab === 'route') tab = 'map';
    const views = { map: viewMap, city: viewCity, hero: viewHero, talents: viewTalents, journal: viewJournal, codex: viewCodex, route: viewRoute };
    app.innerHTML = shell((views[tab] || viewMap)());
    afterRender();
  }

  function afterRender() {
    const mapCv = $('worldCanvas');
    if (mapCv) Paint.worldMap(mapCv);
    const cityCv = $('cityCanvas');
    if (cityCv) Paint.cityView(cityCv, hub().paint);
    const doll = $('dollCanvas');
    if (doll) drawDoll(doll);
    document.querySelectorAll('canvas[data-npc]').forEach(c => drawNpc(c, c.dataset.npc));
    if (tab === 'route') drawHmarGlow();
  }

  function drawHmarGlow() { /* туман на маршруте рисует CSS по data-stage */ }

  function pose() { return Object.assign({}, Art.IDLE_POSE); }

  function drawDoll(cv) {
    const h = S().hero;
    const paint = t => Art.portrait(cv, c => Art.drawHero(c, h, pose(), t), { scale: 1, bottom: 12 });
    paint(1.2);
    const w = h.equipment.weapon;
    if (!w || !w.level) return;
    // заточенное оружие светится и на экране героя
    const loop = now => {
      if (!cv.isConnected) return;
      paint(now / 1000);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function drawNpc(cv, id) {
    const n = NPCS[id];
    if (!n) return;
    const look = Object.assign({ build: 1 }, n.look);
    Art.portrait(cv, c => Art.humanoid(c, look, {}, pose(), 2), { scale: 1.12, bottom: 2 });
  }

  /* ---------- вступление ---------- */
  let introClass = 'warrior';
  let introName = '';

  function renderIntro() {
    const app = $('app');
    const cls = CLASSES[introClass];
    app.innerHTML = `<section class="intro">
      <div class="intro-head">
        <p class="kicker">Хроника последних огней</p>
        <h1>Пепельный Предел</h1>
        <p class="lead">Хмарь стёрла имена городов и лица людей. Остался Предел — четыре огня на кромке пепла. Ты один из тех, кто ещё помнит своё имя. Пока помнишь.</p>
      </div>
      <div class="class-row">${CLASS_ORDER.map(id => {
        const k = CLASSES[id];
        return `<button class="class-pick ${id === introClass ? 'on' : ''}" data-act="pickClass" data-id="${id}" style="--c:${k.color}">
          <canvas class="class-doll" data-class="${id}"></canvas>
          <b>${k.name}</b><small>${k.role}</small>
        </button>`;
      }).join('')}</div>
      <div class="class-detail" style="--c:${cls.color}">
        <div class="cd-main">
          <h2>${cls.name} <small>${cls.role}</small></h2>
          <p>${cls.desc}</p>
          <p class="cd-play">${cls.play}</p>
        </div>
        <div class="cd-side">
          <div class="cd-res"><b style="color:${RESOURCES[cls.res].color}">${RESOURCES[cls.res].name}.</b> ${RESOURCES[cls.res].hint}</div>
          <div class="cd-attrs">${Object.keys(ATTRS).map(a => `<span title="${ATTRS[a].desc}">${ATTRS[a].short} <b>${cls.attrs[a]}</b></span>`).join('')}</div>
          <div class="cd-trees">${cls.trees.map(t => `<span><b>${t.name}:</b> ${t.desc}</span>`).join('')}</div>
        </div>
      </div>
      <div class="intro-go">
        <input id="heroName" maxlength="18" placeholder="Имя героя" value="${esc(introName)}" autocomplete="off">
        <button class="btn primary big" data-act="begin">Зажечь свой огонь</button>
      </div>
      ${localHasOldSave() ? '<p class="note">Старое сохранение несовместимо с новой версией: начать придётся заново.</p>' : ''}
    </section>`;
    document.querySelectorAll('.class-doll').forEach(cv => {
      const id = cv.dataset.class;
      const heroLike = { classId: id, equipment: { weapon: Game_previewWeapon(id), offhand: Game_previewOff(id), chest: null, helmet: null, gloves: null, boots: null } };
      Art.portrait(cv, c => Art.drawHero(c, heroLike, pose(), 1), { scale: 0.96, bottom: 6 });
    });
    const inp = $('heroName');
    if (inp) inp.addEventListener('input', () => { introName = inp.value; });
  }

  function localHasOldSave() {
    try { return !!localStorage.getItem('ashen_reach_save_v2'); } catch (e) { return false; }
  }
  const Game_previewWeapon = id => ({ kind: CLASSES[id].weapon, rarity: 'common', ilvl: 1 });
  const Game_previewOff = id => (CLASSES[id].offhand ? { kind: CLASSES[id].offhand, rarity: 'common', ilvl: 1 } : null);

  /* ---------- карта мира ---------- */
  function viewMap() {
    const st = S();
    const pins = [];
    const questZones = Game.questZones();
    for (const r of REGIONS) {
      if (r.hub && Game.regionOpen(r.id)) {
        const h = HUBS[r.hub];
        const here = Game.hubId() === r.hub;
        const nearby = Object.values(NPCS).filter(n => (n.hub || 'pepel') === r.hub).some(n => npcMark(n.id));
        pins.push(`<button class="pin home ${here ? 'here' : ''} ${nearby ? 'quest' : ''}" style="left:${r.x}%;top:${r.y}%" data-act="hubGo" data-id="${r.hub}"><span class="pin-m">⌂</span><span class="pin-t">${h.name}<small>${here ? 'ты здесь' : 'перейти'}${nearby ? ' · тебя ждут' : ''}</small></span></button>`);
      } else {
        const why = r.hub ? 'откроется по слову Миры' : 'закрыто Хмарью';
        pins.push(`<div class="pin region-locked" style="left:${r.x}%;top:${r.y}%" title="${esc(r.desc)}"><span class="pin-m">◌</span><span class="pin-t">${r.name}<small>${why}</small></span></div>`);
      }
    }
    for (const id of ZONE_ORDER) {
      const z = ZONES[id];
      if (!Game.regionOpen(z.region)) continue;
      const open = Game.zoneOpen(id);
      const cleared = st.cleared[id];
      const grave = st.grave && st.grave.zone === id;
      const quest = open && questZones.has(id);
      pins.push(`<button class="pin zone ${open ? '' : 'locked'} ${cleared ? 'cleared' : ''} ${grave ? 'grave' : ''} ${quest ? 'quest' : ''} ${z.x >= 78 ? 'flip' : ''}" style="left:${z.x}%;top:${z.y}%" data-act="zoneOpen" data-id="${id}">
        <span class="pin-m">${open ? (cleared ? '✦' : '✕') : '?'}</span>
        <span class="pin-t">${open ? z.name : '???'}<small>${open ? `ур. ${z.level}+${quest ? ' · цель задания' : cleared ? ' · зачищено' : ''}${grave ? ' · там твоя тень' : ''}` : 'победи босса прошлой зоны'}</small></span>
      </button>`);
    }
    return `<section class="map-wrap">
      <div class="world"><canvas id="worldCanvas"></canvas>${pins.join('')}</div>
      <aside class="map-side">
        <div class="panel"><div class="eyebrow">Куда идти</div>${questTracker()}</div>
        <div class="panel">
          <div class="eyebrow">Как идут вылазки</div>
          <ul class="tips">
            <li>Выбери путь на карте зоны. Здоровье <b>не восстанавливается</b> между боями.</li>
            <li>С каждым шагом густеет <b>Хмарь</b>: враги злее, добыча богаче.</li>
            <li>Найденное можно потерять. <b>Надетое</b> уже твоё.</li>
            <li>Возвращайся вовремя, а если не успел, твоя тень сторожит добычу.</li>
          </ul>
        </div>
      </aside>
    </section>`;
  }

  /* Отслеживание заданий: главное сверху, у каждого ясный следующий шаг */
  function activeQuestIds() {
    const st = S();
    return Object.keys(st.quests).filter(id => !st.quests[id].done)
      .sort((a, b) => (QUESTS[b].main ? 1 : 0) - (QUESTS[a].main ? 1 : 0) || (Game.questStatus(b) === 'ready' ? 1 : 0) - (Game.questStatus(a) === 'ready' ? 1 : 0));
  }

  function questRow(id) {
    const q = QUESTS[id];
    const next = Game.questNext(id);
    const prog = Game.questProgress(id).goals.filter(g => g.need > 1).map(g => `${g.have}/${g.need}`).join(', ');
    return `<button class="qt ${q.main ? 'main' : ''} ${next.ready ? 'ready' : ''}" data-act="questGo" data-id="${id}">
      <i class="qt-m">${next.ready ? '✓' : q.main ? '◆' : '◇'}</i>
      <span><b>${q.title}</b>${prog ? `<em>${prog}</em>` : ''}<small>${esc(next.text)}</small></span>
    </button>`;
  }

  function leadRow(n) {
    return `<button class="qt qt-lead" data-act="npcGo" data-id="${n.id}"><i class="qt-m">!</i><span><b>${n.name}</b><small>${n.role}. Есть разговор · ${HUBS[n.hub || 'pepel'].short}</small></span></button>`;
  }

  function questLeads() { return hubNpcsAll().filter(n => npcMark(n.id) === 'give'); }

  function questTracker() {
    const ids = activeQuestIds();
    // в списке только жители этого поселения: остальные видны в журнале
    const leads = questLeads().filter(n => (n.hub || 'pepel') === Game.hubId());
    if (!ids.length && !leads.length) return '<p class="small dim">Новых дел пока нет. Загляни к жителям позже.</p>';
    return `<div class="qt-list">${ids.map(questRow).join('')}${leads.map(leadRow).join('')}</div>`;
  }

  function hubNpcs() { return Object.values(NPCS).filter(n => (n.hub || 'pepel') === Game.hubId()); }
  function hubNpcsAll() { return Object.values(NPCS).filter(n => !n.hub || Game.regionOpen(REGIONS.find(r => r.hub === n.hub).id)); }

  function openZoneModal(id) {
    const z = ZONES[id];
    if (!Game.zoneOpen(id)) { toast('Сначала победи хозяина прошлой зоны.', 'bad'); return; }
    const st = S();
    const s = Game.heroStats();
    const bossDef = ENEMIES[z.boss];
    const mobs = [...new Set(z.packs.flat())];
    modal(`<div class="zone-modal">
      <div class="eyebrow">Вылазка · уровень ${z.level}+</div>
      <h2>${z.name}</h2>
      <p>${esc(z.desc)}</p>
      <div class="zone-grid">
        <div><div class="eyebrow">Здесь водятся</div><div class="chips">${mobs.map(m => `<span class="chip">${esc(ENEMIES[m].name)}</span>`).join('')}</div></div>
        <div><div class="eyebrow">Хозяин</div><div class="chip boss">${esc(bossDef.name)}</div></div>
      </div>
      ${st.grave && st.grave.zone === id ? `<p class="warnbox">Где-то здесь твоя тень. Она держит то, что ты потерял: ${st.grave.items.length} вещ., ${st.grave.gold} золота.</p>` : ''}
      ${st.hero.level < z.level ? `<p class="warnbox">Твой уровень ниже рекомендованного. Будет больно.</p>` : ''}
      ${st.hero.hp < s.maxHp * 0.7 ? `<p class="warnbox">Ты ранен: ${Math.round(st.hero.hp)} / ${s.maxHp}. Сперва отдохни в таверне.</p>` : ''}
      <div class="modal-actions">
        <button class="btn primary" data-act="startExp" data-id="${id}">Выступить</button>
        <button class="btn" data-act="closeModal">Не сейчас</button>
      </div>
    </div>`);
  }

  /* ---------- город ---------- */
  function npcMark(id) {
    const st = S();
    const n = NPCS[id];
    const entry = (n.entry || []).find(e => !e.if || Game.testCond(e.if));
    if (!entry) return '';
    const go = entry.go || '';
    if (Object.keys(st.quests).some(q => (QUESTS[q].turnIn || QUESTS[q].giver) === id && Game.questStatus(q) === 'ready')) return 'ready';
    if (go.endsWith('_give') || go.endsWith('_meet')) return 'give';
    return '';
  }

  function viewCity() {
    const st = S();
    const here = hub();
    const pins = Object.entries(here.buildings).map(([id, b]) => {
      const mark = npcMark(b.npc);
      return `<button class="bpin ${mark}" style="left:${b.x}%;top:${b.y}%" data-act="building" data-id="${id}">
        <span class="bpin-dot">${mark === 'ready' ? '?' : mark === 'give' ? '!' : ''}</span><span class="bpin-t">${b.name}<small>${b.hint}</small></span>
      </button>`;
    }).join('');
    const contracts = st.contracts.map(c => {
      const def = ENEMIES[c.target];
      const have = Game.contractProgress(c);
      const done = have >= c.need;
      return `<div class="contract ${done ? 'done' : ''}">
        <div><b>${esc(def.name)}</b> <small>${esc(ZONES[c.zone].name)}</small>
          <div class="bar thin"><i style="width:${have / c.need * 100}%"></i><span>${have}/${c.need}</span></div>
        </div>
        <div class="c-reward">${c.gold} зол. · ${c.xp} оп. · ${c.dust} пыли
          ${done ? `<button class="btn small primary" data-act="claimContract" data-id="${c.id}">Забрать</button>` : ''}
        </div>
      </div>`;
    }).join('');
    return `<section class="city-wrap">
      <div class="city"><canvas id="cityCanvas"></canvas>${pins}
        <div class="city-title"><h2>${here.name}</h2><p>${here.quote}</p></div>
      </div>
      <div class="city-low">
        <div class="panel"><h3>Задания</h3>${questTracker()}</div>
        <div class="panel">
          <div class="panel-h"><h3>Доска контрактов</h3><button class="btn small" data-act="refreshContracts">Новые · ${15 + st.hero.level * 5} зол.</button></div>
          <p class="small dim">Убивай цель на любых вылазках и забирай плату здесь.</p>
          ${contracts || '<p class="small dim">Пока пусто.</p>'}
        </div>
        <div class="panel">
          <h3>Жители</h3>
          <div class="npc-list">${hubNpcs().map(n => {
            const mark = npcMark(n.id);
            return `<button class="npc-row ${mark}" data-act="talk" data-id="${n.id}"><canvas data-npc="${n.id}" class="npc-mini"></canvas><span><b>${n.name}</b><small>${n.role}</small></span>${mark === 'ready' ? '<i class="mark ready">?</i>' : mark === 'give' ? '<i class="mark give">!</i>' : ''}</button>`;
          }).join('')}</div>
        </div>
      </div>
    </section>`;
  }

  function goToNpc(id) {
    if (S().expedition) { toast('Сначала вернись с вылазки.', 'bad'); return; }
    Game.goHub(NPCS[id].hub || 'pepel');
    tab = 'city';
    render();
    openNpc(id);
  }

  /* ---------- диалоги ---------- */
  function openBuilding(id) {
    openNpc(hub().buildings[id].npc);
  }

  function dialogText(node) {
    return typeof node.text === 'function' ? node.text() : node.text;
  }

  function openNpc(id) {
    const n = NPCS[id];
    const entry = n.entry.find(e => !e.if || Game.testCond(e.if));
    showDialog(id, entry.go);
  }

  function serviceButtons(n) {
    const st = S();
    const out = [];
    if (n.shop === 'forge') { out.push(['Товары', 'shop', 'forge']); out.push(['Заточка', 'forge', '']); }
    if (n.shop === 'apothecary') out.push(['Товары', 'shop', 'apothecary']);
    if (n.shop === 'market') { out.push(['Товары', 'shop', 'market']); out.push(['Заточка', 'forge', '']); }
    if (n.shop === 'tavern') {
      const cost = ECONOMY.innCost(st.hero.level);
      out.push([st.hero.gold >= cost ? `Отдохнуть · ${cost} зол.` : 'Миска похлёбки в долг', 'rest', '']);
    }
    if (n.shop === 'beacon') {
      out.push([`Читать имена (${st.names})`, 'readNames', '']);
      out.push(['Улучшить маяк', 'beaconOpen', '']);
    }
    if (n.shop === 'chapel') {
      out.push([`Забыть всё выученное · ${ECONOMY.respecCost(st.hero.level)} зол.`, 'respecAsk', '']);
    }
    return out;
  }

  function showDialog(npcId, nodeId) {
    const n = NPCS[npcId];
    const node = n.nodes[nodeId];
    if (!node) { closeModal(); return; }
    const opts = (node.opts || []).filter(o => !o.if || Game.testCond(o.if));
    const services = serviceButtons(n);
    modal(`<div class="dialog">
      <canvas class="dlg-portrait" data-npc="${npcId}"></canvas>
      <div class="dlg-body">
        <div class="eyebrow" style="color:${n.tint}">${n.role}</div>
        <h2>${n.name}</h2>
        <p class="dlg-text">${dialogText(node)}</p>
        <div class="dlg-opts">
          ${opts.map((o, i) => `<button class="dlg-opt" data-act="dlgOpt" data-npc="${npcId}" data-node="${nodeId}" data-i="${i}">${esc(o.t)}</button>`).join('')}
        </div>
        ${services.length ? `<div class="dlg-services">${services.map(([label, act, arg]) => `<button class="btn small" data-act="${act}" data-id="${arg}" data-npc="${npcId}">${label}</button>`).join('')}</div>` : ''}
      </div>
    </div>`, true);
    document.querySelectorAll('#modal canvas[data-npc]').forEach(c => drawNpc(c, c.dataset.npc));
  }

  function dialogOption(npcId, nodeId, i) {
    const n = NPCS[npcId];
    const node = n.nodes[nodeId];
    const opts = (node.opts || []).filter(o => !o.if || Game.testCond(o.if));
    const o = opts[i];
    if (!o) return;
    if (o.do) { Game.applyDo(o.do); Game.save(); }
    Sfx.click();
    if (o.end || !o.go) { closeModal(); render(); return; }
    showDialog(npcId, o.go);
  }

  /* ---------- магазин ---------- */
  function openShop(id) {
    const shop = Game.shop(id);
    const st = S();
    const title = { forge: 'Кузница Харна', apothecary: 'Настойная Ольхи', market: hub().market }[id];
    modal(`<div class="shop">
      <div class="panel-h"><h2>${title}</h2><div class="hud-res"><span class="coin">${fmt(st.hero.gold)}</span><span class="dust">${fmt(st.hero.dust)}</span></div></div>
      <p class="small dim">Запасы обновляются после каждой вылазки.</p>
      <div class="shop-grid">${shop.stock.map((e, i) => {
        const it = e.kind === 'gear' ? e.item : { type: 'consumable', cid: e.cid };
        const name = e.kind === 'gear' ? e.item.name : CONSUMABLES[e.cid].name;
        const rar = e.kind === 'gear' ? e.item.rarity : CONSUMABLES[e.cid].rarity;
        const can = st.hero.gold >= e.price;
        return `<div class="shop-item" data-tip="${e.kind === 'gear' ? 'shop:' + id + ':' + i : 'cons:' + e.cid}">
          <img src="${Art.itemIcon(it, 64)}" class="icon r-${rar}" alt="">
          <div class="si-b"><b class="t-${rar}">${esc(name)}</b><small>${e.kind === 'consumable' ? `Есть: ${Game.consumableQty(e.cid)}` : SLOT_MAP[e.item.slot].name}</small></div>
          <button class="btn small ${can ? '' : 'off'}" data-act="buy" data-shop="${id}" data-i="${i}">${e.price} зол.</button>
        </div>`;
      }).join('')}</div>
      <div class="sell-hint small dim">Продать или разобрать вещи можно на вкладке «Герой».</div>
      <div class="modal-actions"><button class="btn" data-act="closeModal">Закрыть</button></div>
    </div>`, true);
  }

  function openForge(justUid) {
    const st = S();
    const items = [...Object.values(st.hero.equipment).filter(Boolean), ...st.hero.inventory.filter(x => x.type === 'gear')];
    const focus = (justUid && findItem(justUid)) || st.hero.equipment.weapon || items[0];
    const smith = hub().smith;
    modal(`<div class="shop">
      <div class="panel-h"><h2>${smith}</h2><div class="hud-res"><span class="coin">${fmt(st.hero.gold)}</span><span class="dust">${fmt(st.hero.dust)}</span></div></div>
      ${focus ? `<div class="forge-stage"><canvas id="forgeStage"></canvas><div class="fs-cap"><b class="t-${focus.rarity}">${esc(itemName(focus))}</b>${justUid ? '<small>Заточка удалась. Вещь светится сильнее.</small>' : '<small>Чем выше заточка, тем ярче свечение.</small>'}</div></div>` : ''}
      <p class="small dim">Каждая заточка: +${Math.round(ECONOMY.upgradeStep * 100)}% к урону, броне и здоровью вещи. Максимум +${ECONOMY.upgradeMax}. Пыль добывается разбором ненужных вещей.</p>
      <div class="shop-grid">${items.map(it => {
        const maxed = (it.level || 0) >= ECONOMY.upgradeMax;
        const c = Game.upgradeCost(it);
        const can = st.hero.gold >= c.gold && st.hero.dust >= c.dust;
        const worn = Object.values(st.hero.equipment).includes(it);
        return `<div class="shop-item ${it.uid === justUid ? 'just' : ''}" data-tip="uid:${it.uid}">
          <img src="${Art.itemIcon(it, 64)}" class="icon r-${it.rarity}" alt="">
          <div class="si-b"><b class="t-${it.rarity}">${esc(itemName(it))}</b><small>${worn ? 'надето' : 'в сумке'} · ${SLOT_MAP[it.slot].name}</small></div>
          ${maxed ? '<span class="small dim">Предел</span>' : `<button class="btn small ${can ? '' : 'off'}" data-act="upgrade" data-id="${it.uid}">${c.gold} зол. + ${c.dust} пыли</button>`}
        </div>`;
      }).join('')}</div>
      <div class="modal-actions"><button class="btn" data-act="closeModal">Закрыть</button></div>
    </div>`, true);
    const cv = $('forgeStage');
    if (cv && focus) Art.forgeStage(cv, focus, !!justUid);
  }

  function openBeacon() {
    const st = S();
    modal(`<div class="shop">
      <div class="panel-h"><h2>Маяк Острога</h2><div class="hud-res"><span class="coin">${fmt(st.hero.gold)}</span><span class="dust">${fmt(st.hero.dust)}</span></div></div>
      <p class="small dim">Пока маяк горит, Хмарь помнит, что здесь есть граница. Вложения в него остаются навсегда.</p>
      <div class="beacon-list">${ECONOMY.beacon.map((b, i) => {
        const has = st.beacon > i, next = st.beacon === i;
        const can = next && st.hero.gold >= b.cost.gold && st.hero.dust >= b.cost.dust;
        return `<div class="beacon-row ${has ? 'has' : ''}"><div><b>${b.name}</b><p class="small">${b.desc}</p></div>
          ${has ? '<span class="good small">Готово</span>' : next ? `<button class="btn small ${can ? 'primary' : 'off'}" data-act="buyBeacon">${b.cost.gold} зол. + ${b.cost.dust} пыли</button>` : '<span class="small dim">Позже</span>'}</div>`;
      }).join('')}</div>
      <div class="modal-actions"><button class="btn" data-act="closeModal">Закрыть</button></div>
    </div>`, true);
  }

  /* ---------- герой: кукла и сумка ---------- */
  function itemName(it) {
    return it.level ? `${it.name} +${it.level}` : it.name;
  }

  function slotBox(id) {
    const it = S().hero.equipment[id];
    const name = SLOT_MAP[id].name;
    if (!it) return `<button class="slot empty s-${id}" title="${name}"><span>${name}</span></button>`;
    return `<button class="slot s-${id} r-${it.rarity}" data-act="itemOpen" data-id="${it.uid}" data-tip="uid:${it.uid}"><img src="${Art.itemIcon(it, 64)}" alt="">${it.level ? `<i class="lvl">+${it.level}</i>` : ''}</button>`;
  }

  function viewHero() {
    const st = S();
    const h = st.hero;
    const s = Game.heroStats();
    const cls = CLASSES[h.classId];
    const bag = h.inventory.filter(x => {
      if (bagFilter === 'all') return true;
      if (bagFilter === 'consumable') return x.type === 'consumable';
      return x.type === 'gear' && (bagFilter === 'weapon' ? (x.slot === 'weapon' || x.slot === 'offhand') : (x.slot !== 'weapon' && x.slot !== 'offhand'));
    });
    const gearCount = h.inventory.filter(x => x.type === 'gear').length;
    const attrs = Object.keys(ATTRS).map(a => `<div class="attr" title="${ATTRS[a].desc}">
      <span>${ATTRS[a].name}</span><b>${s.attrs[a]}</b>
      ${h.attrPoints > 0 ? `<button class="plus" data-act="attr" data-id="${a}">+</button>` : ''}
    </div>`).join('');
    const statRows = [
      ['Сила удара', s.power], ['Здоровье', s.maxHp], ['Броня', s.armor], ['Инициатива', s.speed],
      ['Шанс крита', s.crit + '%'], ['Крит. урон', s.critDmg + '%'], ['Уклонение', s.dodge + '%'], ['Кража жизни', s.lifesteal + '%'],
    ];
    const extras = [];
    if (s.mods.dotPct) extras.push(['Сила эффектов', '+' + s.mods.dotPct + '%']);
    if (s.mods.healPct) extras.push(['Сила лечения', '+' + s.mods.healPct + '%']);
    if (s.mods.thorns) extras.push(['Шипы', s.mods.thorns + '%']);
    if (s.goldFind) extras.push(['Находка золота', '+' + s.goldFind + '%']);
    if (s.xpFind) extras.push(['Находка опыта', '+' + s.xpFind + '%']);
    return `<section class="hero-wrap">
      <div class="panel doll-panel" style="--c:${cls.color}">
        <div class="doll-head"><h2>${esc(h.name)}</h2><p>${cls.name} · ${h.level} уровень</p></div>
        <div class="doll">
          <canvas id="dollCanvas"></canvas>
          ${SLOTS.map(sl => slotBox(sl.id)).join('')}
        </div>
        <div class="belt-row">
          <span class="eyebrow">Пояс</span>
          ${h.belt.map((cid, i) => cid
            ? `<button class="belt-slot" data-act="beltClear" data-i="${i}" data-tip="cons:${cid}" title="Снять с пояса"><img src="${Art.consumableIcon(cid, 48)}" alt=""><i>${Game.consumableQty(cid)}</i></button>`
            : `<span class="belt-slot empty"></span>`).join('')}
        </div>
      </div>
      <div class="panel stats-panel">
        <div class="panel-h"><h3>Характеристики</h3>${h.attrPoints > 0 ? `<span class="pts">Свободно: ${h.attrPoints}</span>` : ''}</div>
        <div class="attrs">${attrs}</div>
        <div class="stat-grid">${statRows.concat(extras).map(([n, v]) => `<div><span>${n}</span><b>${v}</b></div>`).join('')}</div>
        <div class="xp-line small dim">Опыт: ${h.xp} / ${Game.xpNeeded(h.level)} · Вылазок: ${st.stats.runs} · Убито: ${st.stats.kills} · Смертей: ${st.stats.deaths}</div>
      </div>
      <div class="hero-right">
      ${runePanel()}
      <div class="panel bag-panel">
        <div class="panel-h"><h3>Сумка <small>${gearCount}/${INVENTORY_SIZE}</small></h3>
          <div class="filters">${[['all', 'Всё'], ['weapon', 'Оружие'], ['armor', 'Броня'], ['consumable', 'Расходники']].map(([f, n]) => `<button class="fbtn ${bagFilter === f ? 'on' : ''}" data-act="bagFilter" data-id="${f}">${n}</button>`).join('')}</div>
        </div>
        <div class="bag">${bag.map(it => cellHTML(it)).join('')}${Array.from({ length: Math.max(0, 28 - bag.length) }, () => '<span class="cell empty"></span>').join('')}</div>
        <div class="panel-f"><button class="btn small" data-act="salvageCommon">Разобрать всё обычное</button><span class="small dim">Отметка ✧ — находка с вылазки. Можно потерять, пока не вернёшься или не наденешь.</span></div>
      </div>
      </div>
    </section>`;
  }

  /* ---------- рунный круг ---------- */
  const ROMAN = ['', 'I', 'II', 'III'];

  function runeBadge(r, cls = '') {
    const d = RUNES[r.id];
    return `<span class="rune-stone ${cls}" style="--rc:${RUNE_RARITY[d.rarity].color}"><b>${d.sign}</b><i>${ROMAN[r.level]}</i></span>`;
  }

  function runePanel() {
    const h = S().hero;
    const sockets = Game.runeSockets();
    const inCircle = h.runeCircle.map(u => h.runes.find(r => r.uid === u)).filter(Boolean);
    const total = 1 + RUNE_SOCKET_ZONES.length;
    const slots = Array.from({ length: total }, (_, i) => {
      const a = i / total * Math.PI * 2 - Math.PI / 2;
      const pos = `left:${50 + Math.cos(a) * 38}%;top:${50 + Math.sin(a) * 38}%`;
      if (i >= sockets) {
        const z = ZONES[RUNE_SOCKET_ZONES[i - 1]];
        return `<span class="rs locked" style="${pos}" title="Откроется после победы над: ${esc(ENEMIES[z.boss].name)}">✕</span>`;
      }
      const r = inCircle[i];
      return r ? `<button class="rs full" style="${pos}" data-act="runeOpen" data-id="${r.uid}" data-tip="rune:${r.uid}">${runeBadge(r)}</button>`
        : `<span class="rs empty" style="${pos}"></span>`;
    }).join('');
    const free = h.runes.filter(r => !h.runeCircle.includes(r.uid));
    const words = Game.activeRuneWords();
    return `<div class="panel rune-panel">
      <div class="panel-h"><h3>Рунный круг <small>${inCircle.length}/${sockets}</small></h3><span class="small dim">Руны встают в круг героя, а не в вещи</span></div>
      <div class="rune-wrap">
        <div class="rune-circle ${words.length ? 'lit' : ''}"><i class="rc-core">ᛉ</i>${slots}</div>
        <div class="rune-side">
          ${free.length ? `<div class="rune-list">${free.map(r => `<button class="rune-pick" data-act="runeOpen" data-id="${r.uid}" data-tip="rune:${r.uid}">${runeBadge(r)}<span>${RUNES[r.id].name}</span></button>`).join('')}</div>`
            : `<p class="small dim">${h.runes.length ? 'Все твои руны в круге.' : 'Рун пока нет. Они падают очень редко: чаще с боссов и элиты, иногда из тайников. Первая придёт с первым поверженным хозяином.'}</p>`}
          ${words.length ? `<div class="rune-words">${words.map(w => `<div class="rw-word"><b>${w.name}</b><small>${w.text}</small></div>`).join('')}</div>` : ''}
          <p class="small dim rune-hint">Руны не теряются при смерти. Менять круг можно только в поселении.</p>
        </div>
      </div>
    </div>`;
  }

  function runeTipHTML(r) {
    const d = RUNES[r.id];
    const rar = RUNE_RARITY[d.rarity];
    const lines = d.text.map((t, i) => `<div class="${i + 1 === r.level ? 'rl-on' : 'rl-off'}"><i>${ROMAN[i + 1]}</i> ${t}</div>`).join('');
    return `<div class="tt-h" style="color:${rar.color}">${d.sign} ${d.name} <small>«${d.gloss}»</small></div>
      <div class="tt-sub">${rar.name} руна · ступень ${ROMAN[r.level]}</div>
      <div class="rune-lines">${lines}</div>`;
  }

  function wordHint(id) {
    const seen = S().seen;
    return RUNE_WORDS.filter(w => w.runes.includes(id)).map(w => {
      const parts = w.runes.map(x => (seen['rune_' + x] ? RUNES[x].sign : '?')).join(' + ');
      const known = w.runes.every(x => seen['rune_' + x]);
      return `<div class="rw-word"><b>${known ? w.name : 'Неизвестное созвучие'}</b> <span>${parts}</span>${known ? `<small>${w.text}</small>` : ''}</div>`;
    }).join('');
  }

  function openRune(uid) {
    const h = S().hero;
    const r = h.runes.find(x => x.uid === uid);
    if (!r) return;
    const worn = h.runeCircle.includes(uid);
    const same = h.runes.filter(x => x.id === r.id && x.level === r.level).length;
    const cost = RUNE_MERGE_COST[r.level - 1];
    const town = !S().expedition;
    modal(`<div class="rune-modal">
      <div class="rm-stone">${runeBadge(r, 'big')}</div>
      ${runeTipHTML(r)}
      ${wordHint(r.id) ? `<div class="eyebrow">Созвучия</div>${wordHint(r.id)}` : ''}
      ${cost ? `<p class="small dim">Слияние: 3 одинаковые руны одной ступени → одна следующей (${cost.gold} зол. + ${cost.dust} пыли). У тебя таких: ${same}.</p>` : ''}
      <div class="modal-actions">
        ${town ? (worn ? `<button class="btn" data-act="runeOut" data-id="${uid}">Вынуть из круга</button>` : `<button class="btn primary" data-act="runeIn" data-id="${uid}">Вставить в круг</button>`) : '<span class="small dim">Круг меняется только в поселении</span>'}
        ${town && cost && same >= 3 ? `<button class="btn" data-act="runeMerge" data-id="${uid}">Слить три</button>` : ''}
        <button class="btn" data-act="closeModal">Закрыть</button>
      </div>
    </div>`);
  }

  function cellHTML(it) {
    if (it.type === 'consumable') {
      const d = CONSUMABLES[it.cid];
      return `<button class="cell r-${d.rarity}" data-act="itemOpen" data-id="${it.uid}" data-tip="cons:${it.cid}"><img src="${Art.consumableIcon(it.cid, 64)}" alt=""><i class="qty">${it.qty}</i></button>`;
    }
    const better = isUpgrade(it);
    return `<button class="cell r-${it.rarity}" data-act="itemOpen" data-id="${it.uid}" data-tip="uid:${it.uid}"><img src="${Art.itemIcon(it, 64)}" alt="">${it.level ? `<i class="lvl">+${it.level}</i>` : ''}${it.unsecured ? '<i class="uns">✧</i>' : ''}${better ? '<i class="up">▲</i>' : ''}</button>`;
  }

  function itemScore(it) {
    if (!it) return 0;
    const st = Game.itemStats(it);
    const cls = CLASSES[S().hero.classId];
    let v = 0;
    for (const k in st) {
      const w = { dmg: 3, armor: 1.4, hp: 0.3, str: cls.scale === 'str' ? 2.4 : 0.8, agi: cls.scale === 'agi' ? 2.4 : 0.8, wil: cls.scale === 'wil' ? 2.4 : 0.8, vit: 1.6, crit: 0.8, critDmg: 0.2, dodge: 0.8, speed: 0.4, lifesteal: 1.2, thorns: 0.2, dotPct: 0.25, healPct: 0.2, goldFind: 0.1, xpFind: 0.15 }[k] || 0.2;
      v += st[k] * w;
    }
    return v + (it.traits ? it.traits.length * 2 : 0) + (it.unique ? 8 : 0);
  }

  function isUpgrade(it) {
    const cur = S().hero.equipment[it.slot];
    return itemScore(it) > itemScore(cur) + 0.1;
  }

  function findItem(uid) {
    const h = S().hero;
    return h.inventory.find(x => x.uid === uid) || Object.values(h.equipment).find(x => x && x.uid === uid) || null;
  }

  function itemDetailsHTML(it, compareTo) {
    if (it.type === 'consumable') {
      const d = CONSUMABLES[it.cid];
      return `<div class="tt-h t-${d.rarity}">${esc(d.name)}</div><div class="tt-sub">Расходник</div><div class="tt-desc">${d.desc}</div>`;
    }
    const st = Game.itemStats(it);
    const cmp = compareTo ? Game.itemStats(compareTo) : null;
    const keys = Object.keys(st);
    if (cmp) for (const k in cmp) if (!keys.includes(k)) keys.push(k);
    const rows = keys.map(k => {
      const v = st[k] || 0;
      const label = STAT_LABELS[k] || k;
      const suf = PCT_STATS.has(k) ? '%' : '';
      let diff = '';
      if (cmp) {
        const d = Math.round((v - (cmp[k] || 0)) * 10) / 10;
        if (d) diff = `<em class="${d > 0 ? 'good' : 'bad'}">${d > 0 ? '+' : ''}${d}${suf}</em>`;
      }
      return `<div class="tt-row"><span>${label}</span><b>${v > 0 ? '+' : ''}${v}${suf}${diff}</b></div>`;
    }).join('');
    const notes = [];
    if (it.family && WEAPONS[it.family]) notes.push(`<div class="tt-note">Растёт от: ${ATTRS[WEAPONS[it.family].scale].name}. ${WEAPONS[it.family].note}</div>`);
    for (const t of (it.traits || [])) if (TRAITS[t] && !(it.family && WEAPONS[it.family] && WEAPONS[it.family].trait === t)) notes.push(`<div class="tt-trait">${TRAITS[t].desc}</div>`);
    if (it.traitText) notes.push(`<div class="tt-unique">${it.traitText}</div>`);
    return `<div class="tt-h t-${it.rarity}">${esc(itemName(it))}</div>
      <div class="tt-sub">${RARITIES[it.rarity].name} · ${it.familyName || SLOT_MAP[it.slot].name} · ур. вещи ${it.ilvl}</div>
      ${rows}${notes.join('')}
      ${it.flavor ? `<div class="tt-flavor">«${esc(it.flavor)}»</div>` : ''}
      ${it.unsecured ? '<div class="tt-warn">Находка: потеряешь при смерти, пока не наденешь или не вернёшься.</div>' : ''}`;
  }

  function openItem(uid) {
    const it = findItem(uid);
    if (!it) return;
    const h = S().hero;
    if (it.type === 'consumable') {
      const d = CONSUMABLES[it.cid];
      const inBelt = h.belt.includes(it.cid);
      modal(`<div class="item-modal"><img class="icon big r-${d.rarity}" src="${Art.consumableIcon(it.cid, 128)}" alt="">
        ${itemDetailsHTML(it)}
        <p class="small dim">Всего: ${it.qty}</p>
        <div class="modal-actions">
          ${d.field ? `<button class="btn primary" data-act="useField" data-id="${it.cid}">Использовать</button>` : ''}
          ${!d.noBattle ? (inBelt ? '<span class="small dim">Уже на поясе</span>' : `<button class="btn" data-act="toBelt" data-id="${it.cid}">На пояс</button>`) : ''}
          ${!S().expedition ? `<button class="btn" data-act="sell" data-id="${it.uid}">Продать · ${Math.max(1, Math.round(d.value * ECONOMY.sellRate))} зол.</button>` : ''}
          <button class="btn" data-act="closeModal">Закрыть</button>
        </div></div>`);
      return;
    }
    const worn = h.equipment[it.slot] === it;
    const other = worn ? null : h.equipment[it.slot];
    const price = Math.max(1, Math.round((it.value || 10) * ECONOMY.sellRate));
    modal(`<div class="item-modal ${other ? 'compare' : ''}">
      <div class="im-col"><img class="icon big r-${it.rarity}" src="${Art.itemIcon(it, 128)}" alt="">${itemDetailsHTML(it, other)}</div>
      ${other ? `<div class="im-col worn"><div class="eyebrow">Надето сейчас</div><img class="icon r-${other.rarity}" src="${Art.itemIcon(other, 64)}" alt="">${itemDetailsHTML(other)}</div>` : ''}
      <div class="modal-actions">
        ${worn ? `<button class="btn" data-act="unequip" data-id="${it.slot}">Снять</button>` : `<button class="btn primary" data-act="equip" data-id="${it.uid}">Надеть</button>`}
        ${!worn ? `<button class="btn" data-act="salvage" data-id="${it.uid}">Разобрать · ${ECONOMY.dustFor[it.rarity]} пыли</button>` : ''}
        ${!worn && !S().expedition ? `<button class="btn" data-act="sell" data-id="${it.uid}">Продать · ${price} зол.</button>` : ''}
        <button class="btn" data-act="closeModal">Закрыть</button>
      </div></div>`, !!other);
  }

  /* ---------- таланты ---------- */
  function skillTipText(sk) {
    const parts = [];
    if (sk.cost === 'all') parts.push(`Тратит всё: ${RESOURCES[CLASSES[sk.cls].res].name.toLowerCase()}`);
    else if (sk.cost) parts.push(`Цена: ${sk.cost}`);
    if (sk.cd) parts.push(`Откат: ${sk.cd}`);
    if (sk.target === 'all') parts.push('По всем');
    if (sk.target === 'self') parts.push('На себя');
    if ((sk.tags || []).includes('interrupt')) parts.push('Сбивает замах');
    return parts.join(' · ');
  }

  function viewTalents() {
    const st = S();
    const h = st.hero;
    const cls = CLASSES[h.classId];
    const known = Game.knownSkills();
    const col = cls.color;
    const skillIcon = id => `<img src="${Art.glyph(SKILLS[id].icon, col, 48)}" alt="">`;
    const loadout = h.loadout.map((id, i) => `<div class="lo-slot ${id ? '' : 'empty'}" ${id ? `data-tip="skill:${id}"` : ''}>
      ${id ? skillIcon(id) : ''}<b>${i + 1}</b>${id ? `<small>${SKILLS[id].name}</small><button class="lo-x" data-act="loClear" data-i="${i}" title="Убрать">×</button>` : '<small>Пусто</small>'}
    </div>`).join('');
    const free = known.filter(id => !h.loadout.includes(id));
    const trees = cls.trees.map(t => {
      const pts = Game.treePoints(t.id);
      const tiers = [1, 2, 3, 4, 5].map(tier => {
        const nodes = t.nodes.filter(n => n.tier === tier);
        return `<div class="t-row ${pts < TIER_REQ[tier] ? 'locked' : ''}">
          <span class="t-req">${TIER_REQ[tier] ? TIER_REQ[tier] + '+' : ''}</span>
          <div class="t-nodes">${nodes.map(n => {
            const state = Game.talentState(n.id);
            return `<button class="tnode ${state} ${n.skill ? 'active' : 'passive'} ${n.keystone ? 'key' : ''}" data-act="talent" data-id="${n.id}" data-tip="talent:${n.id}">
              <img src="${Art.glyph(n.icon, state === 'taken' ? col : '#8a8074', 48)}" alt="">
              <span>${n.name}</span>
            </button>`;
          }).join('')}</div>
        </div>`;
      }).join('');
      return `<div class="tree panel"><div class="panel-h"><h3>${t.name}</h3><span class="pts-b">${pts} оч.</span></div><p class="small dim">${t.desc}</p>${tiers}</div>`;
    }).join('');
    return `<section class="talents-wrap" style="--c:${col}">
      <div class="panel lo-panel">
        <div class="panel-h"><h3>Умения в бою <small>выбери четыре</small></h3>${h.talentPoints > 0 ? `<span class="pts">Очков таланта: ${h.talentPoints}</span>` : '<span class="small dim">Очки: за уровень, боссов и прочитанные имена</span>'}</div>
        <div class="lo-row">${loadout}</div>
        ${free.length ? `<div class="lo-free"><span class="eyebrow">Запас</span>${free.map(id => `<button class="lo-pick" data-act="loAdd" data-id="${id}" data-tip="skill:${id}">${skillIcon(id)}<span>${SKILLS[id].name}</span></button>`).join('')}</div>` : ''}
        <div class="lo-hint small dim">Всегда доступны: ${cls.basic.name} и Защита. <b style="color:${RESOURCES[cls.res].color}">${RESOURCES[cls.res].name}:</b> ${RESOURCES[cls.res].hint}</div>
      </div>
      <div class="trees">${trees}</div>
      <div class="panel mastery-panel">
        <div class="panel-h"><h3>Мастерство</h3><span class="small dim">Для очков сверх веток. У каждого героя только один ключевой талант, поэтому две ветки до конца не выучить.</span></div>
        <div class="mastery-row">${Object.keys(MASTERY).map(id => {
          const m = MASTERY[id];
          const n = h.mastery[id] || 0;
          const can = h.talentPoints > 0 && n < m.max;
          return `<button class="mastery ${can ? 'can' : ''}" ${can ? `data-act="mastery" data-id="${id}"` : ''}>
            <img src="${Art.glyph(m.icon, n ? col : '#8a8074', 40)}" alt=""><span><b>${m.name}</b><small>${m.text}</small></span><em>${n}/${m.max}</em>
          </button>`;
        }).join('')}</div>
      </div>
    </section>`;
  }

  /* ---------- журнал и кодекс ---------- */
  function viewJournal() {
    const st = S();
    const ids = Object.keys(st.quests);
    const active = activeQuestIds();
    const done = ids.filter(id => st.quests[id].done);
    const rewardText = r => [r.gold && `${r.gold} зол.`, r.xp && `${r.xp} опыта`, r.talentPoint && `очки таланта: ${r.talentPoint}`, r.item && `вещь: ${RARITIES[r.item].name.toLowerCase()}`, r.consumable && CONSUMABLES[r.consumable].name].filter(Boolean).join(' · ');
    const card = id => {
      const q = QUESTS[id];
      const pr = Game.questProgress(id);
      const giver = NPCS[q.giver];
      const next = Game.questNext(id);
      return `<article class="quest panel ${q.main ? 'main' : ''} ${pr.ready ? 'ready' : ''}">
        <div class="eyebrow">${q.main ? 'Главное' : 'Поручение'} · ${giver.name}</div>
        <h3>${q.title}</h3>
        <p class="small">${esc(q.desc)}</p>
        ${pr.goals.map(g => `<div class="goal ${g.done ? 'done' : ''}"><span>${g.done ? '✓ ' : ''}${g.label}</span><b>${g.have}/${g.need}</b></div>`).join('')}
        <div class="q-next ${pr.ready ? 'ready' : ''}"><b>${pr.ready ? 'Готово' : 'Дальше'}:</b> ${esc(next.text)}${next.hint && next.hint !== true ? `<small>${esc(next.hint)}</small>` : ''}</div>
        <div class="q-low"><small>Награда: ${rewardText(q.reward)}</small>${next.npc || next.zone ? `<button class="btn small" data-act="questGo" data-id="${id}">${next.npc ? 'К собеседнику' : 'На карту'}</button>` : ''}</div>
      </article>`;
    };
    return `<section class="journal">
      <h2 class="h">Задания</h2>
      ${active.length ? `<div class="quest-grid">${active.map(card).join('')}</div>` : '<p class="dim">Сейчас заданий нет. Поговори с жителями Острога.</p>'}
      ${questLeads().length ? `<h3 class="h small-h">Можно взять</h3><div class="qt-list row">${questLeads().map(leadRow).join('')}</div>` : ''}
      ${done.length ? `<h3 class="h small-h">Выполнено</h3><div class="done-list">${done.map(id => `<span class="chip" title="${esc(QUESTS[id].desc)}">✓ ${QUESTS[id].title}</span>`).join('')}</div>` : ''}
      <h2 class="h">Бестиарий</h2>
      <div class="bestiary">${Object.values(ENEMIES).filter(e => S().kills[e.id]).map(e => `<div class="beast panel"><b>${esc(e.name)}</b><small>Убито: ${S().kills[e.id]} · ур. ${e.lvl}</small><p class="small">${esc(e.blurb)}</p></div>`).join('') || '<p class="dim">Пока никого. Это ненадолго.</p>'}</div>
    </section>`;
  }

  function viewCodex() {
    const st = S();
    const open = LORE_ORDER.filter(id => st.lore.includes(id));
    return `<section class="codex">
      <h2 class="h">Кодекс <small>${open.length}/${LORE_ORDER.length}</small></h2>
      <p class="dim small">Имена появляются здесь, когда Тихон читает их с маяка.</p>
      <h3 class="h small-h">Старший ряд <small>${RUNE_ORDER.filter(id => st.seen['rune_' + id]).length}/${RUNE_ORDER.length}</small></h3>
      <div class="rune-row">${RUNE_ORDER.map(id => {
        const d = RUNES[id];
        return st.seen['rune_' + id]
          ? `<span class="rune-stone" style="--rc:${RUNE_RARITY[d.rarity].color}" title="${d.name}, «${d.gloss}». ${d.text[0]}"><b>${d.sign}</b></span>`
          : '<span class="rune-stone unknown" title="Ещё не найдена"><b>?</b></span>';
      }).join('')}</div>
      <h3 class="h small-h">Записи</h3>
      <div class="codex-grid">${LORE_ORDER.map(id => {
        const l = LORE[id];
        if (!st.lore.includes(id)) return `<article class="lore locked"><div class="eyebrow">${l.cat}</div><h3>???</h3><p class="small dim">Ещё не открыто.</p></article>`;
        return `<article class="lore"><div class="eyebrow">${l.cat}</div><h3>${esc(l.title)}</h3><p>${esc(l.text)}</p></article>`;
      }).join('')}</div>
    </section>`;
  }

  /* ---------- маршрут вылазки ---------- */
  const NODE_GLYPH = { battle: 'slash', elite: 'skull', event: 'eye', camp: 'flame', cache: 'crown', shrine: 'spark', peddler: 'vial', boss: 'crown', grave: 'bone', start: 'wind' };

  function viewRoute() {
    const st = S();
    const e = st.expedition;
    const z = ZONES[e.zone];
    const cols = e.grid.length;
    const W = 1000, H = 400;
    const posOf = n => ({ x: 44 + n.row / (cols - 1) * (W - 88), y: H / 2 + (n.col - 1) * 112 + ((n.row * 7) % 3 - 1) * 8 });
    const lines = [];
    const nodesSvg = [];
    for (const row of e.grid) {
      for (const id of row) {
        const n = e.nodes[id];
        const p = posOf(n);
        for (const to of n.links) {
          const t = e.nodes[to];
          const q = posOf(t);
          const active = n.id === e.at || (n.done && t.done) || (n.done && t.id === e.at);
          lines.push(`<path d="M${p.x} ${p.y} C${p.x + 40} ${p.y}, ${q.x - 40} ${q.y}, ${q.x} ${q.y}" class="rl ${active ? 'act' : ''} ${(n.id === e.at) ? 'next' : ''}"/>`);
        }
      }
    }
    for (const row of e.grid) {
      for (const id of row) {
        const n = e.nodes[id];
        const p = posOf(n);
        const can = Game.canMoveTo(id);
        const here = id === e.at;
        const R = n.type === 'boss' ? 30 : n.type === 'elite' || n.type === 'grave' ? 23 : 19;
        const info = Game.NODE_TYPES[n.type];
        nodesSvg.push(`<g class="rn t-${n.type} ${can ? 'can' : ''} ${here ? 'here' : ''} ${n.done ? 'done' : ''}" ${can ? `data-act="moveNode" data-id="${id}"` : ''} data-tip="node:${n.type}" transform="translate(${p.x} ${p.y})">
          <circle r="${R + 7}" class="halo"/><circle r="${R}" class="disc"/>
          <image href="${Art.glyph(NODE_GLYPH[n.type], '#f0e0c0', 48)}" x="${-R * 0.72}" y="${-R * 0.72}" width="${R * 1.44}" height="${R * 1.44}"/>
        </g>`);
      }
    }
    const stage = Game.hmarStage();
    const cur = e.nodes[e.at];
    const rc = Game.retreatCost();
    const belt = S().hero.inventory.filter(x => x.type === 'consumable' && CONSUMABLES[x.cid].field);
    return `<section class="route-wrap" data-stage="${Math.min(stage, 4)}">
      <div class="route-head">
        <div><div class="eyebrow">Вылазка · ур. ${z.level}+</div><h2>${z.name}</h2></div>
        <div class="hmar" title="С каждым шагом Хмарь густеет. Каждая ступень: враги на 5% сильнее, добыча лучше.">
          <span class="eyebrow">Густота Хмари</span>
          <div class="hmar-bar">${Array.from({ length: 12 }, (_, i) => `<i class="${i < e.hmar ? 'on' : ''} ${i % 3 === 2 ? 'th' : ''}"></i>`).join('')}</div>
          <small>Ступень ${stage}: враги +${stage * 5}%, добыча лучше${e.freeSteps ? ` · ещё ${e.freeSteps} шага без Хмари` : ''}</small>
        </div>
        <div class="route-actions">
          ${e.blessing ? '<span class="chip good">Благословение</span>' : ''}${e.omen ? '<span class="chip bad">Дурная примета</span>' : ''}${e.sharpen ? `<span class="chip good">Заточка: ${e.sharpen}</span>` : ''}
          <button class="btn" data-act="retreatAsk">Вернуться: ${HUBS[Game.hubOfZone(e.zone)].short}</button>
        </div>
      </div>
      <div class="route-map">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${lines.join('')}${nodesSvg.join('')}</svg>
      </div>
      <div class="route-low">
        <div class="route-goals">${routeGoals(e.zone)}</div>
        <div class="route-belt">${belt.map(x => `<button class="belt-slot" data-act="useField" data-id="${x.cid}" data-tip="cons:${x.cid}"><img src="${Art.consumableIcon(x.cid, 48)}" alt=""><i>${x.qty}</i></button>`).join('')}</div>
      </div>
    </section>`;
  }

  /* Цели задания, которые можно закрыть прямо на этом маршруте */
  function routeGoals(zoneId) {
    const here = activeQuestIds().filter(id => {
      const g = Game.questProgress(id).goals.find(x => !x.done);
      if (!g || g.npc || g.type === 'names') return false;
      const next = Game.questNext(id);
      return next.zone === zoneId || (!next.zone && g.type === 'flagCount');
    });
    if (!here.length) return '<p class="small dim">Выбери следующую точку на маршруте. Подсвечены доступные.</p>';
    return `<span class="eyebrow">Цели</span>${here.map(id => {
      const g = Game.questProgress(id).goals.find(x => !x.done);
      const hint = g.hint ? ` title="${esc(g.hint)}"` : '';
      return `<span class="rg ${QUESTS[id].main ? 'main' : ''}"${hint}>${esc(g.label)}${g.need > 1 ? ` <b>${g.have}/${g.need}</b>` : ''}</span>`;
    }).join('')}`;
  }

  function moveNode(id) {
    const r = Game.moveTo(id);
    if (!r.ok) return;
    Sfx.step();
    enterNode(r.node);
  }

  function enterNode(node) {
    const t = node.type;
    if (t === 'battle' || t === 'elite' || t === 'boss' || t === 'grave') {
      beginEncounter(node);
    } else if (t === 'event') {
      showEvent(node);
    } else if (t === 'camp') {
      showCamp(node);
    } else if (t === 'cache') {
      showCache(node);
    } else if (t === 'shrine') {
      showShrine(node);
    } else if (t === 'peddler') {
      showPeddler(node);
    } else {
      Game.markNodeDone(node.id);
      render();
    }
  }

  function notesHTML(notes) {
    return `<div class="ev-notes">${(notes || []).map(n => `<span class="note-chip ${n.cls || ''}">${esc(n.t)}</span>`).join('')}</div>`;
  }

  /* ---------- события ---------- */
  const EVENT_ICON = { jar: 'vial', wound: 'drop', altar: 'flame', cart: 'crown', mist: 'wind', herb: 'vial', shard: 'spark', tree: 'skull', camp: 'flame', stone: 'bone', wolf: 'fist', door: 'eye', sack: 'skull', well: 'drop', lamp: 'spark' };

  function showEvent(node) {
    const ev = Game.eventFor();
    pendingNode = { node, ev };
    const opts = ev.opts.map((o, i) => {
      const ok = !o.if || Game.testCond(o.if);
      let tag = o.tag ? `<em>${o.tag}</em>` : '';
      if (o.check) {
        const ch = Game.checkChance(o.check);
        tag = `<em class="check">${ATTRS[o.check.attr].name} ${Math.round(ch)}%</em>`;
      }
      return `<button class="ev-opt ${ok ? '' : 'off'}" ${ok ? `data-act="evOpt" data-i="${i}"` : 'disabled'}><span>${esc(o.t)}</span>${tag}</button>`;
    }).join('');
    modal(`<div class="event">
      <div class="ev-art"><img src="${Art.glyph(EVENT_ICON[ev.art] || 'eye', '#e8c48a', 96)}" alt=""></div>
      <div class="ev-body">
        <div class="eyebrow">Событие</div>
        <h2>${ev.title}</h2>
        <p>${esc(ev.text)}</p>
        <div class="ev-opts">${opts}</div>
      </div>
    </div>`, true, true);
  }

  function eventOption(i) {
    const { node, ev } = pendingNode;
    const r = Game.resolveEventOption(ev, i);
    if (!r) return;
    if (r.passed === true) Sfx.coin();
    if (r.passed === false) Sfx.bad();
    const chk = r.passed == null ? '' : `<div class="ev-check ${r.passed ? 'good' : 'bad'}">${ATTRS[r.attr].name}: ${r.passed ? 'получилось' : 'не вышло'} (${Math.round(r.chance)}%)</div>`;
    modal(`<div class="event">
      <div class="ev-art"><img src="${Art.glyph(EVENT_ICON[ev.art] || 'eye', '#e8c48a', 96)}" alt=""></div>
      <div class="ev-body">
        <div class="eyebrow">${ev.title}</div>
        ${chk}
        <p>${esc(r.text)}</p>
        ${notesHTML(r.notes)}
        <div class="modal-actions"><button class="btn primary" data-act="${r.fight ? 'evFight' : 'evDone'}">${r.fight ? 'К оружию!' : 'Идти дальше'}</button></div>
      </div>
    </div>`, true, true);
    syncTop();
  }

  function eventDone() {
    const { node } = pendingNode;
    Game.markNodeDone(node.id);
    pendingNode = null;
    closeModal();
    render();
  }

  function eventFight() {
    const { node } = pendingNode;
    pendingNode = null;
    closeModal();
    beginEncounter({ id: node.id, type: 'battle' });
  }

  /* Лагерь */
  function showCamp(node) {
    const s = Game.heroStats();
    const line = CAMP_LINES[Math.floor(Math.random() * CAMP_LINES.length)];
    pendingNode = { node };
    modal(`<div class="event">
      <div class="ev-art camp"><img src="${Art.glyph('flame', '#ff9a3c', 96)}" alt=""></div>
      <div class="ev-body">
        <div class="eyebrow">Лагерь</div>
        <h2>Костёр</h2>
        <p>${line} Времени хватит только на что-то одно. Отсюда можно уйти домой без потерь.</p>
        <div class="ev-opts">
          <button class="ev-opt" data-act="camp" data-id="rest"><span>Отдохнуть</span><em>+${Math.round(s.maxHp * 0.4)} здоровья</em></button>
          <button class="ev-opt" data-act="camp" data-id="sharpen"><span>Заточить оружие</span><em>+15% урона на 3 боя</em></button>
          <button class="ev-opt" data-act="camp" data-id="watch"><span>Зажечь сигнальный огонь</span><em>Хмарь −3</em></button>
        </div>
      </div>
    </div>`, true, true);
  }

  function campChoice(kind) {
    Game.campAction(kind);
    pendingNode = null;
    closeModal();
    Sfx.heal();
    render();
  }

  function showCache(node) {
    const r = Game.openCache();
    if (r.trap) {
      pendingNode = { node };
      modal(`<div class="event"><div class="ev-art"><img src="${Art.glyph('skull', '#e05050', 96)}" alt=""></div><div class="ev-body">
        <div class="eyebrow">Тайник</div><h2>Ловушка</h2><p>Тайник оказался приманкой. Из пепла поднимается то, что его сторожило.</p>
        <div class="modal-actions"><button class="btn primary" data-act="evFight">К оружию!</button></div></div></div>`, true, true);
      return;
    }
    pendingNode = { node };
    Sfx.coin();
    modal(`<div class="event"><div class="ev-art"><img src="${Art.glyph('crown', '#e8c48a', 96)}" alt=""></div><div class="ev-body">
      <div class="eyebrow">Тайник</div><h2>Кто-то не вернулся за этим</h2><p>Ты разгребаешь пепел и находишь чужой схрон.</p>
      ${notesHTML(r.notes)}
      <div class="modal-actions"><button class="btn primary" data-act="evDone">Забрать и идти</button></div></div></div>`, true, true);
    syncTop();
  }

  function showShrine(node) {
    pendingNode = { node };
    modal(`<div class="event"><div class="ev-art"><img src="${Art.glyph('spark', '#d7b6ff', 96)}" alt=""></div><div class="ev-body">
      <div class="eyebrow">Святилище</div><h2>Камень, который слушает</h2>
      <p>На плите углублённая ладонь. Кто-то до тебя стёр её до блеска. Обычно за это что-то просят.</p>
      <div class="ev-opts">
        <button class="ev-opt" data-act="shrine" data-id="blood"><span>Отдать кровь</span><em>−15% здоровья, 2 благословения</em></button>
        <button class="ev-opt" data-act="shrine" data-id="gold"><span>Отдать золото</span><em>−${20 + S().hero.level * 8} зол., +25% здоровья</em></button>
        <button class="ev-opt" data-act="shrine" data-id="none"><span>Не трогать</span></button>
      </div></div></div>`, true, true);
  }

  function shrineChoice(k) {
    const h = S().hero;
    if (k === 'blood') Game.applyDo({ hurt: 15, blessing: 2 });
    if (k === 'gold') {
      const c = 20 + h.level * 8;
      if (h.gold < c) { toast('Не хватает золота.', 'bad'); return; }
      Game.applyDo({ gold: -c, heal: 25 });
    }
    eventDone();
  }

  function showPeddler(node) {
    pendingNode = { node };
    const items = ['potion_small', 'potion_big', 'antidote', 'firebomb', 'bandage'];
    if (Game.hubOfZone(S().expedition.zone) === 'springs') items.push('wax', 'spring_water');
    const h = S().hero;
    modal(`<div class="event"><div class="ev-art"><img src="${Art.glyph('vial', '#c8b48a', 96)}" alt=""></div><div class="ev-body">
      <div class="eyebrow">Встреча на дороге</div><h2>Человек с мешком</h2>
      <p>Он не спрашивает, кто ты. Спрашивает, сколько у тебя золота. Цены в дороге выше городских. Сейчас у тебя ${h.gold}.</p>
      <div class="ev-opts">${items.map(c => {
        const d = CONSUMABLES[c];
        const price = Math.round(d.value * 1.4);
        return `<button class="ev-opt ${h.gold >= price ? '' : 'off'}" data-act="peddlerBuy" data-id="${c}" data-tip="cons:${c}"><span>${d.name}</span><em>${price} зол.</em></button>`;
      }).join('')}</div>
      <div class="modal-actions"><button class="btn" data-act="evDone">Идти дальше</button></div></div></div>`, true, true);
  }

  function peddlerBuy(cid) {
    const price = Math.round(CONSUMABLES[cid].value * 1.4);
    if (S().hero.gold < price) { toast('Не хватает золота.', 'bad'); return; }
    Game.addGold(-price);
    Game.addConsumable(cid, 1);
    Sfx.coin();
    Game.save();
    showPeddler(pendingNode.node);
    syncTop();
  }

  /* ---------- БОЙ ---------- */
  function beginEncounter(node) {
    const enc = Game.encounterFor(node);
    const c = Game.beginBattle(enc);
    const z = ZONES[S().expedition.zone];
    battle = { c, node, zone: z, disp: {}, target: null, busy: true, logs: [], enc, tick: 0, headlineT: 0 };
    tab = 'route';
    renderBattle();
    Scene.mount($('battleCanvas'), z.scene, battleHud);
    Scene.setSpeed(S().settings.speed || 1);
    Scene.addHero(S().hero);
    if (c.hero.minion) Scene.addMinion();
    for (const u of c.enemies) Scene.addEnemy(u);
    syncDisp();
    syncBattle();
    const boss = c.enemies.find(u => u.boss);
    if (boss) {
      headline(boss.name, boss.def.intro || '', true);
      Sfx.phase();
      setTimeout(runStart, 2600 / (S().settings.speed || 1));
    } else if (enc.grave) {
      headline('Твоя тень', 'Она держит то, что ты потерял.', true);
      setTimeout(runStart, 1600);
    } else if (enc.elite) {
      headline(c.enemies[0].name, c.enemies[0].affix.desc, true);
      setTimeout(runStart, 1300);
    } else {
      setTimeout(runStart, 450);
    }
    if (!S().flags.tutBattle) {
      S().flags.tutBattle = 1;
      setTimeout(() => toast('<b>Читай намерения.</b> Над врагом видно, что он сделает. «Замах» можно сбить умением со значком молнии или принять в Защиту.', 'tip'), 800);
    }
  }

  function runStart() {
    if (!battle) return;
    Combat.advance(battle.c);
    runEvents();
  }

  function headline(title, sub, big) {
    const el = $('headline');
    if (!el) return;
    el.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    el.className = `headline show ${big ? 'big' : ''}`;
    clearTimeout(headline.t);
    headline.t = setTimeout(() => { el.className = 'headline'; }, big ? 2400 : 1500);
  }

  function syncDisp() {
    const b = battle;
    const c = b.c;
    b.disp.hero = { hp: c.hero.hp, shield: c.hero.shield };
    for (const u of c.enemies) b.disp[u.key] = { hp: u.hp, shield: u.shield };
    b.disp.res = c.hero.res;
  }

  /* Сцена докладывает о событиях во время анимации */
  function battleHud(e) {
    const b = battle;
    if (!b) return null;
    switch (e.t) {
      case 'hit':
        if (b.disp[e.who]) { b.disp[e.who].hp = e.hp; b.disp[e.who].shield = e.shield; }
        updateCards();
        break;
      case 'heal':
        if (b.disp[e.who]) b.disp[e.who].hp = e.hp;
        updateCards();
        break;
      case 'shield':
        if (b.disp[e.who]) b.disp[e.who].shield = e.shield;
        updateCards();
        break;
      case 'res':
        b.disp.res = e.value;
        updateHeroCard();
        break;
      case 'log':
        pushLog(e);
        break;
      case 'phase':
        headline(e.text, '', true);
        break;
      case 'getUnit':
        return b.c.enemies.find(u => u.key === e.key) || null;
      case 'actor':
        if (e.who !== 'hero' && e.name) {
          const u = b.c.enemies.find(x => x.key === e.who);
          headline(e.name, u ? u.name : '', false);
        }
        break;
      default:
    }
    return null;
  }

  function pushLog(e) {
    const b = battle;
    b.logs.push(e);
    const el = $('blog');
    if (el) {
      const d = document.createElement('div');
      d.className = `l ${e.cls || ''}`;
      d.innerHTML = e.text;
      el.appendChild(d);
      el.scrollTop = el.scrollHeight;
      while (el.childNodes.length > 60) el.removeChild(el.firstChild);
    }
  }

  function renderBattle() {
    const b = battle;
    $('app').innerHTML = `<section class="battle">
      <div class="b-stage">
        <canvas id="battleCanvas"></canvas>
        <div class="b-order" id="bOrder"></div>
        <div class="headline" id="headline"></div>
        <div class="b-cards" id="bCards"></div>
        <div class="b-tools">
          <button class="ic" data-act="bSpeed" id="bSpeed" title="Скорость анимаций">×${S().settings.speed || 1}</button>
          <button class="ic" data-act="sound" title="Звук">${Sfx.on ? '♪' : '×'}</button>
        </div>
      </div>
      <div class="b-bottom">
        <div class="b-hero" id="bHero"></div>
        <div class="b-actions" id="bActions"></div>
        <div class="b-log" id="blog"></div>
      </div>
    </section>`;
    const cv = $('battleCanvas');
    cv.addEventListener('click', ev => {
      const r = cv.getBoundingClientRect();
      const key = Scene.hitTest(ev.clientX - r.left, ev.clientY - r.top);
      if (key) selectTarget(key);
    });
  }

  function selectTarget(key) {
    if (!battle) return;
    const u = battle.c.enemies.find(x => x.key === key);
    if (!u || u.hp <= 0) return;
    battle.target = key;
    updateCards();
    Sfx.click();
  }

  function statusIcons(u) {
    return Object.keys(u.statuses).map(s => {
      const st = u.statuses[s];
      const def = STATUSES[s];
      if (!def) return '';
      const n = st.stacks != null ? st.stacks : (st.turns > 90 ? '∞' : st.turns);
      return `<span class="st ${def.bad ? 'bad' : 'good'}" style="--sc:${def.color}" data-tip="status:${s}"><img src="${Art.glyph(def.icon, def.color, 32)}" alt=""><i>${n}</i></span>`;
    }).join('');
  }

  function intentHTML(c, u) {
    const m = u.intent;
    if (!m) return '';
    if (u.statuses.stun) return '<div class="intent stun">Оглушён</div>';
    const dmg = Combat.intentDamage(c, u);
    const fx = (m.apply || []).map(a => `<img src="${Art.glyph(STATUSES[a.s].icon, STATUSES[a.s].color, 28)}" alt="">`).join('');
    const buff = (m.self || m.healAlly) ? `<img src="${Art.glyph(m.healAlly ? 'drop' : 'fist', '#7ee0a0', 28)}" alt="">` : '';
    return `<div class="intent ${m.heavy ? 'heavy' : ''}" data-tip="intent:${u.key}">
      ${m.heavy ? '<em>ЗАМАХ</em>' : ''}<b>${esc(m.name)}</b>${dmg ? `<span class="idmg">≈${dmg}</span>` : ''}${fx}${buff}
    </div>`;
  }

  function updateCards() {
    const b = battle;
    if (!b) return;
    const box = $('bCards');
    if (!box) return;
    const c = b.c;
    const alive = c.enemies.filter(u => (b.disp[u.key] ? b.disp[u.key].hp : u.hp) > 0);
    if (!b.target || !alive.some(u => u.key === b.target)) b.target = alive[0] ? alive[0].key : null;
    box.innerHTML = alive.map(u => {
      const d = b.disp[u.key] || u;
      const hpPct = clamp01(d.hp / u.maxHp) * 100;
      const shPct = clamp01((d.shield || 0) / u.maxHp) * 100;
      return `<div class="ecard ${u.key === b.target ? 'target' : ''} ${u.boss ? 'boss' : ''} ${u.elite ? 'elite' : ''}" data-act="target" data-id="${u.key}">
        ${intentHTML(c, u)}
        <div class="en"><b>${esc(u.name)}</b><small>ур. ${u.lvl}</small></div>
        <div class="bar ehp"><i style="width:${hpPct}%"></i>${shPct ? `<u style="width:${shPct}%"></u>` : ''}<span>${Math.max(0, Math.round(d.hp))} / ${u.maxHp}</span></div>
        <div class="sts">${statusIcons(u)}</div>
      </div>`;
    }).join('');
    updateHeroCard();
    Scene.setTarget(b.target);
  }

  const clamp01 = v => Math.max(0, Math.min(1, v));

  function updateHeroCard() {
    const b = battle;
    const el = $('bHero');
    if (!b || !el) return;
    const h = b.c.hero;
    const d = b.disp.hero || h;
    const res = RESOURCES[h.resId];
    const val = b.disp.res != null ? b.disp.res : h.res;
    const resBar = res.pips
      ? `<div class="pips" style="--rc:${res.color}" title="${esc(res.hint)}">${Array.from({ length: res.max }, (_, i) => `<i class="${i < val ? 'on' : ''}"></i>`).join('')}<small>${res.name}</small></div>`
      : `<div class="bar res" style="--rc:${res.color}" title="${esc(res.hint)}"><i style="width:${val / res.max * 100}%"></i><span>${res.name} ${Math.round(val)}</span></div>`;
    el.innerHTML = `<div class="hn"><b>${esc(h.name)}</b><small>ур. ${h.lvl}</small></div>
      <div class="bar hhp ${d.hp / h.maxHp < 0.3 ? 'low' : ''}"><i style="width:${clamp01(d.hp / h.maxHp) * 100}%"></i>${d.shield ? `<u style="width:${clamp01(d.shield / h.maxHp) * 100}%"></u>` : ''}<span>${Math.max(0, Math.round(d.hp))} / ${h.maxHp}${d.shield ? ` +${Math.round(d.shield)}` : ''}</span></div>
      ${resBar}
      <div class="sts">${statusIcons(h)}</div>`;
    Scene.setShield('hero', d.shield || 0);
  }

  function updateOrder() {
    const b = battle;
    const el = $('bOrder');
    if (!b || !el) return;
    const order = Combat.turnOrder(b.c, 7);
    const cls = CLASSES[S().hero.classId];
    el.innerHTML = `<span class="o-l">Очередь</span>` + order.map((u, i) => {
      const isHero = u.side === 'hero';
      const color = isHero ? cls.color : (u.boss ? '#e0603c' : '#8a8078');
      const heavy = !isHero && u.intent && u.intent.heavy;
      return `<span class="o ${isHero ? 'me' : ''} ${i === 0 ? 'now' : ''} ${heavy ? 'danger' : ''}" style="--oc:${color}" title="${esc(u.name)}">${isHero ? 'ТЫ' : esc(u.name).slice(0, 1)}</span>`;
    }).join('');
  }

  function renderActions() {
    const b = battle;
    const el = $('bActions');
    if (!b || !el) return;
    const c = b.c;
    const h = S().hero;
    const cls = CLASSES[h.classId];
    const can = c.awaiting === 'hero' && !b.busy && !c.over;
    const basicId = 'basic_' + cls.id;
    const col = cls.color;
    const skills = [basicId, ...h.loadout.filter(Boolean)];
    const btn = (id, i) => {
      const sk = SKILLS[id];
      const st = Combat.skillState(c, id);
      const costTxt = sk.cost === 'all' ? 'всё' : sk.cost ? String(sk.cost) : '';
      const repeat = c.hero.resId === 'lad' && c.hero.lastSkill === id && c.hero.res > 0;
      const interrupt = (sk.tags || []).includes('interrupt');
      const heavyNow = interrupt && c.enemies.some(u => u.hp > 0 && u.intent && u.intent.heavy);
      return `<button class="skill ${st.ok && can ? '' : 'off'} ${heavyNow ? 'hint' : ''} ${repeat ? 'repeat' : ''}" ${st.ok && can ? `data-act="useSkill" data-id="${id}"` : ''} data-tip="skill:${id}">
        <img src="${Art.glyph(sk.icon, st.ok ? col : '#6a6058', 48)}" alt="">
        <span>${sk.name}</span>
        <i class="k">${i + 1}</i>
        ${costTxt ? `<i class="cost">${costTxt}</i>` : ''}
        ${st.cd ? `<i class="cdn">${st.cd}</i>` : ''}
        ${interrupt ? '<i class="bolt">⚡</i>' : ''}
      </button>`;
    };
    const guardBtn = `<button class="skill guard ${can ? '' : 'off'}" ${can ? 'data-act="guard"' : ''} data-tip="guard:1">
      <img src="${Art.glyph('shield', '#c8b48a', 48)}" alt=""><span>Защита</span><i class="k">${skills.length + 1}</i></button>`;
    const belt = h.belt.map((cid, i) => {
      if (!cid) return '<span class="bslot empty"></span>';
      const q = Game.consumableQty(cid);
      const okb = can && !c.itemUsed && q > 0;
      return `<button class="bslot ${okb ? '' : 'off'}" ${okb ? `data-act="useBelt" data-id="${cid}"` : ''} data-tip="cons:${cid}"><img src="${Art.consumableIcon(cid, 48)}" alt=""><i>${q}</i></button>`;
    }).join('');
    el.innerHTML = `<div class="sk-row">${skills.map(btn).join('')}${guardBtn}</div>
      <div class="sk-side"><div class="belt">${belt}</div>
      ${b.enc.noFlee ? '' : `<button class="btn small ${can ? '' : 'off'}" ${can ? 'data-act="flee"' : ''}>Бежать</button>`}</div>`;
    const stage = document.querySelector('.battle');
    if (stage) stage.classList.toggle('myturn', !!can);
  }

  function syncBattle() {
    updateCards();
    updateOrder();
    renderActions();
  }

  async function runEvents() {
    const b = battle;
    if (!b) return;
    b.busy = true;
    renderActions();
    const events = b.c.ev.splice(0);
    try {
      await Scene.play(events, battleHud);
    } catch (err) { console.error(err); }
    if (!battle) return;
    if (b.c.ev.length) return runEvents();
    b.busy = false;
    syncDisp();
    syncBattle();
    if (b.c.over) finishBattleUI();
  }

  function doSkill(id) {
    const b = battle;
    if (!b || b.busy) return;
    const r = Combat.useSkill(b.c, id, b.target);
    if (r.ok) runEvents();
  }

  function doGuard() {
    const b = battle;
    if (!b || b.busy) return;
    const r = Combat.guard(b.c);
    if (r.ok) runEvents();
  }

  function doBelt(cid) {
    const b = battle;
    if (!b || b.busy) return;
    if (Game.consumableQty(cid) < 1) return;
    const r = Combat.useItem(b.c, CONSUMABLES[cid]);
    if (!r.ok) { toast(r.msg || 'Нельзя.', 'bad'); return; }
    Game.spendConsumable(cid);
    runEvents();
  }

  function doFlee() {
    const b = battle;
    if (!b || b.busy) return;
    Combat.flee(b.c);
    runEvents();
  }

  function finishBattleUI() {
    const b = battle;
    const c = b.c;
    const res = Game.finishBattle(c);
    if (res.win) {
      Sfx.win();
      Scene.celebrate();
      Game.markNodeDone(b.node.id);
      setTimeout(() => showReward(res, b), 700);
    } else if (res.fled) {
      Game.markNodeDone(b.node.id);
      const e = S().expedition;
      if (e) e.hmar++;
      Game.save();
      leaveBattle();
      toast('Ты ушёл от боя. Хмарь стала гуще.', 'bad');
      render();
    } else {
      setTimeout(() => showDeath(), 1100);
    }
  }

  function leaveBattle() {
    Scene.unmount();
    battle = null;
    hideTip();
  }

  function rewardItemsHTML(items, cons) {
    const parts = [];
    for (const it of (items || [])) parts.push(`<button class="rw-item" data-act="itemOpen" data-id="${it.uid}" data-tip="uid:${it.uid}"><img class="icon r-${it.rarity}" src="${Art.itemIcon(it, 64)}" alt=""><span class="t-${it.rarity}">${esc(itemName(it))}</span></button>`);
    for (const cid of (cons || [])) parts.push(`<div class="rw-item" data-tip="cons:${cid}"><img class="icon r-${CONSUMABLES[cid].rarity}" src="${Art.consumableIcon(cid, 64)}" alt=""><span>${CONSUMABLES[cid].name}</span></div>`);
    return parts.join('');
  }

  function showReward(res, b) {
    const boss = res.boss;
    modal(`<div class="reward ${boss ? 'boss' : ''}">
      <div class="eyebrow">${boss ? 'Хозяин повержен' : 'Победа'}</div>
      <h2>${boss ? esc(b.c.enemies.find(u => u.boss).name) : 'Поле за тобой'}</h2>
      <div class="rw-line"><span class="rw-v">+${res.xp}<small>опыта</small></span><span class="rw-v coin">+${res.gold}<small>золота</small></span>${res.dust ? `<span class="rw-v dust">+${res.dust}<small>пыли</small></span>` : ''}</div>
      ${res.levels ? `<p class="good">Новый уровень! Распредели очки на вкладках «Герой» и «Таланты».</p>` : ''}
      ${(res.runes || []).map(r => `<div class="rune-drop"><div class="rm-stone">${runeBadge(r, 'big')}</div><div><div class="eyebrow">Редкая находка</div><b style="color:${RUNE_RARITY[RUNES[r.id].rarity].color}">Руна ${RUNES[r.id].name}, «${RUNES[r.id].gloss}»</b><small>${RUNES[r.id].text[0]}. Вставь её в Рунный круг на вкладке «Герой».</small></div></div>`).join('')}
      <div class="rw-items">${rewardItemsHTML(res.items, res.consumables)}</div>
      ${(res.notes || []).map(n => `<p class="small">${esc(n)}</p>`).join('')}
      <div class="modal-actions"><button class="btn primary" data-act="${boss ? 'rewardBoss' : 'rewardNext'}">${boss ? `Вернуться: ${HUBS[Game.hubOfZone(S().expedition.zone)].short}` : 'Дальше'}</button></div>
    </div>`, false, true);
  }

  function rewardNext() {
    closeModal();
    leaveBattle();
    render();
  }

  /* ---------- финал ---------- */
  function showEnding() {
    const list = Object.keys(ENDINGS).filter(id => !ENDINGS[id].if || ENDINGS[id].if(S()));
    modal(`<div class="ending">
      <div class="eyebrow">Самая высокая башня</div>
      <h2>«Кто ты?»</h2>
      <p class="dlg-text">Пепел стоит перед тобой. Он больше не бьёт: ты победил, если здесь вообще можно победить. Он просто ждёт. Все сто башен молчат и слушают. Хмарь над Пределом остановилась. Ответить нужно один раз.</p>
      <div class="ev-opts">${list.map(id => `<button class="ev-opt" data-act="endChoose" data-id="${id}"><span>${ENDINGS[id].t}</span><em>${ENDINGS[id].tag}</em></button>`).join('')}</div>
    </div>`, true, true);
  }

  function chooseEnding(id) {
    const e = ENDINGS[id];
    S().flags.ending = id;
    LORE.ending.text = `${e.title}. ${e.text(S().hero.name)}`;
    S().endingText = LORE.ending.text;
    Game.unlockLore('ending');
    Game.finishQuest('q_question');
    Game.save();
    Sfx.level();
    modal(`<div class="ending">
      <div class="eyebrow">Конец хроники</div>
      <h2>${e.title}</h2>
      <p class="dlg-text">${esc(e.text(S().hero.name))}</p>
      <div class="modal-actions"><button class="btn primary" data-act="endEpilogue">Что стало с остальными</button></div>
    </div>`, true, true);
  }

  function showEpilogue() {
    modal(`<div class="ending">
      <div class="eyebrow">Предел помнит</div>
      <h2>Что было потом</h2>
      <div class="epilogue">${epilogueLines().map(t => `<p>${esc(t)}</p>`).join('')}</div>
      <p class="small dim">Хроника закончена, но мир открыт. Можно вернуться в любую зону: собрать Старший ряд, легендарные вещи и оставшиеся имена.</p>
      <div class="modal-actions"><button class="btn primary" data-act="endClose">Вернуться в мир</button></div>
    </div>`, true, true);
  }

  function rewardBoss() {
    const lastFight = battle && battle.c.enemies.some(u => u.id === 'the_question') && !S().flags.ending;
    closeModal();
    leaveBattle();
    Game.retreat(true);
    tab = 'city';
    render();
    if (lastFight) { showEnding(); return; }
    toast('Ты вернулся с победой. Поговори с жителями: у них новости.', 'quest');
  }

  function showDeath() {
    const line = DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)];
    const r = Game.onDeath();
    modal(`<div class="reward death">
      <div class="eyebrow">Пепел взял своё</div>
      <h2>Ты пал</h2>
      <p class="dlg-text">${line}</p>
      <p>Твоя тень держит: ${r.items.length ? r.items.map(i => esc(i.name)).join(', ') : 'ни одной вещи'}, ${r.gold} золота. Вернись в ту же зону, найди её и забери своё.</p>
      <p class="small dim">Ты приходишь в себя в поселении (${hub().short}) с половиной здоровья. Надетые вещи и опыт при тебе.</p>
      <div class="modal-actions"><button class="btn primary" data-act="deathOk">Подняться</button></div>
    </div>`, false, true);
  }

  function deathOk() {
    closeModal();
    leaveBattle();
    tab = 'city';
    render();
  }

  /* ---------- модальное окно ---------- */
  function modal(html, wide = false, locked = false) {
    const m = $('modal');
    m.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
    m.classList.remove('hidden');
    m.dataset.locked = locked ? '1' : '';
    hideTip();
  }

  function closeModal() {
    const m = $('modal');
    m.classList.add('hidden');
    m.innerHTML = '';
    hideTip();
  }

  /* ---------- подсказки ---------- */
  function tipFor(spec) {
    const [kind, a, b] = spec.split(':');
    if (kind === 'uid') {
      const it = findItem(a);
      if (!it) return '';
      const worn = S().hero.equipment[it.slot];
      return itemDetailsHTML(it, worn && worn !== it ? worn : null);
    }
    if (kind === 'shop') {
      const e = Game.shop(a).stock[+b];
      if (!e || e.kind !== 'gear') return '';
      return itemDetailsHTML(e.item, S().hero.equipment[e.item.slot]);
    }
    if (kind === 'cons') {
      const d = CONSUMABLES[a];
      return `<div class="tt-h t-${d.rarity}">${d.name}</div><div class="tt-desc">${d.desc}</div>`;
    }
    if (kind === 'skill') {
      const sk = SKILLS[a];
      const meta = skillTipText(sk);
      return `<div class="tt-h">${sk.name}</div>${meta ? `<div class="tt-sub">${meta}</div>` : ''}<div class="tt-desc">${sk.desc}</div>`;
    }
    if (kind === 'talent') {
      const n = TALENTS[a];
      const state = Game.talentState(a);
      const req = TIER_REQ[n.tier];
      const stateText = state === 'taken' ? 'Изучено' : state === 'barred' ? 'Ключевой талант можно взять только один. Сброс у брата Саввы.' : state === 'locked' ? `Нужно ${req} оч. в этой ветке` : state === 'nopoints' ? 'Нет очков таланта' : 'Нажми, чтобы изучить';
      const meta = n.skill ? skillTipText(SKILLS[a]) : (n.keystone ? 'Ключевой талант' : 'Пассивный талант');
      return `<div class="tt-h">${n.name}</div><div class="tt-sub">${n.skill ? 'Умение · ' : ''}${meta}</div><div class="tt-desc">${n.desc}</div><div class="tt-note">${stateText}</div>`;
    }
    if (kind === 'rune') {
      const r = S().hero.runes.find(x => x.uid === a);
      return r ? runeTipHTML(r) : '';
    }
    if (kind === 'status') {
      const d = STATUSES[a];
      return `<div class="tt-h" style="color:${d.color}">${d.name}</div><div class="tt-desc">${d.desc}</div>`;
    }
    if (kind === 'guard') {
      return `<div class="tt-h">Защита</div><div class="tt-desc">Весь ход ты закрыт: удары слабее на 55%, тяжёлый замах — на 70%. Копит ресурс.</div>`;
    }
    if (kind === 'node') {
      const d = Game.NODE_TYPES[a];
      return `<div class="tt-h">${d.name}</div><div class="tt-desc">${d.desc}</div>`;
    }
    if (kind === 'intent' && battle) {
      const u = battle.c.enemies.find(x => x.key === a);
      if (!u || !u.intent) return '';
      const m = u.intent;
      const parts = [];
      if (m.heavy) parts.push('Тяжёлый замах: сбей его умением с молнией или закройся Защитой.');
      for (const x of (m.apply || [])) parts.push(`Наложит: ${STATUSES[x.s].name}`);
      if (m.healAlly) parts.push('Лечит союзника.');
      for (const x of (m.self || [])) parts.push(`На себя: ${STATUSES[x.s].name}`);
      return `<div class="tt-h">${esc(m.name)}</div><div class="tt-desc">${parts.join('<br>') || 'Обычный удар.'}</div>`;
    }
    return '';
  }

  function showTip(spec, x, y) {
    const html = tipFor(spec);
    const el = $('tooltip');
    if (!html) { hideTip(); return; }
    el.innerHTML = html;
    el.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    const px = Math.min(window.innerWidth - r.width - 10, x + 16);
    const py = Math.min(window.innerHeight - r.height - 10, y + 12);
    el.style.left = `${Math.max(8, px)}px`;
    el.style.top = `${Math.max(8, py)}px`;
  }

  function hideTip() {
    const el = $('tooltip');
    if (el) el.classList.add('hidden');
  }

  /* ---------- действия ---------- */
  const ACT = {
    pickClass: el => { introClass = el.dataset.id; const inp = $('heroName'); if (inp) introName = inp.value; Sfx.click(); renderIntro(); },
    begin: () => {
      const inp = $('heroName');
      Game.newGame(inp ? inp.value : '', introClass);
      Game.autoStartQuests();
      tab = 'city';
      render();
      setTimeout(() => openNpc('mira'), 250);
    },
    goMap: () => { if (S() && !battle) { tab = S().expedition ? 'route' : 'map'; render(); } },
    tab: el => { tab = el.dataset.id; closeModal(); Sfx.click(); render(); },
    sound: () => { const v = !Sfx.on; Sfx.set(v); S().settings.sound = v; Game.save(); if (battle) { document.querySelectorAll('.b-tools .ic')[1].textContent = v ? '♪' : '×'; } else syncTop(); },
    resetAsk: () => modal(`<h2>Начать заново?</h2><p>Текущий герой будет потерян навсегда.</p><div class="modal-actions"><button class="btn danger" data-act="resetDo">Стереть всё</button><button class="btn" data-act="closeModal">Отмена</button></div>`),
    resetDo: () => { Game.reset(); closeModal(); tab = 'map'; render(); },
    closeModal: () => { closeModal(); if (!battle) render(); },

    zoneOpen: el => openZoneModal(el.dataset.id),
    runeOpen: el => openRune(el.dataset.id),
    runeIn: el => { const r = Game.insertRune(el.dataset.id); if (!r.ok && r.msg) { toast(r.msg, 'bad'); return; } Sfx.level(); closeModal(); render(); },
    runeOut: el => { const r = Game.removeRune(el.dataset.id); if (!r.ok && r.msg) { toast(r.msg, 'bad'); return; } Sfx.click(); closeModal(); render(); },
    runeMerge: el => { const r = Game.mergeRunes(el.dataset.id); if (!r.ok) { if (r.msg) toast(r.msg, 'bad'); return; } Sfx.forge(); render(); openRune(r.rune.uid); toast(`Руны слились: ${RUNES[r.rune.id].name}, ступень ${ROMAN[r.rune.level]}`, 'good'); },
    mastery: el => { const r = Game.takeMastery(el.dataset.id); if (r.ok) { Sfx.level(); render(); } },
    endChoose: el => chooseEnding(el.dataset.id),
    endEpilogue: () => showEpilogue(),
    endClose: () => { closeModal(); render(); },
    hubGo: el => { Game.goHub(el.dataset.id); tab = 'city'; Sfx.click(); render(); },
    npcGo: el => goToNpc(el.dataset.id),
    questGo: el => {
      const next = Game.questNext(el.dataset.id);
      if (S().expedition) { toast(next.text, 'quest'); return; }
      closeModal();
      if (next.npc) goToNpc(next.npc);
      else if (next.zone) { tab = 'map'; render(); openZoneModal(next.zone); }
      else { tab = 'journal'; render(); }
    },
    startExp: el => { const r = Game.startExpedition(el.dataset.id); if (r.ok) { closeModal(); tab = 'route'; render(); } else if (r.msg) toast(r.msg, 'bad'); },
    moveNode: el => moveNode(el.dataset.id),
    retreatAsk: () => {
      const rc = Game.retreatCost();
      const text = rc.free
        ? 'Отсюда до дома можно дойти спокойно. Всё найденное останется при тебе.'
        : `Уходить приходится в спешке. ${rc.itemsLost ? 'Одна находка будет потеряна. ' : ''}${rc.gold ? `Рассыплешь ${rc.gold} золота. ` : ''}Без потерь уйти можно только из лагеря.`;
      modal(`<h2>Вернуться домой?</h2><p>${text}</p><div class="modal-actions"><button class="btn primary" data-act="retreatDo">Уйти</button><button class="btn" data-act="closeModal">Остаться</button></div>`);
    },
    retreatDo: () => { const r = Game.retreat(false); closeModal(); tab = 'city'; render(); if (r && r.notes.length) toast(r.notes.join('. '), 'bad'); },
    evOpt: el => eventOption(+el.dataset.i),
    evDone: () => eventDone(),
    evFight: () => eventFight(),
    camp: el => campChoice(el.dataset.id),
    shrine: el => shrineChoice(el.dataset.id),
    peddlerBuy: el => peddlerBuy(el.dataset.id),

    useSkill: el => doSkill(el.dataset.id),
    guard: () => doGuard(),
    useBelt: el => doBelt(el.dataset.id),
    flee: () => doFlee(),
    target: el => selectTarget(el.dataset.id),
    bSpeed: () => { const st = S().settings; st.speed = st.speed === 1 ? 2 : 1; Scene.setSpeed(st.speed); $('bSpeed').textContent = `×${st.speed}`; Game.save(); },
    rewardNext: () => rewardNext(),
    rewardBoss: () => rewardBoss(),
    deathOk: () => deathOk(),

    building: el => openBuilding(el.dataset.id),
    talk: el => openNpc(el.dataset.id),
    dlgOpt: el => dialogOption(el.dataset.npc, el.dataset.node, +el.dataset.i),
    shop: el => openShop(el.dataset.id),
    forge: () => openForge(),
    buy: el => { const r = Game.buy(el.dataset.shop, +el.dataset.i); if (r.ok) { Sfx.coin(); openShop(el.dataset.shop); syncTop(); } else if (r.msg) toast(r.msg, 'bad'); },
    upgrade: el => { const r = Game.upgradeItem(el.dataset.id); if (r.ok) { Sfx.forge(); openForge(el.dataset.id); syncTop(); } else if (r.msg) toast(r.msg, 'bad'); },
    rest: () => { const r = Game.innRest(); if (r.ok) { Sfx.heal(); toast(r.charity ? 'Тебе молча ставят миску. «Отдашь потом». Здоровье: не меньше 60%.' : 'Ты спишь без снов. Здоровье восстановлено.', 'good'); closeModal(); render(); } else if (r.msg) toast(r.msg); },
    readNames: () => {
      const r = Game.readNames();
      if (!r.ok) { toast(r.msg, ''); return; }
      modal(`<div class="reward"><div class="eyebrow">Маяк</div><h2>Тихон читает</h2>
        <p class="dlg-text">Голос у него скрипучий и негромкий, но долетает далеко. Прочитано имён: ${r.read}.</p>
        ${r.unlocked.map(n => `<p class="small">Записано в кодекс: «${esc(n)}»</p>`).join('')}
        ${r.points ? `<p class="good">Ты стал больше, чем был: +${r.points} очко таланта.</p>` : `<p class="small dim">Каждые 3 имени дают очко таланта. Всего прочитано: ${S().namesRead}.</p>`}
        <div class="modal-actions"><button class="btn primary" data-act="closeModal">Спасибо</button></div></div>`);
    },
    beaconOpen: () => openBeacon(),
    buyBeacon: () => { const r = Game.buyBeacon(); if (r.ok) { Sfx.level(); toast(`Маяк: ${r.name}`, 'good'); openBeacon(); syncTop(); } else if (r.msg) toast(r.msg, 'bad'); },
    respecAsk: () => modal(`<h2>Забыть выученное?</h2><p>Все таланты и очки характеристик вернутся, и ты распределишь их заново. Цена: ${ECONOMY.respecCost(S().hero.level)} золота.</p><div class="modal-actions"><button class="btn primary" data-act="respecDo">Забыть</button><button class="btn" data-act="closeModal">Нет</button></div>`),
    respecDo: () => { const r = Game.respec(); if (r.ok) { toast('Ты забыл всё, чему учился. Осталось вспомнить заново.', 'good'); closeModal(); tab = 'talents'; render(); } else toast(r.msg, 'bad'); },
    claimContract: el => { const r = Game.claimContract(el.dataset.id); if (r.ok) { Sfx.coin(); if (S().contracts.length === 0) Game.refreshContracts(true); render(); } },
    refreshContracts: () => { const r = Game.refreshContracts(false); if (!r.ok) toast(r.msg, 'bad'); else render(); },

    attr: el => { Game.spendAttr(el.dataset.id); Sfx.click(); render(); },
    bagFilter: el => { bagFilter = el.dataset.id; render(); },
    itemOpen: el => openItem(el.dataset.id),
    equip: el => { Game.equip(el.dataset.id); Sfx.click(); closeModal(); render(); },
    unequip: el => { const r = Game.unequip(el.dataset.id); if (!r.ok && r.msg) toast(r.msg, 'bad'); closeModal(); render(); },
    sell: el => { const r = Game.sellItem(el.dataset.id); if (r.ok) { Sfx.coin(); toast(`+${r.price} золота`, 'good'); } closeModal(); render(); },
    salvage: el => { const r = Game.salvageItem(el.dataset.id); if (r.ok) { Sfx.coin(); toast(`+${r.dust} пыли`, 'good'); } closeModal(); render(); },
    salvageCommon: () => {
      const h = S().hero;
      const list = h.inventory.filter(x => x.type === 'gear' && x.rarity === 'common');
      if (!list.length) { toast('Обычных вещей нет.'); return; }
      let d = 0;
      for (const it of list) { const r = Game.salvageItem(it.uid); if (r.ok) d += r.dust; }
      toast(`Разобрано вещей: ${list.length}. +${d} пыли`, 'good');
      render();
    },
    useField: el => { const r = Game.useFieldConsumable(el.dataset.id); if (r.ok) { Sfx.heal(); closeModal(); render(); } else if (r.msg) toast(r.msg, 'bad'); },
    toBelt: el => {
      const h = S().hero;
      const i = h.belt.indexOf(null);
      if (i < 0) { toast('На поясе нет места. Сними что-нибудь: нажми на ячейку на поясе.', 'bad'); return; }
      Game.setBelt(i, el.dataset.id);
      closeModal();
      render();
    },
    beltClear: el => { Game.setBelt(+el.dataset.i, null); render(); },

    talent: el => { const r = Game.takeTalent(el.dataset.id); if (r.ok) { Sfx.level(); render(); } },
    loAdd: el => {
      const h = S().hero;
      const i = h.loadout.indexOf(null);
      if (i < 0) { toast('Все четыре ячейки заняты. Сперва убери умение.', 'bad'); return; }
      Game.setLoadout(i, el.dataset.id);
      render();
    },
    loClear: el => { Game.setLoadout(+el.dataset.i, null); render(); },
  };

  function bindEvents() {
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (el && !el.disabled) {
        const fn = ACT[el.dataset.act];
        if (fn) {
          e.preventDefault();
          fn(el);
          return;
        }
      }
      if (e.target.id === 'modal' && !$('modal').dataset.locked) { closeModal(); if (!battle) render(); }
    });
    document.addEventListener('mousemove', e => {
      const el = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (el) showTip(el.dataset.tip, e.clientX, e.clientY);
      else hideTip();
    });
    document.addEventListener('keydown', e => {
      if (e.target && e.target.tagName === 'INPUT') {
        if (e.key === 'Enter' && e.target.id === 'heroName') ACT.begin();
        return;
      }
      if (e.key === 'Escape' && !$('modal').classList.contains('hidden') && !$('modal').dataset.locked) { closeModal(); if (!battle) render(); return; }
      if (!battle || battle.busy) return;
      const c = battle.c;
      const h = S().hero;
      const skills = ['basic_' + h.classId, ...h.loadout.filter(Boolean)];
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= skills.length) { if (Combat.skillState(c, skills[n - 1]).ok) doSkill(skills[n - 1]); }
      else if (n === skills.length + 1 || e.key === 'g' || e.key === 'п') doGuard();
      else if (e.key === 'Tab') {
        e.preventDefault();
        const alive = c.enemies.filter(u => u.hp > 0);
        const idx = alive.findIndex(u => u.key === battle.target);
        if (alive.length) selectTarget(alive[(idx + 1) % alive.length].key);
      }
    });
    window.addEventListener('resize', () => {
      if (battle) return;
      const m = $('worldCanvas'); if (m) Paint.worldMap(m);
      const cc = $('cityCanvas'); if (cc) Paint.cityView(cc, hub().paint);
    });
  }

  function init() {
    bindEvents();
    if (Game.init()) {
      if (S().endingText) LORE.ending.text = S().endingText;
      Sfx.set(S().settings.sound !== false);
      tab = S().expedition ? 'route' : 'map';
    }
    render();
  }

  return { init, render, toast, saveFlash, onLevelUp, get battle() { return battle; } };
})();

UI.init();
