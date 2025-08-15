import React from 'https://esm.sh/react@19.1.1';
import { Boost, Language, PlayerState, UiIcons } from '../types';
import { useTranslation } from '../hooks/useGameLogic';
import { BOOST_PURCHASE_LIMITS } from '../constants';

interface BoostProps {
  playerState: PlayerState;
  boosts: Boost[];
  onBuyBoost: (boost: Boost) => void;
  lang: Language;
  uiIcons: UiIcons;
}

const formatNumber = (num: number): string => {
  if (num === null || num === undefined) return '0';
  if (num >= 1_000_000_000_000) return `${(num / 1_000_000_000_000).toFixed(2)}T`;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 10000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('en-US');
};

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
    <div className="flex flex-col h-full w-full text-white items-center">
      <div className="w-full grid grid-cols-2 gap-4">
        {(boosts || []).map(boost => {
          const { level, cost, isMultiLevel } = getBoostDetails(boost);
          const canAfford = balance >= cost;
          const limit = BOOST_PURCHASE_LIMITS[boost.id];
          const purchasesToday = playerState.dailyBoostPurchases?.[boost.id] || 0;
          const isLimitReached = limit !== undefined && purchasesToday >= limit;
          
          return (
            <div key={boost.id} className="card-glow bg-slate-800/50 rounded-2xl p-3 flex flex-col items-center text-center justify-between">
                <div className="flex-grow">
                    <div className="w-16 h-16 mx-auto flex-shrink-0 flex items-center justify-center bg-slate-900/50 shadow-inner rounded-full p-2 mb-2">
                        <img src={boost.iconUrl} alt={boost.name?.[lang]} className="w-12 h-12 object-contain" />
                    </div>
                    <h2 className="text-sm font-bold leading-tight">{boost.name?.[lang]}</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 h-10">{boost.description?.[lang]}</p>
                    {limit !== undefined && (
                        <p className={`text-xs mt-1 font-bold ${isLimitReached ? 'text-red-400' : 'text-gray-400'}`}>
                            {isLimitReached ? t('limit_reached') : `${t('limit_today')} ${purchasesToday}/${limit}`}
                        </p>
                    )}
                </div>

                <button
                    onClick={() => onBuyBoost(boost)}
                    disabled={!canAfford || isLimitReached}
                    className="w-full mt-3 interactive-button rounded-xl px-2 py-2 font-bold text-sm flex items-center justify-center space-x-2 flex-shrink-0 disabled:opacity-50"
                >
                    <img src={uiIcons.coin} alt="coin" className="w-5 h-5"/>
                    <div className="flex flex-col items-start leading-tight">
                        <span className="text-xs">{formatNumber(cost)}</span>
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