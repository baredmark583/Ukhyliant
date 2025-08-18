import React, { useState, useEffect, useCallback } from 'https://esm.sh/react@19.1.1';
import { Cell as CellType, Informant, BattleStatus, BattleLeaderboardEntry } from '../types';
import { useTranslation, useGame, useAuth } from '../hooks/useGameLogic';

const formatNumber = (num: number): string => {
  if (num === null || num === undefined) return '0';
  if (num >= 1_000_000_000_000) return `${(num / 1_000_000_000_000).toFixed(2)}T`;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 10000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('en-US');
};

const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const InformantCard: React.FC<{informant: Informant}> = ({informant}) => {
    const t = useTranslation();
    return (
        <div className="neumorphic-raised rounded-xl p-3 space-y-2 text-sm">
            <h4 className="font-bold text-base text-amber-300">{informant.name}</h4>
            <p className="text-gray-300 whitespace-pre-wrap font-mono text-xs">{informant.dossier}</p>
            <p className="text-[var(--text-secondary)]"><span className="font-semibold text-gray-200">Specialization:</span> {informant.specialization}</p>
             <p className="text-[var(--accent-color)] text-xs font-bold">Effect: +1% profit for all cell members</p>
        </div>
    );
};

const AccordionSection: React.FC<{
  title: string;
  count?: number;
  maxCount?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, count, maxCount, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="neumorphic-raised rounded-2xl overflow-hidden">
      <button
        className="w-full flex justify-between items-center p-3 text-left font-bold"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span>
          {title} {count !== undefined ? `(${count}${maxCount !== undefined ? `/${maxCount}` : ''})` : ''}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 transition-transform ${isOpen ? '' : '-rotate-90'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out grid ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="p-3 border-t border-[var(--shadow-dark)]">{children}</div>
        </div>
      </div>
    </div>
  );
};


const BattleSection: React.FC<{ cell: CellType, refetchCell: () => void }> = ({ cell, refetchCell }) => {
    const t = useTranslation();
    const { getBattleStatus, joinBattle, getBattleLeaderboard } = useGame();
    const [status, setStatus] = useState<BattleStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [leaderboard, setLeaderboard] = useState<BattleLeaderboardEntry[] | null>(null);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    
    const fetchStatus = useCallback(async () => {
        const { status: fetchedStatus, error: fetchError } = await getBattleStatus();
        if (fetchedStatus) setStatus(fetchedStatus);
        if (fetchError) setError(fetchError);
        setLoading(false);
    }, [getBattleStatus]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    useEffect(() => {
        if (status?.isActive && status.timeRemaining > 0) {
            const timer = setInterval(() => {
                setStatus(prev => prev ? {...prev, timeRemaining: Math.max(0, prev.timeRemaining - 1)} : null);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [status]);
    
    const handleJoinBattle = async () => {
        setError('');
        const { status: newStatus, cell: updatedCell, error: joinError } = await joinBattle();
        if (newStatus) setStatus(newStatus);
        if (updatedCell) refetchCell(); // Update parent cell state (tickets)
        if (joinError) setError(joinError);
    };
    
    const handleViewLeaderboard = async () => {
        setError('');
        const { leaderboard: fetchedLeaderboard, error: leaderboardError } = await getBattleLeaderboard();
        if (fetchedLeaderboard) setLeaderboard(fetchedLeaderboard);
        if (leaderboardError) setError(leaderboardError);
        setIsLeaderboardOpen(true);
    };

    const renderLeaderboardModal = () => (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col p-4" onClick={() => setIsLeaderboardOpen(false)}>
            <div className="neumorphic-raised rounded-2xl w-full max-w-lg mx-auto flex flex-col p-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-display text-white">{t('battle_leaderboard_title')}</h2>
                    <button onClick={() => setIsLeaderboardOpen(false)} className="text-gray-400 text-3xl font-light">&times;</button>
                </div>
                {leaderboard ? (
                    <div className="overflow-y-auto space-y-2" style={{maxHeight: '60vh'}}>
                         <div className="flex items-center space-x-3 text-sm p-2 font-bold text-[var(--text-secondary)]">
                             <span className="w-8 text-center">{t('rank')}</span>
                             <span className="flex-grow">{t('cell_name')}</span>
                             <span className="w-24 text-right">{t('score')}</span>
                         </div>
                        {leaderboard.map((entry, index) => (
                            <div key={entry.cellId} className="neumorphic-pressed rounded-lg p-2 flex items-center space-x-3 text-sm">
                                <span className="font-bold w-8 text-center">{index + 1}</span>
                                <span className="flex-grow font-semibold text-white truncate">{entry.cellName}</span>
                                <span className="text-yellow-400 font-mono w-24 text-right">{formatNumber(entry.score)}</span>
                            </div>
                        ))}
                    </div>
                ) : <p>{t('loading')}</p>}
            </div>
        </div>
    );
    
    if(loading) return <p className="text-center p-4 text-[var(--text-secondary)]">{t('loading')}</p>
    if(!status) return <p className="text-center p-4 text-red-400">{error || 'Could not load battle status.'}</p>

    return (
        <div className="space-y-3">
            {isLeaderboardOpen && renderLeaderboardModal()}
            {!status.isActive ? (
                 <p className="text-center text-[var(--text-secondary)]">{t('battle_inactive')}</p>
            ) : (
                <div className="space-y-3">
                    <div className="text-center">
                        <p className="text-[var(--text-secondary)] text-sm">{t('battle_time_left')}</p>
                        <p className="font-mono text-2xl font-bold text-[var(--accent-color)]">{formatTime(status.timeRemaining)}</p>
                    </div>
                    {status.isParticipant && (
                        <div className="neumorphic-pressed rounded-xl bg-green-900/30 border-green-500/50 p-3 text-center">
                            <p className="text-sm text-green-300">{t('battle_your_score')}</p>
                            <p className="text-2xl font-bold text-white">{formatNumber(status.myScore)}</p>
                        </div>
                    )}
                    {error && <p className="text-red-400 text-center text-sm">{error}</p>}
                    <div className="flex space-x-2">
                        {!status.isParticipant && (
                            <button onClick={handleJoinBattle} disabled={cell.ticketCount < 1} className="w-full neumorphic-raised-button font-bold py-2">
                                {t('join_battle')}
                            </button>
                        )}
                        <button onClick={handleViewLeaderboard} className="w-full neumorphic-raised-button font-bold py-2">{t('view_leaderboard')}</button>
                    </div>
                </div>
            )}
             <div className="neumorphic-pressed rounded-xl p-3 text-center space-y-2 opacity-50">
                <h4 className="font-bold text-base text-gray-300">{t('battle_boosts')}</h4>
                <p className="text-xs text-[var(--text-secondary)]">{t('battle_boosts_desc')}</p>
                <div className="flex justify-center space-x-2">
                    <button disabled className="neumorphic-raised-button font-bold p-2 text-xs">x2 Boost</button>
                    <button disabled className="neumorphic-raised-button font-bold p-2 text-xs">Auto-Tap</button>
                </div>
            </div>
        </div>
    );
}

const CellScreen: React.FC = () => {
    const { user } = useAuth();
    const { getMyCell, createCell, joinCell, leaveCell, recruitInformant, buyCellTicket, config } = useGame();
    const t = useTranslation();
    
    const [cell, setCell] = useState<CellType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const [createMode, setCreateMode] = useState(false);
    const [joinMode, setJoinMode] = useState(false);
    const [cellName, setCellName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [isRecruiting, setIsRecruiting] = useState(false);
    const [isBuyingTicket, setIsBuyingTicket] = useState(false);

    const fetchCell = useCallback(async () => {
        setLoading(true);
        const { cell: fetchedCell, error: fetchError } = await getMyCell();
        setCell(fetchedCell || null);
        if (fetchError) setError(fetchError);
        setLoading(false);
    }, [getMyCell]);

    useEffect(() => {
        fetchCell();
    }, [fetchCell]);

    const handleCreateCell = async () => {
        if (!cellName.trim()) {
            setError('Please enter a name for the cell.');
            return;
        }
        setError('');
        const { cell: newCell, error: createError } = await createCell(cellName);
        if (newCell) {
            setCell(newCell);
            setCreateMode(false);
        }
        if (createError) setError(createError);
    };

    const handleJoinCell = async () => {
        if (!inviteCode.trim()) {
            setError('Please enter an invite code.');
            return;
        }
        setError('');
        const { cell: joinedCell, error: joinError } = await joinCell(inviteCode);
        if (joinedCell) {
            setCell(joinedCell);
            setJoinMode(false);
        }
        if (joinError) setError(joinError);
    };
    
    const handleLeaveCell = async () => {
        if (window.confirm(t('confirm_leave_cell'))) {
             const { player, error: leaveError } = await leaveCell();
             if (player) {
                 setCell(null);
             }
             if (leaveError) setError(leaveError);
        }
    };

    const handleRecruitInformant = async () => {
        setIsRecruiting(true);
        setError('');
        const { informant, error: recruitError } = await recruitInformant();
        if(informant) {
            await fetchCell(); // Re-fetch cell data to show the new informant and updated profits
        }
        if(recruitError) {
            setError(recruitError);
        }
        setIsRecruiting(false);
    };

    const handleBuyTicket = async () => {
        setIsBuyingTicket(true);
        setError('');
        const { cell: updatedCell, error: buyError } = await buyCellTicket();
        if (updatedCell) {
            setCell(updatedCell);
        }
        if (buyError) {
            setError(buyError);
        }
        setIsBuyingTicket(false);
    };
    
    const handleCopyInvite = () => {
        if (cell?.invite_code) {
            navigator.clipboard.writeText(cell.invite_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    
    if (loading) {
        return <div className="flex items-center justify-center h-full"><p className="text-lg animate-pulse text-gray-300">{t('loading')}...</p></div>;
    }

    if (createMode || joinMode) {
        const title = createMode ? t('create_cell') : t('join_cell');
        const placeholder = createMode ? t('enter_cell_name') : t('enter_invite_code');
        const value = createMode ? cellName : inviteCode;
        const onChange = createMode ? (e: React.ChangeEvent<HTMLInputElement>) => setCellName(e.target.value) : (e: React.ChangeEvent<HTMLInputElement>) => setInviteCode(e.target.value.toUpperCase());
        const onSubmit = createMode ? handleCreateCell : handleJoinCell;
        const buttonText = createMode ? t('create') : t('join');

        return (
            <div className="flex flex-col h-full justify-center items-center p-4">
                <div className="card-glow bg-slate-800 rounded-2xl p-6 w-full max-w-sm relative">
                    <button onClick={() => { setCreateMode(false); setJoinMode(false); setError(''); }} className="absolute top-2 right-2 text-slate-400 text-3xl font-light">&times;</button>
                    <h2 className="text-xl font-bold mb-4 text-center">{title}</h2>
                    {error && <p className="text-red-400 text-sm mb-2 text-center">{error}</p>}
                    <div className="space-y-4">
                        <input type="text" value={value} onChange={onChange} placeholder={placeholder} className="w-full input-field text-center" />
                        <button onClick={onSubmit} className="w-full interactive-button font-bold py-3">{buttonText}</button>
                    </div>
                </div>
            </div>
        );
    }

    if (!cell) {
        return (
            <div className="flex flex-col h-full justify-center items-center text-center p-4 space-y-4">
                <h2 className="text-2xl font-display">{t('cell')}</h2>
                <p className="text-[var(--text-secondary)] max-w-xs">{t('no_cell_info')}</p>
                {error && <p className="text-red-400">{error}</p>}
                <p className="text-xs text-slate-400">({t('cost')} {formatNumber(config?.cellCreationCost || 0)})</p>
                <button onClick={() => setCreateMode(true)} className="w-full max-w-xs interactive-button font-bold py-3">{t('create_cell')}</button>
                <button onClick={() => setJoinMode(true)} className="w-full max-w-xs interactive-button font-bold py-3">{t('join_cell')}</button>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto no-scrollbar p-4 space-y-4">
            <div className="text-center">
                <h1 className="text-3xl font-display">{cell.name}</h1>
                <p className="text-lg text-[var(--accent-color)] font-bold flex items-center justify-center space-x-1">
                    <span>+{formatNumber(cell.totalProfitPerHour)}/hr</span>
                </p>
            </div>
            
            <div className="card-glow p-3 rounded-xl">
                 <label className="text-xs text-[var(--text-secondary)]">{t('invite_code')}</label>
                 <div className="flex items-center space-x-2">
                     <code className="bg-slate-900 shadow-inner p-2 rounded-lg flex-grow text-center font-mono tracking-widest">{cell.invite_code}</code>
                     <button onClick={handleCopyInvite} className="interactive-button p-2">{copied ? t('copied') : t('copy')}</button>
                 </div>
            </div>

            {error && <p className="text-red-400 text-center p-2 bg-red-900/50 rounded-lg">{error}</p>}
            
             <AccordionSection title={t('cell_bank')}>
                 <div className="flex justify-between items-center">
                     <div>
                        <p className="text-[var(--text-secondary)]">{t('cell_bank')}</p>
                        <p className="text-2xl font-bold">{formatNumber(cell.balance)}</p>
                     </div>
                     <div>
                         <p className="text-[var(--text-secondary)]">{t('cell_tickets')}</p>
                         <p className="text-2xl font-bold">{cell.ticketCount}</p>
                     </div>
                 </div>
                 <button onClick={handleBuyTicket} disabled={isBuyingTicket} className="w-full mt-3 interactive-button font-bold py-2">
                     {isBuyingTicket ? `${t('loading')}...` : `${t('buy_ticket')} (${formatNumber(config?.cellBattleTicketCost || 0)})`}
                 </button>
             </AccordionSection>

            <AccordionSection title={t('cell_battle')}>
                <BattleSection cell={cell} refetchCell={fetchCell} />
            </AccordionSection>

            <AccordionSection title={t('informants')} count={cell.informants.length}>
                <div className="space-y-3">
                    {cell.informants.length > 0 
                        ? cell.informants.map(inf => <InformantCard key={inf.id} informant={inf} />)
                        : <p className="text-center text-[var(--text-secondary)]">{t('no_informants_recruited')}</p>
                    }
                    <button onClick={handleRecruitInformant} disabled={isRecruiting} className="w-full mt-2 interactive-button font-bold py-2">
                        {isRecruiting ? t('recruiting') : `${t('recruit_informant')} (${formatNumber(config?.informantRecruitCost || 0)})`}
                    </button>
                </div>
            </AccordionSection>

            <AccordionSection title={t('members')} count={cell.members.length} maxCount={config?.cellMaxMembers}>
                <div className="space-y-2">
                    {cell.members.map(member => (
                        <div key={member.id} className="neumorphic-pressed rounded-lg p-2 flex justify-between items-center text-sm">
                            <span className="font-semibold truncate">{member.name}</span>
                            <span className="text-[var(--accent-color)] font-mono">+{formatNumber(member.profitPerHour)}/hr</span>
                        </div>
                    ))}
                </div>
            </AccordionSection>

            <button onClick={handleLeaveCell} className="w-full text-red-400 hover:bg-red-900/50 p-2 rounded-lg font-bold">{t('leave_cell')}</button>
        </div>
    );
};

export default CellScreen;
