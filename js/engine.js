'use strict';

/* ============================================================
   ИГРОВОЕ СОСТОЯНИЕ: герой, вещи, вылазки, задания, сохранение
   ============================================================ */

const Game = (() => {
  let state = null;
  let uidN = 0;

  const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(++uidN).toString(36)}`;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round1 = v => Math.round(v * 10) / 10;

  function notify(text, type = '') { if (typeof UI !== 'undefined' && UI.toast) UI.toast(text, type); }

  /* ---------- новая игра и сохранения ---------- */
  function newGame(name, classId) {
    const cls = CLASSES[classId] || CLASSES.warrior;
    state = {
      version: GAME_VERSION,
      hero: {
        name: (name || '').trim().slice(0, 18) || 'Безымянный',
        classId: cls.id, level: 1, xp: 0, gold: 30, dust: 0,
        attrs: Object.assign({}, cls.attrs), attrPoints: 0,
        talents: [], talentPoints: 1,
        loadout: [cls.start[0], cls.start[1], null, null],
        equipment: { weapon: null, offhand: null, helmet: null, chest: null, gloves: null, boots: null, ring: null, amulet: null },
        inventory: [], belt: ['potion_small', null, null], hp: 1,
        runes: [], runeCircle: [], mastery: {},
      },
      flags: {}, quests: {}, lore: ['world', 'pepel'], names: 0, namesRead: 0, cleared: {}, kills: {}, bossKills: {},
      beacon: 0, contracts: [], shops: {}, expedition: null, grave: null, seen: {},
      stats: { kills: 0, deaths: 0, runs: 0, bosses: 0, goldEarned: 0, crits: 0 },
      place: 'city', settings: { sound: true, speed: 1 }, createdAt: Date.now(),
    };
    const h = state.hero;
    h.equipment.weapon = generateItem(1, 'weapon', 'common', { family: cls.weapon, tier: 0 });
    if (cls.offhand) h.equipment.offhand = generateItem(1, 'offhand', 'common', { family: cls.offhand, tier: 0 });
    h.equipment.chest = generateItem(1, 'chest', 'common', { kind: cls.id === 'warrior' ? 'mail' : cls.scale === 'wil' ? 'robe' : 'leather', tier: 0 });
    addConsumable('potion_small', 3);
    addConsumable('bandage', 1);
    h.hp = heroStats().maxHp;
    refreshContracts(true);
    save();
    return true;
  }

  function init() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.hero || !CLASSES[data.hero.classId]) return false;
      state = data;
      const dh = state.hero;
      dh.runes = dh.runes || [];
      dh.runeCircle = dh.runeCircle || [];
      dh.mastery = dh.mastery || {};
      pruneBelt();
      autoStartQuests();
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
      if (typeof UI !== 'undefined' && UI.saveFlash) UI.saveFlash();
    } catch (e) { console.warn('Не удалось сохранить', e); }
  }

  function reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    state = null;
  }

  /* ---------- характеристики ---------- */
  function mergeMods(into, m) {
    for (const k in m) {
      if (k === 'vsStatus') {
        into.vsStatus = into.vsStatus || {};
        for (const s in m.vsStatus) into.vsStatus[s] = (into.vsStatus[s] || 0) + m.vsStatus[s];
      } else if (k === 'lowHpDmg') {
        if (!into.lowHpDmg || m.lowHpDmg.pct > into.lowHpDmg.pct) into.lowHpDmg = m.lowHpDmg;
      } else {
        into[k] = (into[k] || 0) + m[k];
      }
    }
  }
  function mergeOn(into, on) {
    for (const k in on) into[k] = (into[k] || []).concat(on[k]);
  }

  function heroStats(hero) {
    const h = hero || state.hero;
    const cls = CLASSES[h.classId];
    const attrs = Object.assign({}, h.attrs);
    const g = {};
    const mods = {}, on = {}, flags = {};

    for (const slot of SLOTS) {
      const it = h.equipment[slot.id];
      if (!it) continue;
      const stats = itemStats(it);
      for (const k in stats) g[k] = (g[k] || 0) + stats[k];
      if (it.traits) for (const t of it.traits) {
        const tr = TRAITS[t];
        if (tr) { if (tr.mods) mergeMods(mods, tr.mods); if (tr.on) mergeOn(on, tr.on); }
      }
      if (it.unique) {
        const u = UNIQUES[it.unique];
        if (u.mods) mergeMods(mods, u.mods);
        if (u.on) mergeOn(on, u.on);
        if (u.flags) Object.assign(flags, u.flags);
      }
    }
    for (const a of ['str', 'agi', 'wil', 'vit']) attrs[a] = (attrs[a] || 0) + (g[a] || 0);
    for (const id of h.talents) {
      const t = TALENTS[id];
      if (!t) continue;
      if (t.mods) mergeMods(mods, t.mods);
      if (t.on) mergeOn(on, t.on);
      if (t.flags) Object.assign(flags, t.flags);
    }

    // рунный круг и созвучия
    const applyBonus = b => {
      if (b.stats) for (const k in b.stats) g[k] = (g[k] || 0) + b.stats[k];
      if (b.mods) mergeMods(mods, b.mods);
      if (b.on) mergeOn(on, b.on);
      if (b.flags) Object.assign(flags, b.flags);
    };
    const circle = (h.runeCircle || []).map(uid => (h.runes || []).find(r => r.uid === uid)).filter(Boolean);
    for (const r of circle) applyBonus(RUNES[r.id].levels[r.level - 1]);
    const ids = circle.map(r => r.id);
    for (const w of RUNE_WORDS) if (w.runes.every(id => ids.includes(id))) applyBonus(w);
    for (const id in (h.mastery || {})) {
      const m = MASTERY[id];
      if (m) for (const k in m.per) mods[k] = (mods[k] || 0) + m.per[k] * h.mastery[id];
    }

    const weapon = h.equipment.weapon;
    const wScale = weapon && WEAPONS[weapon.family] ? WEAPONS[weapon.family].scale : cls.scale;
    const wDmg = g.dmg || 3;
    const power = wDmg + attrs[wScale] * 0.5 + attrs[cls.scale] * 0.4 + h.level * 0.5;
    const maxHp = (cls.baseHp + attrs.vit * 8 + attrs.str * 2 + (h.level - 1) * 10 + (g.hp || 0)) * (1 + (mods.hpPct || 0) / 100);
    const armor = (cls.armor + attrs.vit * 0.5 + (g.armor || 0)) * (1 + (mods.armorPct || 0) / 100);
    const res = RESOURCES[cls.res];

    return {
      name: h.name, level: h.level, classId: h.classId, hp: h.hp,
      attrs, power: Math.round(power * 10) / 10, weaponDmg: wDmg, scale: wScale,
      maxHp: Math.round(maxHp), armor: Math.round(armor),
      speed: Math.round(cls.speed + attrs.agi * 1.5 + (g.speed || 0) + (mods.speed || 0)),
      crit: round1(5 + attrs.agi * 0.6 + (g.crit || 0) + (mods.crit || 0)),
      critDmg: Math.round(150 + (g.critDmg || 0) + (mods.critDmg || 0)),
      dodge: round1(Math.min(50, attrs.agi * 0.3 + (g.dodge || 0) + (mods.dodge || 0))),
      lifesteal: round1((g.lifesteal || 0) + (mods.lifesteal || 0)),
      goldFind: (g.goldFind || 0) + (state && state.beacon >= 3 ? ECONOMY.beacon[2].find : 0),
      xpFind: (g.xpFind || 0) + (state && state.beacon >= 3 ? ECONOMY.beacon[2].find : 0),
      mods: Object.assign(mods, {
        thorns: (mods.thorns || 0) + (g.thorns || 0),
        dotPct: (mods.dotPct || 0) + (g.dotPct || 0),
        healPct: (mods.healPct || 0) + (g.healPct || 0),
        dmgPct: (mods.dmgPct || 0) + (g.dmgPct || 0),
      }),
      on, flags, resId: cls.res, resMax: res.max, guardGain: cls.guardGain,
    };
  }

  function xpNeeded(level) {
    if (level >= MAX_LEVEL) return Infinity;
    return Math.round(110 + 190 * (level - 1) + 60 * (level - 1) * (level - 1));
  }

  function addXp(amount, raw) {
    const h = state.hero;
    const s = heroStats();
    const gained = Math.max(1, Math.round(amount * (raw ? 1 : 1 + s.xpFind / 100)));
    h.xp += gained;
    let levels = 0;
    while (h.level < MAX_LEVEL && h.xp >= xpNeeded(h.level)) {
      h.xp -= xpNeeded(h.level);
      h.level++;
      h.attrPoints += 3;
      h.talentPoints += 1;
      levels++;
    }
    if (levels) {
      const before = s.maxHp;
      const after = heroStats().maxHp;
      h.hp = Math.min(after, h.hp + (after - before) + Math.round(after * 0.25));
      if (typeof UI !== 'undefined' && UI.onLevelUp) UI.onLevelUp(h.level);
    }
    return { gained, levels };
  }

  function addGold(n) {
    const v = Math.round(n);
    state.hero.gold = Math.max(0, state.hero.gold + v);
    if (v > 0) state.stats.goldEarned += v;
  }

  /* ---------- предметы ---------- */
  function rollRarity(bonus = 0) {
    const w = { common: 46 - bonus * 8, uncommon: 34, rare: 15 + bonus * 4, epic: 4.6 + bonus * 2.5, legendary: 0.4 + bonus * 0.4 };
    if (w.common < 4) w.common = 4;
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const k of RARITY_ORDER) { r -= w[k]; if (r <= 0) return k; }
    return 'common';
  }

  function generateItem(ilvl, slot, rarity, opts = {}) {
    ilvl = clamp(Math.round(ilvl || 1), 1, MAX_LEVEL + 5);
    slot = slot || pick(SLOTS).id;
    if (rarity === 'legendary' && !opts.forceRandomLegendary) rarity = 'epic'; // легендарки только именные
    rarity = RARITIES[rarity] ? rarity : rollRarity();
    const rar = RARITIES[rarity];
    const m = rar.mult;
    const R = Math.round;
    const tierIdx = opts.tier != null ? opts.tier : clamp(Math.floor((ilvl - 1) / 3) + randInt(-1, 0), 0, 3);
    const stats = {};
    const item = { uid: uid('it'), type: 'gear', slot, ilvl, rarity, level: 0, stats, traits: [] };

    if (slot === 'weapon') {
      const fam = opts.family && WEAPONS[opts.family] ? opts.family : pickWeaponFamily();
      const w = WEAPONS[fam];
      item.family = fam; item.kind = fam; item.base = w.tiers[tierIdx]; item.familyName = w.name;
      stats.dmg = R((5.5 + ilvl * 1.9) * m * w.dmg);
      if (w.crit) stats.crit = w.crit;
      if (w.dodge) stats.dodge = w.dodge;
      if (w.speed) stats.speed = w.speed;
      if (w.hp) stats.hp = w.hp + ilvl * 2;
      if (w.lifesteal) stats.lifesteal = w.lifesteal;
      if (w.healPct) stats.healPct = w.healPct;
      if (w.trait) item.traits.push(w.trait);
    } else if (slot === 'offhand') {
      const fam = opts.family && OFFHANDS[opts.family] ? opts.family : pick(Object.keys(OFFHANDS));
      const o = OFFHANDS[fam];
      item.family = fam; item.kind = fam; item.base = o.tiers[tierIdx]; item.familyName = o.name;
      const base = o.stats(ilvl);
      for (const k in base) stats[k] = PCT_STATS.has(k) ? base[k] : R(base[k] * m);
      if (o.speed) stats.speed = o.speed;
    } else {
      const list = ARMORS[slot];
      const a = opts.kind ? (list.find(x => x.kind === opts.kind) || list[0]) : pick(list);
      item.kind = a.kind; item.base = a.tiers[tierIdx]; item.familyName = a.name; item.weight = a.weight;
      if (slot === 'chest') { stats.armor = R((2 + a.weight * 1.9 + ilvl * (0.5 + a.weight * 0.3)) * m); stats.hp = R((6 + ilvl * 2.4) * m); if (a.weight === 3) stats.speed = -6; if (a.wil) stats.wil = 1 + Math.floor(ilvl / 2); }
      if (slot === 'helmet') { stats.armor = R((1 + a.weight + ilvl * (0.3 + a.weight * 0.15)) * m); stats.hp = R((4 + ilvl * 1.6) * m); if (a.wil) stats.wil = 1 + Math.floor(ilvl / 3); }
      if (slot === 'gloves') { stats.armor = R((0.5 + a.weight * 0.8 + ilvl * 0.25) * m); stats.crit = a.weight === 0 ? 2 : 0; if (!stats.crit) delete stats.crit; }
      if (slot === 'boots') { stats.armor = R((0.5 + a.weight * 0.8 + ilvl * 0.25) * m); stats.speed = a.weight === 0 ? 4 : 0; if (!stats.speed) delete stats.speed; }
      if (slot === 'ring') { stats.crit = round1((2 + ilvl * 0.3) * m); }
      if (slot === 'amulet') { stats.hp = R((8 + ilvl * 3) * m); }
    }

    // суффиксы
    const pool = AFFIXES.filter(a => a.slots.includes(slot) && !(a.stat in stats));
    let suffix = null;
    for (let i = 0; i < rar.affixes && pool.length; i++) {
      const ax = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const v = (ax.min + ilvl * ax.per) * (0.8 + Math.random() * 0.4) * (1 + RARITY_ORDER.indexOf(rarity) * 0.06);
      stats[ax.stat] = PCT_STATS.has(ax.stat) ? Math.max(1, round1(v)) : Math.max(1, R(v));
      if (!suffix) suffix = ax.suffix;
    }
    if (rarity === 'epic' || (rarity === 'rare' && Math.random() < 0.35)) item.traits.push(pick(RANDOM_TRAITS));
    item.name = suffix ? `${item.base} ${suffix}` : item.base;
    item.value = itemValue(item);
    return item;
  }

  function pickWeaponFamily() {
    // чаще выпадает то, чем класс реально может пользоваться
    const cls = CLASSES[state ? state.hero.classId : 'warrior'];
    const fams = Object.keys(WEAPONS);
    const own = fams.filter(f => WEAPONS[f].scale === cls.scale);
    return Math.random() < 0.7 ? pick(own) : pick(fams);
  }

  function generateUnique(id) {
    const u = UNIQUES[id];
    if (!u) return null;
    const item = { uid: uid('it'), type: 'gear', slot: u.slot, ilvl: u.ilvl, rarity: 'legendary', level: 0, stats: Object.assign({}, u.stats), traits: [], unique: id, name: u.name, base: u.name, flavor: u.desc, traitText: u.trait };
    const m = RARITIES.legendary.mult;
    if (u.family && WEAPONS[u.family]) {
      const w = WEAPONS[u.family];
      item.family = u.family; item.kind = u.family; item.familyName = w.name;
      item.stats.dmg = Math.round((5.5 + u.ilvl * 1.9) * m * w.dmg);
    } else if (u.family && OFFHANDS[u.family]) {
      item.family = u.family; item.kind = u.family; item.familyName = OFFHANDS[u.family].name;
      const base = OFFHANDS[u.family].stats(u.ilvl);
      for (const k in base) item.stats[k] = (item.stats[k] || 0) + (PCT_STATS.has(k) ? base[k] : Math.round(base[k] * m));
    } else {
      item.kind = u.kind; item.familyName = SLOT_MAP[u.slot].name;
      if (u.slot === 'helmet') item.stats.armor = Math.round((2 + u.ilvl * 0.5) * m);
      if (u.slot === 'chest') { item.stats.armor = (item.stats.armor || 0) + Math.round((4 + u.ilvl * 0.8) * m); item.stats.hp = Math.round((6 + u.ilvl * 2.4) * m); }
      if (u.slot === 'boots') item.stats.armor = Math.round((1 + u.ilvl * 0.25) * m);
      if (u.slot === 'amulet') item.stats.hp = Math.round((8 + u.ilvl * 3) * m);
    }
    item.value = itemValue(item);
    return item;
  }

  function itemValue(it) {
    return Math.max(3, Math.round((10 + it.ilvl * 7) * RARITIES[it.rarity].value));
  }

  /* Статы с учётом заточки */
  function itemStats(it) {
    if (!it.level) return it.stats;
    const k = 1 + ECONOMY.upgradeStep * it.level;
    const out = {};
    for (const s in it.stats) {
      const v = it.stats[s];
      out[s] = (v > 0 && (s === 'dmg' || s === 'armor' || s === 'hp')) ? Math.ceil(v * k) : v;
    }
    return out;
  }

  function addItem(item) {
    const inv = state.hero.inventory;
    if (inv.filter(x => x.type === 'gear').length >= INVENTORY_SIZE) {
      const dust = ECONOMY.dustFor[item.rarity];
      state.hero.dust += dust;
      return { ok: false, dust };
    }
    inv.push(item);
    return { ok: true, item };
  }

  function addConsumable(cid, qty = 1) {
    if (!CONSUMABLES[cid]) return { ok: false };
    const inv = state.hero.inventory;
    const ex = inv.find(x => x.type === 'consumable' && x.cid === cid);
    if (ex) ex.qty += qty;
    else inv.push({ uid: uid('cs'), type: 'consumable', cid, qty });
    const belt = state.hero.belt;
    if (!belt.includes(cid)) {
      const empty = belt.indexOf(null);
      if (empty >= 0 && !CONSUMABLES[cid].noBattle) belt[empty] = cid;
    }
    return { ok: true };
  }

  function consumableQty(cid) {
    const it = state.hero.inventory.find(x => x.type === 'consumable' && x.cid === cid);
    return it ? it.qty : 0;
  }

  function spendConsumable(cid) {
    const inv = state.hero.inventory;
    const i = inv.findIndex(x => x.type === 'consumable' && x.cid === cid);
    if (i < 0) return false;
    inv[i].qty--;
    if (inv[i].qty <= 0) inv.splice(i, 1);
    pruneBelt();
    return true;
  }

  /* Закончившийся расходник сам уходит с пояса */
  function pruneBelt() {
    const h = state.hero;
    h.belt = h.belt.map(cid => (cid && consumableQty(cid) > 0 ? cid : null));
  }

  function useFieldConsumable(cid) {
    const c = CONSUMABLES[cid];
    if (!c || !c.field || consumableQty(cid) < 1) return { ok: false };
    if (c.hmar && !state.expedition) return { ok: false, msg: 'Действует только на вылазке.' };
    const s = heroStats();
    if (c.heal) {
      if (state.hero.hp >= s.maxHp) return { ok: false, msg: 'Здоровье уже полное.' };
      state.hero.hp = Math.min(s.maxHp, state.hero.hp + Math.round(s.maxHp * c.heal));
    }
    if (c.hmar && state.expedition) state.expedition.hmar = Math.max(0, state.expedition.hmar + c.hmar);
    spendConsumable(cid);
    save();
    return { ok: true };
  }

  function equip(itemUid) {
    const h = state.hero;
    const i = h.inventory.findIndex(x => x.uid === itemUid);
    if (i < 0) return { ok: false };
    const it = h.inventory[i];
    if (it.type !== 'gear') return { ok: false };
    const prev = h.equipment[it.slot];
    h.inventory.splice(i, 1);
    if (prev) h.inventory.splice(i, 0, prev);
    delete it.unsecured; // надел — значит, твоё: при смерти не потеряешь
    h.equipment[it.slot] = it;
    h.hp = Math.min(h.hp, heroStats().maxHp);
    save();
    return { ok: true };
  }

  function unequip(slotId) {
    const h = state.hero;
    const it = h.equipment[slotId];
    if (!it) return { ok: false };
    if (h.inventory.filter(x => x.type === 'gear').length >= INVENTORY_SIZE) return { ok: false, msg: 'Сумка полна.' };
    h.inventory.push(it);
    h.equipment[slotId] = null;
    h.hp = Math.min(h.hp, heroStats().maxHp);
    save();
    return { ok: true };
  }

  function sellItem(itemUid) {
    const h = state.hero;
    const i = h.inventory.findIndex(x => x.uid === itemUid);
    if (i < 0) return { ok: false };
    const it = h.inventory[i];
    let price;
    if (it.type === 'consumable') {
      price = Math.max(1, Math.round(CONSUMABLES[it.cid].value * ECONOMY.sellRate));
      spendConsumable(it.cid);
    } else {
      price = Math.max(1, Math.round((it.value || 10) * ECONOMY.sellRate));
      h.inventory.splice(i, 1);
    }
    addGold(price);
    save();
    return { ok: true, price };
  }

  function salvageItem(itemUid) {
    const h = state.hero;
    const i = h.inventory.findIndex(x => x.uid === itemUid);
    if (i < 0 || h.inventory[i].type !== 'gear') return { ok: false };
    const it = h.inventory[i];
    const dust = ECONOMY.dustFor[it.rarity];
    h.dust += dust;
    h.inventory.splice(i, 1);
    save();
    return { ok: true, dust };
  }

  function upgradeCost(it) {
    const c = ECONOMY.upgradeCost((it.level || 0) + it.ilvl * 0.5);
    if (state.flags.harn_discount) c.dust = Math.ceil(c.dust / 2);
    return { gold: Math.round(c.gold), dust: Math.round(c.dust) };
  }

  function upgradeItem(itemUid) {
    const h = state.hero;
    let it = h.inventory.find(x => x.uid === itemUid);
    if (!it) it = Object.values(h.equipment).find(x => x && x.uid === itemUid);
    if (!it || it.type !== 'gear') return { ok: false };
    if ((it.level || 0) >= ECONOMY.upgradeMax) return { ok: false, msg: 'Заточка уже предельная.' };
    const c = upgradeCost(it);
    if (h.gold < c.gold) return { ok: false, msg: `Нужно ${c.gold} золота.` };
    if (h.dust < c.dust) return { ok: false, msg: `Нужно ${c.dust} пыли.` };
    addGold(-c.gold);
    h.dust -= c.dust;
    it.level = (it.level || 0) + 1;
    save();
    return { ok: true };
  }

  /* ---------- прокачка ---------- */
  function spendAttr(a) {
    const h = state.hero;
    if (!ATTRS[a] || h.attrPoints <= 0) return { ok: false };
    h.attrPoints--;
    h.attrs[a]++;
    if (a === 'vit' || a === 'str') h.hp = Math.min(heroStats().maxHp, h.hp + (a === 'vit' ? 8 : 2));
    save();
    return { ok: true };
  }

  function treePoints(treeId) {
    return state.hero.talents.filter(id => TALENTS[id] && TALENTS[id].tree === treeId).length;
  }

  function talentState(id) {
    const n = TALENTS[id];
    const h = state.hero;
    if (h.talents.includes(id)) return 'taken';
    if (treePoints(n.tree) < TIER_REQ[n.tier]) return 'locked';
    if (n.keystone && h.talents.some(id => TALENTS[id] && TALENTS[id].keystone)) return 'barred';
    return h.talentPoints > 0 ? 'available' : 'nopoints';
  }

  function takeTalent(id) {
    const n = TALENTS[id];
    if (!n || talentState(id) !== 'available') return { ok: false };
    const h = state.hero;
    h.talentPoints--;
    h.talents.push(id);
    if (n.skill) {
      const empty = h.loadout.indexOf(null);
      if (empty >= 0) h.loadout[empty] = id;
    }
    h.hp = Math.min(h.hp, heroStats().maxHp);
    save();
    return { ok: true };
  }

  function takeMastery(id) {
    const m = MASTERY[id];
    const h = state.hero;
    if (!m || h.talentPoints <= 0 || (h.mastery[id] || 0) >= m.max) return { ok: false };
    h.talentPoints--;
    h.mastery[id] = (h.mastery[id] || 0) + 1;
    save();
    return { ok: true };
  }

  /* ---------- руны ---------- */
  function runeSockets() {
    return 1 + RUNE_SOCKET_ZONES.filter(z => state.cleared[z]).length;
  }

  function rollRuneId() {
    const owned = new Set(state.hero.runes.map(r => r.id));
    const pool = RUNE_ORDER.map(id => [id, RUNE_RARITY[RUNES[id].rarity].weight * (owned.has(id) ? 0.7 : 1)]);
    let x = Math.random() * pool.reduce((a, p) => a + p[1], 0);
    for (const [id, w] of pool) { x -= w; if (x <= 0) return id; }
    return pool[0][0];
  }

  function addRune(id, level = 1) {
    const r = { uid: uid('rn'), id: id || rollRuneId(), level };
    state.hero.runes.push(r);
    state.seen['rune_' + r.id] = true;
    return r;
  }

  function runeDrop(kind) {
    const chance = RUNE_CHANCE[kind] + hmarStage() * RUNE_CHANCE.hmarStage;
    return Math.random() * 100 < chance ? addRune() : null;
  }

  function insertRune(runeUid) {
    const h = state.hero;
    if (state.expedition) return { ok: false, msg: 'Круг можно менять только в поселении.' };
    const r = h.runes.find(x => x.uid === runeUid);
    if (!r || h.runeCircle.includes(runeUid)) return { ok: false };
    if (h.runeCircle.some(u => { const o = h.runes.find(x => x.uid === u); return o && o.id === r.id; })) return { ok: false, msg: 'Два одинаковых знака в круге гасят друг друга.' };
    if (h.runeCircle.length >= runeSockets()) return { ok: false, msg: 'В круге нет места. Сперва вынь другую руну.' };
    h.runeCircle.push(runeUid);
    h.hp = Math.min(h.hp, heroStats().maxHp);
    save();
    return { ok: true };
  }

  function removeRune(runeUid) {
    const h = state.hero;
    if (state.expedition) return { ok: false, msg: 'Круг можно менять только в поселении.' };
    h.runeCircle = h.runeCircle.filter(u => u !== runeUid);
    h.hp = Math.min(h.hp, heroStats().maxHp);
    save();
    return { ok: true };
  }

  function mergeRunes(runeUid) {
    const h = state.hero;
    if (state.expedition) return { ok: false, msg: 'Сливать руны можно только в поселении.' };
    const r = h.runes.find(x => x.uid === runeUid);
    if (!r || r.level >= 3) return { ok: false };
    const same = h.runes.filter(x => x.id === r.id && x.level === r.level).sort((a, b) => (h.runeCircle.includes(b.uid) ? 1 : 0) - (h.runeCircle.includes(a.uid) ? 1 : 0));
    if (same.length < 3) return { ok: false, msg: 'Нужно три одинаковых руны одной ступени.' };
    const cost = RUNE_MERGE_COST[r.level - 1];
    if (h.gold < cost.gold || h.dust < cost.dust) return { ok: false, msg: `Нужно ${cost.gold} золота и ${cost.dust} пыли.` };
    addGold(-cost.gold);
    h.dust -= cost.dust;
    const used = same.slice(0, 3);
    const wasIn = used.some(x => h.runeCircle.includes(x.uid));
    const gone = new Set(used.map(x => x.uid));
    h.runes = h.runes.filter(x => !gone.has(x.uid));
    h.runeCircle = h.runeCircle.filter(u => !gone.has(u));
    const fresh = addRune(r.id, r.level + 1);
    if (wasIn) h.runeCircle.push(fresh.uid);
    h.hp = Math.min(h.hp, heroStats().maxHp);
    save();
    return { ok: true, rune: fresh };
  }

  function activeRuneWords() {
    const h = state.hero;
    const ids = h.runeCircle.map(u => h.runes.find(r => r.uid === u)).filter(Boolean).map(r => r.id);
    return RUNE_WORDS.filter(w => w.runes.every(id => ids.includes(id)));
  }

  function knownSkills() {
    const h = state.hero;
    const cls = CLASSES[h.classId];
    return cls.start.concat(h.talents.filter(id => TALENTS[id] && TALENTS[id].skill));
  }

  function setLoadout(slot, skillId) {
    const h = state.hero;
    const cur = h.loadout.indexOf(skillId);
    if (cur >= 0 && skillId) h.loadout[cur] = h.loadout[slot];
    h.loadout[slot] = skillId;
    save();
  }

  function setBelt(slot, cid) {
    const h = state.hero;
    const cur = h.belt.indexOf(cid);
    if (cur >= 0 && cid) h.belt[cur] = h.belt[slot] || null;
    h.belt[slot] = cid;
    save();
  }

  function beltSize() { return 3 + (state.beacon >= 1 ? 1 : 0); }

  function respec() {
    const h = state.hero;
    const cost = ECONOMY.respecCost(h.level);
    if (h.gold < cost) return { ok: false, msg: `Нужно ${cost} золота.` };
    addGold(-cost);
    const cls = CLASSES[h.classId];
    const spent = h.talents.length;
    h.talents = [];
    h.talentPoints += spent;
    h.loadout = [cls.start[0], cls.start[1], null, null];
    for (const id in h.mastery) h.talentPoints += h.mastery[id];
    h.mastery = {};
    let pts = 0;
    for (const a in h.attrs) { pts += Math.max(0, h.attrs[a] - cls.attrs[a]); h.attrs[a] = cls.attrs[a]; }
    h.attrPoints += pts;
    h.hp = Math.min(h.hp, heroStats().maxHp);
    save();
    return { ok: true };
  }

  /* ---------- флаги и условия ---------- */
  function flag(id) { return !!state.flags[id]; }

  function questStatus(id) {
    const q = state.quests[id];
    if (!q) return 'none';
    if (q.done) return 'done';
    return questProgress(id).ready ? 'ready' : 'active';
  }

  function testCond(cond) {
    if (!cond) return true;
    if (cond.flag && !state.flags[cond.flag]) return false;
    if (cond.noFlag && state.flags[cond.noFlag]) return false;
    if (cond.questDone && questStatus(cond.questDone) !== 'done') return false;
    if (cond.questReady && questStatus(cond.questReady) !== 'ready') return false;
    if (cond.questActive && questStatus(cond.questActive) !== 'active') return false;
    if (cond.noQuest && questStatus(cond.noQuest) !== 'none') return false;
    if (cond.level && state.hero.level < cond.level) return false;
    if (cond.gold && state.hero.gold < cond.gold) return false;
    if (cond.zone && !state.cleared[cond.zone]) return false;
    if (cond.consumable && consumableQty(cond.consumable) < 1) return false;
    if (cond.region && !regionOpen(cond.region)) return false;
    return true;
  }

  /* ---------- задания ---------- */
  function questGoalHave(g) {
    switch (g.type) {
      case 'kill': return state.kills[g.target] || 0;
      case 'boss': return state.bossKills[g.target] || 0;
      case 'flag': return state.flags[g.target] ? 1 : 0;
      case 'flagCount': return state.flags[g.target] || 0;
      case 'names': return state.namesRead;
      default: return 0;
    }
  }

  function questProgress(id) {
    const q = QUESTS[id];
    const rec = state.quests[id] || {};
    const goals = q.goals.map(g => {
      const base = g.type === 'kill' || g.type === 'boss' ? (rec.base && rec.base[g.target] || 0) : 0;
      const have = Math.min(g.need, Math.max(0, questGoalHave(g) - base));
      return Object.assign({}, g, { have, done: have >= g.need });
    });
    return { goals, ready: goals.every(g => g.done) };
  }

  function startQuest(id) {
    if (state.quests[id] || !QUESTS[id]) return;
    const base = {};
    for (const g of QUESTS[id].goals) if (g.type === 'kill') base[g.target] = state.kills[g.target] || 0;
    state.quests[id] = { base };
    notify(`Новое задание: <b>${QUESTS[id].title}</b>`, 'quest');
  }

  function finishQuest(id) {
    const q = QUESTS[id];
    if (!q || !state.quests[id] || state.quests[id].done) return null;
    state.quests[id].done = true;
    const r = q.reward;
    const notes = [];
    if (r.gold) { addGold(r.gold); notes.push(`+${r.gold} золота`); }
    if (r.xp) { const x = addXp(r.xp, true); notes.push(`+${x.gained} опыта`); }
    if (r.consumable) { addConsumable(r.consumable, r.qty || 1); notes.push(`${CONSUMABLES[r.consumable].name} ×${r.qty || 1}`); }
    if (r.item) {
      const it = generateItem(state.hero.level + 1, r.itemSlot || null, r.item);
      addItem(it);
      notes.push(it.name);
    }
    if (r.talentPoint) { state.hero.talentPoints += r.talentPoint; notes.push(`очки таланта: +${r.talentPoint}`); }
    notify(`Задание выполнено: <b>${q.title}</b><br>${notes.join(', ')}`, 'quest');
    autoStartQuests();
    return notes;
  }

  function autoStartQuests() {
    for (const id in QUESTS) {
      const q = QUESTS[id];
      if (q.auto && !state.quests[id] && testCond(q.auto)) startQuest(id);
    }
    // задания от боссов-целей закрываются сразу, если выданы автоматически
    if (questStatus('q_farm') === 'ready') finishQuest('q_farm');
  }

  /* В какой зоне выполняется цель: своя отметка или зона, где водится враг */
  function goalZone(g) {
    if (g.where) return g.where;
    if (g.type !== 'kill' && g.type !== 'boss') return null;
    const has = id => ZONES[id].boss === g.target || ZONES[id].packs.flat().includes(g.target);
    return ZONE_ORDER.filter(has).reverse().find(zoneOpen) || ZONE_ORDER.find(has) || null;
  }

  /* Следующий шаг по заданию: что делать и куда идти */
  function questNext(id) {
    const q = QUESTS[id];
    const pr = questProgress(id);
    if (pr.ready) {
      const n = NPCS[q.turnIn || q.giver];
      return { text: `Вернись и поговори: ${n.name}`, npc: n.id, ready: true };
    }
    const g = pr.goals.find(x => !x.done);
    if (g.type === 'names') {
      if (state.names > 0) return { text: `Отнеси осколки Тихону на маяк (${state.names})`, npc: 'tikhon' };
      return { text: 'Ищи осколки имён в событиях на вылазках', hint: true };
    }
    if (g.npc) return { text: `Иди к собеседнику: ${NPCS[g.npc].name}`, npc: g.npc };
    const zoneId = goalZone(g);
    if (zoneId) {
      const z = ZONES[zoneId];
      if (zoneOpen(zoneId)) return { text: `${g.label}: ${z.name}`, zone: zoneId, hint: g.hint };
      return { text: `${z.name} пока закрыта. Сперва победи: ${ENEMIES[ZONES[z.unlock].boss].name}` };
    }
    return { text: g.hint || g.label, hint: true };
  }

  /* Зоны, где сейчас есть незавершённая цель */
  function questZones() {
    const out = new Set();
    for (const id in state.quests) {
      if (state.quests[id].done) continue;
      for (const g of questProgress(id).goals) {
        if (g.done) continue;
        const z = goalZone(g);
        if (z) out.add(z);
      }
    }
    return out;
  }

  /* Сообщает о продвижении: «Убить волков 2/3», а в конце куда возвращаться */
  function trackQuests() {
    for (const id in state.quests) {
      const rec = state.quests[id];
      if (rec.done) continue;
      const pr = questProgress(id);
      const seen = rec.seen || (rec.seen = pr.goals.map(g => g.have));
      pr.goals.forEach((g, i) => {
        if (g.have > (seen[i] || 0)) {
          seen[i] = g.have;
          if (pr.ready) notify(`<b>${QUESTS[id].title}</b>: всё готово.<br>${questNext(id).text}`, 'quest');
          else notify(`<b>${QUESTS[id].title}</b><br>${g.label}: ${g.have}/${g.need}`, 'quest');
        }
      });
    }
  }

  /* ---------- контракты ---------- */
  function openZones() {
    return ZONE_ORDER.filter(id => zoneOpen(id));
  }

  function regionOpen(id) {
    const r = REGIONS.find(x => x.id === id);
    return !!r && !!r.hub && (!r.needFlag || !!state.flags[r.needFlag]);
  }

  function zoneOpen(id) {
    const z = ZONES[id];
    if (!regionOpen(z.region)) return false;
    if (!z.unlock) return true;
    if (!state.cleared[z.unlock]) return false;
    return true;
  }

  const hubId = () => state.hub || 'pepel';
  function goHub(id) { if (HUBS[id]) { state.hub = id; save(); } }
  function hubOfZone(zoneId) { return REGIONS.find(r => r.id === ZONES[zoneId].region).hub; }

  function refreshContracts(free) {
    if (!free) {
      const cost = 15 + state.hero.level * 5;
      if (state.hero.gold < cost) return { ok: false, msg: `Нужно ${cost} золота.` };
      addGold(-cost);
    }
    state.contracts = [];
    // контракты с доски этого поселения: враги с его окраин
    const local = openZones().filter(id => hubOfZone(id) === hubId());
    const zones = local.length ? local : openZones();
    const used = new Set();
    for (let i = 0; i < 3; i++) {
      const z = ZONES[pick(zones)];
      const pool = [...new Set(z.packs.flat())].filter(id => !used.has(id));
      const id = pool.length ? pick(pool) : pick(z.packs.flat());
      used.add(id);
      const def = ENEMIES[id];
      const need = randInt(4, 7);
      state.contracts.push({
        id: uid('c'), target: id, zone: z.id, need, base: state.kills[id] || 0,
        gold: Math.round((def.gold * need + 8) * 1.2), xp: Math.round(def.xp * need * 0.45), dust: 1 + Math.floor(need / 3),
      });
    }
    save();
    return { ok: true };
  }

  function contractProgress(c) { return Math.min(c.need, (state.kills[c.target] || 0) - c.base); }

  function claimContract(id) {
    const i = state.contracts.findIndex(c => c.id === id);
    if (i < 0) return { ok: false };
    const c = state.contracts[i];
    if (contractProgress(c) < c.need) return { ok: false };
    addGold(c.gold);
    addXp(c.xp);
    state.hero.dust += c.dust;
    state.contracts.splice(i, 1);
    save();
    return { ok: true, c };
  }

  /* ---------- магазины ---------- */
  const SHOP_STOCK = {
    forge: { gear: 6, slots: ['weapon', 'offhand', 'helmet', 'chest', 'gloves', 'boots'] },
    apothecary: { items: ['potion_small', 'potion_big', 'antidote', 'bandage', 'firebomb', 'smokebomb', 'whetstone', 'incense'], gear: 2, slots: ['ring', 'amulet'] },
    market: { items: ['potion_small', 'potion_big', 'miner_tonic', 'spring_water', 'wax', 'grease', 'firebomb', 'smokebomb', 'whetstone', 'incense'], gear: 7, slots: ['weapon', 'offhand', 'helmet', 'chest', 'gloves', 'boots', 'ring', 'amulet'] },
  };

  function shop(id) {
    const def = SHOP_STOCK[id];
    if (!def) return null;
    const lvl = state.hero.level;
    const cur = state.shops[id];
    if (cur && cur.lvl === lvl && cur.run === state.stats.runs) return cur;
    const stock = [];
    const rar = () => { const r = Math.random(); return r < 0.5 ? 'common' : r < 0.86 ? 'uncommon' : 'rare'; };
    const slots = def.slots.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i < (def.gear || 0); i++) {
      const slot = slots[i % slots.length];
      const it = generateItem(lvl, slot, rar());
      stock.push({ kind: 'gear', item: it, price: Math.round(it.value * 1.35) });
    }
    for (const cid of (def.items || [])) {
      if ((CONSUMABLES[cid].minLevel || 0) <= lvl) stock.push({ kind: 'consumable', cid, price: Math.round(CONSUMABLES[cid].value) });
    }
    state.shops[id] = { lvl, run: state.stats.runs, stock };
    return state.shops[id];
  }

  function buy(shopId, idx) {
    const s = shop(shopId);
    const e = s && s.stock[idx];
    if (!e) return { ok: false };
    if (state.hero.gold < e.price) return { ok: false, msg: 'Не хватает золота.' };
    if (e.kind === 'gear') {
      if (state.hero.inventory.filter(x => x.type === 'gear').length >= INVENTORY_SIZE) return { ok: false, msg: 'Сумка полна.' };
      addGold(-e.price);
      addItem(e.item);
      s.stock.splice(idx, 1);
    } else {
      addGold(-e.price);
      addConsumable(e.cid, 1);
    }
    save();
    return { ok: true };
  }

  function innRest() {
    const h = state.hero;
    const max = heroStats().maxHp;
    if (h.hp >= max) return { ok: false, msg: 'Ты и так полон сил.' };
    const cost = ECONOMY.innCost(h.level);
    if (h.gold < cost) {
      // без денег не оставят: миска похлёбки и лавка
      h.hp = Math.max(h.hp, Math.round(max * 0.6));
      save();
      return { ok: true, charity: true };
    }
    addGold(-cost);
    h.hp = max;
    save();
    return { ok: true, cost };
  }

  function buyBeacon() {
    const next = ECONOMY.beacon[state.beacon];
    if (!next) return { ok: false };
    const h = state.hero;
    if (h.gold < next.cost.gold || h.dust < next.cost.dust) return { ok: false, msg: 'Не хватает золота или пыли.' };
    addGold(-next.cost.gold);
    h.dust -= next.cost.dust;
    state.beacon++;
    if (next.belt) h.belt.push(null);
    save();
    return { ok: true, name: next.name };
  }

  /* Читать имена на маяке: каждые 3 — очко таланта */
  function readNames() {
    if (state.names <= 0) return { ok: false, msg: 'Читать пока нечего.' };
    const read = state.names;
    state.names = 0;
    const unlocked = [];
    let points = 0;
    for (let i = 0; i < read; i++) {
      state.namesRead++;
      const id = `name${state.namesRead}`;
      if (LORE[id] && !state.lore.includes(id)) { state.lore.push(id); unlocked.push(LORE[id].title); }
      if (state.namesRead % 3 === 0) { state.hero.talentPoints++; points++; }
    }
    if (questStatus('q_names') === 'ready') finishQuest('q_names');
    trackQuests();
    save();
    return { ok: true, read, points, unlocked };
  }

  /* ---------- вылазка: карта-маршрут ---------- */
  const NODE_TYPES = {
    battle: { name: 'Схватка', desc: 'Обычные враги.' },
    elite: { name: 'Элита', desc: 'Сильный враг. Хорошая добыча.' },
    event: { name: 'Событие', desc: 'Выбор и последствия.' },
    camp: { name: 'Лагерь', desc: 'Передышка и выбор.' },
    cache: { name: 'Тайник', desc: 'Добыча без боя. Обычно.' },
    shrine: { name: 'Святилище', desc: 'Благословение или цена.' },
    peddler: { name: 'Торговец', desc: 'Покупка в дороге.' },
    boss: { name: 'Босс', desc: 'Хозяин этих мест.' },
    grave: { name: 'Твоя тень', desc: 'Здесь лежит то, что ты потерял.' },
    start: { name: 'Начало', desc: '' },
  };

  function buildRoute(zone) {
    const rows = zone.rows;
    const grid = [];
    const startNode = { id: 'n0', row: 0, col: 1, type: 'start', links: [], done: true };
    grid.push([startNode]);
    let n = 1;
    for (let r = 1; r < rows; r++) {
      const count = r === rows - 1 ? 1 : randInt(2, 3);
      const row = [];
      for (let i = 0; i < count; i++) {
        row.push({ id: 'n' + (n++), row: r, col: count === 1 ? 1 : (count === 2 ? (i === 0 ? 0.5 : 1.5) : i), type: 'battle', links: [] });
      }
      grid.push(row);
    }
    grid.push([{ id: 'n' + (n++), row: rows, col: 1, type: 'boss', links: [] }]);

    // связи без пересечений: каждый идёт к ближайшим по столбцу
    for (let r = 0; r < grid.length - 1; r++) {
      const cur = grid[r], nxt = grid[r + 1];
      cur.forEach(node => {
        const sorted = nxt.slice().sort((a, b) => Math.abs(a.col - node.col) - Math.abs(b.col - node.col));
        node.links.push(sorted[0].id);
        if (sorted[1] && Math.abs(sorted[1].col - node.col) <= 1 && Math.random() < 0.55) node.links.push(sorted[1].id);
      });
      nxt.forEach(tgt => {
        if (!cur.some(c => c.links.includes(tgt.id))) {
          const near = cur.slice().sort((a, b) => Math.abs(a.col - tgt.col) - Math.abs(b.col - tgt.col))[0];
          near.links.push(tgt.id);
        }
      });
    }

    // типы клеток
    const last = grid.length - 1;
    const weights = [['battle', 38], ['event', 28], ['cache', 9], ['shrine', 6], ['peddler', 5], ['elite', 14]];
    for (let r = 1; r < last; r++) {
      const row = grid[r];
      row.forEach(node => {
        if (r === 1) { node.type = 'battle'; return; }
        if (r === last - 1) { node.type = 'camp'; return; }
        let total = 0;
        const pool = weights.filter(w => !(w[0] === 'elite' && r < 3));
        pool.forEach(w => { total += w[1]; });
        let x = Math.random() * total;
        for (const w of pool) { x -= w[1]; if (x <= 0) { node.type = w[0]; break; } }
      });
      // в каждом ряду должен быть хотя бы один не элитный путь
      if (row.every(x => x.type === 'elite')) row[0].type = 'battle';
    }
    const mid = grid[Math.floor(last / 2)];
    if (mid && !mid.some(x => x.type === 'camp') && mid[0].type !== 'boss') mid[mid.length - 1].type = 'camp';

    return grid;
  }

  function startExpedition(zoneId) {
    if (!zoneOpen(zoneId)) return { ok: false, msg: 'Сюда пока не пройти.' };
    if (state.expedition) return { ok: false };
    const zone = ZONES[zoneId];
    const grid = buildRoute(zone);
    const nodes = {};
    grid.flat().forEach(n => { nodes[n.id] = n; });
    // потерянная добыча лежит на карте той зоны, где ты погиб
    if (state.grave && state.grave.zone === zoneId) {
      const candidates = grid.slice(3, grid.length - 2).flat().filter(n => n.type !== 'camp');
      if (candidates.length) pick(candidates).type = 'grave';
    }
    state.expedition = {
      zone: zoneId, grid: grid.map(row => row.map(n => n.id)), nodes, at: 'n0', hmar: 0,
      freeSteps: (state.beacon >= 2 ? ECONOMY.beacon[1].hmarFree : 0) + (heroStats().flags.hmarFree || 0),
      gold: 0, blessing: 0, omen: 0, sharpen: 0, runItems: 0, seenEvents: [],
    };
    state.stats.runs++;
    state.place = 'expedition';
    if (flag('olha_gift')) { addConsumable('potion_small', 1); notify('Ольха оставила тебе отвар в дорогу.', 'good'); }
    save();
    return { ok: true };
  }

  function canMoveTo(nodeId) {
    const e = state.expedition;
    if (!e) return false;
    return e.nodes[e.at].links.includes(nodeId);
  }

  function moveTo(nodeId) {
    const e = state.expedition;
    if (!e || !canMoveTo(nodeId)) return { ok: false };
    e.at = nodeId;
    const node = e.nodes[nodeId];
    const dawn = heroStats().flags.dawn;
    e.steps = (e.steps || 0) + 1;
    if (e.freeSteps > 0) e.freeSteps--;
    else if (!(dawn && e.steps % dawn === 0)) e.hmar++;
    save();
    return { ok: true, node };
  }

  function hmarStage() {
    const e = state.expedition;
    if (!e) return 0;
    return Math.floor(e.hmar / 3);
  }

  function hmarLootBonus() { return hmarStage() * 0.5; }

  /* Составляем группу врагов для клетки */
  function encounterFor(node) {
    const e = state.expedition;
    const z = ZONES[e.zone];
    const stage = hmarStage();
    if (node.type === 'boss') return { ids: [z.boss], units: [Combat.makeEnemyUnit(z.boss, { hmar: stage })], noFlee: true, boss: true };
    if (node.type === 'grave') {
      const lvl = Math.max(1, state.hero.level);
      const u = Combat.makeEnemyUnit('own_shadow', { lvl, hpMul: 1, atkMul: 1 });
      return { units: [u], noFlee: true, grave: true };
    }
    if (node.type === 'elite') {
      const id = pick(z.elites);
      const a = pick(ELITE_AFFIXES);
      return { units: [Combat.makeEnemyUnit(id, { lvl: Math.max(z.level + 1, ENEMIES[id].lvl), hmar: stage, affix: a })], noFlee: true, elite: true };
    }
    const pack = pick(z.packs);
    return { units: pack.map(id => Combat.makeEnemyUnit(id, { lvl: Math.max(ENEMIES[id].lvl, z.level), hmar: stage })), noFlee: false };
  }

  function beginBattle(encounter) {
    const e = state.expedition;
    const opts = {
      noFlee: encounter.noFlee,
      blessing: e && e.blessing > 0, omen: e && e.omen > 0,
      onKill: u => recordKill(u),
    };
    if (e) { if (e.blessing > 0) e.blessing--; if (e.omen > 0) e.omen--; }
    const c = Combat.start(heroStats(), encounter.units, opts);
    if (e && e.sharpen > 0) { c.hero.mods = Object.assign({}, c.hero.mods, { dmgPct: (c.hero.mods.dmgPct || 0) + 15 }); e.sharpen--; }
    c.encounter = encounter;
    return c;
  }

  function recordKill(u) {
    state.kills[u.id] = (state.kills[u.id] || 0) + 1;
    state.stats.kills++;
    if (u.boss) {
      state.bossKills[u.id] = (state.bossKills[u.id] || 0) + 1;
      state.stats.bosses++;
      if (u.def.lore && !state.lore.includes(u.def.lore)) unlockLore(u.def.lore);
    }
  }

  /* Итог боя: опыт, золото, добыча. Опыт падает, если зона уже слишком лёгкая */
  function finishBattle(c) {
    const s = heroStats();
    const h = state.hero;
    h.hp = Math.max(0, Math.min(s.maxHp, c.hero.hp));
    if (!c.result.win) return { win: false, fled: !!c.result.fled };

    const e = state.expedition;
    const z = e ? ZONES[e.zone] : null;
    const units = c.enemies;
    const reward = { win: true, xp: 0, gold: 0, dust: 0, items: [], boss: false, notes: [] };
    let xp = 0, gold = 0;
    for (const u of units) {
      const mul = u.boss ? 1 : u.elite ? 2.5 : 1;
      xp += u.def.xp * (1 + 0.22 * (u.lvl - u.def.lvl)) * mul;
      gold += u.def.gold * (1 + 0.15 * (u.lvl - u.def.lvl)) * mul;
    }
    const gap = h.level - (z ? z.level : h.level);
    const xpMul = gap <= 0 ? 1 : gap === 1 ? 0.8 : gap === 2 ? 0.45 : gap === 3 ? 0.2 : 0.08;
    const stage = hmarStage();
    xp *= xpMul * (1 + stage * 0.1);
    gold *= (1 + s.goldFind / 100) * (1 + stage * 0.1) * (0.85 + Math.random() * 0.3);
    const xr = addXp(xp);
    reward.xp = xr.gained;
    reward.levels = xr.levels;
    reward.gold = Math.round(gold);
    addGold(reward.gold);
    if (e) e.gold += reward.gold;

    const enc = c.encounter || {};
    const ilvl = z ? z.level + (stage > 0 ? 1 : 0) : h.level;
    if (enc.boss) {
      reward.boss = true;
      const bossDef = units.find(u => u.boss).def;
      const firstKill = !state.cleared[e.zone];
      const uniqueChance = firstKill ? 1 : 0.2;
      const pool = (bossDef.drop || []).filter(id => !state.seen['u_' + id]);
      if (pool.length && Math.random() < uniqueChance) {
        const id = pick(pool);
        state.seen['u_' + id] = true;
        const uq = generateUnique(id);
        giveLoot(reward, uq);
      }
      giveLoot(reward, generateItem(ilvl + 1, null, firstKill ? 'epic' : 'rare'));
      giveLoot(reward, generateItem(ilvl + 1, null, rollRarity(2)));
      reward.dust += 5 + z.level;
      state.cleared[e.zone] = (state.cleared[e.zone] || 0) + 1;
      if (firstKill) { h.attrPoints += 1; h.talentPoints += 0; reward.notes.push('+1 очко характеристик за первую победу'); }
      if (!state.flags['intro_' + e.zone]) state.flags['intro_' + e.zone] = 1;
      autoStartQuests();
    } else if (enc.grave) {
      const g = state.grave;
      if (g) {
        reward.gold += g.gold; addGold(g.gold);
        for (const it of g.items) giveLoot(reward, it);
        reward.dust += g.dust || 0;
        reward.notes.push('Ты вернул своё. Тень рассыпается у тебя в руках.');
        state.grave = null;
        unlockLore('shadow');
      }
    } else if (enc.elite) {
      giveLoot(reward, generateItem(ilvl + 1, null, rollRarity(1 + hmarLootBonus()) === 'common' ? 'uncommon' : rollRarity(1 + hmarLootBonus())));
      reward.dust += 2;
      if (Math.random() < 0.35) giveConsumableLoot(reward);
    } else {
      const chance = 0.2 + units.length * 0.06 + stage * 0.05;
      if (Math.random() < chance) giveLoot(reward, generateItem(ilvl, null, rollRarity(hmarLootBonus())));
      if (Math.random() < 0.14) giveConsumableLoot(reward);
      if (Math.random() < 0.3) reward.dust += 1;
    }
    // руны: редкость. Самая первая приходит с первого босса, чтобы игрок узнал о круге
    const runeKind = enc.boss ? 'boss' : enc.elite ? 'elite' : enc.grave ? null : 'battle';
    if (runeKind) {
      const firstEver = enc.boss && !state.hero.runes.length;
      const rn = firstEver ? addRune() : runeDrop(runeKind);
      if (rn) reward.runes = [rn];
    }
    h.dust += reward.dust;
    if (e) e.dustFound = (e.dustFound || 0) + reward.dust;
    autoStartQuests();
    trackQuests();
    save();
    return reward;
  }

  function giveLoot(reward, item) {
    item.unsecured = !!state.expedition;
    const r = addItem(item);
    if (!r.ok) { reward.dust += r.dust; reward.notes.push(`Сумка полна: ${item.name} разобрано на пыль.`); return; }
    reward.items.push(item);
  }

  function giveConsumableLoot(reward) {
    const cid = pick(['potion_small', 'potion_small', 'bandage', 'antidote', 'smokebomb', 'firebomb', 'whetstone', 'potion_big']);
    addConsumable(cid, 1);
    reward.consumables = (reward.consumables || []).concat(cid);
  }

  /* Смерть: добыча вылазки остаётся у тени */
  function onDeath() {
    const h = state.hero;
    const e = state.expedition;
    state.stats.deaths++;
    const lost = h.inventory.filter(x => x.unsecured);
    h.inventory = h.inventory.filter(x => !x.unsecured);
    const goldLost = Math.round(h.gold * 0.3);
    addGold(-goldLost);
    state.grave = e ? { zone: e.zone, items: lost, gold: goldLost, dust: Math.floor((e.dustFound || 0) / 2) } : null;
    if (e && e.dustFound) h.dust = Math.max(0, h.dust - Math.floor(e.dustFound / 2));
    if (e) state.hub = hubOfZone(e.zone);
    state.expedition = null;
    state.place = 'city';
    h.hp = Math.round(heroStats().maxHp * 0.5);
    save();
    return { items: lost, gold: goldLost };
  }

  /* Возврат в город. Из лагеря — бесплатно, иначе часть добычи теряется в спешке. */
  function retreatCost() {
    const e = state.expedition;
    if (!e) return null;
    const node = e.nodes[e.at];
    if (node.type === 'camp' || node.type === 'start' || heroStats().flags.home) return { free: true };
    const items = state.hero.inventory.filter(x => x.unsecured);
    return { free: false, itemsLost: items.length ? 1 : 0, gold: Math.round(e.gold * 0.25) };
  }

  function retreat(clear) {
    const e = state.expedition;
    if (!e) return null;
    const h = state.hero;
    const notes = [];
    if (!clear) {
      const rc = retreatCost();
      if (!rc.free) {
        const items = h.inventory.filter(x => x.unsecured);
        if (items.length) {
          const lost = pick(items);
          h.inventory = h.inventory.filter(x => x !== lost);
          notes.push(`В спешке потеряно: ${lost.name}`);
        }
        if (rc.gold) { addGold(-rc.gold); notes.push(`Рассыпано ${rc.gold} золота`); }
      }
    }
    h.inventory.forEach(x => { delete x.unsecured; });
    state.hub = hubOfZone(e.zone);
    state.expedition = null;
    state.place = 'city';
    save();
    return { notes };
  }

  /* Лагерь: один из вариантов */
  function campAction(kind) {
    const e = state.expedition;
    const node = e && e.nodes[e.at];
    if (!e || !node || node.type !== 'camp' || node.done) return { ok: false };
    const s = heroStats();
    const h = state.hero;
    if (kind === 'rest') h.hp = Math.min(s.maxHp, h.hp + Math.round(s.maxHp * 0.4));
    if (kind === 'sharpen') e.sharpen = (e.sharpen || 0) + 3;
    if (kind === 'watch') e.hmar = Math.max(0, e.hmar - 3);
    node.done = true;
    save();
    return { ok: true };
  }

  /* События */
  function eventFor() {
    const e = state.expedition;
    const pool = EVENTS.filter(ev => {
      if (ev.zones && !ev.zones.includes(e.zone)) return false;
      if (e.seenEvents.includes(ev.id)) return false;
      if (ev.once && state.seen['ev_' + ev.id]) return false;
      if (ev.minLevel && state.hero.level < ev.minLevel) return false;
      if (ev.minHmar && e.hmar < ev.minHmar) return false;
      if (ev.ifFlag && !testCond(ev.ifFlag)) return false;
      return true;
    });
    if (!pool.length) return EVENTS.find(x => x.id === 'cart');
    let total = pool.reduce((a, x) => a + (x.weight || 1), 0);
    let r = Math.random() * total;
    for (const ev of pool) { r -= (ev.weight || 1); if (r <= 0) return ev; }
    return pool[0];
  }

  function checkChance(check) {
    const v = heroStats().attrs[check.attr] || 0;
    return clamp(50 + (v - check.dc) * 8, 8, 95);
  }

  function resolveEventOption(ev, optIdx) {
    const e = state.expedition;
    const opt = ev.opts[optIdx];
    if (!opt) return null;
    e.seenEvents.push(ev.id);
    if (ev.once) state.seen['ev_' + ev.id] = true;
    let res = opt.res;
    let passed = null;
    let chance = null;
    if (opt.check) {
      chance = checkChance(opt.check);
      passed = Math.random() * 100 < chance;
      if (!passed) res = opt.fail;
    }
    const notes = applyDo(res.do || {});
    const fight = !!(res.do && res.do.fight);
    save();
    return { text: res.text, notes, fight, passed, chance, attr: opt.check ? opt.check.attr : null };
  }

  /* Эффекты событий и диалогов */
  function applyDo(d) {
    const h = state.hero;
    const e = state.expedition;
    const out = [];
    const s = heroStats();
    if (d.gold) { addGold(d.gold); out.push({ t: `${d.gold > 0 ? '+' : ''}${d.gold} золота`, cls: d.gold > 0 ? 'good' : 'bad' }); if (e && d.gold > 0) e.gold += d.gold; }
    if (d.xp) { const r = addXp(d.xp); out.push({ t: `+${r.gained} опыта`, cls: 'good' }); }
    if (d.dust) { h.dust += d.dust; out.push({ t: `+${d.dust} пыли`, cls: 'good' }); }
    if (d.heal) { const n = Math.round(s.maxHp * d.heal / 100); h.hp = Math.min(s.maxHp, h.hp + n); out.push({ t: `+${n} здоровья`, cls: 'good' }); }
    if (d.hurt) { const n = Math.round(s.maxHp * d.hurt / 100); h.hp = Math.max(1, h.hp - n); out.push({ t: `−${n} здоровья`, cls: 'bad' }); }
    if (d.hmar && e) { e.hmar = Math.max(0, e.hmar + d.hmar); out.push({ t: `Хмарь ${d.hmar > 0 ? 'сгущается' : 'редеет'} (${d.hmar > 0 ? '+' : ''}${d.hmar})`, cls: d.hmar > 0 ? 'bad' : 'good' }); }
    if (d.item) {
      const z = e ? ZONES[e.zone].level : h.level;
      const it = generateItem(z + 1, d.itemSlot || null, d.item);
      it.unsecured = !!e;
      const r = addItem(it);
      out.push(r.ok ? { t: it.name, cls: 'item', item: it } : { t: `Сумка полна: +${r.dust} пыли`, cls: 'bad' });
    }
    if (d.consumable) { addConsumable(d.consumable, 1); out.push({ t: CONSUMABLES[d.consumable].name, cls: 'good' }); }
    if (d.useConsumable) spendConsumable(d.useConsumable);
    if (d.name) { state.names += d.name; out.push({ t: `Осколок имени ×${d.name}: отнеси Тихону`, cls: 'good' }); }
    if (d.lore) unlockLore(d.lore);
    if (d.flag) state.flags[d.flag] = state.flags[d.flag] || 1;
    if (d.flag2) state.flags[d.flag2] = state.flags[d.flag2] || 1;
    if (d.herbs) { state.flags.herbs = (state.flags.herbs || 0) + d.herbs; out.push({ t: `Пепельная трава: ${state.flags.herbs}`, cls: 'good' }); }
    if (d.count) for (const k in d.count) { state.flags[k] = (state.flags[k] || 0) + d.count[k]; out.push({ t: `${COUNT_LABELS[k]}: ${state.flags[k]}`, cls: 'good' }); }
    if (d.rune) { const rn = addRune(); out.push({ t: `Руна: ${RUNES[rn.id].name} (${RUNES[rn.id].gloss})`, cls: 'item' }); }
    if (d.flag3) state.flags[d.flag3] = state.flags[d.flag3] || 1;
    if (d.oars) { state.flags.oars = (state.flags.oars || 0) + d.oars; out.push({ t: `Весло с зарубками: ${state.flags.oars}`, cls: 'good' }); }
    if (d.jars) { state.flags.jars = (state.flags.jars || 0) + d.jars; out.push({ t: `Банка с голосом: ${state.flags.jars}`, cls: 'good' }); }
    if (d.blessing && e) { e.blessing = (e.blessing || 0) + d.blessing; out.push({ t: 'Благословение: мощь в начале следующего боя', cls: 'good' }); }
    if (d.omen && e) { e.omen = (e.omen || 0) + d.omen; out.push({ t: 'Дурная примета: слабость в начале следующего боя', cls: 'bad' }); }
    if (d.quest) startQuest(d.quest);
    if (d.questDone) finishQuest(d.questDone);
    autoStartQuests();
    trackQuests();
    return out;
  }

  /* Тайник и святилище */
  function openCache() {
    const e = state.expedition;
    const z = ZONES[e.zone];
    const notes = [];
    if (Math.random() < 0.15) return { trap: true, notes: [{ t: 'Ловушка!', cls: 'bad' }] };
    const rn = runeDrop('cache');
    if (rn) notes.push({ t: `Руна: ${RUNES[rn.id].name}`, cls: 'item' });
    const gold = Math.round((8 + z.level * 9) * (0.8 + Math.random() * 0.6));
    notes.push(...applyDo({ gold }));
    if (Math.random() < 0.65) {
      const it = generateItem(z.level, null, rollRarity(1 + hmarLootBonus()));
      it.unsecured = true;
      const r = addItem(it);
      notes.push(r.ok ? { t: it.name, cls: 'item', item: it } : { t: `Сумка полна: +${r.dust} пыли`, cls: 'bad' });
    } else {
      notes.push(...applyDo({ consumable: pick(['potion_small', 'bandage', 'antidote', 'whetstone']) }));
    }
    save();
    return { trap: false, notes };
  }

  function unlockLore(id) {
    if (!LORE[id] || state.lore.includes(id)) return false;
    state.lore.push(id);
    notify(`Кодекс: «${LORE[id].title}»`, 'lore');
    return true;
  }

  function markNodeDone(nodeId) {
    const e = state.expedition;
    if (e && e.nodes[nodeId]) e.nodes[nodeId].done = true;
    save();
  }

  return {
    get state() { return state; },
    init, newGame, reset, save, heroStats, xpNeeded, addXp, addGold, flag, testCond,
    generateItem, generateUnique, itemStats, addItem, addConsumable, consumableQty, spendConsumable, useFieldConsumable,
    equip, unequip, sellItem, salvageItem, upgradeItem, upgradeCost,
    spendAttr, treePoints, talentState, takeTalent, knownSkills, setLoadout, setBelt, beltSize, respec,
    questStatus, questProgress, questNext, questZones, startQuest, finishQuest, autoStartQuests,
    regionOpen, hubId, goHub, hubOfZone, takeMastery, runeSockets, insertRune, removeRune, mergeRunes, activeRuneWords, addRune,
    refreshContracts, contractProgress, claimContract, shop, buy, innRest, buyBeacon, readNames,
    zoneOpen, openZones, startExpedition, canMoveTo, moveTo, hmarStage, encounterFor, beginBattle, finishBattle,
    onDeath, retreatCost, retreat, campAction, eventFor, checkChance, resolveEventOption, applyDo, openCache, unlockLore, markNodeDone,
    NODE_TYPES,
  };
})();
