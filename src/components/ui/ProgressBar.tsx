import React from 'react';
import './ui.css';

type ProgressBarVariant = 'default' | 'success' | 'error';

interface ProgressBarProps {
  value: number;
  label?: string;
  variant?: ProgressBarVariant;
  showPercent?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  variant = 'default',
  showPercent = false,
}) => {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="ui-progress">
      {(label || showPercent) && (
        <div className="ui-progress__header">
          {label && <span className="ui-progress__label">{label}</span>}
          {showPercent && <span className="ui-progress__percent">{Math.round(clamped)}%</span>}
        </div>
      )}
      <div
        className="ui-progress__track"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`ui-progress__fill ui-progress__fill--${variant}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
