
import React from 'react';
import { League, Upgrade, UpgradeCategory, Boost, DailyTask, LocalizedString } from './types';

// The Telegram ID of the user who will have admin access.
// In a real application, this would come from a secure environment variable.
export const ADMIN_TELEGRAM_ID = '123456789'; 

// --- BOT CONFIGURATION ---
// Replace 'YourTelegramBotName' with the actual username of your Telegram bot.
export const TELEGRAM_BOT_NAME = 'YourTelegramBotName';


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
export const BoostIcon = ({ active }: { active: boolean }) => <NavIcon active={active}>🚀</NavIcon>;
export const TasksIcon = ({ active }: { active: boolean }) => <NavIcon active={active}>📋</NavIcon>;
export const AdminIcon = ({ active }: { active: boolean }) => <NavIcon active={active}>⚙️</NavIcon>;


// --- GAME CONFIGURATION ---
export const LEAGUES: League[] = [
  { name: { en: 'In The City', ua: 'В місті' }, minBalance: 0, icon: <PassportIcon /> },
  { name: { en: 'Grandma\'s Village', ua: 'В селі у бабці' }, minBalance: 50000, icon: <BriefcaseIcon /> },
  { name: { en: 'Across the Tisza', ua: 'Переплив Тису' }, minBalance: 1000000, icon: <MansionIcon /> },
  { name: { en: 'European Baron', ua: 'Європейський Барон' }, minBalance: 50000000, icon: <CrownIcon /> },
].reverse();

export const INITIAL_UPGRADES: Upgrade[] = [
    // Documents
    { id: 'doc1', name: { en: 'Student ID', ua: 'Студентський квиток' }, price: 100, profitPerHour: 10, category: UpgradeCategory.Documents, icon: '🎓' },
    { id: 'doc2', name: { en: 'Disability Certificate', ua: 'Довідка про інвалідність' }, price: 1500, profitPerHour: 80, category: UpgradeCategory.Documents, icon: '♿' },
    { id: 'doc3', name: { en: 'White Ticket', ua: 'Білий квиток' }, price: 10000, profitPerHour: 500, category: UpgradeCategory.Documents, icon: '📄' },
    
    // Legal
    { id: 'leg1', name: { en: 'Lawyer Consultation', ua: 'Консультація адвоката' }, price: 500, profitPerHour: 25, category: UpgradeCategory.Legal, icon: '⚖️' },
    { id: 'leg2', name: { en: 'Open a Fake Company', ua: 'Відкрити фіктивну фірму' }, price: 5000, profitPerHour: 200, category: UpgradeCategory.Legal, icon: '🏢' },

    // Lifestyle
    { id: 'life1', name: { en: 'Hide in the Village', ua: 'Сховатись в селі' }, price: 2000, profitPerHour: 100, category: UpgradeCategory.Lifestyle, icon: '🛖' },
    { id: 'life2', name: { en: 'Rent a Bunker', ua: 'Орендувати бункер' }, price: 25000, profitPerHour: 1100, category: UpgradeCategory.Lifestyle, icon: '🔒' },

    // Special
    { id: 'spec1', name: { en: 'Border Crossing', ua: 'Перетин кордону' }, price: 100000, profitPerHour: 4000, category: UpgradeCategory.Special, icon: '🗺️' },
    { id: 'spec2', name: { en: 'New Identity', ua: 'Нова особистість' }, price: 500000, profitPerHour: 20000, category: UpgradeCategory.Special, icon: '🎭' },
];

export const INITIAL_TASKS: DailyTask[] = [
    { id: 'task1', name: { en: 'Tap 500 times', ua: 'Натисни 500 разів' }, rewardCoins: 1000, rewardStars: 5, requiredTaps: 500 },
    { id: 'task2', name: { en: 'Daily Check-in', ua: 'Щоденний візит' }, rewardCoins: 500, rewardStars: 10, requiredTaps: 1 },
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
  | 'exchange' | 'mine' | 'boosts' | 'tasks' | 'admin' | 'player' | 'league'
  | 'profit_per_hour' | 'energy' | 'stars' | 'mine_upgrades' | 'lvl'
  | 'get' | 'level' | 'price' | 'profit' | 'category' | 'icon' | 'actions' | 'save'
  | 'add_new_upgrade' | 'edit_upgrades' | 'edit_tasks' | 'task_name' | 'reward_coins' | 'reward_stars'
  | 'required_taps' | 'add_new_task' | 'edit_boosts' | 'boost_name' | 'description' | 'cost' | 'add_new_boost'
  | 'login_with_telegram' | 'login' | 'logout' | 'enter_telegram_id' | 'copy_referral_link' | 'copied'
  | 'claim_reward' | 'completed';

export const TRANSLATIONS: Record<string, Record<TranslationKey, string>> = {
  en: {
    exchange: 'Exchange',
    mine: 'Mine',
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
  },
  ua: {
    exchange: 'Біржа',
    mine: 'Майнінг',
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
  },
};
