import React from 'react';
import './ui.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'warning' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const classes = `ui-button ui-button--${variant} ui-button--${size} ${className}`.trim();
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
};

export default Button;
