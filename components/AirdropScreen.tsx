import React from 'react';
import { useGame, useTranslation } from '../hooks/useGameLogic';
import { DailyTask, SpecialTask, Language, PlayerState, UiIcons } from '../types';
import TaskCard from './TaskCard';
import { TonConnectButton } from '@tonconnect/ui-react';

interface AirdropScreenProps {
  playerState: PlayerState;
  onClaim: (task: DailyTask | SpecialTask) => void;
  onPurchase: (task: SpecialTask) => void;
  lang: Language;
  startedTasks: Set<string>;
  uiIcons: UiIcons;
  connectWallet: () => void;
}

const AirdropScreen: React.FC<AirdropScreenProps> = ({ playerState, onClaim, onPurchase, lang, startedTasks, uiIcons }) => {
    const t = useTranslation();
    const { config } = useGame();
    const { specialTasks = [] } = config || {};
    const { connectedWallet } = playerState;

    return (
        <div className="flex flex-col h-full text-white pt-4 px-4">
            <h1 className="text-3xl font-display text-center mb-4 flex-shrink-0">{t('airdrop')}</h1>

            <div className="card-glow rounded-2xl p-4 mb-6 text-center">
                <h2 className="text-xl font-bold mb-2">{connectedWallet ? t('wallet_connected') : t('connect_wallet_title')}</h2>
                <p className="text-[var(--text-secondary)] text-sm mb-4">
                    {connectedWallet ? t('your_wallet_address') : t('connect_wallet_desc')}
                </p>
                {connectedWallet ? (
                    <div className="font-mono bg-slate-900/50 shadow-inner rounded-lg p-2 text-sm break-all">
                        {connectedWallet}
                    </div>
                ) : (
                    <TonConnectButton />
                )}
            </div>

            <div className="mb-4">
                <h2 className="text-lg font-display text-center">{t('airdrop_tasks')}</h2>
                <p className="text-xs text-[var(--text-secondary)] text-center">{t('airdrop_description')}</p>
            </div>
            
            <div className="flex-grow overflow-x-auto no-scrollbar -mx-4 px-4">
                <div className="inline-flex space-x-3 pb-4">
                    {specialTasks.map(task => (
                        <div key={task.id} className="w-60 flex-shrink-0">
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
             <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default AirdropScreen;
