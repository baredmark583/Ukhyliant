import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'https://esm.sh/react';
import { PlayerState, GameConfig, Upgrade, Language, User, DailyTask, Boost, SpecialTask, LeaderboardPlayer, BoxType, CoinSkin, BlackMarketCard, UpgradeCategory, League, Cell, BattleStatus, BattleLeaderboardEntry, Reward, MarketListing, WithdrawalRequest, BattleBoost, VideoSubmission } from '../types';
import { INITIAL_MAX_ENERGY, ENERGY_REGEN_RATE, SAVE_DEBOUNCE_MS, TRANSLATIONS, DEFAULT_COIN_SKIN_ID } from '../constants';
import { logger } from './logger';

declare global {
  interface Window {
    Telegram: {
      WebApp: any;
    };
  }
}

const API_BASE_URL = 'https://ukhyliant-backend.onrender.com';

const API = {
  login: async (tgUser: any, startParam: string | null): Promise<{ user: User, player: PlayerState, config: GameConfig } | null> => {
    logger.action('LOGIN_START', { tgUserId: tgUser?.id, startParam });
    if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not set.");
    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tgUser, startParam }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          logger.error('Login API failed', { status: response.status, error: errorData });
          throw new Error(errorData.error || 'Login failed');
        }
        const data = await response.json();
        logger.action('LOGIN_SUCCESS', { userId: data.user.id });
        return data;
    } catch (err) {
        logger.error('Login API call crashed', { message: (err as Error).message });
        throw err;
    }
  },

  savePlayerState: async (userId: string, state: PlayerState, taps: number): Promise<PlayerState | null> => {
     logger.action('SAVE_STATE_START', { userId, taps });
     if (!API_BASE_URL) return null;
     try {
         const response = await fetch(`${API_BASE_URL}/api/player/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state, taps })
         });
         if (response.ok) {
             if (response.headers.get('Content-Type')?.includes('application/json')) {
                 const updatedState = await response.json();
                 logger.action('SAVE_STATE_SUCCESS', { userId, serverStateUpdated: true });
                 return updatedState;
             } else {
                 logger.action('SAVE_STATE_SUCCESS', { userId, serverStateUpdated: false });
                 return null;
             }
         } else {
            logger.error('Save state API failed', { status: response.status });
            return null;
         }
     } catch (err) {
         logger.error('Save state API crashed', { message: (err as Error).message });
         return null;
     }
  },

  updateUserLanguage: async (userId: string, lang: Language): Promise<void> => {
      logger.action('UPDATE_LANGUAGE', { userId, lang });
      if (!API_BASE_URL) return;
      await fetch(`${API_BASE_URL}/api/user/${userId}/language`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang }),
      });
  },
  
  buyUpgrade: async (userId: string, upgradeId: string): Promise<{player?: PlayerState, error?: string}> => {
    logger.action('API_BUY_UPGRADE', { userId, upgradeId });
    if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not set.");
    const response = await fetch(`${API_BASE_URL}/api/action/buy-upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, upgradeId }),
    });
    const data = await response.json();
    if (!response.ok) {
        logger.error('API_BUY_UPGRADE_FAILED', { error: data.error });
        return { error: data.error || 'Failed to buy upgrade.' };
    }
    logger.info('API_BUY_UPGRADE_SUCCESS', { newBalance: data.player?.balance });
    return data;
  },
  
  buyBoost: async (userId: string, boostId: string): Promise<{player?: PlayerState, error?: string}> => {
    logger.action('API_BUY_BOOST', { userId, boostId });
    if (!API_BASE_URL) return { error: "VITE_API_BASE_URL is not set." };
    try {
        const response = await fetch(`${API_BASE_URL}/api/action/buy-boost`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, boostId }),
        });
        const data = await response.json();
        if (!response.ok) {
            logger.error('API_BUY_BOOST_FAILED', { error: data.error });
            return { error: data.error || 'Failed to buy boost.' };
        }
        logger.info('API_BUY_BOOST_SUCCESS', { newBalance: data.player?.balance });
        return data;
    } catch(e) {
        logger.error('Buy boost API call failed', e);
        return { error: 'Server connection failed while buying boost.' };
    }
  },

  claimDailyTask: async (userId: string, taskId: string, code?: string): Promise<{player?: PlayerState, error?: string}> => {
    logger.action('API_CLAIM_TASK', { userId, taskId, code });
    if (!API_BASE_URL) return { error: "VITE_API_BASE_URL is not set." };
    try {
        const response = await fetch(`${API_BASE_URL}/api/action/claim-task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, taskId, code }),
        });
        const data = await response.json();
        if (!response.ok) {
            logger.error('API_CLAIM_TASK_FAILED', { error: data.error });
            return { error: data.error || 'Failed to claim task.' };
        }
        logger.info('API_CLAIM_TASK_SUCCESS', { taskId });
        return data;
    } catch (e) {
        logger.error('Claim task API call failed', e);
        return { error: 'Server connection failed while claiming task.' };
    }
  },

  createStarInvoice: async(userId: string, payloadType: 'task' | 'lootbox' | 'boost_reset', itemId: string): Promise<{ ok: boolean, invoiceLink?: string, error?: string}> => {
    logger.action('API_CREATE_INVOICE', { userId, payloadType, itemId });
    if (!API_BASE_URL) return { ok: false, error: "API URL is not configured." };
    try {
        const response = await fetch(`${API_BASE_URL}/api/create-star-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, payloadType, itemId }),
        });
        const data = await response.json();
        if (!response.ok) {
            logger.error('API_CREATE_INVOICE_FAILED', { error: data.error });
            return { ok: false, error: data.error || 'Failed to create invoice.' };
        }
        logger.info('API_CREATE_INVOICE_SUCCESS');
        return { ok: true, invoiceLink: data.invoiceLink };
    } catch(e) {
        logger.error("Create invoice API error", e);
        return { ok: false, error: 'Server connection failed.' };
    }
  },

  unlockFreeTask: async (userId: string, taskId: string): Promise<{player: PlayerState, wonItem: any} | null> => {
    logger.action('API_UNLOCK_FREE_TASK', { userId, taskId });
    if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not set.");
    const response = await fetch(`${API_BASE_URL}/api/action/unlock-free-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId }),
    });
    if (!response.ok) return null;
    return response.json();
  },
  
  completeSpecialTask: async (userId: string, taskId: string, code?: string): Promise<{player?: PlayerState, error?: string}> => {
    logger.action('API_COMPLETE_SPECIAL_TASK', { userId, taskId, code });
    if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not set.");
    const response = await fetch(`${API_BASE_URL}/api/action/complete-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId, code }),
    });
     if (!response.ok) return {error: 'Failed to complete task'};
    return response.json();
  },

  claimCombo: async (userId: string): Promise<{player?: PlayerState, reward?: number, error?: string}> => {
    logger.action('API_CLAIM_COMBO', { userId });
    if (!API_BASE_URL) return { error: "VITE_API_BASE_URL is not set." };
    try {
        const response = await fetch(`${API_BASE_URL}/api/action/claim-combo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
        });
        const data = await response.json();
        if (!response.ok) {
            logger.error('API_CLAIM_COMBO_FAILED', { error: data.error });
            return { error: data.error || 'Failed to claim combo reward.' };
        }
        logger.info('API_CLAIM_COMBO_SUCCESS', { reward: data.reward });
        return data;
    } catch (e) {
        logger.error('Claim combo API call failed', e);
        return { error: 'Не удалось подключиться к серверу для получения награды.' };
    }
  },

  claimCipher: async (userId: string, cipher: string): Promise<{player?: PlayerState, reward?: number, error?: string}> => {
    logger.action('API_CLAIM_CIPHER', { userId, cipher });
    if (!API_BASE_URL) return { error: 'VITE_API_BASE_URL is not set.'};
    try {
        const response = await fetch(`${API_BASE_URL}/api/action/claim-cipher`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, cipher }),
        });
        const data = await response.json();
        if (!response.ok) {
            logger.error('API_CLAIM_CIPHER_FAILED', { error: data.error });
            return { error: data.error || 'Incorrect cipher or already claimed.' };
        }
        logger.info('API_CLAIM_CIPHER_SUCCESS', { reward: data.reward });
        return data;
    } catch (e) {
         logger.error('Claim cipher API call failed', e);
         return { error: 'Не удалось подключиться к серверу для проверки шифра.' };
    }
  },

  claimGlitchCode: async (userId: string, code: string): Promise<{player?: PlayerState, reward?: Reward, error?: string}> => {
    logger.action('API_CLAIM_GLITCH', { userId, code });
    if (!API_BASE_URL) return { error: 'VITE_API_BASE_URL is not set.'};
    const response = await fetch(`${API_BASE_URL}/api/action/claim-glitch-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code }),
    });
    const data = await response.json();
    if (!response.ok) {
        logger.error('API_CLAIM_GLITCH_FAILED', { error: data.error });
        return { error: data.error || 'Failed to claim code.' };
    }
    logger.info('API_CLAIM_GLITCH_SUCCESS', { reward: data.reward });
    return data;
  },

  markGlitchShown: async (userId: string, code: string): Promise<{player?: PlayerState, error?: string}> => {
    logger.action('API_MARK_GLITCH_SHOWN', { userId, code });
    if (!API_BASE_URL) return { error: "VITE_API_BASE_URL is not set." };
    const response = await fetch(`${API_BASE_URL}/api/action/mark-glitch-shown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code }),
    });
    if (!response.ok) {
        const data = await response.json();
        logger.error('API_MARK_GLITCH_SHOWN_FAILED', { error: data.error });
        return { error: data.error || 'Failed to mark glitch as shown.' };
    }
    // The server returns { player: PlayerState }. We just return that object.
    // The previous error was wrapping it again: return { player: responseData }.
    return await response.json();
  },

  getLeaderboard: async (): Promise<{topPlayers: LeaderboardPlayer[], totalPlayers: number} | null> => {
    if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not set.");
    const response = await fetch(`${API_BASE_URL}/api/leaderboard`);
    if (!response.ok) return null;
    return response.json();
  },
  
  openLootbox: async (userId: string, boxType: BoxType): Promise<{ player?: PlayerState, wonItem?: any, error?: string }> => {
    logger.action('API_OPEN_LOOTBOX', { userId, boxType });
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    try {
        const response = await fetch(`${API_BASE_URL}/api/action/open-lootbox`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, boxType }),
        });
        const data = await response.json();
        if (!response.ok) {
            logger.error('API_OPEN_LOOTBOX_FAILED', { error: data.error });
            return { error: data.error || 'Failed to open lootbox.' };
        }
        logger.info('API_OPEN_LOOTBOX_SUCCESS', { wonItem: data.wonItem });
        return data;
    } catch(e) {
        logger.error("Lootbox API error", e);
        return { error: 'Server connection failed.' };
    }
  },
  
  syncAfterPayment: async(userId: string): Promise<{ player: PlayerState, wonItem: {type: 'lootbox' | 'task', item: any}, error?: string }> => {
    logger.action('API_SYNC_AFTER_PAYMENT', { userId });
    if (!API_BASE_URL) return { error: "API URL is not configured.", player: null, wonItem: null };
    const response = await fetch(`${API_BASE_URL}/api/sync-after-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    });
    return response.json();
  },

  setSkin: async(userId: string, skinId: string): Promise<{ player?: PlayerState, error?: string }> => {
    logger.action('API_SET_SKIN', { userId, skinId });
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/action/set-skin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, skinId }),
    });
    return response.json();
  },

  createCell: async(userId: string, name: string): Promise<{ player?: PlayerState, cell?: Cell, error?: string }> => {
    logger.action('API_CREATE_CELL', { userId, name });
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/cell/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name }),
    });
    return response.json();
  },

  joinCell: async(userId: string, inviteCode: string): Promise<{ player?: PlayerState, cell?: Cell, error?: string }> => {
    logger.action('API_JOIN_CELL', { userId, inviteCode });
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/cell/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, inviteCode }),
    });
    return response.json();
  },

  getMyCell: async(userId: string): Promise<{ cell?: Cell, error?: string }> => {
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/cell/my-cell?userId=${userId}`);
    return response.json();
  },

  leaveCell: async(userId: string): Promise<{ player?: PlayerState, error?: string }> => {
    logger.action('API_LEAVE_CELL', { userId });
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/cell/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return response.json();
  },

  recruitInformant: async(userId: string): Promise<{ player?: PlayerState, informant?: any, error?: string }> => {
    logger.action('API_RECRUIT_INFORMANT', { userId });
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/informant/recruit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return response.json();
  },

  buyCellTicket: async(userId: string): Promise<{ cell?: Cell, error?: string }> => {
    logger.action('API_BUY_CELL_TICKET', { userId });
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/cell/buy-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return response.json();
  },

  getBattleStatus: async(userId: string): Promise<{ status?: BattleStatus, error?: string }> => {
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/battle/status?userId=${userId}`);
    return response.json();
  },

  joinBattle: async(userId: string): Promise<{ status?: BattleStatus, cell?: Cell, error?: string }> => {
    logger.action('API_JOIN_BATTLE', { userId });
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/battle/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    });
    return response.json();
  },

  activateBattleBoost: async(userId: string, boostId: string): Promise<{ status?: BattleStatus, cell?: Cell, error?: string }> => {
    logger.action('API_ACTIVATE_BATTLE_BOOST', { userId, boostId });
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/cell/activate-boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, boostId }),
    });
    return response.json();
  },

  getBattleLeaderboard: async(): Promise<{ leaderboard?: BattleLeaderboardEntry[], error?: string }> => {
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/battle/leaderboard`);
    return response.json();
  },
  
  listSkinOnMarket: async (userId: string, skinId: string, price: number): Promise<{ error?: string }> => {
    logger.action('API_LIST_SKIN', { userId, skinId, price });
    if (!API_BASE_URL) return { error: "API is not configured" };
    const response = await fetch(`${API_BASE_URL}/api/market/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, skinId, priceStars: price })
    });
    return response.json();
  },
  
  fetchMarketListings: async (): Promise<MarketListing[] | null> => {
    if (!API_BASE_URL) return null;
    const response = await fetch(`${API_BASE_URL}/api/market/listings`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.listings;
  },

  purchaseMarketItemWithCoins: async (userId: string, listingId: number): Promise<{ player?: PlayerState, error?: string }> => {
    logger.action('API_PURCHASE_SKIN', { userId, listingId });
    if (!API_BASE_URL) return { error: "API is not configured" };
    const response = await fetch(`${API_BASE_URL}/api/market/purchase-coin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, listingId })
    });
    return response.json();
  },

  connectWallet: async(userId: string, address: string): Promise<{ player?: PlayerState, error?: string }> => {
    logger.action('API_CONNECT_WALLET', { userId, address });
    if (!API_BASE_URL) return { error: "API is not configured" };
    const response = await fetch(`${API_BASE_URL}/api/wallet/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, walletAddress: address })
    });
    return response.json();
  },

  requestWithdrawal: async(userId: string, amount: number): Promise<{ player?: PlayerState, error?: string }> => {
    logger.action('API_REQUEST_WITHDRAWAL', { userId, amount });
    if (!API_BASE_URL) return { error: "API is not configured" };
    const response = await fetch(`${API_BASE_URL}/api/wallet/request-withdrawal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amountCredits: amount })
    });
    return response.json();
  },
  
  fetchMyWithdrawalRequests: async(userId: string): Promise<WithdrawalRequest[] | null> => {
     if (!API_BASE_URL) return null;
    const response = await fetch(`${API_BASE_URL}/api/wallet/my-requests?userId=${userId}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.requests;
  },

  submitVideoForReview: async (userId: string, url: string): Promise<{ submission?: any, error?: string }> => {
    logger.action('API_SUBMIT_VIDEO', { userId, url });
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/video/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, url })
    });
    return response.json();
  },
  
  getMyVideoSubmissions: async (userId: string): Promise<VideoSubmission[] | null> => {
    if (!API_BASE_URL) return null;
    const response = await fetch(`${API_BASE_URL}/api/video/my-submissions?userId=${userId}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.submissions;
  },
};

// --- AUTH CONTEXT ---
interface AuthContextType {
  user: User | null;
  logout: () => void;
  switchLanguage: (lang: Language) => void;
  isInitializing: boolean;
  isGlitching: boolean;
  setIsGlitching: React.Dispatch<React.SetStateAction<boolean>>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- GAME CONTEXT ---
interface GameContextType {
    playerState: PlayerState | null;
    setPlayerState: React.Dispatch<React.SetStateAction<PlayerState | null>>;
    config: GameConfig | null;
    setConfig: React.Dispatch<React.SetStateAction<GameConfig | null>>;
    purchaseResult: {type: 'lootbox' | 'task', item: any} | null;
    setPurchaseResult: React.Dispatch<React.SetStateAction<{type: 'lootbox' | 'task', item: any} | null>>;
}
const GameContext = createContext<GameContextType | undefined>(undefined);


// --- MAIN APP PROVIDER ---
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [playerState, setPlayerState] = useState<PlayerState | null>(null);
    const [config, setConfig] = useState<GameConfig | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isGlitching, setIsGlitching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [purchaseResult, setPurchaseResult] = useState<{type: 'lootbox' | 'task', item: any} | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                logger.info('App initialization started.');
                if (!window.Telegram?.WebApp?.initData) {
                    throw new Error("Not inside Telegram or initData is missing.");
                }
                window.Telegram.WebApp.ready();
                window.Telegram.WebApp.expand();
                
                const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
                const startParam = window.Telegram.WebApp.initDataUnsafe.start_param || null;

                const loginData = await API.login(tgUser, startParam);
                
                if (loginData && loginData.user && loginData.player && loginData.config) {
                    setUser(loginData.user);
                    setPlayerState(loginData.player);
                    setConfig(loginData.config);
                    logger.info('Initialization successful', { userId: loginData.user.id });
                } else {
                    throw new Error("Failed to get complete login data from backend.");
                }
            } catch (err: any) {
                logger.error("Initialization failed:", { message: err.message });
                setError(err.message || "An unknown error occurred.");
            } finally {
                setIsInitializing(false);
            }
        };
        init();
    }, []);

    const switchLanguage = async (lang: Language) => {
        if (user) {
            logger.action('SWITCH_LANGUAGE', { from: user.language, to: lang });
            if (lang === 'ua' && user.language !== 'ua') {
                setIsGlitching(true);
            }
            setUser({ ...user, language: lang }); // Optimistic update
            await API.updateUserLanguage(user.id, lang);
        }
    };

    const logout = () => {
        logger.action('LOGOUT');
        setUser(null);
        setPlayerState(null);
        setConfig(null);
        window.location.reload();
    };

    if (error && !isInitializing) {
        return React.createElement(
            'div',
            { className: "h-screen w-screen bg-gray-900 flex flex-col justify-center items-center p-4 text-white text-center" },
            `Error: ${error}`
        );
    }

    const authContextValue: AuthContextType = {
        user,
        logout,
        switchLanguage,
        isInitializing,
        isGlitching,
        setIsGlitching
    };

    const gameContextValue: GameContextType = {
        playerState,
        setPlayerState,
        config,
        setConfig,
        purchaseResult,
        setPurchaseResult,
    };
    
    return React.createElement(
        AuthContext.Provider,
        { value: authContextValue },
        React.createElement(
            GameContext.Provider,
            { value: gameContextValue },
            children
        )
    );
};

// --- HOOKS TO USE CONTEXTS ---
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const useGameContext = () => {
    const context = useContext(GameContext);
    if (context === undefined) throw new Error('useGameContext must be used within an AuthProvider');
    return context;
};

export const useTranslation = () => {
    const { user } = useAuth();
    const lang = user?.language || 'en';
    return useCallback((key: keyof (typeof TRANSLATIONS)[typeof lang]) => {
        return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key];
    }, [lang]);
};

// --- MAIN GAME LOGIC HOOK ---
export const useGame = () => {
    const { user } = useAuth();
    const { playerState, setPlayerState, config, setConfig, purchaseResult, setPurchaseResult } = useGameContext();
    const [isTurboActive, setIsTurboActive] = useState(false);
    const [systemMessage, setSystemMessage] = useState<string>('');
    const prevPenaltyLogLength = React.useRef<number | undefined>(undefined);
    const tapsSinceLastSave = React.useRef(0);

    // Persist state to backend with debounce
    useEffect(() => {
        if (!user || !playerState) return;
        const handler = setTimeout(() => {
            const stateToSave = { ...playerState, lastLoginTimestamp: Date.now() };
            const taps = tapsSinceLastSave.current;
            tapsSinceLastSave.current = 0; // Reset after sending
            
            API.savePlayerState(user.id, stateToSave, taps).then(updatedState => {
                // If the server sent back an updated state (e.g., after applying a bonus),
                // update the client's state to match.
                if (updatedState) {
                    setPlayerState(updatedState);
                }
            });
        }, SAVE_DEBOUNCE_MS);
        return () => clearTimeout(handler);
    }, [playerState, user, setPlayerState]);

    const savePlayerState = useCallback(async (stateToSave: PlayerState, taps: number = 0) => {
        if (!user) return null;
        logger.action('SAVE_STATE_MANUAL', { taps, state: stateToSave });
        const updatedState = await API.savePlayerState(user.id, stateToSave, taps);
        if (updatedState) {
            setPlayerState(updatedState);
        }
        return updatedState;
    }, [user, setPlayerState]);
    
    // Penalty detection effect
    useEffect(() => {
        if (!user || !playerState?.penaltyLog) return;
        
        const currentLogLength = playerState.penaltyLog.length;
        
        // Initialize prev length on first run
        if (prevPenaltyLogLength.current === undefined) {
            prevPenaltyLogLength.current = currentLogLength;
            return;
        }

        if (currentLogLength > prevPenaltyLogLength.current) {
            // New penalty detected
            const newPenalty = playerState.penaltyLog[currentLogLength - 1];
            if (newPenalty.message) {
                logger.warn('PENALTY_RECEIVED', { penalty: newPenalty });
                setSystemMessage(newPenalty.message);
            }
        }
        prevPenaltyLogLength.current = currentLogLength;

    }, [playerState?.penaltyLog, user]);

    const effectiveMaxEnergy = useMemo(() => {
        if (!playerState) return INITIAL_MAX_ENERGY;
        // Rebalanced: x2 multiplier for Energy Limit
        const calculatedMax = INITIAL_MAX_ENERGY * Math.pow(2, playerState.energyLimitLevel || 0);
        return Math.min(calculatedMax, 1_000_000_000_000); // Cap at 1 Trillion
    }, [playerState?.energyLimitLevel]);
    
    const effectiveMaxSuspicion = useMemo(() => {
        if (!playerState) return 100;
        return 100 + (playerState.suspicionLimitLevel || 0) * 10;
    }, [playerState?.suspicionLimitLevel]);

    const effectiveCoinsPerTap = useMemo(() => {
        if (!playerState) return 1;
        // Rebalanced: +50% compounding per level for Guru Tapper
        const baseTap = playerState.coinsPerTap || 1;
        const level = playerState.tapGuruLevel || 0;
        const calculatedTap = Math.ceil(baseTap * Math.pow(1.5, level));
        return Math.min(calculatedTap, 1_000_000_000); // Cap at 1 Billion
    }, [playerState?.coinsPerTap, playerState?.tapGuruLevel]);

    // Game loop for energy regen and passive income
    useEffect(() => {
        if (!playerState) return;
        const gameTick = setInterval(() => {
            setPlayerState(p => {
                if (!p) return null;
                const profitPerSecond = (p.profitPerHour || 0) / 3600;
                return {
                    ...p,
                    energy: Math.min(effectiveMaxEnergy, (p.energy || 0) + ENERGY_REGEN_RATE),
                    balance: (Number(p.balance) || 0) + profitPerSecond,
                };
            });
        }, 1000);
        return () => clearInterval(gameTick);
    }, [playerState, setPlayerState, effectiveMaxEnergy]);
    
    // Listener for successful payments
    useEffect(() => {
        const handleInvoiceClosed = async (event: {slug: string, status: 'paid' | 'cancelled' | 'failed' | 'pending'}) => {
            logger.action('INVOICE_CLOSED', event);
            if (event.status === 'paid') {
                if(!user) return;
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                const { player: updatedPlayer, wonItem, error } = await API.syncAfterPayment(user.id);

                if (error) {
                    logger.error("Sync after payment failed:", error);
                    return;
                }

                if(updatedPlayer) setPlayerState(updatedPlayer);
                
                const isValidWonItem = wonItem && wonItem.item && typeof wonItem.item === 'object' && Object.keys(wonItem.item).length > 0;

                if (isValidWonItem) {
                    logger.info('Payment success, item received', { wonItem });
                    setPurchaseResult(wonItem);
                } else if (wonItem) {
                    logger.warn("Received a 'wonItem' from server but its structure is invalid.", wonItem);
                }
                
            } else {
                 window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
        };

        window.Telegram?.WebApp.onEvent('invoiceClosed', handleInvoiceClosed);
        return () => {
            window.Telegram?.WebApp.offEvent('invoiceClosed', handleInvoiceClosed);
        };
    }, [user, setPlayerState, setPurchaseResult]);

    const allUpgrades = useMemo(() => {
        if (!config || !playerState || !playerState.upgrades) return [];
        
        const regularUpgrades = (config.upgrades || []).map(u => ({ ...u, price: Math.floor(u.price * Math.pow(1.15, playerState.upgrades[u.id] || 0)) }));
        const marketCards: (BlackMarketCard & { category: UpgradeCategory, price: number })[] = (config.blackMarketCards || [])
          .filter(c => playerState.upgrades[c.id])
          .map(c => ({
              ...c, 
              category: UpgradeCategory.Special, 
              price: Math.floor((c.price || c.profitPerHour * 10) * Math.pow(1.15, playerState.upgrades[c.id] || 0))
          }));
        
        const combined = [...regularUpgrades, ...marketCards];
        return combined.map(u => ({ ...u, level: playerState.upgrades[u.id] || 0 }));
    }, [config, playerState]);

    const currentLeague = useMemo(() => {
        if (!config || !playerState) return null;
        
        const profit = playerState.profitPerHour || 0;
        const sortedLeagues = [...(config.leagues || [])].sort((a, b) => b.minProfitPerHour - a.minProfitPerHour);
        return sortedLeagues.find(l => profit >= l.minProfitPerHour) || sortedLeagues[sortedLeagues.length - 1] || null;
    }, [config, playerState]);

    const handleTap = useCallback(() => {
        const tapValue = effectiveCoinsPerTap * (isTurboActive ? 5 : 1);
        if (!playerState || playerState.energy < tapValue) return 0;
        
        logger.action('TAP', { value: tapValue });
        tapsSinceLastSave.current += 1;
        setPlayerState(p => p ? {
            ...p,
            balance: p.balance + tapValue,
            energy: Math.max(0, p.energy - tapValue),
            dailyTaps: p.dailyTaps + 1,
        } : null);
        return tapValue;
    }, [playerState, setPlayerState, effectiveCoinsPerTap, isTurboActive]);


    const buyUpgrade = useCallback(async (upgradeId: string): Promise<{ player?: PlayerState, error?: string }> => {
        if (!user) return { error: 'User not authenticated' };
        
        logger.action('BUY_UPGRADE', { upgradeId });
        const result = await API.buyUpgrade(user.id, upgradeId);

        if (result.player) {
            setPlayerState(result.player);
        }

        return result;
    }, [user, setPlayerState]);


    const buyBoost = useCallback(async (boost: Boost) => {
        if (!user) return { error: 'User not found' };
        logger.action('BUY_BOOST', { boostId: boost.id });
        const result = await API.buyBoost(user.id, boost.id);
        if (result.player) {
            setPlayerState(result.player);
            if (boost.id === 'boost_turbo_mode') {
                setIsTurboActive(true);
                setTimeout(() => setIsTurboActive(false), 20000);
            }
        }
        return result;
    }, [user, setPlayerState]);

    const resetBoostLimit = useCallback(async (boost: Boost) => {
        if (!user) return { error: 'User not found' };
        logger.action('RESET_BOOST_LIMIT', { boostId: boost.id });
        const result = await API.createStarInvoice(user.id, 'boost_reset', boost.id);
        if (result.ok && result.invoiceLink) {
            window.Telegram.WebApp.openInvoice(result.invoiceLink);
            return { success: true };
        }
        return { error: result.error || 'Failed to create payment invoice.' };
    }, [user]);

    const claimTaskReward = useCallback(async (task: DailyTask, code?: string) => {
        if (!user) return { error: 'User not found' };
        logger.action('CLAIM_TASK', { taskId: task.id, hasCode: !!code });
        const result = await API.claimDailyTask(user.id, task.id, code);
        if (result.player) {
            setPlayerState(result.player);
        }
        return result;
    }, [user, setPlayerState]);
    
    const purchaseSpecialTask = useCallback(async (task: SpecialTask) => {
        if (!user) return { error: 'User not found' };
        logger.action('PURCHASE_SPECIAL_TASK', { taskId: task.id, price: task.priceStars });
        
        if (task.priceStars > 0) {
            const result = await API.createStarInvoice(user.id, 'task', task.id);
            if (result.ok && result.invoiceLink) {
                // The global 'invoiceClosed' event listener will handle the success case.
                window.Telegram.WebApp.openInvoice(result.invoiceLink);
                return { success: true };
            }
            return { error: result.error || 'Failed to create payment invoice.' };
        } else {
            // Free task - unlock immediately
            const result = await API.unlockFreeTask(user.id, task.id);
            if(result?.player) {
                setPlayerState(result.player);
                if (result.wonItem) setPurchaseResult(result.wonItem);
                return { success: true };
            }
            return { error: 'Failed to unlock free task.' };
        }
    }, [user, setPlayerState, setPurchaseResult]);

    const completeSpecialTask = useCallback(async (task: SpecialTask, code?: string) => {
        if (!user) return { error: "User not found" };
        logger.action('COMPLETE_SPECIAL_TASK', { taskId: task.id, hasCode: !!code });
        const result = await API.completeSpecialTask(user.id, task.id, code);
        if (result.player) {
            setPlayerState(result.player);
        }
        return result;
    }, [user, setPlayerState]);
    
    const claimDailyCombo = useCallback(async () => {
        if (!user) return { error: 'User not found' };
        logger.action('CLAIM_COMBO');
        const result = await API.claimCombo(user.id);
        if(result.player) setPlayerState(result.player);
        return result;
    }, [user, setPlayerState]);
    
    const claimDailyCipher = useCallback(async (cipher: string) => {
        if (!user) return { error: 'User not found' };
        logger.action('CLAIM_CIPHER', { cipher });
        const result = await API.claimCipher(user.id, cipher);
        if(result.player) setPlayerState(result.player);
        return result;
    }, [user, setPlayerState]);

    const claimGlitchCode = useCallback(async (code: string) => {
        if (!user) return { error: 'User not found' };
        logger.action('CLAIM_GLITCH_CODE', { code });
        const result = await API.claimGlitchCode(user.id, code);
        if(result.player) setPlayerState(result.player);
        return result;
    }, [user, setPlayerState]);

    const markGlitchAsShown = useCallback(async (code: string) => {
        if (!user) return;
        
        logger.action('MARK_GLITCH_SHOWN', { code });
        // Optimistic update
        setPlayerState(p => {
            if (!p) return null;
            const shownCodes = new Set(p.shownGlitchCodes || []);
            if (shownCodes.has(code)) return p;
            shownCodes.add(code);
            return { ...p, shownGlitchCodes: Array.from(shownCodes) };
        });

        const result = await API.markGlitchShown(user.id, code);
        if (result.player) {
            setPlayerState(result.player);
        } else if (result.error) {
            logger.error("Failed to mark glitch as shown on server:", result.error);
            // Optional: Add logic here to roll back the optimistic update if needed
        }
    }, [user, setPlayerState]);

    const getLeaderboard = useCallback(() => API.getLeaderboard(), []);
    
    const openCoinLootbox = useCallback(async (boxType: 'coin') => {
        if (!user) return { error: 'User not found' };
        logger.action('OPEN_COIN_LOOTBOX', { boxType });
        const result = await API.openLootbox(user.id, boxType);
        if (result.player) {
            setPlayerState(result.player);
        }

        const item = result.wonItem;
        const isValidItem = item && typeof item === 'object' && Object.keys(item).length > 0;

        if (isValidItem) {
            setPurchaseResult({type: 'lootbox', item: item });
        } else if (item) {
            logger.warn("Received an invalid item from coin lootbox.", item);
        }
        return result;
    }, [user, setPlayerState, setPurchaseResult]);

    const purchaseLootboxWithStars = useCallback(async (boxType: 'star') => {
        if (!user) return { error: 'User not found' };
        logger.action('PURCHASE_STAR_LOOTBOX', { boxType });
        const result = await API.createStarInvoice(user.id, 'lootbox', boxType);
        if (result.ok && result.invoiceLink) {
             // The global 'invoiceClosed' event listener will handle the success case.
            window.Telegram.WebApp.openInvoice(result.invoiceLink);
            return { success: true };
        }
        return { error: result.error || 'Failed to start payment.' };
    }, [user]);

    const setSkin = useCallback(async (skinId: string) => {
        if (!user) return;
        logger.action('SET_SKIN', { skinId });
        const result = await API.setSkin(user.id, skinId);
        if (result.player) {
            setPlayerState(result.player);
        }
    }, [user, setPlayerState]);

    const createCell = useCallback(async (name: string) => {
        if (!user) return { error: 'User not found' };
        logger.action('CREATE_CELL', { name });
        const result = await API.createCell(user.id, name);
        if (result.player) setPlayerState(result.player);
        return result;
    }, [user, setPlayerState]);

    const joinCell = useCallback(async (inviteCode: string) => {
        if (!user) return { error: 'User not found' };
        logger.action('JOIN_CELL', { inviteCode });
        const result = await API.joinCell(user.id, inviteCode);
        if (result.player) setPlayerState(result.player);
        return result;
    }, [user, setPlayerState]);

    const getMyCell = useCallback(async () => {
        if (!user) return { error: 'User not found' };
        return await API.getMyCell(user.id);
    }, [user]);

    const leaveCell = useCallback(async () => {
        if (!user) return { error: 'User not found' };
        logger.action('LEAVE_CELL');
        const result = await API.leaveCell(user.id);
        if (result.player) setPlayerState(result.player);
        return result;
    }, [user, setPlayerState]);

     const recruitInformant = useCallback(async () => {
        if (!user) return { error: 'User not found' };
        logger.action('RECRUIT_INFORMANT');
        const result = await API.recruitInformant(user.id);
        if (result.player) setPlayerState(result.player);
        return result;
    }, [user, setPlayerState]);
    
     const buyCellTicket = useCallback(async () => {
        if (!user) return { error: 'User not found' };
        logger.action('BUY_CELL_TICKET');
        return await API.buyCellTicket(user.id);
    }, [user]);

    const getBattleStatus = useCallback(async () => {
        if (!user) return { error: "User not found" };
        return await API.getBattleStatus(user.id);
    }, [user]);

    const joinBattle = useCallback(async () => {
        if (!user) return { error: 'User not found' };
        logger.action('JOIN_BATTLE');
        return await API.joinBattle(user.id);
    }, [user]);

    const activateBattleBoost = useCallback(async (boostId: string) => {
        if (!user) return { error: "User not found" };
        logger.action('ACTIVATE_BATTLE_BOOST', { boostId });
        return await API.activateBattleBoost(user.id, boostId);
    }, [user]);

    const getBattleLeaderboard = useCallback(async () => {
        return await API.getBattleLeaderboard();
    }, []);

    const listSkinOnMarket = useCallback(async (skinId: string, price: number) => {
        if (!user) return { error: 'User not found' };
        logger.action('LIST_SKIN', { skinId, price });
        return await API.listSkinOnMarket(user.id, skinId, price);
    }, [user]);

    const fetchMarketListings = useCallback(async () => {
        return await API.fetchMarketListings();
    }, []);

    const purchaseMarketItem = useCallback(async (listingId: number) => {
        if (!user) return { error: 'User not found' };
        logger.action('PURCHASE_SKIN', { listingId });
        
        const result = await API.purchaseMarketItemWithCoins(user.id, listingId);
        
        if (result.player) {
            setPlayerState(result.player);
            if (result.player.lastPurchaseResult) {
                setPurchaseResult(result.player.lastPurchaseResult);
            }
        }
        return result;
    }, [user, setPlayerState, setPurchaseResult]);

    const connectWallet = useCallback(async (address: string) => {
        if (!user) return { error: 'User not found' };
        logger.action('CONNECT_WALLET', { address });
        const result = await API.connectWallet(user.id, address);
        if (result.player) {
            setPlayerState(result.player);
        }
        return result;
    }, [user, setPlayerState]);

    const requestWithdrawal = useCallback(async (amount: number) => {
        if (!user) return { error: 'User not found' };
        logger.action('REQUEST_WITHDRAWAL', { amount });
        const result = await API.requestWithdrawal(user.id, amount);
        if (result.player) {
            setPlayerState(result.player);
        }
        return result;
    }, [user, setPlayerState]);

    const fetchMyWithdrawalRequests = useCallback(async () => {
        if (!user) return null;
        return await API.fetchMyWithdrawalRequests(user.id);
    }, [user]);

    const submitVideoForReview = useCallback(async (url: string) => {
        if (!user) return { error: 'User not found' };
        logger.action('SUBMIT_VIDEO', { url });
        return await API.submitVideoForReview(user.id, url);
    }, [user]);

    const getMyVideoSubmissions = useCallback(async () => {
        if (!user) return null;
        return await API.getMyVideoSubmissions(user.id);
    }, [user]);

    return {
        playerState,
        setPlayerState,
        config,
        setConfig,
        purchaseResult,
        setPurchaseResult,
        isTurboActive,
        systemMessage,
        setSystemMessage,
        effectiveMaxEnergy,
        effectiveMaxSuspicion,
        allUpgrades,
        currentLeague,
        savePlayerState,
        handleTap,
        buyUpgrade,
        buyBoost,
        resetBoostLimit,
        claimTaskReward,
        purchaseSpecialTask,
        completeSpecialTask,
        claimDailyCombo,
        claimDailyCipher,
        claimGlitchCode,
        markGlitchAsShown,
        getLeaderboard,
        openCoinLootbox,
        purchaseLootboxWithStars,
        setSkin,
        createCell,
        joinCell,
        getMyCell,
        leaveCell,
        recruitInformant,
        buyCellTicket,
        getBattleStatus,
        joinBattle,
        activateBattleBoost,
        getBattleLeaderboard,
        listSkinOnMarket,
        fetchMarketListings,
        purchaseMarketItem,
        connectWallet,
        requestWithdrawal,
        fetchMyWithdrawalRequests,
        submitVideoForReview,
        getMyVideoSubmissions,
    };
};