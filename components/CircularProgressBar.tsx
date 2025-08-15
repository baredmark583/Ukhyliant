import React from 'https://esm.sh/react';
import { useTranslation } from '../hooks/useGameLogic';

interface CircularProgressBarProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  iconUrl: string;
  color: string;
}

const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000_000) return `${(num / 1_000_000_000_000).toFixed(1)}T`;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return Math.floor(num).toString();
};

const isExternal = (url: string | undefined) => url && url.startsWith('http');

const CircularProgressBar: React.FC<CircularProgressBarProps> = ({ value, max, size = 60, strokeWidth = 8, iconUrl, color }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedValue = Math.min(value, max);
  const offset = max > 0 ? circumference - (clampedValue / max) * circumference : circumference;

  return (
    <div className="p-1 flex items-center justify-center relative" style={{ width: size, height: size }}>
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
      <div className="flex flex-col items-center justify-center z-10 p-1 space-y-0.5">
        <img src={iconUrl} alt="icon" className="w-[45%] h-[45%]" {...(isExternal(iconUrl) && { crossOrigin: 'anonymous' })} />
        <div className="flex flex-col items-center justify-center leading-tight">
          <span className="font-mono text-[9px] font-bold text-[var(--text-primary)]">{formatNumber(value)}</span>
          <span className="font-mono text-[8px] text-[var(--text-secondary)] -mt-0.5">/ {formatNumber(max)}</span>
        </div>
      </div>
    </div>
  );
};

export default CircularProgressBar;