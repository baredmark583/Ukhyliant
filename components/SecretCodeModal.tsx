import React, { useState } from 'react';
import { useTranslation } from '../hooks/useGameLogic';
import { DailyTask, SpecialTask, Language } from '../types';

interface SecretCodeModalProps {
  task: DailyTask | SpecialTask;
  onClose: () => void;
  onSubmit: (code: string) => void;
  lang: Language;
}

const SecretCodeModal: React.FC<SecretCodeModalProps> = ({ task, onClose, onSubmit, lang }) => {
  const [code, setCode] = useState('');
  const t = useTranslation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      onSubmit(code.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card-glow bg-slate-800 rounded-2xl w-full max-w-sm flex flex-col p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white truncate pr-4">{task.name?.[lang]}</h2>
          <button onClick={onClose} className="text-gray-400 text-3xl font-light flex-shrink-0">&times;</button>
        </div>
        
        <p className="text-[var(--text-secondary)] text-sm mb-4">{t('enter_secret_code')}</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full input-field mb-4 text-center font-mono tracking-widest text-lg"
            placeholder="CODE"
            autoFocus
            autoCapitalize="characters"
          />
          <button
            type="submit"
            disabled={!code.trim()}
            className="w-full interactive-button rounded-lg font-bold py-3 text-lg"
          >
            {t('check')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SecretCodeModal;