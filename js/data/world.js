'use strict';

/* ============================================================
   МИР: регионы, зоны вылазок, враги, группы
   Первый этап — регион «Кромка Острога». Остальные видны на карте, но закрыты.
   ============================================================ */

const REGIONS = [
  { id: 'edge', name: 'Кромка Острога', hub: 'pepel', x: 24, y: 72, desc: 'Пепельные поля вокруг последней крепости.' },
  { id: 'springs', name: 'Тихие Ключи', hub: 'springs', x: 46, y: 50, needFlag: 'region_done', desc: 'Топи и купальни, где вода помнит лица и крадёт голоса.' },
  { id: 'copper', name: 'Медный Скол', open: false, x: 74, y: 66, desc: 'Шахты, где поёт глубокая жила. Откроются на следующем этапе.' },
  { id: 'gate', name: 'Порог и Врата', open: false, x: 70, y: 26, desc: 'Последний форпост перед сгоревшим Аш-Таром. Откроется на следующем этапе.' },
];

const ZONES = {
  ash_fields: {
    id: 'ash_fields', name: 'Пепельные поля', region: 'edge', level: 1, unlock: null, x: 15, y: 60, rows: 7,
    desc: 'Серые поля, где ветер несёт тёплый пепел, а трава растёт только на костях. Здесь учатся держать оружие и не оглядываться.',
    scene: 'fields', boss: 'scar', packs: [['ash_wolf'], ['rot_vulture'], ['ash_cultist'], ['ash_wolf', 'ash_wolf'], ['rot_vulture', 'ash_wolf'], ['ash_rat', 'ash_rat', 'ash_rat']],
    elites: ['ash_wolf', 'ash_cultist'],
  },
  burned_farm: {
    id: 'burned_farm', name: 'Хутор Погорелье', region: 'edge', level: 3, unlock: 'ash_fields', x: 34, y: 80, rows: 8,
    desc: 'Хутор сгорел двенадцать лет назад, но на мельнице всё ещё мелют. Соседи ещё выходят к воротам — поздороваться. Лиц у них нет.',
    scene: 'farm', boss: 'miller', packs: [['burnt_villager'], ['scarecrow'], ['ember_imp'], ['burnt_villager', 'burnt_villager'], ['scarecrow', 'ember_imp'], ['ember_imp', 'ember_imp', 'rot_vulture']],
    elites: ['scarecrow', 'burnt_villager'],
  },
  barrow: {
    id: 'barrow', name: 'Курган Первого Маяка', region: 'edge', level: 5, unlock: 'burned_farm', x: 11, y: 30, rows: 9,
    desc: 'Первый маяк зажгли дезертиры и здесь же их похоронили. Огонь погас, смотритель остался. Он всё ещё считает, что Хмарь можно обмануть.',
    scene: 'barrow', boss: 'keeper', packs: [['ashborn'], ['barrow_knight'], ['mist_priest'], ['ashborn', 'mist_priest'], ['ash_moth', 'ash_moth', 'ashborn'], ['barrow_knight', 'ash_moth']],
    elites: ['barrow_knight', 'mist_priest'],
  },

  /* --- Тихие Ключи --- */
  rot_bog: {
    id: 'rot_bog', name: 'Гнилая Гать', region: 'springs', level: 8, unlock: 'barrow', x: 34, y: 56, rows: 9,
    desc: 'Дорога из брёвен, уложенная поверх тех, кто её строил. Вода здесь по колено и не отражает ничего, кроме того, кто идёт за тобой.',
    scene: 'bog', boss: 'old_som', packs: [['drowned'], ['bog_leech'], ['howl_toad'], ['drowned', 'bog_wisp'], ['bog_leech', 'bog_leech'], ['howl_toad', 'bog_wisp', 'bog_wisp']],
    elites: ['drowned', 'howl_toad'],
  },
  silent_baths: {
    id: 'silent_baths', name: 'Купальни Молчания', region: 'springs', level: 10, unlock: 'rot_bog', x: 56, y: 62, rows: 9,
    desc: 'Сюда ехали лечиться со всего Предела. Лекарство от всего одно: вода забирает то, что болит. Голос, например. Послушницы до сих пор кланяются каждому гостю.',
    scene: 'baths', boss: 'mother_silence', packs: [['bath_novice'], ['mirror_double'], ['steam_spirit'], ['bath_novice', 'steam_spirit'], ['mirror_double', 'bath_novice'], ['steam_spirit', 'steam_spirit', 'bog_wisp']],
    elites: ['mirror_double', 'bath_novice'],
  },
  bell_reach: {
    id: 'bell_reach', name: 'Плёс Колоколов', region: 'springs', level: 12, unlock: 'silent_baths', x: 40, y: 34, rows: 10,
    desc: 'Село ушло под воду вместе с колокольней. Звон слышно до сих пор, но никто его не звонит. Вода научилась сама. И она учится дальше.',
    scene: 'bells', boss: 'water_voice', packs: [['bell_ringer'], ['choir_drowned'], ['drowned', 'choir_drowned'], ['bell_ringer', 'bog_wisp'], ['choir_drowned', 'choir_drowned'], ['mirror_double', 'bell_ringer']],
    elites: ['bell_ringer', 'choir_drowned'],
  },
};
const ZONE_ORDER = ['ash_fields', 'burned_farm', 'barrow', 'rot_bog', 'silent_baths', 'bell_reach'];

/* Масштаб врага от уровня: база задана на его родном уровне */
const SCALE = {
  mobHp: lvl => 1 + 0.26 * (lvl - 1),
  mobAtk: lvl => 1 + 0.2 * (lvl - 1),
  hmarAtk: 0.05, // за ступень густоты Хмари
  hmarHp: 0.05,
};

const ELITE_AFFIXES = [
  { id: 'scorched', name: 'Обугленный', desc: 'Удары поджигают.', hp: 1.7, atk: 1.15, onHit: { s: 'burn', stacks: 2 }, tint: '#ff7a3c' },
  { id: 'furious', name: 'Ярый', desc: 'Очень быстр.', hp: 1.6, atk: 1.15, speed: 28, tint: '#e0433c' },
  { id: 'heavy', name: 'Матёрый', desc: 'Толстая шкура и много здоровья.', hp: 2.2, atk: 1.05, armor: 8, tint: '#9a8a7a' },
  { id: 'hungry', name: 'Голодный', desc: 'Лечится ударами.', hp: 1.7, atk: 1.1, drain: 0.5, tint: '#8fd080' },
];

/* Ходы врага.
   mul — множитель атаки; heavy — виден заранее, его можно сбить; w — вес при выборе; cd — откат в ходах.
   apply — статусы на героя; self — статус на себя. */
const ENEMIES = {
  /* --- Пепельные поля --- */
  ash_wolf: { name: 'Пепельный волк', lvl: 1, hp: 42, atk: 10, armor: 2, speed: 108, shape: 'wolf', xp: 14, gold: 5, tint: '#8a7a6a', accent: '#ffb35e', size: 1,
    blurb: 'Шерсть пропитана пеплом. Нападает, почуяв кровь.',
    moves: [
      { name: 'Укус', mul: 1, w: 3 },
      { name: 'Рваная рана', mul: 0.8, w: 2, cd: 3, apply: [{ s: 'bleed', stacks: 3 }] },
    ] },
  ash_rat: { name: 'Зольная крыса', lvl: 1, hp: 20, atk: 6, armor: 0, speed: 120, shape: 'rat', xp: 6, gold: 2, tint: '#6e645a', accent: '#d68a5a', size: 0.8,
    blurb: 'Поодиночке смешна. Поодиночке их не бывает.',
    moves: [{ name: 'Цапнуть', mul: 1, w: 1 }] },
  rot_vulture: { name: 'Гнилой падальщик', lvl: 2, hp: 38, atk: 10, armor: 1, speed: 118, shape: 'bird', xp: 15, gold: 5, tint: '#7c6b58', accent: '#ffcf7a', size: 1,
    blurb: 'Не летает — падает сверху, раскрыв крылья.',
    moves: [
      { name: 'Клевок', mul: 1, w: 3 },
      { name: 'Заход с неба', mul: 1.9, w: 2, cd: 3, heavy: true, warn: 'Падальщик взмывает вверх и складывает крылья…' },
    ] },
  ash_cultist: { name: 'Бродячий культист', lvl: 2, hp: 52, atk: 9, armor: 3, speed: 92, shape: 'humanoid', look: 'robed', xp: 18, gold: 8, tint: '#75604f', accent: '#ff8447', size: 1,
    blurb: 'Утверждает, что Хмарь — это прощение. На груди вырезано чужое имя.',
    moves: [
      { name: 'Ритуальный нож', mul: 1, w: 3 },
      { name: 'Шёпот пепла', mul: 0.6, w: 2, cd: 2, ranged: true, apply: [{ s: 'burn', stacks: 4 }] },
      { name: 'Чужое имя', mul: 0, w: 1, cd: 4, ranged: true, apply: [{ s: 'weak', turns: 2 }] },
    ] },
  scar: { name: 'Шрам', lvl: 3, hp: 250, atk: 13, armor: 5, speed: 112, shape: 'wolf', xp: 90, gold: 90, tint: '#6b5745', accent: '#ff7a3d', size: 1.5, boss: true, lore: 'wolf',
    drop: ['scar_fang', 'pack_mantle'], blurb: 'Вожак размером с лошадь. Единственный вернулся из Хмари — и принёс оттуда чужой голод.',
    intro: 'Пепел перед тобой шевелится и встаёт на четыре лапы. Он молчал всё это время. Значит, был рядом.',
    moves: [
      { name: 'Клыки', mul: 1, w: 3 },
      { name: 'Вырвать кусок', mul: 0.85, w: 2, cd: 3, apply: [{ s: 'bleed', stacks: 4 }] },
      { name: 'Прыжок из пепла', mul: 2.3, w: 3, cd: 4, heavy: true, warn: 'Шрам припадает к земле. Весь пепел вокруг замирает…' },
    ],
    phases: [
      { below: 0.66, text: 'Шрам поднимает голову и воет. Из пепла выходит стая.', summon: ['ash_wolf'] },
      { below: 0.33, text: 'Шрам больше не бережёт себя. Его глаза горят, как угли.', self: [{ s: 'haste', turns: 99 }, { s: 'might', turns: 99 }], summon: ['ash_rat', 'ash_rat'] },
    ] },

  /* --- Хутор Погорелье --- */
  burnt_villager: { name: 'Погорелец', lvl: 3, hp: 62, atk: 12, armor: 3, speed: 88, shape: 'humanoid', look: 'ragged', xp: 26, gold: 9, tint: '#5e4a3e', accent: '#ff9550', size: 1,
    blurb: 'Вышел поздороваться. Двенадцать лет как вышел.',
    moves: [
      { name: 'Обгорелые руки', mul: 1, w: 3, apply: [{ s: 'burn', stacks: 1 }] },
      { name: 'Объятия', mul: 1.7, w: 2, cd: 3, heavy: true, apply: [{ s: 'slow', turns: 2 }], warn: 'Погорелец раскидывает руки, будто встретил родню…' },
    ] },
  scarecrow: { name: 'Огородное пугало', lvl: 4, hp: 76, atk: 12, armor: 2, speed: 80, shape: 'scarecrow', xp: 32, gold: 11, tint: '#8a744a', accent: '#ffcf7a', size: 1.12,
    blurb: 'Стоит там, где его не ставили. С каждой ночью ближе к дому.',
    moves: [
      { name: 'Вилы', mul: 1.1, w: 3 },
      { name: 'Крик ворон', mul: 0.4, w: 2, cd: 3, ranged: true, apply: [{ s: 'weak', turns: 2 }] },
      { name: 'Набитая соломой ярость', mul: 0, w: 1, cd: 4, self: [{ s: 'might', turns: 2 }], ranged: true },
    ] },
  ember_imp: { name: 'Огневик', lvl: 4, hp: 44, atk: 13, armor: 1, speed: 122, shape: 'spirit', xp: 26, gold: 9, tint: '#c2552a', accent: '#ffb347', size: 0.86,
    blurb: 'Родился из искры. Считает огонь разговором и не любит, когда прерывают.',
    moves: [
      { name: 'Вспышка', mul: 0.8, w: 3, ranged: true, apply: [{ s: 'burn', stacks: 3 }] },
      { name: 'Самовозгорание', mul: 2.1, w: 1, cd: 3, heavy: true, ranged: true, warn: 'Огневик раздувается и светится изнутри…' },
    ] },
  miller: { name: 'Безликий Мельник', lvl: 5, hp: 420, atk: 16, armor: 8, speed: 92, shape: 'humanoid', look: 'miller', xp: 220, gold: 220, tint: '#8c8678', accent: '#e6d7a8', size: 1.42, boss: true, lore: 'miller',
    drop: ['miller_stone', 'faceless_mask', 'hanged_ring'], blurb: 'Мелет имена. Из них пекут хлеб, который никто не помнит, как ел.',
    intro: 'Жернова идут сами. Мельник поворачивается к тебе, и там, где должно быть лицо, — мука.',
    moves: [
      { name: 'Мешок с мукой', mul: 1, w: 3 },
      { name: 'Мучная пыль', mul: 0.5, w: 2, cd: 3, ranged: true, apply: [{ s: 'weak', turns: 2 }, { s: 'slow', turns: 1 }] },
      { name: 'Жернов', mul: 2.4, w: 3, cd: 4, heavy: true, apply: [{ s: 'stun', turns: 1 }], warn: 'Мельник поднимает жернов над головой. Жернов ещё крутится…' },
    ],
    phases: [
      { below: 0.7, text: 'Мельник стучит по мешку. Из дверей выходят соседи.', summon: ['burnt_villager'] },
      { below: 0.4, text: '«Как тебя зовут?» — спрашивает мука. Жернова начинают идти быстрее.', self: [{ s: 'haste', turns: 99 }], summon: ['ember_imp'] },
    ] },

  /* --- Курган --- */
  ashborn: { name: 'Пеплорождённый', lvl: 5, hp: 86, atk: 16, armor: 5, speed: 96, shape: 'humanoid', look: 'ashen', xp: 42, gold: 13, tint: '#6f6068', accent: '#ff7c56', size: 1,
    blurb: 'Когда-то человек. Теперь — вежливая пустота в форме человека.',
    moves: [
      { name: 'Пепельный клинок', mul: 1, w: 3, apply: [{ s: 'burn', stacks: 1 }] },
      { name: 'Вежливый поклон', mul: 1.9, w: 2, cd: 3, heavy: true, warn: 'Пеплорождённый кланяется. Клинок за его спиной наливается оранжевым…' },
    ] },
  barrow_knight: { name: 'Курганный рыцарь', lvl: 6, hp: 118, atk: 16, armor: 12, speed: 82, shape: 'humanoid', look: 'knight', xp: 54, gold: 18, tint: '#6a7186', accent: '#d6e0ff', size: 1.12,
    blurb: 'Помнит приказ, но не помнит чей. Извиняется перед каждым ударом.',
    moves: [
      { name: 'Выученный удар', mul: 1, w: 3 },
      { name: 'Скорбный замах', mul: 2.1, w: 3, cd: 3, heavy: true, apply: [{ s: 'bleed', stacks: 3 }], warn: 'Рыцарь медленно поднимает меч и просит прощения…' },
      { name: 'Строй', mul: 0, w: 1, cd: 4, ranged: true, self: [{ s: 'guard', turns: 1 }] },
    ] },
  mist_priest: { name: 'Жрец Хмари', lvl: 6, hp: 84, atk: 15, armor: 4, speed: 100, shape: 'humanoid', look: 'robed', xp: 50, gold: 18, tint: '#75607e', accent: '#d8a0ff', size: 1.04,
    blurb: 'Служит не богу, а забыванию. Каждый слог его гимна — чьё-то стёртое имя.',
    moves: [
      { name: 'Гимн забвения', mul: 0.9, w: 3, ranged: true, apply: [{ s: 'weak', turns: 1 }] },
      { name: 'Милость Хмари', mul: 0, w: 2, cd: 3, ranged: true, healAlly: 0.25 },
      { name: 'Стереть', mul: 1.7, w: 1, cd: 4, heavy: true, ranged: true, apply: [{ s: 'vuln', turns: 2 }], warn: 'Жрец произносит твоё имя наоборот…' },
    ] },
  ash_moth: { name: 'Пепельная моль', lvl: 5, hp: 40, atk: 12, armor: 0, speed: 130, shape: 'moth', xp: 22, gold: 7, tint: '#a39a8a', accent: '#ffe7a8', size: 0.82,
    blurb: 'Летит на любой огонь. Твой тоже считается.',
    moves: [
      { name: 'Пыльца', mul: 0.7, w: 2, ranged: true, apply: [{ s: 'poison', stacks: 2 }] },
      { name: 'Крылья', mul: 1, w: 2 },
    ] },
  keeper: { name: 'Смотритель Первого Маяка', lvl: 7, hp: 640, atk: 20, armor: 10, speed: 98, shape: 'humanoid', look: 'keeper', xp: 620, gold: 480, tint: '#5c6470', accent: '#ffe08a', size: 1.5, boss: true, lore: 'keeper',
    drop: ['keeper_lamp', 'first_beacon', 'widow_boots'], blurb: 'Зажёг первый огонь и не смог его оставить. Он давно мёртв, но так и не сменился с поста.',
    intro: '«Пост сдан? — спрашивает он, поднимая фонарь. — Нет? Значит, никто не уходит».',
    moves: [
      { name: 'Багор', mul: 1, w: 3 },
      { name: 'Масло из фонаря', mul: 0.7, w: 2, cd: 3, ranged: true, apply: [{ s: 'burn', stacks: 5 }] },
      { name: 'Луч маяка', mul: 2.5, w: 3, cd: 4, heavy: true, ranged: true, apply: [{ s: 'vuln', turns: 2 }], warn: 'Фонарь разгорается, и всё вокруг становится белым…' },
    ],
    phases: [
      { below: 0.75, text: 'Смотритель ударяет багром в курган. Дезертиры поднимаются по первому зову.', summon: ['ashborn'] },
      { below: 0.5, text: 'Огонь в фонаре гаснет. В темноте его шаги слышны со всех сторон.', self: [{ s: 'evade', turns: 3 }, { s: 'might', turns: 3 }], apply: [{ s: 'weak', turns: 2 }] },
      { below: 0.25, text: '«Я не сдам пост». Фонарь вспыхивает снова — теперь он горит им самим.', self: [{ s: 'haste', turns: 99 }, { s: 'might', turns: 99 }], summon: ['ash_moth', 'ash_moth'] },
    ] },

  /* --- Гнилая Гать --- */
  drowned: { name: 'Гатный утопленник', lvl: 7, hp: 250, atk: 33, armor: 8, speed: 88, shape: 'humanoid', look: 'drowned', xp: 170, gold: 34, tint: '#3f5650', accent: '#b8e0c8', size: 1.04,
    blurb: 'Клал брёвна, пока сам не стал бревном. До сих пор проверяет, ровно ли лежит дорога.',
    moves: [
      { name: 'Багор', mul: 1, w: 3 },
      { name: 'Вниз, под гать', mul: 1.9, w: 2, cd: 3, heavy: true, apply: [{ s: 'slow', turns: 2 }], warn: 'Утопленник вцепляется в твой сапог и тянет вниз…' },
    ] },
  bog_leech: { name: 'Конская пиявка', lvl: 7, hp: 190, atk: 28, armor: 3, speed: 106, shape: 'leech', xp: 130, gold: 24, tint: '#3f3a2c', accent: '#e06a5a', size: 1,
    blurb: 'Длиной с лошадь. Лошадей здесь нет уже лет десять, и она об этом знает.',
    moves: [
      { name: 'Присосаться', mul: 0.9, w: 3, drain: true, apply: [{ s: 'bleed', stacks: 3 }] },
      { name: 'Плеть', mul: 1.1, w: 2 },
    ] },
  howl_toad: { name: 'Жаба-горлан', lvl: 8, hp: 320, atk: 36, armor: 6, speed: 80, shape: 'toad', xp: 190, gold: 38, tint: '#58663c', accent: '#ffe08a', size: 1.14,
    blurb: 'Проглотила чей-то голос и теперь зовёт им. Отвечать не советуем.',
    moves: [
      { name: 'Шлепок', mul: 1, w: 3 },
      { name: 'Чужой крик', mul: 0.6, w: 2, cd: 3, ranged: true, apply: [{ s: 'weak', turns: 2 }] },
      { name: 'Плевок тиной', mul: 0.5, w: 2, cd: 3, ranged: true, apply: [{ s: 'poison', stacks: 5 }] },
      { name: 'Надуться', mul: 0, w: 1, cd: 4, ranged: true, shieldSelf: 0.16 },
    ] },
  bog_wisp: { name: 'Болотный огонёк', lvl: 7, hp: 130, atk: 28, armor: 0, speed: 128, shape: 'spirit', xp: 110, gold: 20, tint: '#3c6a70', accent: '#8fe6ff', size: 0.8,
    blurb: 'Светит тому, кто заблудился. Светит ровно до тех пор, пока ты не заблудишься окончательно.',
    moves: [
      { name: 'Холодная искра', mul: 0.9, w: 3, ranged: true },
      { name: 'Сюда, сюда', mul: 0.3, w: 1, cd: 3, ranged: true, apply: [{ s: 'vuln', turns: 2 }] },
    ] },
  old_som: { name: 'Старый Сом', lvl: 9, hp: 2000, atk: 42, armor: 12, speed: 84, shape: 'catfish', xp: 1500, gold: 620, tint: '#4c5a50', accent: '#e8d890', size: 1.3, boss: true, lore: 'som',
    drop: ['som_whisker', 'river_plate'], blurb: 'Глотал лодки, потом лодочников, потом их голоса. Теперь у него их столько, что он иногда спорит сам с собой.',
    intro: 'Вода под гатью прогибается. «Помоги, — говорит оно голосом твоей матери, — помоги, помоги», — и открывает рот.',
    moves: [
      { name: 'Хвост', mul: 1, w: 3 },
      { name: 'Голос утонувшего', mul: 0.6, w: 2, cd: 3, ranged: true, apply: [{ s: 'weak', turns: 2 }, { s: 'poison', stacks: 4 }] },
      { name: 'Заглотить', mul: 2.5, w: 3, cd: 4, heavy: true, apply: [{ s: 'bleed', stacks: 5 }], warn: 'Сом раскрывает пасть шире, чем у него есть голова…' },
    ],
    phases: [
      { below: 0.7, text: 'Сом уходит под гать и выталкивает наверх тех, кто лежал снизу.', summon: ['drowned'] },
      { below: 0.4, text: 'Голоса в брюхе начинают кричать разом. Вода кипит от ярости.', self: [{ s: 'might', turns: 99 }], apply: [{ s: 'slow', turns: 2 }], summon: ['bog_leech'] },
    ] },

  /* --- Купальни Молчания --- */
  bath_novice: { name: 'Немая послушница', lvl: 9, hp: 300, atk: 37, armor: 7, speed: 96, shape: 'humanoid', look: 'veiled', xp: 220, gold: 42, tint: '#6a7480', accent: '#d8ecf4', size: 1,
    blurb: 'Кланяется гостю, предлагает простыню и не понимает, почему гость кричит.',
    moves: [
      { name: 'Горячий камень', mul: 1, w: 3, ranged: true, apply: [{ s: 'burn', stacks: 2 }] },
      { name: 'Палец к губам', mul: 0.3, w: 2, cd: 4, ranged: true, apply: [{ s: 'silence', turns: 1 }] },
      { name: 'Омовение', mul: 0, w: 2, cd: 3, ranged: true, healAlly: 0.2 },
    ] },
  mirror_double: { name: 'Запотевший двойник', lvl: 10, hp: 340, atk: 40, armor: 10, speed: 104, shape: 'humanoid', look: 'mirror', xp: 260, gold: 50, tint: '#8a98a8', accent: '#e8f4ff', size: 1,
    blurb: 'Вышел из зеркала, пока ты вытирал лицо. Движется как ты, только чуть раньше.',
    moves: [
      { name: 'Твой же выпад', mul: 1.05, w: 3 },
      { name: 'Зеркало', mul: 0, w: 2, cd: 4, ranged: true, self: [{ s: 'reflect', turns: 2 }] },
      { name: 'Твой лучший удар', mul: 2.1, w: 2, cd: 3, heavy: true, warn: 'Двойник встаёт в твою стойку. Ту, которой ты гордишься…' },
    ] },
  steam_spirit: { name: 'Банный жар', lvl: 9, hp: 220, atk: 36, armor: 2, speed: 118, shape: 'spirit', xp: 190, gold: 34, tint: '#a8b4bc', accent: '#ffd0a0', size: 0.92,
    blurb: 'Пар, который запомнил, каково это — быть кем-то.',
    moves: [
      { name: 'Ошпарить', mul: 0.8, w: 3, ranged: true, apply: [{ s: 'burn', stacks: 3 }] },
      { name: 'Запотевшие глаза', mul: 0.4, w: 2, cd: 3, ranged: true, apply: [{ s: 'weak', turns: 2 }] },
    ] },
  mother_silence: { name: 'Мать-Тишина', lvl: 11, hp: 2700, atk: 50, armor: 14, speed: 92, shape: 'humanoid', look: 'abbess', xp: 2500, gold: 950, tint: '#4c5866', accent: '#d8ecf4', size: 1.42, boss: true, lore: 'abbess',
    drop: ['silence_veil', 'bath_mirror', 'tide_ring'], blurb: 'Основала Купальни, чтобы лечить от криков тех, кто вернулся из Хмари. Вылечила всех. Теперь лечит тех, кто не просил.',
    intro: 'Она подносит палец к закрытому покровом рту. Шум воды обрывается. Твоё дыхание тоже стало тише, хотя ты не собирался.',
    moves: [
      { name: 'Посох настоятельницы', mul: 1, w: 3 },
      { name: 'Тшшш', mul: 0.4, w: 3, cd: 3, ranged: true, apply: [{ s: 'silence', turns: 2 }] },
      { name: 'Святая вода', mul: 0.7, w: 2, cd: 3, ranged: true, apply: [{ s: 'vuln', turns: 2 }] },
      { name: 'Последнее омовение', mul: 2.6, w: 3, cd: 4, heavy: true, ranged: true, warn: 'Весь пар в зале стягивается к её ладони и белеет…' },
    ],
    phases: [
      { below: 0.7, text: 'Она хлопает в ладоши, беззвучно. Из парилок выходят послушницы.', summon: ['bath_novice'] },
      { below: 0.45, text: 'Зеркала в зале запотевают изнутри. Кто-то в них знает, как ты дерёшься.', self: [{ s: 'reflect', turns: 3 }], summon: ['mirror_double'] },
      { below: 0.2, text: 'Покров падает. Лица под ним нет, но есть рот, и он наконец открывается.', self: [{ s: 'haste', turns: 99 }, { s: 'might', turns: 99 }], apply: [{ s: 'silence', turns: 1 }] },
    ] },

  /* --- Плёс Колоколов --- */
  bell_ringer: { name: 'Подводный звонарь', lvl: 11, hp: 430, atk: 44, armor: 14, speed: 84, shape: 'humanoid', look: 'ringer', xp: 340, gold: 62, tint: '#3c5258', accent: '#a8e0d8', size: 1.12,
    blurb: 'Звонил, пока вода не дошла до рта, и ещё немного после этого.',
    moves: [
      { name: 'Било', mul: 1, w: 3 },
      { name: 'Набат', mul: 0.6, w: 2, cd: 3, ranged: true, apply: [{ s: 'slow', turns: 2 }, { s: 'weak', turns: 1 }] },
      { name: 'Удар в большой', mul: 2.3, w: 3, cd: 3, heavy: true, apply: [{ s: 'stun', turns: 1 }], warn: 'Звонарь заносит било над головой. Вода вокруг начинает дрожать…' },
    ] },
  choir_drowned: { name: 'Хорист с плёса', lvl: 11, hp: 300, atk: 42, armor: 6, speed: 102, shape: 'humanoid', look: 'veiled', xp: 280, gold: 54, tint: '#3e5560', accent: '#9fe0ff', size: 1,
    blurb: 'Хор не распустили: просто не успели. Партии у них теперь расписаны на всех, кто подойдёт.',
    moves: [
      { name: 'Низкая нота', mul: 0.95, w: 3, ranged: true },
      { name: 'Рот воды', mul: 0.4, w: 2, cd: 4, ranged: true, apply: [{ s: 'silence', turns: 1 }] },
      { name: 'Заупокойная', mul: 0, w: 2, cd: 3, ranged: true, healAlly: 0.22 },
      { name: 'Все вместе', mul: 1.9, w: 1, cd: 4, heavy: true, ranged: true, warn: 'Хорист набирает воздуха. Вместе с ним вдыхает весь плёс…' },
    ] },
  water_voice: { name: 'Голос Воды', lvl: 13, hp: 3600, atk: 58, armor: 16, speed: 96, shape: 'voice', xp: 4000, gold: 1500, tint: '#2f5a6a', accent: '#9fe6ff', size: 1, boss: true, lore: 'water_voice',
    drop: ['bell_tongue', 'answer_lyre', 'drowned_scythe'], blurb: 'Жрецы Хора задали ветру вопрос, и ветер ответил. Вода слышала. Вода тоже захотела поговорить.',
    intro: 'Плёс встаёт столбом. «Кто ты?» — спрашивает он десятком ртов. Голоса все незнакомые. Кроме одного.',
    moves: [
      { name: 'Волна', mul: 1, w: 3, ranged: true },
      { name: 'Твоё имя наоборот', mul: 0.6, w: 3, cd: 3, ranged: true, apply: [{ s: 'silence', turns: 1 }, { s: 'vuln', turns: 2 }] },
      { name: 'Холод глубины', mul: 0.7, w: 2, cd: 3, ranged: true, apply: [{ s: 'slow', turns: 2 }, { s: 'poison', stacks: 5 }] },
      { name: 'Ответ', mul: 2.7, w: 3, cd: 4, heavy: true, ranged: true, warn: 'Все рты закрываются разом. Плёс затихает, чтобы ты точно услышал…' },
    ],
    phases: [
      { below: 0.75, text: '«Подпевайте», — говорит вода. Со дна поднимается хор.', summon: ['choir_drowned'] },
      { below: 0.5, text: 'Где-то под ногами бьёт колокол. Один раз. Тебе кажется, что это по тебе.', apply: [{ s: 'stun', turns: 1 }], summon: ['bell_ringer'] },
      { below: 0.25, text: 'Столб воды начинает говорить твоим голосом. Он лучше тебя знает, что сказать.', self: [{ s: 'haste', turns: 99 }, { s: 'might', turns: 99 }], summon: ['mirror_double'] },
    ] },

  /* Твоя собственная тень — охраняет потерянную добычу */
  own_shadow: { name: 'Твоя тень', lvl: 1, hp: 80, atk: 11, armor: 3, speed: 105, shape: 'humanoid', look: 'shadow', xp: 20, gold: 0, tint: '#2a2830', accent: '#9a8ad0', size: 1, elite: true,
    blurb: 'То, что от тебя осталось здесь. Держит твои вещи и не хочет отдавать.',
    moves: [
      { name: 'Твой удар', mul: 1, w: 3 },
      { name: 'Твоя привычка', mul: 1.8, w: 2, cd: 3, heavy: true, warn: 'Тень замахивается — так, как замахиваешься ты…' },
    ] },
};
for (const id in ENEMIES) ENEMIES[id].id = id;

/* Поправка сложности по уровням врага. Числа подобраны симулятором (tools/sim.js). */
const DIFFICULTY = [
  { upTo: 2, hp: 1.2, atk: 0.95 },
  { upTo: 4, hp: 1.8, atk: 1.6 },
  { upTo: 6, hp: 2.0, atk: 1.95 },
  { upTo: 8, hp: 1.3, atk: 1.5 },
  { upTo: 10, hp: 1.35, atk: 1.65 },
  { upTo: 13, hp: 1.4, atk: 1.8 },
];
const BOSS_DIFFICULTY = {
  scar: { hp: 1.4, atk: 1.1 }, miller: { hp: 2.1, atk: 1.85 }, keeper: { hp: 2.3, atk: 2.05 },
  old_som: { hp: 1, atk: 0.92 }, mother_silence: { hp: 1, atk: 1.32 }, water_voice: { hp: 1.1, atk: 1.72 },
};
for (const id in ENEMIES) {
  const e = ENEMIES[id];
  const tune = BOSS_DIFFICULTY[id] || DIFFICULTY.find(d => e.lvl <= d.upTo);
  if (tune && id !== 'own_shadow') {
    e.hp = Math.round(e.hp * tune.hp);
    e.atk = Math.round(e.atk * tune.atk * 10) / 10;
  }
}
