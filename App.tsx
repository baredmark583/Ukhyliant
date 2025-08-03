
import React from 'react';
import { useGame, useAuth, useTranslation, AuthProvider } from './hooks/useGameLogic';
import ExchangeScreen from './sections/Exchange';
import MineScreen from './sections/Mine';
import BoostScreen from './sections/Boost';
import { ExchangeIcon, MineIcon, BoostIcon, TasksIcon, AdminIcon, StarIcon } from './constants';
import { DailyTask, GameConfig, Language, Upgrade, UpgradeCategory, Boost } from './types';

type Screen = 'exchange' | 'mine' | 'boost' | 'tasks' | 'admin';

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
        <p className="text-lg animate-pulse">Connecting to Telegram...</p>
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
  const { user, isAdmin, logout, switchLanguage } = useAuth();
  const { playerState, config, handleTap, buyUpgrade, allUpgrades, currentLeague, claimTaskReward, buyBoost, gameAdmin } = useGame();
  const [activeScreen, setActiveScreen] = React.useState<Screen>('exchange');
  const t = useTranslation();

  if (!user) return null; // Should not happen if logic is correct
  
  const lang = user.language;

  const renderScreen = () => {
    switch (activeScreen) {
      case 'exchange':
        return <ExchangeScreen playerState={playerState} currentLeague={currentLeague} onTap={handleTap} user={user} />;
      case 'mine':
        return <MineScreen upgrades={allUpgrades} balance={playerState.balance} onBuyUpgrade={buyUpgrade} lang={lang} />;
      case 'boost':
        return <BoostScreen stars={playerState.stars} boosts={config.boosts} onBuyBoost={buyBoost} lang={lang} />;
      case 'tasks':
        return <TasksScreen tasks={config.tasks} playerState={playerState} onClaim={claimTaskReward} lang={lang} />;
      case 'admin':
          return isAdmin ? <AdminScreen config={config} onSave={gameAdmin.saveConfig} /> : null;
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

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/50 backdrop-blur-lg border-t border-gray-700/50">
        <div className="flex justify-around items-center max-w-xl mx-auto">
          <NavItem screen="exchange" label={t('exchange')} icon={<ExchangeIcon active={activeScreen === 'exchange'} />} />
          <NavItem screen="mine" label={t('mine')} icon={<MineIcon active={activeScreen === 'mine'} />} />
          <NavItem screen="tasks" label={t('tasks')} icon={<TasksIcon active={activeScreen === 'tasks'} />} />
          <NavItem screen="boost" label={t('boosts')} icon={<BoostIcon active={activeScreen === 'boost'} />} />
          {isAdmin && <NavItem screen="admin" label={t('admin')} icon={<AdminIcon active={activeScreen === 'admin'} />} />}
        </div>
      </div>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
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

const AdminScreen = ({ config, onSave }: { config: GameConfig, onSave: (newConfig: GameConfig) => void }) => {
    const [localConfig, setLocalConfig] = React.useState(config);
    const t = useTranslation();

    const handleUpgradeChange = (index: number, field: keyof Upgrade, value: any) => {
        const newUpgrades = [...localConfig.upgrades];
        // @ts-ignore
        newUpgrades[index][field] = value;
        setLocalConfig({ ...localConfig, upgrades: newUpgrades });
    };

    const saveChanges = () => {
        onSave(localConfig);
        alert('Configuration saved!');
    };

    return (
        <div className="flex flex-col h-full text-white pt-4 pb-24 px-4">
            <h1 className="text-3xl font-bold text-center mb-6">{t('admin')}</h1>
            <div className="overflow-y-auto no-scrollbar space-y-6">
                {/* Upgrade Editor */}
                <div>
                    <h2 className="text-2xl font-semibold mb-3">{t('edit_upgrades')}</h2>
                    <div className="space-y-2 text-sm">
                        {localConfig.upgrades.map((up, index) => (
                            <div key={up.id} className="bg-gray-800 p-3 rounded-lg space-y-2">
                                <input className="w-full bg-gray-700 p-2 rounded" value={up.name.en} onChange={e => handleUpgradeChange(index, 'name', {...up.name, en: e.target.value})} placeholder="Name (EN)" />
                                <input className="w-full bg-gray-700 p-2 rounded" value={up.name.ua} onChange={e => handleUpgradeChange(index, 'name', {...up.name, ua: e.target.value})} placeholder="Name (UA)" />
                                <input type="number" className="w-full bg-gray-700 p-2 rounded" value={up.price} onChange={e => handleUpgradeChange(index, 'price', parseInt(e.target.value))} placeholder="Price" />
                                <input type="number" className="w-full bg-gray-700 p-2 rounded" value={up.profitPerHour} onChange={e => handleUpgradeChange(index, 'profitPerHour', parseInt(e.target.value))} placeholder="Profit/hr" />
                                <input className="w-full bg-gray-700 p-2 rounded" value={up.icon} onChange={e => handleUpgradeChange(index, 'icon', e.target.value)} placeholder="Icon" />
                            </div>
                        ))}
                    </div>
                </div>
                {/* Add more editors for Tasks and Boosts here */}
            </div>
            <button onClick={saveChanges} className="mt-6 w-full bg-blue-600 font-bold py-3 rounded-lg">{t('save')}</button>
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