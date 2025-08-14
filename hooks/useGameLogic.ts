import React, { useState, useEffect, createContext, useContext, useCallback, useMemo, useRef } from 'react';
import { 
    PlayerState, GameConfig, Upgrade, Language, User, DailyTask, Boost, SpecialTask, 
    LeaderboardPlayer, BoxType, CoinSkin, BlackMarketCard, UpgradeCategory, League, 
    Cell, BattleStatus, BattleLeaderboardEntry, Friend, Informant 
} from '../types';
import { INITIAL_MAX_ENERGY, ENERGY_REGEN_RATE, SAVE_DEBOUNCE_MS, TRANSLATIONS, DEFAULT_COIN_SKIN_ID } from '../constants';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { Address } from '@ton/ton';


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
  
  connectWallet: async (userId: string, walletData: any | null): Promise<{ player?: PlayerState, message?: string, error?: string}> => {
    if (!API_BASE_URL) return { error: "API not configured" };
    const response = await fetch(`${API_BASE_URL}/api/user/connect-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, walletData }),
    });
    return response.json();
  },

  getFriends: async (userId: string): Promise<Friend[] | null> => {
    if (!API_BASE_URL) return null;
    const response = await fetch(`${API_BASE_URL}/api/user/${userId}/friends`);
    if (!response.ok) return null;
    return response.json();
  },

  savePlayerState: async (userId: string, state: PlayerState, taps: number): Promise<PlayerState | null> => {
     if (!API_BASE_URL) return null;
     const response = await fetch(`${API_BASE_URL}/api/player/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, taps })
     });
     if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
         const serverState = await response.json();
         // If server sent back a penalty message, handle it immediately
        if (serverState.penaltyLog && state.penaltyLog && serverState.penaltyLog.length > state.penaltyLog.length) {
            const newPenalty = serverState.penaltyLog[serverState.penaltyLog.length - 1];
            // This is a bit of a hack: we'll use a custom event or a setter in context
            // For now, let's just return it and handle in the calling function.
            (serverState as any).newPenaltyMessage = newPenalty.message;
        }

         return serverState;
     }
     return null;
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
    const res = await fetch(`${API_BASE_URL}/api/action/buy-upgrade`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, upgradeId })
    });
    return res.json();
  },
  
  buyBoost: async (userId: string, boostId: string): Promise<{player?: PlayerState, error?: string}> => {
    return fetch(`${API_BASE_URL}/api/action/buy-boost`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, boostId })
    }).then(res => res.json());
  },

  claimDailyTask: async (userId: string, taskId: string, code?: string): Promise<{player?: PlayerState, error?: string}> => {
    return fetch(`${API_BASE_URL}/api/action/claim-task`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId, code })
    }).then(res => res.json());
  },

  createStarInvoice: async (userId: string, payloadType: 'task' | 'lootbox', itemId: string): Promise<{ok: boolean, invoiceLink?: string, error?: string}> => {
    return fetch(`${API_BASE_URL}/api/create-star-invoice`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, payloadType, itemId }),
    }).then(res => res.json());
  },

  syncAfterPayment: async (userId: string): Promise<{player: PlayerState, wonItem: any} | null> => {
      const res = await fetch(`${API_BASE_URL}/api/sync-after-payment`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
      });
      if(!res.ok) return null;
      return res.json();
  },
  
  completeSpecialTask: async (userId: string, taskId: string, code?: string): Promise<{player?: PlayerState, error?: string}> => {
      return fetch(`${API_BASE_URL}/api/action/complete-task`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, taskId, code })
      }).then(res => res.json());
  },
  
  claimDailyCombo: async (userId: string): Promise<{player?: PlayerState, error?: string, reward?: number}> => {
      return fetch(`${API_BASE_URL}/api/action/claim-combo`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
      }).then(res => res.json());
  },
  claimDailyCipher: async (userId: string, cipher: string): Promise<{player?: PlayerState, error?: string, reward?: number}> => {
      return fetch(`${API_BASE_URL}/api/action/claim-cipher`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, cipher })
      }).then(res => res.json());
  },
  openCoinLootbox: async (userId: string, boxType: 'coin'): Promise<{player?: PlayerState, error?: string, wonItem?: any}> => {
      return fetch(`${API_BASE_URL}/api/action/open-lootbox`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, boxType })
      }).then(res => res.json());
  },
  setSkin: async (userId: string, skinId: string): Promise<{player: PlayerState}> => {
       return fetch(`${API_BASE_URL}/api/action/set-skin`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, skinId })
      }).then(res => res.json());
  },
  getLeaderboard: async (): Promise<{ topPlayers: LeaderboardPlayer[], totalPlayers: number } | null> => {
      const res = await fetch(`${API_BASE_URL}/api/leaderboard`);
      if(!res.ok) return null;
      return res.json();
  },
  getMyCell: async (userId: string): Promise<{cell?: Cell, error?: string}> => {
      const res = await fetch(`${API_BASE_URL}/api/cell/my-cell?userId=${userId}`);
      return res.json();
  },
  createCell: async (userId: string, name: string): Promise<{cell?: Cell, player?: PlayerState, error?: string}> => {
       return fetch(`${API_BASE_URL}/api/cell/create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, name })
      }).then(res => res.json());
  },
  joinCell: async (userId: string, inviteCode: string): Promise<{cell?: Cell, player?: PlayerState, error?: string}> => {
      return fetch(`${API_BASE_URL}/api/cell/join`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, inviteCode })
      }).then(res => res.json());
  },
  leaveCell: async (userId: string): Promise<{player: PlayerState, error?: string}> => {
      return fetch(`${API_BASE_URL}/api/cell/leave`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
      }).then(res => res.json());
  },
  recruitInformant: async (userId: string): Promise<{informant?: Informant, player?: PlayerState, error?: string}> => {
       return fetch(`${API_BASE_URL}/api/informant/recruit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
      }).then(res => res.json());
  },
  buyCellTicket: async (userId: string): Promise<{cell?: Cell, error?: string}> => {
       return fetch(`${API_BASE_URL}/api/cell/buy-ticket`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
      }).then(res => res.json());
  },
  getBattleStatus: async (userId: string): Promise<{status?: BattleStatus, error?: string}> => {
      const res = await fetch(`${API_BASE_URL}/api/battle/status?userId=${userId}`);
      return res.json();
  },
  joinBattle: async (userId: string): Promise<{status?: BattleStatus, cell?: Cell, error?: string}> => {
       return fetch(`${API_BASE_URL}/api/battle/join`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
      }).then(res => res.json());
  },
  getBattleLeaderboard: async (): Promise<{leaderboard?: BattleLeaderboardEntry[], error?: string}> => {
      const res = await fetch(`${API_BASE_URL}/api/battle/leaderboard`);
      return res.json();
  }
};


interface AuthContextType {
    user: User | null;
    isInitializing: boolean;
    isGlitching: boolean;
    setIsGlitching: React.Dispatch<React.SetStateAction<boolean>>;
    switchLanguage: (lang: Language) => void;
    login: () => Promise<void>;
}

interface GameContextType {
    playerState: PlayerState | null;
    config: GameConfig | null;
    handleTap: () => number;
    buyUpgrade: (upgradeId: string) => Promise<{ player?: PlayerState; error?: string; } | null>;
    allUpgrades: (Upgrade & {level: number})[];
    currentLeague: League | null;
    claimTaskReward: (task: DailyTask, code?: string) => Promise<{player?: PlayerState; error?: string;}>;
    buyBoost: (boost: Boost) => Promise<{ player?: PlayerState; error?: string; }>;
    purchaseSpecialTask: (task: SpecialTask) => Promise<void>;
    completeSpecialTask: (task: SpecialTask, code?: string) => Promise<{ player?: PlayerState; error?: string; }>;
    claimDailyCombo: () => Promise<{ player?: PlayerState; error?: string; reward?: number; }>;
    claimDailyCipher: (cipher: string) => Promise<{ player?: PlayerState; error?: string; reward?: number; }>;
    getLeaderboard: () => Promise<{ topPlayers: LeaderboardPlayer[]; totalPlayers: number; } | null>;
    getFriends: () => Promise<void>;
    friends: Friend[] | null;
    openCoinLootbox: (boxType: 'coin') => Promise<{ player?: PlayerState; error?: string; wonItem?: any; }>;
    purchaseLootboxWithStars: (boxType: 'star') => Promise<{ player?: PlayerState; error?: string; }>;
    setSkin: (skinId: string) => Promise<void>;
    connectWallet: () => Promise<void>;
    isTurboActive: boolean;
    effectiveMaxEnergy: number;
    effectiveMaxSuspicion: number;
    systemMessage: string;
    setSystemMessage: React.Dispatch<React.SetStateAction<string>>;
    purchaseResult: {type: 'lootbox' | 'task', item: any} | null;
    setPurchaseResult: React.Dispatch<React.SetStateAction<{type: 'lootbox' | 'task', item: any} | null>>;
    getMyCell: () => Promise<{ cell?: Cell; error?: string; }>;
    createCell: (name: string) => Promise<{ cell?: Cell; player?: PlayerState; error?: string; }>;
    joinCell: (inviteCode: string) => Promise<{ cell?: Cell; player?: PlayerState; error?: string; }>;
    leaveCell: () => Promise<{ player?: PlayerState; error?: string; }>;
    recruitInformant: () => Promise<{ informant?: Informant; player?: PlayerState; error?: string; }>;
    buyCellTicket: () => Promise<{ cell?: Cell; error?: string; }>;
    getBattleStatus: () => Promise<{ status?: BattleStatus; error?: string; }>;
    joinBattle: () => Promise<{ status?: BattleStatus; cell?: Cell; error?: string; }>;
    getBattleLeaderboard: () => Promise<{ leaderboard?: BattleLeaderboardEntry[]; error?: string; }>;
    walletConnectionMessage: string;
    setWalletConnectionMessage: React.Dispatch<React.SetStateAction<string>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const GameContext = createContext<GameContextType | undefined>(undefined);


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Auth State
    const [user, setUser] = useState<User | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isGlitching, setIsGlitching] = useState(false);

    // Game State
    const [playerState, setPlayerState] = useState<PlayerState | null>(null);
    const [config, setConfig] = useState<GameConfig | null>(null);
    const [tapsSinceSave, setTapsSinceSave] = useState(0);
    const [isTurboActive, setIsTurboActive] = useState(false);
    const [systemMessage, setSystemMessage] = useState('');
    const [purchaseResult, setPurchaseResult] = useState<{type: 'lootbox' | 'task', item: any} | null>(null);
    const [friends, setFriends] = useState<Friend[] | null>(null);
    const [walletConnectionMessage, setWalletConnectionMessage] = useState('');

    const saveTimeout = useRef<number | null>(null);
    const energyRegenInterval = useRef<number | null>(null);
    const turboTimeout = useRef<number | null>(null);
    
    // Create a ref to hold the latest playerState for use in intervals
    const playerStateRef = useRef(playerState);
    useEffect(() => {
        playerStateRef.current = playerState;
    }, [playerState]);


    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();

    const saveState = useCallback(async (currentState: PlayerState, currentTaps: number) => {
        if (!user?.id || !currentState) return;
        const updatedServerState = await API.savePlayerState(user.id, currentState, currentTaps);
        if (updatedServerState) {
            setPlayerState(updatedServerState);
            // Immediately show penalty modal if the server response includes a new penalty message
            if ((updatedServerState as any).newPenaltyMessage) {
                setSystemMessage((updatedServerState as any).newPenaltyMessage);
            }
        }
    }, [user]);

    const debouncedSave = useCallback((state: PlayerState, taps: number) => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = window.setTimeout(() => {
            saveState(state, taps);
            setTapsSinceSave(0);
        }, SAVE_DEBOUNCE_MS);
    }, [saveState]);

    const coinsPerTap = useMemo(() => {
        if (!playerState) return 1;
        const skin = config?.coinSkins.find(s => s.id === playerState.currentSkinId);
        const skinBoost = skin ? (1 + skin.profitBoostPercent / 100) : 1;
        const tapGuruMultiplier = Math.pow(1.5, playerState.tapGuruLevel || 0);
        const turboMultiplier = isTurboActive ? 5 : 1;
        return playerState.coinsPerTap * skinBoost * tapGuruMultiplier * turboMultiplier;
    }, [playerState, config, isTurboActive]);

    const effectiveMaxEnergy = useMemo(() => INITIAL_MAX_ENERGY + ((playerState?.energyLimitLevel || 0) * 500), [playerState]);
    const effectiveMaxSuspicion = useMemo(() => 100 + ((playerState?.suspicionLimitLevel || 0) * 10), [playerState]);

    const handleTap = useCallback(() => {
        if (!playerState || playerState.energy < 1) return 0;
        
        const tapValue = coinsPerTap;
        if (playerState.energy < tapValue) return 0;

        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');

        const newState: PlayerState = {
            ...playerState,
            balance: playerState.balance + tapValue,
            energy: playerState.energy - tapValue,
            dailyTaps: (playerState.dailyTaps || 0) + 1,
        };
        
        setPlayerState(newState);
        setTapsSinceSave(prev => {
            const newTaps = prev + 1;
            debouncedSave(newState, newTaps);
            return newTaps;
        });
        
        return tapValue;
    }, [playerState, coinsPerTap, debouncedSave]);

    const login = useCallback(async () => {
        try {
            setIsInitializing(true);
            const tg = window.Telegram?.WebApp;
            if (!tg?.initDataUnsafe?.user) {
                console.error("Not in Telegram environment.");
                setIsInitializing(false);
                return;
            }
            
            tg.ready();
            tg.expand();
            
            const startParam = tg.initDataUnsafe.start_param || null;
            const data = await API.login(tg.initDataUnsafe.user, startParam);
            
            if (data) {
                setUser(data.user);
                setPlayerState(data.player);
                setConfig(data.config);

                if (data.player.penaltyLog && data.player.penaltyLog.length > 0) {
                    const lastPenalty = data.player.penaltyLog[data.player.penaltyLog.length-1];
                    setSystemMessage(lastPenalty.message || "A penalty was applied.");
                }
            }
        } catch (error) {
            console.error('Login failed:', error);
        } finally {
            setIsInitializing(false);
        }
    }, []);

    const switchLanguage = useCallback(async (lang: Language) => {
        if (!user) return;
        const oldLang = user.language;
        setUser(u => u ? { ...u, language: lang } : null);
        await API.updateUserLanguage(user.id, lang);
        
        if (lang === 'ru' && oldLang !== 'ru') {
            setIsGlitching(true);
        }
    }, [user]);

    const processActionResponse = useCallback(<T extends { player?: PlayerState; error?: string; }>(result: T): T => {
        if (result.player) {
            setPlayerState(result.player);
            // Check for an immediate penalty after the action
            if (result.player.penaltyLog && playerState?.penaltyLog && result.player.penaltyLog.length > playerState.penaltyLog.length) {
                const newPenalty = result.player.penaltyLog[result.player.penaltyLog.length - 1];
                setSystemMessage(newPenalty.message || "A penalty was applied.");
            }
        }
        return result;
    }, [playerState]);

    const buyUpgrade = useCallback(async (upgradeId: string) => {
        if (!user?.id) return null;
        const result = await API.buyUpgrade(user.id, upgradeId);
        return processActionResponse(result);
    }, [user, processActionResponse]);

    const buyBoost = useCallback(async (boost: Boost) => {
        if (!user?.id) return { error: 'Not logged in' };
        if (boost.id === 'boost_turbo_mode' && isTurboActive) return { error: 'Turbo already active' };

        const result = await API.buyBoost(user.id, boost.id);
        
        const processedResult = processActionResponse(result);
        if (processedResult.player) {
             if (boost.id === 'boost_turbo_mode') {
                setIsTurboActive(true);
                if (turboTimeout.current) clearTimeout(turboTimeout.current);
                turboTimeout.current = window.setTimeout(() => setIsTurboActive(false), 20000);
            }
        }
        return processedResult;
    }, [user, isTurboActive, processActionResponse]);

    const claimTaskReward = useCallback(async (task: DailyTask, code?: string) => {
        if (!user?.id) return { error: 'Not logged in' };
        const result = await API.claimDailyTask(user.id, task.id, code);
        return processActionResponse(result);
    }, [user, processActionResponse]);

    const handleStarPayment = useCallback(async (payloadType: 'task' | 'lootbox', itemId: string) => {
        if (!user?.id) return;
        const { ok, invoiceLink, error } = await API.createStarInvoice(user.id, payloadType, itemId);
        if (ok && invoiceLink) {
            window.Telegram.WebApp.openInvoice(invoiceLink, async (status) => {
                if (status === 'paid') {
                    const syncResult = await API.syncAfterPayment(user.id);
                    if (syncResult) {
                        setPlayerState(syncResult.player);
                        if (syncResult.wonItem) {
                            setPurchaseResult(syncResult.wonItem);
                        }
                    }
                }
            });
        } else {
            console.error(error);
        }
    }, [user]);

    const purchaseSpecialTask = useCallback(async (task: SpecialTask) => {
        if (!user?.id) return;
        await handleStarPayment('task', task.id);
    }, [user, handleStarPayment]);
    
    const purchaseLootboxWithStars = useCallback(async (boxType: 'star') => {
        if (!user?.id) return { error: 'Not logged in' };
        await handleStarPayment('lootbox', boxType);
        return {};
    }, [user, handleStarPayment]);

    const completeSpecialTask = useCallback(async (task: SpecialTask, code?: string) => {
        if (!user?.id) return { error: 'Not logged in' };
        const result = await API.completeSpecialTask(user.id, task.id, code);
        return processActionResponse(result);
    }, [user, processActionResponse]);
    
    const claimDailyCombo = useCallback(async () => {
        if (!user?.id) return { error: 'Not logged in' };
        const result = await API.claimDailyCombo(user.id);
        if (result.player) setPlayerState(result.player);
        return result;
    }, [user]);

    const claimDailyCipher = useCallback(async (cipher: string) => {
        if (!user?.id) return { error: 'Not logged in' };
        const result = await API.claimDailyCipher(user.id, cipher);
        if (result.player) setPlayerState(result.player);
        return result;
    }, [user]);
    
    const openCoinLootbox = useCallback(async (boxType: 'coin') => {
        if (!user?.id) return { error: 'Not logged in' };
        const result = await API.openCoinLootbox(user.id, boxType);
        const processedResult = processActionResponse(result);
        if (processedResult.wonItem) {
            setPurchaseResult({ type: 'lootbox', item: processedResult.wonItem });
        }
        return processedResult;
    }, [user, processActionResponse]);

    const setSkin = useCallback(async (skinId: string) => {
        if (!user?.id) return;
        const result = await API.setSkin(user.id, skinId);
        if (result.player) setPlayerState(result.player);
    }, [user]);

    const connectWallet = useCallback(async () => {
        if (!user) return;
        try {
            const result = await API.connectWallet(user.id, wallet);
            if (result.player) setPlayerState(result.player);
            if (result.message) setWalletConnectionMessage(result.message);
        } catch(e) { console.error(e) };
    }, [wallet, user]);

    const getFriends = useCallback(async () => {
        if(!user) return;
        const friendsList = await API.getFriends(user.id);
        setFriends(friendsList);
    }, [user]);

    // --- Cell Functions ---
    const getMyCell = useCallback(async () => {
        if(!user) return { error: 'Not logged in' };
        return await API.getMyCell(user.id);
    }, [user]);

    const createCell = useCallback(async (name: string) => {
        if(!user) return { error: 'Not logged in' };
        const result = await API.createCell(user.id, name);
        if(result.player) setPlayerState(result.player);
        return result;
    }, [user]);

    const joinCell = useCallback(async (inviteCode: string) => {
        if(!user) return { error: 'Not logged in' };
        const result = await API.joinCell(user.id, inviteCode);
        if(result.player) setPlayerState(result.player);
        return result;
    }, [user]);

    const leaveCell = useCallback(async () => {
        if(!user) return { error: 'Not logged in' };
        const result = await API.leaveCell(user.id);
        if(result.player) setPlayerState(result.player);
        return result;
    }, [user]);
    
    const recruitInformant = useCallback(async () => {
        if(!user) return { error: 'Not logged in' };
        const result = await API.recruitInformant(user.id);
        return processActionResponse(result);
    }, [user, processActionResponse]);

    const buyCellTicket = useCallback(async () => {
        if(!user) return { error: 'Not logged in' };
        return await API.buyCellTicket(user.id);
    }, [user]);

    // --- Battle Functions ---
    const getBattleStatus = useCallback(async () => {
        if(!user) return { error: 'Not logged in' };
        return await API.getBattleStatus(user.id);
    }, [user]);

    const joinBattle = useCallback(async () => {
        if(!user) return { error: 'Not logged in' };
        return await API.joinBattle(user.id);
    }, [user]);
    
    const getBattleLeaderboard = useCallback(async () => {
       return await API.getBattleLeaderboard();
    }, []);

    // --- Effects ---
    useEffect(() => { login() }, [login]);

    useEffect(() => {
        if (!playerState || !effectiveMaxEnergy) return;

        if (energyRegenInterval.current) clearInterval(energyRegenInterval.current);
        
        energyRegenInterval.current = window.setInterval(() => {
            setPlayerState(prev => {
                if (!prev) return null;
                const newEnergy = Math.min(effectiveMaxEnergy, prev.energy + ENERGY_REGEN_RATE);
                if (newEnergy === prev.energy) return prev;
                return { ...prev, energy: newEnergy };
            });
        }, 1000);

        return () => {
            if (energyRegenInterval.current) clearInterval(energyRegenInterval.current);
        };
    }, [playerState?.energy, effectiveMaxEnergy]);
    
    // Periodic sync with server to fetch updates (like admin bonuses)
    useEffect(() => {
        if (!user?.id) return;

        const syncInterval = setInterval(() => {
            // Use the ref to get the latest player state without causing the effect to re-run
            if (playerStateRef.current) {
                // Sending state with 0 taps acts as a sync request.
                // The backend will apply server-side changes (e.g., admin bonus)
                // and return the updated state.
                saveState(playerStateRef.current, 0);
            }
        }, 15000); // Sync every 15 seconds

        return () => clearInterval(syncInterval);
    }, [user, saveState]);

    // Wallet connection synchronization
    useEffect(() => {
        if (!user || !playerState) return;

        const friendlyAddress = wallet ? Address.parse(wallet.account.address).toString({ bounceable: false }) : null;
        const storedAddress = playerState.connectedWallet;

        if (friendlyAddress !== storedAddress) {
            API.connectWallet(user.id, wallet) // `wallet` is null on disconnect
                .then(result => {
                    if (result.player) setPlayerState(result.player);
                    if (result.message) setWalletConnectionMessage(result.message);
                    if (result.error) console.error("Wallet connection error:", result.error);
                })
                .catch(e => console.error("API call to connect wallet failed:", e));
        }
    }, [wallet, user, playerState?.connectedWallet]);


    const allUpgrades = useMemo(() => {
        if (!config || !playerState) return [];
        const combinedUpgrades = [...(config.upgrades || []), ...(config.blackMarketCards || [])];
        return combinedUpgrades.map(u => ({
            ...u,
            level: playerState.upgrades[u.id] || 0
        }));
    }, [config, playerState]);

    const currentLeague = useMemo(() => {
        if (!config?.leagues || !playerState) return null;
        const sortedLeagues = [...config.leagues].sort((a,b) => b.minProfitPerHour - a.minProfitPerHour);
        return sortedLeagues.find(l => playerState.profitPerHour >= l.minProfitPerHour) || sortedLeagues[sortedLeagues.length - 1] || null;
    }, [config, playerState]);
    
    const authContextValue = useMemo(() => ({
        user, isInitializing, isGlitching, setIsGlitching, switchLanguage, login
    }), [user, isInitializing, isGlitching, login, switchLanguage]);

    const gameContextValue = useMemo(() => ({
        playerState, config, handleTap, buyUpgrade, allUpgrades, currentLeague, claimTaskReward, buyBoost,
        purchaseSpecialTask, completeSpecialTask, claimDailyCombo, claimDailyCipher, getLeaderboard: API.getLeaderboard,
        openCoinLootbox, purchaseLootboxWithStars, setSkin, connectWallet, isTurboActive,
        effectiveMaxEnergy, effectiveMaxSuspicion, systemMessage, setSystemMessage, purchaseResult, setPurchaseResult,
        getFriends, friends, getMyCell, createCell, joinCell, leaveCell, recruitInformant, buyCellTicket,
        getBattleStatus, joinBattle, getBattleLeaderboard, walletConnectionMessage, setWalletConnectionMessage
    }), [
        playerState, config, handleTap, buyUpgrade, allUpgrades, currentLeague, claimTaskReward, buyBoost,
        purchaseSpecialTask, completeSpecialTask, claimDailyCombo, claimDailyCipher,
        openCoinLootbox, purchaseLootboxWithStars, setSkin, connectWallet, isTurboActive,
        effectiveMaxEnergy, effectiveMaxSuspicion, systemMessage, setSystemMessage, purchaseResult, setPurchaseResult,
        getFriends, friends, getMyCell, createCell, joinCell, leaveCell, recruitInformant, buyCellTicket,
        getBattleStatus, joinBattle, getBattleLeaderboard, walletConnectionMessage, setWalletConnectionMessage
    ]);

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

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (context === undefined) throw new Error('useGame must be used within an AuthProvider');
    return context;
};

export const useTranslation = () => {
    const { user } = useAuth();
    const lang = user?.language || 'en';
    return useCallback((key: keyof typeof TRANSLATIONS.en, params: Record<string, string | number> = {}) => {
        let translation = TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || `[${key}]`;
        Object.entries(params).forEach(([paramKey, paramValue]) => {
            translation = translation.replace(`{${paramKey}}`, String(paramValue));
        });
        return translation;
    }, [lang]);
};