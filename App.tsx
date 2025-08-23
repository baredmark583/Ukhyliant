


import React, { useState, useEffect, useCallback, useRef } from 'https://esm.sh/react';
import { TonConnectButton, useTonWallet, useTonConnectUI } from 'https://esm.sh/@tonconnect/ui-react';
import { useGame, useAuth, useTranslation, AuthProvider } from './hooks/useGameLogic';
import { useGlitchSystem } from './hooks/useGlitchSystem';
import ExchangeScreen from './sections/Exchange';
import MineScreen from './sections/Mine';
import BoostScreen from './sections/Boost';
import CellScreen from './sections/Cell';
import { REFERRAL_BONUS, TELEGRAM_BOT_NAME, MINI_APP_NAME } from './constants';
import { DailyTask, GameConfig, Language, LeaderboardPlayer, SpecialTask, PlayerState, User, Boost, CoinSkin, League, UiIcons, Cell, GlitchEvent, MarketListing, VideoSubmission, VideoSubmissionStatus, BlackMarketCard, VideoRewardTier } from './types';
import NotificationToast from './components/NotificationToast';
import SecretCodeModal from './components/SecretCodeModal';
import FinalSystemBreachEffect from './FinalSystemBreachEffect';

type Screen = 'exchange' | 'mine' | 'missions' | 'airdrop' | 'profile';
type ProfileTab = 'contacts' | 'boosts' | 'skins' | 'market' | 'cell' | 'content';

// Add html2canvas to the global scope for TypeScript
declare const html2canvas: any;

type GameApi = ReturnType<typeof useGame>;

const API_BASE_URL = 'https://ukhyliant-backend.onrender.com';

const isExternal = (url: string | undefined) => url && url.startsWith('http');

const getProxiedUrl = (url: string | undefined): string | undefined => {
    if (!url || !isExternal(url)) {
      return url;
    }
    // All external URLs are proxied to avoid CORS issues with images and audio.
    return `${API_BASE_URL}/api/image-proxy?url=${encodeURIComponent(url)}`;
};


const formatNumber = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  if (num >= 1_000_000_000_000) return `${(num / 1_000_000_000_000).toFixed(2)}T`;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 10000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('en-US');
};

const GlitchEffect: React.FC<{ message?: string, code?: string, onClose?: () => void }> = ({ message: customMessage, code, onClose }) => {
    const t = useTranslation();
    const message = customMessage || t('why_not_state_language');
    
    useEffect(() => {
        if (onClose) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [onClose]);

    return (
        <div className="glitch-effect" onClick={onClose}>
            <div className="glitch-message" data-text={message}>
                {message}
                {code && <div className="font-mono text-2xl mt-4 tracking-widest text-amber-300" data-text={code}>{code}</div>}
            </div>
        </div>
    );
};

const FinalVideoPlayer: React.FC<{ videoUrl: string, onEnd: () => void }> = ({ videoUrl, onEnd }) => {
    const t = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        // Try to autoplay; it should work since it follows a user interaction (buying an upgrade).
        videoRef.current?.play().catch(() => {});
    }, [videoUrl]);
    
    return (
        <div className="final-video-container">
            <video ref={videoRef} src={getProxiedUrl(videoUrl)} onEnded={onEnd} playsInline autoPlay muted={false} crossOrigin="anonymous" />
            <button onClick={onEnd} className="skip-button">{t('skip_video')}</button>
        </div>
    );
};

// --- INLINE COMPONENTS ---
interface MissionsProps {
    tasks: DailyTask[];
    specialTasks: SpecialTask[];
    onClaimTask: (task: DailyTask, code?: string) => void;
    onUnlockTask: (task: SpecialTask) => void;
    onCompleteTask: (task: SpecialTask, code?: string) => void;
    lang: Language;
    playerState: PlayerState;
    uiIcons: UiIcons;
}

const MissionsScreen: React.FC<MissionsProps> = ({ tasks, specialTasks, onClaimTask, onUnlockTask, onCompleteTask, lang, playerState, uiIcons }) => {
  const t = useTranslation();
  const [activeTab, setActiveTab] = useState<'daily' | 'airdrop'>('daily');
  const [secretCodeTask, setSecretCodeTask] = useState<DailyTask | SpecialTask | null>(null);

  const handleClaim = (task: DailyTask | SpecialTask) => {
    if ('priceStars' in task) {
        onCompleteTask(task);
    } else {
        onClaimTask(task);
    }
  };

  const handleTaskClick = (task: DailyTask | SpecialTask) => {
      const isCompleted = ('priceStars' in task)
          ? playerState.completedSpecialTaskIds?.includes(task.id)
          : playerState.completedDailyTaskIds?.includes(task.id);
          
      if (isCompleted) return;

      if (task.type === 'video_code') {
          setSecretCodeTask(task);
      } else if (task.url) {
          window.Telegram.WebApp.openLink(task.url);
          setTimeout(() => handleClaim(task), 3000); // Auto-claim after a delay
      } else {
          handleClaim(task);
      }
  };

  const handleSubmitCode = (code: string) => {
    if (secretCodeTask) {
       if ('priceStars' in secretCodeTask) {
            onCompleteTask(secretCodeTask, code);
        } else {
            onClaimTask(secretCodeTask, code);
        }
    }
    setSecretCodeTask(null);
  };
  
  const dailyTasksList = (
    <div className="space-y-3">
        {tasks.map(task => {
            const isCompleted = playerState.completedDailyTaskIds?.includes(task.id);
            const canClaim = !isCompleted && (task.type !== 'taps' || playerState.dailyTaps >= (task.requiredTaps || 0));
            return (
                <div key={task.id} className="card-glow bg-slate-800/50 rounded-xl p-3 flex items-center gap-3">
                    {task.imageUrl && <img src={getProxiedUrl(task.imageUrl)} alt={task.name?.[lang] ?? task.id} className="w-10 h-10 object-contain rounded-md flex-shrink-0" crossOrigin="anonymous"/>}
                    <div className="flex-grow">
                        <h3 className="text-sm font-bold truncate">{task.name?.[lang] ?? task.id}</h3>
                        <div className="flex items-center gap-2 text-yellow-300 font-bold text-sm">
                           <img src={task.reward?.type === 'coins' ? uiIcons.coin : uiIcons.star} alt="reward" className="w-4 h-4" crossOrigin="anonymous"/>
                           <span>{(task.reward?.amount ?? 0).toLocaleString()}</span>
                           {task.type === 'taps' && <span className="text-xs text-gray-400">({playerState.dailyTaps}/{task.requiredTaps ?? 0})</span>}
                        </div>
                    </div>
                    <button
                        onClick={() => handleTaskClick(task)}
                        disabled={isCompleted || !canClaim}
                        className="interactive-button px-4 py-2 rounded-lg font-bold text-sm flex-shrink-0"
                    >
                        {isCompleted ? t('completed') : t('claim_reward')}
                    </button>
                </div>
            );
        })}
    </div>
  );

  const airdropTasksList = (
    <div className="space-y-3">
        {specialTasks.map(specialTask => {
            const isPurchased = playerState.purchasedSpecialTaskIds?.includes(specialTask.id);
            const isCompleted = playerState.completedSpecialTaskIds?.includes(specialTask.id);

            const getButton = () => {
                if (isCompleted) return <button disabled className="w-full interactive-button rounded-lg font-bold py-2 px-4 mt-2">{t('completed')}</button>;
                if (!isPurchased) {
                    if ((specialTask.priceStars ?? 0) > 0) {
                         return <button onClick={() => onUnlockTask(specialTask)} className="w-full interactive-button rounded-lg font-bold py-2 px-4 mt-2 flex items-center justify-center space-x-2">
                             <span>{t('unlock_for')}</span>
                             <img src={uiIcons.star} alt="star" className="w-5 h-5" crossOrigin="anonymous"/>
                             <span>{specialTask.priceStars}</span>
                         </button>;
                    } else {
                         return <button onClick={() => onUnlockTask(specialTask)} className="w-full interactive-button rounded-lg font-bold py-2 px-4 mt-2">{t('get')}</button>;
                    }
                }
                return (
                     <button onClick={() => handleTaskClick(specialTask)} className="w-full interactive-button rounded-lg font-bold py-2 px-4 mt-2">
                        {specialTask.url ? t('go_to_task') : t('claim')}
                     </button>
                );
            };

            return (
                 <div key={specialTask.id} className="card-glow bg-slate-800/50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    {specialTask.imageUrl && <img src={getProxiedUrl(specialTask.imageUrl)} alt={specialTask.name?.[lang] ?? specialTask.id} className="w-12 h-12 object-contain rounded-lg flex-shrink-0" crossOrigin="anonymous"/>}
                    <div className="flex-grow">
                         <h3 className="text-base font-bold">{specialTask.name?.[lang] ?? specialTask.id}</h3>
                         <p className="text-xs text-gray-400">{specialTask.description?.[lang] ?? ''}</p>
                    </div>
                    <div className="flex-shrink-0 w-full sm:w-32 text-center">
                        <div className="flex items-center justify-center gap-2 text-yellow-300 font-bold">
                            <img src={specialTask.reward?.type === 'coins' ? uiIcons.coin : uiIcons.star} alt="reward" className="w-5 h-5" crossOrigin="anonymous"/>
                            <span>{formatNumber(specialTask.reward?.amount ?? 0)}</span>
                        </div>
                        {getButton()}
                    </div>
                </div>
            );
        })}
    </div>
  );

  return (
    <div className="flex flex-col h-full text-white pt-4 px-4 gap-4">
        {secretCodeTask && <SecretCodeModal task={secretCodeTask} onClose={() => setSecretCodeTask(null)} onSubmit={handleSubmitCode} lang={lang} />}
        <nav className="flex-shrink-0 flex justify-center">
            <div className="bg-slate-900/50 rounded-lg p-1 flex space-x-1">
                <button onClick={() => setActiveTab('daily')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'daily' ? 'bg-slate-700' : ''}`}>{t('sub_daily')}</button>
                <button onClick={() => setActiveTab('airdrop')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'airdrop' ? 'bg-slate-700' : ''}`}>{t('sub_airdrop')}</button>
            </div>
        </nav>
        <div className="flex-grow overflow-y-auto no-scrollbar">
            {activeTab === 'daily' ? dailyTasksList : airdropTasksList}
        </div>
        <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
};

interface SkinsProps {
    skins: CoinSkin[];
    playerState: PlayerState;
    onSetSkin: (skinId: string) => void;
    onListSkin?: (skin: CoinSkin) => void;
    uiIcons: UiIcons;
    lang: Language;
}
const SkinsScreen: React.FC<SkinsProps> = ({ skins, playerState, onSetSkin, onListSkin, uiIcons, lang }) => {
    const t = useTranslation();
    const { unlockedSkins, currentSkinId } = playerState;

    return (
        <div className="w-full flex flex-col items-center">
            <p className="text-center text-[var(--text-secondary)] text-sm mb-4">{t('skins_gallery_desc')}</p>
            <div className="w-full grid grid-cols-3 gap-3">
                {skins.map(skin => {
                    const quantity = unlockedSkins?.[skin.id] || 0;
                    if (quantity === 0) return null;
                    const isSelected = skin.id === currentSkinId;

                    return (
                        <div key={skin.id} className="card-glow bg-slate-800/50 rounded-2xl p-2 flex flex-col items-center text-center">
                            <div className="w-full aspect-square bg-slate-900/50 shadow-inner rounded-xl flex items-center justify-center p-2 mb-2">
                                <img src={skin.iconUrl} alt={skin.name?.[lang] ?? skin.id} className="w-20 h-20 object-contain" crossOrigin="anonymous"/>
                            </div>
                            <h3 className="text-sm font-bold mt-2 h-8">{skin.name?.[lang] ?? skin.id}</h3>
                            <p className="text-xs text-[var(--accent-color)]">{t('profit_boost')} +{skin.profitBoostPercent ?? 0}%</p>
                            <button
                                onClick={() => onSetSkin(skin.id)}
                                disabled={isSelected}
                                className="w-full mt-3 interactive-button rounded-lg px-2 py-1.5 font-bold text-xs"
                            >
                               {isSelected ? t('selected') : t('select_skin')}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

interface MarketProps {
    cards: BlackMarketCard[];
    skins: CoinSkin[];
    playerState: PlayerState;
    onOpenLootbox: (type: 'coin' | 'star') => void;
    onListSkin: (skin: CoinSkin, price: number) => Promise<{error?: string}>;
    onPurchaseItem: (listing: MarketListing) => Promise<{error?: string}>;
    uiIcons: UiIcons;
    lang: Language;
}
const MarketScreen: React.FC<MarketProps> = ({ cards, skins, onOpenLootbox, onListSkin, onPurchaseItem, playerState, uiIcons, lang }) => {
    const t = useTranslation();
    const [activeTab, setActiveTab] = useState<'black_market' | 'buy' | 'sell'>('black_market');
    const [sellSkin, setSellSkin] = useState<CoinSkin | null>(null);
    const [sellPrice, setSellPrice] = useState<string>('');
    const [listings, setListings] = useState<MarketListing[]>([]);
    const game = useGame();

    useEffect(() => {
        if (activeTab === 'buy') {
            game.fetchMarketListings().then(data => setListings(data || []));
        }
    }, [activeTab]);
    
    const handleListForSale = async () => {
        if (!sellSkin || !sellPrice || isNaN(Number(sellPrice)) || Number(sellPrice) <= 0) {
            // TODO: show notification
            return;
        }
        const result = await onListSkin(sellSkin, Number(sellPrice));
        if (!result?.error) {
            setSellSkin(null);
            setSellPrice('');
        }
    };
    
    const sellableSkins = skins.filter(s => (playerState.unlockedSkins[s.id] || 0) > 0 && s.id !== 'default_coin');

    return (
        <div className="w-full flex flex-col">
            <nav className="flex-shrink-0 flex justify-center mb-4">
                <div className="bg-slate-900/50 rounded-lg p-1 flex space-x-1 text-xs sm:text-sm">
                    <button onClick={() => setActiveTab('black_market')} className={`px-3 py-2 font-bold rounded-md transition-colors ${activeTab === 'black_market' ? 'bg-slate-700' : ''}`}>{t('black_market')}</button>
                    <button onClick={() => setActiveTab('buy')} className={`px-3 py-2 font-bold rounded-md transition-colors ${activeTab === 'buy' ? 'bg-slate-700' : ''}`}>{t('market_buy')}</button>
                    <button onClick={() => setActiveTab('sell')} className={`px-3 py-2 font-bold rounded-md transition-colors ${activeTab === 'sell' ? 'bg-slate-700' : ''}`}>{t('market_sell')}</button>
                </div>
            </nav>

            {activeTab === 'black_market' && (
                <div className="w-full flex flex-col items-center">
                    <p className="text-center text-[var(--text-secondary)] text-sm mb-4">{t('black_market_desc')}</p>
                    <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                         {/* Coin Box */}
                        <div className="card-glow bg-slate-800/50 rounded-2xl p-4 flex flex-col items-center text-center">
                            <img src={uiIcons.marketCoinBox} alt="Coin Box" className="w-24 h-24 object-contain" crossOrigin="anonymous"/>
                            <h3 className="text-lg font-bold mt-2">{t('lootbox_coin')}</h3>
                            <button onClick={() => onOpenLootbox('coin')} className="w-full mt-3 interactive-button rounded-xl px-2 py-2 font-bold text-sm flex items-center justify-center space-x-2">
                                <img src={uiIcons.coin} alt="coin" className="w-5 h-5" crossOrigin="anonymous"/>
                                <span>{formatNumber(game.config?.lootboxCostCoins ?? 0)}</span>
                            </button>
                        </div>
                        {/* Star Box */}
                        <div className="card-glow bg-slate-800/50 rounded-2xl p-4 flex flex-col items-center text-center">
                             <img src={uiIcons.marketStarBox} alt="Star Box" className="w-24 h-24 object-contain" crossOrigin="anonymous"/>
                            <h3 className="text-lg font-bold mt-2">{t('lootbox_star')}</h3>
                            <button onClick={() => onOpenLootbox('star')} className="w-full mt-3 interactive-button rounded-xl px-2 py-2 font-bold text-sm flex items-center justify-center space-x-2">
                                <img src={uiIcons.star} alt="star" className="w-5 h-5" crossOrigin="anonymous"/>
                                <span>{game.config?.lootboxCostStars ?? 0}</span>
                            </button>
                        </div>
                    </div>
                     <div className="w-full mt-4">
                        <h3 className="text-center font-bold mb-2">{t('possible_rewards')}</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {[...cards, ...skins.filter(s => s.boxType !== 'direct')].map(card => (
                                <div key={card.id} className="bg-slate-900/50 rounded-lg p-2 flex flex-col items-center text-center">
                                    <img src={card.iconUrl} alt={card.name?.[lang] ?? card.id} className="w-10 h-10 object-contain" crossOrigin="anonymous"/>
                                    <p className="text-xs mt-1 h-8">{card.name?.[lang] ?? card.id}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'buy' && (
                <div className="space-y-3">
                    {listings.length === 0 ? <p className="text-center text-secondary">{t('market_no_listings')}</p> : listings.map(listing => {
                        const skin = skins.find(s => s.id === listing.skin_id);
                        if (!skin) return null;
                        return (
                             <div key={listing.id} className="card-glow bg-slate-800/50 rounded-xl p-3 flex items-center gap-3">
                                <img src={skin.iconUrl} alt={skin.name[lang]} className="w-12 h-12 object-contain rounded-lg flex-shrink-0" crossOrigin="anonymous"/>
                                <div className="flex-grow">
                                     <h3 className="text-sm font-bold truncate">{skin.name[lang]}</h3>
                                     <p className="text-xs text-gray-400">Owner: {listing.owner_name}</p>
                                </div>
                                <button
                                    onClick={() => onPurchaseItem(listing)}
                                    className="interactive-button px-4 py-2 rounded-lg font-bold text-sm flex-shrink-0 flex items-center gap-2"
                                >
                                    <img src={uiIcons.coin} alt="coin" className="w-5 h-5" crossOrigin="anonymous"/>
                                    <span>{formatNumber(listing.price_coins)}</span>
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
            
            {activeTab === 'sell' && (
                <div className="w-full flex flex-col items-center">
                    {sellSkin ? (
                         <div className="w-full max-w-sm text-center">
                             <h3 className="text-lg font-bold mb-2">{t('market_set_price')}</h3>
                             <div className="card-glow bg-slate-800/50 rounded-2xl p-4 flex flex-col items-center mb-4">
                                <img src={sellSkin.iconUrl} alt={sellSkin.name?.[lang] ?? sellSkin.id} className="w-24 h-24 object-contain" crossOrigin="anonymous"/>
                                <h3 className="text-lg font-bold mt-2">{sellSkin.name?.[lang] ?? sellSkin.id}</h3>
                             </div>
                             <div className="input-group mb-3">
                                 <span className="input-group-text"><img src={uiIcons.coin} alt="coin" className="w-5 h-5" crossOrigin="anonymous"/></span>
                                 <input type="number" className="form-control" placeholder={t('market_price_in_coins')} value={sellPrice} onChange={e => setSellPrice(e.target.value)} />
                             </div>
                             <button onClick={handleListForSale} className="w-full interactive-button font-bold py-2">{t('market_list_for_sale')}</button>
                             <button onClick={() => setSellSkin(null)} className="w-full mt-2 text-gray-400">{t('cancel')}</button>
                         </div>
                    ) : (
                         <div className="w-full">
                             <p className="text-center text-[var(--text-secondary)] text-sm mb-4">{t('market_sell_desc')}</p>
                             {sellableSkins.length === 0 ? <p className="text-center text-secondary">{t('market_no_skins_to_sell')}</p> : (
                                <div className="grid grid-cols-3 gap-3">
                                    {sellableSkins.map(skin => (
                                         <button key={skin.id} onClick={() => setSellSkin(skin)} className="card-glow bg-slate-800/50 rounded-2xl p-2 flex flex-col items-center text-center">
                                            <div className="w-full aspect-square bg-slate-900/50 shadow-inner rounded-xl flex items-center justify-center p-2 mb-2 relative">
                                                <img src={skin.iconUrl} alt={skin.name?.[lang] ?? skin.id} className="w-20 h-20 object-contain" crossOrigin="anonymous"/>
                                                <span className="absolute top-1 right-1 bg-slate-700 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                                    {playerState.unlockedSkins[skin.id]}
                                                </span>
                                            </div>
                                            <h3 className="text-xs font-bold mt-1 h-8">{skin.name?.[lang] ?? skin.id}</h3>
                                        </button>
                                    ))}
                                </div>
                             )}
                         </div>
                    )}
                </div>
            )}
        </div>
    )
};


interface ContentProps {
    tiers: VideoRewardTier[];
    onSubmit: (url: string) => Promise<{error?: string}>;
}
const ContentScreen: React.FC<ContentProps> = ({ tiers, onSubmit }) => {
    const t = useTranslation();
    const game = useGame();
    const [url, setUrl] = useState('');
    const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);

    useEffect(() => {
        game.getMyVideoSubmissions().then(data => setSubmissions(data || []));
    }, [game.playerState]);

    const handleSubmit = async () => {
        const result = await onSubmit(url);
        if (!result.error) {
            setUrl('');
        }
    };
    
    const getStatusText = (status: VideoSubmissionStatus) => {
        if (status === 'pending') return t('content_status_pending');
        if (status === 'approved') return t('content_status_approved');
        if (status === 'rejected') return t('content_status_rejected');
        return '';
    };

    return (
        <div className="w-full flex flex-col items-center">
            <h2 className="text-2xl font-display text-center mb-2">{t('content_rewards_title')}</h2>
            <p className="text-center text-[var(--text-secondary)] text-sm mb-4">{t('content_rewards_desc')}</p>
            
            <div className="w-full card-glow p-3 rounded-xl mb-4">
                <div className="grid grid-cols-2 gap-2 text-center">
                    {(tiers || []).map(tier => (
                        <div key={tier.id} className="bg-slate-900/50 rounded-lg p-2">
                             <p className="text-lg font-bold text-yellow-300">+{formatNumber(tier.rewardCoins)}</p>
                             <p className="text-xs text-gray-400">{formatNumber(tier.viewsRequired)} {t('content_reward_for_views')}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="w-full card-glow p-3 rounded-xl mb-6">
                <h3 className="text-lg font-bold mb-2">{t('content_submit_title')}</h3>
                <div className="flex gap-2">
                    <input type="text" value={url} onChange={e => setUrl(e.target.value)} className="input-field flex-grow" placeholder={t('content_submit_placeholder')} />
                    <button onClick={handleSubmit} className="interactive-button font-bold px-4">{t('content_submit_button')}</button>
                </div>
            </div>

            <div className="w-full">
                <h3 className="text-lg font-bold mb-2 text-center">{t('content_history_title')}</h3>
                <div className="space-y-2">
                    {submissions.length === 0 ? (
                        <p className="text-center text-secondary text-sm">{t('content_no_submissions')}</p>
                    ) : submissions.map(sub => (
                        <div key={sub.id} className="card-glow bg-slate-800/50 rounded-xl p-3 flex items-center justify-between gap-3 text-sm">
                            <a href={sub.video_url} target="_blank" rel="noopener noreferrer" className="truncate text-sky-400 hover:underline">{sub.video_url}</a>
                            <span className={`font-bold ${sub.status === 'approved' ? 'text-green-400' : sub.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}`}>
                                {getStatusText(sub.status)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


// Main App Structure
const AppContainer: React.FC = () => {
    const { user, isInitializing } = useAuth();    
    const [minLoadTimePassed, setMinLoadTimePassed] = useState(false);
    const [hasPlayed, setHasPlayed] = useState(false);

    // Effect for minimum loading screen time
    useEffect(() => {
        const timer = setTimeout(() => {
        setMinLoadTimePassed(true);
        }, 3000);
        return () => clearTimeout(timer);
    }, []);

    if (isInitializing || !minLoadTimePassed) {
        return <LoadingScreen hasPlayed={hasPlayed} onAnimationComplete={() => setHasPlayed(true)} />;
    }

    if (!user) {
        return <div className="text-white">Error: User not found. Please reload.</div>;
    }

    return <MainApp user={user} />;
};

const LoadingScreen: React.FC<{ hasPlayed: boolean; onAnimationComplete: () => void; }> = ({ hasPlayed, onAnimationComplete }) => {
    const game = useGame();
    const config = game.config;
    
    useEffect(() => {
        const timer = setTimeout(onAnimationComplete, 1500); // Animation duration
        return () => clearTimeout(timer);
    }, [onAnimationComplete]);

    return (
        <div className="fixed inset-0 bg-slate-900 z-[5000] flex items-center justify-center">
            {config?.loadingScreenImageUrl && (
                <img
                    src={getProxiedUrl(config.loadingScreenImageUrl)}
                    alt="Loading..."
                    className="absolute inset-0 w-full h-full object-cover"
                    crossOrigin="anonymous"
                />
            )}
             <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div className={`boot-sequence ${hasPlayed ? 'played' : ''}`}>
                <p>&gt; System Initializing...</p>
                <p>&gt; Loading Dossier...</p>
                <p>&gt; Verifying Identity...</p>
                <p className="text-green-400">&gt; ACCESS GRANTED</p>
            </div>
             <style>{`
                .boot-sequence { font-family: 'IBM Plex Mono', monospace; color: #94a3b8; text-align: left; width: 90%; max-width: 400px; }
                .boot-sequence p { margin: 0; white-space: nowrap; overflow: hidden; border-right: .15em solid orange; animation: typing 1s steps(40, end), blink-caret .75s step-end infinite; opacity: 0; animation-fill-mode: forwards; }
                .boot-sequence.played p { animation: none; opacity: 1; border: none; }
                .boot-sequence p:nth-child(1) { animation-delay: 0s; }
                .boot-sequence p:nth-child(2) { animation-delay: 0.5s; }
                .boot-sequence p:nth-child(3) { animation-delay: 1s; }
                .boot-sequence p:nth-child(4) { animation-delay: 1.5s; }
                @keyframes typing { from { width: 0; opacity: 1; } to { width: 100%; opacity: 1; } }
                @keyframes blink-caret { from, to { border-color: transparent } 50% { border-color: orange; } }
            `}</style>
        </div>
    );
};


const MainApp: React.FC<{ user: User }> = ({ user }) => {
    const t = useTranslation();
    const { playerState, config, isTurboActive, effectiveMaxEnergy, effectiveMaxSuspicion, allUpgrades, currentLeague, handleTap, buyUpgrade, buyBoost, resetBoostLimit, claimTaskReward, purchaseSpecialTask, completeSpecialTask, claimDailyCombo, claimDailyCipher, getLeaderboard, openCoinLootbox, purchaseLootboxWithStars, setSkin, listSkinOnMarket, purchaseMarketItem, connectWallet, submitVideoForReview } = useGame();
    const { setIsGlitching } = useAuth();
    const [screen, setScreen] = useState<Screen>('exchange');
    const [profileTab, setProfileTab] = useState<ProfileTab>('contacts');
    const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [lootboxResult, setLootboxResult] = useState<any | null>(null);
    const game = useGame();
    const [isFinalScene, setIsFinalScene] = useState(false);
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(true);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const { activeGlitchEvent, setActiveGlitchEvent, handleMetaTap } = useGlitchSystem({
        playerState,
        setPlayerState: game.setPlayerState,
        config,
        savePlayerState: game.savePlayerState,
        isFinalScene,
        markGlitchAsShown: game.markGlitchAsShown,
    });
    
    // Audio player effect
    useEffect(() => {
        const audioUrl = config?.backgroundAudioUrl;
        if (audioUrl) {
            if (!audioRef.current) {
                audioRef.current = new Audio(getProxiedUrl(audioUrl));
                audioRef.current.loop = true;
                audioRef.current.volume = 0.2;
            } else {
                audioRef.current.src = getProxiedUrl(audioUrl);
            }
        }
    }, [config?.backgroundAudioUrl]);

    const toggleMute = () => {
        setIsMuted(prev => {
            const shouldBeMuted = !prev;
            if (audioRef.current) {
                if (shouldBeMuted) {
                    audioRef.current.pause();
                } else {
                    audioRef.current.play().catch(e => console.error("Audio play failed:", e));
                }
            }
            return shouldBeMuted;
        });
    };

    const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
        setTimeout(() => setNotification(null), 3000);
    }, []);
    
    // Effect to handle lootbox/task purchase results from Telegram Stars
    useEffect(() => {
        if (game.purchaseResult) {
            const { type, item } = game.purchaseResult;
            if (type === 'lootbox') {
                 setLootboxResult(item);
            } else if (type === 'task') {
                 showNotification(`${t('task_unlocked')}: <b>${item.name?.[user.language]}</b>`);
            }
            game.setPurchaseResult(null);
        }
    }, [game.purchaseResult, game.setPurchaseResult, showNotification, t, user.language]);


    const handleBuyUpgrade = useCallback(async (upgradeId: string) => {
        const result = await buyUpgrade(upgradeId);
        if(result.error) {
            showNotification(result.error, 'error');
        } else {
            const upgrade = allUpgrades.find(u => u.id === upgradeId);
            if (upgrade) showNotification(`${t('upgrade_purchased')} <b>${upgrade.name[user.language]}</b>`);

            if (upgrade?.isFinal && config?.finalVideoUrl) {
                 setFinalVideoUrl(config.finalVideoUrl);
            } else if (upgrade?.isFinal) { // Fallback if video URL is not set
                setIsFinalScene(true);
            }
        }
    }, [buyUpgrade, showNotification, allUpgrades, user.language, config?.finalVideoUrl]);
    
    const handleBuyBoost = useCallback(async (boost: Boost) => {
        const result = await buyBoost(boost);
        if(result.error) {
            showNotification(result.error, 'error');
        } else {
            showNotification(`${t('boost_purchased')}: <b>${boost.name[user.language]}</b>`);
        }
    }, [buyBoost, showNotification, user.language]);
    
     const handleResetLimit = useCallback(async (boost: Boost) => {
        const result = await resetBoostLimit(boost);
        if (result.error) {
            showNotification(result.error, 'error');
        }
    }, [resetBoostLimit, showNotification]);

    const handleClaimTask = useCallback(async (task: DailyTask, code?: string) => {
        const result = await claimTaskReward(task, code);
        if (result.error) {
            showNotification(result.error, 'error');
        } else {
            showNotification(`<b>${task.name[user.language]}</b> ${t('task_completed')}`);
        }
    }, [claimTaskReward, showNotification, user.language]);

    const handleUnlockTask = useCallback(async (task: SpecialTask) => {
        const result = await purchaseSpecialTask(task);
        if (result?.error) {
            showNotification(result.error, 'error');
        }
        // Success is handled by the purchaseResult effect
    }, [purchaseSpecialTask, showNotification]);

    const handleCompleteTask = useCallback(async (task: SpecialTask, code?: string) => {
         const result = await completeSpecialTask(task, code);
        if (result.error) {
            showNotification(result.error, 'error');
        } else {
            showNotification(`<b>${task.name[user.language]}</b> ${t('task_completed')}`);
        }
    }, [completeSpecialTask, showNotification, user.language]);
    
    const handleClaimCombo = useCallback(async () => {
        const result = await claimDailyCombo();
        if (result.error) {
            showNotification(result.error, 'error');
        } else if (result.reward) {
            showNotification(`${t('combo_collected')} +${formatNumber(result.reward)}!`);
        }
    }, [claimDailyCombo, showNotification]);
    
    const handleClaimCipher = useCallback(async (cipher: string) => {
        const result = await claimDailyCipher(cipher);
        if (result.error) {
            showNotification(result.error, 'error');
            return false;
        } else if (result.reward) {
            showNotification(`${t('cipher_solved')} +${formatNumber(result.reward)}!`);
            return true;
        }
        return false;
    }, [claimDailyCipher, showNotification]);
    
     const handleOpenLootbox = useCallback(async (type: 'coin' | 'star') => {
        if (type === 'coin') {
            const result = await openCoinLootbox('coin');
            if (result.error) {
                showNotification(result.error, 'error');
            } else if (result.wonItem) {
                setLootboxResult(result.wonItem);
            }
        } else if (type === 'star') {
            const result = await purchaseLootboxWithStars('star');
            if (result.error) {
                showNotification(result.error, 'error');
            }
            // Success is handled by the purchaseResult effect
        }
    }, [openCoinLootbox, purchaseLootboxWithStars, showNotification]);
    
    const handleListSkin = useCallback(async (skin: CoinSkin, price: number) => {
        const result = await listSkinOnMarket(skin.id, price);
        if (result.error) {
            showNotification(result.error, 'error');
        } else {
            showNotification(t('market_list_success'), 'success');
        }
        return result;
    }, [listSkinOnMarket, showNotification, t]);

     const handlePurchaseMarketItem = useCallback(async (listing: MarketListing) => {
        const result = await purchaseMarketItem(listing.id);
        if (result.error) {
            showNotification(result.error, 'error');
        } else {
             showNotification(t('market_purchase_success'), 'success');
        }
        return result;
    }, [purchaseMarketItem, showNotification, t]);

    const handleConnectWallet = useCallback(async (address: string) => {
        const result = await connectWallet(address);
        if (result.error) {
             showNotification(result.error, 'error');
        } else {
             showNotification(t('market_wallet_connected'), 'success');
        }
    }, [connectWallet, showNotification, t]);
    
    const handleSubmitVideo = useCallback(async (url: string) => {
        if (!url || !url.startsWith('http')) {
            showNotification(t('content_submission_error_url'), 'error');
            return { error: 'Invalid URL' };
        }
        const result = await submitVideoForReview(url);
        if (result.error) {
            showNotification(result.error, 'error');
        } else {
            showNotification(t('content_submission_success'), 'success');
        }
        return result;
    }, [submitVideoForReview, showNotification, t]);

    if (!config || !playerState || !config.uiIcons || !config.leagues) {
        return <LoadingScreen hasPlayed={true} onAnimationComplete={() => {}} />;
    }

    const navIcons: Record<Screen, string> = config.uiIcons.nav;
    const profileTabIcons: Record<ProfileTab, string> = config.uiIcons.profile_tabs;
    
    const profileTabs: Record<ProfileTab, React.ReactElement> = {
        contacts: <FriendsScreen user={user} playerState={playerState} />,
        boosts: <BoostScreen playerState={playerState} boosts={config.boosts || []} onBuyBoost={handleBuyBoost} onResetLimit={handleResetLimit} lang={user.language} uiIcons={config.uiIcons} boostLimitResetCostStars={config.boostLimitResetCostStars}/>,
        skins: <SkinsScreen skins={config.coinSkins || []} playerState={playerState} onSetSkin={setSkin} uiIcons={config.uiIcons} lang={user.language} />,
        market: <MarketScreen cards={config.blackMarketCards || []} skins={config.coinSkins || []} onOpenLootbox={handleOpenLootbox} onListSkin={handleListSkin} onPurchaseItem={handlePurchaseMarketItem} playerState={playerState} uiIcons={config.uiIcons} lang={user.language} />,
        cell: <CellScreen />,
        content: <ContentScreen tiers={config.videoRewardTiers || []} onSubmit={handleSubmitVideo} />,
    };

    return (
        <div className="bg-[var(--bg-color)] flex flex-col h-screen max-h-screen overflow-hidden text-white w-screen">
            {isFinalScene && <FinalSystemBreachEffect onComplete={() => setIsFinalScene(false)} />}
            {finalVideoUrl && <FinalVideoPlayer videoUrl={finalVideoUrl} onEnd={() => { setFinalVideoUrl(null); setIsFinalScene(true); }} />}
            {activeGlitchEvent && <GlitchEffect message={activeGlitchEvent.message[user.language]} code={activeGlitchEvent.code} onClose={() => setActiveGlitchEvent(null)} />}
            {isLeaderboardOpen && <LeaderboardModal onClose={() => setIsLeaderboardOpen(false)} user={user} getLeaderboard={getLeaderboard} />}
            {lootboxResult && <LootboxResultModal item={lootboxResult} onClose={() => setLootboxResult(null)} lang={user.language} uiIcons={config.uiIcons} />}
            <NotificationToast notification={notification} />
            
            <div id="main-content-wrapper" className="flex-grow min-h-0 flex justify-center">
                {screen === 'exchange' && <ExchangeScreen playerState={playerState} currentLeague={currentLeague} onTap={handleTap} user={user} onClaimCipher={handleClaimCipher} config={config} onOpenLeaderboard={() => setIsLeaderboardOpen(true)} isTurboActive={isTurboActive} effectiveMaxEnergy={effectiveMaxEnergy} effectiveMaxSuspicion={effectiveMaxSuspicion} onEnergyClick={() => setScreen('profile')} onSuspicionClick={() => setScreen('profile')} isMuted={isMuted} toggleMute={toggleMute} handleMetaTap={handleMetaTap} />}
                {screen === 'mine' && <MineScreen upgrades={allUpgrades} balance={playerState.balance} onBuyUpgrade={handleBuyUpgrade} lang={user.language} playerState={playerState} config={config} onClaimCombo={handleClaimCombo} uiIcons={config.uiIcons} handleMetaTap={handleMetaTap}/>}
                {screen === 'missions' && <MissionsScreen tasks={config.tasks || []} specialTasks={config.specialTasks || []} onClaimTask={handleClaimTask} onUnlockTask={handleUnlockTask} onCompleteTask={handleCompleteTask} lang={user.language} playerState={playerState} uiIcons={config.uiIcons} />}
                {screen === 'profile' && <ProfileScreen playerState={playerState} profileTabs={profileTabs} activeTab={profileTab} setActiveTab={setProfileTab} tabIcons={profileTabIcons} user={user} onConnectWallet={handleConnectWallet} handleMetaTap={handleMetaTap} showNotification={showNotification} />}
            </div>

            <nav className="flex-shrink-0 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700/50 grid grid-cols-5 gap-1 p-1">
                {(Object.keys(navIcons) as Screen[]).map(key => (
                    <button key={key} onClick={() => setScreen(key)} className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors text-center ${screen === key ? 'bg-slate-700' : 'hover:bg-slate-800'}`}>
                        <img src={navIcons[key]} alt={key} className={`w-7 h-7 mb-0.5 ${screen === key ? 'active-icon' : ''}`} crossOrigin="anonymous"/>
                        <span className="text-responsive-xxs leading-tight font-bold text-[var(--text-secondary)]">{t(key)}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};

interface FriendsProps {
    user: User;
    playerState: PlayerState;
}

const FriendsScreen: React.FC<FriendsProps> = ({ user, playerState }) => {
    const t = useTranslation();
    const [copied, setCopied] = useState(false);
    const referralLink = `https://t.me/${TELEGRAM_BOT_NAME}?start=${user.id}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(referralLink).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    
    const handleInvite = () => {
        const text = `Join me in ${MINI_APP_NAME} and let's earn together!`;
        const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`;
        window.Telegram.WebApp.openTelegramLink(url);
    };

    return (
        <div className="w-full flex flex-col items-center">
            <h2 className="text-2xl font-display text-center mb-4">{t('invite_friends')}</h2>
            <div className="grid grid-cols-2 gap-4 w-full text-center">
                <div className="card-glow p-3 rounded-xl">
                    <p className="text-sm text-gray-400">{t('your_referrals')}</p>
                    <p className="text-3xl font-bold">{playerState.referrals || 0}</p>
                </div>
                <div className="card-glow p-3 rounded-xl">
                    <p className="text-sm text-gray-400">{t('referral_bonus')}</p>
                    <p className="text-3xl font-bold flex items-center justify-center space-x-1">
                        <img src="/assets/coin.svg" alt="coin" className="w-7 h-7" />
                        <span>{formatNumber(REFERRAL_BONUS)}</span>
                    </p>
                </div>
            </div>
             <div className="card-glow p-3 rounded-xl text-center w-full mt-4">
                <p className="text-sm text-gray-400">{t('profit_from_referrals')}</p>
                <p className="text-xl font-bold text-[var(--accent-color)]">+{formatNumber(playerState.referralProfitPerHour || 0)}/hr</p>
            </div>
            <button onClick={handleInvite} className="w-full interactive-button rounded-xl font-bold text-lg py-3 mt-6">{t('invite_friends')}</button>
            <button onClick={handleCopy} className="w-full bg-transparent text-gray-400 font-bold py-2 mt-2">{copied ? t('copied') : t('copy_referral_link')}</button>
        </div>
    );
};

interface ProfileProps {
    playerState: PlayerState;
    profileTabs: Record<ProfileTab, React.ReactElement>;
    activeTab: ProfileTab;
    setActiveTab: (tab: ProfileTab) => void;
    tabIcons: Record<ProfileTab, string>;
    user: User;
    onConnectWallet: (address: string) => void;
    handleMetaTap: (targetId: string) => void;
    showNotification: (message: string, type?: 'success' | 'error') => void;
}

const ProfileScreen: React.FC<ProfileProps> = ({ playerState, profileTabs, activeTab, setActiveTab, tabIcons, user, onConnectWallet, handleMetaTap, showNotification }) => {
    const t = useTranslation();
    const tonWallet = useTonWallet();
    const [tonConnectUI] = useTonConnectUI();
    const prevWallet = useRef(tonWallet);

    useEffect(() => {
        // Check if wallet connection status changed from something to null (disconnected)
        if (prevWallet.current && !tonWallet) {
            showNotification(t('wallet_disconnected'), 'error');
        }
        // Check if wallet was null and is now something (connected)
        if (!prevWallet.current && tonWallet) {
            onConnectWallet(tonWallet.account.address);
        }
        prevWallet.current = tonWallet;
    }, [tonWallet, onConnectWallet, t, showNotification]);

    return (
        <div className="flex flex-col h-full text-white pt-4 px-4 gap-4 w-full max-w-2xl mx-auto">
            <div className="flex-shrink-0 text-center" onClick={() => handleMetaTap('profile-title')}>
                <h1 className="text-2xl font-display">{t('profile')}</h1>
                <p className="text-sm text-gray-400">{user.name}</p>
                 <div className="mt-2">
                    <TonConnectButton />
                </div>
            </div>
            <nav className="flex-shrink-0 overflow-x-auto no-scrollbar">
                <div className="inline-flex space-x-1 p-1 bg-slate-900/50 rounded-lg">
                    {(Object.keys(tabIcons) as ProfileTab[]).map(key => (
                        <button key={key} onClick={() => setActiveTab(key)} className={`p-2 rounded-md transition-colors ${activeTab === key ? 'bg-slate-700' : 'hover:bg-slate-800'}`}>
                            <img src={tabIcons[key]} alt={key} className={`w-7 h-7 ${activeTab === key ? 'active-icon' : ''}`} crossOrigin="anonymous"/>
                        </button>
                    ))}
                </div>
            </nav>
            <div className="flex-grow overflow-y-auto no-scrollbar">
                {profileTabs[activeTab]}
            </div>
            <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
        </div>
    );
};

const LeaderboardModal: React.FC<{onClose: () => void, user: User, getLeaderboard: GameApi['getLeaderboard']}> = ({ onClose, user, getLeaderboard }) => {
    const t = useTranslation();
    const [leaderboardData, setLeaderboardData] = useState<{topPlayers: LeaderboardPlayer[], totalPlayers: number} | null>(null);

    useEffect(() => {
        getLeaderboard().then(data => setLeaderboardData(data));
    }, [getLeaderboard]);

    return (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2500] flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-glow bg-slate-800 rounded-2xl w-full max-w-sm flex flex-col" style={{height: '80vh'}} onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-white">{t('leaderboard')}</h2>
                    <button onClick={onClose} className="text-gray-400 text-3xl font-light">&times;</button>
                </div>
                {leaderboardData ? (
                    <div className="flex-grow overflow-y-auto p-4 space-y-2">
                        {leaderboardData.topPlayers.map((player, index) => (
                             <div key={player.id} className={`flex items-center gap-3 p-2 rounded-lg ${player.id === user.id ? 'bg-slate-700' : ''}`}>
                                <span className="font-bold text-lg w-6 text-center">{index + 1}</span>
                                <img src={player.leagueIconUrl} alt="league" className="w-8 h-8 flex-shrink-0" crossOrigin="anonymous"/>
                                <div className="flex-grow">
                                    <p className="font-semibold truncate">{player.name}</p>
                                    <p className="text-sm text-gray-400">+{formatNumber(player.profitPerHour)}/hr</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <div className="flex-grow flex items-center justify-center"><div className="spinner-border"></div></div>}
            </div>
        </div>
    );
};

const LootboxResultModal: React.FC<{item: any, onClose: () => void, lang: Language, uiIcons: UiIcons}> = ({ item, onClose, lang, uiIcons }) => {
    const t = useTranslation();
    const isSkin = 'profitBoostPercent' in item;
    
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2500] flex items-center justify-center p-4">
            <div className="card-glow bg-slate-800 rounded-2xl w-full max-w-xs flex flex-col items-center p-6 text-center">
                 <h2 className="text-xl font-bold text-white mb-4">{t('won_item')}!</h2>
                 <div className="w-32 h-32 bg-slate-900/50 shadow-inner rounded-2xl flex items-center justify-center p-4 mb-4">
                    <img src={item.iconUrl} alt={item.name?.[lang]} className="w-full h-full object-contain" crossOrigin="anonymous"/>
                 </div>
                 <h3 className="text-lg font-bold">{item.name?.[lang]}</h3>
                 {isSkin ? (
                    <p className="text-[var(--accent-color)]">+{item.profitBoostPercent}% {t('profit_boost')}</p>
                 ) : (
                    <p className="text-[var(--accent-color)]">+{formatNumber(item.profitPerHour)}/hr</p>
                 )}
                 <button onClick={onClose} className="w-full interactive-button rounded-lg font-bold py-2 mt-6">{t('close')}</button>
            </div>
        </div>
    );
};


const App: React.FC = () => {
  return (
    <AuthProvider>
        <AppContainer />
    </AuthProvider>
  );
};

export default App;