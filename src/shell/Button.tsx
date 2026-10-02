import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import './button.css';

export type ButtonVariant = 'outline' | 'default' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'icon';

type Props = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = 'outline', size = 'md', children, className = '', type = 'button', ref, ...rest }: Props) {
  const classes = ['btn', `btn-${variant}`, `btn-${size}`, className].filter(Boolean).join(' ');
  return <button ref={ref} type={type} className={classes} {...rest}>{children}</button>;
}
