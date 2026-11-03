'use strict';

/* ============================================================
   КЛАССЫ И ТАЛАНТЫ
   Умение — это список эффектов, бой (combat.js) исполняет их по порядку.
   Талант — либо новое умение (skill), либо пассивка (mods / on / flags).
   ============================================================ */

const ATTRS = {
  str: { name: 'Сила', short: 'СИЛ', desc: 'Урон тяжёлого оружия и умений, проверки силы. +2 здоровья.' },
  agi: { name: 'Ловкость', short: 'ЛОВ', desc: 'Урон лёгкого оружия, крит, уклонение и инициатива.' },
  wil: { name: 'Воля', short: 'ВОЛ', desc: 'Урон заклинаний, сила эффектов и лечения, проверки воли.' },
  vit: { name: 'Стойкость', short: 'СТО', desc: '+8 здоровья и +0,5 брони за очко. Держит тебя на ногах.' },
};

const RESOURCES = {
  rage:  { name: 'Ярость', max: 100, color: '#e0603c', hint: 'Копится от ударов — своих и чужих.' },
  combo: { name: 'Приёмы', max: 5, color: '#63c7b0', pips: true, hint: 'Обычные удары копят приёмы, сильные умения их тратят.' },
  heat:  { name: 'Жар', max: 100, color: '#ff9a3c', hint: '+2% урона за каждые 10 жара. На 100 — перегрев: ты обжигаешься и жар сбрасывается.' },
  souls: { name: 'Души', max: 6, color: '#9fd4c9', pips: true, hint: 'Проклятый враг, совершая ход, отдаёт тебе душу.' },
  lad:   { name: 'Лад', max: 5, color: '#d7b6ff', pips: true, hint: 'Сменил умение — лад растёт (+5% силы за ступень). Повторил то же — лад рушится.' },
};

/* Обычный удар и защита есть у всех, но у каждого класса выглядят по-своему */
const CLASSES = {
  warrior: {
    id: 'warrior', name: 'Пепельный страж', role: 'Воин', color: '#e39248', res: 'rage', scale: 'str',
    desc: 'Последний, кто стоит между Хмарью и чужими спинами. Копит ярость, принимая удары, и отвечает так, что второго ответа не нужно.',
    play: 'Просто освоить. Много здоровья, прямой урон или глухая оборона.',
    attrs: { str: 8, agi: 3, wil: 2, vit: 8 }, baseHp: 62, armor: 6, speed: 95,
    weapon: 'sword', offhand: 'shield', look: { skin: '#c9a184', hair: '#3a2a20', cloth: '#5e3b28', trim: '#e39248', build: 1.08, helmet: 'kettle' },
    basic: { name: 'Рубящий удар', icon: 'slash', anim: 'slash', gain: 15, effects: [{ dmg: 1 }], desc: 'Наносит 100% урона. +15 ярости.' },
    start: ['heavy', 'warcry'],
    guardGain: 15,
    trees: [
      { id: 'hammer', name: 'Молот', desc: 'Оглушения, кровь и добивание.', nodes: [
        { id: 'heavy_hand', tier: 1, icon: 'fist', name: 'Тяжёлая рука', mods: { dmgPct: 10 }, desc: '+10% к урону.' },
        { id: 'stunblow', tier: 1, skill: { name: 'Оглушающий удар', icon: 'stun', anim: 'overhead', cost: 30, cd: 4, tags: ['interrupt'], fx: 'impact', effects: [{ dmg: 1.1 }, { apply: 'stun', turns: 1 }], desc: '110% урона, оглушает на ход. Сбивает замах.' } },
        { id: 'cleave', tier: 2, skill: { name: 'Рассекающий удар', icon: 'cleave', anim: 'sweep', cost: 30, cd: 2, target: 'all', fx: 'arc', effects: [{ dmg: 0.85 }, { apply: 'bleed', stacks: 2 }], desc: '85% урона всем врагам и 2 кровотечения.' } },
        { id: 'blood_rage', tier: 2, icon: 'drop', name: 'Кровавый азарт', mods: { vsStatus: { bleed: 15 } }, on: { crit: [{ gainRes: 10 }] }, desc: '+15% урона по кровоточащим. Крит даёт 10 ярости.' },
        { id: 'execute', tier: 3, skill: { name: 'Казнь', icon: 'skull', anim: 'overhead', cost: 45, cd: 3, fx: 'impact', effects: [{ dmg: 1.7, lowHp: { below: 0.35, mul: 2 } }], desc: '170% урона. Вдвое больше, если у цели меньше 35% здоровья.' } },
        { id: 'relentless', tier: 3, icon: 'crown', name: 'Неумолимость', on: { kill: [{ gainRes: 30 }, { resetCd: 'execute' }] }, desc: 'Убийство даёт 30 ярости и сбрасывает откат Казни.' },
        { id: 'last_charter', tier: 4, keystone: true, icon: 'flame', name: 'Последний устав', mods: { lowHpDmg: { below: 0.4, pct: 45 } }, desc: 'Ключевой: при здоровье ниже 40% ты наносишь на 45% больше урона.' },
      ] },
      { id: 'bastion', name: 'Бастион', desc: 'Щиты, контрудар и упрямство.', nodes: [
        { id: 'tempered', tier: 1, icon: 'armor', name: 'Закалка', mods: { armorPct: 20, hpPct: 6, dmgPct: 8 }, desc: '+20% брони, +6% здоровья и +8% урона.' },
        { id: 'ash_shield', tier: 1, skill: { name: 'Щит пепла', icon: 'shield', anim: 'guardup', cost: 25, cd: 3, target: 'self', fx: 'shield', effects: [{ shield: 0.24 }], desc: 'Щит на 24% максимального здоровья.' } },
        { id: 'riposte', tier: 2, skill: { name: 'Встречный удар', icon: 'counter', anim: 'guardup', cost: 20, cd: 4, target: 'self', fx: 'shield', effects: [{ apply: 'counter', turns: 2, to: 'self' }], desc: 'На 2 хода: на каждый полученный удар отвечаешь 90% урона.' } },
        { id: 'stalwart', tier: 2, icon: 'shield', name: 'Несгибаемый', mods: { guardShield: 10 }, desc: 'Защита также даёт щит на 10% здоровья.' },
        { id: 'shieldbash', tier: 3, skill: { name: 'Таран щитом', icon: 'stun', anim: 'lunge', cost: 25, cd: 3, tags: ['interrupt'], fx: 'impact', effects: [{ dmg: 0.8, perShield: 2.2 }, { delay: 40 }], desc: '80% урона и ещё до 220% — по доле щита. Сбивает замах, цель теряет время.' } },
        { id: 'blood_for_blood', tier: 3, icon: 'thorn', name: 'Кровь за кровь', mods: { thorns: 25 }, desc: 'Бьющий тебя получает 25% нанесённого урона.' },
        { id: 'could_not_leave', tier: 4, keystone: true, icon: 'crown', name: 'Мы не успели уйти', flags: { cheatDeath: 0.35 }, desc: 'Ключевой: раз за бой смертельный удар оставляет тебя с 1 здоровьем и щитом на 35%.' },
      ] },
    ],
    skills: {
      heavy: { name: 'Тяжёлый удар', icon: 'hammer', anim: 'overhead', cost: 30, cd: 2, tags: ['interrupt'], fx: 'impact', effects: [{ dmg: 1.65 }], desc: '165% урона. Сбивает замах.' },
      warcry: { name: 'Боевой клич', icon: 'horn', anim: 'shout', cost: 20, cd: 5, target: 'self', fx: 'buff', effects: [{ apply: 'might', turns: 3, to: 'self' }], desc: '+30% урона на 3 хода.' },
    },
  },

  rogue: {
    id: 'rogue', name: 'Тень тракта', role: 'Плут', color: '#63c7b0', res: 'combo', scale: 'agi',
    desc: 'Ты не помнишь, откуда пришёл, — и это единственное, что Хмарь не смогла забрать. Копит приёмы и разом вкладывает их в один решающий удар.',
    play: 'Средняя сложность. Нужно считать приёмы и не подставляться под тяжёлые удары.',
    attrs: { str: 3, agi: 9, wil: 3, vit: 5 }, baseHp: 58, armor: 3, speed: 112,
    weapon: 'dagger', offhand: null, look: { skin: '#b89478', hair: '#1e1a1a', cloth: '#2e3a38', trim: '#63c7b0', build: 0.94, helmet: 'hood' },
    basic: { name: 'Быстрый выпад', icon: 'dagger', anim: 'thrust', gain: 1, effects: [{ dmg: 1 }], desc: 'Наносит 100% урона. +1 приём.' },
    start: ['double', 'gut'],
    guardGain: 1,
    trees: [
      { id: 'venom', name: 'Яд', desc: 'Медленная и верная смерть.', nodes: [
        { id: 'toxin', tier: 1, icon: 'vial', name: 'Токсин', mods: { poisonExtra: 1 }, desc: 'Каждое отравление даёт на 1 стак яда больше.' },
        { id: 'venomblade', tier: 1, skill: { name: 'Отравленный клинок', icon: 'vial', anim: 'thrust', gain: 1, cd: 1, fx: 'poison', effects: [{ dmg: 0.6 }, { apply: 'poison', stacks: 4 }], desc: '60% урона и 4 яда. +1 приём.' } },
        { id: 'open_veins', tier: 2, skill: { name: 'Вскрыть рану', icon: 'drop', anim: 'slash', cost: 2, cd: 2, fx: 'poison', effects: [{ detonate: 'poison', perStack: 0.3 }], desc: 'Тратит 2 приёма: весь яд на цели взрывается за 30% урона на стак.' } },
        { id: 'rot', tier: 2, icon: 'skull', name: 'Гниль', mods: { dotPct: 30 }, desc: '+30% к урону яда, огня и кровотечения.' },
        { id: 'miasma', tier: 3, skill: { name: 'Миазмы', icon: 'wind', anim: 'throw', cost: 3, cd: 4, target: 'all', fx: 'poison', effects: [{ apply: 'poison', stacks: 5 }, { apply: 'weak', turns: 2 }], desc: '5 яда и слабость на 2 хода всем врагам.' } },
        { id: 'sticky', tier: 3, icon: 'vial', name: 'Вязкий яд', flags: { poisonSticky: true }, desc: 'Яд больше не ослабевает со временем сам.' },
        { id: 'plague', tier: 4, keystone: true, icon: 'skull', name: 'Чума тракта', flags: { plagueSpread: true }, mods: { vsStatus: { poison: 20 } }, desc: 'Ключевой: умирая, враг передаёт яд остальным. +20% урона по отравленным.' },
      ] },
      { id: 'duel', name: 'Дуэль', desc: 'Уклонения, криты, танец клинков.', nodes: [
        { id: 'keen', tier: 1, icon: 'eye', name: 'Острый глаз', mods: { crit: 10, critDmg: 15 }, desc: '+10% к шансу крита и +15% к крит. урону.' },
        { id: 'smoke', tier: 1, skill: { name: 'Дымовая завеса', icon: 'wind', anim: 'throw', cd: 4, target: 'self', fx: 'smoke', gain: 1, effects: [{ apply: 'evade', turns: 2, to: 'self' }], desc: '+50% уклонения на 2 хода. +1 приём.' } },
        { id: 'backstab', tier: 2, skill: { name: 'Удар в спину', icon: 'dagger', anim: 'dash', cost: 2, cd: 2, tags: ['interrupt'], fx: 'arc', effects: [{ dmg: 1.5, alwaysCrit: true }], desc: 'Тратит 2 приёма: 150% урона, всегда крит. Сбивает замах.' } },
        { id: 'sidestep', tier: 2, icon: 'wind', name: 'Шаг в сторону', on: { dodge: [{ gainRes: 1 }] }, mods: { dodge: 6 }, desc: '+6% уклонения. Уклонившись, получаешь приём.' },
        { id: 'bladedance', tier: 3, skill: { name: 'Танец клинков', icon: 'cleave', anim: 'sweep', cost: 4, cd: 3, target: 'all', fx: 'arc', effects: [{ dmg: 0.75, hits: 2 }], desc: 'Тратит 4 приёма: два удара по 75% всем врагам.' } },
        { id: 'quick_hands', tier: 3, icon: 'fist', name: 'Быстрые руки', mods: { speed: 15 }, on: { kill: [{ gainRes: 2 }] }, desc: '+15 инициативы. Убийство даёт 2 приёма.' },
        { id: 'foreign_name', tier: 4, keystone: true, icon: 'crown', name: 'Чужое имя', on: { crit: [{ gainRes: 1 }, { heal: 0.03 }] }, desc: 'Ключевой: каждый крит даёт приём и лечит на 3% здоровья.' },
      ] },
    ],
    skills: {
      double: { name: 'Двойной удар', icon: 'dagger', anim: 'double', gain: 1, cd: 1, fx: 'arc', effects: [{ dmg: 0.65, hits: 2 }], desc: 'Два удара по 65%. +1 приём.' },
      gut: { name: 'Вспороть', icon: 'slash', anim: 'dash', cost: 'all', fx: 'arc', effects: [{ dmg: 0.5, perRes: 0.45 }, { apply: 'bleed', stacks: 2 }], desc: 'Тратит все приёмы: 50% урона и ещё 45% за приём. 2 кровотечения.' },
    },
  },

  mage: {
    id: 'mage', name: 'Пепельный круг', role: 'Пиромант', color: '#ff9a3c', res: 'heat', scale: 'wil',
    desc: 'Ты слышишь, как пепел шепчет чужие имена. Огонь — единственный язык, на котором можно ответить. Чем сильнее жар, тем больнее бьёшь. Лишь бы не перегореть самому.',
    play: 'Сложно. Огромный урон, мало здоровья и постоянный риск перегрева.',
    attrs: { str: 2, agi: 3, wil: 10, vit: 4 }, baseHp: 56, armor: 2, speed: 98,
    weapon: 'staff', offhand: null, look: { skin: '#c4a48c', hair: '#6a2f22', cloth: '#4a2730', trim: '#ff9a3c', build: 0.92, helmet: 'hood' },
    basic: { name: 'Искра', icon: 'spark', anim: 'cast', gain: 10, fx: 'bolt', kind: 'fire', effects: [{ dmg: 1 }], desc: 'Наносит 100% урона огнём. +10 жара.' },
    start: ['fireball', 'cooldown'],
    guardGain: -35,
    trees: [
      { id: 'blaze', name: 'Пожар', desc: 'Горит всё, включая тебя.', nodes: [
        { id: 'embers', tier: 1, icon: 'flame', name: 'Тлеющие угли', mods: { burnExtra: 1 }, desc: 'Каждый поджог даёт на 1 стак огня больше.' },
        { id: 'immolate', tier: 1, skill: { name: 'Испепеление', icon: 'flame', anim: 'cast', gain: 25, cd: 2, kind: 'fire', fx: 'fire', effects: [{ dmg: 0.6 }, { apply: 'burn', stacks: 5 }], desc: '60% урона и 5 огня. +25 жара.' } },
        { id: 'firewave', tier: 2, skill: { name: 'Огненная волна', icon: 'wave', anim: 'sweepcast', gain: 30, cd: 2, target: 'all', kind: 'fire', fx: 'firewave', effects: [{ dmg: 0.85 }, { apply: 'burn', stacks: 2 }], desc: '85% урона всем врагам и 2 огня. +30 жара.' } },
        { id: 'fuel', tier: 2, icon: 'flame', name: 'Топливо', mods: { vsStatus: { burn: 20 } }, desc: '+20% урона по горящим.' },
        { id: 'meteor', tier: 3, skill: { name: 'Метеор', icon: 'meteor', anim: 'cast', gain: 45, cd: 5, target: 'all', kind: 'fire', tags: ['interrupt'], fx: 'meteor', effects: [{ dmg: 1.7 }, { apply: 'stun', turns: 1, chance: 0.5 }], desc: '170% урона всем, 50% шанс оглушения. Сбивает замах. +45 жара.' } },
        { id: 'wildfire', tier: 3, icon: 'wave', name: 'Лесной пожар', mods: { dotPct: 25 }, on: { kill: [{ gainRes: -20 }] }, desc: '+25% к урону эффектов. Убийство снимает 20 жара.' },
        { id: 'overtemper', tier: 4, keystone: true, icon: 'meteor', name: 'Перекал', flags: { overheatExplode: true }, desc: 'Ключевой: перегрев не обжигает, а взрывается на 200% урона всем врагам.' },
      ] },
      { id: 'ashen', name: 'Пепел', desc: 'Холодный расчёт и защита.', nodes: [
        { id: 'cold_mind', tier: 1, icon: 'eye', name: 'Холодный разум', mods: { guardShield: 8, crit: 5 }, desc: '+5% к шансу крита. Защита даёт щит на 8% здоровья.' },
        { id: 'ash_wall', tier: 1, skill: { name: 'Пепельная стена', icon: 'shield', anim: 'cast', gain: 15, cd: 4, target: 'self', fx: 'shield', effects: [{ shield: 0.28 }], desc: 'Щит на 28% здоровья. +15 жара.' } },
        { id: 'brand', tier: 2, skill: { name: 'Клеймо пепла', icon: 'eye', anim: 'cast', gain: 10, cd: 3, kind: 'fire', fx: 'curse', effects: [{ dmg: 0.75 }, { apply: 'vuln', turns: 3 }], desc: '75% урона, цель уязвима 3 хода (+25% урона по ней). +10 жара.' } },
        { id: 'ash_skin', tier: 2, icon: 'armor', name: 'Кожа пепла', mods: { armorPct: 30 }, on: { hurt: [{ applyAttacker: 'burn', stacks: 1 }] }, desc: '+30% брони. Бьющий тебя загорается.' },
        { id: 'absorb', tier: 3, skill: { name: 'Вдох пламени', icon: 'spark', anim: 'cast', cost: 'all', cd: 4, kind: 'fire', tags: ['interrupt'], fx: 'bolt', effects: [{ dmg: 0.6, perRes: 0.02 }, { shieldPerRes: 0.004 }], desc: 'Сбрасывает весь жар: урон 60% +2% за единицу, такой же щит. Сбивает замах.' } },
        { id: 'precision', tier: 3, icon: 'eye', name: 'Расчёт', mods: { critDmg: 40 }, desc: '+40% к крит. урону.' },
        { id: 'phoenix', tier: 4, keystone: true, icon: 'crown', name: 'Феникс', flags: { phoenix: 0.4 }, desc: 'Ключевой: раз за бой, погибнув, воскресаешь с 40% здоровья и поджигаешь всех врагов.' },
      ] },
    ],
    skills: {
      fireball: { name: 'Огненный шар', icon: 'flame', anim: 'cast', gain: 25, kind: 'fire', fx: 'fire', effects: [{ dmg: 1.3 }, { apply: 'burn', stacks: 2 }], desc: '130% урона и 2 огня. +25 жара.' },
      cooldown: { name: 'Выдох', icon: 'wind', anim: 'shout', cost: 0, gain: -45, cd: 3, target: 'self', fx: 'buff', effects: [{ shield: 0.08 }], desc: 'Снимает 45 жара и даёт щит на 8% здоровья.' },
    },
  },

  warden: {
    id: 'warden', name: 'Могильщик', role: 'Окультист', color: '#9fd4c9', res: 'souls', scale: 'wil',
    desc: 'Ты хоронил тех, чьих имён никто не помнил, пока кости не начали отвечать. Проклинает врагов, забирает души и лечится чужой жизнью.',
    play: 'Средняя сложность. Живучий и медленный, побеждает на дистанции.',
    attrs: { str: 4, agi: 2, wil: 8, vit: 7 }, baseHp: 60, armor: 4, speed: 90,
    weapon: 'scythe', offhand: null, look: { skin: '#a9a79a', hair: '#4e4e48', cloth: '#2f3a36', trim: '#9fd4c9', build: 1.0, helmet: 'hood' },
    basic: { name: 'Удар косой', icon: 'scythe', anim: 'sweep', gain: 0, kind: 'dark', effects: [{ dmg: 1, lifesteal: 0.1 }], desc: 'Наносит 100% урона и лечит на 10% от него.' },
    start: ['hex', 'reap'],
    guardGain: 1,
    trees: [
      { id: 'bones', name: 'Кости', desc: 'Слуга из могилы бьётся за тебя.', nodes: [
        { id: 'marrow', tier: 1, icon: 'bone', name: 'Костный мозг', mods: { hpPct: 10, armorPct: 10 }, desc: '+10% здоровья и брони.' },
        { id: 'raise', tier: 1, skill: { name: 'Поднять кости', icon: 'bone', anim: 'shout', cost: 1, cd: 4, target: 'self', fx: 'summon', effects: [{ summon: 'skeleton', turns: 4 }], desc: 'Тратит душу: костяной слуга 4 хода бьёт после тебя на 45% урона.' } },
        { id: 'bonewall', tier: 2, skill: { name: 'Стена рёбер', icon: 'shield', anim: 'guardup', cost: 1, cd: 3, target: 'self', fx: 'shield', effects: [{ shield: 0.2 }, { apply: 'counter', turns: 1, to: 'self' }], desc: 'Тратит душу: щит 20% и контрудар на ход.' } },
        { id: 'loyal_dead', tier: 2, icon: 'bone', name: 'Верные мёртвые', mods: { minionPct: 60 }, desc: 'Слуга наносит на 60% больше урона.' },
        { id: 'mass_grave', tier: 3, skill: { name: 'Братская могила', icon: 'skull', anim: 'shout', cost: 3, cd: 4, target: 'all', kind: 'dark', fx: 'curse', tags: ['interrupt'], effects: [{ dmg: 1.2 }, { apply: 'slow', turns: 2 }], desc: 'Тратит 3 души: 120% урона всем и замедление. Сбивает замах.' } },
        { id: 'gravedigger', tier: 3, icon: 'scythe', name: 'Копай глубже', on: { kill: [{ gainRes: 2 }, { heal: 0.08 }] }, desc: 'Убийство: 2 души и лечение на 8% здоровья.' },
        { id: 'legion', tier: 4, keystone: true, icon: 'crown', name: 'Отряд без имён', flags: { startMinion: 99 }, desc: 'Ключевой: слуга встаёт рядом с тобой в начале боя и не уходит.' },
      ] },
      { id: 'blight', name: 'Порча', desc: 'Проклятия и кража жизни.', nodes: [
        { id: 'deep_hex', tier: 1, icon: 'eye', name: 'Глубокая порча', mods: { curseExtra: 1 }, desc: 'Каждое проклятие накладывает на 1 стак больше.' },
        { id: 'leech', tier: 1, skill: { name: 'Вытягивание', icon: 'drop', anim: 'cast', cd: 1, kind: 'dark', fx: 'drain', gain: 0, effects: [{ dmg: 0.9, lifesteal: 0.4 }], desc: '90% урона, лечит на 40% от него.' } },
        { id: 'wither', tier: 2, skill: { name: 'Иссушение', icon: 'skull', anim: 'cast', cd: 3, kind: 'dark', fx: 'curse', effects: [{ dmg: 0.6 }, { apply: 'weak', turns: 2 }, { apply: 'curse', stacks: 2 }], desc: '60% урона, слабость на 2 хода, 2 проклятия.' } },
        { id: 'hungry', tier: 2, icon: 'drop', name: 'Голод', mods: { lifesteal: 8 }, desc: '+8% похищения жизни.' },
        { id: 'harvest_all', tier: 3, skill: { name: 'Большая жатва', icon: 'scythe', anim: 'sweep', cost: 'all', cd: 3, target: 'all', kind: 'dark', fx: 'drain', effects: [{ dmg: 0.5, perRes: 0.32, lifesteal: 0.3 }], desc: 'Тратит все души: 50% урона +32% за душу всем врагам, лечит на 30%.' } },
        { id: 'grudge', tier: 3, icon: 'eye', name: 'Память обид', mods: { vsStatus: { curse: 15 } }, desc: '+15% урона по проклятым.' },
        { id: 'all_names', tier: 4, keystone: true, icon: 'crown', name: 'Все имена мои', flags: { soulHeal: 0.03 }, mods: { curseDmg: 4 }, desc: 'Ключевой: каждая полученная душа лечит на 3% здоровья. Проклятие усиливает урон по цели ещё на 4% за стак.' },
      ] },
    ],
    skills: {
      hex: { name: 'Проклятие', icon: 'eye', anim: 'cast', cd: 0, kind: 'dark', fx: 'curse', effects: [{ dmg: 0.45 }, { apply: 'curse', stacks: 2 }], desc: '45% урона, 2 проклятия: цель получает больше урона и отдаёт души, совершая ход.' },
      reap: { name: 'Жатва', icon: 'scythe', anim: 'sweep', cost: 'all', kind: 'dark', fx: 'drain', effects: [{ dmg: 0.7, perRes: 0.42, lifesteal: 0.25 }], desc: 'Тратит все души: 70% урона +42% за душу, лечит на 25% от него.' },
    },
  },

  singer: {
    id: 'singer', name: 'Певчий Хора', role: 'Бард', color: '#d7b6ff', res: 'lad', scale: 'wil',
    desc: 'Ты пел в хоре Аш-Тара и единственный успел замолчать. Теперь твой голос ломает кости и лечит раны — если держишь лад, чередуя ноты.',
    play: 'Сложно. Сила растёт, только если не повторять умения подряд.',
    attrs: { str: 2, agi: 6, wil: 8, vit: 5 }, baseHp: 58, armor: 3, speed: 104,
    weapon: 'lyre', offhand: null, look: { skin: '#c8a88e', hair: '#b8a06a', cloth: '#3f3050', trim: '#d7b6ff', build: 0.96, helmet: 'none' },
    basic: { name: 'Низкая нота', icon: 'note', anim: 'cast', kind: 'sound', fx: 'note', effects: [{ dmg: 1 }], desc: 'Наносит 100% урона звуком.' },
    start: ['high', 'chord'],
    guardGain: 0,
    trees: [
      { id: 'choir', name: 'Хор', desc: 'Песня, которая множится.', nodes: [
        { id: 'loud', tier: 1, icon: 'horn', name: 'В полный голос', mods: { dmgPct: 10 }, desc: '+10% к урону.' },
        { id: 'scream', tier: 1, skill: { name: 'Вскрик', icon: 'horn', anim: 'shout', cd: 3, kind: 'sound', tags: ['interrupt'], fx: 'note', effects: [{ dmg: 0.8 }, { delay: 35 }], desc: '80% урона, цель теряет время. Сбивает замах.' } },
        { id: 'canon', tier: 2, skill: { name: 'Канон', icon: 'wave', anim: 'sweepcast', cd: 2, target: 'all', kind: 'sound', fx: 'wave', effects: [{ dmg: 0.8 }, { apply: 'vuln', turns: 1 }], desc: '80% урона всем, уязвимость на ход.' } },
        { id: 'echo', tier: 2, icon: 'note', name: 'Эхо', mods: { echo: 30 }, desc: 'На полном ладе умения повторно бьют на 30%.' },
        { id: 'requiem', tier: 3, skill: { name: 'Реквием', icon: 'skull', anim: 'cast', cost: 'all', cd: 3, kind: 'sound', fx: 'note', effects: [{ dmg: 0.6, perRes: 0.5 }, { apply: 'stun', turns: 1, ifRes: 4 }], desc: 'Тратит весь лад: 60% урона +50% за ступень. От 4 ступеней оглушает.' } },
        { id: 'perfect_pitch', tier: 3, icon: 'eye', name: 'Абсолютный слух', mods: { crit: 10, ladPct: 2 }, desc: '+10% к шансу крита и +2% силы за ступень лада.' },
        { id: 'queen_voice', tier: 4, keystone: true, icon: 'crown', name: 'Голос Королевы', flags: { ladKeep: true }, mods: { ladPct: 3 }, desc: 'Ключевой: повтор умения снижает лад только на 1, а не обрушивает. +3% силы за ступень.' },
      ] },
      { id: 'silence', name: 'Тишина', desc: 'Лечебные песни и покой.', nodes: [
        { id: 'lullaby', tier: 1, skill: { name: 'Колыбельная', icon: 'note', anim: 'cast', cd: 4, target: 'self', fx: 'heal', effects: [{ heal: 0.14 }], desc: 'Лечит на 14% здоровья.' } },
        { id: 'breath', tier: 1, icon: 'wind', name: 'Ровное дыхание', mods: { healPct: 25, hpPct: 5 }, desc: '+25% к лечению, +5% здоровья.' },
        { id: 'hush', tier: 2, skill: { name: 'Тише', icon: 'eye', anim: 'cast', cd: 4, tags: ['interrupt'], fx: 'curse', effects: [{ dmg: 0.4 }, { apply: 'weak', turns: 2 }, { apply: 'slow', turns: 2 }], desc: '40% урона, слабость и замедление на 2 хода. Сбивает замах.' } },
        { id: 'steady', tier: 2, icon: 'shield', name: 'Выдержка', mods: { guardShield: 8, dodge: 5 }, desc: '+5% уклонения. Защита даёт щит на 8% здоровья и не рушит лад.' , flags: { guardKeepsLad: true } },
        { id: 'hymn', tier: 3, skill: { name: 'Гимн памяти', icon: 'crown', anim: 'shout', cd: 5, target: 'self', fx: 'heal', effects: [{ apply: 'regen', stacks: 4, to: 'self' }, { apply: 'might', turns: 2, to: 'self' }, { cleanse: true }], desc: 'Снимает с тебя вредные эффекты, 4 регенерации и +30% урона на 2 хода.' } },
        { id: 'comfort', tier: 3, icon: 'drop', name: 'Утешение', on: { skill: [{ heal: 0.01 }] }, desc: 'Каждое умение лечит на 1% здоровья.' },
        { id: 'true_silence', tier: 4, keystone: true, icon: 'crown', name: 'Настоящая тишина', flags: { fullLadShield: 0.1 }, desc: 'Ключевой: пока лад полон, каждое умение даёт щит на 10% здоровья.' },
      ] },
    ],
    skills: {
      high: { name: 'Высокая нота', icon: 'note', anim: 'cast', cd: 1, kind: 'sound', fx: 'note', effects: [{ dmg: 1.2 }], desc: '120% урона звуком.' },
      chord: { name: 'Аккорд', icon: 'wave', anim: 'sweepcast', cost: 'all', target: 'all', kind: 'sound', fx: 'wave', effects: [{ dmg: 0.45, perRes: 0.32 }, { heal: 0.03, perResHeal: true }], desc: 'Тратит весь лад: 45% урона +32% за ступень всем, лечит на 3% за ступень.' },
    },
  },
};

const CLASS_ORDER = ['warrior', 'rogue', 'mage', 'warden', 'singer'];

const TIER_REQ = { 1: 0, 2: 2, 3: 4, 4: 6, 5: 6 };

/* Вершины веток: большие умения для позднего этапа */
const CAPSTONES = {
  hammer: { id: 'end_talk', tier: 5, skill: { name: 'Конец разговора', icon: 'hammer', anim: 'overhead', cost: 'all', cd: 3, tags: ['interrupt'], fx: 'impact', effects: [{ dmg: 0.8, perRes: 0.03 }], desc: 'Тратит всю ярость: 80% урона и ещё 3% за каждую единицу. Сбивает замах.' } },
  bastion: { id: 'last_wall', tier: 5, skill: { name: 'Последняя стена', icon: 'shield', anim: 'guardup', cost: 40, cd: 5, target: 'self', fx: 'shield', effects: [{ shield: 0.45 }, { apply: 'might', turns: 2, to: 'self' }], desc: 'Щит на 45% здоровья и +30% урона на 2 хода.' } },
  venom: { id: 'black_kiss', tier: 5, skill: { name: 'Чёрный поцелуй', icon: 'vial', anim: 'throw', cost: 3, cd: 3, target: 'all', fx: 'poison', effects: [{ dmg: 0.5 }, { apply: 'poison', stacks: 7 }], desc: 'Тратит 3 приёма: 50% урона и 7 яда всем врагам.' } },
  duel: { id: 'thousand_cuts', tier: 5, skill: { name: 'Тысяча порезов', icon: 'dagger', anim: 'double', cost: 'all', cd: 3, fx: 'arc', effects: [{ dmg: 0.3, perRes: 0.14, hits: 3 }], desc: 'Тратит все приёмы: три удара, каждый по 30% и ещё 14% за приём.' } },
  blaze: { id: 'second_sun', tier: 5, skill: { name: 'Второе солнце', icon: 'meteor', anim: 'cast', gain: 50, cd: 6, target: 'all', kind: 'fire', tags: ['interrupt'], fx: 'meteor', effects: [{ dmg: 2.2 }, { apply: 'burn', stacks: 6 }], desc: '220% урона всем и 6 огня. Сбивает замах. +50 жара.' } },
  ashen: { id: 'ash_wind', tier: 5, skill: { name: 'Зола на ветру', icon: 'wind', anim: 'shout', gain: -50, cd: 5, target: 'self', fx: 'smoke', effects: [{ shield: 0.22 }, { apply: 'evade', turns: 2, to: 'self' }], desc: 'Снимает 50 жара, щит на 22% здоровья и +50% уклонения на 2 хода.' } },
  bones: { id: 'last_roll', tier: 5, skill: { name: 'Последняя перекличка', icon: 'bone', anim: 'shout', cost: 'all', cd: 4, target: 'all', kind: 'dark', fx: 'curse', effects: [{ dmg: 0.6, perRes: 0.32 }, { summon: 'skeleton', turns: 6 }], desc: 'Тратит все души: 60% урона +32% за душу всем. Встаёт слуга на 6 ходов.' } },
  blight: { id: 'take_name', tier: 5, skill: { name: 'Отнять имя', icon: 'eye', anim: 'cast', cost: 2, cd: 4, kind: 'dark', tags: ['interrupt'], fx: 'drain', effects: [{ dmg: 1.5, lifesteal: 0.4 }, { apply: 'curse', stacks: 4 }], desc: 'Тратит 2 души: 150% урона, лечит на 40%, 4 проклятия. Сбивает замах.' } },
  choir: { id: 'great_choir', tier: 5, skill: { name: 'Великий хор', icon: 'wave', anim: 'sweepcast', cost: 'all', cd: 3, target: 'all', kind: 'sound', fx: 'wave', effects: [{ dmg: 0.7, perRes: 0.42 }, { apply: 'vuln', turns: 2 }], desc: 'Тратит весь лад: 70% урона +42% за ступень всем, уязвимость на 2 хода.' } },
  silence: { id: 'long_rest', tier: 5, skill: { name: 'Долгий покой', icon: 'crown', anim: 'shout', cd: 6, target: 'self', fx: 'heal', effects: [{ heal: 0.3 }, { cleanse: true }, { apply: 'regen', stacks: 5, to: 'self' }], desc: 'Лечит на 30%, снимает вредные эффекты, 5 регенерации.' } },
};
for (const cid of CLASS_ORDER) for (const tree of CLASSES[cid].trees) tree.nodes.push(CAPSTONES[tree.id]);

/* Единый справочник умений и талантов */
const SKILLS = {};
const TALENTS = {};
for (const cid of CLASS_ORDER) {
  const cls = CLASSES[cid];
  cls.skills = cls.skills || {};
  for (const id in cls.skills) SKILLS[id] = Object.assign({ id, cls: cid }, cls.skills[id]);
  SKILLS['basic_' + cid] = Object.assign({ id: 'basic_' + cid, cls: cid, basic: true }, cls.basic);
  for (const tree of cls.trees) {
    for (const n of tree.nodes) {
      n.tree = tree.id;
      n.cls = cid;
      TALENTS[n.id] = n;
      if (n.skill) {
        n.name = n.skill.name;
        n.icon = n.skill.icon;
        n.desc = n.skill.desc;
        SKILLS[n.id] = Object.assign({ id: n.id, cls: cid }, n.skill);
      }
    }
  }
}

const STATUSES = {
  bleed:   { name: 'Кровотечение', icon: 'drop', color: '#d64a4a', bad: true, desc: 'Урон каждый ход, броня не помогает. Ослабевает на 1.' },
  poison:  { name: 'Яд', icon: 'vial', color: '#8bd14a', bad: true, desc: 'Урон каждый ход, равен числу стаков. Ослабевает на 1.' },
  burn:    { name: 'Огонь', icon: 'flame', color: '#ff8a3c', bad: true, desc: 'Урон каждый ход. Быстро гаснет — на 2 стака за ход.' },
  curse:   { name: 'Проклятие', icon: 'eye', color: '#9fd4c9', bad: true, desc: 'Урон по цели выше на 6% за стак. Совершая ход, цель отдаёт Могильщику душу.' },
  stun:    { name: 'Оглушение', icon: 'stun', color: '#ffd76a', bad: true, desc: 'Пропускает ход.' },
  weak:    { name: 'Слабость', icon: 'fist', color: '#a08ad0', bad: true, desc: 'Наносит на 25% меньше урона.' },
  vuln:    { name: 'Уязвимость', icon: 'eye', color: '#e0603c', bad: true, desc: 'Получает на 25% больше урона.' },
  slow:    { name: 'Замедление', icon: 'wind', color: '#7aa8d6', bad: true, desc: 'Инициатива ниже на 30%.' },
  might:   { name: 'Мощь', icon: 'fist', color: '#ffb545', desc: 'Наносит на 30% больше урона.' },
  haste:   { name: 'Спешка', icon: 'wind', color: '#7fe0d0', desc: 'Инициатива выше на 30%.' },
  evade:   { name: 'Завеса', icon: 'wind', color: '#a0b4c4', desc: 'Уклонение выше на 50%.' },
  counter: { name: 'Контрудар', icon: 'counter', color: '#e39248', desc: 'Отвечает на удары.' },
  regen:   { name: 'Регенерация', icon: 'drop', color: '#5fd68a', desc: 'Лечит каждый ход, равно числу стаков ×3. Ослабевает на 1.' },
  guard:   { name: 'Защита', icon: 'shield', color: '#c8b48a', desc: 'Следующие удары слабее на 55%, тяжёлые — на 70%.' },
  stagger: { name: 'Сбит с ног', icon: 'stun', color: '#ffd76a', bad: true, desc: 'Замах сорван: получает на 30% больше урона.' },
  silence: { name: 'Немота', icon: 'note', color: '#9fc8e6', bad: true, desc: 'Нельзя применять умения: остаются обычная атака, Защита и расходники. Снимается очищением, воск для ушей защищает.' },
  deaf:    { name: 'Воск в ушах', icon: 'shield', color: '#e8cf8a', desc: 'Немота не действует.' },
  corrode: { name: 'Ржа', icon: 'armor', color: '#c8804a', bad: true, desc: 'Броня работает на 40% хуже.' },
  reflect: { name: 'Зеркало', icon: 'eye', color: '#e8f4ff', desc: 'Возвращает нападающему 40% урона удара. Иногда лучше подождать.' },
};
