'use strict';

/* ============================================================
   РУНЫ. Старший ряд: 24 знака, которыми Круг Аш-Тара записывал имена.
   Падают редко. Вставляются не в вещь, а в Рунный круг героя и остаются при нём.
   Три одинаковые руны сливаются в одну следующей ступени (до III).
   Несколько нужных рун в круге дают созвучие: отдельный бонус.
   levels: по одной записи на ступень, формат как у талантов и вещей (stats / mods / on / flags).
   ============================================================ */

const RUNE_RARITY = {
  uncommon: { name: 'Частая', color: '#7fd6a0', weight: 58 },
  rare: { name: 'Редкая', color: '#6eb4ff', weight: 29 },
  epic: { name: 'Древняя', color: '#c08bff', weight: 11 },
  legendary: { name: 'Забытая', color: '#ffc05a', weight: 2 },
};

const RUNES = {
  fehu: { sign: 'ᚠ', name: 'Феху', gloss: 'Добыча', rarity: 'uncommon',
    levels: [{ stats: { goldFind: 12 } }, { stats: { goldFind: 24 } }, { stats: { goldFind: 40 } }],
    text: ['+12% золота', '+24% золота', '+40% золота'] },
  uruz: { sign: 'ᚢ', name: 'Уруз', gloss: 'Бык', rarity: 'uncommon',
    levels: [{ mods: { hpPct: 5 } }, { mods: { hpPct: 9 } }, { mods: { hpPct: 14 } }],
    text: ['+5% здоровья', '+9% здоровья', '+14% здоровья'] },
  thurs: { sign: 'ᚦ', name: 'Турс', gloss: 'Шип', rarity: 'uncommon',
    levels: [{ mods: { thorns: 10 } }, { mods: { thorns: 18 } }, { mods: { thorns: 30 } }],
    text: ['Бьющий тебя получает 10% урона', 'Бьющий тебя получает 18% урона', 'Бьющий тебя получает 30% урона'] },
  ansuz: { sign: 'ᚨ', name: 'Ансуз', gloss: 'Голос', rarity: 'uncommon',
    levels: [{ mods: { healPct: 10 } }, { mods: { healPct: 18 } }, { mods: { healPct: 30 } }],
    text: ['+10% к лечению', '+18% к лечению', '+30% к лечению'] },
  raido: { sign: 'ᚱ', name: 'Райдо', gloss: 'Путь', rarity: 'uncommon',
    levels: [{ mods: { speed: 5 } }, { mods: { speed: 9 } }, { mods: { speed: 14 } }],
    text: ['+5 инициативы', '+9 инициативы', '+14 инициативы'] },
  kenaz: { sign: 'ᚲ', name: 'Кеназ', gloss: 'Факел', rarity: 'uncommon',
    levels: [{ mods: { dotPct: 10 } }, { mods: { dotPct: 18 } }, { mods: { dotPct: 30 } }],
    text: ['+10% к урону эффектов', '+18% к урону эффектов', '+30% к урону эффектов'] },
  gebo: { sign: 'ᚷ', name: 'Гебо', gloss: 'Дар', rarity: 'uncommon',
    levels: [{ stats: { xpFind: 8 } }, { stats: { xpFind: 14 } }, { stats: { xpFind: 22 } }],
    text: ['+8% опыта', '+14% опыта', '+22% опыта'] },
  perth: { sign: 'ᛈ', name: 'Перт', gloss: 'Тайна', rarity: 'uncommon',
    levels: [{ mods: { dodge: 3 } }, { mods: { dodge: 6 } }, { mods: { dodge: 9 } }],
    text: ['+3% уклонения', '+6% уклонения', '+9% уклонения'] },

  hagal: { sign: 'ᚺ', name: 'Хагал', gloss: 'Град', rarity: 'rare',
    levels: [{ mods: { crit: 4 } }, { mods: { crit: 7 } }, { mods: { crit: 11 } }],
    text: ['+4% шанса крита', '+7% шанса крита', '+11% шанса крита'] },
  algiz: { sign: 'ᛉ', name: 'Альгиз', gloss: 'Заслон', rarity: 'rare',
    levels: [{ mods: { armorPct: 8 } }, { mods: { armorPct: 14 } }, { mods: { armorPct: 22 } }],
    text: ['+8% брони', '+14% брони', '+22% брони'] },
  sowilo: { sign: 'ᛊ', name: 'Совило', gloss: 'Солнце', rarity: 'rare',
    levels: [{ mods: { dmgPct: 4 } }, { mods: { dmgPct: 7 } }, { mods: { dmgPct: 11 } }],
    text: ['+4% урона', '+7% урона', '+11% урона'] },
  jera: { sign: 'ᛃ', name: 'Йера', gloss: 'Жатва', rarity: 'rare',
    levels: [{ mods: { lifesteal: 2 } }, { mods: { lifesteal: 4 } }, { mods: { lifesteal: 7 } }],
    text: ['+2% похищения жизни', '+4% похищения жизни', '+7% похищения жизни'] },
  wunjo: { sign: 'ᚹ', name: 'Вуньо', gloss: 'Радость', rarity: 'rare',
    levels: [{ on: { kill: [{ heal: 0.03 }] } }, { on: { kill: [{ heal: 0.05 }] } }, { on: { kill: [{ heal: 0.08 }] } }],
    text: ['Убийство лечит на 3%', 'Убийство лечит на 5%', 'Убийство лечит на 8%'] },
  isa: { sign: 'ᛁ', name: 'Иса', gloss: 'Лёд', rarity: 'rare',
    levels: [{ on: { start: [{ shield: 0.08 }] } }, { on: { start: [{ shield: 0.14 }] } }, { on: { start: [{ shield: 0.22 }] } }],
    text: ['В начале боя щит на 8% здоровья', 'В начале боя щит на 14% здоровья', 'В начале боя щит на 22% здоровья'] },
  inguz: { sign: 'ᛜ', name: 'Ингуз', gloss: 'Семя', rarity: 'rare',
    levels: [{ mods: { critDmg: 10 } }, { mods: { critDmg: 18 } }, { mods: { critDmg: 30 } }],
    text: ['+10% крит. урона', '+18% крит. урона', '+30% крит. урона'] },
  berkano: { sign: 'ᛒ', name: 'Беркана', gloss: 'Берёза', rarity: 'rare',
    levels: [{ on: { guard: [{ apply: 'regen', stacks: 2, to: 'self' }] } }, { on: { guard: [{ apply: 'regen', stacks: 3, to: 'self' }] } }, { on: { guard: [{ apply: 'regen', stacks: 5, to: 'self' }] } }],
    text: ['Защита даёт 2 регенерации', 'Защита даёт 3 регенерации', 'Защита даёт 5 регенераций'] },

  nauthiz: { sign: 'ᚾ', name: 'Наудиз', gloss: 'Нужда', rarity: 'epic',
    levels: [{ mods: { lowHpDmg: { below: 0.5, pct: 15 } } }, { mods: { lowHpDmg: { below: 0.5, pct: 25 } } }, { mods: { lowHpDmg: { below: 0.5, pct: 40 } } }],
    text: ['При здоровье ниже 50%: +15% урона', 'При здоровье ниже 50%: +25% урона', 'При здоровье ниже 50%: +40% урона'] },
  tiwaz: { sign: 'ᛏ', name: 'Тиваз', gloss: 'Воин', rarity: 'epic',
    levels: [{ mods: { vsElite: 8 } }, { mods: { vsElite: 14 } }, { mods: { vsElite: 22 } }],
    text: ['+8% урона по элите и боссам', '+14% урона по элите и боссам', '+22% урона по элите и боссам'] },
  ehwaz: { sign: 'ᛖ', name: 'Эваз', gloss: 'Конь', rarity: 'epic',
    levels: [{ on: { start: [{ apply: 'haste', turns: 1, to: 'self' }] } }, { on: { start: [{ apply: 'haste', turns: 2, to: 'self' }] } }, { on: { start: [{ apply: 'haste', turns: 4, to: 'self' }] } }],
    text: ['В начале боя спешка на 1 ход', 'В начале боя спешка на 2 хода', 'В начале боя спешка на 4 хода'] },
  laguz: { sign: 'ᛚ', name: 'Лагуз', gloss: 'Вода', rarity: 'epic',
    levels: [{ on: { start: [{ apply: 'deaf', turns: 2, to: 'self' }] } }, { on: { start: [{ apply: 'deaf', turns: 4, to: 'self' }] } }, { on: { start: [{ apply: 'deaf', turns: 8, to: 'self' }] } }],
    text: ['Первые 2 хода боя Немота не действует', 'Первые 4 хода боя Немота не действует', 'Первые 8 ходов боя Немота не действует'] },

  mannaz: { sign: 'ᛗ', name: 'Манназ', gloss: 'Человек', rarity: 'legendary',
    levels: [{ on: { start: [{ apply: 'might', turns: 1, to: 'self' }] } }, { on: { start: [{ apply: 'might', turns: 2, to: 'self' }] } }, { on: { start: [{ apply: 'might', turns: 4, to: 'self' }] } }],
    text: ['В начале боя мощь на 1 ход', 'В начале боя мощь на 2 хода', 'В начале боя мощь на 4 хода'] },
  eihwaz: { sign: 'ᛇ', name: 'Эйваз', gloss: 'Тис', rarity: 'legendary',
    levels: [{ flags: { cheatDeath: 0.1 } }, { flags: { cheatDeath: 0.2 } }, { flags: { cheatDeath: 0.3 } }],
    text: ['Раз за бой смертельный удар оставляет 1 здоровья и щит на 10%', 'Раз за бой смертельный удар оставляет 1 здоровья и щит на 20%', 'Раз за бой смертельный удар оставляет 1 здоровья и щит на 30%'] },
  dagaz: { sign: 'ᛞ', name: 'Дагаз', gloss: 'Рассвет', rarity: 'legendary',
    levels: [{ flags: { dawn: 4 } }, { flags: { dawn: 3 } }, { flags: { dawn: 2 } }],
    text: ['На вылазке каждый 4-й шаг не сгущает Хмарь', 'На вылазке каждый 3-й шаг не сгущает Хмарь', 'На вылазке каждый 2-й шаг не сгущает Хмарь'] },
  othala: { sign: 'ᛟ', name: 'Одал', gloss: 'Дом', rarity: 'legendary',
    levels: [{ flags: { home: 1 } }, { flags: { home: 1 }, stats: { goldFind: 10 } }, { flags: { home: 1 }, stats: { goldFind: 20 }, mods: { hpPct: 5 } }],
    text: ['С любой клетки можно уйти домой без потерь', 'Уход домой без потерь, +10% золота', 'Уход домой без потерь, +20% золота, +5% здоровья'] },
};
for (const id in RUNES) RUNES[id].id = id;
const RUNE_ORDER = Object.keys(RUNES);

/* Созвучия: работают, пока все знаки стоят в круге. Ступень значения не имеет */
const RUNE_WORDS = [
  { id: 'fire_ice', name: 'Огонь подо льдом', runes: ['kenaz', 'isa'], text: 'В начале боя все враги получают 3 огня.', on: { start: [{ apply: 'burn', stacks: 3, to: 'allEnemies' }] } },
  { id: 'blood_price', name: 'Цена крови', runes: ['thurs', 'jera'], text: 'Получив удар, лечишься на 1,5% здоровья.', on: { hurt: [{ heal: 0.015 }] } },
  { id: 'hail_need', name: 'Град в нужде', runes: ['hagal', 'nauthiz'], text: '+40% крит. урона.', mods: { critDmg: 40 } },
  { id: 'hunt', name: 'Большая охота', runes: ['tiwaz', 'ehwaz'], text: '+20% урона по элите и боссам, +8 инициативы.', mods: { vsElite: 20, speed: 8 } },
  { id: 'road_home', name: 'Дорога домой', runes: ['raido', 'othala'], text: '+10 инициативы, +10% уклонения.', mods: { speed: 10, dodge: 10 } },
  { id: 'gift_voice', name: 'Голос в дар', runes: ['ansuz', 'gebo'], text: '+15% к лечению и эффектам, +10% опыта.', mods: { healPct: 15, dotPct: 15 }, stats: { xpFind: 10 } },
  { id: 'spring', name: 'Весна', runes: ['berkano', 'wunjo'], text: 'Убийство даёт 3 регенерации.', on: { kill: [{ apply: 'regen', stacks: 3, to: 'self' }] } },
  { id: 'tide', name: 'Прилив', runes: ['laguz', 'perth'], text: 'Уклонившись, снимаешь с себя вредные эффекты.', on: { dodge: [{ cleanse: true }] } },
  { id: 'ancestors', name: 'Щит предков', runes: ['algiz', 'uruz', 'othala'], text: '+20% брони, в начале боя щит на 10% здоровья.', mods: { armorPct: 20 }, on: { start: [{ shield: 0.1 }] } },
  { id: 'dawn_after', name: 'Рассвет после ночи', runes: ['dagaz', 'nauthiz', 'sowilo'], text: '+15% урона. Хмарь на вылазке начинается на 2 шага позже.', mods: { dmgPct: 15 }, flags: { hmarFree: 2 } },
  { id: 'true_name', name: 'Настоящее имя', runes: ['mannaz', 'ansuz', 'sowilo'], text: '+10% урона и здоровья, +5% шанса крита.', mods: { dmgPct: 10, hpPct: 10, crit: 5 } },
  { id: 'great_yew', name: 'Старый тис', runes: ['eihwaz', 'inguz', 'fehu'], text: 'Раз за бой, когда сработает Тис, все враги сбиты с ног на 2 хода.', flags: { yewStagger: true } },
];

const RUNE_SOCKET_ZONES = ['barrow', 'bell_reach', 'singing_vein', 'bronze_gate'];

/* Шанс выпадения за бой, в процентах. Руны и должны быть редкостью */
const RUNE_CHANCE = { battle: 1.2, elite: 5, boss: 18, cache: 3, hmarStage: 0.3 };

/* Слияние трёх рун в одну следующей ступени */
const RUNE_MERGE_COST = [{ gold: 400, dust: 25 }, { gold: 2000, dust: 80 }];

/* Мастерство: куда уходят очки таланта, когда ветки уже выучены */
const MASTERY = {
  force: { name: 'Тяжёлая память', icon: 'fist', max: 5, per: { dmgPct: 2 }, text: '+2% урона за ступень' },
  body: { name: 'Живая плоть', icon: 'drop', max: 5, per: { hpPct: 2 }, text: '+2% здоровья за ступень' },
  skin: { name: 'Толстая кожа', icon: 'armor', max: 5, per: { armorPct: 3 }, text: '+3% брони за ступень' },
  eye: { name: 'Цепкий взгляд', icon: 'eye', max: 5, per: { crit: 1.5, critDmg: 3 }, text: '+1,5% шанса и +3% урона крита за ступень' },
  pace: { name: 'Лёгкий шаг', icon: 'wind', max: 5, per: { speed: 3 }, text: '+3 инициативы за ступень' },
};
