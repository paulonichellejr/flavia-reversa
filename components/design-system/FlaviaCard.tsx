import React, { HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

type CardVariant = 'default' | 'elevated' | 'outlined' | 'success' | 'warning' | 'danger';

interface FlaviaCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  children: ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  // Usa as cores reais da loja: bege #DED5C8 para borda, branco puro para fundo
  default:  'bg-white shadow-flavia',
  elevated: 'bg-white shadow-flavia-md',
  outlined: 'bg-transparent',
  success:  'bg-success-100 border border-success-500/30',
  warning:  'bg-warning-100 border border-warning-500/30',
  danger:   'bg-danger-100 border border-danger-500/30',
};

const variantInlineStyles: Record<CardVariant, React.CSSProperties> = {
  default:  { border: '1px solid #DED5C8' },
  elevated: { border: '1px solid #DED5C8' },
  outlined: { border: '2px solid #D2B6C2' },
  success:  {},
  warning:  {},
  danger:   {},
};

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function FlaviaCard({
  variant = 'default',
  padding = 'md',
  className,
  style,
  children,
  ...props
}: FlaviaCardProps) {
  return (
    <div
      className={clsx(
        'rounded-flavia-lg',
        variantStyles[variant],
        paddingStyles[padding],
        className
      )}
      style={{ ...variantInlineStyles[variant], ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
