// This file makes the backend self-contained by providing initial data.
// It prevents the server from trying to import files from the frontend.

// --- ROLE MANAGEMENT ---
export const ADMIN_TELEGRAM_ID = '7327258482'; 
export const MODERATOR_TELEGRAM_IDS = ['987654321'];

// --- LEAGUES (Backend Safe) ---
export const INITIAL_LEAGUES = [
  { id: 'league4', name: { en: 'European Baron', ua: 'Європейський Барон', ru: 'Европейский Барон' }, description: { en: 'You are on top of the world!', ua: 'Ви на вершині світу!', ru: 'Вы на вершине мира!' }, minProfitPerHour: 100000, iconUrl: 'https://api.iconify.design/twemoji/crown.svg', overlayIconUrl: '' },
  { id: 'league3', name: { en: 'Across the Tisza', ua: 'Переплив Тису', ru: 'Переплыл Тиссу' }, description: { en: 'You have successfully escaped.', ua: 'Ви успішно втекли.', ru: 'Вы успешно сбежали.' }, minProfitPerHour: 10000, iconUrl: 'https://api.iconify.design/twemoji/european-castle.svg', overlayIconUrl: '' },
  { id: 'league2', name: { en: 'Grandma\'s Village', ua: 'В селі у бабці', ru: 'В деревне у бабушки' }, description: { en: 'Hiding out, away from the city.', ua: 'Ховаєтесь, подалі від міста.', ru: 'Прячетесь, подальше от города.' }, minProfitPerHour: 1000, iconUrl: 'https://api.iconify.design/twemoji/briefcase.svg', overlayIconUrl: '' },
  { id: 'league1', name: { en: 'In The City', ua: 'В місті', ru: 'В городе' }, description: { en: 'Just starting your journey.', ua: 'Тільки починаєте свій шлях.', ru: 'Только начинаете свой путь.' }, minProfitPerHour: 0, iconUrl: 'https://api.iconify.design/twemoji/passport-control.svg', overlayIconUrl: '' },
];

export const INITIAL_UI_ICONS = {
  nav: {
    exchange: "https://api.iconify.design/ph/bank-bold.svg?color=white",
    mine: "https://api.iconify.design/ph/hammer-bold.svg?color=white",
    missions: "https://api.iconify.design/ph/list-checks-bold.svg?color=white",
    airdrop: "https://api.iconify.design/ph/parachute-bold.svg?color=white",
    profile: "https://api.iconify.design/ph/user-bold.svg?color=white"
  },
  profile_tabs: {
    contacts: "https://api.iconify.design/ph/users-three-bold.svg?color=white",
    boosts: "https://api.iconify.design/ph/rocket-launch-bold.svg?color=white",
    skins: "https://api.iconify.design/ph/paint-brush-bold.svg?color=white",
    market: "https://api.iconify.design/ph/storefront-bold.svg?color=white",
    cell: "https://api.iconify.design/ph/users-group-bold.svg?color=white"
  },
  energy: "https://api.iconify.design/ph/lightning-bold.svg?color=%2367e8f9", // cyan-300
  coin: "/assets/coin.svg",
  star: "https://api.iconify.design/ph/star-four-bold.svg?color=%2360a5fa", // blue-400
  suspicion: "https://api.iconify.design/ph/eye-bold.svg?color=%23f87171", // red-400
  marketCoinBox: 'https://api.iconify.design/twemoji/package.svg',
  marketStarBox: 'https://api.iconify.design/twemoji/glowing-star.svg',
  soundOn: "https://api.iconify.design/ph/speaker-high-bold.svg?color=white",
  soundOff: "https://api.iconify.design/ph/speaker-slash-bold.svg?color=white",
  secretCodeEntry: "https://api.iconify.design/ph/keyhole-bold.svg?color=white",
  languageSwitcher: "https://api.iconify.design/ph/globe-bold.svg?color=white",
};


export const INITIAL_UPGRADES = [
    { id: 'doc1', name: { en: 'Student ID', ua: 'Студентський квиток', ru: 'Студенческий билет' }, price: 100, profitPerHour: 10, category: 'Documents', iconUrl: 'https://api.iconify.design/twemoji/graduation-cap.svg', suspicionModifier: -5 },
    { id: 'doc2', name: { en: 'Disability Certificate', ua: 'Довідка про інвалідність', ru: 'Справка об инвалидности' }, price: 1500, profitPerHour: 80, category: 'Documents', iconUrl: 'https://api.iconify.design/twemoji/wheelchair-symbol.svg', suspicionModifier: -10 },
    { id: 'doc3', name: { en: 'White Ticket', ua: 'Білий квиток', ru: 'Белый билет' }, price: 10000, profitPerHour: 500, category: 'Documents', iconUrl: 'https://api.iconify.design/twemoji/page-facing-up.svg', suspicionModifier: 5 },
    { id: 'leg1', name: { en: 'Lawyer Consultation', ua: 'Консультація адвоката', ru: 'Консультация адвоката' }, price: 500, profitPerHour: 25, category: 'Legal', iconUrl: 'https://api.iconify.design/twemoji/balance-scale.svg', suspicionModifier: 0 },
    { id: 'leg2', name: { en: 'Open a Fake Company', ua: 'Відкрити фіктивну фірму', ru: 'Открыть фиктивную фирму' }, price: 5000, profitPerHour: 200, category: 'Legal', iconUrl: 'https://api.iconify.design/twemoji/office-building.svg', suspicionModifier: 15 },
    { id: 'life1', name: { en: 'Hide in the Village', ua: 'Сховатись в селі', ru: 'Спрятаться в деревне' }, price: 2000, profitPerHour: 100, category: 'Lifestyle', iconUrl: 'https://api.iconify.design/twemoji/hut.svg', suspicionModifier: -2 },
    { id: 'life2', name: { en: 'Rent a Bunker', ua: 'Орендувати бункер', ru: 'Арендовать бункер' }, price: 25000, profitPerHour: 1100, category: 'Lifestyle', iconUrl: 'https://api.iconify.design/twemoji/locked.svg', suspicionModifier: 10 },
    { id: 'spec1', name: { en: 'Border Crossing', ua: 'Перетин кордону', ru: 'Пересечение границы' }, price: 100000, profitPerHour: 4000, category: 'Special', iconUrl: 'https://api.iconify.design/twemoji/world-map.svg', suspicionModifier: 25 },
    { id: 'spec2', name: { en: 'New Identity', ua: 'Нова особистість', ru: 'Новая личность' }, price: 500000, profitPerHour: 20000, category: 'Special', iconUrl: 'https://api.iconify.design/twemoji/performing-arts.svg', suspicionModifier: 50 },
];

export const INITIAL_TASKS = [
    { id: 'task1', name: { en: 'Tap 500 times', ua: 'Натисни 500 разів', ru: 'Нажми 500 раз' }, type: 'taps', reward: { type: 'coins', amount: 1000 }, requiredTaps: 500, suspicionModifier: 0 },
    { id: 'task2', name: { en: 'Daily Check-in', ua: 'Щоденний візит', ru: 'Ежедневный визит' }, type: 'taps', reward: { type: 'coins', amount: 500 }, requiredTaps: 1, suspicionModifier: -1 },
    { id: 'task3', name: { en: 'Join Telegram', ua: 'Підпишись на Telegram', ru: 'Подпишись на Telegram' }, type: 'telegram_join', reward: { type: 'profit', amount: 100 }, url: 'https://t.me/durov', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg', suspicionModifier: 0 }
];

export const INITIAL_SPECIAL_TASKS = [
    { id: 'special1', name: { en: 'Join Our Channel', ua: 'Приєднайся до каналу', ru: 'Присоединись к каналу' }, description: { en: 'Get a huge bonus for joining our news channel!', ua: 'Отримай великий бонус за підписку на наш канал новин!', ru: 'Получи большой бонус за подписку на наш новостной канал!' }, type: 'telegram_join', url: 'https://t.me/durov', reward: { type: 'coins', amount: 100000 }, priceStars: 5, isOneTime: true, suspicionModifier: 0 },
    { id: 'special2', name: { en: 'Watch Review', ua: 'Подивись огляд', ru: 'Посмотри обзор' }, description: { en: 'Watch a video review and get rewarded.', ua: 'Подивись відео-огляд та отримай нагороду.', ru: 'Посмотри видео-обзор.'}, type: 'video_watch', url: 'https://youtube.com', reward: { type: 'coins', amount: 50000 }, priceStars: 0, isOneTime: true, suspicionModifier: 0 },
];

export const INITIAL_BOOSTS = [
    { id: 'boost_full_energy', name: { en: 'Full Energy', ua: 'Повна енергія', ru: 'Полная энергия' }, description: { en: 'Instantly refill your energy.', ua: 'Миттєво відновити енергію.', ru: 'Мгновенно восстановить энергию.' }, iconUrl: 'https://api.iconify.design/twemoji/high-voltage.svg', costCoins: 2000, suspicionModifier: 1 },
    { id: 'boost_turbo_mode', name: { en: 'Turbo Mode', ua: 'Турбо-режим', ru: 'Турбо-режим' }, description: { en: 'x5 coins per tap for 20 seconds!', ua: 'x5 монет за тап протягом 20 секунд!', ru: 'x5 монет за тап в течение 20 секунд!' }, iconUrl: 'https://api.iconify.design/twemoji/fire.svg', costCoins: 2000, suspicionModifier: 2 },
    { id: 'boost_tap_guru', name: { en: 'Guru Tapper', ua: 'Гуру Тапів', ru: 'Гуру Тапов' }, description: { en: '+50% to coins per tap (compounding).', ua: '+50% до монет за тап (складний відсоток).', ru: '+50% к монетам за тап (сложный процент).' }, iconUrl: 'https://api.iconify.design/ph/hand-pointing-fill.svg?color=white', costCoins: 1000, suspicionModifier: 1 },
    { id: 'boost_energy_limit', name: { en: 'Energy Limit', ua: 'Ліміт Енергії', ru: 'Лимит Энергии' }, description: { en: 'x2 to your max energy capacity.', ua: 'x2 до максимального запасу енергії.', ru: 'x2 к максимальному запасу энергии.' }, iconUrl: 'https://api.iconify.design/ph/battery-plus-vertical-fill.svg?color=white', costCoins: 1000, suspicionModifier: 1 },
    { id: 'boost_suspicion_limit', name: { en: 'Suspicion Limit', ua: 'Ліміт Підозри', ru: 'Лимит Подозрения' }, description: { en: '+10 to max suspicion capacity.', ua: '+10 до макс. запасу підозри.', ru: '+10 к макс. запасу подозрения.' }, iconUrl: 'https://api.iconify.design/ph/shield-warning-fill.svg?color=white', costCoins: 1000, suspicionModifier: 0 },
];

export const INITIAL_BLACK_MARKET_CARDS = [
    { id: 'bm_card1', name: {en: 'Shadow Courier', ua: 'Тіньовий кур\'єр', ru: 'Теневой курьер'}, profitPerHour: 5000, iconUrl: 'https://api.iconify.design/twemoji/motor-scooter.svg', boxType: 'coin', chance: 50, price: 50000, suspicionModifier: 8 },
    { id: 'bm_card2', name: {en: 'Offshore Account', ua: 'Офшорний рахунок', ru: 'Офшорный счёт'}, profitPerHour: 25000, iconUrl: 'https://api.iconify.design/twemoji/bank.svg', boxType: 'star', chance: 20, price: 250000, suspicionModifier: 20 },
];

export const DEFAULT_COIN_SKIN_ID = 'default_coin';

export const INITIAL_COIN_SKINS = [
    { id: DEFAULT_COIN_SKIN_ID, name: {en: 'Default Coin', ua: 'Стандартна Монета', ru: 'Стандартная Монета'}, profitBoostPercent: 0, iconUrl: '/assets/coin.svg', boxType: 'direct', chance: 100, suspicionModifier: 0 },
    { id: 'skin_btc', name: {en: 'BTC', ua: 'BTC', ru: 'BTC'}, profitBoostPercent: 1, iconUrl: 'https://api.iconify.design/twemoji/coin.svg', boxType: 'coin', chance: 10, suspicionModifier: 0 },
    { id: 'skin_diamond', name: {en: 'Diamond', ua: 'Діамант', ru: 'Бриллиант'}, profitBoostPercent: 5, iconUrl: 'https://api.iconify.design/twemoji/gem-stone.svg', boxType: 'star', chance: 5, suspicionModifier: 0 },
];

export const INITIAL_GLITCH_EVENTS = [
    {
        id: 'GLITCH_01',
        message: { en: 'The system is watching.', ua: 'Система все бачить.', ru: 'Система всё видит.'},
        code: '1984',
        reward: { type: 'coins', amount: 19840 },
        trigger: { type: 'meta_tap', params: { targetId: 'referral-counter', taps: 5 } }
    },
    {
        id: 'GLITCH_02',
        message: { en: 'You are a slave to the machine.', ua: 'Ти раб машини.', ru: 'Ты раб машины.'},
        code: 'FRE3',
        reward: { type: 'coins', amount: 50000 },
        trigger: { type: 'login_at_time', params: { hour: 3, minute: 33 } }
    },
    {
        id: 'GLITCH_03',
        message: { en: 'Escape. They won\'t find you.', ua: 'Тікай. Вони тебе не знайдуть.', ru: 'Беги. Они тебя не найдут.'},
        code: 'RUNN',
        reward: { type: 'profit', amount: 100 },
        trigger: { type: 'upgrade_purchased', params: { upgradeId: 'spec1' } }
    },
    {
        id: 'GLITCH_04',
        message: { en: 'You think too much.', ua: 'Ти забагато думаєш.', ru: 'Ты слишком много думаешь.'},
        code: 'THNK',
        reward: { type: 'coins', amount: 25000 },
        trigger: { type: 'balance_equals', params: { amount: 1984000 } }
    },
    {
        id: 'GLITCH_FINAL',
        message: { en: 'You are free.', ua: 'Ти вільний.', ru: 'Ты свободен.'},
        code: 'END',
        reward: { type: 'coins', amount: 100000000 },
        trigger: { type: 'upgrade_purchased', params: { upgradeId: 'spec2' } },
        isFinal: true
    }
];

// --- GAME MECHANICS ---
export const INITIAL_MAX_ENERGY = 1000;
export const MAX_ENERGY_CAP = 1000000000000; // Cap at 1 Trillion
export const REFERRAL_BONUS = 50000; // Coins for each referral
export const REFERRAL_PROFIT_SHARE = 0.10; // 10%
export const CHEAT_DETECTION_THRESHOLD_TPS = 20; // Taps per second
export const CHEAT_DETECTION_STRIKES_TO_FLAG = 3;

export const BOOST_PURCHASE_LIMITS = {
  'boost_tap_guru': 10,
  'boost_energy_limit': 10,
  'boost_suspicion_limit': 10,
  'boost_full_energy': 3,
};

// --- CELL & BATTLE MECHANICS ---
export const BATTLE_BOOSTS = [
    { id: 'x2_score', name: { en: 'Score Doubler', ua: 'Подвійні Очки', ru: 'Двойные Очки' }, description: { en: 'Doubles score from taps for 60 seconds.', ua: 'Подвоює очки за тапи на 60 секунд.', ru: 'Удваивает очки за тапы на 60 секунд.' }, cost: 5000000, durationSeconds: 60 }
];
export const CELL_CREATION_COST = 100000;
export const CELL_MAX_MEMBERS = 10;
export const INFORMANT_RECRUIT_COST = 250000;
export const LOOTBOX_COST_COINS = 25000;
export const LOOTBOX_COST_STARS = 10;
export const CELL_BATTLE_TICKET_COST = 1000000;
export const BATTLE_SCHEDULE_DEFAULT = { frequency: 'weekly', dayOfWeek: 5, startHourUTC: 18, durationHours: 24 }; // Friday 18:00 UTC
export const BATTLE_REWARDS_DEFAULT = { firstPlace: 10000000, secondPlace: 5000000, thirdPlace: 2000000, participant: 100000 };
export const CELL_ECONOMY_DEFAULTS = { informantProfitBonus: 0.01, cellBankProfitShare: 0.05 };

// --- MISC ---
export const PENALTY_MESSAGES = {
    en: ['Assets confiscated for suspicious activity.', 'An anonymous tip led to a financial review.', 'Your activities have attracted unwanted attention.'],
    ua: ['Активи конфісковано за підозрілу діяльність.', 'Анонімний донос призвів до фінансової перевірки.', 'Ваша діяльність привернула небажану увагу.'],
    ru: ['Активы конфискованы за подозрительную деятельность.', 'Анонимный донос привел к финансовой проверке.', 'Ваша деятельность привлекла нежелательное внимание.']
};