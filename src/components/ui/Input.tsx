import React from 'react';
import './ui.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className = '', ...props }, ref) => {
  const classes = `ui-input ${className}`.trim();
  return <input ref={ref} className={classes} {...props} />;
});

Input.displayName = 'Input';

export default Input;
