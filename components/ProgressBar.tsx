
import React from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  colorClass: string;
  label?: string;
  icon?: React.ReactNode;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, max, colorClass, label, icon }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center text-white text-sm mb-1 px-1">
          <span className="font-bold flex items-center gap-1">{icon}{label}</span>
          <span className="font-mono">{Math.floor(value)} / {max}</span>
        </div>
      )}
      <div className="w-full bg-gray-700 rounded-full h-3.5">
        <div className={`${colorClass} h-3.5 rounded-full`} style={{ width: `${percentage}%`, transition: 'width 0.3s ease-in-out' }}></div>
      </div>
    </div>
  );
};

export default ProgressBar;
