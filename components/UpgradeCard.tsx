
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

const formatNumber = (num: number) => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};


const UpgradeCard: React.FC<UpgradeCardProps> = ({ upgrade, onBuy, balance, lang, uiIcons }) => {
  const t = useTranslation();
  const canAfford = balance >= upgrade.price;
  const suspicionMod = upgrade.suspicionModifier;
  
  const suspicionColor = suspicionMod > 0 ? 'text-red-400' : suspicionMod < 0 ? 'text-green-400' : 'text-gray-500';
  const suspicionSign = suspicionMod > 0 ? '+' : '';

  return (
    <button
      onClick={() => onBuy(upgrade.id)}
      disabled={!canAfford}
      className={`w-full p-2.5 themed-container flex items-center justify-between space-x-3 transition-all duration-150 active:scale-95 ${
        !canAfford ? 'opacity-50 cursor-not-allowed' : 'hover:border-green-400/80 hover:bg-[rgba(74,222,128,0.05)]'
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className="border border-gray-700 p-2 w-16 h-16 flex-shrink-0">
          <img src={upgrade.iconUrl} alt={upgrade.name?.[lang]} className="w-full h-full object-contain" />
        </div>
        <div>
          <p className="text-white text-left text-base font-semibold">{upgrade.name?.[lang]}</p>
          <div className="text-gray-400 text-xs text-left mt-1 flex items-center space-x-2">
            <span>lvl {upgrade.level}</span>
            <span className="mx-1">|</span>
            <span className="text-green-400 font-semibold flex items-center">
                <img src={uiIcons.energy} alt="" className="w-3 h-3 mr-1"/>
                +{formatNumber(upgrade.profitPerHour)}/hr
            </span>
            {suspicionMod !== undefined && (
                 <span className={`${suspicionColor} font-semibold flex items-center`}>
                    <img src={uiIcons.suspicion} alt="" className="w-3 h-3 mr-1"/>
                    {suspicionSign}{suspicionMod}
                </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
         <img src={uiIcons.coin} alt="coin" className="w-5 h-5"/>
        <span className="text-white font-bold text-sm">{formatNumber(upgrade.price)}</span>
      </div>
    </button>
  );
};

export default UpgradeCard;
