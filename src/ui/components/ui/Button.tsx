import React from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-slate-950 shadow-glow hover:shadow-lift',
  secondary: 'bg-surface text-text border border-white/10 hover:border-white/20',
  danger: 'bg-danger text-white hover:brightness-110',
  ghost: 'bg-transparent text-text border border-white/10 hover:border-white/30'
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-xl',
  md: 'px-4 py-2 text-sm rounded-2xl',
  lg: 'px-5 py-3 text-base rounded-2xl'
}

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}>(({ className, variant = 'secondary', size = 'md', ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-2 font-semibold transition duration-150 ease-out',
      'disabled:cursor-not-allowed disabled:opacity-60',
      'active:scale-[0.98]',
      variantClasses[variant],
      sizeClasses[size],
      className
    )}
    {...props}
  />
))

Button.displayName = 'Button'
