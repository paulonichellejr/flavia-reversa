'use client';

import { TextareaHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface FlaviaTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  maxChars?: number;
  currentChars?: number;
}

export const FlaviaTextarea = forwardRef<HTMLTextAreaElement, FlaviaTextareaProps>(
  ({ label, error, hint, required, maxChars, currentChars, className, id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-mocha-700">
            {label}
            {required && <span style={{ color: '#D2B6C2' }} aria-hidden="true">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={!!error}
          className={clsx(
            'w-full rounded-flavia border bg-white px-4 py-3 text-base text-mocha-900 resize-none',
            'placeholder:text-mocha-500/60',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-sage-400 focus:border-sage-400',
            error
              ? 'border-danger-500'
              : 'border-flavia-200 hover:border-flavia-300',
            props.disabled && 'opacity-50 cursor-not-allowed bg-cream-100',
            className
          )}
          rows={4}
          {...props}
        />

        <div className="flex justify-between items-start">
          <div>
            {error && (
              <p role="alert" className="text-sm text-danger-500">⚠ {error}</p>
            )}
            {!error && hint && (
              <p className="text-xs text-mocha-500">{hint}</p>
            )}
          </div>
          {maxChars !== undefined && currentChars !== undefined && (
            <span className={clsx(
              'text-xs ml-auto',
              currentChars > maxChars ? 'text-danger-500' : 'text-mocha-500'
            )}>
              {currentChars}/{maxChars}
            </span>
          )}
        </div>
      </div>
    );
  }
);

FlaviaTextarea.displayName = 'FlaviaTextarea';
