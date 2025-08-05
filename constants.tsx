import React from 'react';
import { League, Upgrade, UpgradeCategory, Boost, DailyTask, LocalizedString, SpecialTask } from './types';

// --- ROLE MANAGEMENT ---
// The primary admin. Has all rights.
export const ADMIN_TELEGRAM_ID = '7327258482'; 
// Users who can access the admin panel but have slightly fewer rights than the main admin.
export const MODERATOR_TELEGRAM_IDS: string[] = ['987654321']; // Add moderator IDs here


// --- BOT CONFIGURATION ---
export const TELEGRAM_BOT_NAME = 'Ukhyliantbot';
// IMPORTANT: Replace 'app' with the "App Short Name" from BotFather for deep links to work
export const MINI_APP_NAME = 'ukhyliant_game';


// --- ICONS ---
export const COIN_ICON_URL = `data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23FBBF24'%3e%3cpath fill-rule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z' clip-rule='evenodd' /%3e%3c/svg%3e`;
export const STAR_ICON_URL = `data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23FBBF24'%3e%3cpath d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z'/%3e%3c/svg%3e`;
export const NAV_ICON_URLS = {
    exchange: 'https://api.iconify.design/ph/chart-line-up-bold.svg?color=white',
    mine: 'https://api.iconify.design/ph/hammer-bold.svg?color=white',
    friends: 'https://api.iconify.design/ph/users-three-bold.svg?color=white',
    earn: 'https://api.iconify.design/ph/star-bold.svg?color=white',
    boost: 'https://api.iconify.design/ph/rocket-launch-bold.svg?color=white'
};


// --- GAME CONFIGURATION ---
export const LEAGUES: League[] = [
  { name: { en: 'In The City', ua: 'В місті', ru: 'В городе' }, minBalance: 0, iconUrl: 'https://api.iconify.design/twemoji/passport-control.svg' },
  { name: { en: 'Grandma\'s Village', ua: 'В селі у бабці', ru: 'В деревне у бабушки' }, minBalance: 50000, iconUrl: 'https://api.iconify.design/twemoji/briefcase.svg' },
  { name: { en: 'Across the Tisza', ua: 'Переплив Тису', ru: 'Переплыл Тиссу' }, minBalance: 1000000, iconUrl: 'https://api.iconify.design/twemoji/european-castle.svg' },
  { name: { en: 'European Baron', ua: 'Європейський Барон', ru: 'Европейский Барон' }, minBalance: 50000000, iconUrl: 'https://api.iconify.design/twemoji/crown.svg' },
].reverse();

export const INITIAL_UPGRADES: Upgrade[] = [
    { id: 'doc1', name: { en: 'Student ID', ua: 'Студентський квиток', ru: 'Студенческий билет' }, price: 100, profitPerHour: 10, category: UpgradeCategory.Documents, iconUrl: 'https://api.iconify.design/twemoji/graduation-cap.svg' },
    { id: 'doc2', name: { en: 'Disability Certificate', ua: 'Довідка про інвалідність', ru: 'Справка об инвалидности' }, price: 1500, profitPerHour: 80, category: UpgradeCategory.Documents, iconUrl: 'https://api.iconify.design/twemoji/wheelchair-symbol.svg' },
    { id: 'doc3', name: { en: 'White Ticket', ua: 'Білий квиток', ru: 'Белый билет' }, price: 10000, profitPerHour: 500, category: UpgradeCategory.Documents, iconUrl: 'https://api.iconify.design/twemoji/page-facing-up.svg' },
    { id: 'leg1', name: { en: 'Lawyer Consultation', ua: 'Консультація адвоката', ru: 'Консультация адвоката' }, price: 500, profitPerHour: 25, category: UpgradeCategory.Legal, iconUrl: 'https://api.iconify.design/twemoji/balance-scale.svg' },
    { id: 'leg2', name: { en: 'Open a Fake Company', ua: 'Відкрити фіктивну фірму', ru: 'Открыть фиктивную фирму' }, price: 5000, profitPerHour: 200, category: UpgradeCategory.Legal, iconUrl: 'https://api.iconify.design/twemoji/office-building.svg' },
    { id: 'life1', name: { en: 'Hide in the Village', ua: 'Сховатись в селі', ru: 'Спрятаться в деревне' }, price: 2000, profitPerHour: 100, category: UpgradeCategory.Lifestyle, iconUrl: 'https://api.iconify.design/twemoji/hut.svg' },
    { id: 'life2', name: { en: 'Rent a Bunker', ua: 'Орендувати бункер', ru: 'Арендовать бункер' }, price: 25000, profitPerHour: 1100, category: UpgradeCategory.Lifestyle, iconUrl: 'https://api.iconify.design/twemoji/locked.svg' },
    { id: 'spec1', name: { en: 'Border Crossing', ua: 'Перетин кордону', ru: 'Пересечение границы' }, price: 100000, profitPerHour: 4000, category: UpgradeCategory.Special, iconUrl: 'https://api.iconify.design/twemoji/world-map.svg' },
    { id: 'spec2', name: { en: 'New Identity', ua: 'Нова особистість', ru: 'Новая личность' }, price: 500000, profitPerHour: 20000, category: UpgradeCategory.Special, iconUrl: 'https://api.iconify.design/twemoji/performing-arts.svg' },
];

export const INITIAL_TASKS: DailyTask[] = [
    { id: 'task1', name: { en: 'Tap 500 times', ua: 'Натисни 500 разів', ru: 'Нажми 500 раз' }, type: 'taps', reward: { type: 'coins', amount: 1000 }, requiredTaps: 500 },
    { id: 'task2', name: { en: 'Daily Check-in', ua: 'Щоденний візит', ru: 'Ежедневный визит' }, type: 'taps', reward: { type: 'coins', amount: 500 }, requiredTaps: 1 },
    { id: 'task3', name: { en: 'Join Telegram', ua: 'Підпишись на Telegram', ru: 'Подпишись на Telegram' }, type: 'telegram_join', reward: { type: 'profit', amount: 100 }, url: 'https://t.me/durov', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg' }
];

export const INITIAL_SPECIAL_TASKS: SpecialTask[] = [
    { id: 'special1', name: { en: 'Join Our Channel', ua: 'Приєднайся до каналу', ru: 'Присоединись к каналу' }, description: { en: 'Get a huge bonus for joining our news channel!', ua: 'Отримай великий бонус за підписку на наш канал новин!', ru: 'Получи большой бонус за подписку на наш новостной канал!' }, type: 'telegram_join', url: 'https://t.me/durov', reward: { type: 'coins', amount: 100000 }, priceStars: 5, isOneTime: true },
    { id: 'special2', name: { en: 'Watch Review', ua: 'Подивись огляд', ru: 'Посмотри обзор' }, description: { en: 'Watch a video review and get rewarded.', ua: 'Подивись відео-огляд та отримай нагороду.', ru: 'Посмотри видео-обзор и получи награду.'}, type: 'video_watch', url: 'https://youtube.com', reward: { type: 'coins', amount: 50000 }, priceStars: 0, isOneTime: true },
];

export const INITIAL_BOOSTS: Boost[] = [
    { id: 'boost1', name: { en: 'Full Energy', ua: 'Повна енергія', ru: 'Полная энергия' }, description: { en: 'Instantly refill your energy.', ua: 'Миттєво відновити енергію.', ru: 'Мгновенно восстановить энергию.' }, iconUrl: 'https://api.iconify.design/twemoji/high-voltage.svg', costCoins: 5000 },
    { id: 'boost2', name: { en: 'Turbo Taps (30s)', ua: 'Турбо-тапи (30с)', ru: 'Турбо-тапы (30с)' }, description: { en: 'Multiply coins per tap for 30 seconds.', ua: 'Помножити монети за тап на 30 секунд.', ru: 'Умножить монеты за тап на 30 секунд.' }, iconUrl: 'https://api.iconify.design/twemoji/fire.svg', costCoins: 10000 },
];


// --- GAME MECHANICS ---
export const MAX_ENERGY = 1000;
export const ENERGY_REGEN_RATE = 2; // per second
export const SAVE_DEBOUNCE_MS = 1000;
export const REFERRAL_BONUS = 5000; // Coins for each referral


// --- TRANSLATIONS ---
type TranslationKey = 
  | 'exchange' | 'mine' | 'friends' | 'boosts' | 'tasks' | 'admin' | 'player' | 'league'
  | 'profit_per_hour' | 'energy' | 'mine_upgrades' | 'lvl'
  | 'get' | 'level' | 'price' | 'profit' | 'category' | 'icon' | 'actions' | 'save'
  | 'add_new_upgrade' | 'edit_upgrades' | 'edit_tasks' | 'task_name' | 'reward_coins'
  | 'required_taps' | 'add_new_task' | 'edit_boosts' | 'boost_name' | 'description' | 'cost' | 'add_new_boost'
  | 'login_with_telegram' | 'login' | 'logout' | 'enter_telegram_id' | 'copy_referral_link' | 'copied'
  | 'claim_reward' | 'completed' | 'earn' | 'special_tasks' | 'unlock_for' | 'go_to_task' | 'claim'
  | 'edit_special_tasks' | 'task_type' | 'url' | 'price_stars' | 'add_new_special_task' | 'translate'
  | 'telegram_join' | 'social_follow' | 'video_watch' | 'referral_bonus' | 'your_referrals' | 'invite_friends'
  // Daily Events
  | 'daily_combo' | 'daily_cipher' | 'find_cards' | 'cipher_hint' | 'claimed_today'
  | 'enter_morse_mode' | 'cancel_morse_mode' | 'enter_secret_code' | 'check' | 'leaderboard' | 'your_league' | 'total_players';

export const TRANSLATIONS: Record<string, Record<TranslationKey, string>> = {
  en: {
    exchange: 'Exchange',
    mine: 'Mine',
    friends: 'Friends',
    boosts: 'Boosts',
    tasks: 'Tasks',
    admin: 'Admin',
    player: 'Player',
    league: 'League',
    profit_per_hour: 'Profit per hour',
    energy: 'Energy',
    mine_upgrades: 'Mine Upgrades',
    lvl: 'lvl',
    get: 'Get',
    level: 'Level',
    price: 'Price',
    profit: 'Profit',
    category: 'Category',
    icon: 'Icon',
    actions: 'Actions',
    save: 'Save',
    add_new_upgrade: 'Add New Upgrade',
    edit_upgrades: 'Edit Upgrades',
    edit_tasks: 'Edit Daily Tasks',
    task_name: 'Task Name',
    reward_coins: 'Reward Coins',
    required_taps: 'Required Taps',
    add_new_task: 'Add New Task',
    edit_boosts: 'Edit Boosts',
    boost_name: 'Boost Name',
    description: 'Description',
    cost: 'Cost',
    add_new_boost: 'Add New Boost',
    login_with_telegram: 'Login with Telegram',
    login: 'Login',
    logout: 'Logout',
    enter_telegram_id: 'Enter your Telegram ID to simulate login',
    copy_referral_link: 'Copy Referral Link',
    copied: 'Copied!',
    claim_reward: 'Claim Reward',
    completed: 'Completed',
    earn: 'Earn',
    special_tasks: 'Special Tasks',
    unlock_for: 'Unlock for',
    go_to_task: 'Go to Task',
    claim: 'Claim',
    edit_special_tasks: 'Edit Special Tasks',
    task_type: 'Task Type',
    url: 'URL',
    price_stars: 'Price in Stars',
    add_new_special_task: 'Add New Special Task',
    translate: 'Translate',
    telegram_join: 'Join Telegram',
    social_follow: 'Follow Social Media',
    video_watch: 'Watch Video',
    referral_bonus: 'Bonus per friend',
    your_referrals: 'Your referrals',
    invite_friends: 'Invite a Friend',
    daily_combo: 'Daily Combo',
    daily_cipher: 'Daily Cipher',
    find_cards: 'Find and upgrade these cards!',
    cipher_hint: 'Tap the code: . is short, - is long',
    claimed_today: 'Claimed Today',
    enter_morse_mode: 'Enter Code',
    cancel_morse_mode: 'Cancel',
    enter_secret_code: 'Enter Secret Code',
    check: 'Check',
    leaderboard: 'Leaderboard',
    your_league: 'Your League',
    total_players: 'Total Players',
  },
  ua: {
    exchange: 'Біржа',
    mine: 'Майнінг',
    friends: 'Друзі',
    boosts: 'Бусти',
    tasks: 'Завдання',
    admin: 'Адмінка',
    player: 'Гравець',
    league: 'Ліга',
    profit_per_hour: 'Прибуток на годину',
    energy: 'Енергія',
    mine_upgrades: 'Покращення',
    lvl: 'рів',
    get: 'Отримати',
    level: 'Рівень',
    price: 'Ціна',
    profit: 'Прибуток',
    category: 'Категорія',
    icon: 'Іконка',
    actions: 'Дії',
    save: 'Зберегти',
    add_new_upgrade: 'Додати нове покращення',
    edit_upgrades: 'Редагувати покращення',
    edit_tasks: 'Редагувати щоденні завдання',
    task_name: 'Назва завдання',
    reward_coins: 'Нагорода монетами',
    required_taps: 'Необхідно тапів',
    add_new_task: 'Додати нове завдання',
    edit_boosts: 'Редагувати бусти',
    boost_name: 'Назва буста',
    description: 'Опис',
    cost: 'Вартість',
    add_new_boost: 'Додати новий буст',
    login_with_telegram: 'Увійти через Telegram',
    login: 'Увійти',
    logout: 'Вийти',
    enter_telegram_id: 'Введіть ваш Telegram ID для симуляції входу',
    copy_referral_link: 'Копіювати реф. посилання',
    copied: 'Скопійовано!',
    claim_reward: 'Отримати нагороду',
    completed: 'Виконано',
    earn: 'Заробіток',
    special_tasks: 'Спеціальні Завдання',
    unlock_for: 'Розблокувати за',
    go_to_task: 'Перейти до завдання',
    claim: 'Забрати',
    edit_special_tasks: 'Редагувати спец. завдання',
    task_type: 'Тип завдання',
    url: 'Посилання',
    price_stars: 'Ціна в зірках',
    add_new_special_task: 'Додати спец. завдання',
    translate: 'Перекласти',
    telegram_join: 'Підписка Telegram',
    social_follow: 'Підписка на соц. мережі',
    video_watch: 'Перегляд відео',
    referral_bonus: 'Бонус за друга',
    your_referrals: 'Ваші реферали',
    invite_friends: 'Запросити друга',
    daily_combo: 'Щоденне комбо',
    daily_cipher: 'Щоденний шифр',
    find_cards: 'Знайди та прокачай ці картки!',
    cipher_hint: 'Відстукай код: . короткий, - довгий',
    claimed_today: 'Сьогодні забрано',
    enter_morse_mode: 'Ввести код',
    cancel_morse_mode: 'Скасувати',
    enter_secret_code: 'Введіть секретний код',
    check: 'Перевірити',
    leaderboard: 'Таблиця лідерів',
    your_league: 'Ваша ліга',
    total_players: 'Всього гравців',
  },
  ru: {
    exchange: 'Биржа',
    mine: 'Майнинг',
    friends: 'Друзья',
    boosts: 'Бусты',
    tasks: 'Задания',
    admin: 'Админка',
    player: 'Игрок',
    league: 'Лига',
    profit_per_hour: 'Прибыль в час',
    energy: 'Энергия',
    mine_upgrades: 'Улучшения',
    lvl: 'ур',
    get: 'Получить',
    level: 'Уровень',
    price: 'Цена',
    profit: 'Прибыль',
    category: 'Категория',
    icon: 'Иконка',
    actions: 'Действия',
    save: 'Сохранить',
    add_new_upgrade: 'Добавить новое улучшение',
    edit_upgrades: 'Редактировать улучшения',
    edit_tasks: 'Редактировать ежедневные задания',
    task_name: 'Название задания',
    reward_coins: 'Награда монетами',
    required_taps: 'Необходимо тапов',
    add_new_task: 'Добавить новое задание',
    edit_boosts: 'Редактировать бусты',
    boost_name: 'Название буста',
    description: 'Описание',
    cost: 'Стоимость',
    add_new_boost: 'Добавить новый буст',
    login_with_telegram: 'Войти через Telegram',
    login: 'Войти',
    logout: 'Выйти',
    enter_telegram_id: 'Введите ваш Telegram ID для симуляции входа',
    copy_referral_link: 'Копировать реф. ссылку',
    copied: 'Скопировано!',
    claim_reward: 'Получить награду',
    completed: 'Выполнено',
    earn: 'Заработок',
    special_tasks: 'Специальные Задания',
    unlock_for: 'Разблокировать за',
    go_to_task: 'Перейти к заданию',
    claim: 'Забрать',
    edit_special_tasks: 'Редактировать спец. задания',
    task_type: 'Тип задания',
    url: 'Ссылка',
    price_stars: 'Цена в звёздах',
    add_new_special_task: 'Добавить спец. задание',
    translate: 'Перевести',
    telegram_join: 'Подписка Telegram',
    social_follow: 'Подписка на соц. сети',
    video_watch: 'Просмотр видео',
    referral_bonus: 'Бонус за друга',
    your_referrals: 'Ваши рефералы',
    invite_friends: 'Пригласить друга',
    daily_combo: 'Ежедневное комбо',
    daily_cipher: 'Ежедневный шифр',
    find_cards: 'Найди и прокачай эти карты!',
    cipher_hint: 'Отстучи код: . короткий, - длинный',
    claimed_today: 'Сегодня забрано',
    enter_morse_mode: 'Ввести код',
    cancel_morse_mode: 'Отмена',
    enter_secret_code: 'Введите секретный код',
    check: 'Проверить',
    leaderboard: 'Таблица лидеров',
    your_league: 'Ваша лига',
    total_players: 'Всего игроков',
  },
};