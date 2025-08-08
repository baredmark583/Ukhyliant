
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

const formatBalance = (num: number): string => {
  if (num === null || num === undefined) return '0';
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
    <div className="flex flex-col h-full text-white pt-4 px-4">
      {/* Top Section: League, Balance, Profit/hr, Language */}
      <div className="w-full flex items-center justify-between themed-container p-2 text-center flex-shrink-0">
          <button onClick={onOpenLeaderboard} className="flex flex-col items-center justify-center p-1 text-center transition-opacity hover:opacity-80">
              {currentLeague && <img src={currentLeague.iconUrl} alt={currentLeague.name[user.language]} className="w-10 h-10 mb-1" />}
              <span className="text-xs text-gray-300">{t('your_league')}</span>
          </button>

          <div className="flex flex-col items-center px-2">
                <div className="flex items-center space-x-2">
                    <img src={config.uiIcons.coin} alt="coin" className="w-8 h-8"/>
                    <h1 className="text-3xl font-display">{formatBalance(balance)}</h1>
                </div>
                <div className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    <img src={config.uiIcons.energy} alt="" className="w-3 h-3"/>
                    <span>+{formatProfit(profitPerHour)}/hr</span>
                </div>
          </div>

          <div className="flex items-center justify-center">
                <button onClick={handleSwitchLanguage} className="border border-gray-700 hover:border-gray-500 text-white font-bold w-12 h-12 flex items-center justify-center text-sm transition-colors">
                  {user.language.toUpperCase()}
              </button>
          </div>
      </div>

      {/* Horizontal Daily Cipher Section */}
       {dailyCipherWord && (
          <div className="w-full themed-container my-2 p-2">
              {claimedCipher ? (
                  <div className="flex items-center justify-center gap-2 h-10">
                      <h3 className="font-display text-sm text-green-300">{t('daily_cipher')}</h3>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <p className="text-green-400 font-bold text-xs">{t('claimed_today')}</p>
                  </div>
              ) : (
                <>
                  {!morseMode ? (
                      <div className="flex items-center justify-between w-full gap-2 sm:gap-4 h-10">
                          <h3 className="font-display text-sm sm:text-base text-green-300 flex-shrink-0">{t('daily_cipher')}</h3>
                          <p className="text-gray-400 text-[11px] sm:text-xs text-center flex-1 min-w-0">{t('cipher_hint')}</p>
                          <button onClick={() => setMorseMode(true)} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-2 sm:px-3 text-xs transition-transform active:scale-95 flex-shrink-0 whitespace-nowrap">
                              {t('enter_morse_mode')}
                          </button>
                      </div>
                  ) : (
                      <div className="flex items-center justify-between w-full gap-4 h-10">
                          <h3 className="font-display text-base text-green-300 flex-shrink-0">{t('daily_cipher')}</h3>
                          <div className="font-mono text-xl h-10 tracking-widest text-white bg-black/50 border border-gray-600 flex items-center justify-center w-full">
                              {decodedWord}<span className="text-gray-500">{morseSequence}</span>
                          </div>
                          <button onClick={handleCancelMorse} className="text-xs text-gray-400 hover:text-white flex-shrink-0">
                              {t('cancel_morse_mode')}
                          </button>
                      </div>
                  )}
                </>
              )}
          </div>
      )}


      {/* Main Content Area */}
      <div className="flex-grow w-full flex items-stretch justify-center relative my-2 min-h-0 gap-3">
        
        {/* Left Bar: Stamina */}
        <div className="flex-shrink-0 py-4">
            <ProgressBar
                value={energy}
                max={effectiveMaxEnergy}
                label={t('energy')}
                iconUrl={config.uiIcons.energy}
                orientation="vertical"
            />
        </div>

        {/* Center Area: Coin */}
        <div className="flex-grow flex items-center justify-center min-w-0 p-2">
             <div
                className="relative cursor-pointer select-none w-full max-w-[280px] sm:max-w-sm aspect-square"
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

        {/* Right Bar: Suspicion */}
        <div className="flex-shrink-0 py-4">
             <SuspicionMeter
                value={suspicion}
                max={100}
                iconUrl={config.uiIcons.suspicion}
                orientation="vertical"
            />
        </div>
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
