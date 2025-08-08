

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

const MORSE_CHAR_MAP = Object.fromEntries(Object.entries(MORSE_CODE_MAP).map(([k, v]) => [v, k]));

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
  const { balance, profitPerHour, energy, suspicion } = playerState;
  const [clicks, setClicks] = useState<ClickFx[]>([]);
  const [scale, setScale] = useState(1);
  const { switchLanguage } = useAuth();
  
  const [morseMode, setMorseMode] = useState(false);
  const [morseSequence, setMorseSequence] = useState('');
  const [decodedWord, setDecodedWord] = useState('');
  const pressTimer = useRef<number | null>(null);
  const morseCharTimeout = useRef<number | null>(null);
  const lastClickPos = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);

  const dailyCipherWord = (config.dailyEvent?.cipherWord || '').toUpperCase();
  const claimedCipher = playerState.claimedCipherToday;

  const currentSkin = config.coinSkins.find(s => s.id === playerState.currentSkinId) || config.coinSkins.find(s => s.id === DEFAULT_COIN_SKIN_ID);
  const coinSkinUrl = currentSkin?.iconUrl || '/assets/coin.svg';
  
  const resetMorseState = useCallback(() => {
    setMorseSequence('');
    setDecodedWord('');
    if (morseCharTimeout.current) {
        clearTimeout(morseCharTimeout.current);
        morseCharTimeout.current = null;
    }
  }, []);

  const handleCancelMorse = useCallback(() => {
      setMorseMode(false);
      resetMorseState();
  }, [resetMorseState]);


  useEffect(() => {
    return () => {
      if (morseCharTimeout.current) clearTimeout(morseCharTimeout.current);
    }
  }, []);

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) e.preventDefault();
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
    const now = Date.now();
    if (now - lastTapTime.current < 50) {
        if(pressTimer.current) pressTimer.current = null;
        return;
    }
    lastTapTime.current = now;

    if (!pressTimer.current) return;

    const pressDuration = now - pressTimer.current;
    pressTimer.current = null;
    
    if (morseMode && !claimedCipher && dailyCipherWord) {
      if (morseCharTimeout.current) clearTimeout(morseCharTimeout.current);

      const morseChar = pressDuration < 200 ? '.' : '-';
      const newSequence = morseSequence + morseChar;
      setMorseSequence(newSequence);

      morseCharTimeout.current = window.setTimeout(async () => {
          const charToEvaluate = MORSE_CHAR_MAP[newSequence];
          const nextExpectedChar = dailyCipherWord[decodedWord.length];

          if (charToEvaluate && charToEvaluate === nextExpectedChar) {
              const newDecodedWord = decodedWord + charToEvaluate;
              setDecodedWord(newDecodedWord);

              if (newDecodedWord === dailyCipherWord) {
                  const success = await onClaimCipher(dailyCipherWord);
                  if (success) {
                      handleCancelMorse();
                  }
              }
          } else {
              window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
              setDecodedWord(''); // Reset the whole word on error
          }
          setMorseSequence(''); // Reset sequence input after evaluation
      }, 1200);

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
  };
  
  const handleSwitchLanguage = () => {
      const languages = ['en', 'ua', 'ru'] as const;
      const currentIndex = languages.indexOf(user.language);
      const nextIndex = (currentIndex + 1) % languages.length;
      switchLanguage(languages[nextIndex]);
  };


  return (
    <div className="flex flex-col h-full text-white pt-4 px-4 items-center">
      {/* Top Section: League, Profit/hr, Language */}
       <div className="w-full flex items-center justify-between themed-container p-2 text-center flex-shrink-0">
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

      {/* Balance & Cipher Section */}
      <div className="w-full flex items-start justify-between gap-4 my-2 flex-shrink-0 px-2">
        {/* Left Side: Balance */}
        <div className="flex items-center space-x-2 pt-1">
            <img src={config.uiIcons.coin} alt="coin" className="w-7 h-7"/>
            <h1 className="text-2xl font-display">{formatNumber(balance)}</h1>
        </div>

        {/* Right Side: Cipher */}
        {dailyCipherWord && (
            <div className="flex-shrink-0 text-center p-2 bg-green-900/20 border border-green-500/50 w-44">
                <h3 className="font-display text-xs text-green-300">{t('daily_cipher')}</h3>
                {claimedCipher ? (
                  <p className="text-green-400 font-bold text-xs mt-1">{t('claimed_today')}</p>
                ) : morseMode ? (
                  <>
                    <p className="text-gray-300 text-[10px] my-1 leading-tight">{t('cipher_hint')}</p>
                    <div className="font-mono text-base h-7 tracking-widest text-white bg-black/50 border border-gray-600 flex items-center justify-center">
                        {decodedWord}<span className="text-gray-500">{morseSequence}</span>
                    </div>
                    <button onClick={handleCancelMorse} className="text-[10px] text-gray-400 hover:text-white mt-0.5">
                        {t('cancel_morse_mode')}
                    </button>
                  </>
                ) : (
                    <button onClick={() => setMorseMode(true)} className="bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-2 mt-1 text-xs transition-transform active:scale-95">
                        {t('enter_morse_mode')}
                    </button>
                )}
            </div>
        )}
      </div>


      {/* Clicker Area */}
      <div className="flex-grow w-full flex items-center justify-center relative my-2 min-h-0">
        <div
          className="relative cursor-pointer select-none w-full h-full max-w-[210px] max-h-[210px]"
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
              <div className="absolute inset-0 rounded-full animate-pulse-fire" style={{ boxShadow: '0 0 40px 10px var(--accent-green), 0 0 60px 20px var(--accent-green-glow)' }}></div>
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
      </div>
      
      {/* Progress Bars */}
      <div className="w-full space-y-3 pb-2 flex-shrink-0">
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