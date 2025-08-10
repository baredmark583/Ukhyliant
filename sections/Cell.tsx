
import React, { useState, useEffect, useCallback } from 'react';
import { Cell as CellType, Informant } from '../types';
import { useTranslation, useGame, useAuth } from '../hooks/useGameLogic';

const formatNumber = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
};

const InformantCard: React.FC<{informant: Informant}> = ({informant}) => {
    const t = useTranslation();
    return (
        <div className="themed-container p-3 space-y-2 text-sm">
            <h4 className="font-bold text-base text-amber-300">{informant.name}</h4>
            <p className="text-gray-300 whitespace-pre-wrap font-mono text-xs">{informant.dossier}</p>
            <p className="text-gray-400"><span className="font-semibold text-gray-200">Specialization:</span> {informant.specialization}</p>
             <p className="text-green-400 text-xs font-bold">Effect: +1% profit for all cell members</p>
        </div>
    );
};

const AccordionSection: React.FC<{
  title: string;
  count: number;
  maxCount?: number;
  children: React.ReactNode;
}> = ({ title, count, maxCount, children }) => {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <div className="themed-container overflow-hidden">
      <button
        className="w-full flex justify-between items-center p-3 text-left font-bold"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span>
          {title} ({count}{maxCount !== undefined ? `/${maxCount}` : ''})
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
          <div className="p-3 border-t border-gray-700">{children}</div>
        </div>
      </div>
    </div>
  );
};


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
        return <div className="text-center p-8"><span className="animate-pulse">{t('loading')}</span></div>;
    }
    
    if (cell) {
        const ticketCost = config?.cellBattleTicketCost || 1000000;
        const canAffordTicket = cell.balance >= ticketCost;

        return (
            <div className="w-full max-w-md space-y-4">
                <h2 className="text-2xl font-display text-center">{cell.name}</h2>
                
                <div className="themed-container p-3">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400">{t('invite_code')}</span>
                        <div className="flex items-center space-x-2">
                             <span className="font-mono bg-black/30 px-2 py-1 border border-gray-600">{cell.invite_code}</span>
                             <button onClick={handleCopyInvite} className="px-3 py-1 bg-blue-600 text-white font-bold text-sm">{copied ? t('copied') : t('copy')}</button>
                        </div>
                    </div>
                </div>

                <div className="themed-container p-3">
                     <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-gray-400">{t('cell_bank')}</span>
                        <span className="font-bold text-yellow-400">{formatNumber(cell.balance)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">{t('cell_tickets')}</span>
                        <span className="font-bold text-blue-400">{cell.ticketCount || 0}</span>
                    </div>
                </div>

                <AccordionSection title={t('members')} count={cell.members.length} maxCount={config?.cellMaxMembers || 10}>
                    <div className="flex justify-between items-center mb-3 text-sm">
                        <span className="text-gray-400">{t('total_cell_profit')}</span>
                        <span className="font-bold text-green-400">+{formatNumber(cell.totalProfitPerHour)}/hr</span>
                    </div>
                    <ul className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-2">
                        {cell.members.map(member => (
                            <li key={member.id} className="bg-black/20 p-2 flex justify-between items-center">
                                <span className={member.id === user?.id ? 'font-bold text-green-300' : ''}>{member.name}</span>
                                <span className="text-sm text-green-400">+{formatNumber(member.profitPerHour)}/hr</span>
                            </li>
                        ))}
                    </ul>
                </AccordionSection>

                <AccordionSection title={t('informants')} count={cell.informants.length}>
                    <div className="space-y-3 max-h-48 overflow-y-auto no-scrollbar pr-2">
                        {cell.informants.length > 0 ? (
                            cell.informants.map(info => <InformantCard key={info.id} informant={info} />)
                        ) : (
                            <p className="text-gray-500 text-center py-4">{t('no_informants_recruited')}</p>
                        )}
                    </div>
                </AccordionSection>

                {error && <p className="text-red-400 text-center text-sm mt-2">{error}</p>}
                
                <div className="space-y-2 pt-2">
                    <button onClick={handleBuyTicket} disabled={!canAffordTicket || isBuyingTicket} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 disabled:bg-gray-600">
                        {isBuyingTicket ? t('loading') : `${t('buy_ticket')} (${formatNumber(ticketCost)})`}
                    </button>
                    <button onClick={handleRecruitInformant} disabled={isRecruiting} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 disabled:bg-gray-600">
                        {isRecruiting ? t('recruiting') : t('recruit_informant')}
                    </button>
                    <button onClick={handleLeaveCell} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2">{t('leave_cell')}</button>
                </div>
            </div>
        );
    }

    if (createMode) {
        return (
            <div className="w-full max-w-md space-y-4">
                <h2 className="text-2xl font-display text-center">{t('create_cell')}</h2>
                <input
                    type="text"
                    value={cellName}
                    onChange={(e) => setCellName(e.target.value)}
                    placeholder={t('enter_cell_name')}
                    className="w-full bg-black/30 border border-gray-600 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 text-center"
                />
                <p className="text-center text-sm text-gray-400">Cost: {config?.cellCreationCost.toLocaleString()} coins</p>
                {error && <p className="text-red-400 text-center text-sm">{error}</p>}
                <div className="flex space-x-2">
                     <button onClick={() => { setCreateMode(false); setError('') }} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-2">{t('cancel')}</button>
                    <button onClick={handleCreateCell} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2">{t('create')}</button>
                </div>
            </div>
        );
    }

    if (joinMode) {
        return (
            <div className="w-full max-w-md space-y-4">
                <h2 className="text-2xl font-display text-center">{t('join_cell')}</h2>
                <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder={t('enter_invite_code')}
                    className="w-full bg-black/30 border border-gray-600 text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 text-center"
                    autoCapitalize="characters"
                />
                {error && <p className="text-red-400 text-center text-sm">{error}</p>}
                <div className="flex space-x-2">
                     <button onClick={() => { setJoinMode(false); setError('') }} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-2">{t('cancel')}</button>
                    <button onClick={handleJoinCell} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2">{t('join')}</button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="w-full max-w-md text-center space-y-4">
            <h2 className="text-2xl font-display">{t('cell')}</h2>
            <p className="text-gray-400">{t('no_cell_info')}</p>
            <div className="flex space-x-4">
                <button onClick={() => setCreateMode(true)} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3">{t('create_cell')}</button>
                <button onClick={() => setJoinMode(true)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3">{t('join_cell')}</button>
            </div>
        </div>
    );
};

export default CellScreen;
