
import React from 'react';
import { Boost, Language, PlayerState, UiIcons } from '../types';
import { useTranslation } from '../hooks/useGameLogic';

interface BoostProps {
  playerState: PlayerState;
  boosts: Boost[];
  onBuyBoost: (boost: Boost) => void;
  lang: Language;
  uiIcons: UiIcons;
}

const BoostScreen: React.FC<BoostProps> = ({ playerState, boosts, onBuyBoost, lang, uiIcons }) => {
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
      } else if (boost.id === 'boost_suspicion_limit') {
          level = playerState.suspicionLimitLevel || 0;
          cost = Math.floor(boost.costCoins * Math.pow(2.0, level));
      }
      
      const isMultiLevel = boost.id === 'boost_tap_guru' || boost.id === 'boost_energy_limit' || boost.id === 'boost_suspicion_limit';
      return { level, cost, isMultiLevel };
  };

  return (
    <div className="flex flex-col h-full text-white pt-4 px-4 items-center">
      <h1 className="text-3xl font-display text-center mb-2">{t('boosts')}</h1>
      <p className="text-lg text-[var(--text-secondary)] mb-6 flex items-center space-x-2">
        <img src={uiIcons.coin} alt="coin" className="w-6 h-6" />
        <span className="font-bold text-white">{balance.toLocaleString()}</span>
      </p>

      <div className="w-full max-w-md space-y-3 overflow-y-auto no-scrollbar">
        {(boosts || []).map(boost => {
          const { level, cost, isMultiLevel } = getBoostDetails(boost);
          const canAfford = balance >= cost;
          
          return (
            <div key={boost.id} className="card-glow bg-slate-800/50 rounded-2xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-slate-900/50 shadow-inner rounded-full p-1">
                        <img src={boost.iconUrl} alt={boost.name?.[lang]} className="w-10 h-10 object-contain" />
                    </div>
                    <div className="flex-grow min-w-0">
                        <h2 className="text-base font-bold truncate">{boost.name?.[lang]}</h2>
                        <p className="text-xs text-[var(--text-secondary)] truncate">{boost.description?.[lang]}</p>
                    </div>
                </div>

                <button
                    onClick={() => onBuyBoost(boost)}
                    disabled={!canAfford}
                    className="interactive-button rounded-xl px-3 py-2 font-bold text-sm flex items-center space-x-2 flex-shrink-0"
                >
                    <img src={uiIcons.coin} alt="coin" className="w-5 h-5"/>
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
