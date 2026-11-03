'use strict';

/* ============================================================
   ПОШАГОВЫЙ БОЙ
   Чистая логика без DOM. Всё происходит сразу, а для анимации в c.ev
   копятся события — сцена проигрывает их по порядку. Так же бой
   гоняет симулятор баланса (tools/sim.js).
   ============================================================ */

const Combat = (() => {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const STACK_CAP = 25;
  const ENRAGE_TURN = 60;

  function makeHeroUnit(h) {
    return {
      side: 'hero', key: 'hero', name: h.name, lvl: h.level, cls: h.classId,
      hp: h.hp, maxHp: h.maxHp, shield: 0, armor: h.armor, speed: h.speed,
      power: h.power, crit: h.crit, critDmg: h.critDmg, dodge: h.dodge, lifesteal: h.lifesteal,
      mods: h.mods, on: h.on, flags: h.flags, res: 0, resId: h.resId, resMax: h.resMax,
      cds: {}, lastSkill: null, statuses: {}, next: 0, used: {},
      guardGain: h.guardGain, minion: null,
    };
  }

  function makeEnemyUnit(id, opts = {}) {
    const def = ENEMIES[id];
    const lvl = opts.lvl != null ? opts.lvl : def.lvl;
    const hm = 1 + (opts.hmar || 0) * SCALE.hmarHp;
    const am = 1 + (opts.hmar || 0) * SCALE.hmarAtk;
    const lv = lvl - def.lvl;
    const a = opts.affix;
    return {
      side: 'enemy', key: null, id, def, name: a ? `${a.name} ${def.name.toLowerCase()}` : def.name,
      lvl, boss: !!def.boss, elite: !!a || !!def.elite, affix: a || null,
      hp: 0, maxHp: Math.round(def.hp * (1 + 0.26 * lv) * hm * (a ? a.hp : 1) * (opts.hpMul || 1)),
      shield: 0, armor: Math.round((def.armor + lv * 1.2) + (a && a.armor || 0)),
      atk: def.atk * (1 + 0.2 * lv) * am * (a ? a.atk : 1) * (opts.atkMul || 1),
      speed: def.speed + (a && a.speed || 0),
      crit: def.boss ? 8 : 5, critDmg: 150, dodge: 0, lifesteal: 0, statuses: {}, next: 0,
      cds: {}, intent: null, phase: 0, stunCd: 0,
      tint: a && a.tint || def.tint, accent: def.accent, shape: def.shape, look: def.look, size: def.size || 1,
    };
  }

  function start(hero, enemies, opts = {}) {
    const c = {
      hero: makeHeroUnit(hero), enemies: [], ev: [], time: 0, over: false, result: null,
      opts, turnNo: 0, awaiting: null, itemUsed: false, keyN: 0,
    };
    c.hero.next = 1000 / statSpeed(c.hero) * 0.5;
    for (const e of enemies) addEnemy(c, e);
    if (opts.blessing) applyStatus(c, c.hero, c.hero, 'might', { turns: 2 });
    if (opts.omen) applyStatus(c, c.hero, c.hero, 'weak', { turns: 2 });
    if (c.hero.flags.startMinion) c.hero.minion = { turns: c.hero.flags.startMinion };
    for (const eff of (c.hero.on.start || [])) runEffect(c, c.hero, eff, { target: c.enemies[0], spent: 0 });
    return c;
  }

  function addEnemy(c, u) {
    u.hp = u.maxHp;
    u.key = 'e' + (++c.keyN);
    u.next = c.time + 1000 / statSpeed(u) * rnd(0.55, 1.05);
    c.enemies.push(u);
    pickIntent(c, u, true);
    return u;
  }

  const alive = list => list.filter(u => u.hp > 0);
  const aliveEnemies = c => alive(c.enemies);

  function has(u, s) { return u.statuses[s] ? (u.statuses[s].stacks || u.statuses[s].turns || 0) : 0; }

  function statSpeed(u) {
    let sp = u.speed;
    if (u.statuses.haste) sp *= 1.3;
    if (u.statuses.slow) sp *= 0.7;
    return Math.max(25, sp);
  }

  function push(c, e) { c.ev.push(e); }
  function log(c, text, cls = '') { push(c, { t: 'log', text, cls }); }

  /* ---------- статусы ---------- */
  function applyStatus(c, from, to, s, o = {}) {
    if (to.hp <= 0) return;
    const def = STATUSES[s];
    if (s === 'silence' && to.statuses.deaf) { push(c, { t: 'float', who: to.key, text: 'Не слышно', cls: 'good' }); return; }
    if (s === 'stun') {
      if (to.stunCd > 0) { push(c, { t: 'float', who: to.key, text: 'Устоял', cls: 'info' }); return; }
      to.stunCd = to.boss ? 4 : 2;
      if (to.intent && to.intent.heavy) interrupt(c, to, from);
    }
    const stacked = o.stacks != null;
    let stacks = o.stacks || 0;
    if (from && from.mods) {
      if (s === 'poison') stacks += from.mods.poisonExtra || 0;
      if (s === 'burn') stacks += from.mods.burnExtra || 0;
      if (s === 'curse') stacks += from.mods.curseExtra || 0;
    }
    const cur = to.statuses[s];
    if (stacked) {
      const unit = dotUnit(from, s);
      to.statuses[s] = { stacks: Math.min(STACK_CAP, (cur ? cur.stacks : 0) + stacks), unit: Math.max(unit, cur ? cur.unit : 0), noDecay: from && from.flags && from.flags.poisonSticky && s === 'poison' };
    } else {
      // ходы считаются в конце своего хода, поэтому свой бафф живёт на один тик дольше
      const turns = (o.turns || 1) + (from === to ? 1 : 0);
      to.statuses[s] = { turns: Math.max(turns, cur ? cur.turns : 0) };
    }
    push(c, { t: 'status', who: to.key, s, bad: !!def.bad, text: def.name });
  }

  function dotUnit(from, s) {
    if (!from) return 2;
    const base = from.side === 'hero' ? 1.1 + from.power * 0.09 : 0.9 + from.atk * 0.11;
    const pct = from.mods ? (from.mods.dotPct || 0) : 0;
    return base * (s === 'poison' ? 0.8 : 1) * (1 + pct / 100);
  }

  function cleanse(c, u) {
    for (const s in u.statuses) if (STATUSES[s].bad) delete u.statuses[s];
    push(c, { t: 'float', who: u.key, text: 'Очищение', cls: 'good' });
  }

  /* Срыв тяжёлого удара — главная награда за внимательность */
  function interrupt(c, u, by) {
    const name = u.intent ? u.intent.name : '';
    u.intent = null;
    u.statuses.stagger = { turns: 2 };
    push(c, { t: 'interrupt', who: u.key });
    log(c, `<b>Замах сорван!</b> ${u.name} теряет «${name}» и открывается для ударов.`, 'good');
    pickIntent(c, u, true);
    if (by && by.side === 'hero' && by.resId === 'rage') gainRes(c, by, 15);
  }

  /* ---------- ресурс героя ---------- */
  function gainRes(c, h, n) {
    if (!n || !h.resId) return;
    const before = h.res;
    h.res = Math.max(0, Math.min(h.resMax, h.res + n));
    if (h.resId === 'heat' && h.res >= h.resMax) overheat(c, h);
    if (h.resId === 'souls' && h.res > before && h.flags.soulHeal) heal(c, h, h.maxHp * h.flags.soulHeal * (h.res - before), true);
    push(c, { t: 'res', value: h.res });
  }

  function overheat(c, h) {
    h.res = 0;
    if (h.flags.overheatExplode) {
      log(c, '<b>Перекал!</b> Жар вырывается наружу.', 'crit');
      push(c, { t: 'fx', fx: 'firewave', who: 'all' });
      for (const e of aliveEnemies(c)) deal(c, h, e, h.power * 2, { kind: 'fire', noCrit: true, noHooks: true });
    } else {
      const d = Math.round(h.maxHp * 0.14);
      log(c, `<b>Перегрев!</b> Огонь обжигает тебя на ${d}.`, 'bad');
      push(c, { t: 'fx', fx: 'fire', who: 'hero' });
      hurtDirect(c, h, d, 'fire');
    }
  }

  function resBonus(h) {
    if (h.resId === 'heat') return Math.floor(h.res / 10) * 2;
    if (h.resId === 'lad') return h.res * (5 + (h.mods.ladPct || 0));
    return 0;
  }

  /* ---------- урон ---------- */
  function heal(c, u, amount, quiet) {
    if (u.hp <= 0) return 0;
    let n = amount * (u.mods ? 1 + (u.mods.healPct || 0) / 100 : 1);
    n = Math.round(Math.min(u.maxHp - u.hp, n));
    if (n <= 0) return 0;
    u.hp += n;
    push(c, { t: 'heal', who: u.key, n, hp: u.hp, quiet });
    return n;
  }

  function addShield(c, u, n) {
    n = Math.round(n);
    u.shield = Math.max(u.shield, 0) + n;
    push(c, { t: 'shield', who: u.key, n, shield: u.shield });
  }

  function absorb(u, dmg) {
    if (u.shield <= 0) return { dmg, absorbed: 0 };
    const a = Math.min(u.shield, dmg);
    u.shield -= a;
    return { dmg: dmg - a, absorbed: a };
  }

  /* Прямая потеря здоровья: эффекты, перегрев, плата */
  function hurtDirect(c, u, dmg, kind) {
    if (u.hp <= 0) return;
    const r = absorb(u, Math.max(1, Math.round(dmg)));
    u.hp -= r.dmg;
    push(c, { t: 'hit', who: u.key, dmg: r.dmg, absorbed: r.absorbed, kind, dot: true, hp: Math.max(0, u.hp), shield: u.shield });
    if (u.hp <= 0) onDeath(c, u, null);
  }

  /* Обычный удар от a по t. raw — сырой урон до множителей */
  function deal(c, a, t, raw, o = {}) {
    if (t.hp <= 0 || c.over) return 0;
    const dodgeChance = (t.dodge || 0) + (t.statuses.evade ? 50 : 0);
    if (!o.noDodge && Math.random() * 100 < dodgeChance) {
      push(c, { t: 'dodge', who: t.key });
      log(c, t.side === 'hero' ? 'Ты уходишь от удара.' : `${t.name} уклоняется.`, 'info');
      if (t.side === 'hero') trigger(c, t, 'dodge', a);
      return 0;
    }
    let pct = 100;
    if (a.side === 'hero') {
      const m = a.mods;
      pct += m.dmgPct || 0;
      pct += resBonus(a);
      if (m.lowHpDmg && a.hp / a.maxHp < m.lowHpDmg.below) pct += m.lowHpDmg.pct;
      if (m.vsStatus) for (const s in m.vsStatus) if (t.statuses[s]) pct += m.vsStatus[s];
      if (m.vsElite && (t.elite || t.boss)) pct += m.vsElite;
    }
    if (a.statuses.might) pct += 30;
    if (a.statuses.weak) pct -= 25;
    let taken = 100;
    if (t.statuses.vuln) taken += 25;
    if (t.statuses.stagger) taken += 30;
    if (t.statuses.curse) {
      const per = 6 + (a.mods ? a.mods.curseDmg || 0 : 0);
      taken += t.statuses.curse.stacks * per;
    }
    const critRoll = !o.noCrit && (o.alwaysCrit || Math.random() * 100 < (a.crit + (o.critBonus || 0)));
    let dmg = raw * (pct / 100) * (taken / 100) * rnd(0.92, 1.08);
    if (critRoll) dmg *= a.critDmg / 100;
    const K = 25 + a.lvl * 5;
    const armor = Math.max(0, t.armor * (1 - (o.pierce || 0)) * (t.statuses.corrode ? 0.6 : 1));
    dmg *= 1 - Math.min(0.75, armor / (armor + K));
    let parried = false;
    if (t.statuses.guard) {
      dmg *= o.heavy ? 0.3 : 0.45;
      parried = !!o.heavy;
    }
    dmg = Math.max(1, Math.round(dmg));
    const r = absorb(t, dmg);
    t.hp -= r.dmg;
    if (a.side === 'hero' && c.opts.track) c.opts.track.dealt = (c.opts.track.dealt || 0) + dmg;
    push(c, { t: 'hit', who: t.key, by: a.key, dmg: r.dmg, absorbed: r.absorbed, crit: critRoll, kind: o.kind || 'phys', heavy: !!o.heavy, guarded: !!t.statuses.guard, hp: Math.max(0, t.hp), shield: t.shield });
    if (parried) log(c, 'Тяжёлый удар пришёлся в защиту.', 'good');

    // кража жизни
    const ls = (o.lifesteal || 0) + (a.lifesteal || 0) / 100;
    if (ls > 0 && a.hp > 0) heal(c, a, dmg * ls, true);

    if (a.side === 'hero' && !o.noHooks) {
      if (critRoll) trigger(c, a, 'crit', t);
      if (t.hp > 0) trigger(c, a, 'hit', t);
    }
    if (t.statuses.reflect && a.hp > 0) {
      push(c, { t: 'float', who: a.key, text: 'Отражено', cls: 'bad' });
      hurtDirect(c, a, dmg * 0.4, 'phys');
      if (c.over) return dmg;
    }
    if (t.side === 'hero' && t.hp > 0) {
      if (t.resId === 'rage') gainRes(c, t, 8);
      if (!o.noHooks) trigger(c, t, 'hurt', a);
      if (t.mods.thorns && a.hp > 0) hurtDirect(c, a, dmg * t.mods.thorns / 100, 'phys');
      if (t.statuses.counter && a.hp > 0 && !o.counter) {
        push(c, { t: 'act', who: 'hero', anim: 'thrust', fast: true, target: a.key });
        log(c, 'Контрудар!', 'good');
        deal(c, t, a, t.power * 0.9, { counter: true, noHooks: true, noDodge: true });
      }
    }
    if (t.hp <= 0) onDeath(c, t, a);
    checkPhases(c, t);
    return dmg;
  }

  function onDeath(c, u, killer) {
    if (u.dead) return;
    if (u.side === 'hero') {
      if (u.flags.cheatDeath && !u.used.cheat) {
        u.used.cheat = true;
        u.hp = 1;
        push(c, { t: 'hit', who: u.key, dmg: 0, hp: 1, shield: u.shield, kind: 'phys' });
        log(c, '<b>Не сегодня.</b> Ты встаёшь, хотя не должен был.', 'crit');
        addShield(c, u, u.maxHp * u.flags.cheatDeath);
        push(c, { t: 'fx', fx: 'phoenix', who: 'hero' });
        if (u.flags.yewStagger) for (const e of aliveEnemies(c)) applyStatus(c, u, e, 'stagger', { turns: 2 });
        return;
      }
      if (u.flags.phoenix && !u.used.phoenix) {
        u.used.phoenix = true;
        u.hp = Math.round(u.maxHp * u.flags.phoenix);
        push(c, { t: 'heal', who: u.key, n: u.hp, hp: u.hp });
        push(c, { t: 'fx', fx: 'phoenix', who: 'hero' });
        log(c, '<b>Феникс!</b> Пепел складывается обратно в тебя.', 'crit');
        for (const e of aliveEnemies(c)) applyStatus(c, u, e, 'burn', { stacks: 6 });
        return;
      }
      u.dead = true;
      u.hp = 0;
      push(c, { t: 'die', who: u.key });
      c.over = true;
      c.result = { win: false };
      return;
    }
    u.dead = true;
    u.hp = 0;
    push(c, { t: 'die', who: u.key });
    log(c, `${u.name} падает.`, 'kill');
    if (c.opts.onKill) c.opts.onKill(u);
    const h = c.hero;
    // рудничный газ и прочие: взрываются напоследок
    if (u.def.deathBlast && h.hp > 0) {
      push(c, { t: 'fx', fx: 'firewave', who: 'hero' });
      log(c, `${u.name} лопается. Отойти никто не успел.`, 'bad');
      hurtDirect(c, h, u.atk * u.def.deathBlast * 0.6, 'burn');
      if (c.over) return;
    }
    if (h.flags.plagueSpread && u.statuses.poison) {
      for (const e of aliveEnemies(c)) applyStatus(c, h, e, 'poison', { stacks: u.statuses.poison.stacks });
      log(c, 'Чума перекидывается на остальных.', 'good');
    }
    trigger(c, h, 'kill', u);
    if (!aliveEnemies(c).length) {
      c.over = true;
      c.result = { win: true };
    }
  }

  /* Пассивные срабатывания: талантов и вещей */
  function trigger(c, u, event, other) {
    const list = u.on && u.on[event];
    if (!list || c.over) return;
    if (u._inTrigger) return;
    u._inTrigger = true;
    for (const eff of list) runEffect(c, u, eff, { target: other, spent: 0 });
    u._inTrigger = false;
  }

  /* ---------- эффекты умений ---------- */
  function runEffect(c, a, e, ctx) {
    const t = ctx.target;
    if (e.chance != null && e.apply && Math.random() > e.chance) return;
    if (e.apply) {
      if (e.ifRes && ctx.spent < e.ifRes) return;
      if (e.to === 'self') { applyStatus(c, a, a, e.apply, e); return; }
      if (e.to === 'allEnemies') { for (const x of aliveEnemies(c)) applyStatus(c, a, x, e.apply, e); return; }
      if (t && t.hp > 0) applyStatus(c, a, t, e.apply, e);
      return;
    }
    if (e.applyAttacker) { if (t && t.hp > 0) applyStatus(c, a, t, e.applyAttacker, e); return; }
    if (e.dmg != null) {
      if (!t || t.hp <= 0) return;
      let mult = e.dmg;
      if (e.lowHp && t.hp / t.maxHp < e.lowHp.below) mult *= e.lowHp.mul;
      if (e.perRes) mult += e.perRes * ctx.spent;
      if (e.perShield) mult += e.perShield * Math.min(1, a.shield / a.maxHp);
      const opts = { kind: ctx.skill ? ctx.skill.kind || 'phys' : 'phys', alwaysCrit: e.alwaysCrit, lifesteal: e.lifesteal, pierce: e.pierce };
      const hits = e.hits || 1;
      for (let i = 0; i < hits; i++) {
        if (t.hp <= 0) break;
        deal(c, a, t, a.power * mult, opts);
        if (a.resId === 'lad' && a.res >= a.resMax && a.mods.echo && t.hp > 0) {
          push(c, { t: 'float', who: t.key, text: 'Эхо', cls: 'info' });
          deal(c, a, t, a.power * mult * a.mods.echo / 100, Object.assign({}, opts, { noHooks: true, noDodge: true }));
        }
      }
      return;
    }
    if (e.detonate) {
      if (!t || t.hp <= 0) return;
      const st = t.statuses[e.detonate];
      if (!st) { log(c, 'На цели нет яда.', 'info'); return; }
      const n = st.stacks;
      delete t.statuses[e.detonate];
      log(c, `Яд взрывается: ${n} стаков.`, 'good');
      deal(c, a, t, a.power * e.perStack * n, { kind: 'poison', noDodge: true });
      return;
    }
    if (e.shield) { addShield(c, a, a.maxHp * e.shield); return; }
    if (e.shieldPerRes) { addShield(c, a, a.maxHp * e.shieldPerRes * ctx.spent); return; }
    if (e.heal) {
      const mul = e.perResHeal ? ctx.spent : 1;
      if (mul > 0) heal(c, a, a.maxHp * e.heal * mul, false);
      return;
    }
    if (e.gainRes) { gainRes(c, a, e.gainRes); return; }
    if (e.resetCd) { delete a.cds[e.resetCd]; return; }
    if (e.delay) { if (t && t.hp > 0) { t.next += (1000 / statSpeed(t)) * e.delay / 100; push(c, { t: 'float', who: t.key, text: 'Потеря темпа', cls: 'info' }); } return; }
    if (e.cleanse) { if (a.side === 'hero') cleanse(c, a); return; }
    if (e.summon) {
      a.minion = { turns: e.turns };
      push(c, { t: 'summon', who: 'hero', minion: e.summon });
      log(c, 'Кости встают рядом с тобой.', 'good');
    }
  }

  /* ---------- действия героя ---------- */
  function skillState(c, id) {
    const h = c.hero;
    const sk = SKILLS[id];
    if (!sk) return { ok: false };
    const cd = h.cds[id] || 0;
    if (cd > 0) return { ok: false, why: `Откат ${cd}`, cd };
    if (h.statuses.silence && !sk.basic) return { ok: false, why: 'Немота' };
    if (sk.cost === 'all' && h.res < 1) return { ok: false, why: `Нужно: ${RESOURCES[h.resId].name}` };
    if (typeof sk.cost === 'number' && sk.cost > 0 && h.res < sk.cost) return { ok: false, why: `Нужно ${sk.cost}` };
    return { ok: true };
  }

  function useSkill(c, id, targetKey) {
    const h = c.hero;
    if (c.awaiting !== 'hero' || c.over) return { ok: false };
    const sk = SKILLS[id];
    const st = skillState(c, id);
    if (!st.ok) return st;
    const single = !sk.target || sk.target === 'enemy';
    let t = c.enemies.find(e => e.key === targetKey && e.hp > 0) || aliveEnemies(c)[0];
    const targets = sk.target === 'all' ? aliveEnemies(c) : sk.target === 'self' ? [] : [t];

    let spent = 0;
    if (sk.cost === 'all') { spent = h.res; h.res = 0; push(c, { t: 'res', value: 0 }); }
    else if (typeof sk.cost === 'number' && sk.cost > 0) { spent = sk.cost; gainRes(c, h, -sk.cost); }
    if (sk.cd) h.cds[id] = sk.cd + 1;

    c.awaiting = null;
    push(c, { t: 'act', who: 'hero', anim: sk.anim || 'slash', fx: sk.fx, target: single && t ? t.key : (sk.target === 'all' ? 'all' : 'hero'), name: sk.name, kind: sk.kind, basic: !!sk.basic, keys: targets.map(x => x.key) });
    log(c, `Ты: <b>${sk.name}</b>`, 'you');

    for (const e of sk.effects) {
      if (c.over) break;
      if (sk.target === 'self' || e.to === 'self' || e.shield || e.heal || e.shieldPerRes || e.cleanse || e.summon || (e.gainRes)) {
        runEffect(c, h, e, { target: t, spent, skill: sk });
      } else {
        for (const x of targets) {
          if (c.over) break;
          runEffect(c, h, e, { target: x, spent, skill: sk });
        }
      }
    }
    if (!c.over && (sk.tags || []).includes('interrupt')) {
      for (const x of targets) if (x.hp > 0 && x.intent && x.intent.heavy) interrupt(c, x, h);
    }

    if (!c.over) {
      if (sk.gain) gainRes(c, h, sk.gain);
      if (h.resId === 'lad' && !c.over) {
        if (spent === 0 || sk.cost !== 'all') {
          if (h.lastSkill === id) {
            const was = h.res;
            h.res = h.flags.ladKeep ? Math.max(0, h.res - 1) : 0;
            if (was > 0) push(c, { t: 'float', who: 'hero', text: 'Лад сбит', cls: 'bad' });
          } else {
            h.res = Math.min(h.resMax, h.res + 1);
          }
          push(c, { t: 'res', value: h.res });
        }
        if (h.flags.fullLadShield && h.res >= h.resMax) addShield(c, h, h.maxHp * h.flags.fullLadShield);
      }
      h.lastSkill = id;
      trigger(c, h, 'skill', t);
      endHeroTurn(c);
    }
    return { ok: true };
  }

  function guard(c) {
    const h = c.hero;
    if (c.awaiting !== 'hero' || c.over) return { ok: false };
    c.awaiting = null;
    push(c, { t: 'act', who: 'hero', anim: 'guardup', fx: 'shield', target: 'hero', name: 'Защита' });
    log(c, 'Ты закрываешься и ждёшь удара.', 'you');
    h.statuses.guard = { turns: 1 };
    push(c, { t: 'status', who: 'hero', s: 'guard', text: 'Защита' });
    if (h.mods.guardShield) addShield(c, h, h.maxHp * h.mods.guardShield / 100);
    if (h.guardGain) gainRes(c, h, h.guardGain);
    if (h.resId === 'lad' && !h.flags.guardKeepsLad && h.res > 0) { h.res = 0; push(c, { t: 'res', value: 0 }); push(c, { t: 'float', who: 'hero', text: 'Лад сбит', cls: 'bad' }); }
    h.lastSkill = null;
    trigger(c, h, 'guard', null);
    endHeroTurn(c);
    return { ok: true };
  }

  /* Расходник: один за ход, ход не тратит */
  function useItem(c, def) {
    const h = c.hero;
    if (c.awaiting !== 'hero' || c.over || c.itemUsed) return { ok: false, msg: 'За ход можно использовать один расходник.' };
    c.itemUsed = true;
    push(c, { t: 'act', who: 'hero', anim: def.aoe ? 'throw' : 'drink', fx: def.aoe ? 'firewave' : (def.heal ? 'heal' : 'buff'), target: def.aoe ? 'all' : 'hero', name: def.name });
    log(c, `Ты используешь «${def.name}».`, 'you');
    if (def.cleanse) cleanse(c, h);
    if (def.heal) heal(c, h, h.maxHp * def.heal, false);
    if (def.status) applyStatus(c, h, h, def.status, { turns: def.turns });
    if (def.aoe) {
      for (const e of aliveEnemies(c)) {
        deal(c, h, e, h.power * def.aoe, { kind: 'fire', noDodge: true, noHooks: true });
        if (def.burn && e.hp > 0) applyStatus(c, h, e, 'burn', { stacks: def.burn });
      }
    }
    return { ok: true };
  }

  function flee(c) {
    if (c.awaiting !== 'hero' || c.over) return { ok: false };
    if (c.opts.noFlee) return { ok: false, msg: 'Отсюда не уйти.' };
    c.awaiting = null;
    if (Math.random() < 0.55 + (c.hero.dodge || 0) / 100) {
      c.over = true;
      c.result = { win: false, fled: true };
      log(c, 'Ты отступаешь в пепел, не оглядываясь.', 'info');
      push(c, { t: 'flee' });
      return { ok: true, fled: true };
    }
    log(c, 'Сбежать не удалось!', 'bad');
    push(c, { t: 'float', who: 'hero', text: 'Не вышло', cls: 'bad' });
    endHeroTurn(c);
    return { ok: true, fled: false };
  }

  function endHeroTurn(c) {
    const h = c.hero;
    if (!c.over && h.minion && h.minion.turns > 0) {
      const tgt = aliveEnemies(c)[Math.floor(Math.random() * aliveEnemies(c).length)];
      if (tgt) {
        push(c, { t: 'minionHit', target: tgt.key });
        const pct = 45 * (1 + (h.mods.minionPct || 0) / 100);
        deal(c, h, tgt, h.power * pct / 100, { noHooks: true, noCrit: true, kind: 'dark', noDodge: true });
      }
      h.minion.turns--;
      if (h.minion.turns <= 0) { h.minion = null; push(c, { t: 'unsummon' }); log(c, 'Кости осыпаются.', 'info'); }
    }
    tickTurns(h);
    h.next = c.time + 1000 / statSpeed(h);
    if (!c.over) advance(c);
  }

  /* ---------- порядок ходов ---------- */
  function nextActor(c) {
    let best = c.hero;
    for (const e of aliveEnemies(c)) if (e.next < best.next) best = e;
    return best;
  }

  function turnOrder(c, n = 8) {
    const units = [c.hero, ...aliveEnemies(c)].map(u => ({ u, next: u.next, step: 1000 / statSpeed(u) }));
    const out = [];
    for (let i = 0; i < n; i++) {
      units.sort((a, b) => a.next - b.next);
      out.push(units[0].u);
      units[0].next += units[0].step;
    }
    return out;
  }

  /* Запускает следующие ходы, пока очередь не дойдёт до героя */
  function advance(c) {
    let guardLoop = 0;
    while (!c.over && guardLoop++ < 200) {
      const u = nextActor(c);
      c.time = Math.max(c.time, u.next);
      if (u.side === 'hero') {
        heroTurnStart(c);
        if (c.over) return;
        if (c.awaiting === 'hero') return;
        continue;
      }
      enemyTurn(c, u);
    }
  }

  function tickDots(c, u) {
    for (const s of ['bleed', 'poison', 'burn']) {
      const st = u.statuses[s];
      if (!st || u.hp <= 0) continue;
      const mul = s === 'bleed' ? 1.2 : s === 'burn' ? 1.1 : 1;
      const d = Math.max(1, Math.round(st.stacks * st.unit * mul));
      push(c, { t: 'float', who: u.key, text: STATUSES[s].name, cls: 'dot', s });
      hurtDirect(c, u, d, s);
      if (!u.statuses[s]) continue;
      if (!st.noDecay) st.stacks -= (s === 'burn' ? 2 : 1);
      if (st.stacks <= 0) delete u.statuses[s];
      if (c.over) return;
      checkPhases(c, u);
    }
    if (u.statuses.regen && u.hp > 0) {
      heal(c, u, u.statuses.regen.stacks * 3, true);
      u.statuses.regen.stacks--;
      if (u.statuses.regen.stacks <= 0) delete u.statuses.regen;
    }
  }

  function tickTurns(u) {
    for (const s in u.statuses) {
      const st = u.statuses[s];
      if (st.turns != null && s !== 'guard') {
        st.turns--;
        if (st.turns <= 0) delete u.statuses[s];
      }
    }
  }

  function heroTurnStart(c) {
    const h = c.hero;
    c.turnNo++;
    delete h.statuses.guard;
    for (const id in h.cds) { if (h.cds[id] > 0) h.cds[id]--; }
    tickDots(c, h);
    if (c.over) return;
    if (h.statuses.stun) {
      delete h.statuses.stun;
      push(c, { t: 'float', who: 'hero', text: 'Оглушён', cls: 'bad' });
      log(c, 'Ты оглушён и пропускаешь ход.', 'bad');
      tickTurns(h);
      h.next = c.time + 1000 / statSpeed(h);
      return;
    }
    if (h.stunCd > 0) h.stunCd--;
    c.itemUsed = false;
    c.awaiting = 'hero';
    push(c, { t: 'heroTurn' });
  }

  function enemyTurn(c, u) {
    delete u.statuses.guard;
    if (u.stunCd > 0) u.stunCd--;
    tickDots(c, u);
    if (c.over || u.hp <= 0) return;
    for (const k in u.cds) if (u.cds[k] > 0) u.cds[k]--;
    u.next = c.time + 1000 / statSpeed(u);
    if (u.statuses.curse && c.hero.resId === 'souls') gainRes(c, c.hero, 1);
    if (c.over) return;
    if (u.statuses.stun) {
      delete u.statuses.stun;
      push(c, { t: 'float', who: u.key, text: 'Оглушён', cls: 'info' });
      tickTurns(u);
      return;
    }
    executeMove(c, u, u.intent);
    if (c.over || u.hp <= 0) return;
    tickTurns(u);
    pickIntent(c, u);
  }

  function executeMove(c, u, m) {
    if (!m) return;
    const h = c.hero;
    if (m.name) log(c, `${u.name}: <b>${m.name}</b>`, m.heavy ? 'bad' : 'enemy');
    push(c, { t: 'act', who: u.key, anim: m.ranged ? 'ecast' : (m.heavy ? 'eheavy' : 'ebite'), target: 'hero', heavy: !!m.heavy, name: m.name, ranged: !!m.ranged });
    if (m.cd) u.cds[m.name] = m.cd + 1;
    // долгий бой с боссом не должен тянуться вечно: Хмарь на его стороне
    const late = u.boss ? Math.max(0, c.turnNo - ENRAGE_TURN) : 0;
    if (late === 1) log(c, '<b>Хмарь густеет вокруг боя.</b> С каждым ходом хозяин бьёт сильнее.', 'bad');
    if (m.mul > 0) {
      const raw = u.atk * m.mul * rnd(0.92, 1.08) * (1 + late * 0.05);
      const d = deal(c, u, h, raw, { heavy: !!m.heavy, kind: 'phys', lifesteal: (u.affix && u.affix.drain) || (m.drain ? 0.5 : 0) });
      if (c.over || d === 0) return; // увернулся — эффекты удара тоже мимо
      if (u.affix && u.affix.onHit) applyStatus(c, u, h, u.affix.onHit.s, u.affix.onHit);
    }
    for (const a of (m.apply || [])) {
      if (c.over) return;
      applyStatus(c, u, h, a.s, a);
    }
    for (const a of (m.self || [])) applyStatus(c, u, u, a.s, a);
    if (m.shieldSelf) addShield(c, u, u.maxHp * m.shieldSelf);
    if (m.healAlly) {
      const hurt = aliveEnemies(c).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
      if (hurt) heal(c, hurt, hurt.maxHp * m.healAlly);
    }
  }

  function pickIntent(c, u, soft) {
    const moves = (u.def.moves || []).filter(m => {
      if ((u.cds[m.name] || 0) > 0) return false;
      if (soft && m.heavy) return false;
      if (m.healAlly) return aliveEnemies(c).some(e => e.hp / e.maxHp < 0.7);
      return true;
    });
    const pool = moves.length ? moves : (u.def.moves || []).filter(m => !m.heavy);
    let total = pool.reduce((a, m) => a + (m.w || 1), 0);
    let r = Math.random() * total;
    let pick = pool[0];
    for (const m of pool) { r -= (m.w || 1); if (r <= 0) { pick = m; break; } }
    u.intent = pick;
    if (pick && pick.heavy && pick.warn) {
      push(c, { t: 'warn', who: u.key, text: pick.warn });
      log(c, pick.warn, 'warn');
    }
  }

  /* Прикидка урона намерения: только для подсказки игроку */
  function intentDamage(c, u) {
    if (!u.intent || !u.intent.mul) return 0;
    const h = c.hero;
    const raw = u.atk * u.intent.mul * (u.statuses.might ? 1.3 : 1) * (u.statuses.weak ? 0.75 : 1) * (h.statuses.vuln ? 1.25 : 1);
    const K = 25 + u.lvl * 5;
    const armor = h.armor * (h.statuses.corrode ? 0.6 : 1);
    return Math.max(1, Math.round(raw * (1 - Math.min(0.75, armor / (armor + K)))));
  }

  function checkPhases(c, u) {
    if (!u.boss || u.hp <= 0 || !u.def.phases) return;
    const p = u.def.phases[u.phase];
    if (!p || u.hp / u.maxHp >= p.below) return;
    u.phase++;
    push(c, { t: 'phase', who: u.key, text: p.text });
    log(c, p.text, 'phase');
    for (const a of (p.self || [])) applyStatus(c, u, u, a.s, a);
    for (const a of (p.apply || [])) applyStatus(c, u, c.hero, a.s, a);
    for (const id of (p.summon || [])) {
      if (aliveEnemies(c).length >= 4) break;
      const add = makeEnemyUnit(id, { lvl: Math.max(ENEMIES[id].lvl, u.lvl - 1), hmar: 0 });
      addEnemy(c, add);
      push(c, { t: 'spawn', who: add.key });
    }
  }

  return {
    start, advance, useSkill, guard, useItem, flee, skillState, turnOrder, intentDamage, makeEnemyUnit,
    aliveEnemies, has, statSpeed,
  };
})();
