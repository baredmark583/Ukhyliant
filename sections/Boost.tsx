
import React from 'react';
import { Boost, Language, PlayerState } from '../types';
import { CoinIcon } from '../constants';
import { useTranslation } from '../hooks/useGameLogic';

interface BoostProps {
  playerState: PlayerState;
  boosts: Boost[];
  onBuyBoost: (boost: Boost) => void;
  lang: Language;
}

const BoostScreen: React.FC<BoostProps> = ({ playerState, boosts, onBuyBoost, lang }) => {
  const t = useTranslation();
  const { balance } = playerState;

  const getBoostDetails = (boost: Boost) => {
      let level = 0;
      let cost = boost.costCoins;
      
      if (boost.id === 'boost_tap_guru') {
          level = playerState.tapGuruLevel || 0;
          cost = Math.floor(boost.costCoins * Math.pow(1.5, level));
      } else if (boost.id === 'boost_energy_limit') {
          level = playerState.energyLimitLevel || 0;
          cost = Math.floor(boost.costCoins * Math.pow(1.8, level));
      }
      
      const isMultiLevel = boost.id === 'boost_tap_guru' || boost.id === 'boost_energy_limit';
      return { level, cost, isMultiLevel };
  };

  return (
    <div className="flex flex-col h-full text-white pt-4 pb-24 px-4 items-center">
      <h1 className="text-3xl font-display text-center mb-2">{t('boosts')}</h1>
      <p className="text-lg text-gray-400 mb-6 flex items-center space-x-2">
        <span className="w-6 h-6 text-yellow-400"><CoinIcon/></span>
        <span className="font-bold text-white">{balance.toLocaleString()}</span>
      </p>

      <div className="w-full max-w-md space-y-3 overflow-y-auto no-scrollbar">
        {(boosts || []).map(boost => {
          const { level, cost, isMultiLevel } = getBoostDetails(boost);
          const canAfford = balance >= cost;
          
          return (
            <div key={boost.id} className="themed-container p-4 flex items-center justify-between">
                <div className="flex items-center">
                    <div className="w-12 h-12 mr-4 flex-shrink-0 flex items-center justify-center">
                        <img src={boost.iconUrl} alt={boost.name?.[lang]} className="w-10 h-10 object-contain" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">{boost.name?.[lang]}</h2>
                        <p className="text-sm text-gray-400">{boost.description?.[lang]}</p>
                    </div>
                </div>

                <button
                    onClick={() => onBuyBoost(boost)}
                    disabled={!canAfford}
                    className={`px-4 py-2 font-bold text-base transition-colors flex items-center space-x-2 active:scale-95 border ${
                    !canAfford
                        ? 'bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 border-green-500 hover:bg-green-500 text-white'
                    }`}
                >
                    <div className="w-5 h-5 text-yellow-400"><CoinIcon /></div>
                    <div className="flex flex-col items-start leading-tight">
                        <span>{cost.toLocaleString()}</span>
                        {isMultiLevel && <span className="text-xs text-white/70">{t('lvl')} {level}</span>}
                    </div>
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