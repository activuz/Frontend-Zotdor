import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bug } from 'lucide-react';
import { api } from '../../api/http';
import type { components } from '../../api/schema';
import { useMe } from '../auth/api';
import { Button } from '../../components/ui/Button';
import { Alert, Field, inputClass } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';

type BugReportIn = components['schemas']['BugReportInRequest'];

const MIN = 10;
const MAX = 2000;
const LABEL = 'Xatolik haqida xabar berish';

/**
 * "Xatolik haqida xabar berish" (FR-19). The page address, screen size and, after a crash, the
 * error text go with the report, so staff can reproduce it; the form says so.
 */
export const ReportProblemButton: React.FC<{
  /** Error text to attach, e.g. from the error boundary or a failed request. */
  error?: string;
  variant?: 'link' | 'row' | 'button';
  className?: string;
}> = ({ error, variant = 'link', className = '' }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === 'button' ? (
        <Button variant="ghost" className={className} onClick={() => setOpen(true)}>
          <Bug className="w-4 h-4" aria-hidden="true" />
          {LABEL}
        </Button>
      ) : variant === 'row' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex w-full items-center gap-3 min-h-touch px-5 py-3 text-[15px] font-semibold text-ink ${className}`}
        >
          <Bug className="w-5 h-5 text-brand" aria-hidden="true" />
          {LABEL}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`hover:text-ink ${className}`}>
          {LABEL}
        </button>
      )}
      <Modal open={open} title={LABEL} onClose={() => setOpen(false)}>
        {open && <ReportForm error={error} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
};

const ReportForm: React.FC<{ error?: string; onDone: () => void }> = ({ error, onDone }) => {
  const { data: me } = useMe();
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [tried, setTried] = useState(false);
  const send = useMutation({
    mutationFn: (body: BugReportIn) => api<{ id: string }>('POST', '/bug-reports', body),
  });
  const short = message.trim().length < MIN;

  if (send.isSuccess)
    return (
      <div className="space-y-4">
        <Alert tone="success">Rahmat! Xabaringiz jamoamizga yuborildi, tez orada koʻrib chiqamiz.</Alert>
        <Button variant="primary" className="w-full" onClick={onDone}>
          Yopish
        </Button>
      </div>
    );

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (short) return;
        send.mutate({
          message: message.trim(),
          contact: me ? '' : contact.trim(),
          page_url: window.location.href,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          error: error ?? '',
        });
      }}
    >
      <Field
        label="Nima boʻldi?"
        hint="Qaysi sahifada, nima qilganingizda va nima boʻlishini kutgan edingiz."
        error={tried && short ? `Kamida ${MIN} ta belgi yozing.` : undefined}
      >
        {(p) => (
          <textarea
            {...p}
            rows={5}
            maxLength={MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface p-3 text-[15px] text-ink focus:border-brand focus:outline-none"
          />
        )}
      </Field>
      {!me && (
        <Field label="Telefon yoki Telegram (ixtiyoriy)" hint="Sizga javob berishimiz uchun.">
          {(p) => (
            <input
              {...p}
              value={contact}
              maxLength={64}
              onChange={(e) => setContact(e.target.value)}
              className={inputClass}
            />
          )}
        </Field>
      )}
      <p className="text-[13px] text-ink-muted">
        Xabar bilan sahifa manzili, ekran oʻlchami va brauzer nomi{error ? ', shuningdek xato matni' : ''} yuboriladi.
      </p>
      {send.isError && <Alert>{send.error.message}</Alert>}
      <Button type="submit" variant="primary" className="w-full" disabled={send.isPending}>
        {send.isPending ? 'Yuborilmoqda…' : 'Yuborish'}
      </Button>
    </form>
  );
};
