















import React, { useState, useEffect, useCallback, useRef } from 'https://esm.sh/react';
import { TonConnectButton, useTonWallet, useTonConnectUI } from 'https://esm.sh/@tonconnect/ui-react';
import { useGame, useAuth, useTranslation, AuthProvider } from './hooks/useGameLogic';
import { useGlitchSystem } from './hooks/useGlitchSystem';
import ExchangeScreen from './sections/Exchange';
import MineScreen from './sections/Mine';
import BoostScreen from './sections/Boost';
import CellScreen from './sections/Cell';
import { REFERRAL_BONUS, TELEGRAM_BOT_NAME, MINI_APP_NAME } from './constants';
import { DailyTask, GameConfig, Language, LeaderboardPlayer, SpecialTask, PlayerState, User, Boost, CoinSkin, League, UiIcons, Cell, GlitchEvent, MarketListing, VideoSubmission, VideoSubmissionStatus, VideoRewardTier } from './types';
import NotificationToast from './components/NotificationToast';
import SecretCodeModal from './components/SecretCodeModal';
import FinalSystemBreachEffect from './FinalSystemBreachEffect';
import { logger } from './hooks/logger';

type Screen = 'exchange' | 'mine' | 'missions' | 'profile';
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

const getSafeLocalizedString = (localizedString: any, lang: Language, fallback: string = ''): string => {
    if (localizedString && typeof localizedString === 'object') {
        return localizedString[lang] || localizedString['en'] || fallback;
    }
    return fallback;
}

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


const AppContainer: React.FC = () => {
    const { user, isInitializing } = useAuth();    
    const [hasPlayed, setHasPlayed] = useState(false);

    const handleUserInteraction = useCallback(() => {
      if(!hasPlayed) setHasPlayed(true);
    }, [hasPlayed]);

    // Effect for capturing first user interaction for audio autoplay
    useEffect(() => {
        document.addEventListener('click', handleUserInteraction, { once: true });
        document.addEventListener('touchstart', handleUserInteraction, { once: true });
        
        return () => {
           document.removeEventListener('click', handleUserInteraction);
           document.removeEventListener('touchstart', handleUserInteraction);
        };
    }, [handleUserInteraction]);
    
    if (isInitializing) {
        return <div className="h-screen w-screen" />;
    }

    if (!user) {
        return <NotInTelegramScreen />;
    }

    return <MainApp hasPlayed={hasPlayed} />;
};

const LoadingScreen: React.FC<{imageUrl?: string}> = ({ imageUrl }) => (
    <div className="h-screen w-screen relative overflow-hidden bg-[var(--bg-color)]">
        {imageUrl ? (
            <img 
                src={getProxiedUrl(imageUrl)} 
                alt="Loading..." 
                className="absolute top-0 left-0 w-full h-full object-cover"
            />
        ) : (
            <div className="w-full h-full flex flex-col justify-center items-center p-4">
                <h1 className="text-4xl font-display mb-2 text-white">Ukhyliant Clicker</h1>
                <p className="text-lg animate-pulse text-gray-300">Connecting...</p>
            </div>
        )}
    </div>
);

const NotInTelegramScreen: React.FC = () => (
    <div className="h-screen w-screen flex flex-col justify-center items-center p-4 text-center">
        <h1 className="text-4xl font-display mb-2">Ukhyliant Clicker</h1>
        <p className="text-gray-400 mb-8 text-6xl">🚫</p>
        <h2 className="text-2xl font-semibold mb-2">Error</h2>
        <p className="text-lg text-gray-300">This application must be launched from within Telegram.</p>
    </div>
);

const ProfileTabButton = ({ label, iconUrl, isActive, onClick }: { label: string, iconUrl: string, isActive: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-1 rounded-lg transition-colors duration-200 group aspect-square ${
            isActive ? 'bg-slate-900 shadow-inner' : 'hover:bg-slate-700/50'
        }`}
    >
        <img src={iconUrl} alt={label} className={`w-7/12 h-7/12 object-contain transition-all duration-200 ${isActive ? 'active-icon' : 'text-slate-400'}`} {...(isExternal(iconUrl) && { crossOrigin: 'anonymous' })} />
        <span className={`text-responsive-xxs font-bold transition-opacity duration-200 mt-1 ${isActive ? 'text-[var(--accent-color)] opacity-100' : 'opacity-0'}`}>{label}</span>
    </button>
);

// --- ProfileScreen Components (Extracted) ---

const ContactsContent = ({ user, playerState, config, handleMetaTap, onOpenGlitchCodesModal }: {
    user: User;
    playerState: PlayerState;
    config: GameConfig;
    handleMetaTap: (targetId: string) => void;
    onOpenGlitchCodesModal: () => void;
}) => {
    const t = useTranslation();
    const [copied, setCopied] = useState(false);
    const handleCopyReferral = () => {
        logger.action('COPY_REFERRAL_LINK');
        const referralLink = `https://t.me/${TELEGRAM_BOT_NAME}/${MINI_APP_NAME}?startapp=${user.id}`;
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="w-full max-w-md space-y-4 text-center">
            <div className="card-glow p-4 rounded-xl cursor-pointer" onClick={() => handleMetaTap('referral-counter')}>
                <p className="text-[var(--text-secondary)] text-lg">{t('your_referrals')}</p>
                <div className="flex items-center justify-center">
                    <p className="text-5xl font-display my-1">{playerState.referrals}</p>
                    <button onClick={(e) => { e.stopPropagation(); onOpenGlitchCodesModal(); }} className="ml-4 p-2 rounded-full hover:bg-slate-700/50">
                        <img src={config.uiIcons.secretCodeEntry} alt="Secret Codes" className="w-6 h-6" {...(isExternal(config.uiIcons.secretCodeEntry) && { crossOrigin: 'anonymous' })}/>
                    </button>
                </div>
            </div>
            <div className="card-glow p-4 rounded-xl">
                <p className="text-[var(--text-secondary)] text-lg">{t('referral_bonus')}</p>
                <p className="text-2xl font-bold my-1 flex items-center justify-center space-x-2">
                    <span>+{REFERRAL_BONUS.toLocaleString()}</span>
                    <img src={config.uiIcons.coin} alt="coin" className="w-6 h-6" {...(isExternal(config.uiIcons.coin) && { crossOrigin: 'anonymous' })} />
                </p>
            </div>
             <div className="card-glow p-4 rounded-xl">
                <p className="text-[var(--text-secondary)] text-lg">{t('profit_from_referrals')}</p>
                <p className="text-2xl font-bold my-1 flex items-center justify-center space-x-2 text-[var(--accent-color)]">
                    <span>+{formatNumber(playerState.referralProfitPerHour)}/hr</span>
                    <img src={config.uiIcons.energy} alt="energy" className="w-6 h-6" {...(isExternal(config.uiIcons.energy) && { crossOrigin: 'anonymous' })} />
                </p>
            </div>
            <button onClick={handleCopyReferral} className="w-full interactive-button text-white font-bold py-3 px-4 text-lg rounded-lg">
                {copied ? t('copied') : t('invite_friends')}
            </button>
        </div>
    );
};
    
const SkinsContent = ({ user, playerState, config, onSetSkin }: {
    user: User;
    playerState: PlayerState;
    config: GameConfig;
    onSetSkin: (skinId: string) => void;
}) => {
    const t = useTranslation();
    const unlockedSkins = (config.coinSkins || []).filter(skin => (playerState.unlockedSkins[skin.id] || 0) > 0);
    return (
        <div className="w-full max-w-md">
            <p className="text-center text-[var(--text-secondary)] mb-4 max-w-xs mx-auto">{t('skins_gallery_desc')}</p>
            <div className="grid grid-cols-3 gap-4">
                {unlockedSkins.map(skin => {
                    const isSelected = playerState.currentSkinId === skin.id;
                    const skinName = skin.name?.[user.language] || skin.id;
                    const quantity = playerState.unlockedSkins[skin.id] || 0;
                    return (
                        <div key={skin.id} className={`card-glow rounded-xl p-3 flex flex-col items-center text-center transition-all ${isSelected ? 'border-2 border-[var(--accent-color)]' : ''}`}>
                            <div className="w-16 h-16 mb-2 flex items-center justify-center relative">
                                <img src={skin.iconUrl} alt={skinName} className="w-full h-full object-contain" {...(isExternal(skin.iconUrl) && { crossOrigin: 'anonymous' })} />
                                {quantity > 1 && <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-bold rounded-full px-1.5 leading-tight">{quantity}</span>}
                            </div>
                            <p className="text-xs font-bold leading-tight">{skinName}</p>
                            <p className="text-xs text-[var(--accent-color)] mt-1">+{skin.profitBoostPercent}%</p>
                            <button
                                onClick={() => onSetSkin(skin.id)}
                                disabled={isSelected}
                                className="w-full mt-2 py-1 text-xs font-bold interactive-button rounded-md disabled:bg-slate-900 disabled:shadow-inner disabled:text-slate-500"
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

const BlackMarketContent = ({ config, onOpenCoinLootbox, onPurchaseStarLootbox }: {
    config: GameConfig;
    onOpenCoinLootbox: (boxType: 'coin') => void;
    onPurchaseStarLootbox: (boxType: 'star') => void;
}) => {
    const t = useTranslation();
    const lootboxCostCoins = config.lootboxCostCoins || 25000;
    const lootboxCostStars = config.lootboxCostStars || 10;
    
    return (
        <div className="w-full max-w-md space-y-4 pt-8 text-center">
            <h2 className="text-2xl font-display text-white">{t('black_market')}</h2>
            <p className="text-[var(--text-secondary)] mb-4">{t('black_market_desc')}</p>
             <div className="card-glow rounded-xl p-4 flex flex-col items-center">
                <img src={config.uiIcons.marketCoinBox} alt="Coin Box" className="w-24 h-24 mb-3" {...(isExternal(config.uiIcons.marketCoinBox) && { crossOrigin: 'anonymous' })} />
                <h3 className="font-bold text-lg">{t('lootbox_coin')}</h3>
                <button
                    onClick={() => onOpenCoinLootbox('coin')}
                    className="w-full mt-4 interactive-button rounded-lg py-3 font-bold flex items-center justify-center space-x-2"
                >
                    <span>{t('open_for')} {formatNumber(lootboxCostCoins)}</span>
                    <img src={config.uiIcons.coin} alt="coin" className="w-6 h-6" {...(isExternal(config.uiIcons.coin) && { crossOrigin: 'anonymous' })}/>
                </button>
            </div>
            <div className="card-glow rounded-xl p-4 flex flex-col items-center">
                <img src={config.uiIcons.marketStarBox} alt="Star Box" className="w-24 h-24 mb-3" {...(isExternal(config.uiIcons.marketStarBox) && { crossOrigin: 'anonymous' })}/>
                <h3 className="font-bold text-lg">{t('lootbox_star')}</h3>
                <button
                    onClick={() => onPurchaseStarLootbox('star')}
                    className="w-full mt-4 interactive-button rounded-lg py-3 font-bold flex items-center justify-center space-x-2"
                >
                    <span>{t('open_for')} {lootboxCostStars}</span>
                    <img src={config.uiIcons.star} alt="star" className="w-6 h-6" {...(isExternal(config.uiIcons.star) && { crossOrigin: 'anonymous' })}/>
                </button>
            </div>
        </div>
    );
};

const BuyTab = ({ user, config, showNotification, gameApi }: {
    user: User;
    config: GameConfig;
    showNotification: (message: string, type?: 'success' | 'error') => void;
    gameApi: GameApi;
}) => {
    const t = useTranslation();
    const [listings, setListings] = useState<MarketListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasingId, setPurchasingId] = useState<number | null>(null);

    const fetchListings = useCallback(() => {
        gameApi.fetchMarketListings().then(data => {
            setListings(data || []);
            setLoading(false);
        });
    }, [gameApi]);
    
    useEffect(() => {
        fetchListings();
    }, [fetchListings]);
    
    const handlePurchase = async (listingId: number) => {
        setPurchasingId(listingId);
        const result = await gameApi.purchaseMarketItem(listingId);
        if (result?.error) {
            showNotification(result.error, 'error');
        } else {
            showNotification(t('market_purchase_success'), 'success');
            fetchListings(); // Refresh listings after purchase
        }
        setPurchasingId(null);
    };

    if (loading) return <div className="text-center py-8">{t('loading')}...</div>;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {listings.map(listing => {
                const skin = config.coinSkins.find(s => s.id === listing.skin_id);
                if (!skin) return null;
                const skinName = skin.name?.[user.language] || skin.id;
                const isPurchasing = purchasingId === listing.id;
                return (
                    <div key={listing.id} className="card-glow rounded-xl p-3 flex flex-col items-center text-center">
                        <div className="w-16 h-16 mb-2 flex items-center justify-center">
                            <img src={skin.iconUrl} alt={skinName} className="w-full h-full object-contain" {...(isExternal(skin.iconUrl) && { crossOrigin: 'anonymous' })} />
                        </div>
                        <p className="text-xs font-bold leading-tight flex-grow">{skinName}</p>
                        <p className="text-xs text-slate-400 truncate w-full" title={listing.owner_name}>{listing.owner_name}</p>
                        <button
                            onClick={() => handlePurchase(listing.id)}
                            disabled={isPurchasing}
                            className="w-full mt-2 py-2 text-xs font-bold interactive-button rounded-md flex items-center justify-center space-x-1"
                        >
                            {isPurchasing ? '...' : (
                                <>
                                    <span>{formatNumber(listing.price_coins)}</span>
                                    <img src={config.uiIcons.coin} alt="coin" className="w-4 h-4" {...(isExternal(config.uiIcons.coin) && { crossOrigin: 'anonymous' })} />
                                </>
                            )}
                        </button>
                    </div>
                );
            })}
             {listings.length === 0 && <p className="col-span-full text-center py-8 text-[var(--text-secondary)]">{t('market_no_listings')}</p>}
        </div>
    );
};

const SellTab = ({ user, playerState, config, showNotification, gameApi }: {
    user: User;
    playerState: PlayerState;
    config: GameConfig;
    showNotification: (message: string, type?: 'success' | 'error') => void;
    gameApi: GameApi;
}) => {
    const t = useTranslation();
    const [sellingSkin, setSellingSkin] = useState<CoinSkin | null>(null);
    const [price, setPrice] = useState('');
    
    const sellableSkins = config.coinSkins.filter(skin => (playerState.unlockedSkins[skin.id] || 0) > 0 && skin.id !== 'default_coin');
    
    const handleListSkin = async () => {
        if (!sellingSkin || !price || isNaN(Number(price)) || Number(price) <= 0) {
            showNotification(t('market_invalid_price'), 'error');
            return;
        }
        const result = await gameApi.listSkinOnMarket(sellingSkin.id, Number(price));
        if (result?.error) {
            showNotification(result.error, 'error');
        } else {
            showNotification(t('market_list_success'), 'success');
            setSellingSkin(null);
            setPrice('');
        }
    };
    
    return (
        <>
            {sellingSkin && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2500] flex items-center justify-center p-4" onClick={() => setSellingSkin(null)}>
                    <div className="card-glow bg-slate-800 rounded-2xl w-full max-w-sm flex flex-col p-6 items-center" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-white mb-4">{t('market_set_price')}</h2>
                         <div className="w-24 h-24 mb-4 bg-slate-900/50 shadow-inner rounded-2xl p-2 flex items-center justify-center">
                             <img src={sellingSkin.iconUrl} alt={sellingSkin.name?.[user.language] || sellingSkin.id} className="w-full h-full object-contain" {...(isExternal(sellingSkin.iconUrl) && { crossOrigin: 'anonymous' })} />
                        </div>
                        <p className="font-bold text-lg mb-4">{sellingSkin.name?.[user.language] || sellingSkin.id}</p>
                        <div className="relative w-full mb-4">
                             <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder={t('market_price_in_coins')} className="w-full input-field text-center pr-8" />
                             <img src={config.uiIcons.coin} alt="coin" className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2" {...(isExternal(config.uiIcons.coin) && { crossOrigin: 'anonymous' })}/>
                        </div>
                        <button onClick={handleListSkin} className="w-full interactive-button rounded-lg font-bold py-3 text-lg">{t('market_list_for_sale')}</button>
                    </div>
                </div>
            )}
            <p className="text-center text-[var(--text-secondary)] mb-4">{t('market_sell_desc')}</p>
            <div className="grid grid-cols-3 gap-4">
                {sellableSkins.map(skin => {
                    const skinName = skin.name?.[user.language] || skin.id;
                    const quantity = playerState.unlockedSkins[skin.id] || 0;
                    return (
                        <div key={skin.id} onClick={() => setSellingSkin(skin)} className="card-glow rounded-xl p-3 flex flex-col items-center text-center cursor-pointer hover:border-[var(--accent-color)] border border-transparent">
                            <div className="w-16 h-16 mb-2 flex items-center justify-center relative">
                                <img src={skin.iconUrl} alt={skinName} className="w-full h-full object-contain" {...(isExternal(skin.iconUrl) && { crossOrigin: 'anonymous' })} />
                                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-bold rounded-full px-1.5 leading-tight">{quantity}</span>
                            </div>
                            <p className="text-xs font-bold leading-tight">{skinName}</p>
                        </div>
                    )
                })}
                 {sellableSkins.length === 0 && <p className="col-span-full text-center py-8 text-[var(--text-secondary)]">{t('market_no_skins_to_sell')}</p>}
            </div>
        </>
    );
};

const UndergroundMarketContent = ({ user, playerState, config, showNotification, gameApi }: {
    user: User;
    playerState: PlayerState;
    config: GameConfig;
    showNotification: (message: string, type?: 'success' | 'error') => void;
    gameApi: GameApi;
}) => {
    const t = useTranslation();
    const [marketTab, setMarketTab] = useState<'buy' | 'sell'>('buy');

    const tabProps = { user, playerState, config, showNotification, gameApi };

    return (
        <div className="w-full">
            <div className="bg-slate-800/50 shadow-inner rounded-xl p-1 flex justify-around items-center gap-1 border border-slate-700 mb-4">
                <button onClick={() => setMarketTab('buy')} className={`flex-1 font-bold py-2 text-sm rounded-lg ${marketTab === 'buy' ? 'bg-slate-900 text-[var(--accent-color)]' : 'text-slate-300'}`}>{t('market_buy')}</button>
                <button onClick={() => setMarketTab('sell')} className={`flex-1 font-bold py-2 text-sm rounded-lg ${marketTab === 'sell' ? 'bg-slate-900 text-[var(--accent-color)]' : 'text-slate-300'}`}>{t('market_sell')}</button>
            </div>
            {marketTab === 'buy' && <BuyTab {...tabProps} />}
            {marketTab === 'sell' && <SellTab {...tabProps} />}
        </div>
    );
};

const MarketMainView = ({ setMarketView }: { setMarketView: (view: 'black' | 'underground') => void }) => {
    const t = useTranslation();
    return (
        <div className="w-full max-w-md space-y-4">
            <div onClick={() => setMarketView('black')} className="card-glow p-4 rounded-xl cursor-pointer hover:border-[var(--accent-color)] border border-transparent transition-all">
                <h2 className="text-xl font-bold">{t('black_market')}</h2>
                <p className="text-sm text-[var(--text-secondary)]">{t('black_market_desc')}</p>
            </div>
            <div onClick={() => setMarketView('underground')} className="card-glow p-4 rounded-xl cursor-pointer hover:border-[var(--accent-color)] border border-transparent transition-all">
                <h2 className="text-xl font-bold">{t('underground_market')}</h2>
                <p className="text-sm text-[var(--text-secondary)]">{t('underground_market_desc')}</p>
            </div>
        </div>
    );
};

const MarketBackButton = ({ setMarketView }: { setMarketView: (view: 'main') => void }) => (
    <button onClick={() => setMarketView('main')} className="absolute top-0 left-0 text-slate-400 hover:text-white bg-slate-800/50 rounded-full p-2 z-10">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
    </button>
);


const MarketContent = (props: {
    user: User;
    playerState: PlayerState;
    config: GameConfig;
    showNotification: (message: string, type?: 'success' | 'error') => void;
    onOpenCoinLootbox: (boxType: 'coin') => void;
    onPurchaseStarLootbox: (boxType: 'star') => void;
    gameApi: GameApi;
}) => {
    const [marketView, setMarketView] = useState<'main' | 'black' | 'underground'>('main');

    if (marketView === 'main') {
        return <MarketMainView setMarketView={setMarketView} />;
    }

    return (
        <div className="relative w-full max-w-md">
             <MarketBackButton setMarketView={setMarketView} />
             {marketView === 'black' && <BlackMarketContent {...props} />}
             {marketView === 'underground' && <UndergroundMarketContent {...props} />}
        </div>
    );
};

const ContentScreen = ({ config, gameApi, showNotification }: { config: GameConfig, gameApi: GameApi, showNotification: (message: string, type?: 'success' | 'error') => void }) => {
    const t = useTranslation();
    const [url, setUrl] = useState('');
    const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSubmissions = useCallback(() => {
        gameApi.getMyVideoSubmissions().then(data => {
            setSubmissions(data || []);
            setLoading(false);
        });
    }, [gameApi]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    const handleSubmit = async () => {
        if (!url.trim() || !url.startsWith('http')) {
            showNotification(t('content_submission_error_url'), 'error');
            return;
        }
        const result = await gameApi.submitVideoForReview(url);
        if (result?.error) {
            showNotification(t(result.error as any, result.error), 'error');
        } else {
            showNotification(t('content_submission_success'), 'success');
            setUrl('');
            fetchSubmissions(); // Refresh list
        }
    };

    const tiers = config.videoRewardTiers || [];

    const getStatusText = (status: VideoSubmissionStatus) => {
        switch (status) {
            case 'pending': return t('content_status_pending');
            case 'approved': return t('content_status_approved');
            case 'rejected': return t('content_status_rejected');
            default: return status;
        }
    };

    return (
        <div className="w-full max-w-md space-y-4">
            <div className="card-glow p-4 rounded-xl text-center">
                <h2 className="text-xl font-bold">{t('content_rewards_title')}</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{t('content_rewards_desc')}</p>
                <div className="mt-4 space-y-2 text-left">
                    {tiers.map(tier => (
                        <div key={tier.id} className="bg-slate-900/50 shadow-inner rounded-lg p-2 flex justify-between items-center">
                            <span className="font-bold">{formatNumber(tier.viewsRequired)} {t('content_reward_for_views')}</span>
                            <span className="text-[var(--accent-color)] font-bold flex items-center space-x-1">
                                <span>+{formatNumber(tier.rewardCoins)}</span>
                                <img src={config.uiIcons.coin} alt="coin" className="w-4 h-4" />
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card-glow p-4 rounded-xl">
                <h3 className="text-lg font-bold mb-2">{t('content_submit_title')}</h3>
                <input 
                    type="url" 
                    value={url} 
                    onChange={e => setUrl(e.target.value)}
                    placeholder={t('content_submit_placeholder')}
                    className="input-field w-full mb-3"
                />
                <button onClick={handleSubmit} className="w-full interactive-button text-white font-bold py-3 px-4 text-lg rounded-lg">
                    {t('content_submit_button')}
                </button>
            </div>

            <div className="card-glow p-4 rounded-xl">
                <h3 className="text-lg font-bold mb-2">{t('content_history_title')}</h3>
                {loading ? <p className="text-center text-sm text-[var(--text-secondary)]">{t('loading')}...</p> : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {submissions.length > 0 ? submissions.map(sub => (
                             <div key={sub.id} className="bg-slate-900/50 shadow-inner rounded-lg p-2 flex justify-between items-center text-sm">
                                <a href={sub.video_url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-400 hover:underline flex-1 pr-2">{sub.video_url}</a>
                                <span className={`font-bold ${
                                    sub.status === 'approved' ? 'text-green-400' :
                                    sub.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'
                                }`}>
                                    {getStatusText(sub.status)}
                                    {sub.status === 'approved' && sub.reward_amount && ` (+${formatNumber(sub.reward_amount)})`}
                                </span>
                             </div>
                        )) : <p className="text-center text-sm text-[var(--text-secondary)]">{t('content_no_submissions')}</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

interface ProfileScreenProps {
  playerState: PlayerState;
  user: User;
  config: GameConfig;
  onBuyBoost: (boost: Boost) => void;
  onResetBoostLimit: (boost: Boost) => void;
  onSetSkin: (skinId: string) => void;
  onOpenCoinLootbox: (boxType: 'coin') => void;
  onPurchaseStarLootbox: (boxType: 'star') => void;
  handleMetaTap: (targetId: string) => void;
  onOpenGlitchCodesModal: () => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
  boostLimitResetCostStars: number;
  gameApi: GameApi;
}

const ProfileScreen = ({ playerState, user, config, onBuyBoost, onResetBoostLimit, onSetSkin, onOpenCoinLootbox, onPurchaseStarLootbox, handleMetaTap, onOpenGlitchCodesModal, showNotification, boostLimitResetCostStars, gameApi } : ProfileScreenProps) => {
    const t = useTranslation();
    const [activeTab, setActiveTab] = useState<ProfileTab>('contacts');

    const tabProps = {
        user,
        playerState,
        config,
        handleMetaTap,
        onOpenGlitchCodesModal,
        onSetSkin,
        onOpenCoinLootbox,
        onPurchaseStarLootbox,
        showNotification,
        gameApi,
    };

    const handleSetActiveTab = (tab: ProfileTab) => {
        logger.action('PROFILE_TAB_CHANGE', { from: activeTab, to: tab });
        setActiveTab(tab);
    }

    return (
        <div className="flex flex-col h-full text-white items-center">
            <div className="w-full max-w-md sticky top-0 bg-[var(--bg-color)] pt-4 px-4 z-10">
                <h1 className="text-3xl font-display text-center mb-4 cursor-pointer" onClick={() => handleMetaTap('profile-title')}>{t('profile')}</h1>
                <div className="bg-slate-800/50 shadow-inner rounded-xl p-1 grid grid-cols-6 gap-1 border border-slate-700">
                    <ProfileTabButton label={t('sub_contacts')} iconUrl={config.uiIcons.profile_tabs.contacts} isActive={activeTab === 'contacts'} onClick={() => handleSetActiveTab('contacts')} />
                    <ProfileTabButton label={t('sub_boosts')} iconUrl={config.uiIcons.profile_tabs.boosts} isActive={activeTab === 'boosts'} onClick={() => handleSetActiveTab('boosts')} />
                    <ProfileTabButton label={t('sub_disguise')} iconUrl={config.uiIcons.profile_tabs.skins} isActive={activeTab === 'skins'} onClick={() => handleSetActiveTab('skins')} />
                    <ProfileTabButton label={t('sub_market')} iconUrl={config.uiIcons.profile_tabs.market} isActive={activeTab === 'market'} onClick={() => handleSetActiveTab('market')} />
                    <ProfileTabButton label={t('sub_cell')} iconUrl={config.uiIcons.profile_tabs.cell} isActive={activeTab === 'cell'} onClick={() => handleSetActiveTab('cell')} />
                     <ProfileTabButton label={t('sub_content')} iconUrl={config.uiIcons.profile_tabs.content} isActive={activeTab === 'content'} onClick={() => handleSetActiveTab('content')} />
                </div>
            </div>
            
            <div className="w-full max-w-md flex-grow overflow-y-auto no-scrollbar pt-4 flex justify-center px-4">
                {activeTab === 'contacts' && <ContactsContent {...tabProps} />}
                {activeTab === 'boosts' && <BoostScreen playerState={playerState} boosts={config.boosts} onBuyBoost={onBuyBoost} onResetLimit={onResetBoostLimit} lang={user.language} uiIcons={config.uiIcons} boostLimitResetCostStars={boostLimitResetCostStars} />}
                {activeTab === 'skins' && <SkinsContent {...tabProps} />}
                {activeTab === 'market' && <MarketContent {...tabProps} />}
                {activeTab === 'cell' && <CellScreen />}
                {activeTab === 'content' && <ContentScreen config={config} gameApi={gameApi} showNotification={showNotification} />}
            </div>
        </div>
    );
};

const TaskCard = ({ task, playerState, onClaim, onPurchase, lang, startedTasks, uiIcons }: { 
    task: DailyTask | SpecialTask, 
    playerState: PlayerState, 
    onClaim: (task: DailyTask | SpecialTask) => void, 
    onPurchase?: (task: SpecialTask) => void,
    lang: Language, 
    startedTasks: Set<string>, 
    uiIcons: UiIcons 
}) => {
    const t = useTranslation();
    const isAirdropTask = 'isOneTime' in task;

    let isCompleted;
    if (isAirdropTask) {
        isCompleted = (playerState.completedSpecialTaskIds || []).includes(task.id);
    } else {
        isCompleted = (playerState.completedDailyTaskIds || []).includes(task.id);
    }
    
    const isPurchased = isAirdropTask ? (playerState.purchasedSpecialTaskIds || []).includes(task.id) : true;
    const isStarted = startedTasks.has(task.id);

    let progressDisplay: string | null = null;
    let claimIsDisabled = false;

    if (!isAirdropTask && task.type === 'taps') {
        const required = task.requiredTaps || 0;
        const progress = Math.min(playerState.dailyTaps, required);
        if (!isCompleted) {
            progressDisplay = `${progress}/${required}`;
        }
        if (progress < required) {
            claimIsDisabled = true;
        }
    }
    
    const getButton = () => {
        if (isCompleted) {
            return <button disabled className="bg-slate-900 shadow-inner rounded-lg font-bold py-2 px-4 text-sm w-full text-center text-[var(--text-secondary)]">{t('completed')}</button>;
        }

        if (isAirdropTask && (task as SpecialTask).priceStars > 0 && !isPurchased && onPurchase) {
            return (
                <button onClick={() => onPurchase(task as SpecialTask)} className="interactive-button rounded-lg font-bold py-2 px-3 text-sm flex items-center justify-center space-x-1.5 w-full">
                    <span>{t('unlock_for')} {(task as SpecialTask).priceStars}</span>
                    <img src={uiIcons.star} alt="star" className="w-4 h-4" {...(isExternal(uiIcons.star) && { crossOrigin: 'anonymous' })}/>
                </button>
            );
        }

        let buttonText = t('go_to_task');
        if (task.type === 'taps') {
            buttonText = t('claim');
        } else if (isStarted) {
            buttonText = task.type === 'video_code' ? t('enter_secret_code') : t('claim_reward');
        }

        return (
            <button onClick={() => onClaim(task)} disabled={claimIsDisabled} className="interactive-button rounded-lg font-bold py-2 px-4 text-sm w-full text-center disabled:opacity-50 disabled:cursor-not-allowed">
                {progressDisplay || buttonText}
            </button>
        );
    };
    
    const rewardIconUrl = task.reward?.type === 'profit' ? uiIcons.energy : uiIcons.coin;
    
    return (
         <div className={`card-glow bg-slate-800/50 rounded-2xl p-3 flex flex-col justify-between min-h-48 space-y-4 transition-opacity ${isCompleted ? 'opacity-60' : ''}`}>
            <div className="flex-grow min-w-0">
                <div className="flex items-start space-x-3 mb-2">
                    {task.imageUrl && (
                        <div className="bg-slate-900/50 shadow-inner rounded-lg p-1 w-14 h-14 flex-shrink-0">
                            <img src={task.imageUrl} alt={task.name?.[lang]} className="w-full h-full object-contain" {...(isExternal(task.imageUrl) && { crossOrigin: 'anonymous' })} />
                        </div>
                    )}
                    <div className="flex-grow min-w-0">
                        <p className="text-white text-left font-semibold" title={task.name?.[lang]}>{task.name?.[lang]}</p>
                    </div>
                </div>
                {'description' in task && <p className="text-[var(--text-secondary)] text-xs text-left" title={(task as SpecialTask).description?.[lang]}>{(task as SpecialTask).description?.[lang]}</p>}
                <div className="text-yellow-400 text-sm text-left mt-2 flex items-center space-x-1 font-bold">
                    <img src={rewardIconUrl} alt="reward" className="w-4 h-4" {...(isExternal(rewardIconUrl) && { crossOrigin: 'anonymous' })} />
                    <span>+{formatNumber(task.reward.amount)}</span>
                    {task.reward.type === 'profit' && <span className="text-[var(--text-secondary)] font-normal ml-1">/hr</span>}
                </div>
            </div>
            <div className="w-full">
                {getButton()}
            </div>
        </div>
    );
};

const WalletConnector: React.FC<{
    playerState: PlayerState;
    gameApi: GameApi;
    showNotification: (message: string, type?: 'success' | 'error') => void;
    config: GameConfig;
}> = ({ playerState, gameApi, showNotification, config }) => {
    const t = useTranslation();
    const wallet = useTonWallet();
    const [tonConnectUI] = useTonConnectUI();
    const { user } = useAuth();

    useEffect(() => {
        if (wallet && user) {
            const address = wallet.account.address;
            if (address && address !== playerState.tonWalletAddress) {
                gameApi.connectWallet(address).then(result => {
                    if (result?.error) {
                        showNotification(result.error, 'error');
                    } else {
                        showNotification(t('market_wallet_connected'), 'success');
                    }
                });
            }
        }
    }, [wallet, user, playerState.tonWalletAddress, gameApi, showNotification, t]);

    useEffect(() => {
        return tonConnectUI.onStatusChange(wallet => {
            if (!wallet) {
                if (playerState.tonWalletAddress && user) {
                    logger.action('WALLET_DISCONNECTED');
                    gameApi.connectWallet('').then(() => {
                        showNotification(t('wallet_disconnected'), 'success');
                    });
                }
            }
        });
    }, [tonConnectUI, playerState.tonWalletAddress, user, gameApi, showNotification, t]);

    const truncateAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

    return (
        <div className="card-glow bg-blue-900/30 border border-blue-500/50 rounded-2xl p-3 flex flex-col items-center space-y-3">
            <div className="flex items-start space-x-3 w-full">
                <div className="bg-slate-900/50 shadow-inner rounded-lg p-1 w-14 h-14 flex-shrink-0">
                    <img src={config.uiIcons.wallet} alt="wallet" className="w-full h-full object-contain" {...(isExternal(config.uiIcons.wallet) && { crossOrigin: 'anonymous' })}/>
                </div>
                <div className="flex-grow min-w-0">
                    <p className="text-white font-semibold">{t('connect_your_ton_wallet')}</p>
                    <p className="text-slate-300 text-xs mt-1">
                        {wallet ? `Connected: ${truncateAddress(wallet.account.address)}` : t('connect_wallet_task_desc')}
                    </p>
                </div>
            </div>
            <div className="w-full">
                <TonConnectButton className="ton-connect-button" />
            </div>
            <style>{`
                .ton-connect-button button {
                    width: 100%;
                    background-color: var(--bg-card);
                    border: 1px solid var(--border-color);
                    box-shadow: 0 0 8px -2px rgba(0,0,0,0.6);
                    transition: all 0.15s ease-out;
                    font-family: 'Russo One', sans-serif;
                    text-transform: uppercase;
                    border-radius: 0.5rem;
                    padding: 0.75rem 1rem;
                    font-size: 1rem;
                }
                .ton-connect-button button:hover {
                    background-color: #334155;
                    border-color: var(--text-secondary);
                    box-shadow: 0 0 10px -2px var(--accent-color-glow);
                }
            `}</style>
        </div>
    );
};

const UnifiedMissionsScreen: React.FC<{
    tasks: DailyTask[];
    specialTasks: SpecialTask[];
    playerState: PlayerState;
    onClaim: (task: DailyTask | SpecialTask) => void;
    onPurchase: (task: SpecialTask) => void;
    user: User;
    startedTasks: Set<string>;
    uiIcons: UiIcons;
    gameApi: GameApi;
    showNotification: (message: string, type?: 'success' | 'error') => void;
    config: GameConfig;
}> = ({ tasks, specialTasks, playerState, onClaim, onPurchase, user, startedTasks, uiIcons, gameApi, showNotification, config }) => {
    const t = useTranslation();
    const [activeTab, setActiveTab] = useState<'daily' | 'airdrop'>('daily');

    return (
        <div className="flex flex-col h-full text-white pt-4 px-4">
            <h1 className="text-3xl font-display text-center mb-2 flex-shrink-0">{t('missions')}</h1>
            <div className="flex justify-center mb-4">
                <div className="bg-slate-800/50 shadow-inner rounded-xl p-1 flex justify-around items-center gap-1 border border-slate-700">
                    <button onClick={() => setActiveTab('daily')} className={`flex-1 font-bold py-2 px-6 text-sm rounded-lg ${activeTab === 'daily' ? 'bg-slate-900 text-[var(--accent-color)]' : 'text-slate-300'}`}>{t('sub_daily')}</button>
                    <button onClick={() => setActiveTab('airdrop')} className={`flex-1 font-bold py-2 px-6 text-sm rounded-lg ${activeTab === 'airdrop' ? 'bg-slate-900 text-[var(--accent-color)]' : 'text-slate-300'}`}>{t('sub_airdrop')}</button>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto no-scrollbar -mx-4 px-4">
                <div className="flex flex-col space-y-4 pb-4">
                    {activeTab === 'airdrop' && (
                        <>
                            <p className="text-center text-[var(--text-secondary)] flex-shrink-0">{t('airdrop_description')}</p>
                            <WalletConnector 
                                playerState={playerState}
                                gameApi={gameApi}
                                showNotification={showNotification}
                                config={config}
                            />
                        </>
                    )}
                    {(activeTab === 'daily' ? tasks : specialTasks).map(task => (
                       <div key={task.id}>
                            <TaskCard
                                task={task}
                                playerState={playerState}
                                onClaim={onClaim}
                                onPurchase={onPurchase}
                                lang={user.language}
                                startedTasks={startedTasks}
                                uiIcons={uiIcons}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const LeaderboardScreen: React.FC<{
    onClose: () => void;
    getLeaderboard: () => Promise<{ topPlayers: LeaderboardPlayer[]; totalPlayers: number } | null>;
    user: User;
    currentLeague: League | null;
}> = ({ onClose, getLeaderboard, user, currentLeague }) => {
    const t = useTranslation();
    const [data, setData] = useState<{ topPlayers: LeaderboardPlayer[]; totalPlayers: number } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getLeaderboard().then(leaderboardData => {
            setData(leaderboardData);
            setLoading(false);
        });
    }, [getLeaderboard]);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1500] flex flex-col p-4" onClick={onClose}>
            <div className="card-glow bg-slate-800 rounded-2xl w-full max-w-lg mx-auto flex flex-col p-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-display text-white">{t('leaderboard')}</h2>
                    <button onClick={onClose} className="text-gray-400 text-3xl font-light">&times;</button>
                </div>
                {loading ? <p className="text-center text-[var(--text-secondary)] py-8">{t('loading')}</p> : (
                    <>
                        <div className="bg-slate-900/50 shadow-inner rounded-xl p-3 mb-4 flex justify-between items-center">
                            <div>
                                <p className="text-sm text-[var(--text-secondary)]">{t('your_league')}</p>
                                <p className="font-bold text-lg text-white">{currentLeague?.name?.[user.language] || 'N/A'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-[var(--text-secondary)]">{t('total_players')}</p>
                                <p className="font-bold text-lg text-white">{data?.totalPlayers.toLocaleString() || 0}</p>
                            </div>
                        </div>
                        <div className="overflow-y-auto space-y-2" style={{maxHeight: '60vh'}}>
                            {data?.topPlayers.map((player, index) => (
                                <div key={player.id} className="bg-slate-900/30 rounded-lg p-2 flex items-center space-x-3 text-sm">
                                    <span className="font-bold w-6 text-center">{index + 1}</span>
                                    <img src={player.leagueIconUrl} alt="league" className="w-8 h-8" {...(isExternal(player.leagueIconUrl) && { crossOrigin: 'anonymous' })}/>
                                    <span className="flex-grow font-semibold text-white truncate">{player.name}</span>
                                    <span className="text-[var(--accent-color)] font-mono">+{formatNumber(player.profitPerHour)}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const PurchaseResultModal: React.FC<{
    result: { type: 'lootbox' | 'task', item: any };
    onClose: () => void;
    lang: Language;
    uiIcons: UiIcons;
}> = ({ result, onClose, lang, uiIcons }) => {
    const t = useTranslation();
    const { item } = result;
    
    const isLootboxItem = result.type === 'lootbox';
    const title = isLootboxItem ? t('won_item') : t('task_unlocked');
    
    const itemName = getSafeLocalizedString(item?.name, lang, item?.id || 'New Item');
    const iconUrl = item.iconUrl || item.imageUrl;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2500] flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-glow bg-slate-800 rounded-2xl w-full max-w-sm flex flex-col p-6 items-center" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-4">{title}!</h2>
                <div className="w-32 h-32 mb-4 bg-slate-900/50 shadow-inner rounded-2xl p-2 flex items-center justify-center">
                    <img src={iconUrl} alt={itemName} className="w-full h-full object-contain" {...(isExternal(iconUrl) && { crossOrigin: 'anonymous' })} />
                </div>
                <p className="text-lg font-bold text-white mb-2">{itemName}</p>
                {isLootboxItem && item && 'profitBoostPercent' in item && item.profitBoostPercent > 0 && <p className="text-[var(--accent-color)]">+{item.profitBoostPercent}% {t('profit_boost')}</p>}
                {isLootboxItem && item && 'profitPerHour' in item && <p className="text-[var(--accent-color)]">+{formatNumber(item.profitPerHour)}/hr</p>}
                
                <button onClick={onClose} className="w-full interactive-button rounded-lg font-bold py-3 mt-6 text-lg">
                    {t('close')}
                </button>
            </div>
        </div>
    );
};

const GlitchCodesModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (code: string) => Promise<boolean>;
  playerState: PlayerState;
  config: GameConfig;
  lang: Language;
}> = ({ isOpen, onClose, onSubmit, playerState, config, lang }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const t = useTranslation();
    
    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim() || loading) return;
        setLoading(true);
        const success = await onSubmit(code.trim().toUpperCase());
        if (success) {
            setCode('');
        }
        setLoading(false);
    };

    const discoveredEvents = (playerState.discoveredGlitchCodes || [])
      .map(c => (config.glitchEvents || []).find(e => e.code === c))
      .filter(Boolean) as GlitchEvent[];

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2500] flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-glow bg-slate-800 rounded-2xl w-full max-w-sm flex flex-col p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">{t('glitch_codes_title')}</h2>
                    <button onClick={onClose} className="text-gray-400 text-3xl font-light">&times;</button>
                </div>
                
                <form onSubmit={handleSubmit} className="mb-4">
                    <p className="text-[var(--text-secondary)] text-sm mb-2">{t('glitch_codes_desc')}</p>
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        className="w-full input-field mb-2 text-center font-mono tracking-widest text-lg"
                        placeholder="CODE"
                        maxLength={4}
                        autoFocus
                    />
                    <button type="submit" disabled={loading || !code.trim()} className="w-full interactive-button rounded-lg font-bold py-3 text-lg">
                        {loading ? '...' : t('activate')}
                    </button>
                </form>

                <div className="bg-slate-900/50 shadow-inner rounded-xl p-2 space-y-2 overflow-y-auto max-h-48">
                    {discoveredEvents.length > 0 ? discoveredEvents.map(event => {
                        const isClaimed = playerState.claimedGlitchCodes?.includes(event.code);
                        return (
                            <div key={event.id} className={`p-2 rounded-md ${isClaimed ? 'bg-green-900/50' : 'bg-slate-800/50'}`}>
                                <p className="font-mono text-amber-300">{event.code} - <span className="text-white font-sans">{event.message[lang]}</span></p>
                                {isClaimed && <p className="text-xs text-green-400">{t('claimed')}</p>}
                            </div>
                        );
                    }) : <p className="text-center text-sm text-[var(--text-secondary)] p-4">{t('no_glitch_codes_found')}</p>}
                </div>
            </div>
        </div>
    );
};

const PenaltyModal: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
    const t = useTranslation();
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2500] flex items-center justify-center p-4" onClick={onClose}>
            <div 
              className="card-glow bg-slate-800 rounded-2xl w-full max-w-sm flex flex-col p-6 items-center" 
              onClick={e => e.stopPropagation()}
            >
                <h2 className="text-2xl font-display text-red-400 mb-4">{t('penalty_title')}</h2>
                <p className="text-lg text-white text-center mb-6">"{message}"</p>
                <button onClick={onClose} className="w-full interactive-button rounded-lg font-bold py-3 mt-2 text-lg">
                    {t('penalty_close')}
                </button>
            </div>
        </div>
    );
};

const NavItem = ({ screen, label, iconUrl, active, setActiveScreen }: { screen: Screen, label: string, iconUrl: string, active: boolean, setActiveScreen: (s: Screen) => void }) => (
    <button
      onClick={() => setActiveScreen(screen)}
      className={`flex flex-col items-center justify-center text-xs w-full pt-2 pb-1 transition-colors duration-200 group ${active ? 'text-[var(--accent-color)]' : 'text-slate-400 hover:text-white'}`}
    >
        <div className={`w-12 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${active ? 'bg-slate-700/50' : ''}`}>
            <img 
                src={iconUrl} 
                alt={label} 
                className={`w-7 h-7 transition-all duration-200 ${active ? 'active-icon' : ''}`} 
                {...(isExternal(iconUrl) && { crossOrigin: 'anonymous' })}
            />
        </div>
        <span className={`transition-opacity duration-200 font-bold ${active ? 'opacity-100' : 'opacity-0'}`}>{label}</span>
    </button>
);

const HackerLoadingScreen: React.FC = () => {
    const [lines, setLines] = useState<string[]>([]);
    const lineContent = [
      "Booting Ukhyliant OS...",
      "Initializing connection...",
      "Bypassing central monitoring...",
      "Network security protocols: DEACTIVATED",
      "Connecting to main server...",
      "Authenticating credentials...",
      "ACCESS GRANTED.",
      "Loading user dossier...",
      "Finalizing interface...",
      "Welcome, agent."
    ];
  
    useEffect(() => {
      let i = 0;
      const interval = setInterval(() => {
        if (i < lineContent.length) {
          setLines(prev => [...prev, lineContent[i]]);
          i++;
        } else {
          clearInterval(interval);
        }
      }, 450);
  
      return () => clearInterval(interval);
    }, []);
  
    return (
      <div className="h-screen w-screen bg-black text-green-400 font-mono p-4 flex flex-col justify-end overflow-hidden">
        <div>
          {lines.map((line, index) => (
            <p key={index} className="text-sm whitespace-nowrap">
              &gt; {line}
            </p>
          ))}
          <div className="w-2 h-4 bg-green-400 animate-pulse ml-2 inline-block"></div>
        </div>
      </div>
    );
  };

const MainApp: React.FC<{
  hasPlayed: boolean;
}> = ({ hasPlayed }) => {
  const { user, isGlitching, setIsGlitching } = useAuth();
  const gameApi = useGame();
  const { 
      playerState, config, handleTap, buyUpgrade, allUpgrades, currentLeague, 
      claimTaskReward, buyBoost, resetBoostLimit, purchaseSpecialTask, completeSpecialTask,
      claimDailyCombo, claimDailyCipher, getLeaderboard, 
      openCoinLootbox, purchaseLootboxWithStars, 
      setSkin,
      claimGlitchCode,
      markGlitchAsShown,
      isTurboActive, effectiveMaxEnergy, effectiveMaxSuspicion,
      systemMessage, setSystemMessage,
      purchaseResult, setPurchaseResult, setPlayerState,
      savePlayerState
  } = gameApi;
  
  const [activeScreen, _setActiveScreen] = React.useState<Screen>('exchange');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const t = useTranslation();
  const [startedTasks, setStartedTasks] = useState<Set<string>>(new Set());
  const [secretCodeTask, setSecretCodeTask] = useState<DailyTask | SpecialTask | null>(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [isTgReady, setIsTgReady] = useState(!!window.Telegram?.WebApp?.initData);
  const [loadingStage, setLoadingStage] = useState<'initialImage' | 'hackerTerminal' | 'done'>('initialImage');

  // Glitch event states
  const [isGlitchCodesModalOpen, setIsGlitchCodesModalOpen] = useState(false);
  const [isFinalScene, setIsFinalScene] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  
  const { activeGlitchEvent, setActiveGlitchEvent, handleMetaTap } = useGlitchSystem({
      playerState,
      setPlayerState,
      config,
      savePlayerState,
      isFinalScene,
      markGlitchAsShown
  });

  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('isMuted') === 'true';
  });
  const audioRef = useRef<HTMLAudioElement>(null);

  const setActiveScreen = (screen: Screen) => {
    logger.action('SCREEN_CHANGE', { from: activeScreen, to: screen });
    _setActiveScreen(screen);
  }

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
        setNotification(prev => (prev?.message === message ? null : prev));
    }, 3000);
  }, []);

  const handleGlitchEffectClose = () => {
    if (activeGlitchEvent?.isFinal) {
        setIsFinalScene(true);
    }
    setActiveGlitchEvent(null);
  };

  const handleFinalSceneComplete = useCallback(() => {
    setShowVideo(true);
  }, []);

  const handleResetBoostLimit = async (boost: Boost) => {
    const result = await resetBoostLimit(boost);
    if (result?.error) {
        showNotification(result.error, 'error');
    }
    // Success is handled by the global invoiceClosed event listener
  };
    
  // Effect to wait for the Telegram Web App script to be ready
  useEffect(() => {
    const checkTgReady = () => {
        if (window.Telegram?.WebApp?.initData) {
            setIsTgReady(true);
        } else {
            setTimeout(checkTgReady, 100);
        }
    };
    if (!isTgReady) {
        checkTgReady();
    }
  }, [isTgReady]);
  
    // Refactored Audio Handling Effect
    useEffect(() => {
        const audioEl = audioRef.current;
        if (!audioEl || !config?.backgroundAudioUrl) {
            audioEl?.pause();
            return;
        }

        const proxiedUrl = getProxiedUrl(config.backgroundAudioUrl);
        if (proxiedUrl && audioEl.src !== proxiedUrl) {
            audioEl.src = proxiedUrl;
            audioEl.loop = true;
        }

        if (isMuted) {
            audioEl.pause();
        } else {
            const playPromise = audioEl.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    if (!hasPlayed) {
                        logger.warn("Autoplay was prevented. Audio will start on user interaction.");
                    } else {
                        logger.error("Audio play failed even after interaction:", error);
                    }
                });
            }
        }
    }, [config?.backgroundAudioUrl, isMuted, hasPlayed]);


  const toggleMute = () => {
    setIsMuted(prev => {
        const newState = !prev;
        logger.action('TOGGLE_MUTE', { muted: newState });
        localStorage.setItem('isMuted', String(newState));
        return newState;
    });
  };

  // Effect for setting up and tearing down the app
  useEffect(() => {
    if (playerState && config && isTgReady && !isAppReady) {
        logger.info('App is ready to be displayed.');
        setIsAppReady(true);
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    };

  }, [playerState, config, isAppReady, isTgReady]);

  useEffect(() => {
    // This effect manages the visual stages of the loading sequence.
    const imageTimer = setTimeout(() => {
      if (loadingStage === 'initialImage') {
        setLoadingStage('hackerTerminal');
      }
    }, 2000); // Show image for 2 seconds

    const hackerTimer = setTimeout(() => {
      if (loadingStage !== 'done') {
        setLoadingStage('done');
      }
    }, 7000); // Total min loading time is 2s + 5s = 7 seconds

    return () => {
      clearTimeout(imageTimer);
      clearTimeout(hackerTimer);
    };
  }, [loadingStage]);
  
  const isDataReady = isAppReady && playerState && config && user;

  if (!isDataReady || loadingStage !== 'done') {
      if (loadingStage === 'initialImage') {
        return <LoadingScreen imageUrl={config?.loadingScreenImageUrl} />;
      }
      return <HackerLoadingScreen />;
  }

  const handleBuyBoost = async (boost: Boost) => {
    const result = await buyBoost(boost);
    if (result.player) {
        showNotification(t('boost_purchased'), 'success');
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        if (boost.id === 'boost_turbo_mode') {
            logger.action('TURBO_MODE_ACTIVATED');
            setActiveScreen('exchange');
        }
    } else {
        showNotification(result.error, 'error');
    }
  };

  const handleBuyUpgrade = async (upgradeId: string) => {
      const result = await buyUpgrade(upgradeId);
      if (result.player) {
          showNotification(t('upgrade_purchased'), 'success');
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      } else if (result.error) {
          showNotification(result.error, 'error');
      }
  };


  const handleTaskClaim = (task: DailyTask | SpecialTask) => {
    if (task.type === 'video_code') {
        logger.action('MODAL_OPEN', { name: 'SecretCode', taskId: task.id });
        setSecretCodeTask(task);
        return;
    }
    if (task.url) {
        logger.action('OPEN_EXTERNAL_LINK', { url: task.url, taskId: task.id });
        window.Telegram.WebApp.openLink(task.url);
        setStartedTasks(prev => new Set(prev).add(task.id));
    }
    
    const isSpecial = 'isOneTime' in task;

    const claimAction = isSpecial 
        ? () => completeSpecialTask(task as SpecialTask)
        : () => claimTaskReward(task as DailyTask);

    if (!task.url || startedTasks.has(task.id) || task.type === 'taps') {
        claimAction().then(result => {
             if (result.error) {
                showNotification(result.error, 'error');
             } else {
                let rewardText = `+${formatNumber(result.reward?.amount || 0)}`;
                if (result.reward?.type === 'profit') rewardText += `/hr`;
                showNotification(`${task.name[user.language]} ${t('task_completed')} (${rewardText})`, 'success');
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
             }
        });
    }
  };

  const handleTaskPurchase = async (task: SpecialTask) => {
    const result = await purchaseSpecialTask(task);
    if (result.error) {
        showNotification(result.error, 'error');
    }
  };

  const handleSecretCodeSubmit = async (code: string) => {
    if (!secretCodeTask) return;
    const isSpecial = 'isOneTime' in secretCodeTask;
     const claimAction = isSpecial 
        ? () => completeSpecialTask(secretCodeTask as SpecialTask, code)
        : () => claimTaskReward(secretCodeTask as DailyTask, code);
    
     const result = await claimAction();
     if (result.error) {
        showNotification(result.error, 'error');
     } else {
        let rewardText = `+${formatNumber(result.reward?.amount || 0)}`;
        if (result.reward?.type === 'profit') rewardText += `/hr`;
        showNotification(`${secretCodeTask.name[user.language]} ${t('task_completed')} (${rewardText})`, 'success');
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        setSecretCodeTask(null);
     }
  };
  
  const handleClaimCombo = async () => {
    const result = await claimDailyCombo();
    if(result.error) {
        showNotification(result.error, 'error');
    } else {
        showNotification(`${t('combo_collected')} (+${formatNumber(result.reward || 0)})`, 'success');
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
  };
  
  const handleClaimCipher = async (cipher: string) => {
    const result = await claimDailyCipher(cipher);
    if(result.error) {
      showNotification(result.error, 'error');
      return false;
    } else {
      showNotification(`${t('cipher_solved')} (+${formatNumber(result.reward || 0)})`, 'success');
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      return true;
    }
  };
  
  const handleGlitchCodeSubmit = async (code: string) => {
    const result = await claimGlitchCode(code);
    if(result.error) {
      showNotification(result.error, 'error');
      return false;
    } else {
      let rewardText = `+${formatNumber(result.reward?.amount || 0)}`;
      if (result.reward?.type === 'profit') rewardText += `/hr`;
      showNotification(`${t('glitch_code_claimed')} (${rewardText})`, 'success');
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      return true;
    }
  };

  const handleOpenCoinLootbox = async (boxType: 'coin') => {
    const result = await openCoinLootbox(boxType);
    if(result.error) {
        showNotification(result.error, 'error');
    }
  };

  const handlePurchaseStarLootbox = async (boxType: 'star') => {
    const result = await purchaseLootboxWithStars(boxType);
     if(result.error) {
        showNotification(result.error, 'error');
    }
  };

  const renderScreen = () => {
    switch(activeScreen) {
      case 'exchange': return <ExchangeScreen playerState={playerState} currentLeague={currentLeague} onTap={handleTap} user={user} onClaimCipher={handleClaimCipher} config={config} onOpenLeaderboard={() => { logger.action('MODAL_OPEN', { name: 'Leaderboard' }); setIsLeaderboardOpen(true); }} isTurboActive={isTurboActive} effectiveMaxEnergy={effectiveMaxEnergy} effectiveMaxSuspicion={effectiveMaxSuspicion} onEnergyClick={() => showNotification(t('tooltip_energy'), 'success')} onSuspicionClick={() => showNotification(t('tooltip_suspicion'), 'success')} isMuted={isMuted} toggleMute={toggleMute} handleMetaTap={handleMetaTap} />;
      case 'mine': return <MineScreen upgrades={allUpgrades} balance={playerState.balance} onBuyUpgrade={handleBuyUpgrade} lang={user.language} playerState={playerState} config={config} onClaimCombo={handleClaimCombo} uiIcons={config.uiIcons} handleMetaTap={handleMetaTap}/>;
      case 'missions': return <UnifiedMissionsScreen tasks={config.tasks} specialTasks={config.specialTasks} playerState={playerState} onClaim={handleTaskClaim} onPurchase={handleTaskPurchase} user={user} startedTasks={startedTasks} uiIcons={config.uiIcons} gameApi={gameApi} showNotification={showNotification} config={config} />;
      case 'profile': return <ProfileScreen playerState={playerState} user={user} config={config} onBuyBoost={handleBuyBoost} onResetBoostLimit={handleResetBoostLimit} onSetSkin={setSkin} onOpenCoinLootbox={handleOpenCoinLootbox} onPurchaseStarLootbox={handlePurchaseStarLootbox} handleMetaTap={handleMetaTap} onOpenGlitchCodesModal={() => { logger.action('MODAL_OPEN', { name: 'GlitchCodes' }); setIsGlitchCodesModalOpen(true); }} showNotification={showNotification} boostLimitResetCostStars={config.boostLimitResetCostStars} gameApi={gameApi} />;
      default: return null;
    }
  }

  if (isGlitching) {
    return <GlitchEffect onClose={() => setIsGlitching(false)} />;
  }

  if (activeGlitchEvent) {
      return <GlitchEffect message={activeGlitchEvent.message[user.language]} code={activeGlitchEvent.code} onClose={handleGlitchEffectClose} />
  }

  if(isFinalScene && !showVideo) {
    return <FinalSystemBreachEffect onComplete={handleFinalSceneComplete} />;
  }

  if(showVideo && config.finalVideoUrl) {
    return <FinalVideoPlayer videoUrl={config.finalVideoUrl} onEnd={() => setShowVideo(false)} />;
  }
  
  return (
    <div className="h-screen w-screen flex flex-col fixed inset-0">
      <div id="main-content-wrapper" className="flex-grow overflow-hidden relative">
          {renderScreen()}
      </div>
      <nav className="flex-shrink-0 bg-slate-800/50 border-t border-[var(--border-color)] grid grid-cols-4">
        <NavItem screen="exchange" label={t('exchange')} iconUrl={config.uiIcons.nav.exchange} active={activeScreen === 'exchange'} setActiveScreen={setActiveScreen} />
        <NavItem screen="mine" label={t('mine')} iconUrl={config.uiIcons.nav.mine} active={activeScreen === 'mine'} setActiveScreen={setActiveScreen} />
        <NavItem screen="missions" label={t('missions')} iconUrl={config.uiIcons.nav.missions} active={activeScreen === 'missions'} setActiveScreen={setActiveScreen} />
        <NavItem screen="profile" label={t('profile')} iconUrl={config.uiIcons.nav.profile} active={activeScreen === 'profile'} setActiveScreen={setActiveScreen} />
      </nav>
      {notification && <NotificationToast notification={notification} />}
      {isLeaderboardOpen && <LeaderboardScreen onClose={() => { logger.action('MODAL_CLOSE', { name: 'Leaderboard' }); setIsLeaderboardOpen(false); }} getLeaderboard={getLeaderboard} user={user} currentLeague={currentLeague} />}
      {secretCodeTask && <SecretCodeModal task={secretCodeTask} onClose={() => { logger.action('MODAL_CLOSE', { name: 'SecretCode' }); setSecretCodeTask(null); }} onSubmit={handleSecretCodeSubmit} lang={user.language} />}
      {purchaseResult && <PurchaseResultModal result={purchaseResult} onClose={() => { logger.action('MODAL_CLOSE', { name: 'PurchaseResult' }); setPurchaseResult(null); }} lang={user.language} uiIcons={config.uiIcons} />}
      {isGlitchCodesModalOpen && <GlitchCodesModal isOpen={isGlitchCodesModalOpen} onClose={() => { logger.action('MODAL_CLOSE', { name: 'GlitchCodes' }); setIsGlitchCodesModalOpen(false); }} onSubmit={handleGlitchCodeSubmit} playerState={playerState} config={config} lang={user.language} />}
      {systemMessage && <PenaltyModal message={systemMessage} onClose={() => { logger.action('MODAL_CLOSE', { name: 'Penalty' }); setSystemMessage(''); }} />}
      {config.backgroundAudioUrl && <audio ref={audioRef} crossOrigin="anonymous" />}
    </div>
  );
};

const App: React.FC = () => (
    <AuthProvider>
        <AppContainer />
    </AuthProvider>
);

export default App;