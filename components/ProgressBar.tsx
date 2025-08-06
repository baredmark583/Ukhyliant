
import React from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  icon?: React.ReactNode;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, max, label, icon }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center text-sm mb-1 px-1">
          <span className="font-bold flex items-center gap-2 text-gray-200">{icon}{label}</span>
          <span className="font-mono text-gray-400">{Math.floor(value)} / {max}</span>
        </div>
      )}
      <div className="w-full bg-black/30 h-4 border border-gray-600">
        <div 
          className="h-full bg-green-500" 
          style={{ 
            width: `${percentage}%`, 
            transition: 'width 0.3s ease-in-out',
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.3) 4px, rgba(0,0,0,0.3) 5px)'
          }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;