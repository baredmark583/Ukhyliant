
import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { GoogleGenAI } from '@google/genai';
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

// --- AI Service for Translation ---
// The API key is sourced from the environment variable `process.env.API_KEY`.
// This variable is assumed to be pre-configured in the execution environment.
let ai: GoogleGenAI | null = null;
if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} else {
    console.warn("Gemini API key not found (process.env.API_KEY). Translation feature will be disabled.");
}


// --- SIMULATED BACKEND API (interacts with localStorage) ---
// This is structured to be easily replaceable with actual HTTP requests to a real backend.
const API = {
  // --- Config Management ---
  getGameConfig: async (): Promise<GameConfig> => {
    const savedConfig = localStorage.getItem('ukhyliantGameConfig');
    if (savedConfig) {
      return JSON.parse(savedConfig);
    }
    const defaultConfig: GameConfig = { 
        upgrades: INITIAL_UPGRADES, 
        tasks: INITIAL_TASKS, 
        boosts: INITIAL_BOOSTS,
        specialTasks: INITIAL_SPECIAL_TASKS
    };
    localStorage.setItem('ukhyliantGameConfig', JSON.stringify(defaultConfig));
    return defaultConfig;
  },

  saveGameConfig: async (config: GameConfig): Promise<void> => {
    localStorage.setItem('ukhyliantGameConfig', JSON.stringify(config));
  },

  // --- Player Data Management (per-user) ---
  getPlayerState: async (userId: string): Promise<PlayerState | null> => {
    const savedState = localStorage.getItem(`playerState_v2_${userId}`);
    if (!savedState) return null;

    const parsedState = JSON.parse(savedState) as PlayerState;
    const now = Date.now();
    const timeOfflineSeconds = (now - parsedState.lastLoginTimestamp) / 1000;
    const offlineEarnings = Math.floor((timeOfflineSeconds * parsedState.profitPerHour) / 3600);
    
    const oneDay = 24 * 60 * 60 * 1000;
    const shouldResetDailies = now - parsedState.lastDailyReset > oneDay;

    return {
      ...parsedState,
      balance: parsedState.balance + offlineEarnings,
      energy: Math.min(MAX_ENERGY, parsedState.energy + Math.floor(timeOfflineSeconds * ENERGY_REGEN_RATE)),
      lastLoginTimestamp: now,
      completedDailyTaskIds: shouldResetDailies ? [] : parsedState.completedDailyTaskIds,
      dailyTaps: shouldResetDailies ? 0 : parsedState.dailyTaps,
      lastDailyReset: shouldResetDailies ? now : parsedState.lastDailyReset,
    };
  },

  savePlayerState: async (userId: string, state: PlayerState): Promise<void> => {
     const stateToSave = { ...state, lastLoginTimestamp: Date.now() };
     localStorage.setItem(`playerState_v2_${userId}`, JSON.stringify(stateToSave));
  },
  
  // --- Authentication and User Management ---
  login: async (): Promise<{ user: User, isNew: boolean } | null> => {
      if (!window.Telegram?.WebApp?.initDataUnsafe?.user) {
          return null;
      }
      const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
      const userId = tgUser.id.toString();

      let isNew = false;
      let lang: Language = (tgUser.language_code === 'uk' || tgUser.language_code === 'ru') ? 'ua' : 'en';
      let role: UserRole = 'user';
      if (userId === ADMIN_TELEGRAM_ID) {
          role = 'admin';
      } else if (MODERATOR_TELEGRAM_IDS.includes(userId)) {
          role = 'moderator';
      }

      let user: User = { id: userId, name: tgUser.first_name, language: lang, role };
      const existingUserStr = localStorage.getItem(`user_v2_${userId}`);
      
      if(existingUserStr) {
          user = JSON.parse(existingUserStr);
          // Ensure role is updated if it has changed
          user.role = role;
      } else {
          isNew = true;
          const ref = window.Telegram.WebApp.initDataUnsafe.start_param;
          if (ref && ref !== userId) { // User can't be their own referrer
              const referrerState = await API.getPlayerState(ref);
              if (referrerState) {
                  referrerState.balance += REFERRAL_BONUS;
                  referrerState.referrals += 1;
                  await API.savePlayerState(ref, referrerState);
              }
          }
      }
      localStorage.setItem('currentUserId', userId);
      localStorage.setItem(`user_v2_${userId}`, JSON.stringify(user));
      return { user, isNew };
  },

  getCurrentUser: async (): Promise<User | null> => {
      const userId = localStorage.getItem('currentUserId');
      if (!userId) return null;
      const userStr = localStorage.getItem(`user_v2_${userId}`);
      return userStr ? JSON.parse(userStr) : null;
  },
  
  logout: async (): Promise<void> => {
      localStorage.removeItem('currentUserId');
  },

  updateUserLanguage: async (userId: string, lang: Language): Promise<void> => {
      const userStr = localStorage.getItem(`user_v2_${userId}`);
      if(userStr) {
          const user = JSON.parse(userStr) as User;
          user.language = lang;
          localStorage.setItem(`user_v2_${userId}`, JSON.stringify(user));
      }
  },

  // --- AI Translation Service ---
  translateText: async (text: string, from: Language, to: Language): Promise<string> => {
    if (!ai) return `(Translation disabled) ${text}`;
    const fromLang = from === 'ua' ? 'Ukrainian' : 'English';
    const toLang = to === 'ua' ? 'Ukrainian' : 'English';
    const prompt = `Translate the following text from ${fromLang} to ${toLang}. Return ONLY the translated text, without any additional comments, formatting or quotation marks:\n\n"${text}"`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text.trim();
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
    API.logout();
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
          stars: 100, // Start with some stars for testing
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
        const [loadedConfig, loadedPlayerState] = await Promise.all([
            API.getGameConfig(),
            API.getPlayerState(user.id)
        ]);
        setConfig(loadedConfig);
        setPlayerState(loadedPlayerState || getInitialState(user.id));
        setGameLoading(false);
    };
    loadData();
  }, [user]);

  // Persist state to localStorage with debounce
  useEffect(() => {
    if (!user || isGameLoading) return;
    const handler = setTimeout(() => {
        API.savePlayerState(user.id, playerState);
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [playerState, user, isGameLoading]);

  // Game loop
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
      
      // Here you would integrate with Telegram's payment API
      // window.Telegram.WebApp.openInvoice(...)
      // For now, we simulate a successful purchase
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