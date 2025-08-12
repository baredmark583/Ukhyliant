
import React, { useState, useCallback, useRef, useEffect } from 'react';
import CircularProgressBar from '../components/CircularProgressBar';
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
  effectiveMaxSuspicion: number;
}

const formatBalance = (num: number): string => {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0
  }).format(num);
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

const ExchangeScreen: React.FC<ExchangeProps> = ({ playerState, currentLeague, onTap, user, onClaimCipher, config, onOpenLeaderboard, isTurboActive, effectiveMaxEnergy, effectiveMaxSuspicion }) => {
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
    if (now - lastTapTime.current < 30) {
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
        setScale(0.95);
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
    <div className="flex flex-col h-full text-white p-2 sm:p-4 gap-2">
      {/* Top Section: Info Panel */}
      <div className="w-full flex items-center justify-center flex-wrap sm:justify-between gap-2 p-2 mb-2 text-center flex-shrink-0">
          <CircularProgressBar value={energy} max={effectiveMaxEnergy} iconUrl={config.uiIcons.energy} color="var(--accent-color)" size={60} strokeWidth={6} />
          <CircularProgressBar value={suspicion} max={effectiveMaxSuspicion} iconUrl={config.uiIcons.suspicion} color="#f87171" size={60} strokeWidth={6} />
          <button onClick={onOpenLeaderboard} className="bg-slate-800/50 hover:bg-slate-700 transition-colors rounded-full w-[60px] h-[60px] flex flex-col items-center justify-center p-1 text-center">
              {currentLeague && <img src={currentLeague.iconUrl} alt={currentLeague.name[user.language]} className="w-8 h-8" />}
          </button>
          <button onClick={handleSwitchLanguage} className="bg-slate-800/50 hover:bg-slate-700 transition-colors rounded-full w-[60px] h-[60px] flex flex-col items-center justify-center p-1 text-center">
              <img src="https://api.iconify.design/ph/globe-bold.svg?color=white" alt="Language" className="w-8 h-8"/>
              <span className="text-xs font-bold text-white leading-tight">{user.language.toUpperCase()}</span>
          </button>
      </div>


      {/* Main Content Area: Coin Card */}
      <div className="flex-grow w-full flex items-center justify-center relative min-h-0">
         <div className="card-glow bg-slate-800/50 rounded-2xl flex flex-col items-center justify-between p-2 sm:p-4 w-full h-full max-w-sm">
            
            {/* Clickable Coin Area */}
            <div
                className="relative cursor-pointer select-none w-full max-w-[224px] aspect-square border-2 border-slate-700/50 rounded-full flex items-center justify-center p-4 my-auto shadow-inner bg-slate-900/50"
                onMouseDown={handlePressStart}
                onMouseUp={handlePressEnd}
                onTouchStart={handlePressStart}
                onTouchEnd={handlePressEnd}
                onContextMenu={(e) => e.preventDefault()}
                onMouseLeave={pressTimer.current ? handlePressEnd : undefined}
             >
                <div
                    className="w-full h-full transition-transform duration-100"
                    style={{ transform: `scale(${scale})` }}
                  >
                    {isTurboActive && (
                    <div className="absolute inset-0 rounded-full animate-pulse-fire" style={{ boxShadow: '0 0 40px 10px var(--accent-color), 0 0 60px 20px var(--accent-color-glow)' }}></div>
                    )}
                    <img
                        src={coinSkinUrl}
                        alt="Clickable Coin"
                        draggable="false"
                        className="w-full h-full pointer-events-none relative z-10"
                        style={{ filter: "drop-shadow(0 0 15px var(--accent-color-glow))" }}
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
                        textShadow: '0px 0px 8px var(--accent-color)'
                    } as React.CSSProperties}
                    >
                    +{click.value.toFixed(1)}
                    </div>
                ))}
            </div>

            {/* Balance and Profit */}
            <div className="flex flex-col items-center flex-shrink-0 my-1">
                <div className="flex items-center space-x-2">
                    <img src={config.uiIcons.coin} alt="coin" className="w-[5vh] h-[5vh] max-w-[32px] max-h-[32px]"/>
                    <h1 className="text-responsive-2xl font-display text-slate-100" style={{textShadow: 'none'}}>{formatBalance(balance)}</h1>
                </div>
                <div className="text-responsive-sm text-[var(--accent-color)] flex items-center gap-1 font-bold">
                    <img src={config.uiIcons.energy} alt="" className="w-3 h-3"/>
                    <span>+{formatProfit(profitPerHour)}/hr</span>
                </div>
            </div>

            {/* Daily Cipher Section */}
            {dailyCipherWord && (
                <div className="w-[90%] mx-auto mt-2 flex-shrink-0">
                    {claimedCipher ? (
                        <div className="flex items-center justify-center gap-2 h-10 bg-slate-900/50 shadow-inner rounded-lg">
                            <h3 className="font-display text-sm text-[var(--accent-color)]">{t('daily_cipher')}</h3>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--accent-color)]" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                    ) : (
                      <>
                        {!morseMode ? (
                            <div className="flex items-center justify-between w-full gap-2 sm:gap-4 h-10">
                                <h3 className="font-display text-sm sm:text-base text-[var(--accent-color)] flex-shrink-0">{t('daily_cipher')}</h3>
                                <button onClick={() => setMorseMode(true)} className="interactive-button bg-[var(--accent-color-glow)] text-white font-bold py-2 px-2 sm:px-3 text-xs rounded-lg flex-shrink-0 whitespace-nowrap">
                                    {t('enter_morse_mode')}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between w-full gap-2 h-10">
                                <div className="font-mono text-xl h-10 tracking-widest text-white bg-slate-900/50 shadow-inner rounded-lg flex items-center justify-center w-full">
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
