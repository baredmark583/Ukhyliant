
import React, { useState, useCallback, useRef, useEffect } from 'react';
import ProgressBar from '../components/ProgressBar';
import { PlayerState, League, User, Language, GameConfig } from '../types';
import { COIN_ICON_URL } from '../constants';
import { useTranslation, useAuth } from '../hooks/useGameLogic';
import coinSvg from '../assets/coin.svg';

const MORSE_CODE_MAP: { [key: string]: string } = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--', 'Z': '--..',
    '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----'
};

interface ExchangeProps {
  playerState: PlayerState;
  currentLeague: League;
  onTap: () => number;
  user: User;
  onClaimCipher: (cipher: string) => Promise<boolean>;
  config: GameConfig;
  onOpenLeaderboard: () => void;
  isTurboActive: boolean;
  effectiveMaxEnergy: number;
}

const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString('en-US');
};

const formatProfit = (num: number): string => {
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
  xOffset: number;
}

const ExchangeScreen: React.FC<ExchangeProps> = ({ playerState, currentLeague, onTap, user, onClaimCipher, config, onOpenLeaderboard, isTurboActive, effectiveMaxEnergy }) => {
  const t = useTranslation();
  const { balance, profitPerHour, energy } = playerState;
  const [clicks, setClicks] = useState<ClickFx[]>([]);
  const [scale, setScale] = useState(1);
  const { switchLanguage } = useAuth();
  
  // Morse code state
  const [morseMode, setMorseMode] = useState(false);
  const [morseInput, setMorseInput] = useState('');
  const pressTimer = useRef<number | null>(null);
  const resetMorseTimer = useRef<number | null>(null);
  const lastClickPos = useRef({ x: 0, y: 0 });
  const pressEndDebounce = useRef(false);

  const dailyCipherWord = (config.dailyEvent?.cipherWord || '').toUpperCase();
  const dailyCipherMorseTarget = dailyCipherWord.split('').map(letter => MORSE_CODE_MAP[letter]).join('');
  const claimedCipher = playerState.claimedCipherToday;

  const handleCipherReset = useCallback(() => {
    setMorseInput('');
  }, []);

  useEffect(() => {
    return () => {
      if (resetMorseTimer.current) clearTimeout(resetMorseTimer.current);
    }
  }, []);

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) e.preventDefault();
    if (resetMorseTimer.current) clearTimeout(resetMorseTimer.current);
    pressTimer.current = Date.now();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }
    lastClickPos.current = { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handlePressEnd = async () => {
    if (pressEndDebounce.current || !pressTimer.current) return;
    pressEndDebounce.current = true;

    const pressDuration = Date.now() - pressTimer.current;
    pressTimer.current = null;
    
    if (morseMode && !claimedCipher && dailyCipherMorseTarget) {
      const char = pressDuration < 200 ? '.' : '-';
      const newSequence = morseInput + char;
      setMorseInput(newSequence);

      if (newSequence === dailyCipherMorseTarget) {
        const success = await onClaimCipher(dailyCipherWord);
        if (success) {
          setMorseInput('');
          setMorseMode(false);
          if (resetMorseTimer.current) clearTimeout(resetMorseTimer.current);
        }
      } else {
         if (!dailyCipherMorseTarget.startsWith(newSequence)) {
            resetMorseTimer.current = window.setTimeout(handleCipherReset, 1500);
         } else {
            resetMorseTimer.current = window.setTimeout(handleCipherReset, 3000);
         }
      }
    } else {
      const tapValue = onTap();
      if (tapValue > 0) { 
        const newClick: ClickFx = {
          id: Date.now() + Math.random(),
          x: lastClickPos.current.x,
          y: lastClickPos.current.y,
          value: tapValue,
          xOffset: (Math.random() - 0.5) * 40,
        };
        setClicks(prev => [...prev, newClick]);
        setScale(0.92);
        setTimeout(() => setScale(1), 120);
        setTimeout(() => setClicks(prev => prev.filter(c => c.id !== newClick.id)), 1000);
      }
    }

    setTimeout(() => { pressEndDebounce.current = false; }, 50);
  };
  
  const handleSwitchLanguage = () => {
      const languages = ['en', 'ua', 'ru'] as const;
      const currentIndex = languages.indexOf(user.language);
      const nextIndex = (currentIndex + 1) % languages.length;
      switchLanguage(languages[nextIndex]);
  };


  return (
    <div className="flex flex-col h-full text-white pt-4 pb-24 px-4 items-center">
      {/* Top Section: League Icon & Profit/hr */}
      <div className="w-full flex justify-between items-start">
        <button onClick={onOpenLeaderboard} className="flex flex-col items-center bg-gray-800/50 p-2 rounded-lg w-20 h-20 justify-center">
            <img src={currentLeague.iconUrl} alt={currentLeague.name[user.language]} className="w-12 h-12" />
        </button>
        <div className="flex-grow flex items-center justify-between bg-gray-800/50 p-2 rounded-lg mx-2">
            <div className="flex flex-col items-start">
                <span className="text-xs text-gray-400">{t('profit_per_hour')}</span>
                <span className="font-bold text-green-400 text-lg">+{formatProfit(profitPerHour)}</span>
            </div>
            <button onClick={handleSwitchLanguage} className="bg-gray-700/60 text-white rounded-lg p-2 font-bold w-10 h-10 flex items-center justify-center text-sm">
                {user.language.toUpperCase()}
            </button>
        </div>
      </div>

      {/* Balance */}
      <div className="flex items-center justify-center space-x-2 my-2">
        <img src={COIN_ICON_URL} alt="coin" className="w-8 h-8"/>
        <h1 className="text-2xl font-bold tracking-tighter">{formatNumber(balance)}</h1>
      </div>

      {/* Daily Cipher Section */}
       {dailyCipherMorseTarget && (
          <div className="w-full max-w-sm text-center my-2 p-2 bg-red-900/40 border border-red-500 rounded-lg">
            <h3 className="font-bold text-sm text-red-200">{t('daily_cipher')}</h3>
            {claimedCipher ? (
              <p className="text-green-400 font-bold text-sm">{t('claimed_today')}</p>
            ) : morseMode ? (
              <>
                <p className="text-gray-300 text-xs my-1">{t('cipher_hint')}</p>
                <div className="font-mono text-lg h-6 tracking-widest text-white bg-black/30 rounded-md flex items-center justify-center">
                    {morseInput}
                </div>
                <button onClick={() => { setMorseMode(false); setMorseInput(''); if(resetMorseTimer.current) clearTimeout(resetMorseTimer.current); }} className="text-xs text-gray-300 hover:text-white mt-1">
                    {t('cancel_morse_mode')}
                </button>
              </>
            ) : (
                <button onClick={() => setMorseMode(true)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-lg mt-1 text-sm transition-transform active:scale-95">
                    {t('enter_morse_mode')}
                </button>
            )}
          </div>
       )}

      {/* Clicker Area */}
      <div 
        className="relative w-64 h-64 md:w-72 md:h-72 my-auto cursor-pointer select-none"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onContextMenu={(e) => e.preventDefault()}
        onMouseLeave={pressTimer.current ? handlePressEnd : undefined}
      >
        <div 
            className="w-full h-full"
            style={{ transform: `scale(${scale})`, transition: 'transform 0.1s cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          {isTurboActive && (
             <div className="absolute inset-0 rounded-full animate-pulse-fire" style={{boxShadow: '0 0 40px 10px #f59e0b, 0 0 60px 20px #ef4444'}}></div>
          )}
          <img 
            src={coinSvg} 
            alt="Clickable Coin" 
            draggable="false"
            className="w-full h-full pointer-events-none relative z-10"
          />
        </div>
        {clicks.map(click => (
          <div
            key={click.id}
            className="absolute text-3xl font-bold text-white pointer-events-none"
            style={{
              left: click.x,
              top: click.y,
              animation: 'floatUp 1s ease-out forwards',
              '--x-offset': `${click.xOffset}px`,
            } as React.CSSProperties}
          >
            +{click.value}
          </div>
        ))}
      </div>
      
      {/* Energy Bar */}
      <div className="w-full mt-4">
        <ProgressBar
          value={energy}
          max={effectiveMaxEnergy}
          colorClass="bg-gradient-to-r from-cyan-400 to-blue-500"
          label={t('energy')}
          icon={<span className="text-xl">⚡</span>}
        />
      </div>
        <style>{`
            @keyframes pulse-fire {
                0%, 100% {
                    transform: scale(1);
                    opacity: 0.7;
                }
                50% {
                    transform: scale(1.05);
                    opacity: 1;
                }
            }
            .animate-pulse-fire {
                animation: pulse-fire 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
        `}</style>
    </div>
  );
};

export default ExchangeScreen;
