import React from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  iconUrl?: string;
  orientation?: 'horizontal' | 'vertical';
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, max, label, iconUrl, orientation = 'horizontal' }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  if (orientation === 'vertical') {
    return (
      <div className="h-full flex flex-col items-center">
        {label && (
          <div className="text-center text-sm mb-2">
            {iconUrl && <img src={iconUrl} alt="icon" className="w-6 h-6 mx-auto mb-1" />}
            <span className="font-bold text-[var(--text-primary)]">{label}</span>
          </div>
        )}
        <div className="h-full w-4 rounded-full neumorphic-pressed flex-grow flex flex-col-reverse p-0.5">
          <div
            className="w-full rounded-full neumorphic-raised"
            style={{
              height: `${percentage}%`,
              transition: 'height 0.3s ease-in-out',
              background: 'var(--accent-color)'
            }}
          ></div>
        </div>
         {label && (
            <span className="font-mono text-[var(--text-secondary)] text-xs mt-2">{Math.floor(value)}/{max}</span>
         )}
      </div>
    );
  }


  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center text-sm mb-1 px-1">
          <span className="font-bold flex items-center gap-2 text-[var(--text-primary)]">
            {iconUrl && <img src={iconUrl} alt="icon" className="w-5 h-5" />}
            {label}
          </span>
          <span className="font-mono text-[var(--text-secondary)]">{Math.floor(value)} / {max}</span>
        </div>
      )}
      <div className="w-full h-4 rounded-full neumorphic-pressed p-0.5">
        <div 
          className="h-full rounded-full neumorphic-raised" 
          style={{ 
            width: `${percentage}%`, 
            transition: 'width 0.3s ease-in-out',
            background: 'var(--accent-color)'
          }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;