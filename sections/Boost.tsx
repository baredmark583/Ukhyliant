
import React from 'react';
import { Boost, Language } from '../types';
import { StarIcon } from '../constants';
import { useTranslation } from '../hooks/useGameLogic';

interface BoostProps {
  stars: number;
  boosts: Boost[];
  onBuyBoost: (boost: Boost) => void;
  lang: Language;
}

const BoostScreen: React.FC<BoostProps> = ({ stars, boosts, onBuyBoost, lang }) => {
  const t = useTranslation();

  return (
    <div className="flex flex-col h-full text-white pt-4 pb-24 px-4 items-center">
      <h1 className="text-3xl font-bold text-center mb-2">{t('boosts')}</h1>
      <p className="text-lg text-gray-400 mb-6">
        {t('stars')}: <span className="font-bold text-yellow-300">{stars}</span>
      </p>

      <div className="w-full max-w-md space-y-4 overflow-y-auto no-scrollbar">
        {boosts.map(boost => {
          const canAfford = stars >= boost.cost;
          return (
            <div key={boost.id} className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
                <div className="flex items-center">
                    <span className="text-4xl mr-4">{boost.icon}</span>
                    <div>
                        <h2 className="text-lg font-bold">{boost.name[lang]}</h2>
                        <p className="text-sm text-gray-400">{boost.description[lang]}</p>
                    </div>
                </div>

                <button
                    onClick={() => onBuyBoost(boost)}
                    disabled={!canAfford}
                    className={`px-4 py-2 rounded-lg font-bold text-base transition-colors flex items-center space-x-2 ${
                    !canAfford
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500'
                    }`}
                >
                    <StarIcon />
                    <span>{boost.cost}</span>
                </button>
            </div>
          );
        })}
      </div>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default BoostScreen;
