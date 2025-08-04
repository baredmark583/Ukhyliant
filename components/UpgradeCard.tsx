
import React from 'react';
import { Upgrade, LocalizedString, Language } from '../types';
import { CoinIcon } from '../constants';

interface UpgradeCardProps {
  upgrade: Upgrade & { level: number };
  onBuy: (id: string) => void;
  balance: number;
  lang: Language;
}

const formatNumber = (num: number) => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
};


const UpgradeCard: React.FC<UpgradeCardProps> = ({ upgrade, onBuy, balance, lang }) => {
  const canAfford = balance >= upgrade.price;

  return (
    <button
      onClick={() => onBuy(upgrade.id)}
      disabled={!canAfford}
      className={`w-full p-2.5 bg-gray-800 rounded-xl flex items-center justify-between space-x-3 transition-transform duration-100 active:scale-95 ${
        !canAfford ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className="bg-gray-700/50 p-2.5 rounded-lg text-4xl">{upgrade.icon}</div>
        <div>
          <p className="text-white text-left text-base font-semibold">{upgrade.name[lang]}</p>
          <div className="text-gray-400 text-xs text-left mt-1">
            <span>lvl {upgrade.level}</span>
            <span className="mx-2">|</span>
            <span className="text-green-400 font-semibold">+{formatNumber(upgrade.profitPerHour)}/hr</span>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
         <div className="text-yellow-400 h-5 w-5">
            <CoinIcon/>
        </div>
        <span className="text-white font-bold text-sm">{formatNumber(upgrade.price)}</span>
      </div>
    </button>
  );
};

export default UpgradeCard;