


import React, { useState, useEffect } from 'react';
import { useGame, useAuth, useTranslation, AuthProvider } from './hooks/useGameLogic';
import ExchangeScreen from './sections/Exchange';
import MineScreen from './sections/Mine';
import BoostScreen from './sections/Boost';
import CellScreen from './sections/Cell';
import { REFERRAL_BONUS, TELEGRAM_BOT_NAME, MINI_APP_NAME, LOOTBOX_COST_COINS, LOOTBOX_COST_STARS } from './constants';
import { DailyTask, GameConfig, Language, LeaderboardPlayer, SpecialTask, PlayerState, User, Boost, CoinSkin, League, UiIcons, Cell } from './types';
import NotificationToast from './components/NotificationToast';
import SecretCodeModal from './components/SecretCodeModal';

type Screen = 'exchange' | 'mine' | 'missions' | 'airdrop' | 'profile';
type ProfileTab = 'contacts' | 'boosts' | 'skins' | 'market' | 'cell';

const formatNumber = (num: number): string => {
  if (num === null || num === undefined) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString('en-US');
};

const AppContainer: React.FC = () => {
    const { user, isInitializing } = useAuth();
    
    if (isInitializing) {
        return <div className="h-screen w-screen" />;
    }

    if (!user) {
        return <NotInTelegramScreen />;
    }

    return <MainApp />;
};

const LoadingScreen: React.FC<{imageUrl?: string}> = ({ imageUrl }) => (
    <div className="h-screen w-screen relative overflow-hidden bg-gray-900">
        {imageUrl ? (
            <img 
                src={imageUrl} 
                alt="Loading..." 
                className="absolute top-0 left-0 w-full h-full object-cover"
            />
        ) : (
            <div className="w-full h-full flex flex-col justify-center items-center p-4">
                <h1 className="text-4xl font-display mb-2 text-white">Ukhyliant Clicker</h1>
                <p className="text-lg animate-pulse text-gray-300">Connecting...</p>
            </div>
        )}
    </div>
);

const NotInTelegramScreen: React.FC = () => (
    <div className="h-screen w-screen flex flex-col justify-center items-center p-4 text-center">
        <h1 className="text-4xl font-display mb-2">Ukhyliant Clicker</h1>
        <p className="text-gray-400 mb-8 text-6xl">🚫</p>
        <h2 className="text-2xl font-semibold mb-2">Error</h2>
        <p className="text-lg text-gray-300">This application must be launched from within Telegram.</p>
    </div>
);

const TabButton = ({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-bold transition-all w-full text-center border-b-2 ${
            isActive ? 'border-green-400 text-green-300' : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
        }`}
    >
        {label}
    </button>
);

interface ProfileScreenProps {
  playerState: PlayerState;
  user: User;
  config: GameConfig;
  onBuyBoost: (boost: Boost) => void;
  onSetSkin: (skinId: string) => void;
  onOpenCoinLootbox: (boxType: 'coin') => void;
  onPurchaseStarLootbox: (boxType: 'star') => void;
}

const ProfileScreen = ({ playerState, user, config, onBuyBoost, onSetSkin, onOpenCoinLootbox, onPurchaseStarLootbox } : ProfileScreenProps) => {
    const t = useTranslation();
    const [activeTab, setActiveTab] = useState<ProfileTab>('contacts');
    
    const ContactsContent = () => {
        const [copied, setCopied] = useState(false);
        const handleCopyReferral = () => {
            const referralLink = `https://t.me/${TELEGRAM_BOT_NAME}/${MINI_APP_NAME}?startapp=${user.id}`;
            navigator.clipboard.writeText(referralLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };
        return (
            <div className="w-full max-w-md space-y-4 text-center">
                <div className="themed-container p-4">
                    <p className="text-gray-400 text-lg">{t('your_referrals')}</p>
                    <p className="text-5xl font-display my-1">{playerState.referrals}</p>
                </div>
                <div className="themed-container p-4">
                    <p className="text-gray-400 text-lg">{t('referral_bonus')}</p>
                    <p className="text-2xl font-bold my-1 flex items-center justify-center space-x-2">
                        <span>+{REFERRAL_BONUS.toLocaleString()}</span>
                        <img src={config.uiIcons.coin} alt="coin" className="w-6 h-6" />
                    </p>
                </div>
                 <div className="themed-container p-4">
                    <p className="text-gray-400 text-lg">{t('profit_from_referrals')}</p>
                    <p className="text-2xl font-bold my-1 flex items-center justify-center space-x-2 text-green-400">
                        <span>+{formatNumber(playerState.referralProfitPerHour)}/hr</span>
                        <img src={config.uiIcons.energy} alt="energy" className="w-6 h-6" />
                    </p>
                </div>
                <button onClick={handleCopyReferral} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 text-lg transition-transform duration-100 active:scale-95">
                    {copied ? t('copied') : t('invite_friends')}
                </button>
            </div>
        );
    };
    
    const SkinsContent = () => {
        const unlockedSkins = (config.coinSkins || []).filter(skin => playerState.unlockedSkins.includes(skin.id));
        return (
            <div className="w-full max-w-md">
                <p className="text-center text-gray-400 mb-4 max-w-xs mx-auto">{t('skins_gallery_desc')}</p>
                <div className="grid grid-cols-3 gap-4">
                    {unlockedSkins.map(skin => {
                        const isSelected = playerState.currentSkinId === skin.id;
                        return (
                            <div key={skin.id} className={`themed-container p-3 flex flex-col items-center text-center ${isSelected ? 'border-2 border-green-400' : ''}`}>
                                <div className="w-16 h-16 mb-2 flex items-center justify-center">
                                    <img src={skin.iconUrl} alt={skin.name[user.language]} className="w-full h-full object-contain" />
                                </div>
                                <p className="text-xs font-bold leading-tight">{skin.name[user.language]}</p>
                                <p className="text-xs text-green-400 mt-1">+{skin.profitBoostPercent}%</p>
                                <button
                                    onClick={() => onSetSkin(skin.id)}
                                    disabled={isSelected}
                                    className="w-full mt-2 py-1 text-xs font-bold disabled:bg-green-500 disabled:text-black bg-blue-600 hover:bg-blue-500 text-white"
                                >
                                    {isSelected ? t('selected') : t('select_skin')}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };
    
    const MarketContent = () => (
        <div className="w-full max-w-md space-y-6">
            <p className="text-center text-gray-400 max-w-xs mx-auto">{t('black_market_desc')}</p>
            <div className="themed-container p-6 text-center border-2 border-yellow-500/50">
                <div className="h-24 w-24 mx-auto mb-4 flex items-center justify-center">
                    <img src={config.uiIcons.marketCoinBox} alt={t('lootbox_coin')} className="w-full h-full object-contain" />
                </div>
                <h2 className="text-2xl font-display mb-2">{t('lootbox_coin')}</h2>
                <button onClick={() => onOpenCoinLootbox('coin')} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-4 text-lg transition-transform duration-100 active:scale-95 flex items-center justify-center space-x-2">
                    <span>{t('open_for')} {LOOTBOX_COST_COINS.toLocaleString()}</span>
                    <img src={config.uiIcons.coin} alt="coin" className="w-6 h-6" />
                </button>
            </div>
            <div className="themed-container p-6 text-center border-2 border-blue-500/50">
                 <div className="h-24 w-24 mx-auto mb-4 flex items-center justify-center">
                    <img src={config.uiIcons.marketStarBox} alt={t('lootbox_star')} className="w-full h-full object-contain" />
                </div>
                <h2 className="text-2xl font-display mb-2">{t('lootbox_star')}</h2>
                <button onClick={() => onPurchaseStarLootbox('star')} className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 px-4 text-lg transition-transform duration-100 active:scale-95 flex items-center justify-center space-x-2">
                    <span>{t('open_for')} {LOOTBOX_COST_STARS}</span>
                    <img src={config.uiIcons.star} alt="star" className="w-6 h-6" />
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full text-white pt-4 px-4 items-center">
            <div className="w-full max-w-md sticky top-0 bg-gray-900/80 backdrop-blur-sm py-4 z-10">
                <h1 className="text-3xl font-display text-center mb-4">{t('profile')}</h1>
                <div className="grid grid-cols-5 gap-1 themed-container p-1">
                  <TabButton label={t('sub_contacts')} isActive={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} />
                  <TabButton label={t('sub_boosts')} isActive={activeTab === 'boosts'} onClick={() => setActiveTab('boosts')} />
                  <TabButton label={t('sub_disguise')} isActive={activeTab === 'skins'} onClick={() => setActiveTab('skins')} />
                  <TabButton label={t('sub_market')} isActive={activeTab === 'market'} onClick={() => setActiveTab('market')} />
                  <TabButton label={t('sub_cell')} isActive={activeTab === 'cell'} onClick={() => setActiveTab('cell')} />
                </div>
            </div>
            
            <div className="w-full max-w-md flex-grow overflow-y-auto no-scrollbar pt-4 flex justify-center">
                {activeTab === 'contacts' && <ContactsContent />}
                {activeTab === 'boosts' && <BoostScreen playerState={playerState} boosts={config.boosts} onBuyBoost={onBuyBoost} lang={user.language} uiIcons={config.uiIcons} />}
                {activeTab === 'skins' && <SkinsContent />}
                {activeTab === 'market' && <MarketContent />}
                {activeTab === 'cell' && <CellScreen />}
            </div>
        </div>
    );
};

const TaskCard = ({ task, playerState, onClaim, onPurchase, lang, startedVideoTasks, uiIcons }: { 
    task: DailyTask | SpecialTask, 
    playerState: PlayerState, 
    onClaim: (task: DailyTask | SpecialTask) => void, 
    onPurchase?: (task: SpecialTask) => void,
    lang: Language, 
    startedVideoTasks: Set<string>, 
    uiIcons: UiIcons 
}) => {
    const t = useTranslation();
    const isDaily = !('isOneTime' in task);
    const isCompleted = isDaily 
        ? playerState.completedDailyTaskIds.includes(task.id) 
        : playerState.completedSpecialTaskIds.includes(task.id);
    
    const isPurchased = isDaily ? true : playerState.purchasedSpecialTaskIds.includes(task.id);

    let progressDisplay: string | null = null;
    let claimIsDisabled = false;

    if (isDaily && task.type === 'taps') {
        const required = task.requiredTaps || 0;
        const progress = Math.min(playerState.dailyTaps, required);
        if (!isCompleted) {
            progressDisplay = `${progress}/${required}`;
        }
        if (progress < required) {
            claimIsDisabled = true;
        }
    }
    
    const getButton = () => {
        if (isCompleted) {
            return <button disabled className="bg-gray-700 text-gray-500 font-bold py-2 px-4 text-sm w-32 text-center">{t('completed')}</button>;
        }

        if (!isDaily && (task as SpecialTask).priceStars > 0 && !isPurchased && onPurchase) {
            return (
                <button onClick={() => onPurchase(task as SpecialTask)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-3 text-sm flex items-center justify-center space-x-1.5 min-w-[128px]">
                    <span>{t('unlock_for')} {(task as SpecialTask).priceStars}</span>
                    <img src={uiIcons.star} alt="star" className="w-4 h-4"/>
                </button>
            );
        }

        let buttonText = t('go_to_task');
        if (task.type === 'taps') {
            buttonText = t('claim');
        }
        if (task.type === 'video_code' && startedVideoTasks.has(task.id)) {
            buttonText = t('enter_secret_code');
        }

        return (
            <button onClick={() => onClaim(task)} disabled={claimIsDisabled} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 text-sm w-32 text-center disabled:bg-gray-600 disabled:cursor-not-allowed">
                {progressDisplay || buttonText}
            </button>
        );
    };
    
    const rewardIconUrl = task.reward?.type === 'profit' ? uiIcons.energy : uiIcons.coin;
    
    return (
         <div className={`themed-container p-3 flex items-center justify-between space-x-3 transition-opacity ${isCompleted ? 'opacity-60' : ''}`}>
            <div className="flex items-center space-x-3 flex-grow min-w-0">
                {task.imageUrl && (
                    <div className="border border-gray-700 p-1 w-14 h-14 flex-shrink-0 bg-black/20">
                        <img src={task.imageUrl} alt={task.name?.[lang]} className="w-full h-full object-contain" />
                    </div>
                )}
                <div className="flex-grow min-w-0">
                    <p className="text-white text-left font-semibold truncate" title={task.name?.[lang]}>{task.name?.[lang]}</p>
                    {'description' in task && <p className="text-gray-400 text-xs truncate" title={(task as SpecialTask).description?.[lang]}>{(task as SpecialTask).description?.[lang]}</p>}
                    <div className="text-yellow-400 text-sm text-left mt-1 flex items-center space-x-1 font-bold">
                        <img src={rewardIconUrl} alt="reward" className="w-4 h-4" />
                        <span>+{task.reward.amount.toLocaleString()}</span>
                        {task.reward.type === 'profit' && <span className="text-gray-400 font-normal ml-1">/hr</span>}
                    </div>
                </div>
            </div>
            <div className="flex-shrink-0">
                {getButton()}
            </div>
        </div>
    );
};

const MissionsScreen: React.FC<{
    tasks: DailyTask[];
    playerState: PlayerState;
    onClaim: (task: DailyTask | SpecialTask) => void;
    lang: Language;
    startedVideoTasks: Set<string>;
    uiIcons: UiIcons;
}> = ({ tasks, playerState, onClaim, lang, startedVideoTasks, uiIcons }) => {
    const t = useTranslation();
    return (
        <div className="flex flex-col h-full text-white pt-4 px-4">
            <h1 className="text-3xl font-display text-center mb-6">{t('missions')}</h1>
            <div className="overflow-y-auto space-y-3 flex-grow no-scrollbar">
                {tasks.map(task => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        playerState={playerState}
                        onClaim={onClaim}
                        lang={lang}
                        startedVideoTasks={startedVideoTasks}
                        uiIcons={uiIcons}
                    />
                ))}
            </div>
        </div>
    );
};

const AirdropScreen: React.FC<{
    specialTasks: SpecialTask[];
    playerState: PlayerState;
    onClaim: (task: DailyTask | SpecialTask) => void;
    onPurchase: (task: SpecialTask) => void;
    lang: Language;
    startedVideoTasks: Set<string>;
    uiIcons: UiIcons;
}> = ({ specialTasks, playerState, onClaim, onPurchase, lang, startedVideoTasks, uiIcons }) => {
    const t = useTranslation();
    return (
        <div className="flex flex-col h-full text-white pt-4 px-4">
            <h1 className="text-3xl font-display text-center mb-2">{t('airdrop_tasks')}</h1>
            <p className="text-center text-gray-400 mb-6">{t('airdrop_description')}</p>
            <div className="overflow-y-auto space-y-3 flex-grow no-scrollbar">
                {specialTasks.map(task => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        playerState={playerState}
                        onClaim={onClaim}
                        onPurchase={onPurchase}
                        lang={lang}
                        startedVideoTasks={startedVideoTasks}
                        uiIcons={uiIcons}
                    />
                ))}
            </div>
        </div>
    );
};

const LeaderboardScreen: React.FC<{
    onClose: () => void;
    getLeaderboard: () => Promise<{ topPlayers: LeaderboardPlayer[]; totalPlayers: number } | null>;
    user: User;
    currentLeague: League | null;
}> = ({ onClose, getLeaderboard, user, currentLeague }) => {
    const t = useTranslation();
    const [data, setData] = useState<{ topPlayers: LeaderboardPlayer[]; totalPlayers: number } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getLeaderboard().then(leaderboardData => {
            setData(leaderboardData);
            setLoading(false);
        });
    }, [getLeaderboard]);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col p-4" onClick={onClose}>
            <div className="themed-container w-full max-w-lg mx-auto flex flex-col p-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-display text-white">{t('leaderboard')}</h2>
                    <button onClick={onClose} className="text-gray-400 text-3xl font-light">&times;</button>
                </div>
                {loading ? <p className="text-center text-gray-400 py-8">{t('loading')}</p> : (
                    <>
                        <div className="themed-container p-3 mb-4 flex justify-between items-center">
                            <div>
                                <p className="text-sm text-gray-400">{t('your_league')}</p>
                                <p className="font-bold text-lg text-white">{currentLeague?.name[user.language] || 'N/A'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-400">{t('total_players')}</p>
                                <p className="font-bold text-lg text-white">{data?.totalPlayers.toLocaleString() || 0}</p>
                            </div>
                        </div>
                        <div className="overflow-y-auto space-y-2" style={{maxHeight: '60vh'}}>
                            {data?.topPlayers.map((player, index) => (
                                <div key={player.id} className="bg-black/20 p-2 flex items-center space-x-3 text-sm">
                                    <span className="font-bold w-6 text-center">{index + 1}</span>
                                    <img src={player.leagueIconUrl} alt="league" className="w-8 h-8"/>
                                    <span className="flex-grow font-semibold text-white truncate">{player.name}</span>
                                    <span className="text-green-400 font-mono">+{formatNumber(player.profitPerHour)}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const LootboxResultModal: React.FC<{
    item: CoinSkin | { name: any; iconUrl: string; profitPerHour: number; }; // Can be CoinSkin or BlackMarketCard
    onClose: () => void;
    lang: Language;
    uiIcons: UiIcons;
}> = ({ item, onClose, lang, uiIcons }) => {
    const t = useTranslation();

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="themed-container w-full max-w-sm flex flex-col p-6 items-center" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-4">{t('won_item')}!</h2>
                <div className="w-32 h-32 mb-4 border border-gray-600 p-2 flex items-center justify-center">
                    <img src={item.iconUrl} alt={item.name[lang]} className="w-full h-full object-contain" />
                </div>
                <p className="text-lg font-bold text-white mb-2">{item.name[lang]}</p>
                {'profitBoostPercent' in item && item.profitBoostPercent > 0 && <p className="text-green-400">+{item.profitBoostPercent}% {t('profit_boost')}</p>}
                {'profitPerHour' in item && <p className="text-green-400">+{item.profitPerHour.toLocaleString()}/hr</p>}
                
                <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 mt-6 text-lg">
                    {t('close')}
                </button>
            </div>
        </div>
    );
};

const MainApp: React.FC = () => {
  const { user, isGlitching, setIsGlitching } = useAuth();
  const { 
      playerState, config, handleTap, buyUpgrade, allUpgrades, currentLeague, 
      claimTaskReward, buyBoost, purchaseSpecialTask, completeSpecialTask,
      claimDailyCombo, claimDailyCipher, getLeaderboard, 
      openCoinLootbox, purchaseLootboxWithStars, 
      setSkin,
      isTurboActive, effectiveMaxEnergy
  } = useGame();
  const [activeScreen, setActiveScreen] = React.useState<Screen>('exchange');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const t = useTranslation();
  const [startedVideoTasks, setStartedVideoTasks] = useState<Set<string>>(new Set());
  const [secretCodeTask, setSecretCodeTask] = useState<DailyTask | SpecialTask | null>(null);
  const [lootboxResult, setLootboxResult] = useState<any>(null);
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAppReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);
  

  if (!isAppReady || !user || !playerState || !config) {
    return <LoadingScreen imageUrl={config?.loadingScreenImageUrl} />;
  }
  
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
        setNotification(prev => (prev?.message === message ? null : prev));
    }, 3000);
  };
  
  const handleBuyUpgrade = async (upgradeId: string) => {
    const result = await buyUpgrade(upgradeId);
    if(result) {
        const upgrade = allUpgrades.find(u => u.id === upgradeId);
        showNotification(`${upgrade?.name?.[user.language]} Lvl ${result.upgrades[upgradeId]}`);
    }
  };
  
  const handleBuyBoost = async (boost: Boost) => {
    const result = await buyBoost(boost);
    if (result.player) {
        showNotification(t('boost_purchased'), 'success');
    } else if (result.error) {
        showNotification(result.error, 'error');
    }
  };

  const handleClaimDailyTaskReward = async (task: DailyTask, code?: string) => {
    const result = await claimTaskReward(task, code);
    if (result.player) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        const rewardText = task.reward?.type === 'profit'
            ? `+${task.reward?.amount?.toLocaleString() ?? 0}/hr <img src="${config.uiIcons.energy}" class="w-4 h-4 inline-block -mt-1"/>`
            : `+${task.reward?.amount?.toLocaleString() ?? 0} <img src="${config.uiIcons.coin}" class="w-4 h-4 inline-block -mt-1"/>`;
        showNotification(`${task.name?.[user.language]} ${t('task_completed')} <span class="whitespace-nowrap">${rewardText}</span>`, 'success');
        
        if (task.type === 'video_code') {
            setStartedVideoTasks(prev => {
                const newSet = new Set(prev);
                newSet.delete(task.id);
                return newSet;
            });
        }
    } else if (result.error) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        showNotification(result.error, 'error');
    }
    return result;
  };

  const handleCompleteSpecialTask = async (task: SpecialTask, code?: string) => {
    const updatedPlayerState = await completeSpecialTask(task, code);
    if (updatedPlayerState) {
        if (task.type === 'video_code') {
            setStartedVideoTasks(prev => {
                const newSet = new Set(prev);
                newSet.delete(task.id);
                return newSet;
            });
        }
    }
    return updatedPlayerState;
  };
  
  const handleClaimTask = async (task: DailyTask | SpecialTask) => {
    const isVideoCodeTask = task.type === 'video_code';
    const isVideoTaskStarted = isVideoCodeTask && startedVideoTasks.has(task.id);

    if (isVideoCodeTask) {
        if (!isVideoTaskStarted) {
            if (task.url) window.Telegram.WebApp.openLink(task.url);
            setStartedVideoTasks(prev => new Set(prev).add(task.id));
            return;
        } else {
            setSecretCodeTask(task);
            return;
        }
    }

    if (task.url) {
        if (task.url.startsWith('https://t.me/')) {
            window.Telegram.WebApp.openTelegramLink(task.url);
        } else {
            window.Telegram.WebApp.openLink(task.url);
        }
    }
    
    if ('isOneTime' in task) {
        await handleCompleteSpecialTask(task);
    } else {
        if (task.type !== 'taps') await handleClaimDailyTaskReward(task as DailyTask);
        else await handleClaimDailyTaskReward(task as DailyTask);
    }
  };
  
  const handleClaimCombo = async () => {
    const result = await claimDailyCombo();
    if (result.player && result.reward) {
        showNotification(`${t('combo_collected')} +${result.reward.toLocaleString()}`, 'success');
    } else if (result.error) {
        showNotification(result.error, 'error');
    }
  };

  const handleClaimCipher = async (cipher: string): Promise<boolean> => {
    const result = await claimDailyCipher(cipher);
    if (result.player) {
        const rewardAmount = result.reward || 0;
        if (rewardAmount > 0) {
            showNotification(`${t('cipher_solved')} +${rewardAmount.toLocaleString()}`, 'success');
        } else {
            showNotification(t('cipher_solved'), 'success');
        }
        return true;
    } else if (result.error) {
        showNotification(result.error, 'error');
    }
    return false;
  };

  const handleOpenCoinLootbox = async (boxType: 'coin') => {
      const result = await openCoinLootbox(boxType);
      if(result.wonItem) {
          setLootboxResult(result.wonItem);
      } else if (result.error) {
          showNotification(result.error, 'error');
      }
  };
  
  const handlePurchaseStarLootbox = async (boxType: 'star') => {
      const result = await purchaseLootboxWithStars(boxType);
      if (result?.error) {
          showNotification(result.error, 'error');
      }
  };
  
  const handleSetSkin = async (skinId: string) => {
      await setSkin(skinId);
      showNotification(t('selected'), 'success');
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'exchange':
        return <ExchangeScreen playerState={playerState} currentLeague={currentLeague} onTap={handleTap} user={user} onClaimCipher={handleClaimCipher} config={config} onOpenLeaderboard={() => setIsLeaderboardOpen(true)} isTurboActive={isTurboActive} effectiveMaxEnergy={effectiveMaxEnergy} />;
      case 'mine':
        return <MineScreen upgrades={allUpgrades} balance={playerState.balance} onBuyUpgrade={handleBuyUpgrade} lang={user.language} playerState={playerState} config={config} onClaimCombo={handleClaimCombo} uiIcons={config.uiIcons} />;
      case 'missions':
        return <MissionsScreen
                    tasks={config.tasks}
                    playerState={playerState}
                    onClaim={handleClaimTask}
                    lang={user.language}
                    startedVideoTasks={startedVideoTasks}
                    uiIcons={config.uiIcons}
                />;
       case 'airdrop':
        return <AirdropScreen
                    specialTasks={config.specialTasks}
                    playerState={playerState}
                    onClaim={handleClaimTask}
                    onPurchase={purchaseSpecialTask}
                    lang={user.language}
                    startedVideoTasks={startedVideoTasks}
                    uiIcons={config.uiIcons}
                />;
      case 'profile':
        return <ProfileScreen
                    playerState={playerState}
                    user={user}
                    config={config}
                    onBuyBoost={handleBuyBoost}
                    onSetSkin={handleSetSkin}
                    onOpenCoinLootbox={handleOpenCoinLootbox}
                    onPurchaseStarLootbox={handlePurchaseStarLootbox}
                />;
      default:
        return <ExchangeScreen playerState={playerState} currentLeague={currentLeague} onTap={handleTap} user={user} onClaimCipher={handleClaimCipher} config={config} onOpenLeaderboard={() => setIsLeaderboardOpen(true)} isTurboActive={isTurboActive} effectiveMaxEnergy={effectiveMaxEnergy} />;
    }
  };
  
  const LanguageGlitchModal = () => (
    <>
        <div className="glitch-effect">
            <div className="glitch-noise"></div>
        </div>
        <div className="glitch-modal themed-container p-6 text-center border-2 border-red-500/50 w-80">
            <h2 className="text-2xl font-display mb-4 text-red-400">ПОМИЛКА</h2>
            <p className="text-xl text-white mb-6">чому не державною?</p>
            <button 
                onClick={() => setIsGlitching(false)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2"
            >
                OK
            </button>
        </div>
    </>
  );

  const NavItem = ({ screen, label, iconUrl, active }: { screen: Screen, label: string, iconUrl: string, active: boolean }) => (
    <button
      onClick={() => setActiveScreen(screen)}
      className={`flex flex-col items-center justify-center text-xs w-full pt-2 pb-1 transition-colors duration-200 ${active ? 'text-green-400' : 'text-gray-400'}`}
    >
        <div className="w-8 h-8 flex items-center justify-center">
            <img 
                src={iconUrl} 
                alt={label} 
                className={`w-7 h-7 transition-all duration-200 ${active ? 'filter-green' : ''}`} 
            />
        </div>
        <span>{label}</span>
    </button>
  );

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col prevent-select">
      <main className="flex-grow overflow-hidden">
        {renderScreen()}
      </main>
      
      {isLeaderboardOpen && <LeaderboardScreen onClose={() => setIsLeaderboardOpen(false)} getLeaderboard={getLeaderboard} user={user} currentLeague={currentLeague} />}
      {secretCodeTask && <SecretCodeModal task={secretCodeTask} lang={user.language} onClose={() => setSecretCodeTask(null)} onSubmit={(code) => {
          if ('isOneTime' in secretCodeTask) {
            handleCompleteSpecialTask(secretCodeTask as SpecialTask, code);
          } else {
            handleClaimDailyTaskReward(secretCodeTask as DailyTask, code);
          }
          setSecretCodeTask(null);
        }} />
      }
      {lootboxResult && <LootboxResultModal item={lootboxResult} onClose={() => setLootboxResult(null)} lang={user.language} uiIcons={config.uiIcons} />}
      {isGlitching && <LanguageGlitchModal />}
      <NotificationToast notification={notification} />

      <nav className="flex-shrink-0 bg-black/50 backdrop-blur-md border-t border-[var(--border-color)]">
        <div className="grid grid-cols-5 justify-around items-center max-w-xl mx-auto">
          <NavItem screen="exchange" label={t('exchange')} iconUrl={config.uiIcons.nav.exchange} active={activeScreen === 'exchange'} />
          <NavItem screen="mine" label={t('mine')} iconUrl={config.uiIcons.nav.mine} active={activeScreen === 'mine'} />
          <NavItem screen="missions" label={t('missions')} iconUrl={config.uiIcons.nav.missions} active={activeScreen === 'missions'} />
          <NavItem screen="airdrop" label={t('airdrop')} iconUrl={config.uiIcons.nav.airdrop} active={activeScreen === 'airdrop'} />
          <NavItem screen="profile" label={t('profile')} iconUrl={config.uiIcons.nav.profile} active={activeScreen === 'profile'} />
        </div>
      </nav>
       <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; } 
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .prevent-select { -webkit-touch-callout: none; -webkit-user-select: none; -khtml-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
        @keyframes floatUp {
          0% { transform: translateY(0) translateX(var(--x-offset)) scale(1); opacity: 1; }
          100% { transform: translateY(-60px) translateX(var(--x-offset)) scale(0.8); opacity: 0; }
        }
        .filter-green {
            filter: brightness(0) saturate(100%) invert(68%) sepia(85%) saturate(545%) hue-rotate(85deg) brightness(97%) contrast(92%);
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <AppContainer />
  </AuthProvider>
);

export default App;