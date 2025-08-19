import React, { useState, useEffect, useCallback } from 'https://esm.sh/react';
import { Cell as CellType, Informant, BattleStatus, BattleLeaderboardEntry, BattleBoost } from '../types';
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

// --- Modals ---
const CreateCellModal: React.FC<{onClose: () => void, onSubmit: (name: string) => void}> = ({onClose, onSubmit}) => {
    const t = useTranslation();
    const [name, setName] = useState('');
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2500] flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-glow bg-slate-800 rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{t('create_cell')}</h2>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('enter_cell_name')} className="input-field w-full mb-4"/>
                <button onClick={() => onSubmit(name)} disabled={!name.trim()} className="interactive-button w-full py-3 font-bold">{t('create')}</button>
            </div>
        </div>
    );
};

const JoinCellModal: React.FC<{onClose: () => void, onSubmit: (code: string) => void}> = ({onClose, onSubmit}) => {
    const t = useTranslation();
    const [code, setCode] = useState('');
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2500] flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-glow bg-slate-800 rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{t('join_cell')}</h2>
                <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder={t('enter_invite_code')} className="input-field w-full mb-4 uppercase"/>
                <button onClick={() => onSubmit(code)} disabled={!code.trim()} className="interactive-button w-full py-3 font-bold">{t('join')}</button>
            </div>
        </div>
    );
};

const RecruitModal: React.FC<{onClose: () => void, onRecruit: () => void, loading: boolean, newInformant: Informant | null}> = ({onClose, onRecruit, loading, newInformant}) => {
    const t = useTranslation();
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2500] flex items-center justify-center p-4" onClick={onClose}>
            <div className="card-glow bg-slate-800 rounded-2xl w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{newInformant ? t('informant_dossier') : t('recruit_informant')}</h2>
                {loading ? <div className="spinner-border my-8"></div> : (
                    newInformant ? <InformantCard informant={newInformant} /> : <p className="text-[var(--text-secondary)] my-8">{t('recruit_informant_desc')}</p>
                )}
                <div className="mt-6">
                    {newInformant ? (
                        <button onClick={onClose} className="interactive-button w-full py-3 font-bold">{t('close')}</button>
                    ) : (
                         <button onClick={onRecruit} disabled={loading} className="interactive-button w-full py-3 font-bold">{loading ? t('recruiting') : t('recruit')}</button>
                    )}
                </div>
            </div>
        </div>
    )
}

// --- Views ---
const NoCellView: React.FC<{onCreate: () => void, onJoin: () => void}> = ({onCreate, onJoin}) => {
    const t = useTranslation();
    return (
        <div className="text-center space-y-4">
            <h2 className="text-2xl font-display">{t('cell')}</h2>
            <p className="text-[var(--text-secondary)]">{t('no_cell_info')}</p>
            <div className="space-y-3 pt-4">
                <button onClick={onCreate} className="interactive-button w-full py-3 font-bold text-lg">{t('create_cell')}</button>
                <button onClick={onJoin} className="interactive-button w-full py-3 font-bold text-lg">{t('join_cell')}</button>
            </div>
        </div>
    );
};

const CellDetailsView: React.FC<{
    cell: CellType,
    onLeave: () => void,
    onRecruit: () => void,
    onBuyTicket: () => void
}> = ({ cell, onLeave, onRecruit, onBuyTicket }) => {
    const t = useTranslation();
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(cell.invite_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="w-full space-y-4">
            <h1 className="text-3xl font-display text-center">{cell.name}</h1>

            <div className="card-glow p-3 rounded-xl grid grid-cols-2 gap-4 text-center">
                <div>
                    <p className="text-sm text-[var(--text-secondary)]">{t('total_cell_profit')}</p>
                    <p className="text-2xl font-bold text-[var(--accent-color)]">+{formatNumber(cell.totalProfitPerHour)}/hr</p>
                </div>
                <div>
                    <p className="text-sm text-[var(--text-secondary)]">{t('members')}</p>
                    <p className="text-2xl font-bold">{cell.members.length} / {cell.maxMembers || 10}</p>
                </div>
                 <div>
                    <p className="text-sm text-[var(--text-secondary)]">{t('cell_bank')}</p>
                    <p className="text-2xl font-bold">{formatNumber(cell.balance)}</p>
                </div>
                 <div>
                    <p className="text-sm text-[var(--text-secondary)]">{t('cell_tickets')}</p>
                    <p className="text-2xl font-bold">{cell.ticketCount}</p>
                </div>
            </div>
             <div className="card-glow p-3 rounded-xl">
                <p className="text-sm text-[var(--text-secondary)] mb-1">{t('invite_code')}</p>
                <div className="flex items-center justify-between bg-slate-900/50 shadow-inner p-2 rounded-lg">
                    <span className="font-mono text-xl tracking-widest">{cell.invite_code}</span>
                    <button onClick={handleCopy} className="interactive-button px-3 py-1 text-sm font-bold">{copied ? t('copied') : t('copy')}</button>
                </div>
            </div>

            <div className="space-y-2">
                <button onClick={onBuyTicket} className="w-full interactive-button py-3 font-bold">{t('buy_ticket')}</button>
                <button onClick={onRecruit} className="w-full interactive-button py-3 font-bold">{t('recruit_informant')}</button>
                 <button onClick={onLeave} className="w-full bg-red-800/50 hover:bg-red-700/50 border border-red-600/50 text-red-300 rounded-lg py-2 font-bold">{t('leave_cell')}</button>
            </div>
            
        </div>
    );
};


const CellScreen: React.FC = () => {
    const t = useTranslation();
    const { user } = useAuth();
    const { playerState, getMyCell, createCell, joinCell, leaveCell, recruitInformant, buyCellTicket, getBattleStatus, joinBattle, activateBattleBoost, getBattleLeaderboard } = useGame();
    const [cell, setCell] = useState<CellType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modal, setModal] = useState<'create' | 'join' | 'recruit' | 'battle_leaderboard' | null>(null);
    const [recruitLoading, setRecruitLoading] = useState(false);
    const [newInformant, setNewInformant] = useState<Informant | null>(null);
    const [battleStatus, setBattleStatus] = useState<BattleStatus | null>(null);

    const fetchCell = useCallback(async () => {
        if (playerState?.cellId) {
            const { cell: fetchedCell } = await getMyCell();
            setCell(fetchedCell || null);
        } else {
            setCell(null);
        }
        setLoading(false);
    }, [getMyCell, playerState?.cellId]);

    useEffect(() => {
        fetchCell();
    }, [fetchCell]);

    const handleCreate = async (name: string) => {
        const result = await createCell(name);
        if(result.error) setError(result.error);
        else {
            setCell(result.cell || null);
            setModal(null);
        }
    };

    const handleJoin = async (code: string) => {
        const result = await joinCell(code);
        if(result.error) setError(result.error);
        else {
            setCell(result.cell || null);
            setModal(null);
        }
    };
    
    const handleLeave = async () => {
        if(window.confirm(t('confirm_leave_cell'))){
            const result = await leaveCell();
            if(result.error) setError(result.error);
            else setCell(null);
        }
    };

    const handleRecruit = async () => {
        setRecruitLoading(true);
        setNewInformant(null);
        const result = await recruitInformant();
        if (result.error) setError(result.error);
        else {
            setNewInformant(result.informant || null);
            fetchCell(); // Refresh cell data
        }
        setRecruitLoading(false);
    };

    const handleBuyTicket = async () => {
        const result = await buyCellTicket();
        if (result.error) setError(result.error);
        else setCell(result.cell || null);
    }
    
    if (loading) {
        return <div className="flex justify-center items-center h-full"><div className="spinner-border"></div></div>;
    }

    return (
        <div className="w-full max-w-md">
            {modal === 'create' && <CreateCellModal onClose={() => setModal(null)} onSubmit={handleCreate} />}
            {modal === 'join' && <JoinCellModal onClose={() => setModal(null)} onSubmit={handleJoin} />}
            {modal === 'recruit' && <RecruitModal onClose={() => setModal(null)} onRecruit={handleRecruit} loading={recruitLoading} newInformant={newInformant}/>}

            {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-2 rounded-lg text-center mb-4">{error}</div>}
            
            {!cell ? (
                <NoCellView onCreate={() => setModal('create')} onJoin={() => setModal('join')} />
            ) : (
                <CellDetailsView cell={cell} onLeave={handleLeave} onRecruit={() => { setNewInformant(null); setModal('recruit')}} onBuyTicket={handleBuyTicket}/>
            )}
        </div>
    );
};

export default CellScreen;
