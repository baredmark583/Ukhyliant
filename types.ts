

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
  walletAddress?: string; // TON wallet address
}

export interface Friend {
    id: string;
    name: string;
    leagueName: LocalizedString;
    leagueIconUrl: string;
    profitBonus: number;
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
  BlackMarket = "Black Market",
}

export interface Upgrade {
  id: string;
  name: LocalizedString;
  price: number;
  profitPerHour: number;
  category: UpgradeCategory;
  iconUrl: string;
  suspicionModifier: number;
  level?: number;
}

export type BoxType = 'coin' | 'star';

export interface BlackMarketCard {
    id: string;
    name: LocalizedString;
    price: number; // Price is not directly used for purchase but for level calculation
    profitPerHour: number;
    category: UpgradeCategory;
    iconUrl: string;
    suspicionModifier: number;
    // BlackMarketCard specific properties
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
    suspicionModifier: number;
}


export interface Boost {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  iconUrl: string;
  costCoins: number; // Cost in coins
  suspicionModifier: number;
}

export type RewardType = 'coins' | 'profit';

export interface Reward {
    type: RewardType;
    amount: number;
}

export type TaskType = 'taps' | 'telegram_join' | 'video_watch' | 'video_code' | 'youtube_subscribe' | 'twitter_follow' | 'instagram_follow';

export interface DailyTask {
    id: string;
    name: LocalizedString;
    type: TaskType;
    reward: Reward;
    requiredTaps?: number; // Only for 'taps' type
    url?: string; // For link-based tasks
    secretCode?: string; // For 'video_code' type
    imageUrl?: string; // Custom image for the task
    suspicionModifier: number;
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
    secretCode?: string;
    suspicionModifier: number;
}

export interface DailyEvent {
    combo_ids: string[];
    cipherWord: string;
    comboReward: number;
    cipherReward: number;
}

export interface UiIcons {
  nav: {
    exchange: string;
    mine: string;
    missions: string;
    profile: string;
    airdrop: string;
  };
  profile_tabs: {
    contacts: string;
    boosts: string;
    skins: string;
    market: string;
    cell: string;
    airdrop: string;
  };
  energy: string;
  coin: string;
  star: string;
  suspicion: string;
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
    cellCreationCost: number;
    cellMaxMembers: number;
    cellBattleTicketCost: number;
    informantProfitBonus: number;
    cellBankProfitShare: number;
    lootboxCostCoins: number;
    lootboxCostStars: number;
    battleSchedule?: {
        frequency: 'weekly' | 'biweekly' | 'monthly';
        dayOfWeek: number; // 0=Sun, 1=Mon...
        startHourUTC: number;
        durationHours: number;
    };
    battleRewards?: {
        firstPlace: number;
        secondPlace: number;
        thirdPlace: number;
        participant: number;
    };
}

export interface PlayerState {
  balance: number;
  energy: number;
  profitPerHour: number;
  tasksProfitPerHour: number; // Permanent profit from tasks
  referralProfitPerHour: number;
  cellProfitBonus?: number;
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
  suspicionLimitLevel?: number;
  unlockedSkins: string[];
  currentSkinId: string;
  suspicion: number;
  cellId: number | null;
  penaltyLog?: { type: string; timestamp: string; message?: string }[];
  connectedWallet?: string;
}

export interface CellMember {
    id: string;
    name: string;
    profitPerHour: number;
}

export interface Cell {
    id: number;
    name: string;
    owner_id: string;
    invite_code: string;
    members: CellMember[];
    totalProfitPerHour: number;
    informants: Informant[];
    balance: number;
    ticketCount: number;
}

export interface Informant {
    id: number;
    cell_id: number;
    name: string;
    dossier: string;
    specialization: 'finance' | 'counter-intel' | 'logistics';
    created_at: string;
}

// For Leaderboard
export interface LeaderboardPlayer {
    id: string;
    name: string;
    profitPerHour: number;
    leagueName: LocalizedString;
    leagueIconUrl: string;
}

// For Cell Battles
export interface BattleStatus {
    isActive: boolean;
    isParticipant: boolean;
    battleId: number | null;
    timeRemaining: number; // in seconds
    myScore: number;
}

export interface BattleLeaderboardEntry {
    cellId: number;
    cellName: string;
    score: number;
}