

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
  referrerId?: string;
}

export interface League {
  id:string;
  name: LocalizedString;
  description: LocalizedString;
  minProfitPerHour: number;
  iconUrl: string;
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
  iconUrl: string;
  level?: number;
}

export type BoxType = 'coin' | 'star';

export interface BlackMarketCard {
    id: string;
    name: LocalizedString;
    price?: number; // Price is not directly used for purchase but for level calculation
    profitPerHour: number;
    iconUrl: string;
    boxType: BoxType;
    chance: number; // Rarity/drop chance
}

export interface CoinSkin {
    id: string;
    name: LocalizedString;
    profitBoostPercent: number;
    iconUrl: string;
    boxType: BoxType | 'direct'; // 'direct' for future direct purchase
    chance: number; // Rarity/drop chance
}


export interface Boost {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  iconUrl: string;
  costCoins: number; // Cost in coins
}

export type RewardType = 'coins' | 'profit';

export interface Reward {
    type: RewardType;
    amount: number;
}

export type TaskType = 'taps' | 'telegram_join' | 'social_follow' | 'video_watch' | 'video_code';

export interface DailyTask {
    id: string;
    name: LocalizedString;
    type: TaskType;
    reward: Reward;
    requiredTaps?: number; // Only for 'taps' type
    url?: string; // For link-based tasks
    secretCode?: string; // For 'video_code' type
    imageUrl?: string; // Custom image for the task
}

export interface SpecialTask {
    id: string;
    name: LocalizedString;
    description: LocalizedString;
    type: TaskType;
    url?: string;
    reward: Reward;
    priceStars: number;
    isOneTime: true;
    imageUrl?: string;
    secretCode?: string; // Added for consistency although not in original request for special tasks
}

export interface DailyEvent {
    combo_ids: string[];
    cipherWord: string;
}

export interface UiIcons {
  nav: {
    exchange: string;
    mine: string;
    missions: string;
    profile: string;
    airdrop: string;
  };
  energy: string;
  coin: string;
  star: string;
  marketCoinBox: string;
  marketStarBox: string;
}

export interface GameConfig {
    upgrades: Upgrade[];
    tasks: DailyTask[];
    boosts: Boost[];
    specialTasks: SpecialTask[];
    blackMarketCards: BlackMarketCard[];
    coinSkins: CoinSkin[];
    leagues: League[];
    dailyEvent: DailyEvent | null;
    loadingScreenImageUrl?: string;
    uiIcons: UiIcons;
}

export interface PlayerState {
  balance: number;
  energy: number;
  profitPerHour: number;
  tasksProfitPerHour: number; // Permanent profit from tasks
  referralProfitPerHour: number;
  coinsPerTap: number;
  lastLoginTimestamp: number;
  upgrades: Record<string, number>; // key: upgrade.id, value: level
  referrals: number;
  completedDailyTaskIds: string[];
  purchasedSpecialTaskIds: string[]; // Tasks unlocked by paying stars
  completedSpecialTaskIds: string[]; // One-time tasks that have been completed
  dailyTaps: number;
  lastDailyReset: number;
  claimedComboToday: boolean;
  claimedCipherToday: boolean;
  dailyUpgrades: string[];
  tapGuruLevel: number;
  energyLimitLevel: number;
  unlockedSkins: string[];
  currentSkinId: string;
}

// For Leaderboard
export interface LeaderboardPlayer {
    id: string;
    name: string;
    profitPerHour: number;
    leagueName: LocalizedString;
    leagueIconUrl: string;
}