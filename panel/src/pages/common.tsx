import React, { useId, useState } from 'react';
import { Button } from '../components/Button';
import { Alert } from '../components/Field';
import { PAGE } from '../api/panel';

export const Title: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h1 className="font-display text-[28px] text-ink mb-4">{children}</h1>
);

export const Tabs: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ value, options, onChange }) => (
  <div role="tablist" className="mb-4 flex flex-wrap gap-2">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        role="tab"
        aria-selected={value === o.value}
        onClick={() => onChange(o.value)}
        className={`min-h-touch px-4 rounded-full border text-[15px] font-semibold ${value === o.value ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-surface text-ink-muted'}`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const Pager: React.FC<{ offset: number; count: number; onChange: (offset: number) => void }> = ({
  offset,
  count,
  onChange,
}) => {
  if (count <= PAGE) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-2 text-[15px]">
      <Button disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - PAGE))}>
        Oldingi
      </Button>
      <span className="text-ink-muted tabular-nums">
        {offset + 1}–{Math.min(offset + PAGE, count)} / {count}
      </span>
      <Button disabled={offset + PAGE >= count} onClick={() => onChange(offset + PAGE)}>
        Keyingi
      </Button>
    </div>
  );
};

interface Action {
  key: string;
  label: string;
  variant?: 'primary' | 'danger' | 'secondary';
  needsNote?: boolean;
}

/** "Information → decision → note" block shared by every queue (F7.3). */
export const DecisionForm: React.FC<{
  actions: Action[];
  pending: boolean;
  error?: string;
  notePlaceholder?: string;
  onSubmit: (key: string, note: string) => void;
}> = ({ actions, pending, error, notePlaceholder = 'Izoh (foydalanuvchiga koʻrinadi)', onSubmit }) => {
  const id = useId();
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);
  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor={id}>
        Izoh
      </label>
      <textarea
        id={id}
        rows={2}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setMissing(false);
        }}
        placeholder={notePlaceholder}
        className="w-full rounded-xl border border-line bg-surface p-3 text-[15px]"
      />
      {missing && <p className="text-[13px] text-danger">Bu amal uchun izoh yozing.</p>}
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.key}
            variant={a.variant ?? 'secondary'}
            disabled={pending}
            onClick={() => {
              if (a.needsNote && !note.trim()) {
                setMissing(true);
                return;
              }
              onSubmit(a.key, note.trim());
            }}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export const AUCTION_STATUS: Record<string, string> = {
  draft: 'Qoralama',
  pending_review: 'Moderatsiyada',
  rejected: 'Rad etilgan',
  scheduled: 'Rejalashtirilgan',
  live: 'Jonli',
  ended: 'Tugagan',
  sold: 'Sotilgan',
  unsold: 'Sotilmagan',
  cancelled: 'Bekor qilingan',
  blocked: 'Bloklangan',
};
