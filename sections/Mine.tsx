
import React from 'react';
import { Upgrade, UpgradeCategory, Language, PlayerState, GameConfig } from '../types';
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
}

const DailyComboSection: React.FC<Pick<MineProps, 'playerState' | 'config' | 'onClaimCombo' | 'upgrades' | 'lang'>> =
  ({ playerState, config, onClaimCombo, upgrades, lang }) => {
  const t = useTranslation();
  const comboIds = config.dailyEvent?.comboIds || [];

  if (comboIds.length !== 3) return null;

  const upgradedCardsToday = playerState.dailyUpgrades || [];
  const allComboCardsUpgradedToday = comboIds.every(id => upgradedCardsToday.includes(id));
  const isClaimed = playerState.claimedComboToday;

  return (
    <div className="mb-6 p-4 bg-green-900/20 border border-green-500/50">
      <h2 className="text-xl font-display text-center text-green-300 mb-2">{t('daily_combo')}</h2>
      <p className="text-center text-gray-300 text-sm mb-4">{t('find_cards')}</p>
      <div className="flex justify-around items-center mb-4">
        {comboIds.map((id, index) => {
          const isUpgradedToday = upgradedCardsToday.includes(id);
          const upgrade = upgrades.find(u => u.id === id);
          return (
            <div key={index} className="w-20 h-20 bg-black/30 flex items-center justify-center border border-dashed border-gray-600 p-2">
              {isUpgradedToday && upgrade ? (
                <img src={upgrade.iconUrl} alt={upgrade.name?.[lang]} className="w-full h-full object-contain" />
              ) : (
                <span className="text-4xl text-gray-500 font-display">?</span>
              )}
            </div>
          );
        })}
      </div>
      {isClaimed ? (
        <button disabled className="w-full py-2 font-bold bg-gray-700 text-gray-500 cursor-not-allowed">
          {t('claimed_today')}
        </button>
      ) : (
        <button
          onClick={onClaimCombo}
          disabled={!allComboCardsUpgradedToday}
          className="w-full py-2 font-bold text-white transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed bg-green-600 hover:bg-green-500"
        >
          {t('claim_reward')}
        </button>
      )}
    </div>
  );
};

const MineScreen: React.FC<MineProps> = ({ upgrades, balance, onBuyUpgrade, lang, playerState, config, onClaimCombo }) => {
  const t = useTranslation();
  const categories = Object.values(UpgradeCategory);

  const getUpgradesByCategory = (category: UpgradeCategory) => {
    return upgrades.filter(u => u.category === category);
  };

  return (
    <div className="flex flex-col h-full text-white pt-4 pb-24 px-4">
      <h1 className="text-3xl font-display text-center mb-6">{t('mine_upgrades')}</h1>

      <div className="overflow-y-auto space-y-6 flex-grow no-scrollbar">
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
            <div key={category}>
              <h2 className="text-xl font-display text-gray-400 mb-3">{category}</h2>
              <div className="space-y-2">
                {categoryUpgrades.map(upgrade => (
                  <UpgradeCard
                    key={upgrade.id}
                    upgrade={upgrade}
                    balance={balance}
                    onBuy={onBuyUpgrade}
                    lang={lang}
                  />
                ))}
              </div>
            </div>
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