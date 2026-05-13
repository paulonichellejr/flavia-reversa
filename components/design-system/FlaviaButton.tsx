'use client';

import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface FlaviaButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

// Cores reais extraídas do site via JavaScript
const CORES = {
  sageBtn:      '#9BAA81', // verde sage — botão "Comprar" real
  sageBtnHover: '#879869', // sage escurecido para hover
  rosaBtn:      '#D2B6C2', // rosa-mauve real
  rosaBtnHover: '#C4A0AF',
  textEscuro:   '#333333',
  textMedio:    '#485059',
  bordaBege:    '#DED5C8',
};

const variantClasses: Record<Variant, string> = {
  primary:   'text-white shadow-flavia hover:shadow-flavia-md disabled:opacity-50',
  secondary: 'bg-white border disabled:opacity-50',
  ghost:     'bg-transparent disabled:opacity-40',
  danger:    'bg-danger-500 text-white hover:bg-danger-700 focus-visible:ring-2 focus-visible:ring-danger-500 disabled:opacity-50',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm rounded-flavia',
  md: 'h-11 px-6 text-base rounded-flavia',
  lg: 'h-13 px-8 text-lg rounded-flavia-lg',
};

// Inline styles por variante — usa as cores reais extraídas do site
function getInlineStyle(variant: Variant): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return { backgroundColor: CORES.sageBtn };   // verde sage real
    case 'secondary':
      return { borderColor: CORES.bordaBege, color: CORES.textMedio };
    case 'ghost':
      return { color: CORES.sageBtn };
    default:
      return {};
  }
}

export const FlaviaButton = forwardRef<HTMLButtonElement, FlaviaButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      className,
      children,
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={{ ...getInlineStyle(variant), ...style }}
        className={clsx(
          'inline-flex items-center justify-center gap-2',
          'font-medium transition-all duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'cursor-pointer select-none',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          (loading || disabled) && 'cursor-not-allowed',
          className
        )}
        {...props}
      >
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
        )}
        {children}
      </button>
    );
  }
);

FlaviaButton.displayName = 'FlaviaButton';
