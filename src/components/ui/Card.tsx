import React from 'react';
import './ui.css';

type CardVariant = 'default' | 'soft' | 'elevated';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const Card: React.FC<CardProps> = ({ variant = 'default', className = '', children, ...props }) => {
  const variantClass = variant === 'default' ? '' : `ui-card--${variant}`;
  const classes = `ui-card ${variantClass} ${className}`.trim();

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

export default Card;
