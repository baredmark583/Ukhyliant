import React from 'react';
import { Upgrade, Language, UiIcons } from '../types';
import { useTranslation } from '../hooks/useGameLogic';

interface UpgradeCardProps {
  upgrade: Upgrade & { level: number };
  onBuy: (id: string) => void;
  balance: number;
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


const UpgradeCard: React.FC<UpgradeCardProps> = ({ upgrade, onBuy, balance, lang, uiIcons }) => {
  const t = useTranslation();
  const canAfford = balance >= upgrade.price;
  const suspicionMod = upgrade.suspicionModifier;
  
  const suspicionColor = suspicionMod > 0 ? 'text-red-400' : suspicionMod < 0 ? 'text-[var(--accent-color)]' : 'text-gray-500';
  const suspicionSign = suspicionMod > 0 ? '+' : '';

  return (
    <button
      onClick={() => onBuy(upgrade.id)}
      disabled={!canAfford}
      className={`w-full h-52 p-2 card-glow bg-slate-800/50 hover:bg-slate-800 rounded-2xl flex flex-col justify-between items-center text-center transition-all duration-200 ${
        !canAfford ? 'opacity-50 cursor-not-allowed hover:bg-slate-800/50' : ''
      }`}
    >
      {/* Top section: Icon, Name, Level */}
      <div className="flex flex-col items-center">
        <div className="bg-slate-900/70 rounded-full p-1 w-12 h-12 flex-shrink-0 mb-2 shadow-inner">
          <img src={upgrade.iconUrl} alt={upgrade.name?.[lang]} className="w-full h-full object-contain" />
        </div>
        <p className="text-white font-semibold leading-tight mb-1 h-8 flex items-center justify-center text-responsive-sm">{upgrade.name?.[lang]}</p>
        <span className="text-[var(--text-secondary)] text-responsive-xs">{t('lvl')} {upgrade.level}</span>
      </div>

      {/* Bottom section: Profit, Suspicion, Price */}
      <div className="w-full text-responsive-xs space-y-2">
        <div className="flex items-center justify-center space-x-3">
          <span className="text-[var(--accent-color)] font-semibold flex items-center">
              <img src={uiIcons.energy} alt="" className="w-3 h-3 mr-1"/>
              +{formatNumber(upgrade.profitPerHour)}
          </span>
           {suspicionMod !== 0 && (
                 <span className={`${suspicionColor} font-semibold flex items-center`}>
                    <img src={uiIcons.suspicion} alt="" className="w-3 h-3 mr-1"/>
                    {suspicionSign}{suspicionMod}
                </span>
            )}
        </div>
        <div className="flex items-center justify-center space-x-1.5 w-full bg-slate-900/70 rounded-lg py-1.5 mt-2 shadow-inner">
          <img src={uiIcons.coin} alt="coin" className="w-4 h-4"/>
          <span className="text-white font-bold text-responsive-base">{formatNumber(upgrade.price)}</span>
        </div>
      </div>
    </button>
  );
};

export default UpgradeCard;