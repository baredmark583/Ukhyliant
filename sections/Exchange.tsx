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
  onEnergyClick: () => void;
  onSuspicionClick: () => void;
  isMuted: boolean;
  toggleMute: () => void;
}

const formatNumber = (num: number): string => {
  if (num === null || num === undefined) return '0';
  if (num >= 1_000_000_000_000) return `${(num / 1_000_000_000_000).toFixed(2)}T`;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 10000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('en-US');
};

interface ClickFx {
  id: number;
  x: number;
  y: number;
  value: number;
  xOffset: number;
}

const ExchangeScreen: React.FC<ExchangeProps> = ({ playerState, currentLeague, onTap, user, onClaimCipher, config, onOpenLeaderboard, isTurboActive, effectiveMaxEnergy, effectiveMaxSuspicion, onEnergyClick, onSuspicionClick, isMuted, toggleMute }) => {
  const t = useTranslation();
  const { balance, profitPerHour, energy, suspicion } = playerState;
  const [clicks, setClicks] = useState<ClickFx[]>([]);
  const [scale, setScale] = useState(1);
  const { switchLanguage } = useAuth();
  
  const [morseError, setMorseError] = useState(false);
  const [morseMode, setMorseMode] = useState(false);
  const [morseSequence, setMorseSequence] = useState('');
  const [decodedWord, setDecodedWord] = useState('');
  const pressTimer = useRef<number | null>(null);
  const morseCharTimeout = useRef<number | null>(null);
  const lastClickPos = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);

  const dailyCipherWord = (config.dailyEvent?.cipherWord || '').toUpperCase();
  const claimedCipher = playerState.claimedCipherToday;

  const currentSkin = (config.coinSkins || []).find(s => s.id === playerState.currentSkinId) || (config.coinSkins || []).find(s => s.id === DEFAULT_COIN_SKIN_ID);
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
    // Increased debounce to prevent accidental double-taps, especially on sensitive screens.
    if (now - lastTapTime.current < 100) {
        if(pressTimer.current) pressTimer.current = null;
        return;
    }
    lastTapTime.current = now;

    if (!pressTimer.current) return;

    const pressDuration = now - pressTimer.current;
    pressTimer.current = null;
    
    if (morseMode && !claimedCipher && dailyCipherWord) {
      if (morseCharTimeout.current) clearTimeout(morseCharTimeout.current);

      // Increased duration threshold to make distinguishing dots and dashes easier.
      const morseChar = pressDuration < 350 ? '.' : '-';
      const newSequence = morseSequence + morseChar;
      setMorseSequence(newSequence);

      // Increased timeout to give the user more time between characters.
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
              // On error, shake the input but don't reset the whole word, just the current character sequence.
              window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
              setMorseError(true);
              setTimeout(() => setMorseError(false), 500); // Reset shake after animation
          }
          setMorseSequence(''); // Reset sequence input after evaluation
      }, 1500);

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
      <div className="w-full grid grid-cols-5 items-center justify-around gap-1 text-center flex-shrink-0">
          <button onClick={onEnergyClick} className="p-0 border-none bg-transparent cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[var(--accent-color)]">
            <CircularProgressBar value={energy} max={effectiveMaxEnergy} iconUrl={config.uiIcons.energy} color="var(--accent-color)" size={60} strokeWidth={6} />
          </button>
          <button onClick={onSuspicionClick} className="p-0 border-none bg-transparent cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-red-400">
            <CircularProgressBar value={suspicion} max={effectiveMaxSuspicion} iconUrl={config.uiIcons.suspicion} color="#f87171" size={60} strokeWidth={6} />
          </button>
          <button onClick={onOpenLeaderboard} className="bg-slate-800/50 hover:bg-slate-700 transition-colors rounded-full w-[60px] h-[60px] flex flex-col items-center justify-center p-1 text-center">
              {currentLeague && <img src={currentLeague.iconUrl} alt={currentLeague.name[user.language]} className="w-8 h-8" />}
          </button>
          <button onClick={handleSwitchLanguage} className="bg-slate-800/50 hover:bg-slate-700 transition-colors rounded-full w-[60px] h-[60px] flex flex-col items-center justify-center p-1 text-center">
              <img src="https://api.iconify.design/ph/globe-bold.svg?color=white" alt="Language" className="w-8 h-8"/>
              <span className="text-xs font-bold text-white leading-tight">{user.language.toUpperCase()}</span>
          </button>
           <button onClick={toggleMute} className="bg-slate-800/50 hover:bg-slate-700 transition-colors rounded-full w-[60px] h-[60px] flex items-center justify-center">
              <img src={isMuted ? config.uiIcons.soundOff : config.uiIcons.soundOn} alt="Mute/Unmute" className="w-8 h-8"/>
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
            >
                <div
                    className="relative w-full h-full rounded-full transition-transform duration-100"
                    style={{ transform: `scale(${scale})` }}
                >
                    <img
                        src={coinSkinUrl}
                        alt="coin"
                        className={`w-full h-full rounded-full transition-all duration-300 ${isTurboActive ? 'animate-pulse' : ''}`}
                        style={isTurboActive ? { filter: 'drop-shadow(0 0 20px #f59e0b)' } : {}}
                    />
                </div>

                {/* Floating click numbers */}
                {clicks.map(click => (
                    <div
                        key={click.id}
                        className="absolute text-white text-3xl font-bold opacity-0 pointer-events-none"
                        style={{
                            top: `${click.y - 30}px`,
                            left: `${click.x - 15}px`,
                            '--x-offset': `${click.xOffset}px`,
                            animation: 'floatUp 1s ease-out forwards',
                        } as React.CSSProperties}
                    >
                        +{click.value}
                    </div>
                ))}
            </div>
            
             {/* Morse Code UI */}
            {dailyCipherWord && !claimedCipher && (
                 <div className={`w-full text-center flex-shrink-0 transition-all duration-300 ${morseError ? 'animate-shake' : ''}`}>
                    {morseMode ? (
                        <div className="card-glow bg-slate-900/50 rounded-xl p-2">
                             <p className="text-xs text-[var(--text-secondary)]">{t('cipher_hint')}</p>
                             <div className="my-1 font-mono text-xl tracking-widest h-8 bg-black/30 rounded flex items-center justify-center">
                                 <span className="text-slate-300">{decodedWord}</span>
                                 <span className="text-yellow-300">{morseSequence}</span>
                                 <span className="animate-ping">_</span>
                             </div>
                             <button onClick={handleCancelMorse} className="text-xs text-red-400 hover:text-red-300">{t('cancel_morse_mode')}</button>
                        </div>
                    ) : (
                        <button onClick={() => setMorseMode(true)} className="interactive-button rounded-lg font-bold py-2 px-4 text-sm w-full">
                           {t('daily_cipher')}
                        </button>
                    )}
                 </div>
            )}


            {/* Balance and Profit Info */}
            <div className="text-center w-full mt-2 flex-shrink-0">
                <div className="flex items-center justify-center space-x-2">
                    <img src={config.uiIcons.coin} alt="coin" className="w-8 h-8 sm:w-10 sm:h-10" />
                    <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tighter">
                        {formatNumber(balance)}
                    </h1>
                </div>
                <div className="mt-1 flex justify-center items-center space-x-2 text-[var(--accent-color)] font-semibold">
                    <img src={config.uiIcons.energy} alt="Profit" className="w-4 h-4" />
                    <span className="text-base">+{formatNumber(profitPerHour)}</span>
                    <span className="text-sm text-[var(--text-secondary)]">/hr</span>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ExchangeScreen;