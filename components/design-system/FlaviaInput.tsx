'use client';

import { InputHTMLAttributes, forwardRef, ReactNode } from 'react';
import { clsx } from 'clsx';

interface FlaviaInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
  required?: boolean;
}

export const FlaviaInput = forwardRef<HTMLInputElement, FlaviaInputProps>(
  (
    { label, error, hint, leftIcon, rightElement, required, className, id, ...props },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium"
            style={{ color: '#485059' }}
          >
            {label}
            {required && (
              <span style={{ color: '#D2B6C2' }} aria-hidden="true">*</span>
            )}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3.5 text-mocha-500 pointer-events-none">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            aria-invalid={!!error}
            className={clsx(
              'w-full h-11 rounded-flavia border bg-white px-4 text-base text-mocha-900',
              'placeholder:text-mocha-500/60',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-sage-400 focus:border-sage-400',
              error
                ? 'border-danger-500 focus:ring-danger-500'
                : 'border-flavia-200 hover:border-flavia-400',
              leftIcon && 'pl-10',
              rightElement && 'pr-12',
              props.disabled && 'opacity-50 cursor-not-allowed bg-cream-100',
              className
            )}
            {...props}
          />

          {rightElement && (
            <span className="absolute right-3.5">
              {rightElement}
            </span>
          )}
        </div>

        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-sm text-danger-500 flex items-center gap-1">
            <span aria-hidden="true">⚠</span> {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="text-xs text-mocha-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

FlaviaInput.displayName = 'FlaviaInput';
