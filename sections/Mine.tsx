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
        <div className="mb-4 p-3 bg-green-900/20 border border-green-500/50 text-center">
            <h2 className="text-lg font-display text-green-300 mb-1">{t('daily_combo')}</h2>
            <p className="text-gray-400 text-sm">{t('combo_not_active')}</p>
        </div>
      );
  }

  const upgradedCardsToday = playerState.dailyUpgrades || [];
  const allComboCardsUpgradedToday = combo_ids.every(id => upgradedCardsToday.includes(id));
  const isClaimed = playerState.claimedComboToday;

  return (
    <div className="mb-4 p-3 bg-green-900/20 border border-green-500/50">
      <h2 className="text-lg font-display text-center text-green-300 mb-1">{t('daily_combo')}</h2>
      <p className="text-center text-gray-300 text-xs mb-3">{t('find_cards')}</p>
      <div className="flex justify-around items-center mb-3">
        {combo_ids.map((id, index) => {
          const isUpgradedToday = upgradedCardsToday.includes(id);
          const upgrade = upgrades.find(u => u.id === id);
          return (
            <div key={index} className="w-16 h-16 bg-black/30 flex items-center justify-center border border-dashed border-gray-600 p-1">
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

const AccordionItem: React.FC<{
    category: UpgradeCategory;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}> = ({ category, isExpanded, onToggle, children }) => {
    return (
        <div>
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-3 themed-container hover:bg-gray-700/50"
            >
                <h2 className="text-xl font-display text-gray-300">{category}</h2>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-6 w-6 transform transition-transform duration-200 text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isExpanded && (
                <div className="pt-2">
                    {children}
                </div>
            )}
        </div>
    );
};


const MineScreen: React.FC<MineProps> = ({ upgrades, balance, onBuyUpgrade, lang, playerState, config, onClaimCombo, uiIcons }) => {
  const t = useTranslation();
  const categories = Object.values(UpgradeCategory);
  const [expandedCategory, setExpandedCategory] = useState<UpgradeCategory | null>(categories[0]);

  const getUpgradesByCategory = (category: UpgradeCategory) => {
    return upgrades.filter(u => u.category === category);
  };
  
  const handleToggle = (category: UpgradeCategory) => {
      setExpandedCategory(prev => prev === category ? null : category);
  };

  return (
    <div className="flex flex-col h-full text-white pt-4 px-4">
      <h1 className="text-3xl font-display text-center mb-4">{t('mine_upgrades')}</h1>

      <div className="overflow-y-auto space-y-4 flex-grow no-scrollbar">
        <DailyComboSection
          playerState={playerState}
          config={config}
          onClaimCombo={onClaimCombo}
          upgrades={upgrades}
          lang={lang}
        />
        {categories.map(category => {
          const categoryUpgrades = getUpgradesByCategory(category);
          if (categoryUpgrades.length === 0) return null;
          return (
            <AccordionItem 
                key={category} 
                category={category}
                isExpanded={expandedCategory === category}
                onToggle={() => handleToggle(category)}
            >
                <div className="grid grid-cols-2 gap-2">
                  {categoryUpgrades.map(upgrade => (
                    <UpgradeCard
                      key={upgrade.id}
                      upgrade={upgrade}
                      balance={balance}
                      onBuy={onBuyUpgrade}
                      lang={lang}
                      uiIcons={uiIcons}
                    />
                  ))}
                </div>
            </AccordionItem>
          );
        })}
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