import React, { useState, useEffect, useCallback, useRef } from 'https://esm.sh/react';
import { useGame, useAuth, useTranslation, AuthProvider } from './hooks/useGameLogic';
import { useGlitchSystem } from './hooks/useGlitchSystem';
import ExchangeScreen from './sections/Exchange';
import MineScreen from './sections/Mine';
import BoostScreen from './sections/Boost';
import CellScreen from './sections/Cell';
import { REFERRAL_BONUS, TELEGRAM_BOT_NAME, MINI_APP_NAME } from './constants';
import { DailyTask, GameConfig, Language, LeaderboardPlayer, SpecialTask, PlayerState, User, Boost, CoinSkin, League, UiIcons, Cell, GlitchEvent, MarketListing, WithdrawalRequest } from './types';
import NotificationToast from './components/NotificationToast';
import SecretCodeModal from './components/SecretCodeModal';
import FinalSystemBreachEffect from './FinalSystemBreachEffect';

type Screen = 'exchange' | 'mine' | 'missions' | 'airdrop' | 'profile';
type ProfileTab = 'contacts' | 'boosts' | 'skins' | 'market' | 'cell';

// Add html2canvas to the global scope for TypeScript
declare const html2canvas: any;

type GameApi = ReturnType<typeof useGame>;

const isExternal = (url: string | undefined) => url && url.startsWith('http');

const formatNumber = (num: number): string => {
  if (num === null || num === undefined) return '0';
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
            <video ref={videoRef} src={videoUrl} onEnded={onEnd} playsInline autoPlay muted={false} />
            <button onClick={onEnd} className="skip-button">{t('skip_video')}</button>
        </div>
    );
};


const AppContainer: React.FC = () => {
    const { user, isInitializing } = useAuth();
    
    if (isInitializing) {
        return <div className="h-screen w-screen" />;
    }

    if (!user) {
        return <NotInTelegramScreen />;
    }

    return <MainApp />;
};

const LoadingScreen: React.FC<{imageUrl?: string}> = ({ imageUrl }) => (
    <div className="h-screen w-screen relative overflow-hidden bg-[var(--bg-color)]">
        {imageUrl ? (
            <img 
                src={imageUrl} 
                alt="Loading..." 
                className="absolute top-0 left-0 w-full h-full object-cover"
                {...(isExternal(imageUrl) && { crossOrigin: 'anonymous' })}
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
        className={`flex-1 flex flex-col items-center justify-center p-1 rounded-lg transition-colors duration-200 group aspect-square ${
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
    const unlockedSkins = (config.coinSkins || []).filter(skin => playerState.unlockedSkins.includes(skin.id));
    return (
        <div className="w-full max-w-md">
            <p className="text-center text-[var(--text-secondary)] mb-4 max-w-xs mx-auto">{t('skins_gallery_desc')}</p>
            <div className="grid grid-cols-3 gap-4">
                {unlockedSkins.map(skin => {
                    const isSelected = playerState.currentSkinId === skin.id;
                    return (
                        <div key={skin.id} className={`card-glow rounded-xl p-3 flex flex-col items-center text-center transition-all ${isSelected ? 'border-2 border-[var(--accent-color)]' : ''}`}>
                            <div className="w-16 h-16 mb-2 flex items-center justify-center">
                                <img src={skin.iconUrl} alt={skin.name[user.language]} className="w-full h-full object-contain" {...(isExternal(skin.iconUrl) && { crossOrigin: 'anonymous' })} />
                            </div>
                            <p className="text-xs font-bold leading-tight">{skin.name[user.language]}</p>
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

    useEffect(() => {
        gameApi.fetchMarketListings().then(data => {
            setListings(data || []);
            setLoading(false);
        });
    }, [gameApi]);
    
    const handlePurchase = async (listingId: number) => {
        const result = await gameApi.purchaseMarketItem(listingId);
        if (result?.error) {
            showNotification(result.error, 'error');
        }
    };

    if (loading) return <div className="text-center py-8">{t('loading')}...</div>;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {listings.map(listing => {
                const skin = config.coinSkins.find(s => s.id === listing.skin_id);
                if (!skin) return null;
                return (
                    <div key={listing.id} className="card-glow rounded-xl p-3 flex flex-col items-center text-center">
                        <div className="w-16 h-16 mb-2 flex items-center justify-center">
                            <img src={skin.iconUrl} alt={skin.name[user.language]} className="w-full h-full object-contain" {...(isExternal(skin.iconUrl) && { crossOrigin: 'anonymous' })} />
                        </div>
                        <p className="text-xs font-bold leading-tight flex-grow">{skin.name[user.language]}</p>
                        <p className="text-xs text-slate-400 truncate w-full" title={listing.owner_name}>{listing.owner_name}</p>
                        <button
                            onClick={() => handlePurchase(listing.id)}
                            className="w-full mt-2 py-2 text-xs font-bold interactive-button rounded-md flex items-center justify-center space-x-1"
                        >
                            <span>{listing.price_stars}</span>
                            <img src={config.uiIcons.star} alt="star" className="w-4 h-4" {...(isExternal(config.uiIcons.star) && { crossOrigin: 'anonymous' })} />
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
    
    const unlockedSkins = config.coinSkins.filter(skin => playerState.unlockedSkins.includes(skin.id) && skin.id !== 'default_coin');
    
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
                             <img src={sellingSkin.iconUrl} alt={sellingSkin.name[user.language]} className="w-full h-full object-contain" {...(isExternal(sellingSkin.iconUrl) && { crossOrigin: 'anonymous' })} />
                        </div>
                        <p className="font-bold text-lg mb-4">{sellingSkin.name[user.language]}</p>
                        <div className="relative w-full mb-4">
                             <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder={t('market_price_in_stars')} className="w-full input-field text-center pr-8" />
                             <img src={config.uiIcons.star} alt="star" className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2" {...(isExternal(config.uiIcons.star) && { crossOrigin: 'anonymous' })}/>
                        </div>
                        <button onClick={handleListSkin} className="w-full interactive-button rounded-lg font-bold py-3 text-lg">{t('market_list_for_sale')}</button>
                    </div>
                </div>
            )}
            <p className="text-center text-[var(--text-secondary)] mb-4">{t('market_sell_desc')}</p>
            <div className="grid grid-cols-3 gap-4">
                {unlockedSkins.map(skin => (
                    <div key={skin.id} onClick={() => setSellingSkin(skin)} className="card-glow rounded-xl p-3 flex flex-col items-center text-center cursor-pointer hover:border-[var(--accent-color)] border border-transparent">
                        <div className="w-16 h-16 mb-2 flex items-center justify-center">
                            <img src={skin.iconUrl} alt={skin.name[user.language]} className="w-full h-full object-contain" {...(isExternal(skin.iconUrl) && { crossOrigin: 'anonymous' })} />
                        </div>
                        <p className="text-xs font-bold leading-tight">{skin.name[user.language]}</p>
                    </div>
                ))}
                 {unlockedSkins.length === 0 && <p className="col-span-full text-center py-8 text-[var(--text-secondary)]">{t('market_no_skins_to_sell')}</p>}
            </div>
        </>
    );
};

const CreditsTab = ({ playerState, showNotification, gameApi }: {
    playerState: PlayerState;
    showNotification: (message: string, type?: 'success' | 'error') => void;
    gameApi: GameApi;
}) => {
    const t = useTranslation();
    const [withdrawalAmount, setWithdrawalAmount] = useState('');
    const [history, setHistory] = useState<WithdrawalRequest[]>([]);
    const isWalletConnected = !!playerState.tonWalletAddress;

    useEffect(() => {
        gameApi.fetchMyWithdrawalRequests().then(data => setHistory(data || []));
    }, [gameApi, playerState.marketCredits]); // Refetch on credit change too

    const handleRequest = async () => {
        const amount = Number(withdrawalAmount);
        if (isNaN(amount) || amount <= 0) {
            showNotification(t('market_invalid_amount'), 'error');
            return;
        }
        const result = await gameApi.requestWithdrawal(amount);
        if(result?.error) showNotification(result.error, 'error');
        else {
            showNotification(t('market_withdrawal_requested'), 'success');
            setWithdrawalAmount('');
        }
    };
    
    const getStatusBadge = (status: string) => {
         const statusKey = `status_${status}`;
         switch(status) {
            case 'approved': return <span className="text-xs font-bold text-green-400">{t(statusKey)}</span>;
            case 'rejected': return <span className="text-xs font-bold text-red-400">{t(statusKey)}</span>;
            case 'pending':
            default:
                return <span className="text-xs font-bold text-yellow-400">{t(statusKey)}</span>;
        }
    };

    return (
        <div className="space-y-4">
            <div className="card-glow p-4 rounded-xl text-center">
                <p className="text-[var(--text-secondary)] text-lg">{t('market_credits')}</p>
                <p className="text-5xl font-display my-1">{formatNumber(playerState.marketCredits || 0)}</p>
            </div>
            
             {!isWalletConnected && (
                <div className="card-glow p-4 rounded-xl text-center bg-blue-900/30 border border-blue-500/50">
                    <p className="text-sm text-blue-200">{t('connect_in_airdrop_prompt')}</p>
                </div>
            )}
             
             <div className="card-glow p-4 rounded-xl">
                <h3 className="font-bold mb-2">{t('request_withdrawal')}</h3>
                <div className="flex space-x-2">
                     <input type="number" value={withdrawalAmount} onChange={e => setWithdrawalAmount(e.target.value)} placeholder={t('amount')} className="w-full input-field text-sm" disabled={!isWalletConnected} />
                     <button onClick={handleRequest} className="interactive-button rounded-lg font-bold px-4 text-sm" disabled={!isWalletConnected}>{t('request')}</button>
                </div>
             </div>

             <div className="card-glow p-4 rounded-xl">
                <h3 className="font-bold mb-2">{t('withdrawal_history')}</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                    {history.length > 0 ? history.map(req => (
                        <div key={req.id} className="bg-slate-900/50 shadow-inner rounded-md p-2 flex justify-between items-center text-sm">
                            <div>
                                <p className="font-bold">{formatNumber(req.amount_credits)} {t('market_credits')}</p>
                                <p className="text-xs text-[var(--text-secondary)]">{new Date(req.created_at).toLocaleString()}</p>
                            </div>
                            {getStatusBadge(req.status)}
                        </div>
                    )) : <p className="text-center text-sm text-[var(--text-secondary)]">{t('market_no_history')}</p>}
                </div>
             </div>
        </div>
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
    const [marketTab, setMarketTab] = useState<'buy' | 'sell' | 'credits'>('buy');

    const tabProps = { user, playerState, config, showNotification, gameApi };

    return (
        <div className="w-full">
            <div className="bg-slate-800/50 shadow-inner rounded-xl p-1 flex justify-around items-center gap-1 border border-slate-700 mb-4">
                <button onClick={() => setMarketTab('buy')} className={`flex-1 font-bold py-2 text-sm rounded-lg ${marketTab === 'buy' ? 'bg-slate-900 text-[var(--accent-color)]' : 'text-slate-300'}`}>{t('market_buy')}</button>
                <button onClick={() => setMarketTab('sell')} className={`flex-1 font-bold py-2 text-sm rounded-lg ${marketTab === 'sell' ? 'bg-slate-900 text-[var(--accent-color)]' : 'text-slate-300'}`}>{t('market_sell')}</button>
                <button onClick={() => setMarketTab('credits')} className={`flex-1 font-bold py-2 text-sm rounded-lg ${marketTab === 'credits' ? 'bg-slate-900 text-[var(--accent-color)]' : 'text-slate-300'}`}>{t('market_credits')}</button>
            </div>
            {marketTab === 'buy' && <BuyTab {...tabProps} />}
            {marketTab === 'sell' && <SellTab {...tabProps} />}
            {marketTab === 'credits' && <CreditsTab {...tabProps} />}
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

interface ProfileScreenProps {
  playerState: PlayerState;
  user: User;
  config: GameConfig;
  onBuyBoost: (boost: Boost) => void;
  onSetSkin: (skinId: string) => void;
  onOpenCoinLootbox: (boxType: 'coin') => void;
  onPurchaseStarLootbox: (boxType: 'star') => void;
  handleMetaTap: (targetId: string) => void;
  onOpenGlitchCodesModal: () => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
  gameApi: GameApi;
}

const ProfileScreen = ({ playerState, user, config, onBuyBoost, onSetSkin, onOpenCoinLootbox, onPurchaseStarLootbox, handleMetaTap, onOpenGlitchCodesModal, showNotification, gameApi } : ProfileScreenProps) => {
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

    return (
        <div className="flex flex-col h-full text-white items-center">
            <div className="w-full max-w-md sticky top-0 bg-[var(--bg-color)] pt-4 px-4 z-10">
                <h1 className="text-3xl font-display text-center mb-4 cursor-pointer" onClick={() => handleMetaTap('profile-title')}>{t('profile')}</h1>
                <div className="bg-slate-800/50 shadow-inner rounded-xl p-1 flex flex-nowrap justify-around items-center gap-1 border border-slate-700">
                    <ProfileTabButton label={t('sub_contacts')} iconUrl={config.uiIcons.profile_tabs.contacts} isActive={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} />
                    <ProfileTabButton label={t('sub_boosts')} iconUrl={config.uiIcons.profile_tabs.boosts} isActive={activeTab === 'boosts'} onClick={() => setActiveTab('boosts')} />
                    <ProfileTabButton label={t('sub_disguise')} iconUrl={config.uiIcons.profile_tabs.skins} isActive={activeTab === 'skins'} onClick={() => setActiveTab('skins')} />
                    <ProfileTabButton label={t('sub_market')} iconUrl={config.uiIcons.profile_tabs.market} isActive={activeTab === 'market'} onClick={() => setActiveTab('market')} />
                    <ProfileTabButton label={t('sub_cell')} iconUrl={config.uiIcons.profile_tabs.cell} isActive={activeTab === 'cell'} onClick={() => setActiveTab('cell')} />
                </div>
            </div>
            
            <div className="w-full max-w-md flex-grow overflow-y-auto no-scrollbar pt-4 flex justify-center px-4">
                {activeTab === 'contacts' && <ContactsContent {...tabProps} />}
                {activeTab === 'boosts' && <BoostScreen playerState={playerState} boosts={config.boosts} onBuyBoost={onBuyBoost} lang={user.language} uiIcons={config.uiIcons} />}
                {activeTab === 'skins' && <SkinsContent {...tabProps} />}
                {activeTab === 'market' && <MarketContent {...tabProps} />}
                {activeTab === 'cell' && <CellScreen />}
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
        // Airdrop tasks are always one-time and use the special list.
        isCompleted = playerState.completedSpecialTaskIds.includes(task.id);
    } else {
        // This is a task from the "Directives" (Missions) screen.
        if (task.type === 'taps') {
            // Tap-based tasks are daily and use the daily list.
            isCompleted = playerState.completedDailyTaskIds.includes(task.id);
        } else {
            // Other directives (like 'telegram_join') are one-time and use the special list.
            isCompleted = playerState.completedSpecialTaskIds.includes(task.id);
        }
    }
    
    const isPurchased = isAirdropTask ? playerState.purchasedSpecialTaskIds.includes(task.id) : true;
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

const MissionsScreen: React.FC<{
    tasks: DailyTask[];
    playerState: PlayerState;
    onClaim: (task: DailyTask | SpecialTask) => void;
    lang: Language;
    startedTasks: Set<string>;
    uiIcons: UiIcons;
}> = ({ tasks, playerState, onClaim, lang, startedTasks, uiIcons }) => {
    const t = useTranslation();
    return (
        <div className="flex flex-col h-full text-white pt-4 px-4">
            <h1 className="text-3xl font-display text-center mb-6 flex-shrink-0">{t('missions')}</h1>
            <div className="flex-grow overflow-y-auto no-scrollbar -mx-4 px-4">
                <div className="flex flex-col space-y-4 pb-4">
                    {tasks.map(task => (
                        <div key={task.id}>
                            <TaskCard
                                task={task}
                                playerState={playerState}
                                onClaim={onClaim}
                                lang={lang}
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

const WalletTaskCard = ({ playerState, onConnect, isReady, lang }: {
    playerState: PlayerState;
    onConnect: () => void;
    isReady: boolean;
    lang: Language;
}) => {
    const t = useTranslation();
    const isConnected = !!playerState.tonWalletAddress;
    const truncateAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

    if (isConnected) {
        return (
             <div className="card-glow bg-green-900/30 border border-green-500/50 rounded-2xl p-3 flex items-center space-x-4">
                <div className="bg-slate-900/50 shadow-inner rounded-lg p-1 w-14 h-14 flex-shrink-0 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="flex-grow min-w-0">
                    <p className="text-white font-semibold">{t('wallet_connected')}</p>
                    <p className="text-sm text-slate-300 truncate font-mono">{truncateAddress(playerState.tonWalletAddress!)}</p>
                </div>
                <button onClick={onConnect} disabled={!isReady} className="interactive-button rounded-lg font-bold py-2 px-3 text-sm flex-shrink-0">
                    {t('change')}
                </button>
            </div>
        );
    }

    return (
        <div className="card-glow bg-blue-900/30 border border-blue-500/50 rounded-2xl p-3 flex flex-col space-y-3">
             <div className="flex items-start space-x-3">
                <div className="bg-slate-900/50 shadow-inner rounded-lg p-1 w-14 h-14 flex-shrink-0">
                    <img src="https://api.iconify.design/ph/wallet-bold.svg?color=white" alt="wallet" className="w-full h-full object-contain" />
                </div>
                <div className="flex-grow min-w-0">
                    <p className="text-white font-semibold">{t('connect_your_ton_wallet')}</p>
                    <p className="text-slate-300 text-xs mt-1">{t('connect_wallet_task_desc')}</p>
                </div>
            </div>
            <button
                onClick={onConnect}
                disabled={!isReady}
                className="w-full interactive-button bg-blue-600 hover:bg-blue-500 border-blue-500 rounded-lg font-bold py-3 text-lg disabled:bg-slate-700 disabled:border-slate-600"
            >
                {isReady ? t('connect_wallet') : t('loading')}
            </button>
        </div>
    );
};

const AirdropScreen: React.FC<{
    specialTasks: SpecialTask[];
    playerState: PlayerState;
    onClaim: (task: DailyTask | SpecialTask) => void;
    onPurchase: (task: SpecialTask) => void;
    lang: Language;
    startedTasks: Set<string>;
    uiIcons: UiIcons;
    isTgReady: boolean;
    onConnectWallet: () => void;
}> = ({ specialTasks, playerState, onClaim, onPurchase, lang, startedTasks, uiIcons, isTgReady, onConnectWallet }) => {
    const t = useTranslation();
    return (
        <div className="flex flex-col h-full text-white pt-4 px-4">
            <h1 className="text-3xl font-display text-center mb-2 flex-shrink-0">{t('airdrop_tasks')}</h1>
            <p className="text-center text-[var(--text-secondary)] mb-6 flex-shrink-0">{t('airdrop_description')}</p>
            <div className="flex-grow overflow-y-auto no-scrollbar -mx-4 px-4">
                <div className="flex flex-col space-y-4 pb-4">
                    <WalletTaskCard 
                        playerState={playerState}
                        onConnect={onConnectWallet}
                        isReady={isTgReady}
                        lang={lang}
                    />
                    {specialTasks.map(task => (
                       <div key={task.id}>
                            <TaskCard
                                task={task}
                                playerState={playerState}
                                onClaim={onClaim}
                                onPurchase={onPurchase}
                                lang={lang}
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
                                <p className="font-bold text-lg text-white">{currentLeague?.name[user.language] || 'N/A'}</p>
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
    const iconUrl = item.iconUrl || item.imageUrl;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2500] flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-glow bg-slate-800 rounded-2xl w-full max-w-sm flex flex-col p-6 items-center" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-4">{title}!</h2>
                <div className="w-32 h-32 mb-4 bg-slate-900/50 shadow-inner rounded-2xl p-2 flex items-center justify-center">
                    <img src={iconUrl} alt={item.name[lang]} className="w-full h-full object-contain" {...(isExternal(iconUrl) && { crossOrigin: 'anonymous' })} />
                </div>
                <p className="text-lg font-bold text-white mb-2">{item.name[lang]}</p>
                {isLootboxItem && 'profitBoostPercent' in item && item.profitBoostPercent > 0 && <p className="text-[var(--accent-color)]">+{item.profitBoostPercent}% {t('profit_boost')}</p>}
                {isLootboxItem && 'profitPerHour' in item && <p className="text-[var(--accent-color)]">+{formatNumber(item.profitPerHour)}/hr</p>}
                
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


const MainApp: React.FC = () => {
  const { user, isGlitching, setIsGlitching } = useAuth();
  const gameApi = useGame();
  const { 
      playerState, config, handleTap, buyUpgrade, allUpgrades, currentLeague, 
      claimTaskReward, buyBoost, purchaseSpecialTask, completeSpecialTask,
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
  
  const [activeScreen, setActiveScreen] = React.useState<Screen>('exchange');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const t = useTranslation();
  const [startedTasks, setStartedTasks] = useState<Set<string>>(new Set());
  const [secretCodeTask, setSecretCodeTask] = useState<DailyTask | SpecialTask | null>(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(window.Telegram?.WebApp?.isExpanded ?? false);
  const [isTgReady, setIsTgReady] = useState(false);

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
  const [hasPlayed, setHasPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleGlitchEffectClose = () => {
    if (activeGlitchEvent?.isFinal) {
        setIsFinalScene(true);
    }
    setActiveGlitchEvent(null);
  };

  const handleFinalSceneComplete = useCallback(() => {
    setShowVideo(true);
  }, []);

  useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        const handleViewportChange = () => {
            setIsFullScreen(tg.isExpanded);
        };
        
        const timer = setTimeout(() => {
            setIsTgReady(true);
        }, 500); // Give the TG script a moment to initialize fully

        tg.onEvent('viewportChanged', handleViewportChange);
        return () => {
            tg.offEvent('viewportChanged', handleViewportChange);
            clearTimeout(timer);
        };
    }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsAppReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);
  
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
        const newMutedState = !prev;
        localStorage.setItem('isMuted', String(newMutedState));
        if (audioRef.current) {
            audioRef.current.muted = newMutedState;
        }
        return newMutedState;
    });
  }, []);

  const handleTapWithAudio = useCallback(() => {
      const tapValue = handleTap();
      if (!hasPlayed && audioRef.current && config?.backgroundAudioUrl) {
          audioRef.current.play().catch(e => console.error("Audio play failed:", e));
          setHasPlayed(true);
      }
      return tapValue;
  }, [handleTap, hasPlayed, config?.backgroundAudioUrl]);

  useEffect(() => {
    if (isGlitching) {
        const timer = setTimeout(() => {
            setIsGlitching(false);
        }, 2000);
        return () => clearTimeout(timer);
    }
  }, [isGlitching, setIsGlitching]);

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
        setNotification(prev => (prev?.message === message ? null : prev));
    }, 3000);
  }, []);

  const handleBuyUpgrade = async (upgradeId: string) => {
    const result = await buyUpgrade(upgradeId);
    if(result) {
        const upgrade = allUpgrades.find(u => u.id === upgradeId);
        showNotification(`${upgrade?.name?.[user.language]} Lvl ${result.upgrades[upgradeId]}`);
    }
  };
  
  const handleBuyBoost = async (boost: Boost) => {
    const result = await buyBoost(boost);
    if (result.player) {
        showNotification(t('boost_purchased'), 'success');
        if (boost.id === 'boost_turbo_mode') {
            setActiveScreen('exchange');
        }
    } else if (result.error) {
        showNotification(result.error, 'error');
    }
  };

  const processTaskCompletion = (task: DailyTask | SpecialTask, result: { player?: PlayerState, error?: string }) => {
      if (result.player) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          const rewardText = task.reward?.type === 'profit'
              ? `+${formatNumber(task.reward.amount)}/hr <img src="${config.uiIcons.energy}" class="w-4 h-4 inline-block -mt-1"/>`
              : `+${formatNumber(task.reward.amount)} <img src="${config.uiIcons.coin}" class="w-4 h-4 inline-block -mt-1"/>`;
          showNotification(`${task.name?.[user.language]} ${t('task_completed')} <span class="whitespace-nowrap">${rewardText}</span>`, 'success');
          
          setStartedTasks(prev => {
              const newSet = new Set(prev);
              newSet.delete(task.id);
              return newSet;
          });
      } else if (result.error) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
          showNotification(result.error, 'error');
      }
      return result;
  };

  const handleClaimTask = async (task: DailyTask | SpecialTask) => {
    const isExternalLinkTask = !!task.url;
    const isTaskStarted = startedTasks.has(task.id);

    if (isExternalLinkTask && !isTaskStarted) {
        if (task.url.startsWith('https://t.me/')) {
            window.Telegram.WebApp.openTelegramLink(task.url);
        } else {
            window.Telegram.WebApp.openLink(task.url);
        }
        setStartedTasks(prev => new Set(prev).add(task.id));
        return;
    }
    
    if (task.type === 'video_code') {
        setSecretCodeTask(task);
        return;
    }
    
    if ('isOneTime' in task) { // Special Task
      const result = await completeSpecialTask(task);
      processTaskCompletion(task, result);
    } else { // Daily Task
      const result = await claimTaskReward(task as DailyTask);
      processTaskCompletion(task, result);
    }
  };

  const handleClaimCipher = async (cipher: string): Promise<boolean> => {
    const result = await claimDailyCipher(cipher);
    if (result.player) {
        const rewardAmount = result.reward || 0;
        if (rewardAmount > 0) {
            showNotification(`${t('cipher_solved')} +${formatNumber(rewardAmount)}`, 'success');
        } else {
            showNotification(t('cipher_solved'), 'success');
        }
        return true;
    } else if (result.error) {
        showNotification(result.error, 'error');
    }
    return false;
  };
  
  const handleClaimGlitchCode = async (code: string): Promise<boolean> => {
    const result = await claimGlitchCode(code);
    if (result.player && result.reward) {
        // The useEffect will catch the new discovery and show the visual effect.
        // This function just needs to show the notification toast.
        const rewardText = result.reward.type === 'profit'
            ? `+${formatNumber(result.reward.amount)}/hr`
            : `+${formatNumber(result.reward.amount)}`;
        showNotification(`${t('glitch_code_claimed')} ${rewardText}`, 'success');
        setIsGlitchCodesModalOpen(false); // Close modal on success
        return true;
    } else if (result.error) {
        showNotification(result.error, 'error');
    }
    return false;
  };

  const handleClaimCombo = async () => {
    const result = await claimDailyCombo();
    if (result.player && result.reward) {
        showNotification(`${t('combo_collected')} +${formatNumber(result.reward)}`, 'success');
    } else if (result.error) {
        showNotification(result.error, 'error');
    }
  };

  const handleOpenCoinLootbox = async (boxType: 'coin') => {
      const result = await openCoinLootbox(boxType);
      if(result.wonItem) {
          setPurchaseResult({type: 'lootbox', item: result.wonItem });
      } else if (result.error) {
          showNotification(result.error, 'error');
      }
  };
  
  const handlePurchaseStarLootbox = async (boxType: 'star') => {
      const result = await purchaseLootboxWithStars(boxType);
      if (result?.error) {
          showNotification(result.error, 'error');
      }
  };
  
  const handleSetSkin = async (skinId: string) => {
      await setSkin(skinId);
      showNotification(t('selected'), 'success');
  };
  
  const handleConnectWallet = useCallback(() => {
        if (window.Telegram?.WebApp?.requestWalletAddress) {
            window.Telegram.WebApp.requestWalletAddress((address: string | false) => {
                if (address) {
                    gameApi.connectWallet(address).then(result => {
                        if (result?.error) {
                            showNotification(result.error, 'error');
                        } else {
                            showNotification(t('market_wallet_connected'), 'success');
                        }
                    });
                } else {
                    showNotification(t('wallet_connection_cancelled'), 'error');
                }
            });
        } else {
            showNotification(t('wallet_feature_unavailable'), 'error');
        }
    }, [gameApi, showNotification, t]);


  const handleEnergyClick = () => showNotification(t('tooltip_energy'), 'success');
  const handleSuspicionClick = () => showNotification(t('tooltip_suspicion'), 'success');

  if (!isAppReady || !user || !playerState || !config) {
    return <LoadingScreen imageUrl={config?.loadingScreenImageUrl} />;
  }
  
  const renderScreen = () => {
    switch (activeScreen) {
      case 'exchange':
        return <ExchangeScreen playerState={playerState} currentLeague={currentLeague} onTap={handleTapWithAudio} user={user} onClaimCipher={handleClaimCipher} config={config} onOpenLeaderboard={() => setIsLeaderboardOpen(true)} isTurboActive={isTurboActive} effectiveMaxEnergy={effectiveMaxEnergy} effectiveMaxSuspicion={effectiveMaxSuspicion} onEnergyClick={handleEnergyClick} onSuspicionClick={handleSuspicionClick} isMuted={isMuted} toggleMute={toggleMute} handleMetaTap={handleMetaTap} />;
      case 'mine':
        return <MineScreen upgrades={allUpgrades} balance={playerState.balance} onBuyUpgrade={handleBuyUpgrade} lang={user.language} playerState={playerState} config={config} onClaimCombo={handleClaimCombo} uiIcons={config.uiIcons} handleMetaTap={handleMetaTap} />;
      case 'missions':
        return <MissionsScreen
                    tasks={config.tasks}
                    playerState={playerState}
                    onClaim={handleClaimTask}
                    lang={user.language}
                    startedTasks={startedTasks}
                    uiIcons={config.uiIcons}
                />;
       case 'airdrop':
        return <AirdropScreen
                    specialTasks={config.specialTasks}
                    playerState={playerState}
                    onClaim={handleClaimTask}
                    onPurchase={purchaseSpecialTask}
                    lang={user.language}
                    startedTasks={startedTasks}
                    uiIcons={config.uiIcons}
                    isTgReady={isTgReady}
                    onConnectWallet={handleConnectWallet}
                />;
      case 'profile':
        return <ProfileScreen
                    playerState={playerState}
                    user={user}
                    config={config}
                    onBuyBoost={handleBuyBoost}
                    onSetSkin={handleSetSkin}
                    onOpenCoinLootbox={handleOpenCoinLootbox}
                    onPurchaseStarLootbox={handlePurchaseStarLootbox}
                    handleMetaTap={handleMetaTap}
                    onOpenGlitchCodesModal={() => setIsGlitchCodesModalOpen(true)}
                    showNotification={showNotification}
                    gameApi={gameApi}
                />;
      default:
        return <ExchangeScreen playerState={playerState} currentLeague={currentLeague} onTap={handleTapWithAudio} user={user} onClaimCipher={handleClaimCipher} config={config} onOpenLeaderboard={() => setIsLeaderboardOpen(true)} isTurboActive={isTurboActive} effectiveMaxEnergy={effectiveMaxEnergy} effectiveMaxSuspicion={effectiveMaxSuspicion} onEnergyClick={handleEnergyClick} onSuspicionClick={handleSuspicionClick} isMuted={isMuted} toggleMute={toggleMute} handleMetaTap={handleMetaTap} />;
    }
  };

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col prevent-select transition-all duration-300 ${isFullScreen ? 'pt-4' : ''}`}>
      {isFinalScene && !showVideo && <FinalSystemBreachEffect onComplete={handleFinalSceneComplete} />}
      {showVideo && config?.finalVideoUrl && <FinalVideoPlayer videoUrl={config.finalVideoUrl} onEnd={() => { setShowVideo(false); setIsFinalScene(false); }} />}
      
      {config?.backgroundAudioUrl && (
        <audio ref={audioRef} src={config.backgroundAudioUrl} loop muted={isMuted} playsInline />
      )}
      {isGlitching && <GlitchEffect />}
      {activeGlitchEvent && <GlitchEffect message={activeGlitchEvent.message[user.language]} code={activeGlitchEvent.code} onClose={handleGlitchEffectClose} />}
      {(systemMessage) && <PenaltyModal message={systemMessage} onClose={() => setSystemMessage('')} />}

      {isLeaderboardOpen && <LeaderboardScreen onClose={() => setIsLeaderboardOpen(false)} getLeaderboard={getLeaderboard} user={user} currentLeague={currentLeague} />}
      {secretCodeTask && <SecretCodeModal task={secretCodeTask} lang={user.language} onClose={() => setSecretCodeTask(null)} onSubmit={async (code) => {
           processTaskCompletion(secretCodeTask, 'isOneTime' in secretCodeTask ? await completeSpecialTask(secretCodeTask, code) : await claimTaskReward(secretCodeTask, code));
           setSecretCodeTask(null);
        }} />
      }
      {isGlitchCodesModalOpen && <GlitchCodesModal isOpen={isGlitchCodesModalOpen} onClose={() => setIsGlitchCodesModalOpen(false)} onSubmit={handleClaimGlitchCode} playerState={playerState} config={config} lang={user.language} />}
      {purchaseResult && <PurchaseResultModal result={purchaseResult} onClose={() => setPurchaseResult(null)} lang={user.language} uiIcons={config.uiIcons} />}
      <NotificationToast notification={notification} />
      
      <div id="main-content-wrapper" className={`flex-grow min-h-0 flex flex-col`}>
        <main className="flex-grow min-h-0 overflow-y-auto">
            {renderScreen()}
        </main>
        <nav className="flex-shrink-0 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700">
            <div className="grid grid-cols-5 justify-around items-start max-w-xl mx-auto">
            <NavItem screen="exchange" label={t('exchange')} iconUrl={config.uiIcons.nav.exchange} active={activeScreen === 'exchange'} setActiveScreen={setActiveScreen} />
            <NavItem screen="mine" label={t('mine')} iconUrl={config.uiIcons.nav.mine} active={activeScreen === 'mine'} setActiveScreen={setActiveScreen}/>
            <NavItem screen="missions" label={t('missions')} iconUrl={config.uiIcons.nav.missions} active={activeScreen === 'missions'} setActiveScreen={setActiveScreen} />
            <NavItem screen="airdrop" label={t('airdrop')} iconUrl={config.uiIcons.nav.airdrop} active={activeScreen === 'airdrop'} setActiveScreen={setActiveScreen}/>
            <NavItem screen="profile" label={t('profile')} iconUrl={config.uiIcons.nav.profile} active={activeScreen === 'profile'} setActiveScreen={setActiveScreen}/>
            </div>
        </nav>
      </div>

       <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; } 
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .prevent-select { -webkit-touch-callout: none; -webkit-user-select: none; -khtml-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
        @keyframes floatUp {
          0% { transform: translateY(0) translateX(var(--x-offset)) scale(1); opacity: 1; }
          100% { transform: translateY(-60px) translateX(var(--x-offset)) scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <AppContainer />
  </AuthProvider>
);

export default App;