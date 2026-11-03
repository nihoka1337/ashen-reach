'use strict';

/* ============================================================
   СИМУЛЯТОР БАЛАНСА. Запускается в браузере на странице игры:
     await fetch('tools/sim.js').then(r=>r.text()).then(eval); Sim.report()
   Бот «умный» играет разумно, «тупой» только жмёт обычный удар.
   Цель: умный проходит, но теряет заметное здоровье; тупой не тянет боссов.
   ============================================================ */

var Sim = (() => {
  /* Типичный герой для уровня: очки в основной стат и стойкость, таланты по одной ветке */
  function makeHero(classId, level, opts = {}) {
    const cls = CLASSES[classId];
    const attrs = Object.assign({}, cls.attrs);
    const pts = (level - 1) * 3;
    attrs[cls.scale] += Math.ceil(pts * 0.6);
    attrs.vit += Math.floor(pts * 0.4);
    const treeIdx = opts.tree || 0;
    const nodes = cls.trees[treeIdx].nodes.slice().sort((a, b) => a.tier - b.tier);
    const talents = nodes.slice(0, Math.min(nodes.length, level + (level >= 4 ? 1 : 0))).map(n => n.id);
    const mastery = {};
    const spare = Math.max(0, level + 4 - nodes.length);
    if (spare) { mastery.force = Math.min(5, Math.ceil(spare / 2)); mastery.body = Math.min(5, Math.floor(spare / 2)); }
    const hero = {
      name: 'Бот', classId, level, xp: 0, gold: 0, dust: 0, attrs, attrPoints: 0, talents, talentPoints: 0, mastery,
      loadout: [], equipment: {}, inventory: [], belt: [], hp: 1,
    };
    const skills = cls.start.concat(talents.filter(id => TALENTS[id].skill));
    hero.loadout = skills.slice(-4);
    const ilvl = opts.ilvl || level;
    const rar = opts.rarity || 'uncommon';
    hero.equipment.weapon = Game.generateItem(ilvl, 'weapon', rar, { family: cls.weapon });
    for (const s of ['helmet', 'chest', 'gloves', 'boots', 'ring', 'amulet']) hero.equipment[s] = Game.generateItem(ilvl, s, rar);
    if (cls.offhand) hero.equipment.offhand = Game.generateItem(ilvl, 'offhand', rar, { family: cls.offhand });
    return hero;
  }

  const bots = {
    dumb(c) { Combat.useSkill(c, 'basic_' + c.hero.cls, Combat.aliveEnemies(c)[0].key); },
    smart(c, hero, potions) {
      const h = c.hero;
      const enemies = Combat.aliveEnemies(c);
      if (h.hp / h.maxHp < 0.35 && potions.n > 0 && !c.itemUsed) {
        potions.n--;
        Combat.useItem(c, CONSUMABLES.potion_small);
        if (c.over) return;
      }
      const sk = hero.loadout.filter(Boolean).filter(id => Combat.skillState(c, id).ok).map(id => SKILLS[id]);
      const heavy = enemies.find(e => e.intent && e.intent.heavy);
      if (heavy) {
        const intr = sk.find(s => (s.tags || []).includes('interrupt'));
        if (intr) { Combat.useSkill(c, intr.id, heavy.key); return; }
        if (h.hp / h.maxHp < 0.75) { Combat.guard(c); return; }
      }
      if (h.resId === 'heat' && h.res >= 70) {
        const cool = sk.find(s => s.gain < 0);
        if (cool) { Combat.useSkill(c, cool.id); return; }
        Combat.guard(c);
        return;
      }
      const low = enemies.slice().sort((a, b) => a.hp - b.hp)[0];
      const score = s => {
        let v = 0;
        for (const e of s.effects) {
          if (e.dmg != null) {
            let d = e.dmg * (e.hits || 1);
            if (e.perRes) d += e.perRes * h.res;
            v += d * (s.target === 'all' ? enemies.length : 1);
          }
          if (e.apply === 'might' && !h.statuses.might) v += 1.2;
          if ((e.apply === 'burn' || e.apply === 'poison' || e.apply === 'bleed') && !(low.statuses[e.apply])) v += 0.6;
          if (e.apply === 'curse' && !low.statuses.curse) v += 1.3;
          if (e.apply === 'vuln' && !low.statuses.vuln) v += 0.8;
          if (e.apply === 'stun') v += 0.5;
          if (e.shield && h.shield <= 0 && h.hp / h.maxHp < 0.7) v += 1.2;
          if (e.heal && h.hp / h.maxHp < 0.6) v += 1.3;
          if (e.summon && !h.minion) v += 2;
          if (e.apply === 'counter' && !h.statuses.counter) v += 0.7;
          if (e.apply === 'evade' && !h.statuses.evade) v += 0.6;
        }
        if (s.cost === 'all' && h.res < h.resMax * 0.6) v *= 0.3;
        return v;
      };
      const basic = SKILLS['basic_' + h.cls];
      let best = basic, bestV = 1;
      for (const s of sk) {
        if (h.lastSkill === s.id && h.resId === 'lad') continue;
        const v = score(s);
        if (v > bestV) { bestV = v; best = s; }
      }
      if (h.resId === 'lad' && best === basic && h.lastSkill === basic.id) {
        const alt = sk[0];
        if (alt) best = alt;
      }
      Combat.useSkill(c, best.id, low.key);
    },
  };

  function fight(hero, unitsFn, bot, opts = {}) {
    const stats = Game.heroStats(hero);
    stats.hp = opts.hp != null ? Math.round(stats.maxHp * opts.hp) : stats.maxHp;
    const c = Combat.start(stats, unitsFn(), { noFlee: true });
    const potions = { n: opts.potions != null ? opts.potions : 2 };
    Combat.advance(c);
    let guard = 0;
    let turns = 0;
    while (!c.over && guard++ < 300) {
      if (c.awaiting === 'hero') {
        turns++;
        bots[bot](c, hero, potions);
        c.ev.length = 0;
      } else break;
    }
    return { win: !!(c.result && c.result.win), turns, hpLeft: Math.max(0, c.hero.hp) / c.hero.maxHp, used: (opts.potions != null ? opts.potions : 2) - potions.n };
  }

  function stats(n, hero, unitsFn, bot, opts) {
    let wins = 0, t = 0, hp = 0;
    for (let i = 0; i < n; i++) {
      const r = fight(hero(), unitsFn, bot, opts);
      if (r.win) wins++;
      t += r.turns; hp += r.hpLeft;
    }
    return { win: Math.round(wins / n * 100), turns: +(t / n).toFixed(1), hp: Math.round(hp / n * 100) };
  }

  const fmt = r => `${String(r.win).padStart(3)}% ${String(r.turns).padStart(5)}х ${String(r.hp).padStart(3)}%hp`;

  /* Сценарии: уровень героя и противник для него */
  const SCENARIOS = [
    { label: 'L1 волк', lvl: 1, ilvl: 1, rar: 'common', units: () => [Combat.makeEnemyUnit('ash_wolf')] },
    { label: 'L1 2 волка', lvl: 1, ilvl: 1, rar: 'common', units: () => [Combat.makeEnemyUnit('ash_wolf'), Combat.makeEnemyUnit('ash_wolf')] },
    { label: 'L2 культист', lvl: 2, ilvl: 1, rar: 'common', units: () => [Combat.makeEnemyUnit('ash_cultist')] },
    { label: 'L2 элита поля', lvl: 2, ilvl: 2, rar: 'uncommon', units: () => [Combat.makeEnemyUnit('ash_wolf', { lvl: 2, affix: ELITE_AFFIXES[0] })] },
    { label: 'L3 БОСС Шрам', lvl: 3, ilvl: 2, rar: 'uncommon', units: () => [Combat.makeEnemyUnit('scar')] },
    { label: 'L3 погорельцы', lvl: 3, ilvl: 3, rar: 'uncommon', units: () => [Combat.makeEnemyUnit('burnt_villager'), Combat.makeEnemyUnit('burnt_villager')] },
    { label: 'L4 пугало+огнев', lvl: 4, ilvl: 3, rar: 'uncommon', units: () => [Combat.makeEnemyUnit('scarecrow'), Combat.makeEnemyUnit('ember_imp')] },
    { label: 'L5 БОСС Мельник', lvl: 5, ilvl: 4, rar: 'uncommon', units: () => [Combat.makeEnemyUnit('miller')] },
    { label: 'L5 пепл+жрец', lvl: 5, ilvl: 5, rar: 'uncommon', units: () => [Combat.makeEnemyUnit('ashborn'), Combat.makeEnemyUnit('mist_priest')] },
    { label: 'L6 рыцарь', lvl: 6, ilvl: 5, rar: 'uncommon', units: () => [Combat.makeEnemyUnit('barrow_knight')] },
    { label: 'L7 БОСС Смотритель', lvl: 7, ilvl: 6, rar: 'rare', units: () => [Combat.makeEnemyUnit('keeper')] },
    { label: 'L8 утопленник+огонёк', lvl: 8, ilvl: 7, rar: 'rare', units: () => [Combat.makeEnemyUnit('drowned', { lvl: 8 }), Combat.makeEnemyUnit('bog_wisp', { lvl: 8 })] },
    { label: 'L9 жаба', lvl: 9, ilvl: 8, rar: 'rare', units: () => [Combat.makeEnemyUnit('howl_toad', { lvl: 8 })] },
    { label: 'L9 БОСС Сом', lvl: 9, ilvl: 8, rar: 'rare', units: () => [Combat.makeEnemyUnit('old_som')] },
    { label: 'L10 послушница+двойник', lvl: 10, ilvl: 9, rar: 'rare', units: () => [Combat.makeEnemyUnit('mirror_double', { lvl: 10 }), Combat.makeEnemyUnit('bath_novice', { lvl: 10 })] },
    { label: 'L11 БОСС Мать-Тишина', lvl: 11, ilvl: 10, rar: 'rare', units: () => [Combat.makeEnemyUnit('mother_silence')] },
    { label: 'L12 звонарь+хорист', lvl: 12, ilvl: 11, rar: 'rare', units: () => [Combat.makeEnemyUnit('bell_ringer', { lvl: 12 }), Combat.makeEnemyUnit('choir_drowned', { lvl: 12 })] },
    { label: 'L13 БОСС Голос Воды', lvl: 13, ilvl: 12, rar: 'epic', units: () => [Combat.makeEnemyUnit('water_voice')] },
    { label: 'L14 забойщик+газ', lvl: 14, ilvl: 13, rar: 'rare', units: () => [Combat.makeEnemyUnit('numbered_miner'), Combat.makeEnemyUnit('gas_pocket')] },
    { label: 'L15 БОСС Дед', lvl: 15, ilvl: 14, rar: 'rare', units: () => [Combat.makeEnemyUnit('old_driller')] },
    { label: 'L16 голем+литейщик', lvl: 16, ilvl: 15, rar: 'rare', units: () => [Combat.makeEnemyUnit('slag_golem'), Combat.makeEnemyUnit('smelter')] },
    { label: 'L17 БОСС Мать-Печь', lvl: 17, ilvl: 16, rar: 'rare', units: () => [Combat.makeEnemyUnit('mother_furnace')] },
    { label: 'L18 подпевающий+нарост', lvl: 18, ilvl: 17, rar: 'rare', units: () => [Combat.makeEnemyUnit('vein_singer'), Combat.makeEnemyUnit('copper_growth')] },
    { label: 'L19 БОСС Сердце', lvl: 19, ilvl: 18, rar: 'epic', units: () => [Combat.makeEnemyUnit('vein_heart')] },
    { label: 'L20 возница+паломник', lvl: 20, ilvl: 19, rar: 'rare', units: () => [Combat.makeEnemyUnit('road_driver'), Combat.makeEnemyUnit('pilgrim')] },
    { label: 'L21 БОСС Старшина', lvl: 21, ilvl: 20, rar: 'epic', units: () => [Combat.makeEnemyUnit('caravan_master')] },
    { label: 'L22 привратник+стрелок', lvl: 22, ilvl: 21, rar: 'epic', units: () => [Combat.makeEnemyUnit('gatekeeper'), Combat.makeEnemyUnit('tower_archer')] },
    { label: 'L23 БОСС Привратник', lvl: 23, ilvl: 22, rar: 'epic', units: () => [Combat.makeEnemyUnit('gate_warden')] },
    { label: 'L24 жрец+безымянный', lvl: 24, ilvl: 23, rar: 'epic', units: () => [Combat.makeEnemyUnit('hor_priest'), Combat.makeEnemyUnit('nameless')] },
    { label: 'L25 БОСС Тот, Кто Спросил', lvl: 25, ilvl: 24, rar: 'epic', units: () => [Combat.makeEnemyUnit('the_question')] },
  ];

  function report(n = 80, from = 0) {
    const out = [];
    for (const sc of SCENARIOS.slice(from)) {
      out.push(`--- ${sc.label}`);
      for (const cid of CLASS_ORDER) {
        const row = [];
        for (const tree of [0, 1]) {
          const hero = () => makeHero(cid, sc.lvl, { tree, ilvl: sc.ilvl, rarity: sc.rar });
          row.push(fmt(stats(n, hero, sc.units, 'smart', { potions: 2 })));
        }
        const dumb = stats(n, () => makeHero(cid, sc.lvl, { ilvl: sc.ilvl, rarity: sc.rar }), sc.units, 'dumb', { potions: 0 });
        out.push(`${cid.padEnd(8)} A ${row[0]} | B ${row[1]} | тупой ${fmt(dumb)}`);
      }
    }
    return out.join('\n');
  }

  /* ---------- полное прохождение региона, как обычный игрок ---------- */
  function talkAll() {
    for (const id of Object.keys(NPCS)) {
      const n = NPCS[id];
      let node = n.entry.find(e => !e.if || Game.testCond(e.if)).go;
      for (let i = 0; i < 6 && node; i++) {
        const nd = n.nodes[node];
        if (!nd || !nd.opts) break;
        const opts = nd.opts.filter(o => !o.if || Game.testCond(o.if));
        const o = opts[0];
        if (!o) break;
        if (o.do) Game.applyDo(o.do);
        node = o.end ? null : o.go;
      }
    }
    if (Game.state.names > 0) Game.readNames();
    for (const c of Game.state.contracts.slice()) Game.claimContract(c.id);
    if (Game.state.contracts.length === 0) Game.refreshContracts(true);
  }

  function gearScore(it) {
    if (!it) return -1;
    const st = Game.itemStats(it);
    let v = 0;
    const cls = CLASSES[Game.state.hero.classId];
    for (const k in st) v += st[k] * ({ dmg: 3, armor: 1.4, hp: 0.3, vit: 1.6, [cls.scale]: 2.4 }[k] || 0.3);
    return v + (it.unique ? 8 : 0);
  }

  function manageHero(tree = 0) {
    const h = Game.state.hero;
    const cls = CLASSES[h.classId];
    while (h.attrPoints > 0) Game.spendAttr(h.attrs.vit * 1.5 < h.attrs[cls.scale] ? 'vit' : cls.scale);
    let took = true;
    while (h.talentPoints > 0 && took) {
      took = false;
      const nodes = cls.trees[tree].nodes.slice().sort((a, b) => a.tier - b.tier);
      for (const n of nodes) if (Game.talentState(n.id) === 'available') { Game.takeTalent(n.id); took = true; break; }
    }
    for (const it of h.inventory.filter(x => x.type === 'gear')) {
      if (gearScore(it) > gearScore(h.equipment[it.slot]) + 0.1) Game.equip(it.uid);
    }
    for (const id of ['force', 'body', 'skin', 'eye', 'pace']) while (Game.takeMastery(id).ok);
    if (!Game.state.expedition) for (const r of h.runes) Game.insertRune(r.uid);
    h.loadout = Game.knownSkills().slice(-4).concat([null, null, null, null]).slice(0, 4);
  }

  function townVisit() {
    const h = Game.state.hero;
    talkAll();
    manageHero();
    for (const it of h.inventory.filter(x => x.type === 'gear' && !Object.values(h.equipment).includes(x))) {
      if (h.inventory.filter(x => x.type === 'gear').length > 8) Game.sellItem(it.uid);
    }
    Game.innRest();
    // запас: 3 отвара, если есть деньги
    const shop = Game.shop('apothecary');
    for (let i = 0; i < 4 && Game.consumableQty('potion_small') < 4; i++) {
      const idx = shop.stock.findIndex(e => e.cid === 'potion_small');
      if (idx < 0 || h.gold < shop.stock[idx].price + 20) break;
      Game.buy('apothecary', idx);
    }
    // заточка оружия, если хватает
    const w = h.equipment.weapon;
    if (w && (w.level || 0) < ECONOMY.upgradeMax) Game.upgradeItem(w.uid);
  }

  function playBattle(node) {
    const enc = Game.encounterFor(node);
    const c = Game.beginBattle(enc);
    const hero = Game.state.hero;
    const potions = { n: Game.consumableQty('potion_small') };
    Combat.advance(c);
    let turns = 0, safety = 0;
    while (!c.over && safety++ < 400) {
      const before = potions.n;
      bots.smart(c, hero, potions);
      if (potions.n < before) Game.spendConsumable('potion_small');
      c.ev.length = 0;
      turns++;
    }
    const res = Game.finishBattle(c);
    return { res, turns, hp: Game.state.hero.hp, boss: !!enc.boss };
  }

  function playExpedition(zoneId, log) {
    const st = Game.state;
    const r = Game.startExpedition(zoneId);
    if (!r.ok) throw new Error('не удалось начать вылазку');
    let fights = 0, turnsTotal = 0;
    for (let guard = 0; guard < 40; guard++) {
      const e = st.expedition;
      if (!e) return { result: 'gone', fights, turnsTotal };
      const s = Game.heroStats();
      const hpF = st.hero.hp / s.maxHp;
      manageHero();
      if (hpF < 0.3) {
        // сперва подлечиться, потом решать
        if (Game.consumableQty('bandage')) Game.useFieldConsumable('bandage');
        else if (Game.consumableQty('potion_small')) Game.useFieldConsumable('potion_small');
      }
      const cur = e.nodes[e.at];
      // разумный игрок уходит, пока жив, а не идёт в бой с пустыми руками
      if (st.hero.hp / s.maxHp < 0.35 && Game.consumableQty('potion_small') === 0 && Game.consumableQty('bandage') === 0) {
        Game.retreat(false);
        return { result: 'retreat', fights, turnsTotal };
      }
      if (!cur.links.length) { Game.retreat(true); return { result: 'end', fights, turnsTotal }; }
      const opts = cur.links.map(id => e.nodes[id]);
      const pref = t => (hpF < 0.5
        ? { camp: 0, event: 1, cache: 1, shrine: 2, peddler: 2, battle: 3, elite: 5, boss: 4, grave: 4 }
        : { grave: 0, battle: 1, cache: 1, event: 2, elite: hpF > 0.75 ? 1 : 4, camp: 2, shrine: 2, peddler: 3, boss: 1 })[t];
      opts.sort((a, b) => pref(a.type) - pref(b.type));
      const next = opts[0];
      if (next.type === 'boss' && hpF < 0.65) {
        const rc = Game.retreatCost();
        if (rc.free || hpF < 0.4) { Game.retreat(false); return { result: 'retreat', fights, turnsTotal }; }
      }
      Game.moveTo(next.id);
      let fight = false;
      if (['battle', 'elite', 'boss', 'grave'].includes(next.type)) fight = true;
      else if (next.type === 'event') {
        const ev = Game.eventFor();
        const idx = ev.opts.findIndex(o => !o.if || Game.testCond(o.if));
        const res = Game.resolveEventOption(ev, idx);
        if (res.fight) fight = true;
      } else if (next.type === 'camp') {
        Game.campAction(hpF < 0.75 ? 'rest' : 'sharpen');
      } else if (next.type === 'cache') {
        if (Game.openCache().trap) fight = true;
      } else if (next.type === 'shrine') {
        Game.applyDo({ hurt: 15, blessing: 2 });
      }
      if (fight) {
        const nodeForFight = next.type === 'event' || next.type === 'cache' ? { id: next.id, type: 'battle' } : next;
        const b = playBattle(nodeForFight);
        fights++;
        turnsTotal += b.turns;
        if (!b.res.win) {
          Game.onDeath();
          return { result: 'death', fights, turnsTotal, at: next.type };
        }
        if (b.boss) {
          Game.markNodeDone(next.id);
          Game.retreat(true);
          return { result: 'boss', fights, turnsTotal };
        }
      }
      Game.markNodeDone(next.id);
    }
    Game.retreat(true);
    return { result: 'guard', fights, turnsTotal };
  }

  function campaign(classId, maxRuns = 400, goal = 'ash_tar') {
    Game.reset();
    Game.newGame('Бот', classId);
    Game.state.settings.sound = false;
    const st = Game.state;
    const log = [];
    let totalFights = 0, totalTurns = 0, deaths = 0, retreats = 0;
    const milestones = {};
    for (let run = 1; run <= maxRuns; run++) {
      townVisit();
      const zone = ZONE_ORDER.slice().reverse().find(z => Game.zoneOpen(z) && st.hero.level >= ZONES[z].level - (st.cleared[z] ? 0 : 0) ) || 'ash_fields';
      const r = playExpedition(zone, log);
      totalFights += r.fights; totalTurns += r.turnsTotal;
      if (r.result === 'death') deaths++;
      if (r.result === 'retreat') retreats++;
      if (r.result === 'boss' && !milestones[zone]) milestones[zone] = { run, lvl: st.hero.level, deaths, fights: totalFights };
      if (st.cleared[goal]) { townVisit(); break; }
    }
    return {
      cls: classId, runs: st.stats.runs, level: st.hero.level, fights: totalFights, turns: totalTurns, deaths, retreats,
      minutes: Math.round(totalTurns * 2.6 / 60 + st.stats.runs * 1.5),
      milestones, quests: Object.keys(st.quests).filter(q => st.quests[q].done).length + '/' + Object.keys(QUESTS).length,
      gold: st.hero.gold, dust: st.hero.dust, done: !!st.cleared[goal], regionFlag: Game.flag('region_done'), region2: Game.flag('region2_done'), region3: Game.flag('region3_done'), runes: st.hero.runes.length, talents: st.hero.talents.length,
    };
  }

  return { makeHero, fight, stats, report, SCENARIOS, campaign };
})();
