import React from 'react';
import { useTranslation } from '../hooks/useGameLogic';
import { DailyTask, SpecialTask, Language, PlayerState, UiIcons } from '../types';
import { formatNumber } from '../utils';

interface TaskCardProps {
    task: DailyTask | SpecialTask;
    playerState: PlayerState;
    onClaim: (task: DailyTask | SpecialTask) => void;
    onPurchase?: (task: SpecialTask) => void;
    lang: Language;
    startedTasks: Set<string>;
    uiIcons: UiIcons;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, playerState, onClaim, onPurchase, lang, startedTasks, uiIcons }) => {
    const t = useTranslation();
    const isDaily = !('isOneTime' in task);
    const isCompleted = isDaily 
        ? playerState.completedDailyTaskIds.includes(task.id) 
        : playerState.completedSpecialTaskIds.includes(task.id);
    
    const isPurchased = isDaily ? true : playerState.purchasedSpecialTaskIds.includes(task.id);
    const isStarted = startedTasks.has(task.id);

    let progressDisplay: string | null = null;
    let claimIsDisabled = false;

    if (isDaily && task.type === 'taps') {
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

        if (!isDaily && (task as SpecialTask).priceStars > 0 && !isPurchased && onPurchase) {
            return (
                <button onClick={() => onPurchase(task as SpecialTask)} className="interactive-button rounded-lg font-bold py-2 px-3 text-sm flex items-center justify-center space-x-1.5 w-full">
                    <span>{t('unlock_for')} {(task as SpecialTask).priceStars}</span>
                    <img src={uiIcons.star} alt="star" className="w-4 h-4"/>
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
                            <img src={task.imageUrl} alt={task.name?.[lang]} className="w-full h-full object-contain" />
                        </div>
                    )}
                    <div className="flex-grow min-w-0">
                        <p className="text-white text-left font-semibold" title={task.name?.[lang]}>{task.name?.[lang]}</p>
                    </div>
                </div>
                {'description' in task && <p className="text-[var(--text-secondary)] text-xs text-left" title={(task as SpecialTask).description?.[lang]}>{(task as SpecialTask).description?.[lang]}</p>}
                <div className="text-yellow-400 text-sm text-left mt-2 flex items-center space-x-1 font-bold">
                    <img src={rewardIconUrl} alt="reward" className="w-4 h-4" />
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

export default TaskCard;
