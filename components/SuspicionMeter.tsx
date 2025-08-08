
import React from 'react';
import { useTranslation } from '../hooks/useGameLogic';

interface SuspicionMeterProps {
  value: number;
  max: number;
  iconUrl?: string;
  orientation?: 'horizontal' | 'vertical';
}

const SuspicionMeter: React.FC<SuspicionMeterProps> = ({ value, max, iconUrl, orientation = 'horizontal' }) => {
  const t = useTranslation();
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  
  const getColor = () => {
    if (percentage > 75) return 'bg-red-500';
    if (percentage > 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (orientation === 'vertical') {
    return (
      <div className="h-full flex flex-col items-center">
        <div className="text-center text-sm mb-2">
          {iconUrl && <img src={iconUrl} alt="icon" className="w-6 h-6 mx-auto mb-1" />}
          <span className="font-bold text-gray-200">{t('suspicion')}</span>
        </div>
        <div className="h-full w-4 bg-black/30 border border-gray-600 flex-grow flex flex-col-reverse">
          <div
            className={`w-full ${getColor()}`}
            style={{
              height: `${percentage}%`,
              transition: 'height 0.3s ease-in-out, background-color 0.3s ease-in-out',
            }}
          ></div>
        </div>
        <span className="font-mono text-gray-400 text-xs mt-2">{Math.floor(value)}/{max}</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center text-sm mb-1 px-1">
        <span className="font-bold flex items-center gap-2 text-gray-200">
          {iconUrl && <img src={iconUrl} alt="icon" className="w-5 h-5" />}
          {t('suspicion')}
        </span>
        <span className="font-mono text-gray-400">{Math.floor(value)} / {max}</span>
      </div>
      <div className="w-full bg-black/30 h-4 border border-gray-600">
        <div
          className={`h-full ${getColor()}`}
          style={{
            width: `${percentage}%`,
            transition: 'width 0.3s ease-in-out, background-color 0.3s ease-in-out',
          }}
        ></div>
      </div>
    </div>
  );
};

export default SuspicionMeter;