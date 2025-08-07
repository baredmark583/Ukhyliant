


// This file makes the backend self-contained by providing initial data.
// It prevents the server from trying to import files from the frontend.

// --- ROLE MANAGEMENT ---
export const ADMIN_TELEGRAM_ID = '7327258482'; 
export const MODERATOR_TELEGRAM_IDS = ['987654321'];

// --- LEAGUES (Backend Safe) ---
// This is used for calculating leagues on the server-side, e.g., for the leaderboard.
// It uses simple string icons instead of React components.
export const INITIAL_LEAGUES = [
  { id: 'league4', name: { en: 'European Baron', ua: 'Європейський Барон', ru: 'Европейский Барон' }, description: { en: 'You are on top of the world!', ua: 'Ви на вершині світу!', ru: 'Вы на вершине мира!' }, minProfitPerHour: 100000, iconUrl: 'https://api.iconify.design/twemoji/crown.svg' },
  { id: 'league3', name: { en: 'Across the Tisza', ua: 'Переплив Тису', ru: 'Переплыл Тиссу' }, description: { en: 'You have successfully escaped.', ua: 'Ви успішно втекли.', ru: 'Вы успешно сбежали.' }, minProfitPerHour: 10000, iconUrl: 'https://api.iconify.design/twemoji/european-castle.svg' },
  { id: 'league2', name: { en: 'Grandma\'s Village', ua: 'В селі у бабці', ru: 'В деревне у бабушки' }, description: { en: 'Hiding out, away from the city.', ua: 'Ховаєтесь, подалі від міста.', ru: 'Прячетесь, подальше от города.' }, minProfitPerHour: 1000, iconUrl: 'https://api.iconify.design/twemoji/briefcase.svg' },
  { id: 'league1', name: { en: 'In The City', ua: 'В місті', ru: 'В городе' }, description: { en: 'Just starting your journey.', ua: 'Тільки починаєте свій шлях.', ru: 'Только начинаете свой путь.' }, minProfitPerHour: 0, iconUrl: 'https://api.iconify.design/twemoji/passport-control.svg' },
];

export const INITIAL_UI_ICONS = {
  nav: {
    exchange: "https://api.iconify.design/ph/bank-bold.svg?color=white",
    mine: "https://api.iconify.design/ph/hammer-bold.svg?color=white",
    missions: "https://api.iconify.design/ph/list-checks-bold.svg?color=white",
    profile: "https://api.iconify.design/ph/user-bold.svg?color=white"
  },
  energy: "https://api.iconify.design/ph/lightning-bold.svg?color=%2367e8f9", // cyan-300
  coin: "/assets/coin.svg",
  star: "https://api.iconify.design/ph/star-four-bold.svg?color=%2360a5fa", // blue-400
  marketCoinBox: 'https://api.iconify.design/twemoji/package.svg',
  marketStarBox: 'https://api.iconify.design/twemoji/glowing-star.svg'
};


export const INITIAL_UPGRADES = [
    { id: 'doc1', name: { en: 'Student ID', ua: 'Студентський квиток', ru: 'Студенческий билет' }, price: 100, profitPerHour: 10, category: 'Documents', iconUrl: 'https://api.iconify.design/twemoji/graduation-cap.svg' },
    { id: 'doc2', name: { en: 'Disability Certificate', ua: 'Довідка про інвалідність', ru: 'Справка об инвалидности' }, price: 1500, profitPerHour: 80, category: 'Documents', iconUrl: 'https://api.iconify.design/twemoji/wheelchair-symbol.svg' },
    { id: 'doc3', name: { en: 'White Ticket', ua: 'Білий квиток', ru: 'Белый билет' }, price: 10000, profitPerHour: 500, category: 'Documents', iconUrl: 'https://api.iconify.design/twemoji/page-facing-up.svg' },
    { id: 'leg1', name: { en: 'Lawyer Consultation', ua: 'Консультація адвоката', ru: 'Консультация адвоката' }, price: 500, profitPerHour: 25, category: 'Legal', iconUrl: 'https://api.iconify.design/twemoji/balance-scale.svg' },
    { id: 'leg2', name: { en: 'Open a Fake Company', ua: 'Відкрити фіктивну фірму', ru: 'Открыть фиктивную фирму' }, price: 5000, profitPerHour: 200, category: 'Legal', iconUrl: 'https://api.iconify.design/twemoji/office-building.svg' },
    { id: 'life1', name: { en: 'Hide in the Village', ua: 'Сховатись в селі', ru: 'Спрятаться в деревне' }, price: 2000, profitPerHour: 100, category: 'Lifestyle', iconUrl: 'https://api.iconify.design/twemoji/hut.svg' },
    { id: 'life2', name: { en: 'Rent a Bunker', ua: 'Орендувати бункер', ru: 'Арендовать бункер' }, price: 25000, profitPerHour: 1100, category: 'Lifestyle', iconUrl: 'https://api.iconify.design/twemoji/locked.svg' },
    { id: 'spec1', name: { en: 'Border Crossing', ua: 'Перетин кордону', ru: 'Пересечение границы' }, price: 100000, profitPerHour: 4000, category: 'Special', iconUrl: 'https://api.iconify.design/twemoji/world-map.svg' },
    { id: 'spec2', name: { en: 'New Identity', ua: 'Нова особистість', ru: 'Новая личность' }, price: 500000, profitPerHour: 20000, category: 'Special', iconUrl: 'https://api.iconify.design/twemoji/performing-arts.svg' },
];

export const INITIAL_TASKS = [
    { id: 'task1', name: { en: 'Tap 500 times', ua: 'Натисни 500 разів', ru: 'Нажми 500 раз' }, type: 'taps', reward: { type: 'coins', amount: 1000 }, requiredTaps: 500, imageUrl: '', url: '', secretCode: '' },
    { id: 'task2', name: { en: 'Daily Check-in', ua: 'Щоденний візит', ru: 'Ежедневный визит' }, type: 'taps', reward: { type: 'coins', amount: 500 }, requiredTaps: 1, imageUrl: '', url: '', secretCode: '' },
    { id: 'task3', name: { en: 'Join Telegram', ua: 'Підпишись на Telegram', ru: 'Подпишись на Telegram' }, type: 'telegram_join', reward: { type: 'profit', amount: 100 }, url: 'https://t.me/durov', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg', requiredTaps: 0, secretCode: '' }
];

export const INITIAL_SPECIAL_TASKS = [
    { id: 'special1', name: { en: 'Join Our Channel', ua: 'Приєднайся до каналу', ru: 'Присоединись к каналу' }, description: { en: 'Get a huge bonus!', ua: 'Отримай великий бонус!', ru: 'Получи большой бонус!' }, type: 'telegram_join', url: 'https://t.me/durov', reward: { type: 'coins', amount: 100000 }, priceStars: 5, isOneTime: true, imageUrl: '', secretCode: '' },
    { id: 'special2', name: { en: 'Watch Review', ua: 'Подивись огляд', ru: 'Посмотри обзор' }, description: { en: 'Watch a video review.', ua: 'Подивись відео-огляд.', ru: 'Посмотри видео-обзор.'}, type: 'video_watch', url: 'https://youtube.com', reward: { type: 'coins', amount: 50000 }, priceStars: 0, isOneTime: true, imageUrl: '', secretCode: '' },
];

export const INITIAL_BOOSTS = [
    { id: 'boost_full_energy', name: { en: 'Full Energy', ua: 'Повна енергія', ru: 'Полная энергия' }, description: { en: 'Instantly refill your energy.', ua: 'Миттєво відновити енергію.', ru: 'Мгновенно восстановить энергию.' }, iconUrl: 'https://api.iconify.design/twemoji/high-voltage.svg', costCoins: 2000 },
    { id: 'boost_turbo_mode', name: { en: 'Turbo Mode', ua: 'Турбо-режим', ru: 'Турбо-режим' }, description: { en: 'x5 coins per tap for 20 seconds!', ua: 'x5 монет за тап протягом 20 секунд!', ru: 'x5 монет за тап в течение 20 секунд!' }, iconUrl: 'https://api.iconify.design/twemoji/fire.svg', costCoins: 2000 },
    { id: 'boost_tap_guru', name: { en: 'Guru Tapper', ua: 'Гуру Тапів', ru: 'Гуру Тапов' }, description: { en: '+1 coin per each tap (permanent).', ua: '+1 монета за кожен тап (постійно).', ru: '+1 монета за каждый тап (постоянно).' }, iconUrl: 'https://api.iconify.design/ph/hand-tapping-fill.svg?color=white', costCoins: 1000 },
    { id: 'boost_energy_limit', name: { en: 'Energy Limit', ua: 'Ліміт Енергії', ru: 'Лимит Энергии' }, description: { en: '+500 to your max energy capacity.', ua: '+500 до максимального запасу енергії.', ru: '+500 к максимальному запасу энергии.' }, iconUrl: 'https://api.iconify.design/ph/battery-plus-vertical-fill.svg?color=white', costCoins: 1000 },
];

export const INITIAL_BLACK_MARKET_CARDS = [
    { id: 'bm_card1', name: {en: 'Shadow Courier', ua: 'Тіньовий кур\'єр', ru: 'Теневой курьер'}, profitPerHour: 5000, iconUrl: 'https://api.iconify.design/twemoji/motor-scooter.svg', boxType: 'coin', chance: 50, price: 50000 },
    { id: 'bm_card2', name: {en: 'Offshore Account', ua: 'Офшорний рахунок', ru: 'Офшорный счёт'}, profitPerHour: 25000, iconUrl: 'https://api.iconify.design/twemoji/bank.svg', boxType: 'star', chance: 20, price: 250000 },
];

export const DEFAULT_COIN_SKIN_ID = 'default_coin';

export const INITIAL_COIN_SKINS = [
    { id: DEFAULT_COIN_SKIN_ID, name: {en: 'Default Coin', ua: 'Стандартна Монета', ru: 'Стандартная Монета'}, profitBoostPercent: 0, iconUrl: '/assets/coin.svg', boxType: 'direct', chance: 100 },
    { id: 'skin_btc', name: {en: 'BTC', ua: 'BTC', ru: 'BTC'}, profitBoostPercent: 1, iconUrl: 'https://api.iconify.design/twemoji/coin.svg', boxType: 'coin', chance: 10 },
    { id: 'skin_diamond', name: {en: 'Diamond', ua: 'Діамант', ru: 'Бриллиант'}, profitBoostPercent: 5, iconUrl: 'https://api.iconify.design/twemoji/gem-stone.svg', boxType: 'star', chance: 5 },
];


// --- GAME MECHANICS ---
export const REFERRAL_BONUS = 5000;
export const REFERRAL_PROFIT_SHARE = 0.10; // 10%
export const INITIAL_MAX_ENERGY = 1000;
export const ENERGY_REGEN_RATE = 2; // per second
export const LOOTBOX_COST_COINS = 50000;
export const LOOTBOX_COST_STARS = 5;

// --- ANTI-CHEAT ---
export const CHEAT_DETECTION_THRESHOLD_TPS = 25; // Taps per second
export const CHEAT_DETECTION_STRIKES_TO_FLAG = 5; // Number of times the threshold can be exceeded before flagging
