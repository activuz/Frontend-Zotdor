import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const BASE =
  'inline-flex items-center justify-center gap-2 min-h-touch px-5 rounded-xl text-[15px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed';

const VARIANTS: Record<Variant, string> = {
  // DESIGN.md §1.3: only one filled dark button per screen.
  primary: 'bg-ink text-white hover:bg-brand',
  secondary: 'border border-line bg-surface text-ink hover:border-brand',
  danger: 'border border-line bg-surface text-danger hover:border-danger',
  ghost: 'text-brand hover:bg-brand-soft',
};

export function buttonClass(variant: Variant = 'secondary', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }> = ({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...rest
}) => <button type={type} className={buttonClass(variant, className)} {...rest} />;

export const ButtonLink: React.FC<LinkProps & { variant?: Variant }> = ({
  variant = 'secondary',
  className = '',
  ...rest
}) => <Link className={buttonClass(variant, className)} {...rest} />;
