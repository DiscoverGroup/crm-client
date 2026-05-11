import React from 'react';
import './ui.css';

interface SectionLabelProps {
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}

const SectionLabel: React.FC<SectionLabelProps> = ({ children, pulse = true, className = '' }) => {
  return (
    <div className={`ui-section-label ${className}`.trim()}>
      <span className={`ui-section-label__dot ${pulse ? 'ui-section-label__dot--pulse' : ''}`.trim()} />
      <span className="ui-section-label__text">{children}</span>
    </div>
  );
};

export default SectionLabel;
