
import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { PlayerState, GameConfig, Upgrade, Language, User, DailyTask, Boost, SpecialTask, LeaderboardPlayer } from '../types';
import { LEAGUES, INITIAL_MAX_ENERGY, ENERGY_REGEN_RATE, SAVE_DEBOUNCE_MS, TRANSLATIONS } from '../constants';

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

  savePlayerState: async (userId: string, state: PlayerState): Promise<void> => {
     if (!API_BASE_URL) return;
     await fetch(`${API_BASE_URL}/api/player/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
     });
  },

  updateUserLanguage: async (userId: string, lang: Language): Promise<void> => {
      if (!API_BASE_URL) return;
      await fetch(`${API_BASE_URL}/api/user/${userId}/language`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang }),
      });
  },
  
  buyUpgrade: async (userId: string, upgradeId: string): Promise<PlayerState | null> => {
    if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not set.");
    const response = await fetch(`${API_BASE_URL}/api/action/buy-upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, upgradeId }),
    });
    if (!response.ok) return null;
    return response.json();
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
        return { player: data };
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
    if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not set.");
    const response = await fetch(`${API_BASE_URL}/api/create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId }),
    });
    return response.json();
  },

  unlockFreeTask: async (userId: string, taskId: string): Promise<PlayerState | null> => {
    if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not set.");
    const response = await fetch(`${API_BASE_URL}/api/action/unlock-free-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId }),
    });
    if (!response.ok) return null;
    return response.json();
  },
  
  completeSpecialTask: async (userId: string, taskId: string, code?: string): Promise<PlayerState | null> => {
    if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not set.");
    const response = await fetch(`${API_BASE_URL}/api/action/complete-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId, code }),
    });
     if (!response.ok) return null;
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
    if (!API_BASE_URL) return { error: "VITE_API_BASE_URL is not set." };
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
};

// --- AUTH CONTEXT ---
interface AuthContextType {
  user: User | null;
  logout: () => void;
  switchLanguage: (lang: Language) => void;
  isInitializing: boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- GAME CONTEXT ---
interface GameContextType {
    playerState: PlayerState | null;
    setPlayerState: React.Dispatch<React.SetStateAction<PlayerState | null>>;
    config: GameConfig | null;
    setConfig: React.Dispatch<React.SetStateAction<GameConfig | null>>;
}
const GameContext = createContext<GameContextType | undefined>(undefined);


// --- MAIN APP PROVIDER ---
export const AuthProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
    const [user, setUser] = useState<User | null>(null);
    const [playerState, setPlayerState] = useState<PlayerState | null>(null);
    const [config, setConfig] = useState<GameConfig | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
        isInitializing
    };

    const gameContextValue: GameContextType = {
        playerState,
        setPlayerState,
        config,
        setConfig
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
    const { playerState, setPlayerState, config } = useGameContext();
    const [isTurboActive, setIsTurboActive] = useState(false);

    // Persist state to backend with debounce
    useEffect(() => {
        if (!user || !playerState) return;
        const handler = setTimeout(() => {
            const stateToSave = { ...playerState, lastLoginTimestamp: Date.now() };
            API.savePlayerState(user.id, stateToSave);
        }, SAVE_DEBOUNCE_MS);
        return () => clearTimeout(handler);
    }, [playerState, user]);

    const effectiveMaxEnergy = useMemo(() => {
        if (!playerState) return INITIAL_MAX_ENERGY;
        return INITIAL_MAX_ENERGY + (playerState.energyLimitLevel || 0) * 500;
    }, [playerState?.energyLimitLevel]);

    const effectiveCoinsPerTap = useMemo(() => {
        if (!playerState) return 1;
        return playerState.coinsPerTap + (playerState.tapGuruLevel || 0);
    }, [playerState?.coinsPerTap, playerState?.tapGuruLevel]);

    // Game loop for energy regen
    useEffect(() => {
        if (!playerState) return;
        const gameTick = setInterval(() => {
            setPlayerState(p => p ? { ...p, energy: Math.min(effectiveMaxEnergy, p.energy + ENERGY_REGEN_RATE) } : null);
        }, 1000);
        return () => clearInterval(gameTick);
    }, [playerState, setPlayerState, effectiveMaxEnergy]);
    
    // Listener for successful payments
    useEffect(() => {
        const handleInvoiceClosed = (event: {slug: string, status: 'paid' | 'cancelled' | 'failed' | 'pending'}) => {
            if (event.status === 'paid') {
                // Payment was successful, reload data to reflect the purchase
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                window.location.reload();
            } else {
                 window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
        };

        window.Telegram?.WebApp.onEvent('invoiceClosed', handleInvoiceClosed);
        return () => {
            window.Telegram?.WebApp.offEvent('invoiceClosed', handleInvoiceClosed);
        };
    }, []);
    
    const allUpgrades = useMemo((): (Upgrade & {level: number})[] => {
        if (!config || !playerState) return [];
        return (config.upgrades || []).map(u => {
            const level = playerState.upgrades?.[u.id] || 0;
            const basePrice = u.price ?? 0;
            const baseProfit = u.profitPerHour ?? 0;
            return {
                ...u,
                level,
                price: Math.floor(basePrice * Math.pow(1.15, level)),
                profitPerHour: baseProfit * (level > 0 ? Math.pow(1.07, level) : 1),
            };
        });
    }, [playerState, config]);

    const buyUpgrade = useCallback(async (upgradeId: string): Promise<PlayerState | null> => {
        if (!user) return null;

        const upgrade = allUpgrades.find(u => u.id === upgradeId);
        if (!upgrade || !playerState || playerState.balance < upgrade.price) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            return null;
        }

        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        
        const updatedPlayerState = await API.buyUpgrade(user.id, upgradeId);
        
        if (updatedPlayerState) {
            setPlayerState(updatedPlayerState);
            return updatedPlayerState;
        } else {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            return null;
        }
    }, [user, allUpgrades, playerState, setPlayerState]);

    const handleTap = useCallback(() => {
        if (!playerState) return 0;
        
        const tapValue = effectiveCoinsPerTap;
        const turboMultiplier = isTurboActive ? 5 : 1;
        const totalTapValue = tapValue * turboMultiplier;
        
        // Energy cost is always the base tap value, not multiplied by turbo
        if (playerState.energy >= tapValue) {
             window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            setPlayerState(p => p ? {
                ...p,
                balance: p.balance + totalTapValue,
                energy: p.energy - tapValue,
                dailyTaps: p.dailyTaps + 1,
            } : null);
            return totalTapValue;
        }
        return 0;
    }, [playerState, setPlayerState, effectiveCoinsPerTap, isTurboActive]);

    const claimTaskReward = useCallback(async (task: DailyTask, code?: string): Promise<{player?: PlayerState, error?: string}> => {
        if (!user) return { error: "User not logged in" };
        
        const result = await API.claimDailyTask(user.id, task.id, code);
        
        if (result.player) {
            setPlayerState(result.player);
        }
        
        return result;
    }, [user, setPlayerState]);

    const buyBoost = useCallback(async (boost: Boost): Promise<{player?: PlayerState, error?: string}> => {
        if (!user || !playerState) return { error: "User not logged in."};
    
        const baseCost = boost.costCoins;
        let cost = baseCost;
        if(boost.id === 'boost_tap_guru') {
            cost = Math.floor(baseCost * Math.pow(1.5, playerState.tapGuruLevel || 0));
        } else if (boost.id === 'boost_energy_limit') {
            cost = Math.floor(baseCost * Math.pow(1.8, playerState.energyLimitLevel || 0));
        }
    
        if (playerState.balance < cost) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            return { error: "Insufficient funds" };
        }
    
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    
        const result = await API.buyBoost(user.id, boost.id);
    
        if (result.player) {
            setPlayerState(result.player);
            if (boost.id === 'boost_turbo_mode') {
                setIsTurboActive(true);
                setTimeout(() => setIsTurboActive(false), 20000); // 20 seconds turbo
            }
        }
        return result;
    }, [user, playerState, setPlayerState]);

    const purchaseSpecialTask = useCallback(async (task: SpecialTask) => {
        if (!user || !playerState) return;
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        if (task.priceStars === 0) { // Free task
             const updatedPlayerState = await API.unlockFreeTask(user.id, task.id);
             if(updatedPlayerState) setPlayerState(updatedPlayerState);
        } else { // Paid task
             const res = await API.createInvoice(user.id, task.id);
             if (res.ok && res.invoiceLink) {
                 window.Telegram.WebApp.openInvoice(res.invoiceLink);
             } else {
                 console.error("Failed to create invoice:", res.error);
                 window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
             }
        }
    }, [user, playerState, setPlayerState]);
    
    const completeSpecialTask = useCallback(async (task: SpecialTask, code?: string): Promise<PlayerState | null> => {
        if (!user || !playerState || playerState.completedSpecialTaskIds.includes(task.id) || !playerState.purchasedSpecialTaskIds.includes(task.id)) return null;
         const updatedPlayerState = await API.completeSpecialTask(user.id, task.id, code);
         if(updatedPlayerState) {
            setPlayerState(updatedPlayerState);
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            return updatedPlayerState;
         }
         return null;
    }, [user, playerState, setPlayerState]);

    const claimDailyCombo = useCallback(async (): Promise<{player?: PlayerState, reward?: number, error?: string}> => {
        if(!user) return { error: "User not logged in" };
        window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
        const result = await API.claimCombo(user.id);
        if(result.player) {
            setPlayerState(result.player);
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        } else {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        }
        return result;
    }, [user, setPlayerState]);

    const claimDailyCipher = useCallback(async (cipher: string): Promise<{player?: PlayerState, reward?: number, error?: string}> => {
        if(!user) return { error: 'User not logged in.'};
        const result = await API.claimCipher(user.id, cipher);
        if(result.player) {
            setPlayerState(result.player);
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        } else {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        }
        return result;
    }, [user, setPlayerState]);

    const getLeaderboard = useCallback(API.getLeaderboard, []);

    const currentLeague = useMemo(() => {
        if (!playerState) return LEAGUES[LEAGUES.length - 1];
        return LEAGUES.find(l => playerState.balance >= l.minBalance) ?? LEAGUES[LEAGUES.length - 1];
    }, [playerState?.balance]);

    return {
        playerState,
        config,
        handleTap,
        buyUpgrade,
        allUpgrades,
        currentLeague,
        claimTaskReward,
        buyBoost,
        purchaseSpecialTask,
        completeSpecialTask,
        claimDailyCombo,
        claimDailyCipher,
        getLeaderboard,
        isTurboActive,
        effectiveMaxEnergy,
        effectiveCoinsPerTap
    };
};
