
import React from 'react';
import { Upgrade, UpgradeCategory, Language } from '../types';
import UpgradeCard from '../components/UpgradeCard';
import { useTranslation } from '../hooks/useGameLogic';

interface MineProps {
  upgrades: (Upgrade & {level: number})[];
  balance: number;
  onBuyUpgrade: (id: string) => void;
  lang: Language;
}

const MineScreen: React.FC<MineProps> = ({ upgrades, balance, onBuyUpgrade, lang }) => {
  const t = useTranslation();
  const categories = Object.values(UpgradeCategory);

  const getUpgradesByCategory = (category: UpgradeCategory) => {
    return upgrades.filter(u => u.category === category);
  };

  return (
    <div className="flex flex-col h-full text-white pt-4 pb-24 px-4">
      <h1 className="text-3xl font-bold text-center mb-6">{t('mine_upgrades')}</h1>
      
      <div className="overflow-y-auto space-y-6 flex-grow no-scrollbar">
        {categories.map(category => {
          const categoryUpgrades = getUpgradesByCategory(category);
          if (categoryUpgrades.length === 0) return null;
          return (
            <div key={category}>
              <h2 className="text-xl font-semibold text-gray-400 mb-3">{category}</h2>
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