

import React, { useState } from 'react';
import { useGame, useAuth, useTranslation, AuthProvider } from './hooks/useGameLogic';
import ExchangeScreen from './sections/Exchange';
import MineScreen from './sections/Mine';
import BoostScreen from './sections/Boost';
import { ExchangeIcon, MineIcon, FriendsIcon, BoostIcon, TasksIcon, AdminIcon, StarIcon, EarnIcon, REFERRAL_BONUS, TELEGRAM_BOT_NAME, CoinIcon } from './constants';
import { DailyTask, GameConfig, Language, Upgrade, Boost, SpecialTask, LocalizedString, SpecialTaskType, PlayerState, User } from './types';

type Screen = 'exchange' | 'mine' | 'friends' | 'boost' | 'tasks' | 'earn' | 'admin';
type AdminTab = 'upgrades' | 'tasks' | 'boosts' | 'special';

const AppContainer: React.FC = () => {
    const { user, isInitializing } = useAuth();
    const { isGameLoading } = useGame();
    
    if (isInitializing || isGameLoading) {
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
  const { user, hasAdminAccess, logout, switchLanguage } = useAuth();
  const { 
      playerState, config, handleTap, buyUpgrade, allUpgrades, currentLeague, 
      claimTaskReward, buyBoost, purchaseSpecialTask, completeSpecialTask, gameAdmin 
  } = useGame();
  const [activeScreen, setActiveScreen] = React.useState<Screen>('exchange');
  const t = useTranslation();

  if (!user) return null;
  
  const lang = user.language;

  const renderScreen = () => {
    switch (activeScreen) {
      case 'exchange':
        return <ExchangeScreen playerState={playerState} currentLeague={currentLeague} onTap={handleTap} user={user} />;
      case 'mine':
        return <MineScreen upgrades={allUpgrades} balance={playerState.balance} onBuyUpgrade={buyUpgrade} lang={lang} />;
      case 'friends':
        return <FriendsScreen playerState={playerState} user={user} />;
      case 'boost':
        return <BoostScreen stars={playerState.stars} boosts={config.boosts} onBuyBoost={buyBoost} lang={lang} />;
      case 'tasks':
        return <TasksScreen tasks={config.tasks} playerState={playerState} onClaim={claimTaskReward} lang={lang} />;
      case 'earn':
        return <EarnScreen tasks={config.specialTasks} playerState={playerState} onPurchase={purchaseSpecialTask} onComplete={completeSpecialTask} lang={lang} />;
      case 'admin':
          return hasAdminAccess ? <AdminScreen config={config} onSave={gameAdmin.saveConfig} onTranslate={gameAdmin.translate} /> : null;
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
            <button onClick={() => switchLanguage(lang === 'en' ? 'ua' : 'en')} className="bg-gray-800 text-white rounded-md px-3 py-1 text-sm">{lang.toUpperCase()}</button>
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
          {hasAdminAccess && <NavItem screen="admin" label={t('admin')} icon={<AdminIcon active={activeScreen === 'admin'} />} />}
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
        const referralLink = `https://t.me/${TELEGRAM_BOT_NAME}?start=${user.id}`;
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
                        button = <button onClick={() => { window.open(task.url, '_blank'); onComplete(task); }} className="w-full mt-2 py-2 rounded-lg font-bold bg-blue-600 hover:bg-blue-500">{t('go_to_task')}</button>;
                    } else {
                        button = <button onClick={() => onPurchase(task)} disabled={playerState.stars < task.priceStars} className="w-full mt-2 py-2 rounded-lg font-bold bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:text-gray-400 flex justify-center items-center space-x-2">
                                    <span>{t('unlock_for')} {task.priceStars}</span><StarIcon/>
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


const AdminScreen = ({ config, onSave, onTranslate }: { config: GameConfig, onSave: (newConfig: GameConfig) => void, onTranslate: (text: string, from: Language, to: Language) => Promise<string> }) => {
    const [localConfig, setLocalConfig] = React.useState(config);
    const [activeTab, setActiveTab] = useState<AdminTab>('special');
    const t = useTranslation();

    const handleFieldChange = (section: keyof GameConfig, index: number, field: string, value: any) => {
        const newSection = [...(localConfig[section] as any[])];
        const keys = field.split('.');
        if (keys.length > 1) {
            newSection[index][keys[0]][keys[1]] = value;
        } else {
            newSection[index][field] = value;
        }
        setLocalConfig({ ...localConfig, [section]: newSection });
    };
    
    const handleTranslate = async (section: keyof GameConfig, index: number, field: keyof LocalizedString, text: string) => {
        const fromLang = field;
        const toLang = field === 'en' ? 'ua' : 'en';
        const translatedText = await onTranslate(text, fromLang, toLang);
        handleFieldChange(section, index, `name.${toLang}`, translatedText);

        const currentItem = localConfig[section][index];
        // Safely check for description and translate if it exists
        if ('description' in currentItem && typeof currentItem.description === 'object' && currentItem.description !== null) {
             const descriptionObject = currentItem.description as LocalizedString;
             if (descriptionObject[fromLang]) {
                const translatedDesc = await onTranslate(descriptionObject[fromLang], fromLang, toLang);
                handleFieldChange(section, index, `description.${toLang}`, translatedDesc);
             }
        }
    };

    const saveChanges = () => {
        onSave(localConfig);
        alert('Configuration saved!');
    };
    
    const TabButton = ({ tab, label }: { tab: AdminTab, label: string }) => (
        <button onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-bold rounded-t-lg ${activeTab === tab ? 'bg-gray-800 text-white' : 'bg-gray-900 text-gray-400'}`}>{label}</button>
    )

    return (
        <div className="flex flex-col h-full text-white pt-4 pb-24 px-4">
            <h1 className="text-3xl font-bold text-center mb-4">{t('admin')}</h1>
            
            <div className="flex space-x-1 border-b border-gray-700">
                <TabButton tab="special" label={t('edit_special_tasks')} />
                <TabButton tab="upgrades" label={t('edit_upgrades')} />
                <TabButton tab="tasks" label={t('edit_tasks')} />
                <TabButton tab="boosts" label={t('edit_boosts')} />
            </div>

            <div className="overflow-y-auto no-scrollbar space-y-6 flex-grow bg-gray-800 p-3 rounded-b-lg">
                {activeTab === 'special' && (
                     <div>
                        {localConfig.specialTasks.map((task, index) => (
                            <div key={task.id} className="bg-gray-700 p-3 rounded-lg space-y-2 mb-3">
                                <label className="text-xs text-gray-400">Name (EN)</label>
                                <div className="flex items-center">
                                    <input className="w-full bg-gray-600 p-2 rounded-l" value={task.name.en} onChange={e => handleFieldChange('specialTasks', index, 'name.en', e.target.value)} />
                                    <button onClick={() => handleTranslate('specialTasks', index, 'en', task.name.en)} className="bg-blue-600 p-2 rounded-r">🈂️</button>
                                </div>
                                <label className="text-xs text-gray-400">Name (UA)</label>
                                <div className="flex items-center">
                                    <input className="w-full bg-gray-600 p-2 rounded-l" value={task.name.ua} onChange={e => handleFieldChange('specialTasks', index, 'name.ua', e.target.value)} />
                                    <button onClick={() => handleTranslate('specialTasks', index, 'ua', task.name.ua)} className="bg-blue-600 p-2 rounded-r">🈂️</button>
                                </div>
                                <label className="text-xs text-gray-400">Description (EN)</label>
                                <textarea className="w-full bg-gray-600 p-2 rounded text-sm" value={task.description.en} onChange={e => handleFieldChange('specialTasks', index, 'description.en', e.target.value)} />
                                <label className="text-xs text-gray-400">Description (UA)</label>
                                <textarea className="w-full bg-gray-600 p-2 rounded text-sm" value={task.description.ua} onChange={e => handleFieldChange('specialTasks', index, 'description.ua', e.target.value)} />
                                
                                <select value={task.type} onChange={e => handleFieldChange('specialTasks', index, 'type', e.target.value)} className="w-full bg-gray-600 p-2 rounded">
                                    <option value="telegram_join">{t('telegram_join')}</option>
                                    <option value="social_follow">{t('social_follow')}</option>
                                    <option value="video_watch">{t('video_watch')}</option>
                                </select>

                                <input type="text" className="w-full bg-gray-600 p-2 rounded" value={task.url} onChange={e => handleFieldChange('specialTasks', index, 'url', e.target.value)} placeholder="URL" />
                                <input type="number" className="w-full bg-gray-600 p-2 rounded" value={task.rewardCoins} onChange={e => handleFieldChange('specialTasks', index, 'rewardCoins', parseInt(e.target.value))} placeholder={t('reward_coins')} />
                                <input type="number" className="w-full bg-gray-600 p-2 rounded" value={task.rewardStars} onChange={e => handleFieldChange('specialTasks', index, 'rewardStars', parseInt(e.target.value))} placeholder={t('reward_stars')} />
                                <input type="number" className="w-full bg-gray-600 p-2 rounded" value={task.priceStars} onChange={e => handleFieldChange('specialTasks', index, 'priceStars', parseInt(e.target.value))} placeholder={t('price_stars')} />
                            </div>
                        ))}
                    </div>
                )}
                 {activeTab === 'upgrades' && (
                    <div>
                        {localConfig.upgrades.map((up, index) => (
                             <div key={up.id} className="bg-gray-700 p-3 rounded-lg space-y-2 mb-3">
                                <div className="flex items-center">
                                    <input className="w-full bg-gray-600 p-2 rounded-l" value={up.name.en} onChange={e => handleFieldChange('upgrades', index, 'name.en', e.target.value)} />
                                    <button onClick={() => handleTranslate('upgrades', index, 'en', up.name.en)} className="bg-blue-600 p-2 rounded-r">🈂️</button>
                                </div>
                                <input className="w-full bg-gray-600 p-2 rounded" value={up.name.ua} onChange={e => handleFieldChange('upgrades', index, 'name.ua', e.target.value)} />
                                <input type="number" className="w-full bg-gray-600 p-2 rounded" value={up.price} onChange={e => handleFieldChange('upgrades', index, 'price', parseInt(e.target.value))} />
                                <input type="number" className="w-full bg-gray-600 p-2 rounded" value={up.profitPerHour} onChange={e => handleFieldChange('upgrades', index, 'profitPerHour', parseInt(e.target.value))} />
                                <input className="w-full bg-gray-600 p-2 rounded" value={up.icon} onChange={e => handleFieldChange('upgrades', index, 'icon', e.target.value)} />
                            </div>
                        ))}
                    </div>
                )}
                {/* Add other tabs for tasks and boosts here */}
            </div>
            <button onClick={saveChanges} className="mt-4 w-full bg-blue-600 font-bold py-3 rounded-lg">{t('save')}</button>
        </div>
    );
};


const App: React.FC = () => {
    return (
        <AuthProvider>
            <AppContainer />
        </AuthProvider>
    );
}

export default App;