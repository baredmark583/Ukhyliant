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
            <span className="font-bold text-gray-200">{label}</span>
          </div>
        )}
        <div className="h-full w-3 bg-black/30 border border-gray-600 flex-grow flex flex-col-reverse">
          <div
            className="w-full bg-green-500"
            style={{
              height: `${percentage}%`,
              transition: 'height 0.3s ease-in-out',
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.3) 4px, rgba(0,0,0,0.3) 5px)'
            }}
          ></div>
        </div>
         {label && (
            <span className="font-mono text-gray-400 text-xs mt-2">{Math.floor(value)}/{max}</span>
         )}
      </div>
    );
  }


  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center text-sm mb-1 px-1">
          <span className="font-bold flex items-center gap-2 text-gray-200">
            {iconUrl && <img src={iconUrl} alt="icon" className="w-5 h-5" />}
            {label}
          </span>
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