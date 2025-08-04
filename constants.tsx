import React from 'react';
import { League, Upgrade, UpgradeCategory, Boost, DailyTask, LocalizedString, SpecialTask } from './types';

// --- ROLE MANAGEMENT ---
// The primary admin. Has all rights.
export const ADMIN_TELEGRAM_ID = '7327258482'; 
// Users who can access the admin panel but have slightly fewer rights than the main admin.
export const MODERATOR_TELEGRAM_IDS: string[] = ['987654321']; // Add moderator IDs here


// --- BOT CONFIGURATION ---
export const TELEGRAM_BOT_NAME = 'Ukhyliantbot';


// --- ICONS ---
export const PassportIcon = () => <span className="text-2xl" role="img" aria-label="passport">🛂</span>;
export const BriefcaseIcon = () => <span className="text-2xl" role="img" aria-label="briefcase">💼</span>;
export const MansionIcon = () => <span className="text-2xl" role="img" aria-label="mansion">🏰</span>;
export const CrownIcon = () => <span className="text-2xl" role="img" aria-label="crown">👑</span>;

export const CoinIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
);
export const StarIcon = () => <span className="text-yellow-300">⭐</span>;

// Nav Icons
const NavIcon = ({ children, active }: { children: React.ReactNode, active: boolean }) => (
    <span className={`text-3xl ${active ? 'text-white' : 'text-gray-500'}`}>{children}</span>
);
export const ExchangeIcon = ({ active }: { active: boolean }) => <NavIcon active={active}>💸</NavIcon>;
export const MineIcon = ({ active }: { active: boolean }) => <NavIcon active={active}>⛏️</NavIcon>;
export const FriendsIcon = ({ active }: { active: boolean }) => <NavIcon active={active}>🧑‍🤝‍🧑</NavIcon>;
export const BoostIcon = ({ active }: { active: boolean }) => <NavIcon active={active}>🚀</NavIcon>;
export const TasksIcon = ({ active }: { active: boolean }) => <NavIcon active={active}>📋</NavIcon>;
export const EarnIcon = ({ active }: { active: boolean }) => <NavIcon active={active}>💰</NavIcon>;
export const AdminIcon = ({ active }: { active: boolean }) => <NavIcon active={active}>⚙️</NavIcon>;


// --- GAME CONFIGURATION ---
export const LEAGUES: League[] = [
  { name: { en: 'In The City', ua: 'В місті' }, minBalance: 0, icon: <PassportIcon /> },
  { name: { en: 'Grandma\'s Village', ua: 'В селі у бабці' }, minBalance: 50000, icon: <BriefcaseIcon /> },
  { name: { en: 'Across the Tisza', ua: 'Переплив Тису' }, minBalance: 1000000, icon: <MansionIcon /> },
  { name: { en: 'European Baron', ua: 'Європейський Барон' }, minBalance: 50000000, icon: <CrownIcon /> },
].reverse();

export const INITIAL_UPGRADES: Upgrade[] = [
    { id: 'doc1', name: { en: 'Student ID', ua: 'Студентський квиток' }, price: 100, profitPerHour: 10, category: UpgradeCategory.Documents, icon: '🎓' },
    { id: 'doc2', name: { en: 'Disability Certificate', ua: 'Довідка про інвалідність' }, price: 1500, profitPerHour: 80, category: UpgradeCategory.Documents, icon: '♿' },
    { id: 'doc3', name: { en: 'White Ticket', ua: 'Білий квиток' }, price: 10000, profitPerHour: 500, category: UpgradeCategory.Documents, icon: '📄' },
    { id: 'leg1', name: { en: 'Lawyer Consultation', ua: 'Консультація адвоката' }, price: 500, profitPerHour: 25, category: UpgradeCategory.Legal, icon: '⚖️' },
    { id: 'leg2', name: { en: 'Open a Fake Company', ua: 'Відкрити фіктивну фірму' }, price: 5000, profitPerHour: 200, category: UpgradeCategory.Legal, icon: '🏢' },
    { id: 'life1', name: { en: 'Hide in the Village', ua: 'Сховатись в селі' }, price: 2000, profitPerHour: 100, category: UpgradeCategory.Lifestyle, icon: '🛖' },
    { id: 'life2', name: { en: 'Rent a Bunker', ua: 'Орендувати бункер' }, price: 25000, profitPerHour: 1100, category: UpgradeCategory.Lifestyle, icon: '🔒' },
    { id: 'spec1', name: { en: 'Border Crossing', ua: 'Перетин кордону' }, price: 100000, profitPerHour: 4000, category: UpgradeCategory.Special, icon: '🗺️' },
    { id: 'spec2', name: { en: 'New Identity', ua: 'Нова особистість' }, price: 500000, profitPerHour: 20000, category: UpgradeCategory.Special, icon: '🎭' },
];

export const INITIAL_TASKS: DailyTask[] = [
    { id: 'task1', name: { en: 'Tap 500 times', ua: 'Натисни 500 разів' }, rewardCoins: 1000, rewardStars: 5, requiredTaps: 500 },
    { id: 'task2', name: { en: 'Daily Check-in', ua: 'Щоденний візит' }, rewardCoins: 500, rewardStars: 10, requiredTaps: 1 },
];

export const INITIAL_SPECIAL_TASKS: SpecialTask[] = [
    { id: 'special1', name: { en: 'Join Our Channel', ua: 'Приєднайся до каналу' }, description: { en: 'Get a huge bonus for joining our news channel!', ua: 'Отримай великий бонус за підписку на наш канал новин!' }, type: 'telegram_join', url: 'https://t.me/durov', rewardCoins: 100000, rewardStars: 25, priceStars: 5, isOneTime: true },
    { id: 'special2', name: { en: 'Watch Review', ua: 'Подивись огляд' }, description: { en: 'Watch a video review and get rewarded.', ua: 'Подивись відео-огляд та отримай нагороду.'}, type: 'video_watch', url: 'https://youtube.com', rewardCoins: 50000, rewardStars: 15, priceStars: 0, isOneTime: true },
];

export const INITIAL_BOOSTS: Boost[] = [
    { id: 'boost1', name: { en: 'Full Energy', ua: 'Повна енергія' }, description: { en: 'Instantly refill your energy.', ua: 'Миттєво відновити енергію.' }, icon: '⚡', cost: 10 },
    { id: 'boost2', name: { en: 'Turbo Taps (30s)', ua: 'Турбо-тапи (30с)' }, description: { en: 'Multiply coins per tap for 30 seconds.', ua: 'Помножити монети за тап на 30 секунд.' }, icon: '🔥', cost: 20 },
];


// --- GAME MECHANICS ---
export const MAX_ENERGY = 1000;
export const ENERGY_REGEN_RATE = 2; // per second
export const SAVE_DEBOUNCE_MS = 1000;
export const REFERRAL_BONUS = 5000; // Coins for each referral


// --- TRANSLATIONS ---
type TranslationKey = 
  | 'exchange' | 'mine' | 'friends' | 'boosts' | 'tasks' | 'admin' | 'player' | 'league'
  | 'profit_per_hour' | 'energy' | 'stars' | 'mine_upgrades' | 'lvl'
  | 'get' | 'level' | 'price' | 'profit' | 'category' | 'icon' | 'actions' | 'save'
  | 'add_new_upgrade' | 'edit_upgrades' | 'edit_tasks' | 'task_name' | 'reward_coins' | 'reward_stars'
  | 'required_taps' | 'add_new_task' | 'edit_boosts' | 'boost_name' | 'description' | 'cost' | 'add_new_boost'
  | 'login_with_telegram' | 'login' | 'logout' | 'enter_telegram_id' | 'copy_referral_link' | 'copied'
  | 'claim_reward' | 'completed' | 'earn' | 'special_tasks' | 'unlock_for' | 'go_to_task' | 'claim'
  | 'edit_special_tasks' | 'task_type' | 'url' | 'price_stars' | 'add_new_special_task' | 'translate'
  | 'telegram_join' | 'social_follow' | 'video_watch' | 'referral_bonus' | 'your_referrals' | 'invite_friends';

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
    stars: 'Stars',
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
    reward_stars: 'Reward Stars',
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
    stars: 'Зірки',
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
    reward_stars: 'Нагорода зірками',
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
  },
};