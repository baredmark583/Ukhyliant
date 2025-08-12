import React from 'react';
import { useTranslation } from '../hooks/useGameLogic';

interface CircularProgressBarProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  labelKey: 'energy' | 'suspicion';
  iconUrl: string;
  color: string;
}

const CircularProgressBar: React.FC<CircularProgressBarProps> = ({ value, max, size = 80, strokeWidth = 8, labelKey, iconUrl, color }) => {
  const t = useTranslation();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedValue = Math.min(value, max);
  const offset = circumference - (clampedValue / max) * circumference;

  return (
    <div className="neumorphic-pressed rounded-full p-1 flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="flex flex-col items-center justify-center text-center w-full h-full relative">
        <svg width={size} height={size} className="absolute top-0 left-0">
          <circle
            className="circular-progress-track"
            strokeWidth={strokeWidth}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className="circular-progress-bar"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        <div className="flex flex-col items-center justify-center z-10 p-1">
          <img src={iconUrl} alt={t(labelKey)} className="w-[40%] h-[40%]" />
          <span className="text-[10px] font-bold text-[var(--text-primary)] leading-tight">{t(labelKey)}</span>
          <span className="font-mono text-[9px] text-[var(--text-secondary)] leading-tight">{Math.floor(value)}</span>
        </div>
      </div>
    </div>
  );
};

export default CircularProgressBar;