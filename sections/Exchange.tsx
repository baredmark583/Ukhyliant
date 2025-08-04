
import React, { useState, useCallback, useRef, useEffect } from 'react';
import ProgressBar from '../components/ProgressBar';
import { PlayerState, League, User, Language, GameConfig } from '../types';
import { MAX_ENERGY, CoinIcon, TELEGRAM_BOT_NAME, MINI_APP_NAME } from '../constants';
import { useTranslation } from '../hooks/useGameLogic';
import coinSvg from '../assets/coin.svg';

interface ExchangeProps {
  playerState: PlayerState;
  currentLeague: League;
  onTap: () => boolean;
  user: User;
  onClaimCipher: (cipher: string) => Promise<boolean>;
  config: GameConfig;
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

const ExchangeScreen: React.FC<ExchangeProps> = ({ playerState, currentLeague, onTap, user, onClaimCipher, config }) => {
  const t = useTranslation();
  const lang = user.language;
  const { balance, profitPerHour, energy, coinsPerTap } = playerState;
  const [clicks, setClicks] = useState<ClickFx[]>([]);
  const [scale, setScale] = useState(1);
  const [copied, setCopied] = useState(false);

  // Morse code state
  const [morseMode, setMorseMode] = useState(false);
  const [morseInput, setMorseInput] = useState('');
  const pressTimer = useRef<number | null>(null);
  const resetMorseTimer = useRef<number | null>(null);
  const lastClickPos = useRef({ x: 0, y: 0 });

  const dailyCipherWord = config.dailyEvent?.cipherWord || '';
  const claimedCipher = playerState.claimedCipherToday;

  const handleCipherReset = () => {
    setMorseInput('');
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    pressTimer.current = Date.now();

    // Always clear the reset timer on a new press, whether in morse mode or not
    if (resetMorseTimer.current) clearTimeout(resetMorseTimer.current);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }
    lastClickPos.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
    };
  };

  const handleMouseUp = async () => {
    if (!pressTimer.current) return; // Avoids firing if the press didn't start on the coin

    const pressDuration = Date.now() - pressTimer.current;
    
    // --- MORSE MODE LOGIC ---
    if (morseMode && !claimedCipher && dailyCipherWord) {
      pressTimer.current = null;
      const char = pressDuration < 200 ? '.' : '-';
      const newSequence = morseInput + char;
      setMorseInput(newSequence);

      if (newSequence === dailyCipherWord) {
        const success = await onClaimCipher(newSequence);
        if (success) {
          setMorseInput('');
          setMorseMode(false); // Exit morse mode on success
        }
      }

      resetMorseTimer.current = window.setTimeout(handleCipherReset, 3000);
    
    // --- REGULAR TAP LOGIC ---
    } else {
      pressTimer.current = null;
      if (onTap()) { // onTap now handles haptics for any duration tap
        const newClick: ClickFx = {
          id: Date.now() + Math.random(),
          x: lastClickPos.current.x,
          y: lastClickPos.current.y,
          value: coinsPerTap
        };
        setClicks(prev => [...prev, newClick]);
        setScale(0.95);
        setTimeout(() => setScale(1), 100);

        setTimeout(() => {
          setClicks(prev => prev.filter(c => c.id !== newClick.id));
        }, 1000);
      }
    }
  };
  
  const handleCopyReferral = () => {
      const referralLink = `https://t.me/${TELEGRAM_BOT_NAME}/${MINI_APP_NAME}?startapp=${user.id}`;
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
      <div className="flex items-center justify-center space-x-2 my-2">
        <div className="w-12 h-12 text-yellow-400"><CoinIcon/></div>
        <h1 className="text-5xl font-bold tracking-tighter">{Math.floor(balance).toLocaleString()}</h1>
      </div>

      {/* Daily Cipher Section */}
       {dailyCipherWord && (
          <div className="w-full max-w-sm text-center my-3 p-3 bg-red-900/40 border border-red-500 rounded-lg">
            <h3 className="font-bold text-lg text-red-200">{t('daily_cipher')}</h3>
            {claimedCipher ? (
              <p className="text-green-400 font-bold">{t('claimed_today')}</p>
            ) : morseMode ? (
              <>
                <p className="text-gray-300 text-sm my-1">{t('cipher_hint')}</p>
                <div className="font-mono text-2xl h-8 tracking-widest text-white bg-black/30 rounded-md flex items-center justify-center">
                    {morseInput}
                </div>
                <button onClick={() => { setMorseMode(false); setMorseInput(''); }} className="text-xs text-gray-300 hover:text-white mt-2">
                    {t('cancel_morse_mode')}
                </button>
              </>
            ) : (
                <button onClick={() => setMorseMode(true)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg mt-2 transition-transform active:scale-95">
                    {t('enter_morse_mode')}
                </button>
            )}
          </div>
       )}

      {/* Clicker Area */}
      <div 
        className="relative w-64 h-64 md:w-72 md:h-72 my-auto cursor-pointer select-none"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div 
            className="w-full h-full prevent-select"
            style={{ transform: `scale(${scale})`, transition: 'transform 0.1s ease' }}
        >
          <img 
            src={coinSvg} 
            alt="Clickable Coin" 
            draggable="false"
            className="w-full h-full transform transition-transform duration-200"
          />
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
        .prevent-select {
          -webkit-touch-callout: none; /* iOS Safari */
          -webkit-user-select: none; /* Safari */
          -khtml-user-select: none; /* Konqueror HTML */
          -moz-user-select: none; /* Old versions of Firefox */
          -ms-user-select: none; /* Internet Explorer/Edge */
          user-select: none; /* Non-prefixed version */
        }
        @keyframes floatUp {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-50px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default ExchangeScreen;
