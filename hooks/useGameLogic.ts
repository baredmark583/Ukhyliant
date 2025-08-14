

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import {
    User, PlayerState, GameConfig, Language, DailyTask, SpecialTask, Boost,
    Upgrade, League, Friend
} from '../types';
import { TRANSLATIONS, INITIAL_MAX_ENERGY, ENERGY_REGEN_RATE, SAVE_DEBOUNCE_MS } from '../constants';

// --- Interfaces for Context ---
interface IAuthContext {
    user: User | null;
    isInitializing: boolean;
    isGlitching: boolean;
    setIsGlitching: React.Dispatch<React.SetStateAction<boolean>>;
    switchLanguage: (lang: Language) => void;
}

interface IGameContext {
    playerState: PlayerState | null;
    config: GameConfig | null;
    currentLeague: League | null;
    allUpgrades: (Upgrade & { level: number })[];
    handleTap: () => number;
    buyUpgrade: (upgradeId: string) => Promise<any>;
    buyBoost: (boost: Boost) => Promise<any>;
    claimTaskReward: (task: DailyTask, code?: string) => Promise<any>;
    purchaseSpecialTask: (task: SpecialTask) => Promise<any>;
    completeSpecialTask: (task: SpecialTask, code?: string) => Promise<any>;
    claimDailyCombo: () => Promise<any>;
    claimDailyCipher: (cipher: string) => Promise<any>;
    getLeaderboard: () => Promise<any>;
    getFriends: () => Promise<void>;
    friends: Friend[] | null;
    setSkin: (skinId: string) => Promise<any>;
    openCoinLootbox: (boxType: 'coin') => Promise<any>;
    purchaseLootboxWithStars: (boxType: 'star') => Promise<any>;
    connectWallet: () => void;
    isTurboActive: boolean;
    effectiveMaxEnergy: number;
    effectiveMaxSuspicion: number;
    systemMessage: string;
    setSystemMessage: (message: string) => void;
    purchaseResult: { type: 'lootbox' | 'task', item: any } | null;
    setPurchaseResult: React.Dispatch<React.SetStateAction<{ type: 'lootbox' | 'task', item: any } | null>>;
    walletConnectionMessage: string;
    setWalletConnectionMessage: React.Dispatch<React.SetStateAction<string>>;
    getMyCell: () => Promise<any>;
    createCell: (name: string) => Promise<any>;
    joinCell: (inviteCode: string) => Promise<any>;
    leaveCell: () => Promise<any>;
    recruitInformant: () => Promise<any>;
    buyCellTicket: () => Promise<any>;
    getBattleStatus: () => Promise<any>;
    joinBattle: () => Promise<any>;
    getBattleLeaderboard: () => Promise<any>;
}

interface ITranslationContext {
    t: (key: keyof typeof TRANSLATIONS['en'], params?: Record<string, string | number>) => string;
}

// --- Context Creation ---
const AuthContext = createContext<IAuthContext | null>(null);
const GameContext = createContext<IGameContext | null>(null);
const TranslationContext = createContext<ITranslationContext | null>(null);

// --- Provider Component ---
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [playerState, setPlayerState] = useState<PlayerState | null>(null);
    const [config, setConfig] = useState<GameConfig | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isGlitching, setIsGlitching] = useState(false);
    const [friends, setFriends] = useState<Friend[] | null>(null);
    
    // Game states
    const [systemMessage, _setSystemMessage] = useState('');
    const [purchaseResult, setPurchaseResult] = useState<{ type: 'lootbox' | 'task', item: any } | null>(null);
    const [walletConnectionMessage, setWalletConnectionMessage] = useState('');
    const [isTurboActive, setIsTurboActive] = useState(false);
    const tapsToSave = useRef(0);
    const saveTimeout = useRef<number | null>(null);

    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();

    const switchLanguage = useCallback(async (lang: Language) => {
        if (user && user.language !== lang) {
            setUser(prev => prev ? { ...prev, language: lang } : null);
            await fetch('/api/user/' + user.id + '/language', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: lang }),
            });
            if (lang !== 'ua') {
                setIsGlitching(true);
            }
        }
    }, [user]);

    const t = useCallback((key: keyof typeof TRANSLATIONS['en'], params: Record<string, string | number> = {}) => {
        const lang = user?.language || 'en';
        let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en']?.[key] || `[${key}]`;
        for (const p in params) {
            text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), String(params[p]));
        }
        return text;
    }, [user?.language]);

    const callApi = useCallback(async (endpoint: string, method: 'GET' | 'POST' = 'GET', body?: object) => {
        try {
            const response = await fetch(`/api/${endpoint}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                ...(body && { body: JSON.stringify(body) })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Request failed with status ${response.status}`);
            }
            return await response.json();
        } catch (error: any) {
            console.error(`API call to ${endpoint} failed:`, error);
            return { error: error.message };
        }
    }, []);

    const callGameAction = useCallback(async (action: string, body: object) => {
        const result = await callApi(`action/${action}`, 'POST', { userId: user?.id, ...body });
        if (result.player) {
            setPlayerState(result.player);
        }
        return result;
    }, [user?.id, callApi]);
    
    // *** THE FIX IS HERE ***
    const acknowledgePenalty = useCallback(async () => {
        if (!user) return;
        await callGameAction('acknowledge-penalty', {});
    }, [user, callGameAction]);

    const setSystemMessage = useCallback(async (message: string) => {
        _setSystemMessage(message);
        if (message === '') {
            // When the modal is closed and the message is cleared,
            // we call the backend to acknowledge the penalty.
            await acknowledgePenalty();
        }
    }, [acknowledgePenalty]);
    
    // Check for penalty messages when player state updates
    useEffect(() => {
        if (playerState?.penaltyLog && playerState.penaltyLog.length > 0) {
            const lastPenalty = playerState.penaltyLog[playerState.penaltyLog.length - 1];
            if (lastPenalty.message) {
                _setSystemMessage(lastPenalty.message);
            }
        }
    }, [playerState]);

    const saveState = useCallback(() => {
        if (!user || !playerState || tapsToSave.current === 0) return;
        
        const currentTaps = tapsToSave.current;
        const newBalance = (playerState.balance || 0) + currentTaps;
        const newState = { ...playerState, balance: newBalance };
        tapsToSave.current = 0;
        
        callApi(`player/${user.id}`, 'POST', { state: newState, taps: currentTaps })
            .then(res => {
                if(res.player) setPlayerState(res.player); // Sync with server state if provided
            });

    }, [user, playerState, callApi]);

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (!tg) {
            setIsInitializing(false);
            return;
        }
        tg.ready();
        
        const initData = tg.initDataUnsafe;
        const tgUser = initData.user;
        const startParam = initData.start_param;

        if (!tgUser) {
             setIsInitializing(false);
             return;
        }

        callApi('login', 'POST', { tgUser, startParam }).then(data => {
            if (data && data.user && data.player && data.config) {
                setUser(data.user);
                setPlayerState(data.player);
                setConfig(data.config);
            }
        }).finally(() => setIsInitializing(false));
    }, [callApi]);

    // Energy regeneration loop
    useEffect(() => {
        const interval = setInterval(() => {
            setPlayerState(prev => {
                if (!prev) return null;
                const maxEnergy = INITIAL_MAX_ENERGY + (prev.energyLimitLevel || 0) * 500;
                if (prev.energy >= maxEnergy) return prev;
                return { ...prev, energy: Math.min(maxEnergy, prev.energy + ENERGY_REGEN_RATE) };
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // State saving debounce loop
    useEffect(() => {
        const interval = setInterval(() => {
            if (tapsToSave.current > 0) {
                 if (!saveTimeout.current) {
                     saveTimeout.current = window.setTimeout(() => {
                         saveState();
                         saveTimeout.current = null;
                     }, SAVE_DEBOUNCE_MS);
                 }
            }
        }, 200);
        return () => clearInterval(interval);
    }, [saveState]);

    // --- Memoized Values for Context ---
    const authContextValue = useMemo(() => ({
        user, isInitializing, isGlitching, setIsGlitching, switchLanguage
    }), [user, isInitializing, isGlitching, switchLanguage]);

    const gameContextValue = useMemo(() => {
        const allUpgrades = [
            ...(config?.upgrades || []),
            ...(config?.blackMarketCards || [])
        ].map(u => ({
            ...u,
            level: playerState?.upgrades?.[u.id] || 0
        }));

        const currentLeague = [...(config?.leagues || [])]
            .sort((a, b) => b.minProfitPerHour - a.minProfitPerHour)
            .find(l => (playerState?.profitPerHour || 0) >= l.minProfitPerHour) || null;

        const handleTap = () => {
            if (!playerState || playerState.energy < 1) return 0;

            const skinBoost = (config?.coinSkins?.find(s => s.id === playerState.currentSkinId)?.profitBoostPercent || 0) / 100;
            const guruBoost = Math.pow(1.5, playerState.tapGuruLevel || 0);
            const turboMultiplier = isTurboActive ? 5 : 1;
            
            const tapValue = 1 * guruBoost * (1 + skinBoost) * turboMultiplier;

            if (playerState.energy >= tapValue) {
                tapsToSave.current += tapValue;
                setPlayerState(p => p ? { ...p, energy: p.energy - tapValue, dailyTaps: (p.dailyTaps || 0) + 1 } : null);
                window.Telegram?.WebApp.HapticFeedback.impactOccurred('light');
                return tapValue;
            }
            return 0;
        };
        
        const connectWallet = async () => {
            if (!user || !wallet) return;
            const result = await callApi('user/connect-wallet', 'POST', { userId: user.id, walletData: wallet });
            if (result.player) {
                setPlayerState(result.player);
                setWalletConnectionMessage(t('wallet_connected'));
            }
        };

        return {
            playerState, config, allUpgrades, currentLeague, friends,
            handleTap,
            buyUpgrade: (upgradeId: string) => callGameAction('buy-upgrade', { upgradeId }),
            buyBoost: (boost: Boost) => callGameAction('buy-boost', { boostId: boost.id }),
            claimTaskReward: (task: DailyTask, code?: string) => callGameAction('claim-task', { taskId: task.id, code }),
            purchaseSpecialTask: async (task: SpecialTask) => {
                if (task.priceStars > 0) {
                    const res = await callApi('create-star-invoice', 'POST', { userId: user?.id, payloadType: 'task', itemId: task.id });
                    if (res?.invoiceLink) {
                        window.Telegram?.WebApp.openInvoice(res.invoiceLink, async (status) => {
                            if (status === 'paid') {
                                window.Telegram?.WebApp.HapticFeedback.notificationOccurred('success');
                                const syncResult = await callApi('sync-after-payment', 'POST', { userId: user?.id });
                                if (syncResult.player) setPlayerState(syncResult.player);
                                if (syncResult.wonItem) setPurchaseResult(syncResult.wonItem);
                            } else if (status === 'failed' || status === 'cancelled') {
                                window.Telegram?.WebApp.HapticFeedback.notificationOccurred('error');
                            }
                        });
                    }
                } else {
                     return callGameAction('unlock-free-task', { taskId: task.id });
                }
            },
            completeSpecialTask: (task: SpecialTask, code?: string) => callGameAction('complete-task', { taskId: task.id, code }),
            claimDailyCombo: () => callGameAction('claim-combo', {}),
            claimDailyCipher: (cipher: string) => callGameAction('claim-cipher', { cipher }),
            getLeaderboard: () => callApi('leaderboard'),
            getFriends: async () => {
                const res = await callApi(`user/${user?.id}/friends`);
                if(res && !res.error) setFriends(res);
            },
            openCoinLootbox: (boxType: 'coin') => callGameAction('open-lootbox', { boxType }),
            purchaseLootboxWithStars: async (boxType: 'star') => {
                 const res = await callApi('create-star-invoice', 'POST', { userId: user?.id, payloadType: 'lootbox', itemId: boxType });
                 if (res?.invoiceLink) {
                     window.Telegram?.WebApp.openInvoice(res.invoiceLink, async (status) => {
                        if (status === 'paid') {
                            window.Telegram?.WebApp.HapticFeedback.notificationOccurred('success');
                            const syncResult = await callApi('sync-after-payment', 'POST', { userId: user?.id });
                            if (syncResult.player) setPlayerState(syncResult.player);
                            if (syncResult.wonItem) setPurchaseResult(syncResult.wonItem);
                        } else if (status === 'failed' || status === 'cancelled') {
                            window.Telegram?.WebApp.HapticFeedback.notificationOccurred('error');
                        }
                    });
                 }
                 return res;
            },
            setSkin: (skinId: string) => callGameAction('set-skin', { skinId }),
            connectWallet,
            isTurboActive,
            effectiveMaxEnergy: INITIAL_MAX_ENERGY + (playerState?.energyLimitLevel || 0) * 500,
            effectiveMaxSuspicion: 100 + (playerState?.suspicionLimitLevel || 0) * 10,
            systemMessage, setSystemMessage,
            purchaseResult, setPurchaseResult,
            walletConnectionMessage, setWalletConnectionMessage,
            getMyCell: () => callApi('cell/my-cell', 'GET', { userId: user?.id }),
            createCell: (name: string) => callGameAction('cell/create', { name }),
            joinCell: (inviteCode: string) => callGameAction('cell/join', { inviteCode }),
            leaveCell: () => callGameAction('cell/leave', {}),
            recruitInformant: () => callGameAction('informant/recruit', {}),
            buyCellTicket: () => callGameAction('cell/buy-ticket', {}),
            getBattleStatus: () => callApi('battle/status', 'GET', {userId: user?.id}),
            joinBattle: () => callGameAction('battle/join', {}),
            getBattleLeaderboard: () => callApi('battle/leaderboard'),
        };
    }, [playerState, config, user, isTurboActive, systemMessage, setSystemMessage, callGameAction, callApi, tonConnectUI, wallet, t, friends, purchaseResult, walletConnectionMessage]);

    return React.createElement(AuthContext.Provider, { value: authContextValue },
        React.createElement(GameContext.Provider, { value: gameContextValue },
            React.createElement(TranslationContext.Provider, { value: { t } },
                children
            )
        )
    );
};

// --- Custom Hooks ---
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error('useGame must be used within an AuthProvider');
    return context;
};

export const useTranslation = () => {
    const context = useContext(TranslationContext);
    if (!context) throw new Error('useTranslation must be used within an AuthProvider');
    return context.t;
};
