
import React, { useState } from 'react';
import { useGame, useAuth, useTranslation, AuthProvider } from './hooks/useGameLogic';
import ExchangeScreen from './sections/Exchange';
import MineScreen from './sections/Mine';
import BoostScreen from './sections/Boost';
import { ExchangeIcon, MineIcon, FriendsIcon, BoostIcon, TasksIcon, AdminIcon, StarIcon, EarnIcon, REFERRAL_BONUS, TELEGRAM_BOT_NAME, CoinIcon } from './constants';
import { DailyTask, GameConfig, Language, Upgrade, Boost, SpecialTask, LocalizedString, SpecialTaskType, PlayerState, User, UpgradeCategory } from './types';

type Screen = 'exchange' | 'mine' | 'friends' | 'boost' | 'tasks' | 'earn' | 'admin';
type AdminTab = 'upgrades' | 'tasks' | 'boosts' | 'special';

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
  const { user, hasAdminAccess, logout, switchLanguage } = useAuth();
  const { 
      playerState, config, handleTap, buyUpgrade, allUpgrades, currentLeague, 
      claimTaskReward, buyBoost, purchaseSpecialTask, completeSpecialTask, gameAdmin 
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

    React.useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleFieldChange = (section: keyof GameConfig, index: number, field: string, value: any) => {
        const newSection = [...(localConfig[section] as any[])];
        const keys = field.split('.');
        if (keys.length > 1) {
            newSection[index] = { ...newSection[index], [keys[0]]: { ...newSection[index][keys[0]], [keys[1]]: value } };
        } else {
            newSection[index] = { ...newSection[index], [field]: value };
        }
        setLocalConfig({ ...localConfig, [section]: newSection });
    };
    
    const handleTranslate = async (section: keyof GameConfig, index: number, fieldToTranslate: 'name' | 'description' = 'name') => {
        const item = localConfig[section][index];
        if (!item || !(fieldToTranslate in item)) return;

        const textObject = item[fieldToTranslate] as LocalizedString;
        const fromLang = (Object.keys(textObject) as Language[]).find(lang => textObject[lang]?.length > 0);
        if (!fromLang) return; 

        const sourceText = textObject[fromLang];
        const toTranslateLangs: Language[] = ['en', 'ua', 'ru'].filter(l => l !== fromLang);

        for (const toLang of toTranslateLangs) {
            try {
                const translatedText = await onTranslate(sourceText, fromLang, toLang);
                handleFieldChange(section, index, `${fieldToTranslate}.${toLang}`, translatedText);
            } catch (error) {
                console.error(`Error translating to ${toLang}:`, error);
            }
        }
    };

    const saveChanges = () => {
        onSave(localConfig);
        alert('Configuration saved!');
    };
    
    const TabButton = ({ tab, label }: { tab: AdminTab, label: string }) => (
        <button onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-bold rounded-t-lg ${activeTab === tab ? 'bg-gray-800 text-white' : 'bg-gray-900 text-gray-400'}`}>{label}</button>
    );
    
    const AddButton = ({ onClick }: { onClick: () => void }) => (
        <button onClick={onClick} className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg">
            Add New
        </button>
    );

    const addNew = (section: keyof GameConfig) => {
        let newItem: any;
        const id = `${section.slice(0, 4)}_${Date.now()}`;
        const base = { id, name: { en: '', ua: '', ru: '' } };

        switch (section) {
            case 'upgrades':
                newItem = { ...base, price: 100, profitPerHour: 10, category: UpgradeCategory.Documents, icon: '🆕' };
                break;
            case 'tasks':
                newItem = { ...base, rewardCoins: 1000, rewardStars: 5, requiredTaps: 500 };
                break;
            case 'boosts':
                newItem = { ...base, description: { en: '', ua: '', ru: '' }, cost: 10, icon: '🆕' };
                break;
            case 'specialTasks':
                newItem = { ...base, description: { en: '', ua: '', ru: '' }, type: 'telegram_join', url: 'https://t.me/', rewardCoins: 10000, rewardStars: 10, priceStars: 0, isOneTime: true };
                break;
            default: return;
        }

        setLocalConfig(prev => ({ ...prev, [section]: [...prev[section], newItem] }));
    };

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
                            <div key={index} className="bg-gray-700 p-3 rounded-lg space-y-2 mb-3">
                                <label className="text-xs text-gray-400">Name</label>
                                <div className="flex items-center">
                                    <input placeholder="EN" className="w-full bg-gray-600 p-2 rounded-l" value={task.name.en} onChange={e => handleFieldChange('specialTasks', index, 'name.en', e.target.value)} />
                                    <button onClick={() => handleTranslate('specialTasks', index, 'name')} className="bg-blue-600 p-2">🈂️</button>
                                </div>
                                <input placeholder="UA" className="w-full bg-gray-600 p-2 rounded" value={task.name.ua} onChange={e => handleFieldChange('specialTasks', index, 'name.ua', e.target.value)} />
                                <input placeholder="RU" className="w-full bg-gray-600 p-2 rounded" value={task.name.ru} onChange={e => handleFieldChange('specialTasks', index, 'name.ru', e.target.value)} />

                                <label className="text-xs text-gray-400">Description</label>
                                 <div className="flex items-center">
                                    <textarea placeholder="EN" className="w-full bg-gray-600 p-2 rounded-l text-sm" value={task.description.en} onChange={e => handleFieldChange('specialTasks', index, 'description.en', e.target.value)} />
                                    <button onClick={() => handleTranslate('specialTasks', index, 'description')} className="bg-blue-600 p-2 self-stretch flex items-center">🈂️</button>
                                </div>
                                <textarea placeholder="UA" className="w-full bg-gray-600 p-2 rounded text-sm" value={task.description.ua} onChange={e => handleFieldChange('specialTasks', index, 'description.ua', e.target.value)} />
                                <textarea placeholder="RU" className="w-full bg-gray-600 p-2 rounded text-sm" value={task.description.ru} onChange={e => handleFieldChange('specialTasks', index, 'description.ru', e.target.value)} />
                                
                                <select value={task.type} onChange={e => handleFieldChange('specialTasks', index, 'type', e.target.value)} className="w-full bg-gray-600 p-2 rounded">
                                    <option value="telegram_join">{t('telegram_join')}</option>
                                    <option value="social_follow">{t('social_follow')}</option>
                                    <option value="video_watch">{t('video_watch')}</option>
                                </select>

                                <input type="text" className="w-full bg-gray-600 p-2 rounded" value={task.url} onChange={e => handleFieldChange('specialTasks', index, 'url', e.target.value)} placeholder="URL" />
                                <input type="number" className="w-full bg-gray-600 p-2 rounded" value={task.rewardCoins} onChange={e => handleFieldChange('specialTasks', index, 'rewardCoins', parseInt(e.target.value))} placeholder={t('reward_coins')} />
                                <input type="number" className="w-full bg-gray-600 p-2 rounded" value={task.priceStars} onChange={e => handleFieldChange('specialTasks', index, 'priceStars', parseInt(e.target.value))} placeholder={t('price_stars')} />
                            </div>
                        ))}
                         <AddButton onClick={() => addNew('specialTasks')} />
                    </div>
                )}
                 {activeTab === 'upgrades' && (
                    <div>
                        {localConfig.upgrades.map((item, index) => (
                            <div key={index} className="bg-gray-700 p-3 rounded-lg space-y-2 mb-3">
                                <label className="text-xs text-gray-400">Name</label>
                                <div className="flex items-center"><input placeholder="EN" className="w-full bg-gray-600 p-2 rounded-l" value={item.name.en} onChange={e => handleFieldChange('upgrades', index, 'name.en', e.target.value)} /><button onClick={() => handleTranslate('upgrades', index, 'name')} className="bg-blue-600 p-2">🈂️</button></div>
                                <input placeholder="UA" className="w-full bg-gray-600 p-2 rounded" value={item.name.ua} onChange={e => handleFieldChange('upgrades', index, 'name.ua', e.target.value)} />
                                <input placeholder="RU" className="w-full bg-gray-600 p-2 rounded" value={item.name.ru} onChange={e => handleFieldChange('upgrades', index, 'name.ru', e.target.value)} />
                                <input type="number" className="w-full bg-gray-600 p-2 rounded" value={item.price} onChange={e => handleFieldChange('upgrades', index, 'price', parseInt(e.target.value))} placeholder={t('price')} />
                                <input type="number" className="w-full bg-gray-600 p-2 rounded" value={item.profitPerHour} onChange={e => handleFieldChange('upgrades', index, 'profitPerHour', parseInt(e.target.value))} placeholder={t('profit_per_hour')} />
                                <input type="text" className="w-full bg-gray-600 p-2 rounded" value={item.icon} onChange={e => handleFieldChange('upgrades', index, 'icon', e.target.value)} placeholder={t('icon')} />
                                <select value={item.category} onChange={e => handleFieldChange('upgrades', index, 'category', e.target.value)} className="w-full bg-gray-600 p-2 rounded">{Object.values(UpgradeCategory).map(c => <option key={c} value={c}>{c}</option>)}</select>
                            </div>
                        ))}
                        <AddButton onClick={() => addNew('upgrades')} />
                    </div>
                )}
                {activeTab === 'tasks' && (
                    <div>
                        {localConfig.tasks.map((item, index) => (
                             <div key={index} className="bg-gray-700 p-3 rounded-lg space-y-2 mb-3">
                                <label className="text-xs text-gray-400">Name</label>
                                <div className="flex items-center"><input placeholder="EN" className="w-full bg-gray-600 p-2 rounded-l" value={item.name.en} onChange={e => handleFieldChange('tasks', index, 'name.en', e.target.value)} /><button onClick={() => handleTranslate('tasks', index, 'name')} className="bg-blue-600 p-2">🈂️</button></div>
                                <input placeholder="UA" className="w-full bg-gray-600 p-2 rounded" value={item.name.ua} onChange={e => handleFieldChange('tasks', index, 'name.ua', e.target.value)} />
                                <input placeholder="RU" className="w-full bg-gray-600 p-2 rounded" value={item.name.ru} onChange={e => handleFieldChange('tasks', index, 'name.ru', e.target.value)} />
                                <input type="number" className="w-full bg-gray-600 p-2 rounded" value={item.rewardCoins} onChange={e => handleFieldChange('tasks', index, 'rewardCoins', parseInt(e.target.value))} placeholder={t('reward_coins')} />
                                <input type="number" className="w-full bg-gray-600 p-2 rounded" value={item.rewardStars} onChange={e => handleFieldChange('tasks', index, 'rewardStars', parseInt(e.target.value))} placeholder={t('reward_stars')} />
                                <input type="number" className="w-full bg-gray-600 p-2 rounded" value={item.requiredTaps} onChange={e => handleFieldChange('tasks', index, 'requiredTaps', parseInt(e.target.value))} placeholder={t('required_taps')} />
                            </div>
                        ))}
                        <AddButton onClick={() => addNew('tasks')} />
                    </div>
                )}
                {activeTab === 'boosts' && (
                     <div>
                        {localConfig.boosts.map((item, index) => (
                             <div key={index} className="bg-gray-700 p-3 rounded-lg space-y-2 mb-3">
                                <label className="text-xs text-gray-400">Name</label>
                                <div className="flex items-center"><input placeholder="EN" className="w-full bg-gray-600 p-2 rounded-l" value={item.name.en} onChange={e => handleFieldChange('boosts', index, 'name.en', e.target.value)} /><button onClick={() => handleTranslate('boosts', index, 'name')} className="bg-blue-600 p-2">🈂️</button></div>
                                <input placeholder="UA" className="w-full bg-gray-600 p-2 rounded" value={item.name.ua} onChange={e => handleFieldChange('boosts', index, 'name.ua', e.target.value)} />
                                <input placeholder="RU" className="w-full bg-gray-600 p-2 rounded" value={item.name.ru} onChange={e => handleFieldChange('boosts', index, 'name.ru', e.target.value)} />
                                
                                <label className="text-xs text-gray-400">Description</label>
                                <div className="flex items-center"><textarea placeholder="EN" className="w-full bg-gray-600 p-2 rounded-l text-sm" value={item.description.en} onChange={e => handleFieldChange('boosts', index, 'description.en', e.target.value)} /><button onClick={() => handleTranslate('boosts', index, 'description')} className="bg-blue-600 p-2 self-stretch flex items-center">🈂️</button></div>
                                <textarea placeholder="UA" className="w-full bg-gray-600 p-2 rounded text-sm" value={item.description.ua} onChange={e => handleFieldChange('boosts', index, 'description.ua', e.target.value)} />
                                <textarea placeholder="RU" className="w-full bg-gray-600 p-2 rounded text-sm" value={item.description.ru} onChange={e => handleFieldChange('boosts', index, 'description.ru', e.target.value)} />
                                
                                <input type="number" className="w-full bg-gray-600 p-2 rounded" value={item.cost} onChange={e => handleFieldChange('boosts', index, 'cost', parseInt(e.target.value))} placeholder={t('cost')} />
                                <input type="text" className="w-full bg-gray-600 p-2 rounded" value={item.icon} onChange={e => handleFieldChange('boosts', index, 'icon', e.target.value)} placeholder={t('icon')} />
                            </div>
                        ))}
                        <AddButton onClick={() => addNew('boosts')} />
                    </div>
                )}
            </div>
            
            <div className="mt-4">
                <button onClick={saveChanges} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg text-lg">
                    {t('save')}
                </button>
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