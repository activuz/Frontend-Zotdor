import React, { useId } from 'react';

export const inputClass =
  'w-full min-h-touch rounded-xl border border-line bg-surface px-3 text-[15px] text-ink focus:border-brand focus:outline-none disabled:opacity-60';

interface ControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/** Label + control + hint/error, wired with ids for screen readers. */
export const Field: React.FC<{
  label: string;
  hint?: string;
  error?: string;
  children: (props: ControlProps) => React.ReactNode;
}> = ({ label, hint, error, children }) => {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-[15px] font-semibold text-ink mb-1">
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[13px] text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-[13px] text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
};

/** Money input that shows "25 000 000" while keeping a number in state (F2). */
export const MoneyInput: React.FC<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
    value: number | null;
    onChange: (value: number | null) => void;
  }
> = ({ value, onChange, className = '', ...rest }) => (
  <div className="relative">
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value === null ? '' : String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
        onChange(digits ? Number(digits) : null);
      }}
      className={`${inputClass} pr-14 tabular-nums ${className}`}
    />
    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[15px] text-ink-muted pointer-events-none">
      soʻm
    </span>
  </div>
);

const TONES = {
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
  info: 'bg-brand-soft text-ink',
} as const;

export const Alert: React.FC<{ tone?: keyof typeof TONES; children: React.ReactNode }> = ({
  tone = 'danger',
  children,
}) => (
  <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-xl p-3 text-[15px] ${TONES[tone]}`}>
    {children}
  </div>
);
