import React, { useState } from 'https://esm.sh/react';
import { Upgrade, UpgradeCategory, Language, PlayerState, GameConfig, UiIcons } from '../types';
import UpgradeCard from '../components/UpgradeCard';
import { useTranslation } from '../hooks/useGameLogic';

interface MineProps {
  upgrades: (Upgrade & {level: number})[];
  balance: number;
  onBuyUpgrade: (id: string) => void;
  lang: Language;
  playerState: PlayerState;
  config: GameConfig;
  onClaimCombo: () => void;
  uiIcons: UiIcons;
  handleMetaTap: (targetId: string) => void;
}

const DailyComboSection: React.FC<Pick<MineProps, 'playerState' | 'config' | 'onClaimCombo' | 'upgrades' | 'lang'>> =
  ({ playerState, config, onClaimCombo, upgrades, lang }) => {
  const t = useTranslation();
  const combo_ids = config.dailyEvent?.combo_ids || [];

  if (!config.dailyEvent || combo_ids.length !== 3) {
      return (
        <div className="mb-4 p-2 card-glow rounded-2xl text-center flex-shrink-0">
            <h2 className="text-base font-display text-[var(--accent-color)]">{t('daily_combo')}</h2>
            <p className="text-[var(--text-secondary)] text-xs">{t('combo_not_active')}</p>
        </div>
      );
  }

  const upgradedCardsToday = playerState.dailyUpgrades || [];
  const allComboCardsUpgradedToday = combo_ids.every(id => upgradedCardsToday.includes(id));
  const isClaimed = playerState.claimedComboToday;

  return (
    <div className="mb-4 p-2 card-glow rounded-2xl flex-shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-2">
            <div className="flex-shrink-0 w-full sm:w-auto sm:pr-4">
                <h2 className="text-base font-display text-[var(--accent-color)]">{t('daily_combo')}</h2>
                <p className="text-xs text-[var(--text-secondary)]">{t('find_cards')}</p>
            </div>
            <div className="flex justify-center items-center space-x-2 flex-grow my-2 sm:my-0">
                {combo_ids.map((id, index) => {
                    const isUpgradedToday = upgradedCardsToday.includes(id);
                    const upgrade = upgrades.find(u => u.id === id);
                    return (
                        <div key={index} className="w-10 h-10 bg-slate-900/50 shadow-inner rounded-lg flex items-center justify-center p-0.5">
                            {isUpgradedToday && upgrade ? (
                                <img src={upgrade.iconUrl} alt={upgrade.name?.[lang]} className="w-full h-full object-contain" />
                            ) : (
                                <span className="text-2xl text-gray-500 font-display">?</span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="flex-shrink-0 w-full sm:w-28 sm:pl-4">
                {isClaimed ? (
                    <button disabled className="w-full py-2 font-bold text-xs bg-slate-900/50 shadow-inner rounded-lg text-gray-500 cursor-not-allowed text-center">
                        {t('claimed_today')}
                    </button>
                ) : (
                    <button
                        onClick={onClaimCombo}
                        disabled={!allComboCardsUpgradedToday}
                        className="w-full py-2 font-bold text-xs text-white interactive-button rounded-lg bg-[var(--accent-color-glow)] text-center disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700"
                    >
                        {t('claim_reward')}
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};


const MineScreen: React.FC<MineProps> = ({ upgrades, balance, onBuyUpgrade, lang, playerState, config, onClaimCombo, uiIcons, handleMetaTap }) => {
  const t = useTranslation();
  const categories = Object.values(UpgradeCategory);
  const firstCategoryWithUpgrades = categories.find(c => upgrades.some(u => u.category === c)) || categories[0];
  const [activeCategory, setActiveCategory] = useState<UpgradeCategory>(firstCategoryWithUpgrades);

  const getUpgradesByCategory = (category: UpgradeCategory) => {
    return upgrades.filter(u => u.category === category);
  };
  
  return (
    <div className="flex flex-col h-full text-white pt-4 px-4">
      <h1 className="text-3xl font-display text-center mb-4 flex-shrink-0 cursor-pointer" onClick={() => handleMetaTap('mine-title')}>{t('mine_upgrades')}</h1>
      
      <DailyComboSection
          playerState={playerState}
          config={config}
          onClaimCombo={onClaimCombo}
          upgrades={upgrades}
          lang={lang}
      />
      
      <div className="flex-grow flex flex-col gap-2 overflow-hidden">
        {/* Horizontal Category Navigation */}
        <nav className="flex-shrink-0 overflow-x-auto no-scrollbar">
            <div className="inline-flex space-x-2 pb-2">
                {categories.map(category => {
                    if (getUpgradesByCategory(category).length === 0) return null;
                    const isActive = activeCategory === category;
                    return (
                        <button
                            key={category}
                            onClick={() => setActiveCategory(category)}
                            className={`px-3 py-1.5 text-sm font-bold whitespace-nowrap rounded-lg transition-all ${
                                isActive
                                    ? 'bg-slate-900 shadow-inner text-[var(--accent-color)]'
                                    : 'interactive-button text-[var(--text-secondary)]'
                            }`}
                        >
                            {category}
                        </button>
                    );
                })}
            </div>
        </nav>

        {/* Vertical Card Grid Area */}
        <div className="flex-grow overflow-y-auto no-scrollbar -mx-4 px-4">
            <div className="grid grid-cols-2 gap-3 pb-4">
                {getUpgradesByCategory(activeCategory).map(upgrade => (
                    <div key={upgrade.id}>
                        <UpgradeCard
                            upgrade={upgrade}
                            balance={balance}
                            onBuy={onBuyUpgrade}
                            lang={lang}
                            uiIcons={uiIcons}
                        />
                    </div>
                ))}
            </div>
        </div>
      </div>
       <style>{`
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default MineScreen;