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

const VARIANTS: Record<ButtonVariant, string> = {
  outline: 'border-[#3a3b40] bg-[#1e1f22] text-[#e6e6e6] hover:bg-[#26272b] hover:border-[#f59e0b]/60',
  default: 'border-[#69614f] bg-[#393939] text-[#f0cb82] hover:bg-[#45413a] hover:border-[#f59e0b] hover:text-[#ffe0a3]',
  ghost: 'border-transparent bg-transparent text-[#9a9aa0] hover:bg-[#26272b] hover:text-[#e6e6e6]',
  danger: 'border-[#6e4a4a] bg-[#1e1f22] text-[#e8a0a0] hover:border-[#e57373] hover:bg-[#463333] hover:text-[#ffc9c9]',
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
    'focus:outline-none focus-visible:ring-1 focus-visible:ring-[#f59e0b]/60',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    recording && variant === 'default' ? 'bg-[#303030] text-[#efba65]' : '',
    className,
  ].filter(Boolean).join(' ');
  return <button ref={ref} type={type} className={classes} {...rest}>{children}</button>;
}
