
export type Language = 'en' | 'ua' | 'ru';

export interface LocalizedString {
  en: string;
  ua: string;
  ru: string;
}

export type UserRole = 'user' | 'moderator' | 'admin';

export interface User {
  id: string; // Telegram User ID
  name: string;
  language: Language;
  role: UserRole;
}

export interface League {
  name: LocalizedString;
  minBalance: number;
  icon: React.ReactNode;
}

export enum UpgradeCategory {
  Documents = "Documents",
  Legal = "Legal",
  Lifestyle = "Lifestyle",
  Special = "Special",
}

export interface Upgrade {
  id: string;
  name: LocalizedString;
  price: number;
  profitPerHour: number;
  category: UpgradeCategory;
  icon: string;
  level?: number;
}

export interface Boost {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  icon: string;
  costCoins: number; // Cost in coins
}

export interface DailyTask {
    id: string;
    name: LocalizedString;
    rewardCoins: number;
    requiredTaps: number;
}

export type SpecialTaskType = 'telegram_join' | 'social_follow' | 'video_watch';

export interface SpecialTask {
    id: string;
    name: LocalizedString;
    description: LocalizedString;
    type: SpecialTaskType;
    url: string;
    rewardCoins: number;
    priceStars: number; // Cost to unlock the task, paid in Telegram Stars
    isOneTime: true;
}

export interface GameConfig {
    upgrades: Upgrade[];
    tasks: DailyTask[];
    boosts: Boost[];
    specialTasks: SpecialTask[];
}

export interface PlayerState {
  balance: number;
  energy: number;
  profitPerHour: number;
  coinsPerTap: number;
  lastLoginTimestamp: number;
  upgrades: Record<string, number>; // key: upgrade.id, value: level
  referrals: number;
  completedDailyTaskIds: string[];
  purchasedSpecialTaskIds: string[]; // Tasks unlocked by paying stars
  completedSpecialTaskIds: string[]; // One-time tasks that have been completed
  dailyTaps: number;
  lastDailyReset: number;
}
