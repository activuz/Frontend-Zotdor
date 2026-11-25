import React, { useState } from 'react';
import { useSaveSettings, useSettings, type Settings as SettingsT } from '../api/panel';
import { useMe } from '../auth/api';
import { formatDateTime } from '../lib/format';
import { PageError, PageLoading } from '../components/PageState';
import { Button } from '../components/Button';
import { Alert, inputClass } from '../components/Field';
import { Title } from './common';

type Key = Exclude<keyof SettingsT, 'updated_at'>;

const FIELDS: { key: Key; label: string; hint?: string }[] = [
  { key: 'commission_rate_bp', label: 'Komissiya stavkasi (bazis punkt)', hint: '20 = 0,2%' },
  { key: 'signup_bonus', label: 'Roʻyxatdan oʻtish bonusi, soʻm' },
  { key: 'bonus_ttl_days', label: 'Bonus amal qilish muddati, kun', hint: 'Har yangi bonus tushganda qayta hisoblanadi' },
  { key: 'cashback_pct', label: 'Keshbek, komissiyaning %', hint: 'Bitimdan keyin sotuvchining bonus hamyoniga' },
  { key: 'min_bid_pct', label: 'Eng kichik taklif, narxning %' },
  { key: 'max_bid_pct', label: 'Eng katta taklif, narxning %' },
  { key: 'min_duration_min', label: 'Eng qisqa davomiylik, daqiqa' },
  { key: 'max_duration_min', label: 'Eng uzun davomiylik, daqiqa' },
  { key: 'max_schedule_ahead_days', label: 'Oldindan rejalashtirish, kun' },
  { key: 'decision_window_h', label: 'Xaridorni tanlash muddati, soat' },
  { key: 'early_accept_min_minutes', label: '“Hozir sotish”gacha, daqiqa' },
  { key: 'claim_window_days', label: '“Bitim boʻlmadi” arizasi muddati, kun' },
  { key: 'rating_window_days', label: 'Baholash muddati, kun' },
  { key: 'photos_min', label: 'Rasmlar, kamida' },
  { key: 'photos_max', label: 'Rasmlar, koʻpi bilan' },
  { key: 'videos_min', label: 'Videolar, kamida' },
  { key: 'videos_max', label: 'Videolar, koʻpi bilan' },
  { key: 'video_max_s', label: 'Video uzunligi, soniya' },
];

/** Business settings (BR-xx limits). Moderators can read, only admins can change. */
export const Settings: React.FC = () => {
  const settings = useSettings();
  const save = useSaveSettings();
  const isAdmin = useMe().data?.role === 'admin';
  const [draft, setDraft] = useState<Partial<Record<Key, string>>>({});

  if (settings.isPending) return <PageLoading />;
  if (settings.isError) return <PageError message={settings.error.message} onRetry={() => void settings.refetch()} />;
  const s = settings.data;
  const changed = Object.entries(draft).filter(([k, v]) => v !== undefined && Number(v) !== s[k as Key]);

  return (
    <div className="max-w-3xl">
      <Title>Sozlamalar</Title>
      <p className="mb-4 text-[15px] text-ink-muted">Oxirgi oʻzgarish: {formatDateTime(s.updated_at)}</p>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const patch = Object.fromEntries(changed.map(([k, v]) => [k, Number(v)]));
          save.mutate(patch, { onSuccess: () => setDraft({}) });
        }}
      >
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={f.key} className="block text-[15px] font-semibold mb-1">
              {f.label}
            </label>
            <input
              id={f.key}
              inputMode="numeric"
              disabled={!isAdmin}
              value={draft[f.key] ?? String(s[f.key] ?? '')}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value.replace(/\D/g, '') }))}
              className={inputClass}
            />
            {f.hint && <p className="mt-1 text-[13px] text-ink-muted">{f.hint}</p>}
          </div>
        ))}
        <div className="sm:col-span-2 space-y-2">
          {save.isError && <Alert>{save.error.message}</Alert>}
          {save.isSuccess && changed.length === 0 && <Alert tone="success">Saqlandi.</Alert>}
          {isAdmin ? (
            <Button type="submit" variant="primary" disabled={changed.length === 0 || save.isPending}>
              Saqlash
            </Button>
          ) : (
            <p className="text-[15px] text-ink-muted">Sozlamalarni faqat administrator oʻzgartira oladi.</p>
          )}
        </div>
      </form>
    </div>
  );
};
