
import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { PlayerState, GameConfig, Upgrade, Language, User, DailyTask, Boost, SpecialTask } from '../types';
import { LEAGUES, MAX_ENERGY, ENERGY_REGEN_RATE, SAVE_DEBOUNCE_MS, TRANSLATIONS } from '../constants';

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
  
  completeSpecialTask: async (userId: string, taskId: string): Promise<PlayerState | null> => {
    if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not set.");
    const response = await fetch(`${API_BASE_URL}/api/action/complete-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId }),
    });
     if (!response.ok) return null;
    return response.json();
  }
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
                
                if (loginData) {
                    setUser(loginData.user);
                    setPlayerState(loginData.player);
                    setConfig(loginData.config);
                } else {
                    throw new Error("Failed to get login data from backend.");
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

    // Persist state to backend with debounce
    useEffect(() => {
        if (!user || !playerState) return;
        const handler = setTimeout(() => {
            const stateToSave = { ...playerState, lastLoginTimestamp: Date.now() };
            API.savePlayerState(user.id, stateToSave);
        }, SAVE_DEBOUNCE_MS);
        return () => clearTimeout(handler);
    }, [playerState, user]);

    // Game loop for energy regen
    useEffect(() => {
        if (!playerState) return;
        const gameTick = setInterval(() => {
            setPlayerState(p => p ? { ...p, energy: Math.min(MAX_ENERGY, p.energy + ENERGY_REGEN_RATE) } : null);
        }, 1000);
        return () => clearInterval(gameTick);
    }, [playerState, setPlayerState]);
    
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

    const calculateProfitPerHour = useCallback((currentUpgrades: Record<string, number>, gameConfig: GameConfig) => {
        return gameConfig.upgrades.reduce((total, u) => {
            const level = currentUpgrades[u.id] || 0;
            if (level > 0) {
                return total + Math.floor(u.profitPerHour * level * 1.07);
            }
            return total;
        }, 0);
    }, []);
    
    const allUpgrades = useMemo((): (Upgrade & {level: number})[] => {
        if (!config || !playerState) return [];
        return config.upgrades.map(u => {
            const level = playerState.upgrades[u.id] || 0;
            return {
                ...u,
                level,
                price: Math.floor(u.price * Math.pow(1.15, level)),
                profitPerHour: u.profitPerHour * (level > 0 ? Math.pow(1.07, level) : 1),
            };
        });
    }, [playerState, config]);

    const buyUpgrade = useCallback((upgradeId: string) => {
        const upgrade = allUpgrades.find(u => u.id === upgradeId);
        if (!upgrade || !playerState || !config || playerState.balance < upgrade.price) return;

        setPlayerState(p => {
            if (!p) return null;
            const newLevel = (p.upgrades[upgradeId] || 0) + 1;
            const newUpgrades = { ...p.upgrades, [upgradeId]: newLevel };
            const newProfitPerHour = calculateProfitPerHour(newUpgrades, config);
            return {
                ...p,
                balance: p.balance - upgrade.price,
                profitPerHour: newProfitPerHour,
                upgrades: newUpgrades,
            };
        });
    }, [allUpgrades, playerState, config, calculateProfitPerHour, setPlayerState]);

    const handleTap = useCallback(() => {
        if (playerState && playerState.energy >= playerState.coinsPerTap) {
            setPlayerState(p => p ? {
                ...p,
                balance: p.balance + p.coinsPerTap,
                energy: p.energy - p.coinsPerTap,
                dailyTaps: p.dailyTaps + 1,
            } : null);
            return true;
        }
        return false;
    }, [playerState, setPlayerState]);

    const claimTaskReward = useCallback((task: DailyTask) => {
        if (!playerState || playerState.completedDailyTaskIds.includes(task.id)) return;
        if (playerState.dailyTaps < task.requiredTaps) return;

        setPlayerState(p => p ? {
            ...p,
            balance: p.balance + task.rewardCoins,
            completedDailyTaskIds: [...p.completedDailyTaskIds, task.id]
        } : null);
    }, [playerState, setPlayerState]);

    const buyBoost = useCallback((boost: Boost) => {
        if (!playerState || playerState.balance < boost.costCoins) return;
        if (boost.id === 'boost1') { // Full energy
            setPlayerState(p => p ? { ...p, energy: MAX_ENERGY, balance: p.balance - boost.costCoins } : null);
        }
    }, [playerState, setPlayerState]);

    const purchaseSpecialTask = useCallback(async (task: SpecialTask) => {
        if (!user || !playerState) return;

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
    
    const completeSpecialTask = useCallback(async (task: SpecialTask) => {
        if (!user || !playerState || playerState.completedSpecialTaskIds.includes(task.id) || !playerState.purchasedSpecialTaskIds.includes(task.id)) return;
         const updatedPlayerState = await API.completeSpecialTask(user.id, task.id);
         if(updatedPlayerState) setPlayerState(updatedPlayerState);
    }, [user, playerState, setPlayerState]);


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
        completeSpecialTask
    };
};
