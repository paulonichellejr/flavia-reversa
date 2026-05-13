'use client';

import { SelectHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

interface FlaviaSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const FlaviaSelect = forwardRef<HTMLSelectElement, FlaviaSelectProps>(
  ({ label, error, hint, required, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-mocha-700">
            {label}
            {required && <span style={{ color: '#D2B6C2' }} aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={!!error}
            className={clsx(
              'w-full h-11 rounded-flavia border bg-white px-4 pr-10 text-base text-mocha-900 appearance-none',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-sage-400 focus:border-sage-400',
              error
                ? 'border-danger-500'
                : 'border-flavia-200 hover:border-flavia-300',
              props.disabled && 'opacity-50 cursor-not-allowed bg-cream-100',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-mocha-500 pointer-events-none"
            aria-hidden="true"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger-500">⚠ {error}</p>
        )}
        {!error && hint && (
          <p className="text-xs text-mocha-500">{hint}</p>
        )}
      </div>
    );
  }
);

FlaviaSelect.displayName = 'FlaviaSelect';
