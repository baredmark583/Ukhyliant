import React, { useState, useEffect, useCallback, useRef } from 'https://esm.sh/react';
import { useGame, useAuth, useTranslation, AuthProvider } from './hooks/useGameLogic';
import ExchangeScreen from './sections/Exchange';
import MineScreen from './sections/Mine';
import BoostScreen from './sections/Boost';
import CellScreen from './sections/Cell';
import { REFERRAL_BONUS, TELEGRAM_BOT_NAME, MINI_APP_NAME } from './constants';
import { DailyTask, GameConfig, Language, LeaderboardPlayer, SpecialTask, PlayerState, User, Boost, CoinSkin, League, UiIcons, Cell, GlitchEvent } from './types';
import NotificationToast from './components/NotificationToast';
import SecretCodeModal from './components/SecretCodeModal';

type Screen = 'exchange' | 'mine' | 'missions' | 'airdrop' | 'profile';
type ProfileTab = 'contacts' | 'boosts' | 'skins' | 'market' | 'cell';

// Add html2canvas to the global scope for TypeScript
declare const html2canvas: any;

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

// --- Sound and Visual Effects Helpers (place outside the component) ---
let audioCtx: AudioContext | null = null;
const getAudioContext = () => {
    if (typeof window !== 'undefined' && !audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};
const playImpact = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type='sawtooth'; o.frequency.value = 110; g.gain.value = 1;
    o.connect(g); g.connect(ctx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    o.stop(ctx.currentTime + 0.13);
};
const playShatter = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const len = 1 * ctx.sampleRate; const buf = ctx.createBuffer(1, len, ctx.sampleRate); const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-4 * i / len);
    const source = ctx.createBufferSource(); source.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
    source.connect(hp); hp.connect(ctx.destination); source.playbackRate.value = 1.6; source.start();
};
const flashAt = (x: number, y: number) => {
    const stage = document.getElementById('shatter-stage');
    if (!stage) return;
    const g = document.createElement('div');
    g.style.cssText = `position:absolute;left:${x - 300}px;top:${y - 300}px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle at center, rgba(255,255,255,0.95), rgba(255,255,255,0.0) 40%);z-index:2005;pointer-events:none;opacity:0.9;`;
    stage.appendChild(g);
    setTimeout(() => { g.style.transition = 'opacity 600ms'; g.style.opacity = '0'; setTimeout(() => g.remove(), 700); }, 80);
};

const _drawCracksAnimated = (crackCtx: CanvasRenderingContext2D, crackCanvas: HTMLCanvasElement, cx: number, cy: number, duration = 1000) => {
    const t0 = performance.now();
    crackCtx.clearRect(0,0,crackCanvas.width, crackCanvas.height);

    const primaryCount = 12 + Math.floor(Math.random()*12);
    const branchProbability = 0.55;

    interface CrackPoint { x: number; y: number; }
    interface CrackPath { points: CrackPoint[]; width: number; depth: number; }
    const paths: CrackPath[] = [];

    for(let i=0;i<primaryCount;i++){
      const baseAngle = i * (Math.PI*2/primaryCount) + (Math.random()-0.5)*0.3;
      const baseLen = 120 + Math.random()*520;
      const segments = 8 + Math.floor(Math.random()*8);
      const points: CrackPoint[] = [];
      for(let s=0;s<=segments;s++){
        const t = s/segments;
        const r = baseLen * (0.12 + 0.88 * t);
        const jitter = (1 - t) * 28;
        const angle = baseAngle + (Math.random()-0.5) * 0.18;
        const px = cx + Math.cos(angle) * r + (Math.random()-0.5)*jitter;
        const py = cy + Math.sin(angle) * r + (Math.random()-0.5)*jitter;
        points.push({x:px,y:py});
      }
      paths.push({points, width: 1.6 + Math.random()*2.2, depth:0});
    }

    const microCount = 18 + Math.floor(Math.random()*12);
    const concentricRings: number[] = [];
    for(let i=0;i<microCount;i++){
      const ang = Math.random()*Math.PI*2;
      const p = {x: cx + Math.cos(ang)* (10 + Math.random()*30), y: cy + Math.sin(ang)*(10 + Math.random()*30)};
      paths.push({points: [ {x:cx,y:cy}, p ], width: 0.8 + Math.random()*0.8, depth:0});
    }
    for(let r=1;r<=3;r++){
      const rad = 12 * r + Math.random()*18;
      concentricRings.push(rad);
    }

    function generateBranches(){
      const newPaths: CrackPath[] = [];
      for(const p of paths){
        for(let i=1;i<p.points.length-1;i++){
          if(Math.random() < branchProbability * (1 - i/p.points.length)){
            const origin = p.points[i];
            const angle = Math.atan2(origin.y - cy, origin.x - cx) + (Math.random()-0.5)*1.6;
            const len = (30 + Math.random()*220) * (0.65 + (p.depth*0.15));
            const segs = 3 + Math.floor(Math.random()*6);
            const branchPts: CrackPoint[] = [];
            for(let s=0;s<=segs;s++){
              const t = s/segs;
              const rlen = len * (0.12 + 0.88*t);
              const j = (1 - t) * 18;
              const bx = origin.x + Math.cos(angle) * rlen + (Math.random()-0.5)*j;
              const by = origin.y + Math.sin(angle) * rlen + (Math.random()-0.5)*j;
              branchPts.push({x:bx,y:by});
            }
            newPaths.push({points: [origin, ...branchPts], width: Math.max(0.5, p.width*0.65), depth: p.depth+1});
          }
        }
      }
      for(const np of newPaths) paths.push(np);
    }

    generateBranches(); generateBranches();

    const animData = paths.map((p,i)=>({p, start: 0 + Math.random()*120, dur: 300 + Math.random()*400}));

    function drawPathPartial(points: CrackPoint[], prog: number, width: number){
      if(points.length<2) return;
      crackCtx.save();
      crackCtx.lineCap = 'round';
      crackCtx.beginPath();
      crackCtx.moveTo(points[0].x, points[0].y);
      const total = (points.length-1);
      const maxIndex = Math.floor(prog * total);
      for(let i=1; i<=maxIndex; i++){
        crackCtx.lineTo(points[i].x, points[i].y);
      }
      if(maxIndex < total){
        const t = prog*total - maxIndex;
        const A = points[maxIndex]; const B = points[maxIndex+1];
        const ix = A.x + (B.x - A.x)*t; const iy = A.y + (B.y - A.y)*t;
        crackCtx.lineTo(ix, iy);
      }
      crackCtx.lineWidth = width * 1.1;
      crackCtx.strokeStyle = 'rgba(10,12,18,0.95)';
      crackCtx.shadowColor = 'rgba(0,0,0,0.25)'; crackCtx.shadowBlur = 2;
      crackCtx.stroke();

      crackCtx.beginPath(); crackCtx.moveTo(points[0].x, points[0].y);
      for(let i=1; i<=maxIndex; i++) crackCtx.lineTo(points[i].x, points[i].y);
      if(maxIndex < total){ const t = prog*total - maxIndex; const A = points[maxIndex]; const B = points[maxIndex+1]; crackCtx.lineTo(A.x + (B.x-A.x)*t, A.y + (B.y-A.y)*t); }
      crackCtx.lineWidth = Math.max(0.4, width*0.45);
      crackCtx.strokeStyle = 'rgba(255,255,255,0.55)';
      crackCtx.globalCompositeOperation = 'lighter';
      crackCtx.stroke(); crackCtx.globalCompositeOperation = 'source-over';
      crackCtx.restore();
    }

    function drawConcentric(prog: number){
      for(const rad of concentricRings){
        const localRadius = rad * (0.9 + Math.random()*0.5);
        const steps = 36;
        crackCtx.save(); crackCtx.beginPath();
        for(let i=0;i<=steps;i++){
          const t = i/steps;
          const ang = t * Math.PI*2;
          const rj = localRadius + (Math.random()-0.5) * 6;
          const px = cx + Math.cos(ang) * rj * (0.3 + prog);
          const py = cy + Math.sin(ang) * rj * (0.3 + prog);
          if(i===0) crackCtx.moveTo(px,py); else crackCtx.lineTo(px,py);
        }
        crackCtx.lineWidth = 0.6; crackCtx.strokeStyle = 'rgba(18,20,28,0.7)'; crackCtx.stroke();
        crackCtx.restore();
      }
    }

    function frame(now: number){
      const globalP = Math.min(1, (now - t0) / (duration + 200));
      crackCtx.clearRect(0,0,crackCanvas.width, crackCanvas.height);
      drawConcentric(globalP);

      for(const ad of animData){
        const localT = Math.max(0, Math.min(1, (now - t0 - ad.start) / ad.dur));
        drawPathPartial(ad.p.points, localT, ad.p.width);
      }

      if(globalP > 0.35){
        for(let i=0;i<10;i++){
          const ang = Math.random()*Math.PI*2; const r = Math.random()*45;
          crackCtx.fillStyle = 'rgba(8,10,12,' + (0.4*Math.random()) + ')';
          crackCtx.beginPath(); crackCtx.arc(cx + Math.cos(ang)*r, cy + Math.sin(ang)*r, 0.6 + Math.random()*1.8, 0, Math.PI*2); crackCtx.fill();
        }
      }

      if(globalP < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
};

const makeShardsFromImage = (imgCanvas: HTMLCanvasElement, impactX: number, impactY: number, cols=22, rows=14): any[] => {
    const w = imgCanvas.width, h = imgCanvas.height;
    const cellW = Math.ceil(w/cols), cellH = Math.ceil(h/rows);
    const shards: any[] = [];
    for (let r=0;r<rows;r++){
      for (let c=0;c<cols;c++){
        const x0 = c*cellW, y0 = r*cellH;
        const x1 = Math.min(w,(c+1)*cellW), y1 = Math.min(h,(r+1)*cellH);
        const jitter = 8;
        const p1 = {x: x0 + (Math.random()-0.5)*jitter, y: y0 + (Math.random()-0.5)*jitter};
        const p2 = {x: x1 + (Math.random()-0.5)*jitter, y: y0 + (Math.random()-0.5)*jitter};
        const p3 = {x: x1 + (Math.random()-0.5)*jitter, y: y1 + (Math.random()-0.5)*jitter};
        const p4 = {x: x0 + (Math.random()-0.5)*jitter, y: y1 + (Math.random()-0.5)*jitter};
        const triA = [p1,p2,p3]; const triB = [p1,p3,p4];
        [triA,triB].forEach(poly => {
          const minX = Math.floor(Math.min(...poly.map(p=>p.x))); const minY = Math.floor(Math.min(...poly.map(p=>p.y)));
          const maxX = Math.ceil(Math.max(...poly.map(p=>p.x))); const maxY = Math.ceil(Math.max(...poly.map(p=>p.y)));
          const pw = Math.max(2, maxX - minX); const ph = Math.max(2, maxY - minY);
          const sCanvas = document.createElement('canvas'); sCanvas.width = pw; sCanvas.height = ph;
          sCanvas.style.position = 'absolute'; sCanvas.style.left = (minX) + 'px'; sCanvas.style.top = (minY) + 'px';
          sCanvas.style.willChange = 'transform, opacity';
          const sCtx = sCanvas.getContext('2d');
          if(!sCtx) return;
          sCtx.save(); sCtx.beginPath();
          poly.forEach((pt,i)=>{ const tx = pt.x - minX; const ty = pt.y - minY; if(i===0) sCtx.moveTo(tx,ty); else sCtx.lineTo(tx,ty); });
          sCtx.closePath(); sCtx.clip(); sCtx.drawImage(imgCanvas, -minX, -minY); sCtx.restore();
          const centroid = poly.reduce((acc,p)=>({x:acc.x+p.x,y:acc.y+p.y}),{x:0,y:0}); centroid.x /= poly.length; centroid.y /= poly.length;
          const dirX = (centroid.x - impactX); const dirY = (centroid.y - impactY); const dist = Math.sqrt(dirX*dirX + dirY*dirY) + 0.01;
          const nx = dirX / dist, ny = dirY / dist;
          shards.push({el: sCanvas, cx: centroid.x, cy: centroid.y, nx, ny, w:pw, h:ph});
        });
      }
    }
    return shards;
};

const FinalShatterEffect: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const crackCanvasRef = useRef<HTMLCanvasElement>(null);
    const shardsContainerRef = useRef<HTMLDivElement>(null);
    const fadeRef = useRef<HTMLDivElement>(null);
    const animationFrameId = useRef<number>();

    useEffect(() => {
        const content = document.getElementById('main-content-wrapper');
        const crackCanvas = crackCanvasRef.current;
        const shardsContainer = shardsContainerRef.current;
        const fade = fadeRef.current;

        if (!content || !crackCanvas || !shardsContainer || !fade) return;

        const crackCtx = crackCanvas.getContext('2d');
        if (!crackCtx) return;

        const fit = () => {
            crackCanvas.width = window.innerWidth;
            crackCanvas.height = window.innerHeight;
        };
        fit();
        window.addEventListener('resize', fit);

        const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
        
        const animateShards = (shards: any[]) => {
            shards.forEach(s => {
                shardsContainer.appendChild(s.el);
                const impulse = 3 + Math.random() * 5;
                s.vx = s.nx * (impulse * (0.6 + Math.random() * 1.4)) + (Math.random() - 0.5) * 2;
                s.vy = s.ny * (impulse * (0.6 + Math.random() * 1.4)) + (Math.random() - 0.5) * 2 - (0.5 + Math.random() * 1.5);
                s.ax = 0; s.ay = 0.12; s.rot = (Math.random() - 0.5) * 0.6; s.angle = (Math.random() - 0.5) * 0.2; s.opacity = 1;
            });
            let last = performance.now();
            const frame = (now: number) => {
                const dt = Math.min(40, now - last) / 1000; last = now;
                let anyVisible = false;
                for (let s of shards) {
                    s.vx += s.ax * dt * 60;
                    s.vy += s.ay * dt * 60;
                    s.cx += s.vx * dt * 60;
                    s.cy += s.vy * dt * 60;
                    s.angle += s.rot * dt * 60;
                    s.opacity -= 0.003 * (0.5 + Math.random());
                    
                    s.el.style.transform = `translate(${ (s.cx - (s.el.width/2)) - parseFloat(s.el.style.left || '0') }px, ${ (s.cy - (s.el.height/2)) - parseFloat(s.el.style.top || '0') }px) rotate(${s.angle}rad) translate(-${s.el.width/2}px,-${s.el.height/2}px)`;
                    s.el.style.opacity = String(Math.max(0, s.opacity));

                    if (s.opacity > 0.02) anyVisible = true;
                }
                if (anyVisible) {
                    animationFrameId.current = requestAnimationFrame(frame);
                } else {
                    setTimeout(() => {
                        fade.style.opacity = '1';
                        setTimeout(() => onComplete(), 1500);
                    }, 300);
                }
            };
            animationFrameId.current = requestAnimationFrame(frame);
        };

        const startShatter = async () => {
            const ctx = getAudioContext();
            if (ctx && ctx.state === 'suspended') await ctx.resume();

            const impactX = window.innerWidth / 2;
            const impactY = window.innerHeight / 2;
            
            content.classList.add('pulse');
            setTimeout(() => content.classList.remove('pulse'), 250);

            playImpact();
            _drawCracksAnimated(crackCtx, crackCanvas, impactX, impactY, 900);
            
            await wait(900);

            try {
                const canvasSnapshot = await html2canvas(content, { backgroundColor: null, scale: Math.min(2, window.devicePixelRatio), useCORS: true });
                
                flashAt(impactX, impactY);
                playShatter();
                
                const shards = makeShardsFromImage(canvasSnapshot, impactX, impactY, 20, 12);
                
                content.style.visibility = 'hidden';
                crackCtx.clearRect(0, 0, crackCanvas.width, crackCanvas.height);
                
                animateShards(shards);
            } catch (error) {
                console.error("html2canvas failed, falling back to simple animation", error);
                // Fallback: still hide content and complete
                if(content) content.style.visibility = 'hidden';
                playShatter();
                flashAt(impactX, impactY);
                setTimeout(() => {
                    if (fade) fade.style.opacity = '1';
                    setTimeout(() => onComplete(), 1500);
                }, 300);
            }
        };

        startShatter();
        
        return () => {
            window.removeEventListener('resize', fit);
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
            if(content) {
                content.style.visibility = 'visible';
                content.classList.remove('pulse');
            }
        };
    }, [onComplete]);

    return (
        <div id="shatter-stage">
            <canvas ref={crackCanvasRef} id="crackCanvas"></canvas>
            <div ref={shardsContainerRef} id="shards"></div>
            <div ref={fadeRef} id="fade"></div>
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
}

const ProfileScreen = ({ playerState, user, config, onBuyBoost, onSetSkin, onOpenCoinLootbox, onPurchaseStarLootbox, handleMetaTap, onOpenGlitchCodesModal } : ProfileScreenProps) => {
    const t = useTranslation();
    const [activeTab, setActiveTab] = useState<ProfileTab>('contacts');
    
    const ContactsContent = () => {
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
    
    const SkinsContent = () => {
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
    
    const MarketContent = () => (
        <div className="w-full max-w-md">
            <p className="text-center text-[var(--text-secondary)] max-w-xs mx-auto mb-6">{t('black_market_desc')}</p>
             <div className="grid grid-cols-2 gap-4">
                <div className="card-glow rounded-2xl p-4 text-center">
                    <h3 className="font-bold text-base mb-2">{t('lootbox_coin')}</h3>
                    <div className="h-24 w-24 mx-auto mb-4 flex items-center justify-center">
                        <img src={config.uiIcons.marketCoinBox} alt={t('lootbox_coin')} className="w-full h-full object-contain" {...(isExternal(config.uiIcons.marketCoinBox) && { crossOrigin: 'anonymous' })} />
                    </div>
                    <button onClick={() => onOpenCoinLootbox('coin')} className="w-full interactive-button rounded-lg font-bold py-2 px-3 text-base flex items-center justify-center space-x-2">
                        <span>{formatNumber(config.lootboxCostCoins || 0)}</span>
                        <img src={config.uiIcons.coin} alt="coin" className="w-5 h-5" {...(isExternal(config.uiIcons.coin) && { crossOrigin: 'anonymous' })} />
                    </button>
                </div>
                <div className="card-glow rounded-2xl p-4 text-center">
                    <h3 className="font-bold text-base mb-2">{t('lootbox_star')}</h3>
                     <div className="h-24 w-24 mx-auto mb-4 flex items-center justify-center">
                        <img src={config.uiIcons.marketStarBox} alt={t('lootbox_star')} className="w-full h-full object-contain" {...(isExternal(config.uiIcons.marketStarBox) && { crossOrigin: 'anonymous' })} />
                    </div>
                    <button onClick={() => onPurchaseStarLootbox('star')} className="w-full interactive-button rounded-lg font-bold py-2 px-3 text-base flex items-center justify-center space-x-2">
                        <span>{(config.lootboxCostStars || 0)}</span>
                        <img src={config.uiIcons.star} alt="star" className="w-5 h-5" {...(isExternal(config.uiIcons.star) && { crossOrigin: 'anonymous' })} />
                    </button>
                </div>
            </div>
        </div>
    );

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
                {activeTab === 'contacts' && <ContactsContent />}
                {activeTab === 'boosts' && <BoostScreen playerState={playerState} boosts={config.boosts} onBuyBoost={onBuyBoost} lang={user.language} uiIcons={config.uiIcons} />}
                {activeTab === 'skins' && <SkinsContent />}
                {activeTab === 'market' && <MarketContent />}
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

const AirdropScreen: React.FC<{
    specialTasks: SpecialTask[];
    playerState: PlayerState;
    onClaim: (task: DailyTask | SpecialTask) => void;
    onPurchase: (task: SpecialTask) => void;
    lang: Language;
    startedTasks: Set<string>;
    uiIcons: UiIcons;
}> = ({ specialTasks, playerState, onClaim, onPurchase, lang, startedTasks, uiIcons }) => {
    const t = useTranslation();
    return (
        <div className="flex flex-col h-full text-white pt-4 px-4">
            <h1 className="text-3xl font-display text-center mb-2 flex-shrink-0">{t('airdrop_tasks')}</h1>
            <p className="text-center text-[var(--text-secondary)] mb-6 flex-shrink-0">{t('airdrop_description')}</p>
            <div className="flex-grow overflow-y-auto no-scrollbar -mx-4 px-4">
                <div className="flex flex-col space-y-4 pb-4">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col p-4" onClick={onClose}>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
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


const MainApp: React.FC = () => {
  const { user, isGlitching, setIsGlitching } = useAuth();
  const { 
      playerState, config, handleTap, buyUpgrade, allUpgrades, currentLeague, 
      claimTaskReward, buyBoost, purchaseSpecialTask, completeSpecialTask,
      claimDailyCombo, claimDailyCipher, getLeaderboard, 
      openCoinLootbox, purchaseLootboxWithStars, 
      setSkin,
      claimGlitchCode,
      isTurboActive, effectiveMaxEnergy, effectiveMaxSuspicion,
      systemMessage, setSystemMessage,
      purchaseResult, setPurchaseResult, setPlayerState,
      savePlayerState
  } = useGame();
  
  const [activeScreen, setActiveScreen] = React.useState<Screen>('exchange');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const t = useTranslation();
  const [startedTasks, setStartedTasks] = useState<Set<string>>(new Set());
  const [secretCodeTask, setSecretCodeTask] = useState<DailyTask | SpecialTask | null>(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(window.Telegram?.WebApp?.isExpanded ?? false);

  // Glitch event states
  const prevPlayerState = useRef<PlayerState | null>(null);
  const [metaTaps, setMetaTaps] = useState<Record<string, number>>({});
  const [activeGlitchEvent, setActiveGlitchEvent] = useState<GlitchEvent | null>(null);
  const [isGlitchCodesModalOpen, setIsGlitchCodesModalOpen] = useState(false);
  const [isFinalScene, setIsFinalScene] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('isMuted') === 'true';
  });
  const [hasPlayed, setHasPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const triggerGlitchEvent = useCallback((event: GlitchEvent) => {
    if (!playerState || (playerState.claimedGlitchCodes || []).includes(event.code)) {
        return;
    }

    const discovered = new Set(playerState.discoveredGlitchCodes || []);
    discovered.add(event.code);
    const updatedPlayerState = { ...playerState, discoveredGlitchCodes: Array.from(discovered) };
    
    if (event.isFinal) {
        setIsFinalScene(true);
    } else {
        setActiveGlitchEvent(event);
    }
    
    setPlayerState(updatedPlayerState);
    if (user) {
        savePlayerState(updatedPlayerState, 0); 
    }
  }, [playerState, setPlayerState, user, savePlayerState]);
  
  useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        const handleViewportChange = () => {
            setIsFullScreen(tg.isExpanded);
        };

        tg.onEvent('viewportChanged', handleViewportChange);
        return () => {
            tg.offEvent('viewportChanged', handleViewportChange);
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

  const handleMetaTap = useCallback((targetId: string) => {
      setMetaTaps(prev => ({ ...prev, [targetId]: (prev[targetId] || 0) + 1 }));
  }, []);

  // --- GLITCH TRIGGER CHECKS (with safety checks) ---
  // On Load trigger
  useEffect(() => {
      if (!config?.glitchEvents) return;
      const now = new Date();
      config.glitchEvents.forEach(e => {
          if (e.trigger?.type === 'login_at_time' && e.trigger.params &&
              e.trigger.params.hour === now.getHours() &&
              e.trigger.params.minute === now.getMinutes()) {
              triggerGlitchEvent(e);
          }
      });
  }, [config?.glitchEvents, triggerGlitchEvent]);

  // Player state change triggers
  useEffect(() => {
    if (!playerState || !config?.glitchEvents || activeGlitchEvent) {
        return;
    }

    const discovered = new Set(playerState.discoveredGlitchCodes || []);
    const claimed = new Set(playerState.claimedGlitchCodes || []);

    for (const e of config.glitchEvents) {
        if (activeGlitchEvent || claimed.has(e.code)) {
            continue;
        }

        if (e.trigger?.type === 'balance_equals' && e.trigger.params) {
            if (!discovered.has(e.code) && playerState.balance >= e.trigger.params.amount) {
                triggerGlitchEvent(e);
                break;
            }
        }
        
        if (prevPlayerState.current && e.trigger?.type === 'upgrade_purchased' && e.trigger.params) {
            const oldUpgrades = prevPlayerState.current.upgrades || {};
            const newUpgrades = playerState.upgrades || {};
            const purchasedUpgradeId = Object.keys(newUpgrades).find(id => newUpgrades[id] > (oldUpgrades[id] || 0));
            
            if (purchasedUpgradeId === e.trigger.params.upgradeId) {
                triggerGlitchEvent(e);
                break;
            }
        }
    }
    
    prevPlayerState.current = playerState;

}, [playerState, config?.glitchEvents, triggerGlitchEvent, activeGlitchEvent]);

  // Meta-tap trigger
  useEffect(() => {
    if (!config?.glitchEvents || activeGlitchEvent) return;

    for (const targetId in metaTaps) {
        const tapCount = metaTaps[targetId];
        if (tapCount > 0) {
            const event = config.glitchEvents.find(e => 
                e.trigger?.type === 'meta_tap' &&
                e.trigger?.params?.targetId === targetId &&
                tapCount >= (e.trigger.params.taps || 999)
            );

            if (event) {
                triggerGlitchEvent(event);
                setMetaTaps(prev => ({ ...prev, [targetId]: 0 }));
                break;
            }
        }
    }
  }, [metaTaps, config?.glitchEvents, activeGlitchEvent, triggerGlitchEvent]);

  useEffect(() => {
    if (isGlitching) {
        const timer = setTimeout(() => {
            setIsGlitching(false);
        }, 2000);
        return () => clearTimeout(timer);
    }
  }, [isGlitching, setIsGlitching]);

  if (!isAppReady || !user || !playerState || !config) {
    return <LoadingScreen imageUrl={config?.loadingScreenImageUrl} />;
  }
  
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
        setNotification(prev => (prev?.message === message ? null : prev));
    }, 3000);
  };

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
        const rewardText = result.reward.type === 'profit'
            ? `+${formatNumber(result.reward.amount)}/hr`
            : `+${formatNumber(result.reward.amount)}`;
        showNotification(`${t('glitch_code_claimed')} ${rewardText}`, 'success');
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

  const handleEnergyClick = () => showNotification(t('tooltip_energy'), 'success');
  const handleSuspicionClick = () => showNotification(t('tooltip_suspicion'), 'success');

  const PenaltyModal: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
      const t = useTranslation();
      return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
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
                />;
      default:
        return <ExchangeScreen playerState={playerState} currentLeague={currentLeague} onTap={handleTapWithAudio} user={user} onClaimCipher={handleClaimCipher} config={config} onOpenLeaderboard={() => setIsLeaderboardOpen(true)} isTurboActive={isTurboActive} effectiveMaxEnergy={effectiveMaxEnergy} effectiveMaxSuspicion={effectiveMaxSuspicion} onEnergyClick={handleEnergyClick} onSuspicionClick={handleSuspicionClick} isMuted={isMuted} toggleMute={toggleMute} handleMetaTap={handleMetaTap} />;
    }
  };

  const NavItem = ({ screen, label, iconUrl, active }: { screen: Screen, label: string, iconUrl: string, active: boolean }) => (
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

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col prevent-select transition-all duration-300 ${isFullScreen ? 'pt-4' : ''}`}>
      {isFinalScene && !showVideo && <FinalShatterEffect onComplete={() => setShowVideo(true)} />}
      {showVideo && config?.finalVideoUrl && <FinalVideoPlayer videoUrl={config.finalVideoUrl} onEnd={() => { setShowVideo(false); setIsFinalScene(false); }} />}
      
      {config?.backgroundAudioUrl && (
        <audio ref={audioRef} src={config.backgroundAudioUrl} loop muted={isMuted} playsInline />
      )}
      {isGlitching && <GlitchEffect />}
      {activeGlitchEvent && <GlitchEffect message={activeGlitchEvent.message[user.language]} code={activeGlitchEvent.code} onClose={() => setActiveGlitchEvent(null)} />}
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
            <NavItem screen="exchange" label={t('exchange')} iconUrl={config.uiIcons.nav.exchange} active={activeScreen === 'exchange'} />
            <NavItem screen="mine" label={t('mine')} iconUrl={config.uiIcons.nav.mine} active={activeScreen === 'mine'} />
            <NavItem screen="missions" label={t('missions')} iconUrl={config.uiIcons.nav.missions} active={activeScreen === 'missions'} />
            <NavItem screen="airdrop" label={t('airdrop')} iconUrl={config.uiIcons.nav.airdrop} active={activeScreen === 'airdrop'} />
            <NavItem screen="profile" label={t('profile')} iconUrl={config.uiIcons.nav.profile} active={activeScreen === 'profile'} />
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