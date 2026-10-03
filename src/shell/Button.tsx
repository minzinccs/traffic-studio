import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

export type ButtonVariant = 'outline' | 'default' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'icon';

type Props = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
} & ButtonHTMLAttributes<HTMLButtonElement>;

// Variants use theme tokens (var(--*)) so palette changes propagate from theme.css.
// Only semantic colors (danger red) stay hardcoded because theme has no error token yet.
const VARIANTS: Record<ButtonVariant, string> = {
  outline: 'border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)] hover:border-[var(--amber)]',
  default: 'border-[var(--amber)] bg-[var(--surface-2)] text-[var(--amber)] hover:bg-[var(--surface-3)] hover:border-[var(--amber)] hover:text-[#FFE0A3]',
  ghost: 'border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
  danger: 'border-[#6E4A4A] bg-[var(--surface)] text-[#E8A0A0] hover:border-[#E57373] hover:bg-[#463333] hover:text-[#FFC9C9]',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-[24px] px-2 py-0.5 text-[11px] rounded-md',
  md: 'min-h-[28px] px-3 py-1.5 text-sm rounded-md',
  icon: 'h-7 w-7 min-h-[28px] min-w-[28px] p-0 rounded-md',
};

export function Button({ variant = 'outline', size = 'md', children, className = '', type = 'button', ref, ...rest }: Props) {
  const recording = String(className).includes('is-recording');
  const classes = [
    'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap border font-medium leading-normal transition-colors duration-150',
    'focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--amber)]/60',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    recording && variant === 'default' ? 'bg-[var(--surface-2)] text-[var(--amber)]' : '',
    className,
  ].filter(Boolean).join(' ');
  return <button ref={ref} type={type} className={classes} {...rest}>{children}</button>;
}