
import React, { useState, useCallback } from 'react';
import ProgressBar from '../components/ProgressBar';
import { PlayerState, League, User, Language } from '../types';
import { MAX_ENERGY, CoinIcon, StarIcon } from '../constants';
import { useTranslation } from '../hooks/useGameLogic';

interface ExchangeProps {
  playerState: PlayerState;
  currentLeague: League;
  onTap: () => boolean;
  user: User;
}

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(num);
};

interface ClickFx {
  id: number;
  x: number;
  y: number;
  value: number;
}

const ExchangeScreen: React.FC<ExchangeProps> = ({ playerState, currentLeague, onTap, user }) => {
  const t = useTranslation();
  const lang = user.language;
  const { balance, profitPerHour, energy, coinsPerTap, stars } = playerState;
  const [clicks, setClicks] = useState<ClickFx[]>([]);
  const [scale, setScale] = useState(1);
  const [copied, setCopied] = useState(false);

  const handleHamsterClick = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (onTap()) {
      const rect = e.currentTarget.getBoundingClientRect();
      const newClick: ClickFx = {
        id: Date.now() + Math.random(),
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        value: coinsPerTap
      };
      setClicks(prev => [...prev, newClick]);
      setScale(0.95);
      setTimeout(() => setScale(1), 100);

      setTimeout(() => {
        setClicks(prev => prev.filter(c => c.id !== newClick.id));
      }, 1000);
    }
  }, [onTap, coinsPerTap]);
  
  const handleCopyReferral = () => {
      // NOTE: Replace 'YourTelegramBotName' with your actual bot's username
      const referralLink = `https://t.me/YourTelegramBotName?start=${user.id}`;
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  }


  return (
    <div className="flex flex-col h-full text-white pt-4 pb-24 px-4 items-center">
      {/* Top Section */}
      <div className="w-full flex justify-between items-center text-xs">
          <button onClick={handleCopyReferral} className="bg-gray-800 px-3 py-2 rounded-lg font-bold">
            {copied ? t('copied') : t('copy_referral_link')}
          </button>
      </div>

      {/* League & Profit */}
      <div className="flex items-center space-x-4 my-4 p-2 bg-gray-800/50 rounded-xl">
        <div className="text-4xl">{currentLeague.icon}</div>
        <div>
            <p className="text-gray-400 text-sm">{t('league')}</p>
            <p className="font-bold text-white text-lg">{currentLeague.name[lang]}</p>
        </div>
        <div className="w-px h-10 bg-gray-700"></div>
         <div>
            <p className="text-gray-400 text-sm">{t('profit_per_hour')}</p>
            <p className="font-bold text-green-400 text-lg">+{formatNumber(profitPerHour)}</p>
        </div>
      </div>


      {/* Balance */}
      <div className="flex items-center justify-center space-x-2 my-4">
        <div className="w-12 h-12"><CoinIcon/></div>
        <h1 className="text-5xl font-bold tracking-tighter">{Math.floor(balance).toLocaleString()}</h1>
      </div>
      <div className="flex items-center justify-center space-x-2 -mt-2">
        <div className="w-6 h-6"><StarIcon/></div>
        <h2 className="text-2xl font-bold text-yellow-300">{stars.toLocaleString()}</h2>
      </div>

      {/* Clicker Area */}
      <div className="relative w-64 h-64 md:w-72 md:h-72 my-auto cursor-pointer select-none" onClick={handleHamsterClick}>
        <div 
            className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 shadow-lg flex items-center justify-center"
            style={{ transform: `scale(${scale})`, transition: 'transform 0.1s ease' }}
        >
          <div className="text-8xl transform transition-transform duration-200 hover:scale-110">
            🏃‍♂️
          </div>
        </div>
        {clicks.map(click => (
          <div
            key={click.id}
            className="absolute text-3xl font-bold text-white pointer-events-none"
            style={{ left: click.x, top: click.y, animation: 'floatUp 1s ease-out forwards' }}
          >
            +{click.value}
          </div>
        ))}
      </div>
      
      {/* Energy Bar */}
      <div className="w-full mt-4">
        <ProgressBar
          value={energy}
          max={MAX_ENERGY}
          colorClass="bg-gradient-to-r from-cyan-400 to-blue-500"
          label={t('energy')}
          icon={<span className="text-xl">⚡</span>}
        />
      </div>
       <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-50px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default ExchangeScreen;