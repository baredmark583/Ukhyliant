
import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { PlayerState, GameConfig, Upgrade, Language, User, DailyTask, Boost } from '../types';
import { INITIAL_UPGRADES, INITIAL_TASKS, INITIAL_BOOSTS, LEAGUES, MAX_ENERGY, ENERGY_REGEN_RATE, SAVE_DEBOUNCE_MS, ADMIN_TELEGRAM_ID, REFERRAL_BONUS, TRANSLATIONS } from '../constants';

// --- Add Telegram types to global scope ---
declare global {
  interface Window {
    Telegram: {
      WebApp: any; // Using 'any' for simplicity, but could be strictly typed
    };
  }
}

// --- MOCK API CLIENT (interacts with localStorage) ---
// In a real app, this would be replaced with actual HTTP requests to a backend.

const API = {
  getGameConfig: (): GameConfig => {
    const savedConfig = localStorage.getItem('ukhyliantGameConfig');
    if (savedConfig) {
      return JSON.parse(savedConfig);
    }
    const defaultConfig: GameConfig = { upgrades: INITIAL_UPGRADES, tasks: INITIAL_TASKS, boosts: INITIAL_BOOSTS };
    localStorage.setItem('ukhyliantGameConfig', JSON.stringify(defaultConfig));
    return defaultConfig;
  },

  saveGameConfig: (config: GameConfig) => {
    localStorage.setItem('ukhyliantGameConfig', JSON.stringify(config));
  },

  getPlayerState: (): PlayerState | null => {
    const savedState = localStorage.getItem('ukhyliantGameState');
    if (!savedState) return null;

    const parsedState = JSON.parse(savedState) as PlayerState;
    const now = Date.now();
    const timeOfflineSeconds = (now - parsedState.lastLoginTimestamp) / 1000;
    const offlineEarnings = Math.floor((timeOfflineSeconds * parsedState.profitPerHour) / 3600);
    
    // Check if a day has passed for daily reset
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

  savePlayerState: (state: PlayerState) => {
     const stateToSave = { ...state, lastLoginTimestamp: Date.now() };
     localStorage.setItem('ukhyliantGameState', JSON.stringify(stateToSave));
  },
  
  // Real Telegram Login
  login: (): { user: User, isNew: boolean } | null => {
      if (!window.Telegram?.WebApp?.initDataUnsafe?.user) {
          return null; // Not in a valid Telegram context
      }
      const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
      const userId = tgUser.id.toString();

      let isNew = false;
      let lang: Language = (tgUser.language_code === 'uk' || tgUser.language_code === 'ru') ? 'ua' : 'en';

      let user: User = { id: userId, name: tgUser.first_name, language: lang };
      const existingUser = localStorage.getItem(`user_${userId}`);
      
      if(existingUser) {
          user = JSON.parse(existingUser);
      } else {
          isNew = true;
          const ref = window.Telegram.WebApp.initDataUnsafe.start_param;
          if (ref) {
              const referrerStateStr = localStorage.getItem(`playerState_for_user_${ref}`);
              if (referrerStateStr) {
                  const referrerState = JSON.parse(referrerStateStr) as PlayerState;
                  referrerState.balance += REFERRAL_BONUS;
                  referrerState.referrals += 1;
                  localStorage.setItem(`playerState_for_user_${ref}`, JSON.stringify(referrerState));
              }
          }
      }
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem(`user_${userId}`, JSON.stringify(user));
      return { user, isNew };
  },

  getCurrentUser: (): User | null => {
      const userStr = localStorage.getItem('currentUser');
      return userStr ? JSON.parse(userStr) : null;
  },
  
  logout: () => {
      localStorage.removeItem('currentUser');
  },

  updateUserLanguage: (lang: Language) => {
      const user = API.getCurrentUser();
      if(user) {
          user.language = lang;
          localStorage.setItem('currentUser', JSON.stringify(user));
          localStorage.setItem(`user_${user.id}`, JSON.stringify(user));
      }
  }
};

// --- AUTHENTICATION HOOK ---

const AuthContext = createContext<{
  user: User | null;
  isAdmin: boolean;
  logout: () => void;
  switchLanguage: (lang: Language) => void;
  isInitializing: boolean;
}>({ user: null, isAdmin: false, logout: () => {}, switchLanguage: () => {}, isInitializing: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        const loginResult = API.login();
        if (loginResult) {
            setUser(loginResult.user);
        }
    }
    setIsInitializing(false);
  }, []);

  const switchLanguage = (lang: Language) => {
    if (user) {
        API.updateUserLanguage(lang);
        setUser({ ...user, language: lang });
    }
  };

  const logout = () => {
    API.logout();
    setUser(null);
    window.location.reload(); // Reload to clear all state
  };
  
  const isAdmin = user?.id === ADMIN_TELEGRAM_ID;
  
  const value = { user, isAdmin, logout, switchLanguage, isInitializing };

  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = () => useContext(AuthContext);

// --- TRANSLATION HOOK ---
export const useTranslation = () => {
    const { user } = useAuth();
    // Default to 'en' during initialization or if user is somehow null
    const lang = user?.language || 'en';

    return (key: keyof (typeof TRANSLATIONS)[typeof lang]) => {
        return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key];
    };
};


// --- GAME LOGIC HOOK ---
export const useGame = () => {
  const [config, setConfig] = useState<GameConfig>(API.getGameConfig());
  
  const getInitialState = (): PlayerState => {
      const savedState = API.getPlayerState();
      if (savedState) return savedState;

      const now = Date.now();
      return {
          balance: 500,
          energy: MAX_ENERGY,
          profitPerHour: 0,
          coinsPerTap: 1,
          lastLoginTimestamp: now,
          upgrades: {},
          stars: 0,
          referrals: 0,
          completedDailyTaskIds: [],
          dailyTaps: 0,
          lastDailyReset: now
      };
  };

  const [playerState, setPlayerState] = useState<PlayerState>(getInitialState);
  const { balance, energy, coinsPerTap, upgrades } = playerState;

  // Persist state to localStorage with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
        API.savePlayerState(playerState);
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [playerState]);

  // Game loop for passive income and energy regeneration
  useEffect(() => {
    const gameTick = setInterval(() => {
      setPlayerState(prevState => {
        const newBalance = prevState.balance + prevState.profitPerHour / 3600;
        const newEnergy = Math.min(MAX_ENERGY, prevState.energy + ENERGY_REGEN_RATE);
        return { ...prevState, balance: newBalance, energy: newEnergy };
      });
    }, 1000);
    return () => clearInterval(gameTick);
  }, [playerState.profitPerHour]);

  const allUpgrades = useMemo((): (Upgrade & {level: number})[] => {
    return config.upgrades.map(u => {
      const level = upgrades[u.id] || 0;
      return {
        ...u,
        level,
        price: Math.floor(u.price * Math.pow(1.15, level)),
        profitPerHour: u.profitPerHour * (level > 0 ? Math.pow(1.07, level) : 1),
      };
    });
  }, [upgrades, config.upgrades]);

  const calculateProfitPerHour = (currentUpgrades: Record<string, number>) => {
      return config.upgrades.reduce((total, u) => {
          const level = currentUpgrades[u.id] || 0;
          if (level > 0) {
              return total + Math.floor(u.profitPerHour * level * 1.07);
          }
          return total;
      }, 0);
  };

  const buyUpgrade = useCallback((upgradeId: string) => {
    const upgrade = allUpgrades.find(u => u.id === upgradeId);
    if (!upgrade || balance < upgrade.price) return;

    setPlayerState(prevState => {
      const newLevel = (prevState.upgrades[upgradeId] || 0) + 1;
      const newUpgrades = { ...prevState.upgrades, [upgradeId]: newLevel };
      const newProfitPerHour = calculateProfitPerHour(newUpgrades);

      return {
        ...prevState,
        balance: prevState.balance - upgrade.price,
        profitPerHour: newProfitPerHour,
        upgrades: newUpgrades,
      };
    });
  }, [allUpgrades, balance]);

  const handleTap = useCallback(() => {
    if (energy >= coinsPerTap) {
      setPlayerState(prevState => ({
        ...prevState,
        balance: prevState.balance + coinsPerTap,
        energy: prevState.energy - coinsPerTap,
        dailyTaps: prevState.dailyTaps + 1,
      }));
      return true;
    }
    return false;
  }, [energy, coinsPerTap]);

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
      // logic for other boosts can go here
  }, [playerState.stars]);

  const currentLeague = useMemo(() => {
    return LEAGUES.find(l => balance >= l.minBalance) ?? LEAGUES[LEAGUES.length - 1];
  }, [balance]);

  const saveAdminConfig = (newConfig: GameConfig) => {
      API.saveGameConfig(newConfig);
      setConfig(newConfig);
  };

  return {
    playerState,
    config,
    handleTap,
    buyUpgrade,
    allUpgrades,
    currentLeague,
    claimTaskReward,
    buyBoost,
    gameAdmin: {
        saveConfig: saveAdminConfig,
    }
  };
};