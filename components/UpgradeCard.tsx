
import React from 'react';
import { Upgrade, Language } from '../types';
import { COIN_ICON_URL } from '../constants';

interface UpgradeCardProps {
  upgrade: Upgrade & { level: number };
  onBuy: (id: string) => void;
  balance: number;
  lang: Language;
}

const formatNumber = (num: number) => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};


const UpgradeCard: React.FC<UpgradeCardProps> = ({ upgrade, onBuy, balance, lang }) => {
  const canAfford = balance >= upgrade.price;

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
          <div className="text-gray-400 text-xs text-left mt-1">
            <span>lvl {upgrade.level}</span>
            <span className="mx-2">|</span>
            <span className="text-green-400 font-semibold">+{formatNumber(upgrade.profitPerHour)}/hr</span>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
         <img src={COIN_ICON_URL} alt="coin" className="w-5 h-5"/>
        <span className="text-white font-bold text-sm">{formatNumber(upgrade.price)}</span>
      </div>
    </button>
  );
};

export default UpgradeCard;