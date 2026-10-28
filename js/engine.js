'use strict';

/* ============================================================
   ПЕПЕЛЬНЫЙ ПРЕДЕЛ — движок
   ============================================================ */

const Game = (() => {
  let state = null;
  let battle = null;
  let uidN = 0;

  /* ---------- утилиты ---------- */
  const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(++uidN).toString(36)}${Math.floor(Math.random() * 999)}`;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round1 = v => Math.round(v * 10) / 10;
  const fmt = n => Math.round(n).toLocaleString('ru-RU');

  function toast(text, type = '') {
    if (typeof UI !== 'undefined' && UI.toast) UI.toast(text, type);
  }
  function fx(name, data) {
    if (typeof UI !== 'undefined' && UI.fx) UI.fx(name, data);
  }
  function saveFlash() {
    if (typeof UI !== 'undefined' && UI.saveFlash) UI.saveFlash();
  }

  /* ---------- создание / загрузка ---------- */
  function newGame(name, classId) {
    const cls = CLASSES[classId] ? classId : 'warrior';
    const cleanName = (name || '').trim().slice(0, 18) || 'Безымянный';
    state = {
      version: GAME_VERSION,
      player: {
        name: cleanName,
        classId: cls,
        level: 1,
        xp: 0,
        gold: 40,
        points: 0,
        attrs: { str: 0, agi: 0, int: 0, vit: 0 },
        equipment: {
          weapon: generateItem(1, 'weapon', 'common'),
          helmet: null, chest: null, gloves: null, boots: null, ring: null, amulet: null,
        },
        inventory: [],
      },
      progress: {
        areaKills: {},
        bosses: {},
        raidClears: 0,
        title: '',
      },
      lore: ['world'],
      npcGifts: {},
      contracts: [],
      shops: {},
      stats: { kills: 0, bossKills: 0, deaths: 0, goldEarned: 0, damageDealt: 0 },
      lastCity: 'pepel',
      settings: { sound: true },
      createdAt: Date.now(),
    };
    addConsumable('potion_small', 2, true);
    for (let i = 0; i < 3; i++) addContract();
    save();
    return true;
  }

  function init() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.player || !CLASSES[data.player.classId]) return false;
      state = data;
      state.player.attrs = Object.assign({ str: 0, agi: 0, int: 0, vit: 0 }, state.player.attrs || {});
      state.player.equipment = Object.assign({ weapon: null, helmet: null, chest: null, gloves: null, boots: null, ring: null, amulet: null }, state.player.equipment || {});
      state.player.inventory = Array.isArray(state.player.inventory) ? state.player.inventory : [];
      state.progress = Object.assign({ areaKills: {}, bosses: {}, raidClears: 0, title: '' }, state.progress || {});
      state.progress.areaKills = state.progress.areaKills || {};
      state.progress.bosses = state.progress.bosses || {};
      state.lore = Array.isArray(state.lore) ? state.lore : ['world'];
      state.contracts = Array.isArray(state.contracts) ? state.contracts : [];
      state.shops = state.shops || {};
      state.npcGifts = state.npcGifts || {};
      state.stats = Object.assign({ kills: 0, bossKills: 0, deaths: 0, goldEarned: 0, damageDealt: 0 }, state.stats || {});
      state.settings = Object.assign({ sound: true }, state.settings || {});
      while (state.contracts.length < 3) addContract();
      return true;
    } catch (e) {
      console.warn('Не удалось загрузить сохранение', e);
      return false;
    }
  }

  function save() {
    if (!state) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      saveFlash();
    } catch (e) {
      console.warn('Не удалось сохранить', e);
    }
  }

  function reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    state = null;
    battle = null;
  }

  /* ---------- характеристики ---------- */
  function getStats() {
    if (!state) return null;
    const p = state.player;
    const cls = CLASSES[p.classId];
    const g = { atk: 0, armor: 0, hp: 0, crit: 0, critDmg: 0, dodge: 0, lifesteal: 0, goldFind: 0, xpFind: 0 };
    for (const slot of SLOTS) {
      const it = p.equipment[slot.id];
      if (!it || !it.stats) continue;
      for (const k in it.stats) if (k in g) g[k] += it.stats[k];
    }
    const a = p.attrs;
    const lvl = p.level;
    const atk = cls.base.atk + (lvl - 1) * cls.growth.atk
      + a.str * cls.attrDmg.str + a.agi * cls.attrDmg.agi + a.int * cls.attrDmg.int
      + g.atk;
    const maxHp = cls.base.hp + (lvl - 1) * cls.growth.hp + a.vit * 9 + a.str * 3 + g.hp;
    const armor = cls.base.armor + (lvl - 1) * cls.growth.armor + a.vit * 0.6 + g.armor;
    const crit = cls.base.crit + a.agi * 0.25 + g.crit;
    const critDmg = 150 + g.critDmg;
    const dodge = Math.min(40, cls.base.dodge + a.agi * 0.2 + g.dodge);
    const energyMax = 100 + a.int * 2;
    const energyRegen = 8 + a.int * 0.08;
    return {
      atk: Math.round(atk), maxHp: Math.round(maxHp), armor: Math.round(armor),
      crit: round1(crit), critDmg: Math.round(critDmg), dodge: round1(dodge),
      lifesteal: round1(g.lifesteal), goldFind: round1(g.goldFind), xpFind: round1(g.xpFind),
      energyMax: Math.round(energyMax), energyRegen: round1(energyRegen),
      attackInterval: Math.max(1.05, 2.15 - a.agi * 0.011 - lvl * 0.008),
    };
  }

  function combatStats() {
    const s = getStats();
    if (!battle) return s;
    let atk = s.atk, armor = s.armor, dodge = s.dodge;
    for (const bf of battle.buffs) {
      if (bf.stat === 'atk') atk *= 1 + bf.pct / 100;
      if (bf.stat === 'armor') armor *= 1 + bf.pct / 100;
      if (bf.stat === 'dodge') dodge += bf.pct;
    }
    return { ...s, atk, armor, dodge: Math.min(60, dodge) };
  }

  function xpNeeded(level) {
    if (level >= MAX_LEVEL) return Infinity;
    return Math.round(50 + level * 25 + level * level * 4);
  }

  function addXp(amount) {
    if (!state) return { gained: 0, levels: 0 };
    const p = state.player;
    const s = getStats();
    const gained = Math.max(1, Math.round(amount * (1 + s.xpFind / 100)));
    p.xp += gained;
    let levels = 0;
    while (p.level < MAX_LEVEL && p.xp >= xpNeeded(p.level)) {
      p.xp -= xpNeeded(p.level);
      p.level++;
      p.points += 2;
      levels++;
      const newSkill = CLASSES[p.classId].skills.find(sk => sk.unlock === p.level);
      toast(`<b>Уровень ${p.level}</b>${newSkill ? ` · открыто умение «${newSkill.name}»` : ''}. Получено 2 очка характеристик.`, 'good');
    }
    if (p.level >= MAX_LEVEL) p.xp = 0;
    if (levels) fx('levelup');
    return { gained, levels };
  }

  function addGold(amount) {
    if (!state || !amount) return;
    const v = Math.round(amount);
    state.player.gold = Math.max(0, state.player.gold + v);
    if (v > 0) state.stats.goldEarned += v;
  }

  /* ---------- предметы ---------- */
  function rollRarity(bossBonus = false) {
    const w = bossBonus
      ? { common: 0, uncommon: 8, rare: 34, epic: 44, legendary: 14 }
      : { common: 48, uncommon: 30, rare: 15, epic: 6, legendary: 1 };
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const k of RARITY_ORDER) {
      r -= w[k];
      if (r <= 0) return k;
    }
    return 'common';
  }

  function rollShopRarity() {
    const w = { common: 34, uncommon: 40, rare: 21, epic: 4, legendary: 1 };
    let r = Math.random() * 100;
    for (const k of RARITY_ORDER) {
      r -= w[k];
      if (r <= 0) return k;
    }
    return 'common';
  }

  function itemValue(item) {
    const ri = RARITY_ORDER.indexOf(item.rarity);
    return Math.max(5, Math.round((12 + item.level * 5) * (1 + ri * 0.55) + Object.keys(item.stats || {}).length * 6));
  }

  function generateItem(level, slotId, rarity) {
    level = clamp(Math.round(level || 1), 1, MAX_LEVEL);
    slotId = slotId || pick(SLOTS).id;
    rarity = RARITIES[rarity] ? rarity : rollRarity();
    const ri = RARITY_ORDER.indexOf(rarity);
    const m = RARITIES[rarity].mult;
    const def = ITEM_BASES[slotId];
    const stats = {};
    const R = Math.round;

    switch (slotId) {
      case 'weapon':
        stats.atk = R((4 + level * 1.95) * m);
        break;
      case 'helmet':
        stats.armor = R((2 + level * 1.05) * m);
        stats.hp = R((6 + level * 4.2) * m);
        break;
      case 'chest':
        stats.armor = R((3 + level * 1.65) * m);
        stats.hp = R((10 + level * 6.5) * m);
        break;
      case 'gloves':
        stats.atk = R((1 + level * 0.58) * m);
        stats.armor = R((1 + level * 0.6) * m);
        break;
      case 'boots':
        stats.armor = R((1 + level * 0.65) * m);
        stats.dodge = round1((1 + level * 0.24) * m);
        break;
      case 'ring':
        stats.atk = R((1.5 + level * 0.5) * m);
        stats.crit = round1((1.5 + level * 0.26) * m);
        break;
      case 'amulet':
        stats.hp = R((8 + level * 5.2) * m);
        stats.armor = R((1 + level * 0.5) * m);
        break;
      default:
        stats.atk = R(2 + level);
    }

    const affixCount = RARITIES[rarity].affixes;
    const pool = AFFIX_POOL.filter(a => !(a.stat in stats));
    for (let i = 0; i < affixCount && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const ax = pool.splice(idx, 1)[0];
      const scale = (0.72 + Math.random() * 0.62) * (1 + ri * 0.07);
      let v = (ax.base + level * ax.per) * scale;
      v = PCT_STATS.has(ax.stat) ? Math.max(1, round1(v)) : Math.max(1, Math.round(v));
      stats[ax.stat] = (stats[ax.stat] || 0) + v;
    }

    const nouns = def.nouns;
    const maxIdx = Math.min(nouns.length - 1, Math.floor((level - 1) / 3.5));
    const noun = nouns[randInt(0, Math.max(0, maxIdx))];
    const suffix = RARITY_SUFFIX[rarity];
    const name = rarity === 'common' ? noun : `${noun} ${suffix}`;

    const item = {
      uid: uid('it'), type: 'gear', slot: slotId, name, baseName: noun,
      icon: def.icon, level, rarity, stats,
    };
    item.value = itemValue(item);
    return item;
  }

  function addItem(item) {
    if (!state) return { ok: false };
    if (item.type === 'consumable') return addConsumable(item.cid, item.qty || 1);
    if (state.player.inventory.length >= INVENTORY_SIZE) {
      const price = Math.round((item.value || 10) * 0.35);
      addGold(price);
      return { ok: false, soldFor: price };
    }
    state.player.inventory.push(item);
    return { ok: true, item };
  }

  function addConsumable(cid, qty = 1, silent = false) {
    if (!state || !CONSUMABLES[cid]) return { ok: false };
    const p = state.player;
    const existing = p.inventory.find(it => it.type === 'consumable' && it.cid === cid);
    if (existing) {
      existing.qty += qty;
    } else {
      if (p.inventory.length >= INVENTORY_SIZE) {
        const price = Math.round(CONSUMABLES[cid].value * 0.35);
        addGold(price);
        return { ok: false, soldFor: price };
      }
      const c = CONSUMABLES[cid];
      p.inventory.push({ uid: uid('cs'), type: 'consumable', cid, name: c.name, icon: c.icon, rarity: c.rarity, qty });
    }
    if (!silent) { /* тихо, чтобы не спамить */ }
    return { ok: true };
  }

  function removeConsumable(uidStr, qty = 1) {
    const inv = state.player.inventory;
    const idx = inv.findIndex(it => it.uid === uidStr);
    if (idx < 0) return false;
    inv[idx].qty -= qty;
    if (inv[idx].qty <= 0) inv.splice(idx, 1);
    return true;
  }

  function equip(itemUid) {
    const p = state.player;
    const idx = p.inventory.findIndex(it => it.uid === itemUid);
    if (idx < 0) return { ok: false, msg: 'Предмет не найден.' };
    const item = p.inventory[idx];
    if (item.type !== 'gear') return { ok: false, msg: 'Это нельзя надеть.' };
    const slot = item.slot;
    const prev = p.equipment[slot];
    p.inventory.splice(idx, 1);
    if (prev) p.inventory.splice(idx, 0, prev);
    p.equipment[slot] = item;
    save();
    return { ok: true, msg: `Надето: ${item.name}` };
  }

  function unequip(slotId) {
    const p = state.player;
    const item = p.equipment[slotId];
    if (!item) return { ok: false, msg: 'Слот пуст.' };
    if (p.inventory.length >= INVENTORY_SIZE) return { ok: false, msg: 'Инвентарь полон.' };
    p.inventory.push(item);
    p.equipment[slotId] = null;
    save();
    return { ok: true };
  }

  function sellItem(itemUid) {
    const p = state.player;
    const idx = p.inventory.findIndex(it => it.uid === itemUid);
    if (idx < 0) return { ok: false };
    const item = p.inventory[idx];
    const price = item.type === 'consumable'
      ? Math.max(1, Math.round(CONSUMABLES[item.cid].value * 0.35 * item.qty))
      : Math.max(1, Math.round((item.value || 10) * 0.35));
    p.inventory.splice(idx, 1);
    addGold(price);
    save();
    return { ok: true, price, name: item.name };
  }

  function useConsumable(itemUid, inBattle = false) {
    if (!state) return { ok: false };
    const p = state.player;
    const item = p.inventory.find(it => it.uid === itemUid);
    if (!item || item.type !== 'consumable') return { ok: false, msg: 'Не найдено.' };
    const c = CONSUMABLES[item.cid];
    if (!battle || !inBattle) {
      return { ok: false, msg: 'Расходники действуют только в бою.' };
    }
    if (inBattle) {
      if (!battle || battle.result) return { ok: false };
      if (c.healPct) {
        const heal = Math.round(battle.maxHp * c.healPct);
        battle.hp = Math.min(battle.maxHp, battle.hp + heal);
        log(`Ты выпиваешь «${c.name}» и восстанавливаешь ${heal} здоровья.`, 'heal');
        fx('healPlayer', { amount: heal });
      }
      if (c.energy) {
        battle.energy = Math.min(battle.maxEnergy, battle.energy + c.energy);
        log(`Настой бодрости возвращает ${c.energy} энергии.`, 'system');
        fx('energy');
      }
      if (c.dmgMult) {
        const dmg = Math.max(1, Math.round(combatStats().atk * c.dmgMult));
        battle.enemy.hp -= dmg;
        log(`Пепельная бомба взрывается: ${fmt(dmg)} урона.`, 'crit');
        fx('hitEnemy', { dmg, crit: true, kind: 'bomb' });
        if (battle.enemy.hp <= 0) { battle.enemy.hp = 0; winBattle(); }
      }
      if (c.buff) {
        battle.buffs.push({ stat: c.buff.stat, pct: c.buff.pct, remaining: c.buff.dur, name: c.name });
        log(`«${c.name}»: +${c.buff.pct}% к атаке на ${c.buff.dur} сек.`, 'good');
        fx('buff');
      }
    }
    removeConsumable(itemUid, 1);
    save();
    return { ok: true };
  }

  function getConsumables() {
    if (!state) return [];
    return state.player.inventory.filter(it => it.type === 'consumable');
  }

  /* ---------- магазины ---------- */
  function ensureShop(merchantId) {
    const m = MERCHANTS.find(x => x.id === merchantId);
    if (!m) return null;
    if (!state.shops[merchantId]) {
      state.shops[merchantId] = buildShop(m);
      save();
    }
    return state.shops[merchantId];
  }

  function buildShop(m) {
    const level = Math.max(m.shopLevel, Math.min(state.player.level, m.shopLevel + 3));
    const stock = [];
    const gearCount = m.types.includes('gear') ? 6 : 0;
    const slotPool = SLOTS.map(s => s.id).sort(() => Math.random() - 0.5).slice(0, gearCount);
    const usedNames = new Set();
    for (const slot of slotPool) {
      let item = null;
      for (let tries = 0; tries < 8; tries++) {
        item = generateItem(level, slot, rollShopRarity());
        if (!usedNames.has(item.name)) break;
      }
      usedNames.add(item.name);
      stock.push({ kind: 'gear', item, price: Math.round(item.value * 1.45) });
    }
    if (m.types.includes('consumable')) {
      const pool = ['potion_small', 'potion_small', 'potion_large', 'elixir_energy', 'elixir_atk', 'bomb'];
      const chosen = [];
      while (chosen.length < 3) {
        const cid = pick(pool);
        if (!chosen.includes(cid)) chosen.push(cid);
      }
      for (const cid of chosen) {
        const c = CONSUMABLES[cid];
        stock.push({ kind: 'consumable', cid, price: Math.round(c.value * 1.3), stock: 3 });
      }
    }
    return { merchantId: m.id, builtAtLevel: level, stock };
  }

  function refreshShop(merchantId) {
    const m = MERCHANTS.find(x => x.id === merchantId);
    if (!m) return { ok: false };
    const cost = 25 + state.player.level * 2;
    if (state.player.gold < cost) return { ok: false, msg: `Нужно ${cost} золота.` };
    addGold(-cost);
    state.shops[merchantId] = buildShop(m);
    save();
    return { ok: true, cost };
  }

  function buyShopItem(merchantId, index) {
    const shop = ensureShop(merchantId);
    if (!shop) return { ok: false };
    const entry = shop.stock[index];
    if (!entry) return { ok: false, msg: 'Товар уже разобрали.' };
    const p = state.player;
    if (p.gold < entry.price) return { ok: false, msg: 'Не хватает золота.' };
    if (entry.kind === 'gear') {
      if (p.inventory.length >= INVENTORY_SIZE) return { ok: false, msg: 'Инвентарь полон.' };
      addGold(-entry.price);
      addItem(entry.item);
      shop.stock.splice(index, 1);
    } else {
      addGold(-entry.price);
      addConsumable(entry.cid, 1);
      entry.stock--;
      if (entry.stock <= 0) shop.stock.splice(index, 1);
    }
    save();
    return { ok: true };
  }

  function shopSellPrice(item) {
    return Math.max(1, Math.round((item.value || 10) * 0.35));
  }

  /* ---------- контракты ---------- */
  function unlockedAreas() {
    return AREAS.filter(a => state && state.player.level >= a.reqLevel);
  }

  function unlockedCities() {
    return CITIES.filter(c => state && state.player.level >= c.reqLevel);
  }

  function addContract() {
    if (!state) return null;
    const pool = unlockedAreas();
    if (!pool.length) return null;
    const area = pick(pool);
    const bossChance = state.player.level >= 4 && Math.random() < 0.28;
    let c;
    if (bossChance) {
      const boss = MOBS[area.boss];
      const used = state.contracts.some(x => x.kind === 'boss' && x.target === boss.id);
      if (!used) {
        c = {
          id: uid('c'), kind: 'boss', target: boss.id, areaId: area.id, icon: '☠',
          title: `Контракт: ${boss.name}`,
          desc: `Локация «${area.name}». Цель: босс ${boss.name}.`,
          need: 1, progress: 0,
          reward: { gold: Math.round(boss.gold * 1.1), xp: Math.round(boss.xp * 0.55), item: true },
        };
      }
    }
    if (!c) {
      const mobs = area.mobs.filter(id => !state.contracts.some(x => x.kind === 'kill' && x.target === id));
      const mobId = mobs.length ? pick(mobs) : pick(area.mobs);
      const mob = MOBS[mobId];
      const need = randInt(4, 8);
      c = {
        id: uid('c'), kind: 'kill', target: mob.id, areaId: area.id, icon: '⚔',
        title: `Зачистка: ${mob.name}`,
        desc: `Локация «${area.name}». Цель: ${mob.name} ×${need}.`,
        need, progress: 0,
        reward: {
          gold: Math.round((mob.gold * need + 18) * 1.3),
          xp: Math.round(mob.xp * need * 0.8),
          item: false,
        },
      };
    }
    state.contracts.push(c);
    return c;
  }

  function claimContract(id) {
    const idx = state.contracts.findIndex(c => c.id === id);
    if (idx < 0) return { ok: false, msg: 'Контракт не найден.' };
    const c = state.contracts[idx];
    if (c.progress < c.need) return { ok: false, msg: 'Контракт ещё не выполнен.' };
    addGold(c.reward.gold);
    const xpRes = addXp(c.reward.xp);
    let lootNote = '';
    if (c.reward.item) {
      const item = generateItem(Math.max(1, state.player.level - 1), null, 'rare');
      const res = addItem(item);
      lootNote = res.ok ? ` Награда: ${item.name}.` : ` Награда продана за ${res.soldFor} золота (инвентарь полон).`;
    }
    state.contracts.splice(idx, 1);
    addContract();
    save();
    return { ok: true, gold: c.reward.gold, xp: xpRes.gained, lootNote, levels: xpRes.levels };
  }

  function refreshContracts() {
    const cost = 25 + state.player.level * 3;
    if (state.player.gold < cost) return { ok: false, msg: `Нужно ${cost} золота.` };
    addGold(-cost);
    state.contracts = [];
    for (let i = 0; i < 3; i++) addContract();
    save();
    return { ok: true };
  }

  /* ---------- НПС ---------- */
  function talkNPC(npcId) {
    const npc = NPCS.find(n => n.id === npcId);
    if (!npc) return { ok: false };
    if (npc.lore) unlockLore(npc.lore);
    save();
    return { ok: true, line: pick(npc.lines), npc };
  }

  function claimGift(npcId) {
    if (!state) return { ok: false };
    const npc = NPCS.find(n => n.id === npcId);
    if (!npc || !npc.gift) return { ok: false };
    if (state.npcGifts[npcId]) return { ok: false, msg: 'Этот подарок уже получен.' };
    state.npcGifts[npcId] = true;
    if (npc.gift.gold) addGold(npc.gift.gold);
    if (npc.gift.consumable) addConsumable(npc.gift.consumable, npc.gift.qty || 1);
    if (npc.lore) unlockLore(npc.lore);
    save();
    return { ok: true, text: npc.giftText };
  }

  /* ---------- лор ---------- */
  function unlockLore(id, silent = false) {
    if (!state || !LORE[id] || state.lore.includes(id)) return false;
    state.lore.push(id);
    if (!silent) toast(`Кодекс: открыта запись «${LORE[id].title}»`, 'good');
    save();
    return true;
  }

  function visitCity(cityId) {
    const city = CITIES.find(c => c.id === cityId);
    if (!city || state.player.level < city.reqLevel) return { ok: false };
    state.lastCity = cityId;
    if (city.lore) unlockLore(city.lore);
    save();
    return { ok: true };
  }

  function titleOfPlayer() {
    if (!state) return '';
    return state.progress.title || '';
  }

  /* ---------- бой ---------- */
  function areaKills(areaId) {
    return (state.progress.areaKills[areaId] || 0);
  }

  function isAreaUnlocked(areaId) {
    const a = AREAS.find(x => x.id === areaId);
    return !!a && state.player.level >= a.reqLevel;
  }

  function isCityUnlocked(cityId) {
    const c = CITIES.find(x => x.id === cityId);
    return !!c && state.player.level >= c.reqLevel;
  }

  function bossUnlocked(areaId) {
    const area = AREAS.find(a => a.id === areaId);
    if (!area) return false;
    if (!isAreaUnlocked(areaId)) return false;
    return areaKills(areaId) >= area.killsForBoss;
  }

  function raidUnlocked() {
    return state && state.player.level >= RAID.reqLevel
      && (state.progress.bosses[RAID.requiresBoss] || 0) > 0;
  }

  function makeEnemy(mobId, mul = 1) {
    const def = MOBS[mobId];
    if (!def) return null;
    const hp = Math.round(def.hp * mul);
    const atk = +(def.atk * (1 + (mul - 1) * 0.55)).toFixed(1);
    const armor = Math.round(def.armor * (1 + (mul - 1) * 0.45));
    return {
      id: def.id, name: def.name, lvl: def.lvl, shape: def.shape, icon: def.icon,
      tint: def.tint, accent: def.accent, boss: !!def.boss,
      size: def.size || 1, maxHp: hp, hp,
      atk, armor, xp: Math.round(def.xp * mul), gold: Math.round(def.gold * mul),
      skills: def.skills || [], def,
      mul,
    };
  }

  function startHunt(areaId, requestedMobId) {
    if (battle && !battle.result) return { ok: false, msg: 'Сначала заверши текущий бой.' };
    const area = AREAS.find(a => a.id === areaId);
    if (!area) return { ok: false };
    if (state.player.level < area.reqLevel) return { ok: false, msg: 'Уровень слишком низок.' };
    const mobId = requestedMobId && area.mobs.includes(requestedMobId) ? requestedMobId : pick(area.mobs);
    return startBattle(mobId, { type: 'normal', areaId });
  }

  function startBoss(areaId) {
    if (battle && !battle.result) return { ok: false, msg: 'Сначала заверши текущий бой.' };
    const area = AREAS.find(a => a.id === areaId);
    if (!area) return { ok: false };
    if (!isAreaUnlocked(areaId)) return { ok: false, msg: 'Локация ещё закрыта.' };
    if (!bossUnlocked(areaId)) return { ok: false, msg: `Нужно победить ${area.killsForBoss} мобов в локации.` };
    return startBattle(area.boss, { type: 'boss', areaId });
  }

  function startRaid() {
    if (battle && !battle.result) return { ok: false, msg: 'Сначала заверши текущий бой.' };
    if (state.player.level < RAID.reqLevel) return { ok: false, msg: `Нужен ${RAID.reqLevel}-й уровень.` };
    if (!(state.progress.bosses[RAID.requiresBoss] || 0)) return { ok: false, msg: 'Сначала победи Стража Врат.' };
    if (state.player.gold < RAID.entryGold) return { ok: false, msg: `Нужно ${RAID.entryGold} золота на снаряжение.` };
    addGold(-RAID.entryGold);
    const wave = RAID.waves[0];
    const res = startBattle(wave.id, { type: 'raid', raidIndex: 0, mul: wave.mul });
    log(`Рейд «Сердце Хмари» начат. Волна 1: ${wave.label}.`, 'system');
    save();
    return res;
  }

  function startBattle(mobId, opts = {}) {
    const e = makeEnemy(mobId, opts.mul || 1);
    if (!e) return { ok: false };
    const s = getStats();
    battle = {
      type: opts.type || 'normal',
      areaId: opts.areaId || (opts.type === 'raid' ? 'heart_of_mist' : null),
      raidIndex: opts.raidIndex ?? null,
      enemy: e,
      hp: opts.startHp != null ? clamp(opts.startHp, 1, s.maxHp) : s.maxHp,
      maxHp: s.maxHp,
      energy: s.energyMax,
      maxEnergy: s.energyMax,
      attackTimer: Math.min(1.0, s.attackInterval),
      enemyTimer: 1.7,
      enemySkillCds: {},
      cooldowns: {},
      buffs: [],
      dots: [],
      shield: 0,
      shieldTimer: 0,
      playerStun: 0,
      enemyBuffs: [],
      enemyDots: [],
      enemyStun: 0,
      enemyWindup: null,
      enraged: false,
      stormTimer: 8,
      logs: [],
      result: null,
      auto: false,
      autoTimer: 0,
      autoPotionCd: 0,
      startedAt: Date.now(),
    };
    for (const sk of e.skills) battle.enemySkillCds[sk.name] = 3;
    const areaName = opts.type === 'raid' ? RAID.name : (AREAS.find(a => a.id === opts.areaId)?.name || 'Предел');
    log(`Бой начался: ${e.name} (ур. ${e.lvl}) · ${areaName}.`, 'system');
    if (e.boss) log('Это босс. Отступить не получится.', 'bad');
    save();
    return { ok: true };
  }

  function nextRaidWave() {
    if (!battle || !battle.result || !battle.result.wave) return { ok: false };
    const nextIdx = battle.result.nextIndex;
    const wave = RAID.waves[nextIdx];
    if (!wave) return { ok: false };
    const carryHp = Math.min(getStats().maxHp, battle.hp + Math.round(getStats().maxHp * 0.25));
    const res = startBattle(wave.id, { type: 'raid', raidIndex: nextIdx, mul: wave.mul, startHp: carryHp });
    log(`Волна ${nextIdx + 1}: ${wave.label}. Ты восстанавливаешь часть сил.`, 'system');
    save();
    return res;
  }

  function enemyInterval() {
    return (battle.enemy.boss ? 2.35 : 2.0) + Math.random() * 0.25;
  }

  function log(text, cls = '') {
    if (!battle) return;
    const entry = { t: Date.now() - battle.startedAt, text, cls };
    battle.logs.push(entry);
    if (battle.logs.length > 80) battle.logs.shift();
    if (typeof UI !== 'undefined' && UI.onLog) UI.onLog(entry);
  }

  function damageEnemy(mult, opts = {}) {
    if (!battle || battle.result) return 0;
    const b = battle;
    const s = combatStats();
    const critChance = s.crit + (opts.critBonus || 0);
    const crit = !!opts.guaranteedCrit || Math.random() * 100 < critChance;
    const raw = s.atk * mult * (0.92 + Math.random() * 0.16) * (crit ? s.critDmg / 100 : 1);
    let dmg;
    if (opts.ignoreArmor) {
      dmg = Math.max(1, Math.round(raw));
    } else {
      const mit = Math.min(0.65, b.enemy.armor / (b.enemy.armor + 55 + b.enemy.lvl * 4));
      dmg = Math.max(1, Math.round(raw * (1 - mit)));
    }
    b.enemy.hp -= dmg;
    state.stats.damageDealt += dmg;
    fx('hitEnemy', { dmg, crit, kind: opts.kind || 'melee' });
    if (s.lifesteal > 0) {
      const heal = Math.max(1, Math.round(dmg * s.lifesteal / 100));
      b.hp = Math.min(b.maxHp, b.hp + heal);
      fx('healPlayer', { amount: heal, quiet: true });
    }
    if (b.enemy.hp <= 0) {
      b.enemy.hp = 0;
      winBattle();
    }
    return dmg;
  }

  function damagePlayer(raw, opts = {}) {
    if (!battle || battle.result) return 0;
    const b = battle;
    const s = combatStats();
    b.lastDodged = false;
    if (!opts.unavoidable && Math.random() * 100 < s.dodge) {
      b.lastDodged = true;
      log('Ты уходишь от удара.', 'good');
      fx('dodge', { target: 'player' });
      return 0;
    }
    const mit = Math.min(0.7, s.armor / (s.armor + 60 + s.level * 4));
    let dmg = Math.max(1, Math.round(raw * (1 - mit)));
    if (b.shield > 0) {
      const absorbed = Math.min(b.shield, dmg);
      b.shield -= absorbed;
      dmg -= absorbed;
      if (absorbed > 0) {
        fx('shieldHit', { amount: absorbed });
        log(`Щит поглощает ${fmt(absorbed)} урона.`, 'good');
      }
      if (b.shield <= 0) { b.shield = 0; b.shieldTimer = 0; }
    }
    if (dmg > 0) {
      b.hp -= dmg;
      fx('hitPlayer', { dmg, crit: !!opts.crit });
    }
    return dmg;
  }

  function playerAutoAttack() {
    const b = battle;
    if (!b || b.result || b.enemy.hp <= 0) return;
    fx('playerAttack', { kind: 'melee' });
    const dmg = damageEnemy(1.0, { kind: 'melee' });
    if (b.result) return;
    log(`Ты наносишь ${fmt(dmg)} урона.`, 'hit');
  }

  function useSkill(skillId) {
    if (!battle || battle.result) return { ok: false };
    const b = battle;
    const p = state.player;
    const cls = CLASSES[p.classId];
    const skill = cls.skills.find(sk => sk.id === skillId);
    if (!skill) return { ok: false };
    if (p.level < skill.unlock) return { ok: false, msg: 'Умение ещё не открыто.' };
    if (b.playerStun > 0) return { ok: false, msg: 'Ты оглушён.' };
    if ((b.cooldowns[skillId] || 0) > 0.05) return { ok: false };
    if (b.energy < skill.cost) return { ok: false, msg: 'Не хватает энергии.' };
    b.energy -= skill.cost;
    b.cooldowns[skillId] = skill.cd;
    fx('skill', { skill, cls: p.classId });
    log(`Ты применяешь «${skill.name}».`, 'system');

    if (skill.type === 'strike') {
      const hits = skill.hits || 1;
      for (let i = 0; i < hits; i++) {
        if (b.result) break;
        let mult = skill.mult;
        if (skill.exec && b.enemy.hp / b.enemy.maxHp <= 0.3) mult = skill.exec;
        const crit = !!skill.guaranteedCrit;
        const dmg = damageEnemy(mult, { kind: 'skill', guaranteedCrit: crit });
        if (!b.result) log(`«${skill.name}»: ${fmt(dmg)} урона${crit ? ' (крит!)' : ''}.`, crit ? 'crit' : 'hit');
      }
      if (skill.dot && !b.result) {
        const dps = Math.max(1, Math.round(combatStats().atk * skill.dot.dpsPct));
        b.enemyDots.push({ kind: skill.dot.kind, dps, remaining: skill.dot.dur, tick: 1 });
        fx('dot', { kind: skill.dot.kind });
        log(`${dotName(skill.dot.kind)} охватывает врага (${dps}/сек, ${skill.dot.dur} сек).`, 'dot');
      }
      if (skill.stun && !b.result) {
        b.enemyStun = Math.max(b.enemyStun, skill.stun);
        if (b.enemyWindup) { b.enemyWindup = null; log('Враг сбит с замаха.', 'good'); }
        log(`Враг оглушён на ${skill.stun} сек.`, 'good');
      }
    } else if (skill.type === 'dot') {
      const dmg = damageEnemy(skill.mult, { kind: 'skill' });
      if (!b.result) log(`Отравленный клинок: ${fmt(dmg)} урона.`, 'hit');
      if (skill.dot && !b.result) {
        const dps = Math.max(1, Math.round(combatStats().atk * skill.dot.dpsPct));
        b.enemyDots.push({ kind: skill.dot.kind, dps, remaining: skill.dot.dur, tick: 1 });
        fx('dot', { kind: skill.dot.kind });
        log(`Яд действует: ${dps}/сек, ${skill.dot.dur} сек.`, 'dot');
      }
    } else if (skill.type === 'buff') {
      b.buffs.push({ stat: skill.buff.stat, pct: skill.buff.pct, remaining: skill.buff.dur, name: skill.name });
      fx('buff');
      log(buffText(skill.buff), 'good');
    } else if (skill.type === 'shield') {
      const amount = Math.round(b.maxHp * skill.shieldPct);
      b.shield = Math.max(b.shield, amount);
      b.shieldTimer = skill.dur;
      if (skill.buff) b.buffs.push({ stat: skill.buff.stat, pct: skill.buff.pct, remaining: skill.buff.dur, name: skill.name });
      fx('shield', { amount });
      log(`Щит поглощает до ${fmt(amount)} урона, ${skill.dur} сек.`, 'good');
    }
    return { ok: true };
  }

  function dotName(kind) {
    return kind === 'burn' ? 'Пламя' : kind === 'poison' ? 'Яд' : 'Кровотечение';
  }
  function buffText(buff) {
    if (buff.stat === 'atk') return `Атака повышена на ${buff.pct}% на ${buff.dur} сек.`;
    if (buff.stat === 'armor') return `Броня повышена на ${buff.pct}% на ${buff.dur} сек.`;
    if (buff.stat === 'dodge') return `Уклонение повышено на ${buff.pct}% на ${buff.dur} сек.`;
    return `Эффект на ${buff.dur} сек.`;
  }

  function startEnemyWindup(skill) {
    battle.enemyWindup = {
      name: skill.name, warn: skill.warn || 'Враг готовит удар…',
      total: skill.windup, remaining: skill.windup, skill,
    };
    battle.enemySkillCds[skill.name] = skill.cd;
    fx('enemyWindup', { name: skill.name, warn: battle.enemyWindup.warn, total: skill.windup });
    log(skill.warn || 'Враг готовит удар.', 'enemy');
  }

  function executeEnemySkill(ws) {
    const b = battle;
    const sk = ws.skill;
    fx('enemySkill', { name: sk.name, skill: sk });
    log(`${b.enemy.name} применяет «${sk.name}»!`, 'enemy');
    let dmg = 0;
    if (sk.mult > 0) {
      const raw = b.enemy.atk * sk.mult * (0.92 + Math.random() * 0.16) * enemyAtkMul();
      dmg = damagePlayer(raw);
      if (dmg > 0) log(`Ты получаешь ${fmt(dmg)} урона.`, 'bad');
    }
    if (sk.effect === 'bleed' || sk.effect === 'poison' || sk.effect === 'burn') {
      const dps = Math.max(1, sk.dps || Math.round(b.enemy.atk * 0.18));
      b.dots.push({ kind: sk.effect, dps, remaining: sk.dur || 4, tick: 1 });
      log(`${dotName(sk.effect)}: ${dps}/сек, ${sk.dur || 4} сек.`, 'dot');
    }
    if (sk.effect === 'stun') {
      b.playerStun = Math.max(b.playerStun, sk.dur || 0.8);
      log(`Ты оглушён на ${((sk.dur || 0.8)).toFixed(1)} сек.`, 'bad');
    }
    if (sk.effect === 'buff') {
      b.enemyBuffs.push({ pct: sk.buffPct || 25, remaining: sk.dur || 7, name: sk.name });
      log(`${b.enemy.name} усиливается (+${sk.buffPct || 25}% атаки).`, 'enemy');
    }
    if (sk.effect === 'heal') {
      const heal = Math.round(b.enemy.maxHp * (sk.healPct || 0.12));
      b.enemy.hp = Math.min(b.enemy.maxHp, b.enemy.hp + heal);
      log(`${b.enemy.name} восстанавливает ${fmt(heal)} здоровья.`, 'enemy');
      fx('healEnemy', { amount: heal });
    }
    if (sk.effect === 'lifesteal' && dmg > 0) {
      const heal = Math.round(dmg * (sk.healPct || 0.25));
      b.enemy.hp = Math.min(b.enemy.maxHp, b.enemy.hp + heal);
      log(`${b.enemy.name} забирает часть твоей памяти и лечится на ${fmt(heal)}.`, 'enemy');
      fx('healEnemy', { amount: heal });
    }
  }

  function enemyAtkMul() {
    let m = 1;
    for (const bf of battle.enemyBuffs) m += bf.pct / 100;
    return m;
  }

  function enemyNormalAttack() {
    const b = battle;
    fx('enemyAttack');
    const raw = b.enemy.atk * (0.9 + Math.random() * 0.2) * enemyAtkMul();
    const dmg = damagePlayer(raw);
    if (dmg > 0) log(`${b.enemy.name} бьёт тебя на ${fmt(dmg)}.`, 'enemy');
  }

  function tickEnemy(dt) {
    const b = battle;
    if (!b || b.result) return;
    if (b.enemy.hp <= 0) return;
    for (const name in b.enemySkillCds) b.enemySkillCds[name] = Math.max(0, b.enemySkillCds[name] - dt);

    if (b.enemyStun > 0) {
      b.enemyStun = Math.max(0, b.enemyStun - dt);
      return;
    }

    if (b.enemyWindup) {
      b.enemyWindup.remaining -= dt;
      if (b.enemyWindup.remaining <= 0) {
        const ws = b.enemyWindup;
        b.enemyWindup = null;
        executeEnemySkill(ws);
        b.enemyTimer = enemyInterval();
        if (b.hp <= 0) loseBattle();
      }
      return;
    }

    b.enemyTimer -= dt;
    if (b.enemyTimer > 0) return;
    const ready = b.enemy.skills.filter(sk => (b.enemySkillCds[sk.name] || 0) <= 0);
    if (ready.length && Math.random() < (b.enemy.boss ? 0.68 : 0.5)) {
      startEnemyWindup(pick(ready));
      return;
    }
    enemyNormalAttack();
    b.enemyTimer = enemyInterval();
    if (b.hp <= 0) loseBattle();
  }

  function tickPlayer(dt) {
    const b = battle;
    if (!b || b.result) return;
    if (b.playerStun > 0) { b.playerStun = Math.max(0, b.playerStun - dt); }
    b.attackTimer -= dt;
    if (b.attackTimer <= 0) {
      b.attackTimer = combatStats().attackInterval;
      if (b.playerStun <= 0) playerAutoAttack();
    }

    if (b.auto) {
      b.autoTimer -= dt;
      if (b.autoTimer <= 0) {
        b.autoTimer = 0.55;
        if (b.playerStun <= 0) {
          const skills = CLASSES[state.player.classId].skills
            .filter(sk => state.player.level >= sk.unlock)
            .filter(sk => (b.cooldowns[sk.id] || 0) <= 0.05 && b.energy >= sk.cost);
          if (skills.length) useSkill(pick(skills).id);
        }
        b.autoPotionCd -= dt;
        if (b.hp < b.maxHp * 0.33 && b.autoPotionCd <= 0) {
          const potion = getConsumables().find(it => {
            const c = CONSUMABLES[it.cid];
            return c && c.healPct;
          });
          if (potion) { useConsumable(potion.uid, true); b.autoPotionCd = 3.5; }
        }
      }
    }
  }

  function tickStatuses(dt) {
    const b = battle;
    if (!b || b.result) return;
    // баффы
    for (let i = b.buffs.length - 1; i >= 0; i--) {
      b.buffs[i].remaining -= dt;
      if (b.buffs[i].remaining <= 0) b.buffs.splice(i, 1);
    }
    for (let i = b.enemyBuffs.length - 1; i >= 0; i--) {
      b.enemyBuffs[i].remaining -= dt;
      if (b.enemyBuffs[i].remaining <= 0) b.enemyBuffs.splice(i, 1);
    }
    if (b.shield > 0) {
      b.shieldTimer -= dt;
      if (b.shieldTimer <= 0) { b.shield = 0; b.shieldTimer = 0; }
    }
    // доты по врагу
    for (let i = b.enemyDots.length - 1; i >= 0; i--) {
      const d = b.enemyDots[i];
      d.remaining -= dt;
      d.tick -= dt;
      if (d.tick <= 0) {
        d.tick += 1;
        if (!b.result && b.enemy.hp > 0) {
          const dd = Math.max(1, Math.round(d.dps));
          b.enemy.hp -= dd;
          fx('dotHit', { target: 'enemy', kind: d.kind, dmg: dd });
          log(`${dotName(d.kind)}: ${fmt(dd)} урона.`, 'dot');
          if (b.enemy.hp <= 0) { b.enemy.hp = 0; winBattle(); }
        }
      }
      if (d.remaining <= 0) b.enemyDots.splice(i, 1);
    }
    // доты по игроку
    for (let i = b.dots.length - 1; i >= 0; i--) {
      const d = b.dots[i];
      d.remaining -= dt;
      d.tick -= dt;
      if (d.tick <= 0) {
        d.tick += 1;
        if (!b.result) {
          b.hp -= d.dps;
          fx('dotHit', { target: 'player', kind: d.kind, dmg: d.dps });
          log(`${dotName(d.kind)}: ${fmt(d.dps)} урона.`, 'dot');
          if (b.hp <= 0) loseBattle();
        }
      }
      if (d.remaining <= 0) b.dots.splice(i, 1);
    }
    // пепельная буря в рейде
    if (b.type === 'raid' && !b.result) {
      b.stormTimer -= dt;
      if (b.stormTimer <= 0) {
        b.stormTimer = 8;
        const dmg = Math.max(1, Math.round(b.maxHp * 0.02));
        b.hp -= dmg;
        log(`Пепельная буря обжигает: ${fmt(dmg)} урона.`, 'bad');
        fx('storm', { dmg });
        if (b.hp <= 0) loseBattle();
      }
    }
  }

  function tick(dt) {
    if (!battle || battle.result) return;
    dt = Math.min(dt, 0.2);
    const b = battle;
    b.energy = Math.min(b.maxEnergy, b.energy + combatStats().energyRegen * dt);
    for (const id in b.cooldowns) b.cooldowns[id] = Math.max(0, b.cooldowns[id] - dt);
    tickPlayer(dt);
    if (b.result) return;
    tickEnemy(dt);
    if (b.result) return;
    tickStatuses(dt);
    if (b.result) return;

    if (b.enemy.boss && !b.enraged && b.enemy.hp / b.enemy.maxHp < 0.35) {
      b.enraged = true;
      b.enemyBuffs.push({ pct: 20, remaining: 9999, name: 'Ярость' });
      log(`${b.enemy.name} впадает в ярость! Атака возрастает.`, 'bad');
      fx('enrage');
    }
  }

  /* ---------- исход боя ---------- */
  function grantLoot(item) {
    const res = addItem(item);
    const entry = {
      name: item.name, icon: item.icon, rarity: item.rarity, qty: 1,
    };
    if (item.type === 'consumable') entry.qty = item.qty || 1;
    if (res.soldFor) entry.soldFor = res.soldFor;
    return entry;
  }

  function makeLoot(def, type) {
    const items = [];
    if (type === 'raid') {
      items.push(generateItem(def.lvl, 'weapon', 'legendary'));
      items.push(generateItem(def.lvl, null, 'epic'));
      items.push(generateItem(def.lvl, null, 'epic'));
      return items.map(grantLoot);
    }
    if (def.boss) {
      items.push(generateItem(def.lvl + 1, null, 'epic'));
      items.push(generateItem(def.lvl + 1, null, rollRarity(true)));
      if (Math.random() < 0.35) items.push(generateItem(def.lvl + 1, null, rollRarity(true)));
      return items.map(grantLoot);
    }
    if (Math.random() < (def.dropChance || 0.28)) {
      items.push(generateItem(def.lvl, null, rollRarity()));
    }
    if (Math.random() < 0.14) {
      const cid = pick(['potion_small', 'potion_small', 'potion_large', 'elixir_energy', 'bomb']);
      const c = CONSUMABLES[cid];
      addConsumable(cid, 1);
      items.push({ name: c.name, icon: c.icon, rarity: c.rarity, qty: 1 });
    }
    return items;
  }

  function trackKill(enemy) {
    const p = state.player;
    state.stats.kills++;
    if (enemy.boss) state.stats.bossKills++;
    const area = AREAS.find(a => a.id === battle.areaId);
    if (area) state.progress.areaKills[area.id] = (state.progress.areaKills[area.id] || 0) + 1;
    if (enemy.boss) {
      state.progress.bosses[enemy.id] = (state.progress.bosses[enemy.id] || 0) + 1;
      if (enemy.def && enemy.def.lore) unlockLore(enemy.def.lore);
    }
    for (const c of state.contracts) {
      if (c.target === enemy.id && c.progress < c.need) {
        c.progress++;
        if (c.progress >= c.need) toast(`Контракт выполнен: «${c.title}». Забери награду на доске.`, 'good');
      }
    }
  }

  function winBattle() {
    const b = battle;
    if (!b || b.result) return;
    if (b.type === 'raid' && b.raidIndex < RAID.waves.length - 1) {
      const nextIdx = b.raidIndex + 1;
      b.result = {
        win: true, wave: true, title: 'Волна пройдена',
        subtitle: `Следующая волна: ${RAID.waves[nextIdx].label}`,
        nextIndex: nextIdx, carryHp: b.hp,
      };
      log('Волна пройдена. Пепел на мгновение стихает.', 'good');
      fx('victory');
      save();
      return;
    }

    const def = b.enemy.def;
    const s = getStats();
    const isRaid = b.type === 'raid';
    let gold = Math.round(b.enemy.gold * (1 + s.goldFind / 100));
    let xpAmount = b.enemy.xp;
    if (isRaid) {
      gold += RAID.rewardGold;
      xpAmount += RAID.rewardXp;
    }
    const items = makeLoot(def, b.type);
    trackKill(b.enemy);
    if (isRaid) {
      const first = !state.progress.raidClears;
      state.progress.raidClears++;
      state.progress.title = 'Погасивший Хор';
      unlockLore('queen');
      if (first) toast('<b>Рейд пройден.</b> Ты погасил Хор и получил титул «Погасивший Хор».', 'good');
    }
    const xpRes = addXp(xpAmount);
    addGold(gold);
    b.result = {
      win: true,
      title: isRaid ? 'Хор погашен' : (b.enemy.boss ? 'Босс повержен' : 'Победа'),
      subtitle: b.enemy.name,
      gold, xp: xpRes.gained, items,
      levels: xpRes.levels,
      raidClear: isRaid,
      boss: !!b.enemy.boss,
    };
    log(isRaid ? 'Песня обрывается. В Сердце Хмари наступает тишина.' : 'Противник падает.', 'good');
    fx('victory');
    save();
  }

  function loseBattle() {
    const b = battle;
    if (!b || b.result) return;
    const lost = Math.round(state.player.gold * 0.1);
    state.player.gold = Math.max(0, state.player.gold - lost);
    state.stats.deaths++;
    b.hp = 0;
    b.result = {
      win: false, title: 'Пепел взял своё', subtitle: b.enemy.name,
      goldLost: lost, tip: 'Ты очнулся в последнем городе. Снаряжение и опыт остались при тебе.',
    };
    log('Тьма смыкается. Ты проигрываешь бой.', 'bad');
    fx('death');
    save();
  }

  function flee() {
    if (!battle || battle.result) return { ok: false };
    if (battle.type !== 'normal') return { ok: false, msg: 'Из этого боя нельзя отступить.' };
    if (Math.random() < 0.7) {
      battle.result = {
        win: false, fled: true, title: 'Отступление',
        subtitle: 'Ты уходишь в пепел, не оглядываясь.', goldLost: 0,
      };
      log('Ты отступаешь.', 'system');
      save();
      return { ok: true };
    }
    log('Не удалось сбежать!', 'bad');
    battle.enemyTimer = 0;
    return { ok: false, msg: 'Не удалось сбежать!' };
  }

  function leaveBattle() {
    battle = null;
  }

  function toggleAuto() {
    if (!battle) return false;
    battle.auto = !battle.auto;
    log(battle.auto ? 'Автобой включён.' : 'Автобой выключен.', 'system');
    return battle.auto;
  }

  /* ---------- характеристики: очки ---------- */
  function spendPoint(stat) {
    if (!state) return { ok: false };
    if (!['str', 'agi', 'int', 'vit'].includes(stat)) return { ok: false };
    if (state.player.points <= 0) return { ok: false, msg: 'Нет свободных очков.' };
    state.player.points--;
    state.player.attrs[stat]++;
    save();
    return { ok: true };
  }

  /* ---------- экспорт ---------- */
  return {
    get state() { return state; },
    get battle() { return battle; },
    init, newGame, reset, save, load: init,
    getStats, combatStats, xpNeeded, addXp, addGold,
    generateItem, rollRarity, itemValue, addItem, addConsumable, getConsumables,
    equip, unequip, sellItem, useConsumable, shopSellPrice,
    ensureShop, refreshShop, buyShopItem,
    talkNPC, claimGift, visitCity, unlockLore, titleOfPlayer,
    isAreaUnlocked, isCityUnlocked, bossUnlocked, raidUnlocked, areaKills, unlockedAreas, unlockedCities,
    startHunt, startBoss, startRaid, nextRaidWave, useSkill, tick, flee, leaveBattle, toggleAuto,
    claimContract, refreshContracts, addContract,
    spendPoint, raid: RAID,
  };
})();
