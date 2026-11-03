'use strict';

/* ============================================================
   ПРЕДМЕТЫ
   У каждой базы есть kind — по нему рисуются и иконка, и вещь на герое.
   ============================================================ */

const RARITIES = {
  common:    { id: 'common',    name: 'Обычный',     color: '#a7aeb8', affixes: 0, mult: 1.00, value: 1 },
  uncommon:  { id: 'uncommon',  name: 'Необычный',   color: '#5fd68a', affixes: 1, mult: 1.14, value: 1.8 },
  rare:      { id: 'rare',      name: 'Редкий',      color: '#5aa9ff', affixes: 2, mult: 1.30, value: 3.2 },
  epic:      { id: 'epic',      name: 'Эпический',   color: '#b57bff', affixes: 3, mult: 1.48, value: 6 },
  legendary: { id: 'legendary', name: 'Легендарный', color: '#ffb545', affixes: 2, mult: 1.62, value: 12 },
};
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const SLOTS = [
  { id: 'weapon', name: 'Оружие' },
  { id: 'offhand', name: 'Левая рука' },
  { id: 'helmet', name: 'Голова' },
  { id: 'chest', name: 'Доспех' },
  { id: 'gloves', name: 'Перчатки' },
  { id: 'boots', name: 'Обувь' },
  { id: 'ring', name: 'Кольцо' },
  { id: 'amulet', name: 'Амулет' },
];
const SLOT_MAP = Object.fromEntries(SLOTS.map(s => [s.id, s]));

const STAT_LABELS = {
  dmg: 'Урон оружия', armor: 'Броня', hp: 'Здоровье',
  str: 'Сила', agi: 'Ловкость', wil: 'Воля', vit: 'Стойкость',
  crit: 'Шанс крита', critDmg: 'Крит. урон', dodge: 'Уклонение', speed: 'Инициатива',
  lifesteal: 'Похищение жизни', thorns: 'Шипы', dotPct: 'Сила эффектов', healPct: 'Сила лечения',
  goldFind: 'Находка золота', xpFind: 'Находка опыта', dmgPct: 'Урон',
};
const PCT_STATS = new Set(['crit', 'critDmg', 'dodge', 'lifesteal', 'thorns', 'dotPct', 'healPct', 'goldFind', 'xpFind', 'dmgPct']);

/* Оружие: семейства. Чем выше скорость удара, тем меньше урон. scale — от чего растёт. */
const WEAPONS = {
  sword:  { name: 'Меч', scale: 'str', dmg: 1.0, crit: 3, mods: {}, note: 'Надёжный и сбалансированный.',
            tiers: ['Тесак ополченца', 'Клинок стражи', 'Пепельный клинок'] },
  axe:    { name: 'Секира', scale: 'str', dmg: 1.08, trait: 'axe_bleed', note: 'Удары оставляют кровоточащие раны.',
            tiers: ['Ржавая секира', 'Секира лесоруба', 'Секира тракта'] },
  hammer: { name: 'Молот', scale: 'str', dmg: 1.22, speed: -8, trait: 'hammer_stun', note: 'Медленный, но иногда оглушает.',
            tiers: ['Молот ополченца', 'Кузнечный молот', 'Молот Острога'] },
  spear:  { name: 'Копьё', scale: 'agi', dmg: 0.96, speed: 8, note: 'Ходишь раньше врага.',
            tiers: ['Копьё тракта', 'Копьё гарнизона', 'Пепельное копьё'] },
  dagger: { name: 'Кинжал', scale: 'agi', dmg: 0.82, crit: 10, speed: 5, note: 'Частые и болезненные криты.',
            tiers: ['Кинжал беглеца', 'Кинжал тени', 'Кинжал без имени'] },
  saber:  { name: 'Сабля', scale: 'agi', dmg: 0.94, dodge: 5, note: 'Легче уйти от удара.',
            tiers: ['Кривая сабля', 'Сабля наёмника', 'Сабля без ножен'] },
  kris:   { name: 'Крис', scale: 'agi', dmg: 0.86, trait: 'kris_poison', note: 'Клинок смазан ядом.',
            tiers: ['Крис контрабандиста', 'Волнистый крис', 'Крис Хмари'] },
  staff:  { name: 'Посох', scale: 'wil', dmg: 1.0, hp: 8, note: 'Заклинания и немного стойкости.',
            tiers: ['Посох ученика', 'Посох ключника', 'Пепельный посох'] },
  wand:   { name: 'Жезл', scale: 'wil', dmg: 0.86, crit: 8, note: 'Заклинания чаще критуют.',
            tiers: ['Обугленный жезл', 'Жезл писаря', 'Жезл круга'] },
  scythe: { name: 'Коса', scale: 'wil', dmg: 1.04, lifesteal: 3, note: 'Косит и понемногу лечит.',
            tiers: ['Кладбищенская коса', 'Коса отпевальщика', 'Коса без черенка'] },
  lyre:   { name: 'Лира', scale: 'wil', dmg: 0.92, speed: 6, healPct: 10, note: 'Ускоряет и усиливает лечение.',
            tiers: ['Походная лира', 'Лира с медной декой', 'Лира Хора'] },
};

const OFFHANDS = {
  shield:  { name: 'Щит', stats: l => ({ armor: Math.round(3 + l * 1.4), hp: Math.round(4 + l * 2.5) }), speed: -3, tiers: ['Щит ополченца', 'Обитый щит', 'Башенный щит'] },
  buckler: { name: 'Баклер', stats: l => ({ armor: Math.round(1 + l * 0.6), dodge: 4 }), tiers: ['Кулачный щит', 'Баклер наёмника', 'Пепельный баклер'] },
  tome:    { name: 'Том', stats: l => ({ wil: Math.round(1 + l * 0.5), dotPct: 6 }), tiers: ['Обгоревший том', 'Книга имён', 'Хроника Круга'] },
  lantern: { name: 'Фонарь', stats: l => ({ hp: Math.round(5 + l * 2), xpFind: 5 }), tiers: ['Походный фонарь', 'Фонарь факельщика', 'Осколок маяка'] },
};

const ARMORS = {
  helmet: [
    { kind: 'hood',   name: 'Капюшон', weight: 0, tiers: ['Капюшон беглеца', 'Капюшон Круга', 'Пепельный капюшон'] },
    { kind: 'kettle', name: 'Шапель',  weight: 1, tiers: ['Шапель ополченца', 'Шлем стражи', 'Шлем гарнизона'] },
    { kind: 'greathelm', name: 'Топфхельм', weight: 2, tiers: ['Глухой шлем', 'Шлем Острога', 'Шлем Врат'] },
    { kind: 'crown',  name: 'Венец',   weight: 0, wil: true, tiers: ['Медный обруч', 'Пепельный венец', 'Венец жреца'] },
  ],
  chest: [
    { kind: 'robe',    name: 'Мантия', weight: 0, wil: true, tiers: ['Ветхая мантия', 'Мантия Круга', 'Мантия Хмари'] },
    { kind: 'leather', name: 'Кожанка', weight: 1, tiers: ['Кожанка гонца', 'Куртка следопыта', 'Бригандина'] },
    { kind: 'mail',    name: 'Кольчуга', weight: 2, tiers: ['Кольчуга ополченца', 'Кольчуга стражи', 'Двойная кольчуга'] },
    { kind: 'plate',   name: 'Панцирь', weight: 3, tiers: ['Помятый панцирь', 'Панцирь стража', 'Панцирь Острога'] },
  ],
  gloves: [
    { kind: 'wraps',    name: 'Обмотки', weight: 0, tiers: ['Обмотки', 'Перчатки вора', 'Пепельные обмотки'] },
    { kind: 'gauntlet', name: 'Рукавицы', weight: 2, tiers: ['Рукавицы шахтёра', 'Латные перчатки', 'Рукавицы Острога'] },
  ],
  boots: [
    { kind: 'shoes',   name: 'Сапоги', weight: 0, tiers: ['Стоптанные сапоги', 'Сапоги гонца', 'Сапоги тракта'] },
    { kind: 'greaves', name: 'Поножи', weight: 2, tiers: ['Тяжёлые ботинки', 'Поножи стража', 'Поножи Врат'] },
  ],
  ring: [{ kind: 'ring', name: 'Кольцо', weight: 0, tiers: ['Медное кольцо', 'Кольцо с печатью', 'Кольцо пепла'] }],
  amulet: [{ kind: 'amulet', name: 'Амулет', weight: 0, tiers: ['Оберег из кости', 'Амулет ключника', 'Пепельный медальон'] }],
};

/* Суффиксы. Несклоняемая форма избавляет от споров о роде. */
const AFFIXES = [
  { stat: 'str', suffix: 'силача', min: 1, per: 0.45, slots: ['weapon', 'gloves', 'helmet', 'ring', 'chest'] },
  { stat: 'agi', suffix: 'следопыта', min: 1, per: 0.45, slots: ['weapon', 'gloves', 'boots', 'ring', 'amulet'] },
  { stat: 'wil', suffix: 'отшельника', min: 1, per: 0.45, slots: ['weapon', 'offhand', 'helmet', 'ring', 'amulet'] },
  { stat: 'vit', suffix: 'выжившего', min: 1, per: 0.45, slots: ['chest', 'helmet', 'boots', 'amulet', 'offhand'] },
  { stat: 'hp', suffix: 'крепкого тела', min: 6, per: 3.2, slots: ['chest', 'helmet', 'boots', 'amulet', 'offhand'] },
  { stat: 'armor', suffix: 'гарнизона', min: 1, per: 0.8, slots: ['chest', 'helmet', 'gloves', 'boots', 'offhand'] },
  { stat: 'crit', suffix: 'меткости', min: 2, per: 0.5, slots: ['weapon', 'gloves', 'ring', 'amulet'] },
  { stat: 'critDmg', suffix: 'палача', min: 6, per: 1.5, slots: ['weapon', 'gloves', 'ring'] },
  { stat: 'dodge', suffix: 'тени', min: 2, per: 0.35, slots: ['boots', 'chest', 'gloves', 'ring'] },
  { stat: 'speed', suffix: 'гонца', min: 3, per: 0.8, slots: ['boots', 'gloves', 'amulet'] },
  { stat: 'lifesteal', suffix: 'упыря', min: 2, per: 0.3, slots: ['weapon', 'ring', 'amulet'] },
  { stat: 'thorns', suffix: 'тёрна', min: 5, per: 1.2, slots: ['chest', 'offhand', 'gloves'] },
  { stat: 'dotPct', suffix: 'тления', min: 6, per: 1.6, slots: ['weapon', 'offhand', 'ring', 'amulet'] },
  { stat: 'healPct', suffix: 'целителя', min: 6, per: 1.6, slots: ['amulet', 'offhand', 'chest'] },
  { stat: 'goldFind', suffix: 'мародёра', min: 6, per: 1.2, slots: ['gloves', 'ring', 'amulet'] },
  { stat: 'xpFind', suffix: 'памяти', min: 4, per: 0.9, slots: ['helmet', 'ring', 'amulet'] },
];

/* Особые свойства: ими отличаются редкие вещи. Формат такой же, как у талантов. */
const TRAITS = {
  axe_bleed:   { desc: 'Удары с 30% шансом дают 1 кровотечение.', on: { hit: [{ apply: 'bleed', stacks: 1, chance: 0.3 }] } },
  hammer_stun: { desc: 'Удары с 10% шансом оглушают.', on: { hit: [{ apply: 'stun', turns: 1, chance: 0.1 }] } },
  kris_poison: { desc: 'Удары с 40% шансом дают 1 яд.', on: { hit: [{ apply: 'poison', stacks: 1, chance: 0.4 }] } },
  burn_touch:  { desc: 'Криты поджигают цель.', on: { crit: [{ apply: 'burn', stacks: 2 }] }, random: true },
  crit_bleed:  { desc: 'Криты вызывают 2 кровотечения.', on: { crit: [{ apply: 'bleed', stacks: 2 }] }, random: true },
  kill_heal:   { desc: 'Убийство лечит на 6% здоровья.', on: { kill: [{ heal: 0.06 }] }, random: true },
  start_shield:{ desc: 'В начале боя даёт щит на 10% здоровья.', on: { start: [{ shield: 0.1 }] }, random: true },
  start_might: { desc: 'В начале боя даёт мощь на 2 хода.', on: { start: [{ apply: 'might', turns: 2, to: 'self' }] }, random: true },
  guard_regen: { desc: 'Защита даёт 2 регенерации.', on: { guard: [{ apply: 'regen', stacks: 2, to: 'self' }] }, random: true },
  hurt_haste:  { desc: 'Получив удар, с 20% шансом ускоряешься на 2 хода.', on: { hurt: [{ apply: 'haste', turns: 2, to: 'self', chance: 0.2 }] }, random: true },
  dot_bonus:   { desc: 'Эффекты урона на 15% сильнее.', mods: { dotPct: 15 }, random: true },
  vs_elite:    { desc: '+15% урона по элите и боссам.', mods: { vsElite: 15 }, random: true },
};
const RANDOM_TRAITS = Object.keys(TRAITS).filter(k => TRAITS[k].random);

/* Легендарные вещи меняют способ игры. Выпадают с боссов и из особых событий. */
const UNIQUES = {
  scar_fang: { name: 'Клык Шрама', slot: 'weapon', family: 'dagger', rarity: 'legendary', ilvl: 3, stats: { agi: 3, crit: 6 },
    desc: 'Кость ещё тёплая.', on: { crit: [{ apply: 'bleed', stacks: 3 }, { heal: 0.03 }] }, trait: 'Криты дают 3 кровотечения и лечат на 3%.' },
  pack_mantle: { name: 'Шкура вожака', slot: 'chest', kind: 'leather', rarity: 'legendary', ilvl: 3, stats: { vit: 3, armor: 5, speed: 6 },
    desc: 'Пахнет дымом и псиной.', on: { start: [{ apply: 'haste', turns: 2, to: 'self' }] }, trait: 'Начинаешь бой со спешкой на 2 хода.' },
  miller_stone: { name: 'Жёрнов Мельника', slot: 'weapon', family: 'hammer', rarity: 'legendary', ilvl: 5, stats: { str: 4, armor: 4 },
    desc: 'Перемолол больше имён, чем зерна.', mods: { perStunDmg: 40, vsStatus: { stun: 40, stagger: 40 } }, trait: '+40% урона по оглушённым и сбитым с ног.' },
  faceless_mask: { name: 'Лицо без лица', slot: 'helmet', kind: 'crown', rarity: 'legendary', ilvl: 5, stats: { wil: 4, hp: 25 },
    desc: 'Смотрит изнутри.', mods: { curseDmg: 3, dotPct: 20 }, trait: '+20% к эффектам, проклятия сильнее на 3% за стак.' },
  keeper_lamp: { name: 'Фонарь Смотрителя', slot: 'offhand', family: 'lantern', rarity: 'legendary', ilvl: 7, stats: { wil: 4, hp: 30 },
    desc: 'Горит без масла.', on: { start: [{ apply: 'vuln', turns: 2, to: 'allEnemies' }] }, trait: 'В начале боя все враги уязвимы на 2 хода.' },
  first_beacon: { name: 'Пепел первого маяка', slot: 'amulet', kind: 'amulet', rarity: 'legendary', ilvl: 7, stats: { vit: 4, dotPct: 15 },
    desc: 'Щепотка в ладанке.', flags: { cheatDeath: 0.25 }, trait: 'Раз за бой смертельный удар оставляет с 1 здоровьем и щитом на 25%.' },
  hanged_ring: { name: 'Кольцо висельника', slot: 'ring', kind: 'ring', rarity: 'legendary', ilvl: 4, stats: { crit: 8 },
    desc: 'Снято не с пальца.', mods: { lowHpDmg: { below: 0.5, pct: 30 } }, trait: 'При здоровье ниже 50% наносишь на 30% больше урона.' },
  widow_boots: { name: 'Сапоги вдовы', slot: 'boots', kind: 'shoes', rarity: 'legendary', ilvl: 4, stats: { agi: 3, dodge: 6, speed: 8 },
    desc: 'Она так и не дошла. Зато сапоги дошли.', on: { dodge: [{ apply: 'might', turns: 1, to: 'self' }] }, trait: 'После уклонения получаешь мощь на ход.' },

  /* --- Тихие Ключи --- */
  som_whisker: { name: 'Ус Старого Сома', slot: 'weapon', family: 'kris', rarity: 'legendary', ilvl: 9, stats: { agi: 6, crit: 6 },
    desc: 'Всё ещё шевелится, если рядом кто-то говорит.', on: { hit: [{ apply: 'poison', stacks: 1, chance: 0.5 }, { apply: 'slow', turns: 1, chance: 0.15 }] }, trait: 'Удары с шансом 50% дают яд, а иногда замедляют.' },
  river_plate: { name: 'Чешуя придонная', slot: 'chest', kind: 'mail', rarity: 'legendary', ilvl: 9, stats: { vit: 6, hp: 40 },
    desc: 'Каждая чешуйка с чужого сома. Не спрашивай, сколько их было.', on: { hurt: [{ shield: 0.03 }] }, trait: 'Каждый полученный удар даёт щит на 3% здоровья.' },
  silence_veil: { name: 'Покров Матери-Тишины', slot: 'helmet', kind: 'hood', rarity: 'legendary', ilvl: 11, stats: { wil: 7, hp: 40 },
    desc: 'Под ним не слышно даже себя. Иногда это хорошо.', on: { start: [{ apply: 'stagger', turns: 1, to: 'allEnemies' }] }, trait: 'В начале боя все враги сбиты с ног на ход. Получают на 30% больше урона.' },
  bath_mirror: { name: 'Зеркало банщицы', slot: 'offhand', family: 'buckler', rarity: 'legendary', ilvl: 11, stats: { vit: 5, dodge: 6 },
    desc: 'Отражает не то, что перед ним.', on: { dodge: [{ apply: 'reflect', turns: 1, to: 'self' }] }, trait: 'После уклонения следующий удар врага частично вернётся к нему.' },
  bell_tongue: { name: 'Язык колокола', slot: 'weapon', family: 'hammer', rarity: 'legendary', ilvl: 12, stats: { str: 8, armor: 6 },
    desc: 'Сто лет молчал под водой. Теперь звонит по каждому.', on: { crit: [{ apply: 'stun', turns: 1, chance: 0.6 }] }, mods: { vsElite: 15 }, trait: 'Криты с шансом 60% оглушают. +15% урона по элите и боссам.' },
  answer_lyre: { name: 'Лира, которая отвечает', slot: 'weapon', family: 'lyre', rarity: 'legendary', ilvl: 13, stats: { wil: 8, speed: 8 },
    desc: 'Струны натянуты из голоса. Чьего — лучше не играть при родне.', mods: { dotPct: 15, healPct: 15 }, on: { crit: [{ gainRes: 1 }] }, trait: '+15% к эффектам и лечению. Криты дают ресурс класса.' },
  drowned_scythe: { name: 'Коса утопленника', slot: 'weapon', family: 'scythe', rarity: 'legendary', ilvl: 13, stats: { wil: 8, lifesteal: 3 },
    desc: 'Лезвие не ржавеет. Рукоять всегда мокрая.', on: { kill: [{ heal: 0.1 }] }, trait: 'Убийство лечит на 10% здоровья.' },
  tide_ring: { name: 'Кольцо прилива', slot: 'ring', kind: 'ring', rarity: 'legendary', ilvl: 12, stats: { crit: 10, speed: 6 },
    desc: 'То тесное, то падает с пальца. По расписанию.', on: { guard: [{ apply: 'haste', turns: 1, to: 'self' }] }, trait: 'Защита ускоряет на следующий ход.' },
};

/* Четвёртая ступень вещей: их куют и находят уже в Тихих Ключах */
const FOURTH_TIER = {
  sword: 'Клинок Ключей', axe: 'Секира плотогона', hammer: 'Придонный молот', spear: 'Острога сомолова', dagger: 'Кинжал немых',
  saber: 'Сабля паромщика', kris: 'Крис трясины', staff: 'Посох Купален', wand: 'Жезл из ивы', scythe: 'Камышовая коса', lyre: 'Лира Ключей',
  shield: 'Щит с чешуёй', buckler: 'Медный баклер', tome: 'Книга голосов', lantern: 'Болотный фонарь',
  hood: 'Покров послушника', kettle: 'Шлем паромщика', greathelm: 'Шлем водолаза', crown: 'Венец из ивы',
  robe: 'Риза Купален', leather: 'Куртка плотогона', mail: 'Чешуйчатая кольчуга', plate: 'Панцирь с плёса',
  wraps: 'Вощёные обмотки', gauntlet: 'Рукавицы багра', shoes: 'Сапоги с гати', greaves: 'Поножи с плёса',
  ring: 'Кольцо из тины', amulet: 'Оберег с колокольчиком',
};
for (const id in WEAPONS) WEAPONS[id].tiers.push(FOURTH_TIER[id]);
for (const id in OFFHANDS) OFFHANDS[id].tiers.push(FOURTH_TIER[id]);
for (const slot in ARMORS) for (const a of ARMORS[slot]) a.tiers.push(FOURTH_TIER[a.kind]);

const CONSUMABLES = {
  potion_small: { name: 'Отвар ромашки', icon: 'potion', tint: '#d65a5a', rarity: 'common', value: 18, heal: 0.3, desc: 'Лечит на 30% здоровья.', field: true },
  potion_big:   { name: 'Сгущённый отвар', icon: 'potion', tint: '#e0334a', rarity: 'uncommon', value: 44, heal: 0.55, desc: 'Лечит на 55% здоровья.', field: true },
  antidote:     { name: 'Горькая настойка', icon: 'vial', tint: '#8bd14a', rarity: 'common', value: 22, cleanse: true, heal: 0.1, desc: 'Снимает все вредные эффекты и лечит на 10%.' },
  firebomb:     { name: 'Пепельная бомба', icon: 'bomb', tint: '#ff8a3c', rarity: 'uncommon', value: 36, aoe: 1.2, burn: 3, desc: 'Бьёт всех врагов на 120% и поджигает.' },
  smokebomb:    { name: 'Дымовой горшок', icon: 'bomb', tint: '#a0b4c4', rarity: 'common', value: 26, status: 'evade', turns: 2, desc: 'Завеса на 2 хода: +50% уклонения.' },
  whetstone:    { name: 'Настой ярости', icon: 'potion', tint: '#ffb545', rarity: 'uncommon', value: 34, status: 'might', turns: 3, desc: 'Мощь на 3 хода: +30% урона.' },
  bandage:      { name: 'Чистые бинты', icon: 'bandage', tint: '#d8d0c0', rarity: 'common', value: 16, heal: 0.2, desc: 'Лечит на 20% здоровья. Только вне боя.', field: true, noBattle: true },
  incense:      { name: 'Ладан с маяка', icon: 'vial', tint: '#c8b48a', rarity: 'uncommon', value: 40, hmar: -3, desc: 'Отгоняет Хмарь: −3 к её густоте. Только на вылазке.', field: true, noBattle: true },
  wax:          { name: 'Воск для ушей', icon: 'bandage', tint: '#e8cf8a', rarity: 'uncommon', value: 40, status: 'deaf', turns: 4, desc: 'На 4 хода ты не слышишь ничего, и Немота тебя не берёт.' },
  spring_water: { name: 'Вода из верхнего ключа', icon: 'vial', tint: '#7cc8e0', rarity: 'uncommon', value: 52, cleanse: true, heal: 0.35, desc: 'Снимает все вредные эффекты и лечит на 35%.' },
};

/* Материалы и прочие цены */
const ECONOMY = {
  sellRate: 0.3,
  dustFor: { common: 1, uncommon: 3, rare: 7, epic: 15, legendary: 30 },
  upgradeMax: 3,
  upgradeCost: lvl => ({ gold: 40 + lvl * lvl * 45, dust: 4 + lvl * 6 }),
  upgradeStep: 0.09,
  innCost: lvl => 6 + lvl * 3,
  respecCost: lvl => 40 + lvl * 30,
  beacon: [
    { name: 'Масло для маяка', cost: { gold: 200, dust: 15 }, desc: '+1 ячейка на поясе: 4 расходника в бой.', belt: 1 },
    { name: 'Сторожевой огонь', cost: { gold: 500, dust: 40 }, desc: 'Хмарь в начале вылазки реже сгущается: первые 2 шага бесплатно.', hmarFree: 2 },
    { name: 'Запись на камне', cost: { gold: 1000, dust: 80 }, desc: '+10% опыта и золота навсегда.', find: 10 },
  ],
};
