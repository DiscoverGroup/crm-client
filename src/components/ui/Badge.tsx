import React from 'react';
import './ui.css';

type BadgeVariant = 'status' | 'package' | 'count';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  color?: string;
}

const Badge: React.FC<BadgeProps> = ({
  variant = 'status',
  color,
  className = '',
  style,
  children,
  ...props
}) => {
  const classes = `ui-badge ui-badge--${variant} ${className}`.trim();

  const mergedStyle: React.CSSProperties = {
    ...(variant === 'status' && color ? { backgroundColor: color, color: '#fff' } : {}),
    ...style,
  };

  return (
    <span className={classes} style={mergedStyle} {...props}>
      {children}
    </span>
  );
};

export default Badge;
