

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ProgressBar from '../components/ProgressBar';
import SuspicionMeter from '../components/SuspicionMeter';
import { PlayerState, League, User, GameConfig } from '../types';
import { DEFAULT_COIN_SKIN_ID } from '../constants';
import { useTranslation, useAuth } from '../hooks/useGameLogic';

const MORSE_CODE_MAP: { [key: string]: string } = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--', 'Z': '--..',
    '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----'
};

interface ExchangeProps {
  playerState: PlayerState;
  currentLeague: League | null;
  onTap: () => number;
  user: User;
  onClaimCipher: (cipher: string) => Promise<boolean>;
  config: GameConfig;
  onOpenLeaderboard: () => void;
  isTurboActive: boolean;
  effectiveMaxEnergy: number;
  clickerSize: number;
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

const ExchangeScreen: React.FC<ExchangeProps> = ({ playerState, currentLeague, onTap, user, onClaimCipher, config, onOpenLeaderboard, isTurboActive, effectiveMaxEnergy, clickerSize }) => {
  const t = useTranslation();
  const { balance, profitPerHour, energy, suspicion } = playerState;
  const [clicks, setClicks] = useState<ClickFx[]>([]);
  const [scale, setScale] = useState(1);
  const { switchLanguage } = useAuth();
  
  const [morseMode, setMorseMode] = useState(false);
  const [morseInput, setMorseInput] = useState('');
  const pressTimer = useRef<number | null>(null);
  const resetMorseTimer = useRef<number | null>(null);
  const lastClickPos = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);

  const dailyCipherWord = (config.dailyEvent?.cipherWord || '');
  const dailyCipherMorseTarget = dailyCipherWord
    .toUpperCase()
    .split('')
    .map(letter => MORSE_CODE_MAP[letter])
    .filter(Boolean)
    .join('');
    
  const claimedCipher = playerState.claimedCipherToday;

  const currentSkin = config.coinSkins.find(s => s.id === playerState.currentSkinId) || config.coinSkins.find(s => s.id === DEFAULT_COIN_SKIN_ID);
  const coinSkinUrl = currentSkin?.iconUrl || '/assets/coin.svg';

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
    if (!pressTimer.current) return;

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
      const now = Date.now();
      if (now - lastTapTime.current < 20) return; // Prevent double taps
      lastTapTime.current = now;

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
  };
  
  const handleSwitchLanguage = () => {
      const languages = ['en', 'ua', 'ru'] as const;
      const currentIndex = languages.indexOf(user.language);
      const nextIndex = (currentIndex + 1) % languages.length;
      switchLanguage(languages[nextIndex]);
  };


  return (
    <div className="flex flex-col h-full text-white pt-4 pb-24 px-4 items-center">
      {/* Top Section: League, Profit/hr, Language */}
       <div className="w-full flex items-center justify-between themed-container p-2 text-center">
            <button onClick={onOpenLeaderboard} className="flex-1 flex flex-col items-center justify-center p-1 text-center transition-opacity hover:opacity-80">
                {currentLeague && <img src={currentLeague.iconUrl} alt={currentLeague.name[user.language]} className="w-10 h-10 mb-1" />}
                <span className="text-xs text-gray-300">{t('league')}</span>
            </button>

            <div className="flex-1 flex flex-col items-center border-x border-gray-700/50">
                <span className="text-xs text-gray-400">{t('profit_per_hour')}</span>
                <span className="font-bold text-green-400 text-lg">+{formatProfit(profitPerHour)}</span>
            </div>

            <div className="flex-1 flex items-center justify-center">
                 <button onClick={handleSwitchLanguage} className="border border-gray-700 hover:border-gray-500 text-white font-bold w-12 h-12 flex items-center justify-center text-sm transition-colors">
                    {user.language.toUpperCase()}
                </button>
            </div>
        </div>

      {/* Balance */}
      <div className="flex items-center justify-center space-x-2 my-2">
        <img src={config.uiIcons.coin} alt="coin" className="w-8 h-8"/>
        <h1 className="text-4xl font-display">{formatNumber(balance)}</h1>
      </div>

      {/* Daily Cipher Section */}
       {dailyCipherMorseTarget && (
          <div className="w-full max-w-sm text-center my-2 p-3 bg-green-900/20 border border-green-500/50">
            <h3 className="font-display text-sm text-green-300">{t('daily_cipher')}</h3>
            {claimedCipher ? (
              <p className="text-green-400 font-bold text-sm mt-1">{t('claimed_today')}</p>
            ) : morseMode ? (
              <>
                <p className="text-gray-300 text-xs my-1">{t('cipher_hint')}</p>
                <div className="font-mono text-lg h-6 tracking-widest text-white bg-black/50 border border-gray-600 flex items-center justify-center">
                    {morseInput}
                </div>
                <button onClick={() => { setMorseMode(false); setMorseInput(''); if(resetMorseTimer.current) clearTimeout(resetMorseTimer.current); }} className="text-xs text-gray-400 hover:text-white mt-1">
                    {t('cancel_morse_mode')}
                </button>
              </>
            ) : (
                <button onClick={() => setMorseMode(true)} className="bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-3 mt-1 text-sm transition-transform active:scale-95">
                    {t('enter_morse_mode')}
                </button>
            )}
          </div>
       )}

      {/* Clicker Area */}
      <div 
        className="relative my-auto cursor-pointer select-none"
        style={{ width: `${clickerSize}px`, height: `${clickerSize}px` }}
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
             <div className="absolute inset-0 rounded-full animate-pulse-fire" style={{boxShadow: '0 0 40px 10px var(--accent-green), 0 0 60px 20px var(--accent-green-glow)'}}></div>
          )}
          <img 
            src={coinSkinUrl} 
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
              textShadow: '0px 0px 8px rgba(0, 0, 0, 0.7)'
            } as React.CSSProperties}
          >
            +{click.value}
          </div>
        ))}
      </div>
      
      {/* Progress Bars */}
      <div className="w-full mt-4 space-y-3">
        <SuspicionMeter 
          value={suspicion}
          max={100}
          iconUrl={config.uiIcons.suspicion}
        />
        <ProgressBar
          value={energy}
          max={effectiveMaxEnergy}
          label={t('energy')}
          iconUrl={config.uiIcons.energy}
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
