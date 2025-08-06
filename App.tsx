

import React, { useState, useEffect } from 'react';
import { useGame, useAuth, useTranslation, AuthProvider, useGameContext } from './hooks/useGameLogic';
import ExchangeScreen from './sections/Exchange';
import MineScreen from './sections/Mine';
import BoostScreen from './sections/Boost';
import { ExchangeIcon, MineIcon, StarIcon, REFERRAL_BONUS, TELEGRAM_BOT_NAME, CoinIcon, MINI_APP_NAME, LEAGUES, LOOTBOX_COST_COINS, LOOTBOX_COST_STARS, DEFAULT_COIN_SKIN_ID, MissionsIcon, ProfileIcon } from './constants';
import { DailyTask, GameConfig, Language, Upgrade, Boost, SpecialTask, PlayerState, User, LeaderboardPlayer, TaskType, Reward, BlackMarketCard, CoinSkin, BoxType } from './types';
import NotificationToast from './components/NotificationToast';
import SecretCodeModal from './components/SecretCodeModal';

type Screen = 'exchange' | 'mine' | 'missions' | 'profile';

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
        // Return a simple blank container to avoid flashing the default loading screen
        return <div className="h-screen w-screen bg-gray-900" />;
    }

    if (!user) {
        return <NotInTelegramScreen />;
    }

    return <MainApp />;
};

const LoadingScreen: React.FC<{imageUrl?: string}> = ({ imageUrl }) => (
    <div className="h-screen w-screen bg-gray-900 relative overflow-hidden">
        {imageUrl ? (
            <img 
                src={imageUrl} 
                alt="Loading..." 
                className="absolute top-0 left-0 w-full h-full object-cover animate-pulse"
                style={{animationDuration: '2s'}}
            />
        ) : (
            <div className="w-full h-full flex flex-col justify-center items-center p-4 text-white">
                <h1 className="text-4xl font-bold mb-2">Ukhyliant Clicker</h1>
                <p className="text-lg animate-pulse">Connecting...</p>
            </div>
        )}
    </div>
);

const NotInTelegramScreen: React.FC = () => (
    <div className="h-screen w-screen bg-gray-900 flex flex-col justify-center items-center p-4 text-white text-center">
        <h1 className="text-4xl font-bold mb-2">Ukhyliant Clicker</h1>
        <p className="text-gray-400 mb-8 text-6xl">🚫</p>
        <h2 className="text-2xl font-semibold mb-2">Error</h2>
        <p className="text-lg text-gray-300">This application must be launched from within Telegram.</p>
    </div>
);

const TabButton = ({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors w-full text-center ${
            isActive ? 'bg-gray-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700'
        }`}
    >
        {label}
    </button>
);

const MainApp: React.FC = () => {
  const { user } = useAuth();
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
    // Once MainApp mounts, it means initial data is loaded.
    // We show the loading screen for a fixed time to display any custom image.
    const timer = setTimeout(() => {
        setIsAppReady(true);
    }, 1500);
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
        const rewardText = task.reward?.type === 'coins'
            ? `+${task.reward?.amount?.toLocaleString() ?? 0} 🪙`
            : `+${task.reward?.amount?.toLocaleString() ?? 0}/hr ⚡`;
        showNotification(`${task.name?.[user.language]} выполнено! ${rewardText}`, 'success');
        
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
            // First click: Open link and set state to wait for code entry
            if (task.url) {
                window.Telegram.WebApp.openLink(task.url);
            }
            setStartedVideoTasks(prev => new Set(prev).add(task.id));
            return;
        } else {
            // Second click: Open our custom modal
            setSecretCodeTask(task);
            return; // Stop further execution, claim is handled in the modal's onSubmit
        }
    }

    // --- Standard logic for other tasks ---
    if (task.url) {
        if (task.url.startsWith('https://t.me/')) {
            window.Telegram.WebApp.openTelegramLink(task.url);
        } else {
            window.Telegram.WebApp.openLink(task.url);
        }
    }
    
    // For tasks that don't require further user input (e.g., join, watch), claim reward immediately.
    if ('isOneTime' in task) {
        await handleCompleteSpecialTask(task);
    } else {
        if (task.type !== 'taps') {
             await handleClaimDailyTaskReward(task);
        } else {
             // For 'taps' tasks, this is called when the tap requirement is met.
             await handleClaimDailyTaskReward(task);
        }
    }
  };
  
  const handleClaimCombo = async () => {
    const result = await claimDailyCombo();
    if (result.player && result.reward) {
        showNotification(`Комбо собрано! +${result.reward.toLocaleString()}`, 'success');
    } else if (result.error) {
        showNotification(result.error, 'error');
    }
  };

  const handleClaimCipher = async (cipher: string): Promise<boolean> => {
    const result = await claimDailyCipher(cipher);
    if (result.player && result.reward) {
        showNotification(`Шифр разгадан! +${result.reward.toLocaleString()}`, 'success');
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
        return <MineScreen upgrades={allUpgrades} balance={playerState.balance} onBuyUpgrade={handleBuyUpgrade} lang={user.language} playerState={playerState} config={config} onClaimCombo={handleClaimCombo} />;
      case 'missions':
        return <MissionsScreen
                    tasks={config.tasks}
                    specialTasks={config.specialTasks}
                    playerState={playerState}
                    onClaim={handleClaimTask}
                    onPurchase={purchaseSpecialTask}
                    lang={user.language}
                    startedVideoTasks={startedVideoTasks}
                />;
      case 'profile':
        return <ProfileScreen
                    playerState={playerState}
                    user={user}
                    boosts={config.boosts}
                    onBuyBoost={handleBuyBoost}
                    lang={user.language}
                    skins={config.coinSkins}
                    onSetSkin={handleSetSkin}
                    onOpenCoinLootbox={handleOpenCoinLootbox}
                    onPurchaseStarLootbox={handlePurchaseStarLootbox}
                />;
      default:
        return <ExchangeScreen playerState={playerState} currentLeague={currentLeague} onTap={handleTap} user={user} onClaimCipher={handleClaimCipher} config={config} onOpenLeaderboard={() => setIsLeaderboardOpen(true)} isTurboActive={isTurboActive} effectiveMaxEnergy={effectiveMaxEnergy} />;
    }
  };

  const NavItem = ({ screen, label, icon }: { screen: Screen, label: string, icon: React.ReactNode}) => (
    <button
      onClick={() => setActiveScreen(screen)}
      className={`flex flex-col items-center justify-center text-xs w-full pt-2 pb-1 text-gray-400`}
    >
      {icon}
      <span className={activeScreen === screen ? 'text-white font-bold' : ''}>{label}</span>
    </button>
  );

  return (
    <div className="h-screen w-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 font-sans overflow-hidden flex flex-col prevent-select">
      <div className="flex-grow h-full w-full overflow-y-auto no-scrollbar">
        {renderScreen()}
      </div>
      
      {isLeaderboardOpen && <LeaderboardScreen onClose={() => setIsLeaderboardOpen(false)} getLeaderboard={getLeaderboard} user={user} />}

      {secretCodeTask && (
          <SecretCodeModal
              task={secretCodeTask}
              lang={user.language}
              onClose={() => setSecretCodeTask(null)}
              onSubmit={(code) => {
                  if ('isOneTime' in secretCodeTask) {
                      handleCompleteSpecialTask(secretCodeTask, code);
                  } else {
                      handleClaimDailyTaskReward(secretCodeTask, code);
                  }
                  setSecretCodeTask(null);
              }}
          />
      )}
      
      {lootboxResult && <LootboxResultModal item={lootboxResult} onClose={() => setLootboxResult(null)} lang={user.language} />}

      <NotificationToast notification={notification} />

      <div className="fixed bottom-0 left-0 right-0 bg-black/50 backdrop-blur-lg border-t border-gray-700/50">
        <div className="grid grid-cols-4 justify-around items-center max-w-xl mx-auto">
          <NavItem screen="exchange" label={t('exchange')} icon={<ExchangeIcon active={activeScreen === 'exchange'} />} />
          <NavItem screen="mine" label={t('mine')} icon={<MineIcon active={activeScreen === 'mine'} />} />
          <NavItem screen="missions" label={t('missions')} icon={<MissionsIcon active={activeScreen === 'missions'} />} />
          <NavItem screen="profile" label={t('profile')} icon={<ProfileIcon active={activeScreen === 'profile'} />} />
        </div>
      </div>
       <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; } 
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .prevent-select {
            -webkit-touch-callout: none; /* iOS Safari */
            -webkit-user-select: none; /* Safari */
            -khtml-user-select: none; /* Konqueror HTML */
            -moz-user-select: none; /* Old versions of Firefox */
            -ms-user-select: none; /* Internet Explorer/Edge */
            user-select: none; /* Non-prefixed version */
        }
        @keyframes floatUp {
          0% { transform: translateY(0) translateX(var(--x-offset)) scale(1); opacity: 1; }
          100% { transform: translateY(-60px) translateX(var(--x-offset)) scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const TaskCard = ({ task, playerState, onClaim, lang, startedVideoTasks }: { task: DailyTask | SpecialTask, playerState: PlayerState, onClaim: (task: DailyTask | SpecialTask) => void, lang: Language, startedVideoTasks: Set<string> }) => {
    const t = useTranslation();
    const isSpecial = 'isOneTime' in task;
    const isCompleted = isSpecial 
        ? playerState.completedSpecialTaskIds.includes(task.id)
        : playerState.completedDailyTaskIds.includes(task.id);
    
    let canClaim = !isCompleted;
    let progressText = t('get');

    // Handle canClaim logic for daily tap tasks
    if (task.type === 'taps' && !isSpecial) {
        const progress = Math.min(playerState.dailyTaps, task.requiredTaps || 0);
        canClaim = progress >= (task.requiredTaps || 0) && !isCompleted;
        progressText = `${progress}/${task.requiredTaps}`;
    }

    const rewardIcon = task.reward?.type === 'profit' ? '⚡' : '🪙';
    
    const getButtonText = () => {
        if (isCompleted) return t('completed');
        
        const isVideoCodeTask = task.type === 'video_code';
        const isVideoTaskStarted = isVideoCodeTask && startedVideoTasks.has(task.id);
        if (isVideoCodeTask) {
            return isVideoTaskStarted ? t('enter_secret_code') : t('go_to_task');
        }

        if (canClaim) {
             if (task.url) return t('go_to_task');
             return t('claim');
        }
        return progressText; // Shows progress for tap tasks
    };

    const getTaskIcon = () => {
        if (task.imageUrl) {
            return <img src={task.imageUrl} alt={task.name?.[lang]} className="w-12 h-12 object-contain"/>;
        }
        switch (task.type) {
            case 'taps': return '👆';
            case 'telegram_join': return '✈️';
            case 'social_follow': return '🔗';
            case 'video_watch': return '🎬';
            case 'video_code': return '🔑';
            default: return '📋';
        }
    };

    return (
        <div className={`bg-gray-800 p-3 rounded-lg flex items-center ${isCompleted ? 'opacity-60' : ''}`}>
            <div className="w-16 h-16 bg-gray-700/50 rounded-lg flex items-center justify-center mr-3 text-4xl">
                {getTaskIcon()}
            </div>
            <div className="flex-grow">
                <h2 className="text-base font-bold">{task.name?.[lang]}</h2>
                <div className="text-sm text-yellow-300 my-1 flex items-center">
                    <span>+ {(task.reward?.amount || 0).toLocaleString()} {rewardIcon}</span>
                </div>
            </div>
            <button 
                onClick={() => onClaim(task)}
                disabled={!canClaim && !isCompleted && task.type === 'taps'} // Only disable for tap tasks that are not ready
                className="ml-3 px-4 py-3 rounded-lg font-bold text-white text-base transition-colors whitespace-nowrap disabled:bg-gray-600 disabled:text-gray-400 bg-green-600 hover:bg-green-500"
            >
                {getButtonText()}
            </button>
        </div>
    );
};

const MissionsScreen = ({ tasks, specialTasks, playerState, onClaim, onPurchase, lang, startedVideoTasks }: { tasks: DailyTask[], specialTasks: SpecialTask[], playerState: PlayerState, onClaim: (task: DailyTask | SpecialTask) => void, onPurchase: (task: SpecialTask) => void, lang: Language, startedVideoTasks: Set<string> }) => {
    const t = useTranslation();
    const [activeTab, setActiveTab] = useState<'daily' | 'airdrop'>('daily');

    return (
        <div className="flex flex-col h-full text-white pt-4 pb-24 px-4 items-center">
            <div className="w-full max-w-md sticky top-0 bg-gradient-to-b from-gray-900 via-gray-900 to-transparent py-4 z-10">
                <h1 className="text-3xl font-bold text-center mb-4">{t('missions')}</h1>
                <div className="flex space-x-2 bg-gray-800 p-1 rounded-xl">
                    <TabButton label={t('sub_daily')} isActive={activeTab === 'daily'} onClick={() => setActiveTab('daily')} />
                    <TabButton label={t('sub_airdrop')} isActive={activeTab === 'airdrop'} onClick={() => setActiveTab('airdrop')} />
                </div>
            </div>

            <div className="w-full max-w-md flex-grow space-y-3 overflow-y-auto no-scrollbar pt-2">
                {activeTab === 'daily' && (
                    (tasks || []).map(task => (
                        <TaskCard key={task.id} task={task} playerState={playerState} onClaim={onClaim} lang={lang} startedVideoTasks={startedVideoTasks} />
                    ))
                )}
                {activeTab === 'airdrop' && (
                    <>
                         <p className="text-center text-gray-400 max-w-xs mx-auto mb-2">{t('airdrop_description')}</p>
                         {(specialTasks || []).map(task => {
                            const isPurchased = playerState.purchasedSpecialTaskIds.includes(task.id);
                            const isCompleted = playerState.completedSpecialTaskIds.includes(task.id);
                            const rewardIcon = task.reward?.type === 'profit' ? '⚡' : '🪙';
                            
                            let button;
                            if (isCompleted) {
                                button = <button disabled className="w-full mt-2 py-2 rounded-lg font-bold bg-gray-600 text-gray-400">{t('completed')}</button>;
                            } else if (isPurchased) {
                                const isVideoCodeTask = task.type === 'video_code';
                                const isVideoTaskStarted = isVideoCodeTask && startedVideoTasks.has(task.id);
                                const buttonText = isVideoCodeTask
                                    ? (isVideoTaskStarted ? t('enter_secret_code') : t('go_to_task'))
                                    : t('go_to_task');
                                button = <button onClick={() => onClaim(task)} className="w-full mt-2 py-2 rounded-lg font-bold bg-blue-600 hover:bg-blue-500">{buttonText}</button>;
                            } else {
                                button = <button onClick={() => onPurchase(task)} className="w-full mt-2 py-2 rounded-lg font-bold bg-purple-600 hover:bg-purple-500 flex justify-center items-center space-x-2">
                                            <span>{task.priceStars > 0 ? `${t('unlock_for')} ${task.priceStars}` : t('get')}</span>
                                            {task.priceStars > 0 && <StarIcon />}
                                         </button>;
                            }

                            return (
                                <div key={task.id} className={`bg-gray-800 p-4 rounded-lg ${isCompleted ? 'opacity-60' : ''}`}>
                                    <div className="flex items-center mb-2">
                                        <div className="w-12 h-12 bg-gray-700/50 rounded-lg flex items-center justify-center mr-3">
                                             {task.imageUrl ? <img src={task.imageUrl} alt={task.name?.[lang]} className="w-10 h-10 object-contain"/> : <span className="text-3xl">🔗</span>}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold">{task.name?.[lang]}</h2>
                                            <p className="text-sm text-gray-400">{task.description?.[lang]}</p>
                                        </div>
                                    </div>
                                    <div className="text-sm text-yellow-300 my-2 flex items-center space-x-4">
                                        <span>+ {(task.reward?.amount || 0).toLocaleString()} {rewardIcon}</span>
                                    </div>
                                    {button}
                                </div>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
};

const ProfileScreen = ({ playerState, user, boosts, onBuyBoost, lang, skins, onSetSkin, onOpenCoinLootbox, onPurchaseStarLootbox } : any) => {
    const t = useTranslation();
    const [activeTab, setActiveTab] = useState<'friends' | 'boosts' | 'skins' | 'market'>('friends');
    
    // Inline component for Friends content
    const FriendsContent = () => {
        const [copied, setCopied] = useState(false);
        const handleCopyReferral = () => {
            const referralLink = `https://t.me/${TELEGRAM_BOT_NAME}/${MINI_APP_NAME}?startapp=${user.id}`;
            navigator.clipboard.writeText(referralLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };
        return (
            <div className="w-full max-w-md space-y-4 text-center">
                <div className="bg-gray-800 p-4 rounded-lg">
                    <p className="text-gray-400 text-lg">{t('your_referrals')}</p>
                    <p className="text-5xl font-bold my-1">{playerState.referrals}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                    <p className="text-gray-400 text-lg">{t('referral_bonus')}</p>
                    <p className="text-2xl font-bold my-1 flex items-center justify-center space-x-2">
                        <span>+{REFERRAL_BONUS.toLocaleString()}</span>
                        <div className="w-6 h-6 text-yellow-400"><CoinIcon/></div>
                    </p>
                </div>
                 <div className="bg-gray-800 p-4 rounded-lg">
                    <p className="text-gray-400 text-lg">{t('profit_from_referrals')}</p>
                    <p className="text-2xl font-bold my-1 flex items-center justify-center space-x-2 text-green-400">
                        <span>+{formatNumber(playerState.referralProfitPerHour)}/hr</span>
                        <span>⚡</span>
                    </p>
                </div>
                <button onClick={handleCopyReferral} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg text-lg transition-transform duration-100 active:scale-95">
                    {copied ? t('copied') : t('invite_friends')}
                </button>
            </div>
        );
    };
    
    // Inline component for Skins content
    const SkinsContent = () => {
        const unlockedSkins = (skins || []).filter(skin => playerState.unlockedSkins.includes(skin.id));
        return (
            <div className="w-full max-w-md">
                <p className="text-center text-gray-400 mb-4 max-w-xs mx-auto">{t('skins_gallery_desc')}</p>
                <div className="grid grid-cols-3 gap-4">
                    {unlockedSkins.map(skin => {
                        const isSelected = playerState.currentSkinId === skin.id;
                        return (
                            <div key={skin.id} className={`bg-gray-800 rounded-lg p-3 flex flex-col items-center text-center ${isSelected ? 'border-2 border-yellow-400' : ''}`}>
                                <div className="w-16 h-16 mb-2 flex items-center justify-center">
                                    <img src={skin.iconUrl} alt={skin.name[lang]} className="w-full h-full object-contain" />
                                </div>
                                <p className="text-xs font-bold leading-tight">{skin.name[lang]}</p>
                                <p className="text-xs text-green-400 mt-1">+{skin.profitBoostPercent}%</p>
                                <button
                                    onClick={() => onSetSkin(skin.id)}
                                    disabled={isSelected}
                                    className="w-full mt-2 py-1 text-xs rounded-md font-bold disabled:bg-yellow-500 disabled:text-black bg-blue-600 hover:bg-blue-500 text-white"
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
    
    // Inline component for Market content
    const MarketContent = () => (
        <div className="w-full max-w-md space-y-6">
            <p className="text-center text-gray-400 max-w-xs mx-auto">{t('black_market_desc')}</p>
            <div className="bg-gray-800 p-6 rounded-lg text-center border-2 border-yellow-500/50">
                <div className="text-6xl mb-4">📦</div>
                <h2 className="text-2xl font-bold mb-2">{t('lootbox_coin')}</h2>
                <button onClick={() => onOpenCoinLootbox('coin')} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-4 rounded-lg text-lg transition-transform duration-100 active:scale-95 flex items-center justify-center space-x-2">
                    <span>{t('open_for')} {LOOTBOX_COST_COINS.toLocaleString()}</span>
                    <div className="w-6 h-6"><CoinIcon/></div>
                </button>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg text-center border-2 border-blue-500/50">
                <div className="text-6xl mb-4">🌟</div>
                <h2 className="text-2xl font-bold mb-2">{t('lootbox_star')}</h2>
                <button onClick={() => onPurchaseStarLootbox('star')} className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 px-4 rounded-lg text-lg transition-transform duration-100 active:scale-95 flex items-center justify-center space-x-2">
                    <span>{t('open_for')} {LOOTBOX_COST_STARS}</span>
                    <div className="w-6 h-6"><StarIcon/></div>
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full text-white pt-4 pb-24 px-4 items-center">
            <div className="w-full max-w-md sticky top-0 bg-gradient-to-b from-gray-900 via-gray-900 to-transparent py-4 z-10">
                <h1 className="text-3xl font-bold text-center mb-4">{t('profile')}</h1>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-800 p-1 rounded-xl">
                  <TabButton label={t('sub_contacts')} isActive={activeTab === 'friends'} onClick={() => setActiveTab('friends')} />
                  <TabButton label={t('sub_boosts')} isActive={activeTab === 'boosts'} onClick={() => setActiveTab('boosts')} />
                  <TabButton label={t('sub_disguise')} isActive={activeTab === 'skins'} onClick={() => setActiveTab('skins')} />
                  <TabButton label={t('sub_market')} isActive={activeTab === 'market'} onClick={() => setActiveTab('market')} />
                </div>
            </div>
            
            <div className="w-full max-w-md flex-grow overflow-y-auto no-scrollbar pt-2 flex justify-center">
                {activeTab === 'friends' && <FriendsContent />}
                {activeTab === 'boosts' && <BoostScreen playerState={playerState} boosts={boosts} onBuyBoost={onBuyBoost} lang={lang} />}
                {activeTab === 'skins' && <SkinsContent />}
                {activeTab === 'market' && <MarketContent />}
            </div>
        </div>
    );
};

const LeaderboardScreen = ({ onClose, getLeaderboard, user }: { onClose: () => void, getLeaderboard: () => Promise<{topPlayers: LeaderboardPlayer[], totalPlayers: number} | null>, user: User }) => {
    const [leaderboardData, setLeaderboardData] = useState<{topPlayers: LeaderboardPlayer[], totalPlayers: number} | null>(null);
    const [loading, setLoading] = useState(true);
    const t = useTranslation();
    const { playerState } = useGameContext();
    const currentLeague = LEAGUES.find(l => (playerState?.balance || 0) >= l.minBalance);


    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const data = await getLeaderboard();
            setLeaderboardData(data);
            setLoading(false);
        };
        fetchData();
    }, [getLeaderboard]);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-gray-800 rounded-2xl w-[90%] max-w-lg max-h-[80vh] flex flex-col p-4 border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">{t('leaderboard')}</h2>
                    <button onClick={onClose} className="text-gray-400 text-2xl">&times;</button>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-3 flex flex-col items-center mb-4">
                     <p className="text-sm text-gray-400">{t('your_league')}</p>
                     <div className="flex items-center space-x-2">
                        {currentLeague?.iconUrl && <img src={currentLeague.iconUrl} alt="" className="w-8 h-8"/>}
                        <span className="text-lg font-bold">{currentLeague?.name?.[user.language]}</span>
                     </div>
                     <p className="text-xs text-gray-500 mt-1">{t('total_players')}: {leaderboardData?.totalPlayers?.toLocaleString() || '...'}</p>
                </div>
                
                <div className="flex-grow overflow-y-auto no-scrollbar pr-1">
                    {loading ? (
                        <p className="text-center text-gray-400 animate-pulse">Loading leaderboard...</p>
                    ) : (
                        <ul className="space-y-2">
                            {leaderboardData?.topPlayers.map((player, index) => (
                                <li key={player.id} className="flex items-center bg-gray-700/50 rounded-lg p-2">
                                    <span className="text-lg font-bold w-8 text-center">{index + 1}</span>
                                    <div className="flex-grow mx-2">
                                        <p className="font-semibold truncate">{player.name}</p>
                                        <p className="text-xs text-gray-400 flex items-center space-x-1">
                                            {player.leagueIconUrl && <img src={player.leagueIconUrl} alt="" className="w-4 h-4 mr-1"/>}
                                            <span>{player.leagueName?.[user.language]}</span>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-green-400 text-sm">+{formatNumber(player.profitPerHour)}/hr</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

const LootboxResultModal = ({ item, onClose, lang }: { item: any, onClose: () => void, lang: Language }) => {
    const t = useTranslation();
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-2xl w-full max-w-sm flex flex-col p-6 border-2 border-yellow-400 items-center" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-4">{t('won_item')}!</h2>
                <div className="w-24 h-24 bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                    <img src={item.iconUrl} alt={item.name[lang]} className="w-20 h-20 object-contain" />
                </div>
                <p className="text-xl font-bold text-center mb-1">{item.name[lang]}</p>
                {item.itemType === 'card' && <p className="text-green-400 text-center mb-4">+{item.profitPerHour}/hr</p>}
                {item.itemType === 'skin' && <p className="text-green-400 text-center mb-4">+{item.profitBoostPercent}% {t('profit_boost')}</p>}
                {item.itemType === 'coins' && <p className="text-yellow-400 text-center mb-4">+{item.amount.toLocaleString()} 🪙</p>}
                <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg">{t('close')}</button>
            </div>
        </div>
    );
};


const App: React.FC = () => (
    <AuthProvider>
        <AppContainer />
    </AuthProvider>
);

export default App;
