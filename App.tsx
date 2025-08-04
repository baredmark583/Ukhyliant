import React, { useState, useEffect } from 'react';
import { useGame, useAuth, useTranslation, AuthProvider } from './hooks/useGameLogic';
import ExchangeScreen from './sections/Exchange';
import MineScreen from './sections/Mine';
import BoostScreen from './sections/Boost';
import { ExchangeIcon, MineIcon, FriendsIcon, BoostIcon, TasksIcon, StarIcon, EarnIcon, REFERRAL_BONUS, TELEGRAM_BOT_NAME, CoinIcon, MINI_APP_NAME } from './constants';
import { DailyTask, GameConfig, Language, Upgrade, Boost, SpecialTask, PlayerState, User } from './types';

type Screen = 'exchange' | 'mine' | 'friends' | 'boost' | 'tasks' | 'earn';

const AppContainer: React.FC = () => {
    const { user, isInitializing } = useAuth();
    
    if (isInitializing) {
        return <LoadingScreen />;
    }

    if (!user) {
        return <NotInTelegramScreen />;
    }

    return <MainApp />;
};

const LoadingScreen: React.FC = () => (
    <div className="h-screen w-screen bg-gray-900 flex flex-col justify-center items-center p-4 text-white">
        <h1 className="text-4xl font-bold mb-2">Ukhyliant Clicker</h1>
        <p className="text-lg animate-pulse">Connecting...</p>
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


const MainApp: React.FC = () => {
  const { user, logout, switchLanguage } = useAuth();
  const { 
      playerState, config, handleTap, buyUpgrade, allUpgrades, currentLeague, 
      claimTaskReward, buyBoost, purchaseSpecialTask, completeSpecialTask 
  } = useGame();
  const [activeScreen, setActiveScreen] = React.useState<Screen>('exchange');
  const t = useTranslation();

  if (!user || !playerState || !config) return <LoadingScreen />;
  
  const lang = user.language;
  const languages = ['en', 'ua', 'ru'] as const;

  const handleSwitchLanguage = () => {
      const currentIndex = languages.indexOf(lang);
      const nextIndex = (currentIndex + 1) % languages.length;
      switchLanguage(languages[nextIndex]);
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'exchange':
        return <ExchangeScreen playerState={playerState} currentLeague={currentLeague} onTap={handleTap} user={user} />;
      case 'mine':
        return <MineScreen upgrades={allUpgrades} balance={playerState.balance} onBuyUpgrade={buyUpgrade} lang={lang} />;
      case 'friends':
        return <FriendsScreen playerState={playerState} user={user} />;
      case 'boost':
        return <BoostScreen stars={playerState.balance} boosts={config.boosts} onBuyBoost={buyBoost} lang={lang} />;
      case 'tasks':
        return <TasksScreen tasks={config.tasks} playerState={playerState} onClaim={claimTaskReward} lang={lang} />;
      case 'earn':
        return <EarnScreen tasks={config.specialTasks} playerState={playerState} onPurchase={purchaseSpecialTask} onComplete={completeSpecialTask} lang={lang} />;
      default:
        return <ExchangeScreen playerState={playerState} currentLeague={currentLeague} onTap={handleTap} user={user} />;
    }
  };

  const NavItem = ({ screen, label, icon }: { screen: Screen, label: string, icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveScreen(screen)}
      className="flex flex-col items-center justify-center text-xs w-full pt-2 pb-1 text-gray-400"
    >
      {icon}
      <span className={activeScreen === screen ? 'text-white font-bold' : ''}>{label}</span>
    </button>
  );

  return (
    <div className="h-screen w-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 font-sans overflow-hidden flex flex-col">
       <div className="absolute top-2 right-2 z-20 flex space-x-2">
            <button onClick={handleSwitchLanguage} className="bg-gray-800 text-white rounded-md px-3 py-1 text-sm w-12">{lang.toUpperCase()}</button>
            <button onClick={logout} className="bg-red-600 text-white rounded-md px-3 py-1 text-sm">{t('logout')}</button>
       </div>
       
      <div className="flex-grow h-full w-full overflow-y-auto no-scrollbar">
        {renderScreen()}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-black/50 backdrop-blur-lg border-t border-gray-700/50">
        <div className="flex justify-around items-center max-w-xl mx-auto">
          <NavItem screen="exchange" label={t('exchange')} icon={<ExchangeIcon active={activeScreen === 'exchange'} />} />
          <NavItem screen="mine" label={t('mine')} icon={<MineIcon active={activeScreen === 'mine'} />} />
          <NavItem screen="friends" label={t('friends')} icon={<FriendsIcon active={activeScreen === 'friends'} />} />
          <NavItem screen="earn" label={t('earn')} icon={<EarnIcon active={activeScreen === 'earn'} />} />
          <NavItem screen="tasks" label={t('tasks')} icon={<TasksIcon active={activeScreen === 'tasks'} />} />
          <NavItem screen="boost" label={t('boosts')} icon={<BoostIcon active={activeScreen === 'boost'} />} />
        </div>
      </div>
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
};

const FriendsScreen = ({ playerState, user }: { playerState: PlayerState, user: User }) => {
    const t = useTranslation();
    const [copied, setCopied] = useState(false);

    const handleCopyReferral = () => {
        const referralLink = `https://t.me/${TELEGRAM_BOT_NAME}/${MINI_APP_NAME}?startapp=${user.id}`;
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col h-full text-white pt-4 pb-24 px-4 items-center">
            <h1 className="text-3xl font-bold text-center mb-6">{t('friends')}</h1>
            <div className="w-full max-w-md space-y-4 text-center">
                <div className="bg-gray-800 p-6 rounded-lg">
                    <p className="text-gray-400 text-lg">{t('your_referrals')}</p>
                    <p className="text-5xl font-bold my-2">{playerState.referrals}</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg">
                    <p className="text-gray-400 text-lg">{t('referral_bonus')}</p>
                    <p className="text-3xl font-bold my-2 flex items-center justify-center space-x-2">
                        <span>+{REFERRAL_BONUS.toLocaleString()}</span>
                        <div className="w-8 h-8"><CoinIcon/></div>
                    </p>
                </div>
                <button onClick={handleCopyReferral} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg text-lg transition-transform duration-100 active:scale-95">
                    {copied ? t('copied') : t('invite_friends')}
                </button>
            </div>
        </div>
    );
};


const TasksScreen = ({ tasks, playerState, onClaim, lang }: { tasks: DailyTask[], playerState: any, onClaim: (task: DailyTask) => void, lang: Language }) => {
    const t = useTranslation();
    return (
        <div className="flex flex-col h-full text-white pt-4 pb-24 px-4 items-center">
            <h1 className="text-3xl font-bold text-center mb-6">{t('tasks')}</h1>
            <div className="w-full max-w-md space-y-3 overflow-y-auto no-scrollbar">
                {tasks.map(task => {
                    const isCompleted = playerState.completedDailyTaskIds.includes(task.id);
                    const progress = Math.min(playerState.dailyTaps, task.requiredTaps);
                    const canClaim = progress >= task.requiredTaps && !isCompleted;
                    return (
                        <div key={task.id} className="bg-gray-800 p-4 rounded-lg">
                            <h2 className="text-lg font-bold">{task.name[lang]}</h2>
                            <div className="text-sm text-yellow-300 my-2 flex items-center space-x-4">
                                <span>+ {task.rewardCoins.toLocaleString()} 🪙</span>
                                <span className="flex items-center space-x-1"><span>+{task.rewardStars}</span> <StarIcon /></span>
                            </div>
                             <div className="w-full bg-gray-700 rounded-full h-2.5 my-2">
                                <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${(progress / task.requiredTaps) * 100}%` }}></div>
                             </div>
                            <button 
                                onClick={() => onClaim(task)}
                                disabled={!canClaim}
                                className="w-full mt-2 py-2 rounded-lg font-bold text-white transition-colors disabled:bg-gray-600 disabled:text-gray-400 bg-green-600 hover:bg-green-500"
                            >
                                {isCompleted ? t('completed') : canClaim ? t('claim_reward') : `${progress}/${task.requiredTaps}`}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const EarnScreen = ({ tasks, playerState, onPurchase, onComplete, lang }: { tasks: SpecialTask[], playerState: any, onPurchase: (task: SpecialTask) => void, onComplete: (task: SpecialTask) => void, lang: Language }) => {
    const t = useTranslation();
    
    const handleGoToTask = (task: SpecialTask) => {
        window.Telegram.WebApp.openTelegramLink(task.url);
        onComplete(task);
    };

    return (
        <div className="flex flex-col h-full text-white pt-4 pb-24 px-4 items-center">
            <h1 className="text-3xl font-bold text-center mb-6">{t('special_tasks')}</h1>
            <div className="w-full max-w-md space-y-3 overflow-y-auto no-scrollbar">
                {tasks.map(task => {
                    const isPurchased = playerState.purchasedSpecialTaskIds.includes(task.id);
                    const isCompleted = playerState.completedSpecialTaskIds.includes(task.id);
                    
                    let button;
                    if (isCompleted) {
                        button = <button disabled className="w-full mt-2 py-2 rounded-lg font-bold bg-gray-600 text-gray-400">{t('completed')}</button>;
                    } else if (isPurchased) {
                        button = <button onClick={() => handleGoToTask(task)} className="w-full mt-2 py-2 rounded-lg font-bold bg-blue-600 hover:bg-blue-500">{t('go_to_task')}</button>;
                    } else {
                        // The button is always enabled for paid tasks to let Telegram handle the purchase flow
                        button = <button onClick={() => onPurchase(task)} className="w-full mt-2 py-2 rounded-lg font-bold bg-purple-600 hover:bg-purple-500 flex justify-center items-center space-x-2">
                                    <span>{task.priceStars > 0 ? `${t('unlock_for')} ${task.priceStars}` : t('get')}</span>
                                    {task.priceStars > 0 && <StarIcon />}
                                 </button>;
                    }

                    return (
                        <div key={task.id} className={`bg-gray-800 p-4 rounded-lg ${isCompleted ? 'opacity-60' : ''}`}>
                            <h2 className="text-lg font-bold">{task.name[lang]}</h2>
                            <p className="text-sm text-gray-400 my-1">{task.description[lang]}</p>
                            <div className="text-sm text-yellow-300 my-2 flex items-center space-x-4">
                                <span>+ {task.rewardCoins.toLocaleString()} 🪙</span>
                                {task.rewardStars > 0 && <span className="flex items-center space-x-1"><span>+{task.rewardStars}</span> <StarIcon /></span>}
                            </div>
                            {button}
                        </div>
                    );
                })}
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
export default App;
