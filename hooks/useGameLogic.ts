

import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { PlayerState, GameConfig, Upgrade, Language, User, DailyTask, Boost, SpecialTask, LeaderboardPlayer, BoxType, CoinSkin, BlackMarketCard, UpgradeCategory, League, Cell, BattleStatus, BattleLeaderboardEntry } from '../types';
import { INITIAL_MAX_ENERGY, ENERGY_REGEN_RATE, SAVE_DEBOUNCE_MS, TRANSLATIONS, DEFAULT_COIN_SKIN_ID } from '../constants';

declare global {
  interface Window {
    Telegram: {
      WebApp: any;
    };
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const API = {
  login: async (tgUser: any, startParam: string | null): Promise<{ user: User, player: PlayerState, config: GameConfig } | null> => {
    if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not set.");
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tgUser, startParam }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Login failed');
    }
    return response.json();
  },

  savePlayerState: async (userId: string, state: PlayerState, taps: number): Promise<PlayerState | null> => {
     if (!API_BASE_URL) return null;
     const response = await fetch(`${API_BASE_URL}/api/player/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, taps })
     });
     // If the server sends back an updated state, parse and return it.
     if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
         return response.json();
     }
     return null; // Otherwise, return null
  },

  updateUserLanguage: async (userId: string, lang: Language): Promise<void> => {
      if (!API_BASE_URL) return;
      await fetch(`${API_BASE_URL}/api/user/${userId}/language`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang }),
      });
  },
  
  buyUpgrade: async (userId: string, upgradeId: string): Promise<{player?: PlayerState, error?: string}> => {
    if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not set.");
    const response = await fetch(`${API_BASE_URL}/api/action/buy-upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, upgradeId }),
    });
    const data = await response.json();
    if (!response.ok) return { error: data.error || 'Failed to buy upgrade.' };
    return data;
  },
  
  buyBoost: async (userId: string, boostId: string): Promise<{player?: PlayerState, error?: string}> => {
    if (!API_BASE_URL) return { error: "VITE_API_BASE_URL is not set." };
    try {
        const response = await fetch(`${API_BASE_URL}/api/action/buy-boost`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, boostId }),
        });
        const data = await response.json();
        if (!response.ok) {
            return { error: data.error || 'Failed to buy boost.' };
        }
        return data;
    } catch(e) {
        console.error('Buy boost API call failed', e);
        return { error: 'Server connection failed while buying boost.' };
    }
  },

  claimDailyTask: async (userId: string, taskId: string, code?: string): Promise<{player?: PlayerState, error?: string}> => {
    if (!API_BASE_URL) return { error: "VITE_API_BASE_URL is not set." };
    try {
        const response = await fetch(`${API_BASE_URL}/api/action/claim-task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, taskId, code }),
        });
        const data = await response.json();
        if (!response.ok) {
            return { error: data.error || 'Failed to claim task.' };
        }
        return data;
    } catch (e) {
        console.error('Claim task API call failed', e);
        return { error: 'Server connection failed while claiming task.' };
    }
  },

  createInvoice: async (userId: string, taskId: string): Promise<{ok: boolean, invoiceLink?: string, error?: string}> => {
    if (!API_BASE_URL) return {ok: false, error: "VITE_API_BASE_URL is not set."};
    const response = await fetch(`${API_BASE_URL}/api/create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId }),
    });
    return response.json();
  },

  unlockFreeTask: async (userId: string, taskId: string): Promise<{player: PlayerState, wonItem: any} | null> => {
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
    if (!API_BASE_URL) return { error: "VITE_API_BASE_URL is not set." };
    try {
        const response = await fetch(`${API_BASE_URL}/api/action/claim-combo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
        });
        const data = await response.json();
        if (!response.ok) {
            return { error: data.error || 'Failed to claim combo reward.' };
        }
        return data;
    } catch (e) {
        console.error('Claim combo API call failed', e);
        return { error: 'Не удалось подключиться к серверу для получения награды.' };
    }
  },

  claimCipher: async (userId: string, cipher: string): Promise<{player?: PlayerState, reward?: number, error?: string}> => {
    if (!API_BASE_URL) return { error: 'VITE_API_BASE_URL is not set.'};
    try {
        const response = await fetch(`${API_BASE_URL}/api/action/claim-cipher`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, cipher }),
        });
        const data = await response.json();
        if (!response.ok) {
            return { error: data.error || 'Incorrect cipher or already claimed.' };
        }
        return data;
    } catch (e) {
         console.error('Claim cipher API call failed', e);
         return { error: 'Не удалось подключиться к серверу для проверки шифра.' };
    }
  },

  getLeaderboard: async (): Promise<{topPlayers: LeaderboardPlayer[], totalPlayers: number} | null> => {
    if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not set.");
    const response = await fetch(`${API_BASE_URL}/api/leaderboard`);
    if (!response.ok) return null;
    return response.json();
  },
  
  openLootbox: async (userId: string, boxType: BoxType): Promise<{ player?: PlayerState, wonItem?: any, error?: string }> => {
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    try {
        const response = await fetch(`${API_BASE_URL}/api/action/open-lootbox`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, boxType }),
        });
        const data = await response.json();
        if (!response.ok) return { error: data.error || 'Failed to open lootbox.' };
        return data;
    } catch(e) {
        console.error("Lootbox API error", e);
        return { error: 'Server connection failed.' };
    }
  },
  
  createStarInvoice: async(userId: string, payloadType: 'task' | 'lootbox', itemId: string): Promise<{ ok: boolean, invoiceLink?: string, error?: string}> => {
    if (!API_BASE_URL) return { ok: false, error: "API URL is not configured." };
    try {
        const response = await fetch(`${API_BASE_URL}/api/create-star-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, payloadType, itemId }),
        });
        const data = await response.json();
        if (!response.ok) return { ok: false, error: data.error || 'Failed to create invoice.' };
        return { ok: true, invoiceLink: data.invoiceLink };
    } catch(e) {
        console.error("Create invoice API error", e);
        return { ok: false, error: 'Server connection failed.' };
    }
  },

  syncAfterPayment: async(userId: string): Promise<{ player: PlayerState, wonItem: any, error?: string }> => {
    if (!API_BASE_URL) return { error: "API URL is not configured.", player: null, wonItem: null };
    const response = await fetch(`${API_BASE_URL}/api/sync-after-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    });
    return response.json();
  },

  setSkin: async(userId: string, skinId: string): Promise<{ player?: PlayerState, error?: string }> => {
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/action/set-skin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, skinId }),
    });
    return response.json();
  },

  createCell: async(userId: string, name: string): Promise<{ player?: PlayerState, cell?: Cell, error?: string }> => {
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/cell/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name }),
    });
    return response.json();
  },

  joinCell: async(userId: string, inviteCode: string): Promise<{ player?: PlayerState, cell?: Cell, error?: string }> => {
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
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/cell/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return response.json();
  },

  recruitInformant: async(userId: string): Promise<{ player?: PlayerState, informant?: any, error?: string }> => {
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/informant/recruit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return response.json();
  },

  buyCellTicket: async(userId: string): Promise<{ cell?: Cell, error?: string }> => {
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/cell/buy-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return response.json();
  },

  getOminousWarning: async(lang: Language): Promise<{message: string}> => {
    if (!API_BASE_URL) return { message: 'The system is silent.' };
    try {
        const response = await fetch(`${API_BASE_URL}/api/ominous-warning?lang=${lang}`);
        if (!response.ok) return { message: 'Transmission error.' };
        return response.json();
    } catch (e) {
        return { message: 'Connection lost.' };
    }
  },

  getBattleStatus: async(userId: string): Promise<{ status?: BattleStatus, error?: string }> => {
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/battle/status?userId=${userId}`);
    return response.json();
  },

  joinBattle: async(userId: string): Promise<{ status?: BattleStatus, cell?: Cell, error?: string }> => {
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/battle/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    });
    return response.json();
  },

  getBattleLeaderboard: async(): Promise<{ leaderboard?: BattleLeaderboardEntry[], error?: string }> => {
    if (!API_BASE_URL) return { error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/api/battle/leaderboard`);
    return response.json();
  },

  // Admin APIs
  getCellAnalytics: async (): Promise<any> => {
    if (!API_BASE_URL) throw new Error("API URL is not configured.");
    const response = await fetch(`${API_BASE_URL}/admin/api/cell-analytics`);
    return response.json();
  },

  forceStartBattle: async (): Promise<{ ok: boolean, error?: string }> => {
    if (!API_BASE_URL) return { ok: false, error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/admin/api/battle/force-start`, { method: 'POST' });
    return response.json();
  },

  forceEndBattle: async (): Promise<{ ok: boolean, error?: string }> => {
    if (!API_BASE_URL) return { ok: false, error: "API URL is not configured." };
    const response = await fetch(`${API_BASE_URL}/admin/api/battle/force-end`, { method: 'POST' });
    return response.json();
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
    purchaseResult: any | null;
    setPurchaseResult: React.Dispatch<React.SetStateAction<any | null>>;
}
const GameContext = createContext<GameContextType | undefined>(undefined);


// --- MAIN APP PROVIDER ---
export const AuthProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
    const [user, setUser] = useState<User | null>(null);
    const [playerState, setPlayerState] = useState<PlayerState | null>(null);
    const [config, setConfig] = useState<GameConfig | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isGlitching, setIsGlitching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [purchaseResult, setPurchaseResult] = useState<any | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
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
                } else {
                    throw new Error("Failed to get complete login data from backend.");
                }
            } catch (err: any) {
                console.error("Initialization failed:", err);
                setError(err.message || "An unknown error occurred.");
            } finally {
                setIsInitializing(false);
            }
        };
        init();
    }, []);

    const switchLanguage = async (lang: Language) => {
        if (user) {
            if (lang === 'ua' && user.language !== 'ua') {
                setIsGlitching(true);
            }
            setUser({ ...user, language: lang }); // Optimistic update
            await API.updateUserLanguage(user.id, lang);
        }
    };

    const logout = () => {
        setUser(null);
        setPlayerState(null);
        setConfig(null);
        window.location.reload();
    };

    if (error && !isInitializing) {
        return React.createElement('div', { className: 'h-screen w-screen bg-gray-900 flex flex-col justify-center items-center p-4 text-white text-center' }, `Error: ${error}`);
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
    
    return React.createElement(AuthContext.Provider, { value: authContextValue },
        React.createElement(GameContext.Provider, { value: gameContextValue }, children)
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

    // Penalty detection effect
    useEffect(() => {
        if (!user || !playerState) return;
        
        const currentLogLength = playerState.penaltyLog?.length || 0;
        
        // Initialize prev length on first run
        if (prevPenaltyLogLength.current === undefined) {
            prevPenaltyLogLength.current = currentLogLength;
            return;
        }

        if (currentLogLength > prevPenaltyLogLength.current) {
            // New penalty detected
            API.getOminousWarning(user.language).then(data => {
                setSystemMessage(data.message);
            });
        }
        prevPenaltyLogLength.current = currentLogLength;

    }, [playerState, user?.language]);

    const effectiveMaxEnergy = useMemo(() => {
        if (!playerState) return INITIAL_MAX_ENERGY;
        return INITIAL_MAX_ENERGY + (playerState.energyLimitLevel || 0) * 500;
    }, [playerState?.energyLimitLevel]);

    const effectiveCoinsPerTap = useMemo(() => {
        if (!playerState) return 1;
        return playerState.coinsPerTap + (playerState.tapGuruLevel || 0);
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
                    energy: Math.min(effectiveMaxEnergy, p.energy + ENERGY_REGEN_RATE),
                    balance: Number(p.balance) + profitPerSecond,
                };
            });
        }, 1000);
        return () => clearInterval(gameTick);
    }, [playerState, setPlayerState, effectiveMaxEnergy]);
    
    // Listener for successful payments
    useEffect(() => {
        const handleInvoiceClosed = async (event: {slug: string, status: 'paid' | 'cancelled' | 'failed' | 'pending'}) => {
            if (event.status === 'paid') {
                if(!user) return;
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                const { player: updatedPlayer, wonItem, error } = await API.syncAfterPayment(user.id);

                if (error) {
                    // Handle error case, maybe show a notification
                    console.error("Sync after payment failed:", error);
                    return;
                }

                if(updatedPlayer) setPlayerState(updatedPlayer);

                if (wonItem) {
                    setPurchaseResult(wonItem);
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
        const regularUpgrades = (config?.upgrades || []).map(u => ({...u, price: Math.floor(u.price * Math.pow(1.15, playerState?.upgrades[u.id] || 0))}));
        const marketCards: (BlackMarketCard & { category: UpgradeCategory, price: number })[] = (config?.blackMarketCards || [])
          .filter(c => playerState?.upgrades[c.id])
          .map(c => ({
              ...c, 
              category: UpgradeCategory.Special, 
              price: Math.floor((c.price || c.profitPerHour * 10) * Math.pow(1.15, playerState?.upgrades[c.id] || 0))
          }));
        
        const combined = [...regularUpgrades, ...marketCards];
        return combined.map(u => ({...u, level: playerState?.upgrades[u.id] || 0}));

    }, [config?.upgrades, config?.blackMarketCards, playerState?.upgrades]);

    const currentLeague = useMemo(() => {
        const profit = playerState?.profitPerHour || 0;
        const sortedLeagues = [...(config?.leagues || [])].sort((a, b) => b.minProfitPerHour - a.minProfitPerHour);
        return sortedLeagues.find(l => profit >= l.minProfitPerHour) || sortedLeagues[sortedLeagues.length - 1] || null;
    }, [playerState?.profitPerHour, config?.leagues]);

    const handleTap = useCallback(() => {
        if (!playerState || playerState.energy < 1) return 0;
        const tapValue = effectiveCoinsPerTap * (isTurboActive ? 5 : 1);
        tapsSinceLastSave.current += tapValue;
        setPlayerState(p => p ? {
            ...p,
            balance: p.balance + tapValue,
            energy: Math.max(0, p.energy - 1),
            dailyTaps: p.dailyTaps + 1,
        } : null);
        return tapValue;
    }, [playerState, setPlayerState, effectiveCoinsPerTap, isTurboActive]);


    const buyUpgrade = useCallback(async (upgradeId: string) => {
        if (!user) return null;
        const result = await API.buyUpgrade(user.id, upgradeId);
        if (result.player) {
            setPlayerState(result.player);
            return result.player;
        }
        return null;
    }, [user, setPlayerState]);

    const buyBoost = useCallback(async (boost: Boost) => {
        if (!user) return { error: 'User not found' };
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

    const claimTaskReward = useCallback(async (task: DailyTask, code?: string) => {
        if (!user) return { error: 'User not found' };
        const result = await API.claimDailyTask(user.id, task.id, code);
        if (result.player) {
            setPlayerState(result.player);
        }
        return result;
    }, [user, setPlayerState]);
    
    const purchaseSpecialTask = useCallback(async (task: SpecialTask) => {
        if (!user) return { error: 'User not found' };
        
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
        const result = await API.completeSpecialTask(user.id, task.id, code);
        if (result.player) {
            setPlayerState(result.player);
        }
        return result;
    }, [user, setPlayerState]);
    
    const claimDailyCombo = useCallback(async () => {
        if (!user) return { error: 'User not found' };
        const result = await API.claimCombo(user.id);
        if(result.player) setPlayerState(result.player);
        return result;
    }, [user, setPlayerState]);
    
    const claimDailyCipher = useCallback(async (cipher: string) => {
        if (!user) return { error: 'User not found' };
        const result = await API.claimCipher(user.id, cipher);
        if(result.player) setPlayerState(result.player);
        return result;
    }, [user, setPlayerState]);

    const getLeaderboard = useCallback(() => API.getLeaderboard(), []);
    
    const openCoinLootbox = useCallback(async (boxType: 'coin') => {
        if (!user) return { error: 'User not found' };
        const result = await API.openLootbox(user.id, boxType);
        if (result.player) {
            setPlayerState(result.player);
        }
        return result;
    }, [user, setPlayerState]);

    const purchaseLootboxWithStars = useCallback(async (boxType: 'star') => {
        if (!user) return { error: 'User not found' };
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
        const result = await API.setSkin(user.id, skinId);
        if (result.player) {
            setPlayerState(result.player);
        }
    }, [user, setPlayerState]);

    const createCell = useCallback(async (name: string) => {
        if (!user) return { error: 'User not found' };
        const result = await API.createCell(user.id, name);
        if (result.player) setPlayerState(result.player);
        return result;
    }, [user, setPlayerState]);

    const joinCell = useCallback(async (inviteCode: string) => {
        if (!user) return { error: 'User not found' };
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
        const result = await API.leaveCell(user.id);
        if (result.player) setPlayerState(result.player);
        return result;
    }, [user, setPlayerState]);

     const recruitInformant = useCallback(async () => {
        if (!user) return { error: 'User not found' };
        const result = await API.recruitInformant(user.id);
        if (result.player) setPlayerState(result.player);
        return result;
    }, [user, setPlayerState]);
    
     const buyCellTicket = useCallback(async () => {
        if (!user) return { error: 'User not found' };
        return await API.buyCellTicket(user.id);
    }, [user]);

    const getBattleStatus = useCallback(async () => {
        if (!user) return { error: "User not found" };
        return await API.getBattleStatus(user.id);
    }, [user]);

    const joinBattle = useCallback(async () => {
        if (!user) return { error: "User not found" };
        return await API.joinBattle(user.id);
    }, [user]);

    const getBattleLeaderboard = useCallback(() => API.getBattleLeaderboard(), []);

    const triggerOminousWarning = useCallback(async () => {
        if (!user) return;
        const data = await API.getOminousWarning(user.language);
        setSystemMessage(data.message);
    }, [user, setSystemMessage]);

    return {
        playerState,
        config,
        setPlayerState,
        setConfig,
        handleTap,
        buyUpgrade,
        allUpgrades,
        currentLeague,
        buyBoost,
        claimTaskReward,
        purchaseSpecialTask,
        completeSpecialTask,
        claimDailyCombo,
        claimDailyCipher,
        getLeaderboard,
        openCoinLootbox,
        purchaseLootboxWithStars,
        setSkin,
        isTurboActive,
        effectiveMaxEnergy,
        effectiveCoinsPerTap,
        createCell,
        joinCell,
        getMyCell,
        leaveCell,
        recruitInformant,
        buyCellTicket,
        systemMessage,
        setSystemMessage,
        triggerOminousWarning,
        purchaseResult,
        setPurchaseResult,
        getBattleStatus,
        joinBattle,
        getBattleLeaderboard,
        // Admin functions
        getCellAnalytics: API.getCellAnalytics,
        forceStartBattle: API.forceStartBattle,
        forceEndBattle: API.forceEndBattle,
    };
};