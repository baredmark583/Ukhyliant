import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { PlayerState, GameConfig, Upgrade, Language, User, DailyTask, Boost, UserRole, SpecialTask } from '../types';
import { 
    INITIAL_UPGRADES, INITIAL_TASKS, INITIAL_BOOSTS, INITIAL_SPECIAL_TASKS, LEAGUES, MAX_ENERGY, 
    ENERGY_REGEN_RATE, SAVE_DEBOUNCE_MS, ADMIN_TELEGRAM_ID, MODERATOR_TELEGRAM_IDS, REFERRAL_BONUS, TRANSLATIONS 
} from '../constants';

// --- Add Telegram types to global scope ---
declare global {
  interface Window {
    Telegram: {
      WebApp: any; 
    };
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- REAL BACKEND API CLIENT ---
const API = {
  // --- Config Management ---
  getGameConfig: async (): Promise<GameConfig> => {
    if (!API_BASE_URL) return { upgrades: INITIAL_UPGRADES, tasks: INITIAL_TASKS, boosts: INITIAL_BOOSTS, specialTasks: INITIAL_SPECIAL_TASKS };
    const response = await fetch(`${API_BASE_URL}/api/config`);
    if (!response.ok) throw new Error('Failed to fetch game config');
    return response.json();
  },

  saveGameConfig: async (config: GameConfig): Promise<void> => {
    if (!API_BASE_URL) return; // Should be disabled in UI if no backend
    await fetch(`${API_BASE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  },

  // --- Player Data Management ---
  getPlayerState: async (userId: string, isNew: boolean, ref: string | null): Promise<PlayerState | null> => {
    if (!API_BASE_URL) return null; // Should not happen if logged in
    const response = await fetch(`${API_BASE_URL}/api/player/${userId}?isNew=${isNew}&ref=${ref || ''}`);
    if (!response.ok) return null;
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
  
  // --- Authentication and User Management ---
  login: async (): Promise<{ user: User, isNew: boolean, ref: string | null } | null> => {
      if (!window.Telegram?.WebApp?.initDataUnsafe?.user) {
          return null;
      }
      const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
      const userId = tgUser.id.toString();
      
      const response = await fetch(`${API_BASE_URL}/api/user/${userId}`);
      const isNew = !response.ok;

      let lang: Language = (tgUser.language_code === 'uk' || tgUser.language_code === 'ru') ? 'ua' : 'en';
      let role: UserRole = 'user';
      if (userId === ADMIN_TELEGRAM_ID) {
          role = 'admin';
      } else if (MODERATOR_TELEGRAM_IDS.includes(userId)) {
          role = 'moderator';
      }
      
      const user: User = { id: userId, name: tgUser.first_name, language: lang, role };
      
      const ref = window.Telegram.WebApp.initDataUnsafe.start_param;
      return { user, isNew, ref: ref !== userId ? ref : null };
  },
  
  logout: async (): Promise<void> => {
      // No server action needed for logout
  },

  updateUserLanguage: async (userId: string, lang: Language): Promise<void> => {
      if (!API_BASE_URL) return;
      await fetch(`${API_BASE_URL}/api/user/${userId}/language`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang }),
      });
  },

  // --- AI Translation Service ---
  translateText: async (text: string, from: Language, to: Language): Promise<string> => {
    if (!API_BASE_URL) return `(Translation disabled) ${text}`;
    try {
        const response = await fetch(`${API_BASE_URL}/api/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, from, to }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Translation failed');
        }
        const data = await response.json();
        return data.translatedText;
    } catch (error) {
        console.error("Translation API error:", error);
        return `(Error) ${text}`;
    }
  }
};


// --- AUTHENTICATION HOOK ---
const AuthContext = createContext<{
  user: User | null;
  isAdmin: boolean;
  hasAdminAccess: boolean; // For admins and moderators
  logout: () => void;
  switchLanguage: (lang: Language) => void;
  isInitializing: boolean;
}>({ user: null, isAdmin: false, hasAdminAccess: false, logout: () => {}, switchLanguage: () => {}, isInitializing: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
        if (!API_BASE_URL) {
            console.error("VITE_API_BASE_URL is not set. App cannot connect to the backend.");
            setIsInitializing(false);
            return;
        }
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
            const loginResult = await API.login();
            if (loginResult) {
                setUser(loginResult.user);
            }
        }
        setIsInitializing(false);
    }
    init();
  }, []);

  const switchLanguage = async (lang: Language) => {
    if (user) {
        await API.updateUserLanguage(user.id, lang);
        setUser({ ...user, language: lang });
    }
  };

  const logout = () => {
    setUser(null);
    window.location.reload();
  };
  
  const isAdmin = user?.role === 'admin';
  const hasAdminAccess = user?.role === 'admin' || user?.role === 'moderator';
  
  const value = { user, isAdmin, hasAdminAccess, logout, switchLanguage, isInitializing };

  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = () => useContext(AuthContext);

// --- TRANSLATION HOOK ---
export const useTranslation = () => {
    const { user } = useAuth();
    const lang = user?.language || 'en';

    return (key: keyof (typeof TRANSLATIONS)[typeof lang]) => {
        return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key];
    };
};


// --- GAME LOGIC HOOK ---
export const useGame = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<GameConfig>({ upgrades: [], tasks: [], boosts: [], specialTasks: [] });
  const [isGameLoading, setGameLoading] = useState(true);

  const getInitialState = (userId: string): PlayerState => {
      const now = Date.now();
      return {
          balance: 500,
          energy: MAX_ENERGY,
          profitPerHour: 0,
          coinsPerTap: 1,
          lastLoginTimestamp: now,
          upgrades: {},
          stars: 100,
          referrals: 0,
          completedDailyTaskIds: [],
          purchasedSpecialTaskIds: [],
          completedSpecialTaskIds: [],
          dailyTaps: 0,
          lastDailyReset: now
      };
  };

  const [playerState, setPlayerState] = useState<PlayerState>(getInitialState(''));

  // Load game config and player state on user login
  useEffect(() => {
    const loadData = async () => {
        if (!user) return;
        setGameLoading(true);
        const loginDetails = await API.login(); // Re-fetch login details to get isNew status
        if (!loginDetails) return;
        
        const [loadedConfig, loadedPlayerState] = await Promise.all([
            API.getGameConfig(),
            API.getPlayerState(user.id, loginDetails.isNew, loginDetails.ref)
        ]);
        setConfig(loadedConfig);
        setPlayerState(loadedPlayerState || getInitialState(user.id));
        setGameLoading(false);
    };
    loadData();
  }, [user]);

  // Persist state to backend with debounce
  useEffect(() => {
    if (!user || isGameLoading) return;
    const handler = setTimeout(() => {
        API.savePlayerState(user.id, playerState);
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [playerState, user, isGameLoading]);

  // Game loop for passive income and energy regen
  useEffect(() => {
    if(isGameLoading) return;
    const gameTick = setInterval(() => {
      setPlayerState(prevState => {
        const newBalance = prevState.balance + prevState.profitPerHour / 3600;
        const newEnergy = Math.min(MAX_ENERGY, prevState.energy + ENERGY_REGEN_RATE);
        return { ...prevState, balance: newBalance, energy: newEnergy };
      });
    }, 1000);
    return () => clearInterval(gameTick);
  }, [playerState.profitPerHour, isGameLoading]);
  
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
    return config.upgrades.map(u => {
      const level = playerState.upgrades[u.id] || 0;
      return {
        ...u,
        level,
        price: Math.floor(u.price * Math.pow(1.15, level)),
        profitPerHour: u.profitPerHour * (level > 0 ? Math.pow(1.07, level) : 1),
      };
    });
  }, [playerState.upgrades, config.upgrades]);


  const buyUpgrade = useCallback((upgradeId: string) => {
    const upgrade = allUpgrades.find(u => u.id === upgradeId);
    if (!upgrade || playerState.balance < upgrade.price) return;

    setPlayerState(prevState => {
      const newLevel = (prevState.upgrades[upgradeId] || 0) + 1;
      const newUpgrades = { ...prevState.upgrades, [upgradeId]: newLevel };
      const newProfitPerHour = calculateProfitPerHour(newUpgrades, config);

      return {
        ...prevState,
        balance: prevState.balance - upgrade.price,
        profitPerHour: newProfitPerHour,
        upgrades: newUpgrades,
      };
    });
  }, [allUpgrades, playerState.balance, config, calculateProfitPerHour]);

  const handleTap = useCallback(() => {
    if (playerState.energy >= playerState.coinsPerTap) {
      setPlayerState(prevState => ({
        ...prevState,
        balance: prevState.balance + prevState.coinsPerTap,
        energy: prevState.energy - prevState.coinsPerTap,
        dailyTaps: prevState.dailyTaps + 1,
      }));
      return true;
    }
    return false;
  }, [playerState.energy, playerState.coinsPerTap]);

  const claimTaskReward = useCallback((task: DailyTask) => {
      if(playerState.completedDailyTaskIds.includes(task.id)) return;
      
      const isCompleted = playerState.dailyTaps >= task.requiredTaps;
      if(!isCompleted) return;

      setPlayerState(p => ({
          ...p,
          balance: p.balance + task.rewardCoins,
          stars: p.stars + task.rewardStars,
          completedDailyTaskIds: [...p.completedDailyTaskIds, task.id]
      }));
  }, [playerState]);
  
  const buyBoost = useCallback((boost: Boost) => {
      if(playerState.stars < boost.cost) return;

      setPlayerState(p => ({ ...p, stars: p.stars - boost.cost }));

      if(boost.id === 'boost1') { // Full energy
          setPlayerState(p => ({ ...p, energy: MAX_ENERGY }));
      }
  }, [playerState.stars]);
  
   const purchaseSpecialTask = useCallback((task: SpecialTask) => {
      if (playerState.stars < task.priceStars || playerState.purchasedSpecialTaskIds.includes(task.id)) return;
      
      console.log(`Simulating purchase of ${task.id} for ${task.priceStars} stars`);
      
      setPlayerState(p => ({
          ...p,
          stars: p.stars - task.priceStars,
          purchasedSpecialTaskIds: [...p.purchasedSpecialTaskIds, task.id]
      }));
  }, [playerState]);

  const completeSpecialTask = useCallback((task: SpecialTask) => {
      if (playerState.completedSpecialTaskIds.includes(task.id) || !playerState.purchasedSpecialTaskIds.includes(task.id)) return;

      setPlayerState(p => ({
          ...p,
          balance: p.balance + task.rewardCoins,
          stars: p.stars + task.rewardStars,
          completedSpecialTaskIds: [...p.completedSpecialTaskIds, task.id]
      }));
  }, [playerState]);


  const currentLeague = useMemo(() => {
    return LEAGUES.find(l => playerState.balance >= l.minBalance) ?? LEAGUES[LEAGUES.length - 1];
  }, [playerState.balance]);

  const saveAdminConfig = async (newConfig: GameConfig) => {
      await API.saveGameConfig(newConfig);
      setConfig(newConfig);
  };
  
  const translate = async (text: string, from: Language, to: Language) => {
      return await API.translateText(text, from, to);
  }

  return {
    playerState,
    config,
    isGameLoading,
    handleTap,
    buyUpgrade,
    allUpgrades,
    currentLeague,
    claimTaskReward,
    buyBoost,
    purchaseSpecialTask,
    completeSpecialTask,
    gameAdmin: {
        saveConfig: saveAdminConfig,
        translate: translate,
    }
  };
};
