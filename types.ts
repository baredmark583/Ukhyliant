

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
  overlayIconUrl?: string;
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
  suspicionModifier: number;
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
    suspicionModifier: number;
}

export interface CoinSkin {
    id: string;
    name: LocalizedString;
    profitBoostPercent: number;
    iconUrl: string;
    boxType: BoxType | 'direct'; // 'direct' for future direct purchase
    chance: number; // Rarity/drop chance
    suspicionModifier: number;
    maxSupply?: number;
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

// --- GLITCH EVENT TRIGGGERS ---
export interface MetaTapTriggerParams {
  targetId: string;
  taps: number;
}

export interface LoginTimeTriggerParams {
  hour: number; // 0-23
  minute: number; // 0-59
}

export interface BalanceEqualsTriggerParams {
  amount: number;
}

export interface UpgradePurchasedTriggerParams {
  upgradeId: string;
}

export type GlitchTrigger =
  | { type: 'meta_tap'; params: MetaTapTriggerParams }
  | { type: 'login_at_time'; params: LoginTimeTriggerParams }
  | { type: 'balance_equals'; params: BalanceEqualsTriggerParams }
  | { type: 'upgrade_purchased'; params: UpgradePurchasedTriggerParams };


export interface GlitchEvent {
    id: string;
    message: LocalizedString;
    code: string;
    reward: Reward;
    trigger: GlitchTrigger;
    isFinal?: boolean;
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
  };
  energy: string;
  coin: string;
  star: string;
  suspicion: string;
  marketCoinBox: string;
  marketStarBox: string;
  soundOn: string;
  soundOff: string;
  secretCodeEntry: string;
  languageSwitcher: string;
}

export interface BattleBoost {
    id: string;
    name: LocalizedString;
    description: LocalizedString;
    cost: number;
    durationSeconds: number;
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
    backgroundAudioUrl?: string;
    finalVideoUrl?: string;
    glitchEvents?: GlitchEvent[];
    uiIcons: UiIcons;
    cellCreationCost: number;
    cellMaxMembers: number;
    cellBattleTicketCost: number;
    informantProfitBonus: number;
    cellBankProfitShare: number;
    lootboxCostCoins: number;
    lootboxCostStars: number;
    battleBoosts: BattleBoost[];
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
  dailyBoostPurchases?: Record<string, number>;
  discoveredGlitchCodes?: string[];
  claimedGlitchCodes?: string[];
  shownGlitchCodes?: string[];
  marketCredits?: number;
  tonWalletAddress?: string;
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
    maxMembers?: number;
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
    activeBoosts: Record<string, { expiresAt: number }>;
}

export interface BattleLeaderboardEntry {
    cellId: number;
    cellName: string;
    score: number;
}

// --- Marketplace Types ---
export interface MarketListing {
  id: number;
  skin_id: string;
  owner_id: string;
  owner_name: string;
  price_stars: number;
  created_at: string;
  is_active: boolean;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';

export interface WithdrawalRequest {
  id: number;
  player_id: string;
  amount_credits: number;
  ton_wallet: string;
  status: WithdrawalStatus;
  created_at: string;
  processed_at?: string;
}