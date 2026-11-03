'use strict';

/* ============================================================
   ПОЗДНИЙ МИР: Медный Скол, Порог и Врата, Аш-Тар и финал.
   Файл дополняет world.js и story.js, формат записей тот же.
   ============================================================ */

/* --- регионы и поселения --- */
Object.assign(REGIONS.find(r => r.id === 'copper'), { hub: 'copper', needFlag: 'region2_done', desc: 'Шахты, где поёт глубокая жила, а у людей вместо имён номера.' });
Object.assign(REGIONS.find(r => r.id === 'gate'), { hub: 'gate', needFlag: 'region3_done', desc: 'Последний форпост перед сгоревшим Аш-Таром.' });

Object.assign(HUBS.pepel, { smith: 'Заточка у Харна' });
Object.assign(HUBS.springs, { smith: 'Заточка у Дара', market: 'Меняльный мост' });
HUBS.copper = {
  id: 'copper', name: 'Посёлок Медный Скол', short: 'Скол', paint: 'copper', smith: 'Заточка у Зои', market: 'Раздаточная Зои',
  quote: 'На табеле у входа мелом: «Спускаясь, сдай имя. Поднимаясь, получи».',
  buildings: {
    headframe: { name: 'Копёр', x: 24, y: 28, npc: 'gordey', hint: 'Бригадир Гордей' },
    ledger: { name: 'Табельная', x: 47, y: 56, npc: 'nyura', hint: 'Учётчица Нюра и книга номеров' },
    birds: { name: 'Птичник', x: 68, y: 42, npc: 'yerema', hint: 'Отдых, канарейки и слухи' },
    store: { name: 'Раздаточная', x: 84, y: 62, npc: 'zoya', hint: 'Товары и заточка' },
  },
};
HUBS.gate = {
  id: 'gate', name: 'Форпост Порог', short: 'Порог', paint: 'gate', smith: 'Заточка у Веры', market: 'Оружейная Веры',
  quote: '«Дальше не ходят. Дальше только приходят обратно. Те, кто приходит».',
  buildings: {
    wallhead: { name: 'Стена', x: 72, y: 30, npc: 'lyubava', hint: 'Воевода Любава' },
    cell: { name: 'Келья', x: 22, y: 42, npc: 'iov', hint: 'Отец Иов, бывший жрец Хора' },
    armory: { name: 'Оружейная', x: 44, y: 60, npc: 'vera', hint: 'Товары и заточка' },
    kitchen: { name: 'Кухня', x: 60, y: 66, npc: 'lavr', hint: 'Отдых и горячее' },
  },
};

const COUNT_LABELS = { canaries: 'Живая канарейка', pilgrims: 'Спасённые паломники', salt: 'Мешок соли' };

/* --- зоны --- */
Object.assign(ZONES, {
  copper_shafts: {
    id: 'copper_shafts', name: 'Верхние штольни', region: 'copper', level: 14, unlock: 'bell_reach', x: 64, y: 80, rows: 9,
    desc: 'Крепь скрипит не от тяжести, а от того, что снизу в неё стучат. Забойщики всё ещё выходят в смену. Смену никто не отменял.',
    scene: 'shafts', boss: 'old_driller', packs: [['numbered_miner'], ['copper_tick', 'copper_tick'], ['gas_pocket', 'numbered_miner'], ['copper_tick', 'gas_pocket'], ['numbered_miner', 'numbered_miner'], ['gas_pocket', 'gas_pocket', 'copper_tick']],
    elites: ['numbered_miner', 'copper_tick'],
  },
  foundry: {
    id: 'foundry', name: 'Плавильня Гнева', region: 'copper', level: 16, unlock: 'copper_shafts', x: 82, y: 80, rows: 9,
    desc: 'Здесь отливали колокола для ста башен Аш-Тара. Печи не гасли ни разу. Теперь в них плавят то, что приносят снизу, и никто не проверяет что.',
    scene: 'foundry', boss: 'mother_furnace', packs: [['slag_golem'], ['smelter'], ['smelter', 'forge_spark'], ['slag_golem', 'forge_spark'], ['forge_spark', 'forge_spark', 'smelter'], ['slag_golem', 'smelter']],
    elites: ['slag_golem', 'smelter'],
  },
  singing_vein: {
    id: 'singing_vein', name: 'Поющая Жила', region: 'copper', level: 18, unlock: 'foundry', x: 86, y: 52, rows: 10,
    desc: 'Самая глубокая выработка. Стены здесь чистая медь, и она гудит ровно на той ноте, с которой началась Хмарь. Те, кто спускался, стали ей подпевать.',
    scene: 'vein', boss: 'vein_heart', packs: [['vein_singer'], ['copper_growth'], ['vein_singer', 'dead_canary'], ['copper_growth', 'dead_canary'], ['vein_singer', 'copper_growth'], ['dead_canary', 'dead_canary', 'copper_tick']],
    elites: ['vein_singer', 'copper_growth'],
  },
  dead_road: {
    id: 'dead_road', name: 'Мёртвый Тракт', region: 'gate', level: 20, unlock: 'singing_vein', x: 56, y: 36, rows: 10,
    desc: 'Дорога к Аш-Тару. Караваны на ней стоят с той самой ночи: лошади в упряжи, возницы на козлах. Иногда вся вереница делает один шаг вперёд.',
    scene: 'road', boss: 'caravan_master', packs: [['road_driver'], ['ash_horse'], ['pilgrim'], ['road_driver', 'pilgrim'], ['ash_horse', 'ash_horse'], ['pilgrim', 'pilgrim', 'road_driver']],
    elites: ['road_driver', 'ash_horse'],
  },
  bronze_gate: {
    id: 'bronze_gate', name: 'Бронзовые Врата', region: 'gate', level: 22, unlock: 'dead_road', x: 80, y: 33, rows: 10,
    desc: 'Врата закрыли изнутри в ту ночь, чтобы никто не вышел. Потом снаружи, чтобы никто не вошёл. Стража по обе стороны всё ещё считает, что выполняет приказ.',
    scene: 'gates', boss: 'gate_warden', packs: [['gatekeeper'], ['bronze_face'], ['tower_archer'], ['gatekeeper', 'tower_archer'], ['bronze_face', 'tower_archer'], ['gatekeeper', 'bronze_face']],
    elites: ['gatekeeper', 'bronze_face'],
  },
  ash_tar: {
    id: 'ash_tar', name: 'Аш-Тар', region: 'gate', level: 24, unlock: 'bronze_gate', x: 62, y: 16, rows: 11,
    desc: 'Сто башен из белого камня. Они не сгорели, они выгорели: снаружи целые, внутри пепел. На каждой ступени кто-то шепчет один и тот же вопрос, и на этот раз он обращён к тебе.',
    scene: 'ashtar', boss: 'the_question', packs: [['hor_priest'], ['tower_echo', 'tower_echo'], ['nameless'], ['hor_priest', 'tower_echo'], ['nameless', 'hor_priest'], ['tower_echo', 'tower_echo', 'nameless']],
    elites: ['hor_priest', 'nameless'],
  },
});
ZONE_ORDER.push('copper_shafts', 'foundry', 'singing_vein', 'dead_road', 'bronze_gate', 'ash_tar');

/* --- враги --- */
const LATE_ENEMIES = {
  /* Верхние штольни */
  numbered_miner: { name: 'Номерной забойщик', lvl: 14, hp: 800, atk: 96, armor: 22, speed: 88, shape: 'humanoid', look: 'miner', xp: 750, gold: 90, tint: '#5a4a38', accent: '#ffd27a', size: 1.04,
    blurb: 'На груди жестяной номер. Спроси его имя, и он покажет номер. Спроси ещё раз, и он покажет кайло.',
    moves: [
      { name: 'Кайло', mul: 1, w: 3 },
      { name: 'Рудная пыль', mul: 0.5, w: 2, cd: 3, ranged: true, apply: [{ s: 'corrode', turns: 2 }] },
      { name: 'Забой', mul: 2, w: 2, cd: 3, heavy: true, apply: [{ s: 'bleed', stacks: 5 }], warn: 'Забойщик упирается ногами и заносит кайло над плечом, как над породой…' },
    ] },
  copper_tick: { name: 'Медный клещ', lvl: 14, hp: 520, atk: 84, armor: 34, speed: 118, shape: 'crawler', xp: 520, gold: 62, tint: '#9a6236', accent: '#7fe0c0', size: 0.95,
    blurb: 'Панцирь из самородной меди. Пьёт ток из жилы и кровь из всего остального.',
    moves: [
      { name: 'Присоски', mul: 0.9, w: 3, drain: true, apply: [{ s: 'bleed', stacks: 3 }] },
      { name: 'Окислить', mul: 0.5, w: 2, cd: 3, apply: [{ s: 'corrode', turns: 3 }] },
    ] },
  gas_pocket: { name: 'Рудничный газ', lvl: 14, hp: 380, atk: 80, armor: 0, speed: 96, shape: 'spirit', xp: 480, gold: 58, tint: '#7d8a3c', accent: '#e0f07a', size: 0.92, deathBlast: 2.4,
    blurb: 'Взрывается при смерти. Ближе к концу боя лучше иметь запас здоровья или добить его первым.',
    moves: [
      { name: 'Удушье', mul: 0.6, w: 3, ranged: true, apply: [{ s: 'poison', stacks: 6 }] },
      { name: 'Сгуститься', mul: 0, w: 1, cd: 3, ranged: true, shieldSelf: 0.2 },
    ] },
  old_driller: { name: 'Дед-Проходчик', lvl: 15, hp: 6800, atk: 118, armor: 34, speed: 80, shape: 'golem', xp: 6000, gold: 1700, tint: '#6a5a48', accent: '#ffb45a', size: 1.5, boss: true, lore: 'driller',
    drop: ['driller_gauntlet', 'tag_seventeen'], blurb: 'Первый, кто согласился сдать имя. Сдал и всё остальное: руки заменил на бур, спину на крепь. До сих пор идёт по плану.',
    intro: 'Из забоя выползает гул. Потом бур. Потом то, что к буру приделано. На жестяном жетоне выбит номер один.',
    moves: [
      { name: 'Бур', mul: 1, w: 3 },
      { name: 'Ржавая стружка', mul: 0.7, w: 2, cd: 3, ranged: true, apply: [{ s: 'corrode', turns: 3 }, { s: 'bleed', stacks: 4 }] },
      { name: 'Обвал', mul: 2.4, w: 3, cd: 4, heavy: true, apply: [{ s: 'stun', turns: 1 }], warn: 'Бур упирается в свод. Сверху начинает сыпаться…' },
    ],
    phases: [
      { below: 0.7, text: 'Дед свистит в жетон. Смена выходит на его сигнал.', summon: ['numbered_miner'] },
      { below: 0.4, text: 'Крепь трещит. Из трещин ползёт газ.', self: [{ s: 'might', turns: 99 }], summon: ['gas_pocket', 'gas_pocket'] },
    ] },

  /* Плавильня */
  slag_golem: { name: 'Шлаковый голем', lvl: 16, hp: 1150, atk: 112, armor: 48, speed: 74, shape: 'golem', xp: 950, gold: 120, tint: '#4a4240', accent: '#ff7a3c', size: 1.05,
    blurb: 'Сброшенный шлак, который встал. Внутри ещё горячо, и бить туда приятно: если пробьёшь.',
    moves: [
      { name: 'Кулак шлака', mul: 1.05, w: 3, apply: [{ s: 'burn', stacks: 2 }] },
      { name: 'Остыть', mul: 0, w: 1, cd: 4, ranged: true, shieldSelf: 0.18 },
      { name: 'Расплавленная волна', mul: 2.1, w: 2, cd: 3, heavy: true, apply: [{ s: 'burn', stacks: 6 }], warn: 'Голем трескается, и из трещин течёт свет…' },
    ] },
  smelter: { name: 'Литейщик', lvl: 16, hp: 820, atk: 108, armor: 24, speed: 96, shape: 'humanoid', look: 'smelter', xp: 800, gold: 110, tint: '#6e4a30', accent: '#ffb347', size: 1.02,
    blurb: 'Отливает колокол уже двенадцатый год. Всё никак не выйдет чистый звук. Может, в тебе нужной меди больше.',
    moves: [
      { name: 'Ковш', mul: 0.9, w: 3, ranged: true, apply: [{ s: 'burn', stacks: 4 }] },
      { name: 'Окалина', mul: 0.5, w: 2, cd: 3, ranged: true, apply: [{ s: 'corrode', turns: 2 }, { s: 'weak', turns: 1 }] },
      { name: 'Подкинуть угля', mul: 0, w: 1, cd: 3, ranged: true, healAlly: 0.16 },
    ] },
  forge_spark: { name: 'Искра из печи', lvl: 15, hp: 460, atk: 104, armor: 2, speed: 134, shape: 'spirit', xp: 560, gold: 70, tint: '#d8682a', accent: '#ffd27a', size: 0.78, deathBlast: 1.2,
    blurb: 'Вылетела из печи и не хочет обратно. Лопается красиво и больно.',
    moves: [
      { name: 'Прожечь', mul: 0.8, w: 3, ranged: true, apply: [{ s: 'burn', stacks: 3 }] },
    ] },
  mother_furnace: { name: 'Мать-Печь', lvl: 17, hp: 9200, atk: 134, armor: 38, speed: 86, shape: 'furnace', xp: 9000, gold: 2500, tint: '#4a3a34', accent: '#ff8a3c', size: 1.35, boss: true, lore: 'furnace',
    drop: ['bell_mold', 'slag_crown', 'cold_iron'], blurb: 'Самая старая печь. Её кормили сто лет и ни разу не спросили, хочет ли она ещё.',
    intro: 'Заслонка поднимается сама. За ней не огонь, а чьё-то очень внимательное лицо из огня. «Принёс?» — спрашивает она. Ты понимаешь, что принёс себя.',
    moves: [
      { name: 'Выдох горна', mul: 1, w: 3, ranged: true, apply: [{ s: 'burn', stacks: 3 }] },
      { name: 'Окалина с заслонки', mul: 0.7, w: 2, cd: 3, ranged: true, apply: [{ s: 'corrode', turns: 3 }, { s: 'weak', turns: 2 }] },
      { name: 'Плавка', mul: 2.6, w: 3, cd: 4, heavy: true, ranged: true, apply: [{ s: 'burn', stacks: 8 }], warn: 'Заслонка распахивается настежь. В цеху становится светло и очень тихо…' },
    ],
    phases: [
      { below: 0.7, text: 'Печь бьёт в заслонку. Литейщики идут на зов с ковшами.', summon: ['smelter'] },
      { below: 0.45, text: 'Из устья вываливается шлак и начинает вставать.', self: [{ s: 'guard', turns: 1 }], summon: ['slag_golem'] },
      { below: 0.2, text: 'Печь раскаляется добела. Кирпич течёт, как воск.', self: [{ s: 'haste', turns: 99 }, { s: 'might', turns: 99 }], summon: ['forge_spark', 'forge_spark'] },
    ] },

  /* Поющая Жила */
  vein_singer: { name: 'Подпевающий', lvl: 18, hp: 1200, atk: 124, armor: 30, speed: 100, shape: 'humanoid', look: 'copperman', xp: 1100, gold: 150, tint: '#a0683c', accent: '#7fe0c0', size: 1.04,
    blurb: 'Кожа позеленела и звенит, если постучать. Он счастлив. Это самое страшное.',
    moves: [
      { name: 'Медная рука', mul: 1, w: 3 },
      { name: 'Подпеть', mul: 0.5, w: 2, cd: 4, ranged: true, apply: [{ s: 'silence', turns: 1 }] },
      { name: 'Вся нота сразу', mul: 2.1, w: 2, cd: 3, heavy: true, ranged: true, apply: [{ s: 'vuln', turns: 2 }], warn: 'Подпевающий открывает рот, и начинает гудеть воздух в твоих зубах…' },
    ] },
  copper_growth: { name: 'Медный нарост', lvl: 18, hp: 1500, atk: 118, armor: 56, speed: 68, shape: 'crystal', xp: 1000, gold: 140, tint: '#b87840', accent: '#7fe0c0', size: 1.1,
    blurb: 'Растёт из стены. На той неделе он был на десять шагов дальше.',
    moves: [
      { name: 'Шип', mul: 1, w: 3, ranged: true, apply: [{ s: 'bleed', stacks: 3 }] },
      { name: 'Зеркальный слом', mul: 0, w: 2, cd: 4, ranged: true, self: [{ s: 'reflect', turns: 2 }] },
      { name: 'Рост', mul: 0, w: 1, cd: 4, ranged: true, shieldSelf: 0.2 },
    ] },
  dead_canary: { name: 'Мёртвая канарейка', lvl: 17, hp: 520, atk: 112, armor: 4, speed: 136, shape: 'bird', xp: 620, gold: 80, tint: '#b8a84a', accent: '#fff2a0', size: 0.72,
    blurb: 'Канареек носили вниз, чтобы они первыми падали от газа. Эти упали давно, но продолжают предупреждать.',
    moves: [
      { name: 'Клевок', mul: 0.95, w: 3 },
      { name: 'Тревога', mul: 0.3, w: 2, cd: 3, ranged: true, apply: [{ s: 'vuln', turns: 2 }] },
    ] },
  vein_heart: { name: 'Сердце Жилы', lvl: 19, hp: 12500, atk: 150, armor: 42, speed: 92, shape: 'heart', xp: 13000, gold: 3500, tint: '#a8683a', accent: '#7fe0c0', size: 1.25, boss: true, lore: 'heart',
    drop: ['vein_string', 'copper_heart', 'canary_cage'], blurb: 'Самородок величиной с дом. Он не живой. Он просто резонирует. Весь мир ему в этом мешает.',
    intro: 'Гул становится нотой. Нота становится словом. Слово то же, что ты слышал на плёсе: «Кто ты?». Здесь на него отвечают хором, и тебе оставили место в строю.',
    moves: [
      { name: 'Удар пульса', mul: 1, w: 3, ranged: true },
      { name: 'Гул', mul: 0.6, w: 3, cd: 3, ranged: true, apply: [{ s: 'silence', turns: 1 }, { s: 'corrode', turns: 2 }] },
      { name: 'Медные жилы', mul: 0.8, w: 2, cd: 3, ranged: true, apply: [{ s: 'slow', turns: 2 }, { s: 'bleed', stacks: 6 }] },
      { name: 'Резонанс', mul: 2.8, w: 3, cd: 4, heavy: true, ranged: true, apply: [{ s: 'stun', turns: 1 }], warn: 'Всё вокруг перестаёт звенеть. Сердце втягивает звук в себя…' },
    ],
    phases: [
      { below: 0.75, text: 'Из боковых штреков выходят подпевающие. Строй смыкается.', summon: ['vein_singer'] },
      { below: 0.5, text: 'На стенах вскипает медь. Наросты тянутся к тебе.', self: [{ s: 'reflect', turns: 3 }], summon: ['copper_growth'] },
      { below: 0.25, text: 'Пульс срывается в бег. Тебе кажется, что твоё сердце подстраивается.', self: [{ s: 'haste', turns: 99 }, { s: 'might', turns: 99 }], apply: [{ s: 'weak', turns: 2 }] },
    ] },

  /* Мёртвый Тракт */
  road_driver: { name: 'Возница без лошади', lvl: 20, hp: 1500, atk: 136, armor: 32, speed: 92, shape: 'humanoid', look: 'driver', xp: 1350, gold: 180, tint: '#55504a', accent: '#ffd9a0', size: 1.04,
    blurb: 'Сидел на козлах, пока мог. Теперь идёт впереди телеги и тянет сам. Просит не занимать дорогу.',
    moves: [
      { name: 'Кнут', mul: 1, w: 3, ranged: true, apply: [{ s: 'bleed', stacks: 3 }] },
      { name: 'Прочь с дороги', mul: 2, w: 2, cd: 3, heavy: true, apply: [{ s: 'slow', turns: 2 }], warn: 'Возница наматывает кнут на руку и идёт прямо на тебя, не сбавляя шага…' },
    ] },
  ash_horse: { name: 'Пепельная лошадь', lvl: 20, hp: 1250, atk: 142, armor: 18, speed: 124, shape: 'wolf', xp: 1250, gold: 170, tint: '#7c7468', accent: '#ffb46a', size: 1.18,
    blurb: 'Сбруя вросла в шею. Двенадцать лет как понесла и всё никак не остановится.',
    moves: [
      { name: 'Копыта', mul: 1, w: 3 },
      { name: 'Понесла', mul: 2.1, w: 2, cd: 3, heavy: true, warn: 'Лошадь храпит, бьёт в пепел копытом и прижимает уши…' },
    ] },
  pilgrim: { name: 'Паломник к Хмари', lvl: 19, hp: 1100, atk: 128, armor: 16, speed: 98, shape: 'humanoid', look: 'robed', xp: 1100, gold: 150, tint: '#6a5a4a', accent: '#d8c8a0', size: 1,
    blurb: 'Сам пришёл. Идёт спросить, можно ли не отвечать. Ему уже ответили.',
    moves: [
      { name: 'Посох странника', mul: 0.95, w: 3 },
      { name: 'Молитва', mul: 0.4, w: 2, cd: 4, ranged: true, apply: [{ s: 'silence', turns: 1 }] },
      { name: 'Благословить ближнего', mul: 0, w: 2, cd: 3, ranged: true, healAlly: 0.2 },
    ] },
  caravan_master: { name: 'Старшина Каравана', lvl: 21, hp: 17000, atk: 170, armor: 42, speed: 96, shape: 'humanoid', look: 'caravan', xp: 18000, gold: 5000, tint: '#4a4640', accent: '#ffd9a0', size: 1.5, boss: true, lore: 'caravan',
    drop: ['master_whip', 'last_ledger', 'road_boots'], blurb: 'Вывел последний караван из Аш-Тара в ту ночь. Шестьсот человек. Он до сих пор ведёт их, и до сих пор один шаг в год.',
    intro: '«Подорожную, — говорит он, не поднимая глаз от списка. — У меня тут все записаны. Тебя нет. Значит, запишем».',
    moves: [
      { name: 'Окованный багор', mul: 1, w: 3 },
      { name: 'Вычеркнуть', mul: 0.6, w: 2, cd: 3, ranged: true, apply: [{ s: 'vuln', turns: 2 }, { s: 'weak', turns: 1 }] },
      { name: 'Всем стоять', mul: 0.4, w: 2, cd: 4, ranged: true, apply: [{ s: 'silence', turns: 1 }, { s: 'slow', turns: 2 }] },
      { name: 'Караван идёт', mul: 2.7, w: 3, cd: 4, heavy: true, warn: 'Позади него со скрипом трогается вся вереница. Один шаг. Прямо по тебе…' },
    ],
    phases: [
      { below: 0.7, text: '«Первый десяток, вперёд». Возницы бросают телеги.', summon: ['road_driver'] },
      { below: 0.45, text: 'Лошади рвут постромки. Старшина этого не приказывал, но отмечает в списке.', summon: ['ash_horse', 'ash_horse'] },
      { below: 0.2, text: 'Он закрывает список. «Значит, никто не дойдёт».', self: [{ s: 'haste', turns: 99 }, { s: 'might', turns: 99 }] },
    ] },

  /* Бронзовые Врата */
  gatekeeper: { name: 'Привратник', lvl: 22, hp: 1900, atk: 152, armor: 56, speed: 84, shape: 'humanoid', look: 'gatekeeper', xp: 1650, gold: 220, tint: '#6e6048', accent: '#e8c478', size: 1.14,
    blurb: 'Приказ: никого не впускать и никого не выпускать. Он честно не понимает, откуда ты взялся.',
    moves: [
      { name: 'Алебарда', mul: 1, w: 3 },
      { name: 'Стена щитов', mul: 0, w: 2, cd: 4, ranged: true, self: [{ s: 'guard', turns: 1 }], shieldSelf: 0.12 },
      { name: 'Именем Круга', mul: 2.2, w: 3, cd: 3, heavy: true, apply: [{ s: 'stun', turns: 1 }], warn: 'Привратник поднимает алебарду двумя руками и произносит устав…' },
    ] },
  bronze_face: { name: 'Бронзовый лик', lvl: 22, hp: 2300, atk: 146, armor: 70, speed: 66, shape: 'golem', xp: 1700, gold: 230, tint: '#8a6c3c', accent: '#ffe08a', size: 1.2,
    blurb: 'Лицо с врат, которое отделилось от врат. Бить его можно. Больно будет обоим.',
    moves: [
      { name: 'Вес бронзы', mul: 1.05, w: 3 },
      { name: 'Покрыться патиной', mul: 0, w: 2, cd: 4, ranged: true, self: [{ s: 'reflect', turns: 2 }] },
      { name: 'Медный звон', mul: 0.6, w: 2, cd: 3, ranged: true, apply: [{ s: 'corrode', turns: 3 }, { s: 'silence', turns: 1 }] },
    ] },
  tower_archer: { name: 'Стрелок с башни', lvl: 21, hp: 1250, atk: 158, armor: 20, speed: 116, shape: 'humanoid', look: 'archer', xp: 1400, gold: 190, tint: '#4e5048', accent: '#ffd9a0', size: 1,
    blurb: 'Стрелы кончились одиннадцать лет назад. Теперь стреляет чем есть. Лучше не смотреть, чем.',
    moves: [
      { name: 'Выстрел', mul: 1, w: 3, ranged: true },
      { name: 'В колено', mul: 0.7, w: 2, cd: 3, ranged: true, apply: [{ s: 'slow', turns: 2 }, { s: 'bleed', stacks: 4 }] },
      { name: 'Прицельный', mul: 2.2, w: 2, cd: 3, heavy: true, ranged: true, warn: 'Стрелок задерживает дыхание, которого у него нет…' },
    ] },
  gate_warden: { name: 'Последний Привратник', lvl: 23, hp: 23000, atk: 190, armor: 54, speed: 90, shape: 'humanoid', look: 'warden_gate', xp: 25000, gold: 7000, tint: '#5a4c34', accent: '#ffe08a', size: 1.62, boss: true, lore: 'warden_gate',
    drop: ['gate_key', 'bronze_oath', 'tower_bow'], blurb: 'Закрыл ворота и проглотил ключ. Единственный, кто знает, что внутри не осталось никого, кого можно было бы спасти. Ворота он всё равно держит.',
    intro: '«Там никого нет, — говорит он устало. — Я проверял. Каждую ночь проверяю. Уходи». Он выше, чем ворота помнят. «Не уйдёшь? Да. Они тоже не уходили».',
    moves: [
      { name: 'Створка', mul: 1, w: 3 },
      { name: 'Засов', mul: 0.7, w: 2, cd: 3, apply: [{ s: 'stun', turns: 1 }, { s: 'corrode', turns: 2 }] },
      { name: 'Именем закрытых дверей', mul: 0.5, w: 2, cd: 4, ranged: true, apply: [{ s: 'silence', turns: 2 }] },
      { name: 'Ворота закрываются', mul: 2.9, w: 3, cd: 4, heavy: true, warn: 'Он разводит руки в стороны и начинает медленно сводить их на тебе…' },
    ],
    phases: [
      { below: 0.75, text: 'Трубит рог. Со стены спускается смена.', summon: ['gatekeeper'] },
      { below: 0.5, text: 'С врат один за другим отваливаются лики и падают рядом, не разбиваясь.', self: [{ s: 'reflect', turns: 3 }], summon: ['bronze_face'] },
      { below: 0.25, text: 'Он открывает рот, и видно ключ. Он больше ничего не охраняет, кроме него.', self: [{ s: 'haste', turns: 99 }, { s: 'might', turns: 99 }], summon: ['tower_archer'] },
    ] },

  /* Аш-Тар */
  hor_priest: { name: 'Жрец Хора', lvl: 24, hp: 2200, atk: 172, armor: 34, speed: 102, shape: 'humanoid', look: 'hor', xp: 1950, gold: 260, tint: '#d8d0bc', accent: '#ffb46a', size: 1.04,
    blurb: 'Выгорел изнутри, снаружи всё ещё белый. Продолжает службу: одну ноту, одно слово.',
    moves: [
      { name: 'Литания', mul: 1, w: 3, ranged: true, apply: [{ s: 'burn', stacks: 3 }] },
      { name: 'Без голоса', mul: 0.5, w: 2, cd: 4, ranged: true, apply: [{ s: 'silence', turns: 2 }] },
      { name: 'Отпущение', mul: 0, w: 2, cd: 3, ranged: true, healAlly: 0.2 },
      { name: 'Ответ ветра', mul: 2.3, w: 2, cd: 3, heavy: true, ranged: true, apply: [{ s: 'vuln', turns: 2 }], warn: 'Жрец запрокидывает голову. Из его рта начинает идти пепел…' },
    ] },
  tower_echo: { name: 'Эхо башни', lvl: 23, hp: 1100, atk: 160, armor: 6, speed: 128, shape: 'spirit', xp: 1300, gold: 170, tint: '#b8b4c4', accent: '#ffffff', size: 0.9, deathBlast: 1,
    blurb: 'То, что осталось от очень громкого слова. Рассыпается на отголоски.',
    moves: [
      { name: 'Кто', mul: 0.9, w: 3, ranged: true },
      { name: 'Ты', mul: 0.5, w: 2, cd: 3, ranged: true, apply: [{ s: 'weak', turns: 2 }, { s: 'vuln', turns: 1 }] },
    ] },
  nameless: { name: 'Безымянный', lvl: 24, hp: 2500, atk: 178, armor: 40, speed: 104, shape: 'humanoid', look: 'nameless', xp: 2100, gold: 280, tint: '#1e1c26', accent: '#ff7c56', size: 1.08,
    blurb: 'Ответил не своим именем. Теперь отвечает на всё. Он очень вежлив и очень пуст.',
    moves: [
      { name: 'Твой же жест', mul: 1.05, w: 3 },
      { name: 'Чужое лицо', mul: 0, w: 2, cd: 4, ranged: true, self: [{ s: 'reflect', turns: 2 }, { s: 'evade', turns: 1 }] },
      { name: 'Забрать букву', mul: 0.7, w: 2, cd: 3, ranged: true, apply: [{ s: 'silence', turns: 1 }, { s: 'weak', turns: 2 }] },
      { name: 'Вежливая пустота', mul: 2.4, w: 2, cd: 3, heavy: true, warn: 'Безымянный кланяется. За его спиной нет ничего, совсем ничего…' },
    ] },
  the_question: { name: 'Тот, Кто Спросил', lvl: 25, hp: 32000, atk: 215, armor: 58, speed: 104, shape: 'question', xp: 40000, gold: 12000, tint: '#d8d4cc', accent: '#ffb46a', size: 1.6, boss: true, lore: 'question',
    drop: ['question_blade', 'hor_crown', 'first_word'], blurb: 'У него твоя походка. Ты видел её, когда смотрел на свою тень. Он пришёл не убивать. Он пришёл узнать.',
    intro: 'Наверху самой высокой башни никого нет. Только пепел, который поднимается и принимает твою форму. «Кто ты?» — спрашивает он твоим голосом. Он правда не знает. Он спрашивает с той самой ночи.',
    moves: [
      { name: 'Твой удар', mul: 1, w: 3 },
      { name: 'Кто ты', mul: 0.7, w: 3, cd: 3, ranged: true, apply: [{ s: 'silence', turns: 1 }, { s: 'vuln', turns: 2 }] },
      { name: 'Чужая память', mul: 0.8, w: 2, cd: 3, ranged: true, apply: [{ s: 'weak', turns: 2 }, { s: 'burn', stacks: 6 }, { s: 'corrode', turns: 2 }] },
      { name: 'Стереть', mul: 3, w: 3, cd: 4, heavy: true, ranged: true, warn: 'Пепел перестаёт падать. Он забывает, как падать. Это начинается у твоих ног…' },
    ],
    phases: [
      { below: 0.8, text: '«Кто ты?» — спрашивают с лестницы. Жрецы поднимаются на службу.', summon: ['hor_priest'] },
      { below: 0.6, text: 'С него слетает твоё лицо. Под ним другое. И другое. И все смотрят.', self: [{ s: 'reflect', turns: 3 }], summon: ['nameless'] },
      { below: 0.4, text: 'Хмарь входит в окна башни и садится рядом, послушать.', apply: [{ s: 'silence', turns: 1 }, { s: 'slow', turns: 2 }], summon: ['tower_echo', 'tower_echo'] },
      { below: 0.15, text: '«Пожалуйста. Кто-нибудь. Кто я?» Он бьёт, потому что больше ничего не умеет.', self: [{ s: 'haste', turns: 99 }, { s: 'might', turns: 99 }] },
    ] },
};
for (const id in LATE_ENEMIES) { LATE_ENEMIES[id].id = id; ENEMIES[id] = LATE_ENEMIES[id]; }

/* Поправка сложности: множители подобраны симулятором (tools/sim.js) */
const LATE_BOSS_TUNE = {
  old_driller: { hp: 0.85, atk: 0.8, xp: 0.85 }, mother_furnace: { hp: 0.7, atk: 0.55, xp: 0.8 }, vein_heart: { hp: 1, atk: 1.05, xp: 0.75 },
  caravan_master: { hp: 1.05, atk: 1.4, xp: 0.7 }, gate_warden: { hp: 1.05, atk: 1.55, xp: 0.7 }, the_question: { hp: 0.9, atk: 1.2, xp: 0.7 },
};
const LATE_MOB_TUNE = [
  { upTo: 15, hp: 1, atk: 1, xp: 0.85 },
  { upTo: 18, hp: 0.95, atk: 1, xp: 0.8 },
  { upTo: 20, hp: 1.05, atk: 1.2, xp: 0.75 },
  { upTo: 22, hp: 1.15, atk: 1.75, xp: 0.7 },
  { upTo: 25, hp: 1.25, atk: 1.95, xp: 0.7 },
];
for (const id in LATE_ENEMIES) {
  const e = LATE_ENEMIES[id];
  const t = LATE_BOSS_TUNE[id] || LATE_MOB_TUNE.find(b => e.lvl <= b.upTo);
  e.hp = Math.round(e.hp * t.hp);
  e.atk = Math.round(e.atk * t.atk);
  e.xp = Math.round(e.xp * t.xp);
}

/* --- легендарные вещи --- */
Object.assign(UNIQUES, {
  driller_gauntlet: { name: 'Рукавица Деда', slot: 'gloves', kind: 'gauntlet', rarity: 'legendary', ilvl: 15, stats: { str: 8, armor: 14, crit: 4 },
    desc: 'Внутри ещё что-то шевелится. Наверное, пальцы.', mods: { vsStatus: { corrode: 25, stun: 20 } }, trait: '+25% урона по цели со ржой, +20% по оглушённой.' },
  tag_seventeen: { name: 'Жетон № 17', slot: 'amulet', kind: 'amulet', rarity: 'legendary', ilvl: 15, stats: { vit: 8, hp: 60 },
    desc: 'Если носить его, тебя не спрашивают. Никто. Ни о чём.', on: { start: [{ apply: 'deaf', turns: 3, to: 'self' }] }, trait: 'Первые 3 хода боя Немота не действует.' },
  bell_mold: { name: 'Форма для колокола', slot: 'offhand', family: 'shield', rarity: 'legendary', ilvl: 17, stats: { vit: 9, armor: 18 },
    desc: 'Закрываться ею удобно. Звенит, когда попадают.', on: { guard: [{ shield: 0.08 }, { apply: 'counter', turns: 1, to: 'self' }] }, trait: 'Защита даёт щит на 8% и контрудар на ход.' },
  slag_crown: { name: 'Венец из шлака', slot: 'helmet', kind: 'crown', rarity: 'legendary', ilvl: 17, stats: { wil: 10, hp: 60 },
    desc: 'Тёплый и немного давит. Как чужой взгляд.', mods: { dotPct: 25, burnExtra: 2 }, trait: '+25% к эффектам. Поджог даёт на 2 стака огня больше.' },
  cold_iron: { name: 'Холодное железо', slot: 'weapon', family: 'sword', rarity: 'legendary', ilvl: 17, stats: { str: 10, crit: 8 },
    desc: 'Единственная отливка, которую печь отказалась принять.', on: { hit: [{ apply: 'corrode', turns: 2, chance: 0.4 }] }, trait: 'Удары с шансом 40% вызывают ржу: броня цели работает хуже.' },
  vein_string: { name: 'Струна из жилы', slot: 'weapon', family: 'lyre', rarity: 'legendary', ilvl: 19, stats: { wil: 12, speed: 10 },
    desc: 'Издаёт только одну ноту. Ту самую.', on: { crit: [{ apply: 'stagger', turns: 1 }] }, mods: { ladPct: 2 }, trait: 'Криты сбивают с ног. +2% силы за ступень лада.' },
  copper_heart: { name: 'Медное сердце', slot: 'chest', kind: 'plate', rarity: 'legendary', ilvl: 19, stats: { vit: 12, hp: 120 },
    desc: 'Его сердце бьётся теперь и за тебя. Твоё немного обижено.', on: { start: [{ apply: 'regen', stacks: 5, to: 'self' }] }, mods: { hpPct: 6 }, trait: '+6% здоровья. В начале боя 5 регенерации.' },
  canary_cage: { name: 'Клетка с канарейкой', slot: 'offhand', family: 'lantern', rarity: 'legendary', ilvl: 19, stats: { agi: 10, dodge: 8 },
    desc: 'Птица жива. Пока жива. Смотри на неё почаще.', on: { dodge: [{ gainRes: 1 }, { apply: 'evade', turns: 1, to: 'self', chance: 0.3 }] }, trait: 'Уклонение даёт ресурс и иногда завесу.' },
  master_whip: { name: 'Кнут Старшины', slot: 'weapon', family: 'saber', rarity: 'legendary', ilvl: 21, stats: { agi: 13, speed: 12, crit: 8 },
    desc: 'Всё ещё подгоняет. Тебя в том числе.', on: { kill: [{ gainRes: 2 }, { apply: 'haste', turns: 2, to: 'self' }] }, trait: 'Убийство даёт ресурс и спешку на 2 хода.' },
  last_ledger: { name: 'Последний список', slot: 'offhand', family: 'tome', rarity: 'legendary', ilvl: 21, stats: { wil: 14, dotPct: 15 },
    desc: 'Шестьсот имён. Теперь у тебя.', on: { start: [{ apply: 'curse', stacks: 3, to: 'allEnemies' }] }, trait: 'В начале боя все враги получают 3 проклятия.' },
  road_boots: { name: 'Сапоги с тракта', slot: 'boots', kind: 'greaves', rarity: 'legendary', ilvl: 21, stats: { vit: 10, speed: 12, armor: 12 },
    desc: 'Сами знают дорогу. Спорить бесполезно.', flags: { hmarFree: 3 }, trait: 'На вылазке первые 3 шага не сгущают Хмарь.' },
  gate_key: { name: 'Ключ от Врат', slot: 'weapon', family: 'hammer', rarity: 'legendary', ilvl: 23, stats: { str: 16, armor: 16 },
    desc: 'Тяжелее, чем кажется. И открывает, как оказалось, всё.', on: { crit: [{ apply: 'vuln', turns: 2 }] }, mods: { dmgPct: 12 }, trait: '+12% урона. Криты делают цель уязвимой.' },
  bronze_oath: { name: 'Бронзовая присяга', slot: 'ring', kind: 'ring', rarity: 'legendary', ilvl: 23, stats: { vit: 10, crit: 8 },
    desc: 'Ты ничего не обещал. Кольцо считает иначе.', mods: { guardShield: 15, armorPct: 12 }, trait: 'Защита даёт щит на 15% здоровья. +12% брони.' },
  tower_bow: { name: 'Копьё с башни', slot: 'weapon', family: 'spear', rarity: 'legendary', ilvl: 23, stats: { agi: 16, crit: 10, speed: 8 },
    desc: 'Стрела кончилась. Это древко от неё.', mods: { critDmg: 40 }, trait: '+40% крит. урона.' },
  question_blade: { name: 'Клинок без имени', slot: 'weapon', family: 'dagger', rarity: 'legendary', ilvl: 25, stats: { agi: 18, crit: 14 },
    desc: 'На нём ничего нельзя выгравировать. Буквы сползают.', on: { crit: [{ heal: 0.04 }, { gainRes: 1 }] }, trait: 'Криты лечат на 4% и дают ресурс.' },
  hor_crown: { name: 'Венец Хора', slot: 'helmet', kind: 'crown', rarity: 'legendary', ilvl: 25, stats: { wil: 18, hp: 120 },
    desc: 'Сто голосов. Один слушает тебя.', mods: { dmgPct: 12, dotPct: 20, healPct: 20 }, trait: '+12% урона, +20% к эффектам и лечению.' },
  first_word: { name: 'Первое слово', slot: 'amulet', kind: 'amulet', rarity: 'legendary', ilvl: 25, stats: { vit: 14, hp: 160 },
    desc: 'Его сказали в ту ночь. Теперь можно взять обратно.', flags: { cheatDeath: 0.4 }, on: { start: [{ apply: 'might', turns: 2, to: 'self' }] }, trait: 'Раз за бой смертельный удар оставляет 1 здоровья и щит на 40%. В начале боя мощь на 2 хода.' },
});

/* --- расходники и новые ступени вещей --- */
Object.assign(CONSUMABLES, {
  miner_tonic: { name: 'Шахтёрская настойка', icon: 'potion', tint: '#c88a3c', rarity: 'rare', value: 90, minLevel: 13, heal: 0.7, desc: 'Лечит на 70% здоровья. Пахнет дёгтем.', field: true },
  grease: { name: 'Оружейная смазка', icon: 'vial', tint: '#8a8074', rarity: 'uncommon', value: 70, minLevel: 13, cleanse: true, status: 'might', turns: 2, desc: 'Снимает вредные эффекты, включая ржу, и даёт мощь на 2 хода.' },
});

const FIFTH_TIER = {
  sword: 'Палаш шахтной стражи', axe: 'Секира крепильщика', hammer: 'Молот проходчика', spear: 'Рудничная пика', dagger: 'Кинжал из жилы', saber: 'Сабля с медной гардой', kris: 'Медный крис', staff: 'Посох из крепи', wand: 'Жезл штейгера', scythe: 'Коса из рессоры', lyre: 'Лира с медными струнами',
  shield: 'Заслонка горна', buckler: 'Баклер из жетонов', tome: 'Табельная книга', lantern: 'Шахтёрская лампа',
  hood: 'Капюшон запальщика', kettle: 'Каска штейгера', greathelm: 'Шлем с заслонкой', crown: 'Венец из проволоки',
  robe: 'Роба литейщика', leather: 'Куртка забойщика', mail: 'Кольчуга из медных колец', plate: 'Панцирь из заслонок',
  wraps: 'Обмотки литейщика', gauntlet: 'Литейные рукавицы', shoes: 'Сапоги штейгера', greaves: 'Поножи забойщика',
  ring: 'Кольцо из самородка', amulet: 'Жетон без номера',
};
const SIXTH_TIER = {
  sword: 'Меч Белых Башен', axe: 'Секира Врат', hammer: 'Молот из бронзы Врат', spear: 'Копьё Круга', dagger: 'Кинжал Хора', saber: 'Сабля последнего каравана', kris: 'Крис жреца', staff: 'Посох Ста Башен', wand: 'Жезл первого слова', scythe: 'Коса Аш-Тара', lyre: 'Лира Хора Башен',
  shield: 'Щит с лика Врат', buckler: 'Баклер привратника', tome: 'Устав Круга', lantern: 'Лампада башни',
  hood: 'Капюшон Хора', kettle: 'Шлем Порога', greathelm: 'Глухой шлем Врат', crown: 'Венец белого камня',
  robe: 'Риза Аш-Тара', leather: 'Куртка возницы', mail: 'Кольчуга Порога', plate: 'Панцирь Белых Башен',
  wraps: 'Обмотки паломника', gauntlet: 'Рукавицы Врат', shoes: 'Сапоги паломника', greaves: 'Поножи привратника',
  ring: 'Кольцо Круга', amulet: 'Медальон с пустым именем',
};
for (const T of [FIFTH_TIER, SIXTH_TIER]) {
  for (const id in WEAPONS) WEAPONS[id].tiers.push(T[id]);
  for (const id in OFFHANDS) OFFHANDS[id].tiers.push(T[id]);
  for (const slot in ARMORS) for (const a of ARMORS[slot]) a.tiers.push(T[a.kind]);
}

/* --- жители --- */
Object.assign(NPCS, {
  gordey: { id: 'gordey', hub: 'copper', name: 'Бригадир Гордей', role: 'Номер 2, глава посёлка', tint: '#e0a050', look: { cloth: '#4a3e30', trim: '#e0a050', hair: '#7a6a58', skin: '#b08e72', helmet: 'kettle', chest: 'leather' },
    entry: [
      { if: { questDone: 'q_vein' }, go: 'after' },
      { if: { questReady: 'q_vein' }, go: 'vein_done' },
      { if: { questActive: 'q_vein' }, go: 'vein_wait' },
      { if: { questReady: 'q_furnace' }, go: 'furnace_done' },
      { if: { questActive: 'q_furnace' }, go: 'furnace_wait' },
      { if: { questReady: 'q_driller' }, go: 'driller_done' },
      { if: { questActive: 'q_driller' }, go: 'driller_wait' },
      { go: 'first_meet' },
    ],
    nodes: {
      first_meet: { text: 'Коренастый человек в каске заполняет табель и не поднимает головы. «Письмо от Агнии? Положи. Имя твоё мне не говори, запишу номером. Здесь так. Пепел спрашивает: „Кто ты?“. Номер триста сорок отвечает: „Триста сорок“. И пепел отстаёт. Ему это неинтересно». Он наконец смотрит на тебя. «Глупо? Зато у нас шестьсот человек и все пока живы. Были».',
        opts: [{ t: '«Были?»', go: 'driller_give', do: { flag: 'gordey_met', questDone: 'q_road2' } }] },
      driller_give: { text: '«Жила запела. В верхних штольнях смена выходит и не возвращается, потом возвращается, но уже другая. Смену ведёт первый номер, Дед. Он был мне как отец и забрал у меня имя своими руками. Останови его. У него бур вместо рук, так что руки не жми».',
        opts: [{ t: 'Иду в штольни.', end: true, do: { quest: 'q_driller' } }] },
      driller_wait: { text: '«Клети встают на полпути. Снизу дёргают трос. Дед всё ещё на смене».', opts: [{ t: 'Уйти', end: true }] },
      driller_done: { text: 'Ты кладёшь на стол жетон № 1. Гордей двигает его пальцем и сбрасывает в ящик, к другим. Там глухо звякает. «Значит, смена окончена. Первая». Он долго смотрит в табель. «Жила поёт не сама. Плавильня снова греет. Печи разожгли ради колоколов сто лет назад, и что-то всё ещё льёт. Сходи, погаси».',
        opts: [{ t: 'Погашу.', end: true, do: { questDone: 'q_driller', quest: 'q_furnace' } }] },
      furnace_wait: { text: '«Дым пока идёт. Значит, плавка идёт».', opts: [{ t: 'Уйти', end: true }] },
      furnace_done: { text: 'Над посёлком впервые за сто лет чистое небо, и люди выходят смотреть. Гордей не выходит. «Осталось сердце. На самом дне. Наши прадеды добыли из него колокола для Аш-Тара. Когда жрецы задали свой вопрос, колокола подхватили, а эта медь всё ещё помнит ноту. Пока оно звучит, Хмарь знает, куда идти».',
        opts: [{ t: 'Я спущусь.', end: true, do: { questDone: 'q_furnace', quest: 'q_vein' } }] },
      vein_wait: { text: '«Если услышишь, что подпеваешь сам, поднимайся. Сразу. Не дослушивай».', opts: [{ t: 'Уйти', end: true }] },
      vein_done: { text: 'Посёлок тих так, как никогда не был. Гордей снимает каску и кладёт на табель. Затем достаёт из ящика один жетон и долго его вертит. «Дмитрий, — говорит он. — Меня зовут Дмитрий. Кажется. Надо будет у кого-нибудь спросить». Он откашливается. «Гонец с Порога ждёт ответа. Они дальше всех, и им хуже всех. Врата. Иди. Дорогу теперь не держит ничего».',
        opts: [{ t: 'Пойду на Порог.', end: true, do: { questDone: 'q_vein', flag: 'region3_done' } }] },
      after: { text: () => pickLine(['«Дмитрий, номер два. Привыкаю». Он улыбается одной половиной лица.', '«Смены теперь по именам. Табель длиннее втрое, зато всем весело. Заполняю третьи сутки».']),
        opts: [{ t: 'Уйти', end: true }] },
    } },

  nyura: { id: 'nyura', hub: 'copper', name: 'Учётчица Нюра', role: 'Ведёт книгу номеров', tint: '#88b0d0', look: { cloth: '#39424e', trim: '#88b0d0', hair: '#4a3a30', skin: '#c8ac96', helmet: 'none', chest: 'robe' },
    entry: [
      { if: { questReady: 'q_tags' }, go: 'tags_done' },
      { if: { questActive: 'q_tags' }, go: 'tags_wait' },
      { if: { flag: 'gordey_met', noQuest: 'q_tags' }, go: 'tags_give' },
      { go: 'idle' },
    ],
    nodes: {
      tags_give: { text: 'Огромная книга, в ней два столбца: номер и прочерк. Нюра отводит тебя в угол и шепчет: «Прочерков нет, понимаешь? Я списывала. Настоящие имена. У меня есть вторая книга, тайная, и если жетон вернётся, я смогу их сверить. Принеси жетоны забойщиков. Восемь хотя бы. Гордею не говори».',
        opts: [{ t: 'Договорились.', end: true, do: { quest: 'q_tags' } }, { t: 'Не сейчас.', end: true }] },
      tags_wait: { text: '«Тише. Пока не хватает. Ищи тех, кто ещё ходит в смену».', opts: [{ t: 'Уйти', end: true }] },
      tags_done: { text: 'Она раскладывает жетоны, сверяет, водит пальцем по чужому почерку. На третьем у неё начинают дрожать губы. «Вот. Сто шестьдесят два: Аким. Любил редьку. У него жена наверху, она думает, что это он ей пишет раз в месяц. Это я ей пишу». Она протягивает тебе тонкую связку монет и листок с именами. «Отнеси Тихону. Пусть прочитает. Пожалуйста».',
        opts: [{ t: 'Отнесу.', end: true, do: { questDone: 'q_tags', name: 3 } }] },
      idle: { text: () => pickLine(['«Номера не спорят, не болеют и не просят аванс. Цитирую Гордея».', '«У меня хороший почерк. Это всё, что от меня останется, и этого достаточно».']), opts: [{ t: 'Уйти', end: true }] },
    } },

  yerema: { id: 'yerema', hub: 'copper', name: 'Птичник Ерёма', role: 'Канарейки и лавка для отдыха', tint: '#e8d060', look: { cloth: '#50482c', trim: '#e8d060', hair: '#d0ccc0', skin: '#c8a88e', helmet: 'none', chest: 'leather' },
    shop: 'tavern',
    entry: [
      { if: { questReady: 'q_canaries' }, go: 'c_done' },
      { if: { questActive: 'q_canaries' }, go: 'c_wait' },
      { if: { flag: 'gordey_met', noQuest: 'q_canaries' }, go: 'c_give' },
      { go: 'idle' },
    ],
    nodes: {
      c_give: { text: '«Сынок, у меня клетки пустые. Канарейка внизу упала — значит, газ, значит, беги. Наверху их почти не осталось, а внизу иногда сидят живые, по старым клеткам. Принеси трёх. Я их отпою и потомство дам. Без птиц в забой нельзя, это даже номера понимают».',
        opts: [{ t: 'Трёх канареек.', end: true, do: { quest: 'q_canaries' } }, { t: 'Может, потом.', end: true }] },
      c_wait: { text: () => `«Пока ${Game.state.flags.canaries || 0} из 3. Живых неси. Мёртвые у меня и сами поют».`, opts: [{ t: 'Уйти', end: true }] },
      c_done: { text: 'Он подносит клетку к уху, и птица, заморгав, вдруг выдаёт такую трель, что в Табельной роняют перо. Ерёма плачет в открытую, не стесняясь. «Вот. Вот что должно быть первым звуком в шахте. На вот, бери: настойка, сам гнал. И в цехах говори, что птицы снова есть».',
        opts: [{ t: 'Взять настойку', end: true, do: { questDone: 'q_canaries' } }] },
      idle: { text: () => pickLine(['«Спи, не бойся. Если птицы замолчат, разбужу. Если не разбужу, значит, некому».', '«Канарейка не поёт от радости. Она поёт, пока может. Как все тут».', '«Знаешь, почему номера никому не спасли жизнь? Потому что пепел не интересуется, а вот медь интересуется».']), opts: [{ t: 'Уйти', end: true }] },
    } },

  zoya: { id: 'zoya', hub: 'copper', name: 'Зоя', role: 'Раздаточная и заточка', tint: '#d07848', look: { cloth: '#503428', trim: '#d07848', hair: '#231a14', skin: '#b89478', helmet: 'none', chest: 'leather' },
    shop: 'market',
    entry: [
      { if: { questReady: 'q_brother' }, go: 'b_done' },
      { if: { questActive: 'q_brother' }, go: 'b_wait' },
      { if: { noQuest: 'q_brother', zone: 'copper_shafts' }, go: 'b_give' },
      { go: 'idle' },
    ],
    nodes: {
      b_give: { text: 'Она выдаёт тебе сдачу и не отпускает монету. «Брат у меня внизу. Номер семнадцать. Был Федька. Ходит в Плавильне, льёт. Говорят, ещё отзывается, если назвать по имени. Говорят, это плохо кончается». Монета наконец падает тебе в ладонь. «Назови. Если отзовётся, скажи, что я не обижаюсь за сапоги. Если нет… сделай что надо».',
        opts: [{ t: 'Найду его.', end: true, do: { quest: 'q_brother' } }, { t: 'Обещать не буду.', end: true }] },
      b_wait: { text: '«Федька. Семнадцатый. Левша, если что, на левую смотри».', opts: [{ t: 'Уйти', end: true }] },
      b_done: { text: () => (Game.flag('fedka_named')
          ? 'Ты рассказываешь, как он обернулся и сказал: «Сапоги были на два размера». И как потом стоял у печи и сам шагнул туда, где жарче, чтобы больше никого не лить. Зоя молчит, смотрит куда-то над твоим плечом и вдруг коротко смеётся. «На два размера. Точно. Дурак». Она ещё долго точит чужой нож.'
          : 'Ты отдаёшь ей жетон № 17. Она не спрашивает, как. Кладёт жетон на полку, рядом с другими вещами, ровно по краю. «Ну, сапоги теперь точно мои», — говорит она и улыбается так, что лучше бы не улыбалась.'),
        opts: [{ t: 'Взять плату и уйти', end: true, do: { questDone: 'q_brother' } }] },
      idle: { text: () => pickLine(['«Выдаю без росписи. Роспись тут всё равно ничего не значит».', '«Всё, что ломается внизу, чинится здесь. Кроме людей».']), opts: [{ t: 'Уйти', end: true }] },
    } },

  lyubava: { id: 'lyubava', hub: 'gate', name: 'Воевода Любава', role: 'Держит Порог', tint: '#d05040', look: { cloth: '#3c3234', trim: '#d05040', hair: '#a8a498', skin: '#b8947a', helmet: 'none', chest: 'plate' },
    entry: [
      { if: { questDone: 'q_question' }, go: 'after' },
      { if: { questActive: 'q_question' }, go: 'q_wait' },
      { if: { questReady: 'q_gate' }, go: 'gate_done' },
      { if: { questActive: 'q_gate' }, go: 'gate_wait' },
      { if: { questReady: 'q_caravan' }, go: 'caravan_done' },
      { if: { questActive: 'q_caravan' }, go: 'caravan_wait' },
      { go: 'first_meet' },
    ],
    nodes: {
      first_meet: { text: 'На стене пожилая женщина смотрит на восток так, будто там кто-то должен ей денег. Руки у неё в ожогах по локоть. «С востока за двенадцать лет никто не пришёл. И с запада тоже. Ты первый. Мира, значит, ещё жива. И Агния. Гордей прислал бумагу без подписи, это смешно». Она наконец оборачивается. «Ты пришёл сюда героем быть или закончить?»',
        opts: [{ t: 'Закончить.', go: 'caravan_give', do: { flag: 'lyubava_met', questDone: 'q_road3' } }] },
      caravan_give: { text: '«Хорошо, героев мы хоронили. На Тракте стоит последний караван из Аш-Тара. Шестьсот человек, и с той ночи они идут сюда, один шаг в год. Осталось четыре шага. Ведёт их Старшина. Если он дойдёт, Порога не будет. Сними его с дороги».',
        opts: [{ t: 'Сниму.', end: true, do: { quest: 'q_caravan' } }] },
      caravan_wait: { text: '«Сегодня ночью они снова шагнули. Я считала».', opts: [{ t: 'Уйти', end: true }] },
      caravan_done: { text: 'Ты отдаёшь ей список. Шестьсот имён, ровным почерком, и напротив каждого: «Дойдёт». Любава читает первую страницу и закрывает. «Хоть кто-то верил до конца. Дальше Врата. Их закрыл последний из стражи и проглотил ключ. Там, за ними, то, откуда всё началось. Я двенадцать лет держу Порог, чтобы никто туда не ходил. А теперь прошу тебя пойти. Смешно».',
        opts: [{ t: 'Не смешно.', end: true, do: { questDone: 'q_caravan', quest: 'q_gate' } }] },
      gate_wait: { text: '«С Врат снова отваливаются лица. Значит, он ещё на посту».', opts: [{ t: 'Уйти', end: true }] },
      gate_done: { text: 'Ты кладёшь перед ней тяжёлый ключ в засохшей крови. Она берёт его без всякого почтения и бросает на стол, как связку от чулана. «Ну вот. Двенадцать лет, и всего-то». Она молчит. «Там не бог. Иов тебе скажет. Там кто-то, кому задали вопрос и кто до сих пор не может ответить. Поднимись и… не знаю. Придумай что-нибудь. Я вояка. Мне это не по чину».',
        opts: [{ t: 'Придумаю.', end: true, do: { questDone: 'q_gate', quest: 'q_question' } }] },
      q_wait: { text: '«Иди. Я постою тут ещё. Я умею».', opts: [{ t: 'Уйти', end: true }] },
      after: { text: () => pickLine(['«Ну и что мне теперь делать на стене? Я ж только это и умею. Лавр говорит, научит варить. Врёт».', 'Она показывает на восток. Там видно горизонт. «Ты понимаешь, что я его забыла, как выглядит?»']), opts: [{ t: 'Уйти', end: true }] },
    } },

  iov: { id: 'iov', hub: 'gate', name: 'Отец Иов', role: 'Бывший жрец Хора', tint: '#d8d0bc', look: { cloth: '#7a7468', trim: '#d8d0bc', hair: '#e0dcd0', skin: '#c8b4a0', helmet: 'hood', chest: 'robe' },
    entry: [
      { if: { questReady: 'q_iov' }, go: 'iov_done' },
      { if: { questActive: 'q_iov' }, go: 'iov_wait' },
      { if: { flag: 'lyubava_met', noQuest: 'q_iov' }, go: 'iov_give' },
      { go: 'idle' },
    ],
    nodes: {
      iov_give: { text: 'Старик в келье сидит спиной к двери. «Я был там, — говорит он сразу. — Сорок восьмая башня, третий голос. Мы спросили ветер: „Кто здесь?“. Мы так спрашивали каждый вечер, сотни лет, ради порядка. И он ответил: „А кто ты?“ И никто из нас не смог сказать это так, чтобы он поверил». Его плечи опускаются. «На Тракте идут те, кто шёл за мной. Паломники. Я их благословил. Выведи хоть кого-нибудь, пока они не дошли».',
        opts: [{ t: 'Выведу, кого смогу.', end: true, do: { quest: 'q_iov' } }, { t: 'Это твой грех, старик.', go: 'iov_harsh' }] },
      iov_harsh: { text: '«Мой, — соглашается он. — Двенадцать лет как мой. Если передумаешь, я буду здесь. Я везде буду здесь».', opts: [{ t: 'Уйти', end: true }] },
      iov_wait: { text: () => `«Пока ${Game.state.flags.pilgrims || 0} из 4. Назови их по имени: это единственное, что их останавливает».`, opts: [{ t: 'Уйти', end: true }] },
      iov_done: { text: 'Спасённые сидят на кухне и молча едят. Иов смотрит на них через дверь и не заходит. «Я не прошу прощения: некому его дать. Но слушай. Ему не нужен ответ на вопрос, кто ты. Он спрашивает, потому что сам не знает, кто он. Это не приговор, это жалоба. Скажи ему что хочешь, но скажи так, чтобы это была правда».',
        opts: [{ t: 'Запомню.', end: true, do: { questDone: 'q_iov', flag: 'iov_truth' } }] },
      idle: { text: () => pickLine(['«Третий голос. Никто не запоминает третий голос. Поэтому меня и не тронуло».', '«Не ходи туда с ответом. Ходи туда с вопросом. Хотя бы для вежливости».']), opts: [{ t: 'Уйти', end: true }] },
    } },

  vera: { id: 'vera', hub: 'gate', name: 'Оружейница Вера', role: 'Оружейная и заточка', tint: '#a8c8d8', look: { cloth: '#343c44', trim: '#a8c8d8', hair: '#3a2a20', skin: '#b08a6e', helmet: 'none', chest: 'mail' },
    shop: 'market',
    entry: [
      { if: { questReady: 'q_bronze' }, go: 'br_done' },
      { if: { questActive: 'q_bronze' }, go: 'br_wait' },
      { if: { flag: 'lyubava_met', noQuest: 'q_bronze', zone: 'dead_road' }, go: 'br_give' },
      { go: 'idle' },
    ],
    nodes: {
      br_give: { text: '«Бронза с Врат лучшая на всём Пределе. Её отливал Круг, там что-то такое в составе, что даже Хмарь не грызёт. Разбей пяток ликов, что отвалились, и я тебе сделаю такое, чего больше не сделает никто. Потому что больше никто сюда не дойдёт».',
        opts: [{ t: 'Пять ликов.', end: true, do: { quest: 'q_bronze' } }, { t: 'Позже.', end: true }] },
      br_wait: { text: '«Жду бронзу. Угля у меня на неделю, терпения на двое суток».', opts: [{ t: 'Уйти', end: true }] },
      br_done: { text: 'Она взвешивает кусок лица на ладони и кивает кому-то невидимому. «Ещё улыбается, смотри-ка. Переплавлю». Через час ты получаешь вещь, тёплую ровно настолько, как будто её только что держал кто-то другой.',
        opts: [{ t: 'Взять', end: true, do: { questDone: 'q_bronze' } }] },
      idle: { text: () => pickLine(['«Точить — не лечить. Всё, что могу предложить».', '«Оружие для Аш-Тара? Бери какое нравится. Там это всё равно не главное».']), opts: [{ t: 'Уйти', end: true }] },
    } },

  lavr: { id: 'lavr', hub: 'gate', name: 'Повар Лавр', role: 'Единственный, кто здесь толстый', tint: '#d8a860', look: { cloth: '#4c3e2c', trim: '#d8a860', hair: '#2a1f1a', skin: '#caa68a', helmet: 'none', chest: 'robe', build: 1.2 },
    shop: 'tavern',
    entry: [
      { if: { questReady: 'q_salt' }, go: 's_done' },
      { if: { questActive: 'q_salt' }, go: 's_wait' },
      { if: { flag: 'lyubava_met', noQuest: 'q_salt' }, go: 's_give' },
      { go: 'idle' },
    ],
    nodes: {
      s_give: { text: '«Соль кончилась, а без соли они едят и не чувствуют. Поверишь ли, бойцы начинают забывать, что едят. На Тракте в обозах соль есть. Три мешка. И не смотри на меня так: война войной, а похлёбка по расписанию».',
        opts: [{ t: 'Три мешка соли.', end: true, do: { quest: 'q_salt' } }, { t: 'Не сейчас.', end: true }] },
      s_wait: { text: () => `«${Game.state.flags.salt || 0} мешков. Я считаю. Бойцы считают. Соль сама себя не посолит».`, opts: [{ t: 'Уйти', end: true }] },
      s_done: { text: 'Он пробует, закрывает глаза и замирает. На кухне стоит тишина. «Вот, — выдыхает он. — Вот теперь это похлёбка». Вечером на стене ты впервые слышишь, как кто-то ругает ужин. Любава клянётся, что это лучшая новость за год.',
        opts: [{ t: 'Взять плату', end: true, do: { questDone: 'q_salt' } }] },
      idle: { text: () => pickLine(['«Садись, ешь. Хочешь умереть — хотя бы сытым».', '«Двенадцать лет. Ни одной жалобы на меню. Это и пугает».', '«Рецепт простой: сначала вспомни, кто ты, потом посоли».']), opts: [{ t: 'Уйти', end: true }] },
    } },
});

/* --- задания --- */
Object.assign(QUESTS, {
  q_road2: { title: 'Письмо без имени', giver: 'agnia', turnIn: 'gordey', main: true, auto: { questDone: 'q_water_voice' }, desc: 'Агния показала тебе письмо из Медного Скола. Подпись на нём: номер два. Посмотри, что там случилось.',
    goals: [{ type: 'flag', target: 'gordey_met', need: 1, label: 'Найти бригадира Гордея в Медном Сколе', npc: 'gordey' }], reward: { gold: 600, xp: 1500 } },
  q_driller: { title: 'Смена без конца', giver: 'gordey', main: true, desc: 'Из верхних штолен смена выходит и возвращается другой. Её ведёт первый номер, которого здесь зовут Дедом.',
    goals: [{ type: 'boss', target: 'old_driller', need: 1, label: 'Остановить Деда-Проходчика' }], reward: { gold: 2000, xp: 4000, item: 'epic', talentPoint: 1 } },
  q_furnace: { title: 'Плавка', giver: 'gordey', main: true, desc: 'В Плавильне Гнева что-то всё ещё льёт. Печи, отлившие колокола Аш-Тара, должны остыть.',
    goals: [{ type: 'boss', target: 'mother_furnace', need: 1, label: 'Погасить Мать-Печь' }], reward: { gold: 3000, xp: 7000, item: 'epic', talentPoint: 1 } },
  q_vein: { title: 'Та самая нота', giver: 'gordey', main: true, desc: 'Сердце Жилы всё ещё звучит на ноте, с которой началась Хмарь. Спустись и заставь его замолчать.',
    goals: [{ type: 'boss', target: 'vein_heart', need: 1, label: 'Заглушить Сердце Жилы' }], reward: { gold: 4000, xp: 12000, item: 'epic', talentPoint: 2 } },
  q_tags: { title: 'Вторая книга', giver: 'nyura', desc: 'Учётчица тайно хранит настоящие имена шахтёров. Чтобы сверить их с номерами, ей нужны жетоны.',
    goals: [{ type: 'kill', target: 'numbered_miner', need: 8, label: 'Собрать жетоны забойщиков' }], reward: { gold: 1200, xp: 3000, consumable: 'miner_tonic', qty: 2 } },
  q_canaries: { title: 'Первый звук в шахте', giver: 'yerema', desc: 'Без канареек спускаться в забой нельзя, а они на исходе. Внизу в старых клетках ещё сидят живые.',
    goals: [{ type: 'flagCount', target: 'canaries', need: 3, label: 'Принести живых канареек', hint: 'Событие «Клетка в штреке» в зонах Медного Скола.' }], reward: { gold: 1200, xp: 3200, consumable: 'miner_tonic', qty: 3, talentPoint: 1 } },
  q_brother: { title: 'Сапоги на два размера', giver: 'zoya', desc: 'Брат Зои, номер семнадцать, всё ещё работает в Плавильне. Он может отозваться на имя, но это плохо кончается.',
    goals: [{ type: 'flag', target: 'fedka_met', need: 1, label: 'Найти Федьку в Плавильне', where: 'foundry', hint: 'Выбирай на маршруте клетки «Событие».' }], reward: { gold: 2000, xp: 4000, item: 'rare' } },
  q_road3: { title: 'Гонец с востока', giver: 'gordey', turnIn: 'lyubava', main: true, auto: { questDone: 'q_vein' }, desc: 'Форпост Порог двенадцать лет один держит дорогу на Аш-Тар. Они запрашивают подкрепление. Подкрепление — это ты.',
    goals: [{ type: 'flag', target: 'lyubava_met', need: 1, label: 'Поговорить с воеводой Любавой на Пороге', npc: 'lyubava' }], reward: { gold: 2500, xp: 5000 } },
  q_caravan: { title: 'Четыре шага', giver: 'lyubava', main: true, desc: 'Последний караван из Аш-Тара идёт к Порогу по шагу в год. До стен осталось четыре шага.',
    goals: [{ type: 'boss', target: 'caravan_master', need: 1, label: 'Снять с дороги Старшину Каравана' }], reward: { gold: 6000, xp: 14000, item: 'epic', talentPoint: 1 } },
  q_gate: { title: 'Ключ в горле', giver: 'lyubava', main: true, desc: 'Бронзовые Врата держит последний из стражи. Ключ от них он когда-то проглотил.',
    goals: [{ type: 'boss', target: 'gate_warden', need: 1, label: 'Победить Последнего Привратника' }], reward: { gold: 8000, xp: 20000, item: 'epic', talentPoint: 1 } },
  q_question: { title: 'Кто ты', giver: 'lyubava', main: true, desc: 'Поднимись на самую высокую башню Аш-Тара. Там всё ещё ждут ответа.',
    goals: [{ type: 'boss', target: 'the_question', need: 1, label: 'Подняться на башню и ответить' }], reward: { gold: 15000, xp: 30000, item: 'epic', talentPoint: 2 } },
  q_iov: { title: 'Третий голос', giver: 'iov', desc: 'На Мёртвом Тракте идут паломники, которых когда-то благословил Иов. Останови тех, кого ещё можно.',
    goals: [{ type: 'flagCount', target: 'pilgrims', need: 4, label: 'Вывести паломников', where: 'dead_road', hint: 'Событие «Идущие» на Мёртвом Тракте.' }], reward: { gold: 3000, xp: 7000, talentPoint: 1 } },
  q_bronze: { title: 'Лицо на переплавку', giver: 'vera', desc: 'Бронза с Врат лучшая на всём Пределе. Вера сделает из неё вещь, если принесёшь лики.',
    goals: [{ type: 'kill', target: 'bronze_face', need: 5, label: 'Разбить бронзовые лики' }], reward: { gold: 3000, xp: 8000, item: 'epic', itemSlot: 'weapon' } },
  q_salt: { title: 'Похлёбка по расписанию', giver: 'lavr', desc: 'Без соли бойцы забывают, что едят. В брошенных обозах на Тракте она ещё есть.',
    goals: [{ type: 'flagCount', target: 'salt', need: 3, label: 'Принести мешки соли', where: 'dead_road', hint: 'Событие «Обоз без хозяина» на Мёртвом Тракте.' }], reward: { gold: 2500, xp: 6000, consumable: 'miner_tonic', qty: 3 } },
});

/* --- события --- */
EVENTS.push(
  /* Руны: большая редкость на любой вылазке */
  { id: 'rune_stone', art: 'stone', title: 'Камень со знаком', weight: 1, minLevel: 3,
    text: 'В стороне от дороги стоит серый камень. На нём один-единственный знак, глубокий, старой работы, и в нём всё ещё что-то светится. Такие ставили Круг ещё до Хмари. Говорят, знак можно взять с собой, если заплатить.',
    opts: [
      { t: 'Приложить окровавленную ладонь', tag: 'кровь', res: { text: 'Камень пьёт долго и неторопливо. Когда ты отнимаешь руку, знак лежит у тебя на ладони маленьким холодным камешком. Камень позади стал просто камнем.', do: { hurt: 30, rune: true } } },
      { t: 'Прочитать знак вслух', tag: 'воля', check: { attr: 'wil', dc: 16 }, res: { text: 'Ты произносишь звук, которого никогда не слышал. Камень трескается ровно пополам. В разломе лежит руна.', do: { rune: true, hmar: 2 } }, fail: { text: 'Звук застревает в горле на целый день. Знак гаснет, и больше ты его не видишь.', do: { hurt: 10, xp: 20 } } },
      { t: 'Не трогать', res: { text: 'Такие вещи не твоё дело. Или твоё, но не сегодня. Ты идёшь дальше и потом долго об этом думаешь.', do: { xp: 15 } } },
    ] },

  /* Медный Скол: общие */
  { id: 'cage', art: 'lamp', title: 'Клетка в штреке', weight: 10, zones: ['copper_shafts', 'foundry', 'singing_vein'],
    text: 'На крюке висит ржавая клетка. Внутри, на жёрдочке, сидит канарейка и смотрит одним глазом. Живая. Рядом на земле лежит каска, и в ней ещё тёплая вода.',
    opts: [
      { t: 'Снять клетку', tag: 'ловкость', check: { attr: 'agi', dc: 16 }, res: { text: 'Ты снимаешь её так, что птица даже не перестаёт моргать. Несёшь на вытянутой руке. Она вдруг негромко пискнула: значит, пока можно дышать.', do: { count: { canaries: 1 }, xp: 200 } }, fail: { text: 'Крюк срывается со звоном. Клетка цела, птица цела, а вот снизу кто-то услышал.', do: { count: { canaries: 1 }, fight: true } } },
      { t: 'Выпустить птицу', tag: 'милосердие', res: { text: 'Канарейка садится тебе на плечо, чирикает один раз и улетает вверх, туда, где ты ещё не был. Становится почему-то легче.', do: { hmar: -2, blessing: 1 } } },
      { t: 'Оставить', res: { text: 'Клетка тихо раскачивается у тебя за спиной. Ты не оборачиваешься.', do: { xp: 60 } } },
    ] },
  { id: 'tag_board', art: 'stone', title: 'Табель смены', weight: 8, zones: ['copper_shafts', 'foundry', 'singing_vein'],
    text: 'На стене мелом расчерчен табель. Столбец номеров, столбец часов. Напротив одного номера вместо часов нацарапано имя, очень мелко: «Степан. Степан. Степан. Степан», и так до самого низа, пока не кончился мел.',
    opts: [
      { t: 'Прочитать имя вслух', res: { text: 'Откуда-то издалека отзывается кашель. В мелу под твоими пальцами остаётся тёплый осколок.', do: { name: 1, xp: 120 } } },
      { t: 'Стереть рукавом и записать туда себя', tag: 'риск', res: { text: 'Теперь ты в смене. Часы за тобой поплыли. Выйти отсюда стало легче: за тобой приглядывают. И ждут тоже.', do: { blessing: 2, omen: 1, hmar: 2 } } },
      { t: 'Пройти мимо', res: { text: 'Мел крошится от сквозняка. К вечеру не останется и этого.', do: {} } },
    ] },
  { id: 'hum', art: 'mist', title: 'Гудит в зубах', weight: 7, zones: ['copper_shafts', 'foundry', 'singing_vein'],
    text: 'Ты замечаешь, что давно мурлычешь какую-то одну ноту. Не вспомнить, с каких пор. Рядом в стене проступает медь, и гудит в той же тональности. Ты бы мог закончить. Там всего-то осталось немного.',
    opts: [
      { t: 'Прикусить язык до крови', tag: 'стойкость', check: { attr: 'vit', dc: 18 }, res: { text: 'Боль возвращает всё на свои места. Нота обрывается и никак не может начаться снова.', do: { hmar: -3, xp: 240 } }, fail: { text: 'Кровь идёт, а ноту ты всё ещё тянешь. Только теперь с бульканьем. Отпускает не сразу.', do: { hurt: 12, omen: 1 } } },
      { t: 'Допеть', tag: 'риск', res: { text: 'Ты допеваешь. Медь в стене лопается, и наружу вываливается всё, что она копила. Включая тех, кто за ней стоял.', do: { item: 'rare', fight: true, hmar: 2 } } },
      { t: 'Заложить уши воском', if: { consumable: 'wax' }, res: { text: 'Гул остаётся только в костях. Кости выдержат.', do: { useConsumable: 'wax', hmar: -2, blessing: 1 } } },
    ] },

  /* Штольни */
  { id: 'lift', art: 'cart', title: 'Клеть', weight: 8, zones: ['copper_shafts'],
    text: 'Подъёмная клеть висит на тросе в полушаге от площадки. Сверху никто её не держит. Внутри аккуратно стоит сундучок, а на нём приписка: «На смену № 3. Не трогать».',
    opts: [
      { t: 'Запрыгнуть и забрать', tag: 'ловкость', check: { attr: 'agi', dc: 17 }, res: { text: 'Клеть вздрагивает, но ты уже назад, а в руках у тебя сундук. Смена № 3 всё равно не придёт.', do: { item: 'rare', gold: 300 } }, fail: { text: 'Трос лопается. Ты на площадке, сундук падает вниз. Звук удара прилетает через минуту. И кто-то, кто идёт посмотреть.', do: { fight: true, hurt: 10 } } },
      { t: 'Дёрнуть сигнальную верёвку', res: { text: 'Два длинных, один короткий. Клеть с лязгом уходит наверх, и в штреке становится свежее: заработала тяга.', do: { hmar: -2, xp: 160 } } },
    ] },
  { id: 'gas_lamp', art: 'lamp', title: 'Лампа с жёлтым огнём', weight: 7, zones: ['copper_shafts'],
    text: 'На полу стоит шахтёрская лампа. Огонёк в ней вытянулся и стал жёлтым: верный знак, что вокруг газ. Лампа цела и очень хорошая. Запах, впрочем, становится сладким.',
    opts: [
      { t: 'Взять лампу и уйти быстро', tag: 'ловкость', check: { attr: 'agi', dc: 16 }, res: { text: 'Ты уходишь раньше, чем за спиной бухает. Хорошая лампа.', do: { item: 'uncommon', itemSlot: 'offhand', xp: 120 } }, fail: { text: 'Ты почти успел.', do: { hurt: 22, xp: 60 } } },
      { t: 'Потушить, не трогая', res: { text: 'Глаза долго привыкают к темноте. Ни взрыва, ни находки. В шахте это называется хорошим днём.', do: { xp: 90 } } },
    ] },

  /* Плавильня */
  { id: 'fedka', art: 'wound', title: 'Левша у ковша', weight: 40, zones: ['foundry'], once: true, ifFlag: { questActive: 'q_brother' },
    text: 'У самой большой изложницы работает литейщик. Левша. На груди номер 17. Он наливает, ждёт и снова наливает, хотя формы уже полны и металл течёт на пол. Сапоги у него новые, на два размера больше, и он в них шаркает.',
    opts: [
      { t: 'Позвать: «Федька!»', tag: 'воля', check: { attr: 'wil', dc: 18 }, res: { text: 'Ковш замирает. Он оборачивается медленно, с хрустом, как будто голова приржавела. «Сапоги, — говорит он. — Были на два размера. Передай». Он делает шаг к печи и, уже не глядя на тебя, идёт туда, где горячее. Сам. За ним никто больше не льёт.', do: { flag: 'fedka_named', flag2: 'fedka_met', xp: 500, name: 1 } }, fail: { text: 'Он оборачивается. «Кто?» — спрашивает он. Голос у него чужой. За ним оборачивается весь цех. Ты только и успеваешь снять с него жетон, когда всё кончается.', do: { flag: 'fedka_tag', flag2: 'fedka_met', hurt: 15, fight: true } } },
      { t: 'Подойти со спины и сделать всё быстро', tag: 'ловкость', res: { text: 'Он не успевает ничего заметить. Ковш падает и ещё долго катится. Ты снимаешь жетон, на котором всё ещё горячо.', do: { flag: 'fedka_tag', flag2: 'fedka_met', xp: 200, gold: 200 } } },
    ] },
  { id: 'mold', art: 'sack', title: 'Незаконченный колокол', weight: 8, zones: ['foundry'],
    text: 'В яме стоит форма для колокола высотой в три человека. Отливка почти готова, не хватает верхней части. Рядом лежит ковш с ещё жидким металлом и кем-то аккуратно написанная записка: «Долей, пожалуйста».',
    opts: [
      { t: 'Долить', tag: 'сила', check: { attr: 'str', dc: 18 }, res: { text: 'Колокол звонит сам, без языка, один раз. Всё в цеху на миг перестаёт работать, и в этой паузе ты находишь за формой то, что отливщики прятали от начальства.', do: { item: 'epic', hmar: 2 } }, fail: { text: 'Ковш слишком тяжёл. Часть попадает мимо, и часть на тебя.', do: { hurt: 22 } } },
      { t: 'Разбить форму', tag: 'сила', res: { text: 'Форма раскалывается, как орех. Внутри пустота и тишина. Литейщики вокруг поднимают головы с таким видом, будто ты сделал что-то совсем непростительное.', do: { fight: true, dust: 30, xp: 200 } } },
      { t: 'Оставить, как есть', res: { text: 'Записка шевелится от жара. Кто-то её ещё прочитает.', do: { xp: 80 } } },
    ] },
  { id: 'coal_man', art: 'camp', title: 'Кочегар на перекуре', weight: 6, zones: ['foundry'],
    text: 'На куче угля сидит кочегар и курит пустую трубку. Он живой, совершенно живой, и ему всё равно. «А, ещё один. Садись. Смена длинная. Сто лет как длинная».',
    opts: [
      { t: 'Сесть и посидеть', res: { text: 'Вы молчите о чём-то. Пот высыхает, руки перестают дрожать. Потом ты моргаешь, а его уже нет, только трубка лежит. Тёплая.', do: { heal: 30, hmar: -1 } } },
      { t: 'Спросить, как всё остановить', tag: 'воля', check: { attr: 'wil', dc: 17 }, res: { text: '«Да никак, — говорит он. — Но если ткнуть вон туда, дня на два встанет». Он показывает на вентиль. Ты тычешь. Встаёт.', do: { hmar: -4, xp: 260 } }, fail: { text: 'Он смотрит на тебя с большим сожалением и больше не отвечает. Даже когда ты уже уходишь.', do: { xp: 40 } } },
    ] },

  /* Жила */
  { id: 'choir_shift', art: 'mist', title: 'Смена поёт', weight: 8, zones: ['singing_vein'],
    text: 'В боковом штреке сидит смена. Тридцать человек, кружком, спины прямые. Все смотрят в центр, где ничего нет, и ровно поют одну ноту. Счастливые лица. У одного на коленях лежит кайло очень хорошей работы.',
    opts: [
      { t: 'Осторожно взять кайло', tag: 'ловкость', check: { attr: 'agi', dc: 19 }, res: { text: 'Ты вынимаешь его из расслабленных рук. Ни один не сбивается с ноты. Это хуже, чем если бы сбился.', do: { item: 'epic', itemSlot: 'weapon' } }, fail: { text: 'Кайло цепляется за ремень. Нота прерывается. Тридцать голов поворачиваются разом.', do: { fight: true, hurt: 10 } } },
      { t: 'Назвать одного по имени с жетона', tag: 'воля', check: { attr: 'wil', dc: 19 }, res: { text: 'Один из них моргает и начинает плакать. Встаёт, не понимая где он, и ты выводишь его к стволу. Хоть кого-то.', do: { name: 2, xp: 400, blessing: 1 } }, fail: { text: 'Он улыбается тебе ещё шире. Остальные тоже. Тебе машут: садись.', do: { omen: 1, hmar: 2 } } },
      { t: 'Уйти, не дыша', res: { text: 'Нота провожает тебя до поворота. Ещё долго гудит в рёбрах.', do: {} } },
    ] },
  { id: 'nugget', art: 'shard', title: 'Самородок в форме руки', weight: 7, zones: ['singing_vein'],
    text: 'Из стены торчит медная рука. Очень точная, с ногтями. Она сжимает что-то в кулаке. Пальцы, кажется, не до конца сжаты, и за ними блестит.',
    opts: [
      { t: 'Разжать пальцы', tag: 'сила', check: { attr: 'str', dc: 19 }, res: { text: 'Палец за пальцем, со скрипом. Внутри тёмный, очень старый предмет. Рука так и остаётся раскрытой. Жест выглядит теперь почти как просьба.', do: { item: 'rare', itemSlot: 'ring', dust: 25 } }, fail: { text: 'Пальцы сжимаются. Не на предмете. На твоих.', do: { hurt: 20 } } },
      { t: 'Пожать её', tag: 'риск', res: { text: 'Рука тёплая. Отвечает на пожатие крепко, как товарищ. Отпускает через долгую минуту, и ты чувствуешь, что теперь что-то должен.', do: { blessing: 2, hmar: 3 } } },
    ] },

  /* Мёртвый Тракт */
  { id: 'walkers', art: 'wound', title: 'Идущие', weight: 10, zones: ['dead_road'],
    text: 'По обочине цепочкой идут паломники. Глаза закрыты, рты шевелятся. Последняя в цепочке, совсем молодая, чуть отстала, у неё сбита нога. На шее у неё верёвочка с деревянной биркой.',
    opts: [
      { t: 'Прочитать бирку и назвать по имени', tag: 'воля', check: { attr: 'wil', dc: 20 }, res: { text: '«Ульяна!» Она останавливается и открывает глаза. Смотрит на свои ноги, начинает плакать от боли. Прекрасный звук. Ты показываешь ей дорогу к Порогу.', do: { count: { pilgrims: 1 }, xp: 500 } }, fail: { text: 'Буквы на бирке стёрты. Ты называешь наугад. Вся цепочка поворачивает к тебе лица: это было чьё-то другое имя.', do: { fight: true } } },
      { t: 'Просто увести за руку', tag: 'сила', check: { attr: 'str', dc: 20 }, res: { text: 'Она не сопротивляется, только всё шепчет. Её хватит до стены. Лавр её накормит, и там посмотрим.', do: { count: { pilgrims: 1 }, hurt: 6, xp: 300 } }, fail: { text: 'Слабая девочка держится за дорогу так, что её не оторвать. Цепочка оборачивается.', do: { fight: true, hurt: 8 } } },
      { t: 'Пропустить их', res: { text: 'Шепот удаляется в сторону Аш-Тара. Там всё равно ждут.', do: { omen: 1 } } },
    ] },
  { id: 'salt_wagon', art: 'cart', title: 'Обоз без хозяина', weight: 10, zones: ['dead_road'],
    text: 'Телега стоит на дороге, возница на козлах, вожжи натянуты. У него нет лица, но он явно спит. Из-под рогожи торчат мешки с печатями соляного двора.',
    opts: [
      { t: 'Тихо стянуть мешок', tag: 'ловкость', check: { attr: 'agi', dc: 20 }, res: { text: 'Мешок тяжёлый и чистый. Лавр будет тебя обнимать, и это страшно. Возница даже не шелохнулся.', do: { count: { salt: 1 }, xp: 300 } }, fail: { text: 'Мешок рвётся, соль шипит на пепле. Возница поворачивает то, что у него теперь вместо лица.', do: { count: { salt: 1 }, fight: true } } },
      { t: 'Заплатить вознице', if: { gold: 200 }, res: { text: 'Ты кладёшь монеты рядом. Он спит дальше, но рука нащупывает их и сжимает. Бери, мол. И ещё: оставляет тебе запасной кнут.', do: { gold: -200, count: { salt: 1 }, item: 'rare' } } },
      { t: 'Обойти', res: { text: 'Телега делает полшага вперёд. Или это тебе показалось. Ты ускоряешь шаг.', do: { xp: 150 } } },
    ] },
  { id: 'milestone', art: 'stone', title: 'Верстовой столб', weight: 7, zones: ['dead_road'],
    text: 'На столбе выбито: «АШ-ТАР — 40». Ниже кто-то мелом: «40». Ещё ниже другим почерком: «40». Вниз идёт целый столбец: сорок, сорок, сорок, сорок. Последняя запись совсем свежая, и мел лежит рядом.',
    opts: [
      { t: 'Дописать: «39»', tag: 'воля', check: { attr: 'wil', dc: 19 }, res: { text: 'Рука дрожит, мел скрипит. Тебе удаётся. Дорога за спиной как будто вздохнула, и сразу становится видно, что до следующего столба рукой подать.', do: { hmar: -5, xp: 400 } }, fail: { text: 'Из-под руки выходит «40». Ты не хотел. Попробовал снова: «40».', do: { hmar: 2, hurt: 8 } } },
      { t: 'Дописать «40» со всеми', res: { text: 'Ты дописываешь. Ничего не случилось. В этом-то всё и дело, но так и правда легче идти дальше.', do: { blessing: 1, omen: 1 } } },
    ] },

  /* Врата */
  { id: 'gate_faces', art: 'door', title: 'Лики на створке', weight: 8, zones: ['bronze_gate'],
    text: 'Вся створка усеяна бронзовыми лицами, сотни на сотни. Они смотрят в разные стороны. Когда ты подходишь, все поворачиваются, и самое маленькое, детское, тихо спрашивает: «Уже можно выходить?»',
    opts: [
      { t: '«Можно»', tag: 'милосердие', res: { text: 'Детское лицо закрывает глаза. Бронза становится просто бронзой и падает к твоим ногам. Остальные смотрят. Ни один не просит, но каждый ждёт.', do: { name: 2, xp: 500, hmar: 2 } } },
      { t: '«Нет, ещё нет»', res: { text: 'Лицо кивает: так и думало. Лица отворачиваются, и ты проходишь мимо, как в толпе, где тебя никто не заметил.', do: { hmar: -3, xp: 200 } } },
      { t: 'Выломать лицо побольше', tag: 'сила', check: { attr: 'str', dc: 21 }, res: { text: 'Бронза отдаётся со стоном. Отличный металл, и лицо у него благородное. Спиной чувствуешь, как на тебя смотрят остальные.', do: { dust: 45, item: 'rare', omen: 1 } }, fail: { text: 'Оно кусается.', do: { hurt: 22, fight: true } } },
    ] },
  { id: 'guard_post', art: 'camp', title: 'Кордегардия', weight: 7, zones: ['bronze_gate'],
    text: 'Маленькая караульная у стены. На столе карты, сданные на четверых, ещё не сыгранная партия. Четвёртый стул отодвинут, будто ждут тебя. Трое других сидят и не шевелятся. На кону хорошая кучка монет.',
    opts: [
      { t: 'Сесть и сыграть', tag: 'воля', check: { attr: 'wil', dc: 20 }, res: { text: 'Ты выигрываешь, потому что умеешь уходить вовремя. Банк твой. Один из игроков пододвигает ещё и своё кольцо: всё равно ему теперь ни к чему.', do: { gold: 700, item: 'rare', itemSlot: 'ring' } }, fail: { text: 'Ты проигрываешь то, что и не думал ставить. У тебя как будто забрали пару часов жизни и кусочек памяти о матери.', do: { hurt: 14, omen: 1 } } },
      { t: 'Сгрести банк и бежать', tag: 'опасно', res: { text: 'Ты успеваешь до двери. Они не успевают ничего. Но когда ты оборачиваешься, стульев уже три, и они идут за тобой.', do: { gold: 900, fight: true } } },
      { t: 'Закрыть за собой дверь', res: { text: 'Не твоя партия. За дверью кто-то вздыхает и сдаёт снова.', do: { xp: 150 } } },
    ] },

  /* Аш-Тар */
  { id: 'stair', art: 'mist', title: 'Лестница, которая спрашивает', weight: 9, zones: ['ash_tar'],
    text: 'На каждой ступени выбито чьё-то имя. Наступая на него, ты слышишь: «Кто?». И отвечать приходится, потому что нога иначе не поднимается. Вверх ещё тысячи ступеней.',
    opts: [
      { t: 'Отвечать своим именем каждый раз', tag: 'воля', check: { attr: 'wil', dc: 22 }, res: { text: 'Ты отвечаешь. Сто раз, двести, пока собственное имя не становится просто звуком, а потом снова именем, только теперь ты уверен. Лестница сдаётся.', do: { hmar: -5, xp: 800, blessing: 1 } }, fail: { text: 'На сто сорок третьей ступени ты отвечаешь не своим именем. Ты сам это заметил. Больше никто. Пока.', do: { hurt: 15, omen: 1, hmar: 2 } } },
      { t: 'Читать имена со ступеней', res: { text: 'Ты отвечаешь тем, что написано под ногой. Пепел не возражает: имя есть имя. Несколько из них пристают к тебе так, что не отлепить. Придётся нести.', do: { name: 3, hmar: 3 } } },
    ] },
  { id: 'bell_room', art: 'lamp', title: 'Сорок восьмая башня', weight: 8, zones: ['ash_tar'],
    text: 'Колокольня. Сто лет назад отлитый в Медном Сколе колокол висит без языка. На полу аккуратно сложено облачение третьего голоса. Отец Иов всё ещё платит за то, что вышел отсюда живым. Всё это кажется удивительно маленьким.',
    opts: [
      { t: 'Ударить в колокол кулаком', tag: 'стойкость', check: { attr: 'vit', dc: 22 }, res: { text: 'Звука нет. Но все башни разом вздрагивают, и в окне тебе на секунду видно небо: настоящее, синее, совершенно обычное. Рука будет болеть неделю.', do: { hmar: -6, xp: 800, hurt: 10 } }, fail: { text: 'Кость выдерживает, но не вся.', do: { hurt: 25 } } },
      { t: 'Забрать облачение Иову', res: { text: 'Лёгкое и пахнет старым ладаном. Там, в складках, забытая запись его рукой: чьё-то имя. А ещё совсем маленький ключик.', do: { name: 1, flag: 'iov_robe', item: 'epic', itemSlot: 'chest' } } },
    ] },
  { id: 'old_mirror', art: 'door', title: 'Ты в ту ночь', weight: 7, zones: ['ash_tar'],
    text: 'В пепле на полу отпечатался человек. Силуэт. Он точно по твоему росту. Рядом на стене углём: «Ты уже приходил. Не помогло». И почерк твой.',
    opts: [
      { t: 'Лечь в отпечаток', tag: 'риск', res: { text: 'На мгновение ты вспоминаешь всю свою смерть в подробностях, все разы. Затем встаёшь. Жить от этого не легче, зато драться точно легче.', do: { hurt: 20, blessing: 2, xp: 600 } } },
      { t: 'Дописать: «Попробую ещё»', res: { text: 'Уголь рассыпается в пальцах. Рядом, совсем свежие, уже стоят такие же слова. Три раза. Твой почерк.', do: { xp: 400, blessing: 1 } } },
      { t: 'Затоптать', tag: 'сила', res: { text: 'Пепел взлетает и оседает обратно ровно по той же форме. Тебе не обязательно это понимать.', do: { hmar: 1, gold: 500 } } },
    ] }
);

/* --- кодекс --- */
Object.assign(LORE, {
  copper: { cat: 'Место', title: 'Медный Скол', text: 'Шахтёрский посёлок, откуда сто лет везли медь для колоколов Аш-Тара. Когда пришла Хмарь, бригадиры нашли свой способ: сдавать имя на входе и получать жетон с номером. Пепел спрашивает «Кто ты?», а номер триста сорок отвечает: «Триста сорок». И пепел отстаёт. Правда, вместе с ним постепенно отстаёт и всё остальное.' },
  driller: { cat: 'Тварь', title: 'Дед-Проходчик', text: 'Первый, кто сдал имя, и единственный, кто ни разу не поднялся на поверхность. Руки заменил на бур, спину на крепь, когда пришло время. Гордей говорит, что Дед научил его всему. Гордей говорит это очень ровным голосом.' },
  furnace: { cat: 'Тварь', title: 'Мать-Печь', text: 'Плавильню заложили раньше самого Аш-Тара. В ней отливали колокола, а для хорошего звона в медь кидали кольца, письма, чьи-то волосы. Всё, что было кому-то дорого. Сто лет так. Никто не удивился, что у неё появилось лицо.' },
  heart: { cat: 'Тварь', title: 'Сердце Жилы', text: 'Вся медь на Пределе вышла из одного самородка. Из той же меди были колокола, и когда жрецы задали свой вопрос, колокола его подхватили. Сердце не злое и не живое. Оно просто всё ещё звучит, и всё вокруг к нему подстраивается.' },
  threshold: { cat: 'Место', title: 'Форпост Порог', text: 'Застава на последних сорока верстах до Аш-Тара. Двенадцать лет держит дорогу, никем не сменяемая. Воевода Любава запретила писать донесения: «Кому?». Единственное здание с крышей — кухня. Единственный закон: ужин по расписанию.' },
  caravan: { cat: 'Тварь', title: 'Старшина Каравана', text: 'Вывел шестьсот человек из горящего города. Только не успел понять, что город горел не снаружи. Они идут к Порогу уже двенадцать лет, один шаг в год, и в его списке напротив каждого написано: «Дойдёт».' },
  warden_gate: { cat: 'Тварь', title: 'Последний Привратник', text: 'В ту ночь последним приказом Круга было: никого не выпускать. Через час отменили, но гонец не дошёл. Он закрыл ворота и, чтобы никто не смог его заставить, проглотил ключ. Потом он много раз заглядывал внутрь. Он знает, что там. Он всё равно на посту.' },
  question: { cat: 'Правда', title: 'Тот, Кто Спросил', text: 'Каждый вечер сотни лет жрецы Хора спрашивали ветер: «Кто здесь?». Формальность. Однажды ветер спросил в ответ. Он не хотел зла. Он впервые заметил, что есть кто-то, кому можно задать вопрос, и задал единственный, который его волновал. Никто не смог ответить за него. Хмарь идёт по миру не чтобы стереть имена. Она примеряет их.' },
  ending: { cat: 'Правда', title: 'Что было потом', text: 'Об этом рассказывают по-разному. Точно известно только, что на башне кто-то ответил.' },
  name13: { cat: 'Имена', title: 'Аким', text: 'Аким, № 162. Любил редьку и не умел шептать. Жена до сих пор получает от него письма, написанные очень хорошим почерком.' },
  name14: { cat: 'Имена', title: 'Федька', text: 'Фёдор, № 17, левша. Украл у сестры сапоги и всю жизнь утверждал, что они на два размера больше.' },
  name15: { cat: 'Имена', title: 'Ульяна', text: 'Ульяна, паломница. Шла спросить у Хмари, куда делся её муж. Сейчас чистит картошку на Пороге и всё ещё ждёт ответа, но уже не так срочно.' },
  name16: { cat: 'Имена', title: 'Третий голос', text: 'Иов никогда не назовёт своё мирское имя. Говорит, его забрали на входе в сорок восьмую башню, и правильно сделали. Потом, понизив голос: «Ваня меня звали».' },
  name17: { cat: 'Имена', title: 'Пётр-возница', text: 'Пётр, четвёртая телега, вёз соль. Обещал вернуться к празднику и один раз даже почти успел.' },
  name18: { cat: 'Имена', title: 'Ещё кто-то', text: 'Запись стёрта почти полностью. Осталось «…и она так смеялась, что…». Тихон перечитывает это чаще других.' },
});
LORE_ORDER.splice(LORE_ORDER.indexOf('name1'), 0, 'copper', 'driller', 'furnace', 'heart', 'threshold', 'caravan', 'warden_gate', 'question', 'ending');
LORE_ORDER.push('name13', 'name14', 'name15', 'name16', 'name17', 'name18');

/* --- финал --- */
const ENDINGS = {
  own: {
    t: 'Назвать своё имя', tag: 'имя',
    title: 'Имя', text: name => `«${name}», — говоришь ты. Просто говоришь. Пепел замирает, и в нём по очереди закрываются лица. «Это хорошее имя, — отвечает он твоим голосом. — Можно я его возьму?» Ты понимаешь, что он спрашивает всерьёз и в первый раз за всю свою жизнь. Ты киваешь. Хмарь уходит с Предела к концу года: она теперь кто-то и ей есть куда идти. Тебя помнят как того, кто поднялся на башню. Как тебя звали, никто сказать не может. Ты сам тоже.`,
  },
  all: {
    t: 'Прочитать все имена, что ты собрал', tag: 'имена', if: s => s.namesRead >= 9,
    title: 'Перекличка', text: () => 'Ты начинаешь с Петра, плотника, и его собаки Жука. Потом Варвара. Потом Ефим и Тая. Голос садится на двадцатом. На сороковом он спрашивает: «Это всё они?» Ты не останавливаешься. Он слушает, становясь всё меньше и всё тише, и где-то на Дуне, у которой самый красивый камень подписан «Этот», начинает повторять за тобой. Пепел выпадает над всем Пределом за одну ночь. Он тёплый. Утром люди встают и зовут друг друга: сначала неуверенно, потом громко.',
  },
  silence: {
    t: 'Приложить палец к губам и не ответить', tag: 'тишина',
    title: 'Тишина', text: () => 'Ты молчишь. Он спрашивает ещё раз. Ты молчишь. Он спрашивает у всего Предела разом, и весь Предел, как один человек, молчит вместе с тобой. Агния научила их, сама того не желая. На этот раз вопрос гаснет от того, что его никто не поддержал. Хмарь останавливается ровно там, где была в ту минуту, и висит на месте, как большая серая мысль, которую не додумали. С тех пор так и висит. Никто туда не ходит. Все привыкли говорить потише.',
  },
  ask: {
    t: 'Спросить в ответ: «А ты кто?»', tag: 'вопрос', if: s => s.flags.iov_truth,
    title: 'Вопрос', text: () => 'За всю историю этого никто не делал. Он замирает. Ты слышишь, как обрывается ветер во всех ста башнях. «Я…» Долгая пауза. «Мне никто никогда…» Пепел опадает с него, и там, где он стоял, остаётся кто-то совсем маленький и очень испуганный. Ветер. Просто ветер, которому было одиноко. Ты садишься рядом на ступеньку, и вы долго разговариваете. Хмарь редеет с той ночи понемногу, лет двадцать ещё будет редеть. На Пределе теперь говорят, что если ветер спрашивает, как у тебя дела, надо отвечать честно. Ему интересно.',
  },
};

/* Что стало с теми, кого ты встретил. Каждая строка показывает последствия твоих решений */
function epilogueLines() {
  const f = Game.state.flags;
  const out = [];
  out.push('Мира Вельд каждую ночь всё ещё поднимается проверить маяк. Говорит, что по привычке. Иногда её видят наверху с письмом, в котором одна строчка: «Слышно ласточек».');
  out.push('Тихон всё-таки выспался. Масло теперь кончается медленнее, потому что ночи снова стали короткими.');
  if (f.door_kept) out.push('В таверне «Не успели» на полке лежит старый гребень. Марфа расчёсывает им рыжие волосы племянницы, которая приехала её навестить. По вечерам там теперь поют.');
  else if (f.door_left) out.push('Марфа всё так же вытирает кружку. Она знает, что дом с красной дверью ещё стоит, и больше не ждёт вестей оттуда. Это тоже покой.');
  if (f.harn_discount) out.push('Харн куёт из стали с башен плуги. Получается плохо. Он очень этим доволен.');
  if (f.son_returned) out.push('Тимошка, сын менялы, говорит теперь хриплым басом и всех обсчитывает. Дар плачет от счастья при каждой недостаче.');
  else if (f.son_lost) out.push('Сын менялы всё так же строит столбики. Столбики у него ровные. Дар иногда подолгу сидит рядом и молчит вместе с ним.');
  if (f.region2_done) out.push('Агния заново учит Ключи говорить. Яна раздаёт банки хозяевам. Первое, что сказала ей одна старушка своим вернувшимся голосом, нельзя записать на дощечке.');
  if (f.fedka_named) out.push('На полке у Зои стоят сапоги. На два размера больше. Никому не отдаёт.');
  if (f.region3_done) out.push('В Медном Сколе смены теперь выходят по именам. Гордей, то есть Дмитрий, ведёт табель в три раза дольше и всё время ошибается в собственной фамилии.');
  if (f.iov_robe) out.push('Отец Иов надел своё облачение ещё раз, а потом сложил его и отдал Лавру на тряпки. Сказал, что наконец-то хоть кому-то пригодится.');
  out.push('Любава спустилась со стены. Лавр уверяет, что она учится варить. Бойцы просят его это прекратить.');
  out.push('А по Тракту, говорят, теперь можно ходить. Верстовой столб показывает «39». Потом кто-то исправил на «38».');
  return out;
}
