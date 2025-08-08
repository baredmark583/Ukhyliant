import React, { useState } from 'react';
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
}

const DailyComboSection: React.FC<Pick<MineProps, 'playerState' | 'config' | 'onClaimCombo' | 'upgrades' | 'lang'>> =
  ({ playerState, config, onClaimCombo, upgrades, lang }) => {
  const t = useTranslation();
  const combo_ids = config.dailyEvent?.combo_ids || [];

  if (!config.dailyEvent || combo_ids.length !== 3) {
      return (
        <div className="mb-4 p-2 bg-green-900/20 border border-green-500/50 text-center flex-shrink-0">
            <h2 className="text-lg font-display text-green-300 mb-1">{t('daily_combo')}</h2>
            <p className="text-gray-400 text-sm">{t('combo_not_active')}</p>
        </div>
      );
  }

  const upgradedCardsToday = playerState.dailyUpgrades || [];
  const allComboCardsUpgradedToday = combo_ids.every(id => upgradedCardsToday.includes(id));
  const isClaimed = playerState.claimedComboToday;

  return (
    <div className="mb-4 p-2 bg-green-900/20 border border-green-500/50 flex-shrink-0">
      <h2 className="text-lg font-display text-center text-green-300 mb-1">{t('daily_combo')}</h2>
      <p className="text-center text-gray-300 text-xs mb-2">{t('find_cards')}</p>
      <div className="flex justify-around items-center mb-2">
        {combo_ids.map((id, index) => {
          const isUpgradedToday = upgradedCardsToday.includes(id);
          const upgrade = upgrades.find(u => u.id === id);
          return (
            <div key={index} className="w-12 h-12 bg-black/30 flex items-center justify-center border border-dashed border-gray-600 p-1">
              {isUpgradedToday && upgrade ? (
                <img src={upgrade.iconUrl} alt={upgrade.name?.[lang]} className="w-full h-full object-contain" />
              ) : (
                <span className="text-3xl text-gray-500 font-display">?</span>
              )}
            </div>
          );
        })}
      </div>
      {isClaimed ? (
        <button disabled className="w-full py-2 font-bold text-sm bg-gray-700 text-gray-500 cursor-not-allowed">
          {t('claimed_today')}
        </button>
      ) : (
        <button
          onClick={onClaimCombo}
          disabled={!allComboCardsUpgradedToday}
          className="w-full py-2 font-bold text-sm text-white transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed bg-green-600 hover:bg-green-500"
        >
          {t('claim_reward')}
        </button>
      )}
    </div>
  );
};


const MineScreen: React.FC<MineProps> = ({ upgrades, balance, onBuyUpgrade, lang, playerState, config, onClaimCombo, uiIcons }) => {
  const t = useTranslation();
  const categories = Object.values(UpgradeCategory);
  const [activeCategory, setActiveCategory] = useState<UpgradeCategory>(categories[0]);

  const getUpgradesByCategory = (category: UpgradeCategory) => {
    return upgrades.filter(u => u.category === category);
  };
  
  return (
    <div className="flex flex-col h-full text-white pt-4 px-4">
      <h1 className="text-3xl font-display text-center mb-4 flex-shrink-0">{t('mine_upgrades')}</h1>
      
      <DailyComboSection
          playerState={playerState}
          config={config}
          onClaimCombo={onClaimCombo}
          upgrades={upgrades}
          lang={lang}
      />
      
      <div className="flex-grow flex gap-4 overflow-hidden">
        {/* Vertical Category Navigation */}
        <nav className="flex flex-col space-y-2 w-1/4 max-w-[120px] flex-shrink-0 overflow-y-auto no-scrollbar pr-2">
          {categories.map(category => {
            if (getUpgradesByCategory(category).length === 0) return null;
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`w-full p-2 text-sm font-bold text-left transition-colors ${
                  isActive
                    ? 'bg-green-600/80 text-white'
                    : 'themed-container hover:bg-gray-700/50 text-gray-300'
                }`}
              >
                {category}
              </button>
            );
          })}
        </nav>

        {/* Horizontal Card Scroll Area */}
        <div className="flex-grow overflow-x-auto no-scrollbar">
          <div className="inline-flex h-full space-x-3 pb-4">
            {getUpgradesByCategory(activeCategory).map(upgrade => (
              <div key={upgrade.id} className="w-32 h-full flex-shrink-0">
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