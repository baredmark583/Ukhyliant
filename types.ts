
export type Language = 'en' | 'ua';

export interface LocalizedString {
  en: string;
  ua: string;
}

export interface User {
  id: string; // Telegram User ID
  name: string;
  language: Language;
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
  // Dynamic properties for player
  level?: number;
}

export interface Boost {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  icon: string;
  cost: number; // Cost in stars
}

export interface DailyTask {
    id: string;
    name: LocalizedString;
    rewardCoins: number;
    rewardStars: number;
    requiredTaps: number;
}

export interface GameConfig {
    upgrades: Upgrade[];
    tasks: DailyTask[];
    boosts: Boost[];
}

export interface PlayerState {
  balance: number;
  energy: number;
  profitPerHour: number;
  coinsPerTap: number;
  lastLoginTimestamp: number;
  upgrades: Record<string, number>; // key: upgrade.id, value: level
  stars: number;
  referrals: number;
  completedDailyTaskIds: string[]; // Tracks tasks completed for the current day
  dailyTaps: number; // Tracks taps for the current day
  lastDailyReset: number; // Timestamp of the last daily reset
}
