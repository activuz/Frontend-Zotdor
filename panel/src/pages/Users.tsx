import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAdjustWallet, useBlockUser, useSetRole, useUserDetail, useUsers, type PanelUser } from '../api/panel';
import { useMe } from '../auth/api';
import { formatDateTime, formatSom } from '../lib/format';
import { EmptyState, PageError, PageLoading } from '../components/PageState';
import { Button } from '../components/Button';
import { Alert, Field, inputClass } from '../components/Field';
import { AUCTION_STATUS, Pager, Title } from './common';

const ROLE: Record<string, string> = { user: 'Foydalanuvchi', moderator: 'Moderator', admin: 'Administrator' };

export const Users: React.FC = () => {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [offset, setOffset] = useState(0);
  const list = useUsers(q, role, blocked, offset);

  return (
    <div>
      <Title>Foydalanuvchilar</Title>
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <label htmlFor="uq" className="sr-only">Telefon yoki ism</label>
        <input id="uq" type="search" placeholder="Telefon yoki ism" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} className={`${inputClass} max-w-xs`} />
        <label htmlFor="urole" className="sr-only">Rol</label>
        <select id="urole" value={role} onChange={(e) => { setRole(e.target.value); setOffset(0); }} className={`${inputClass} w-auto`}>
          <option value="">Barcha rollar</option>
          {Object.entries(ROLE).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 min-h-touch text-[15px]">
          <input type="checkbox" checked={blocked} onChange={(e) => { setBlocked(e.target.checked); setOffset(0); }} className="w-5 h-5 accent-brand" />
          Faqat bloklanganlar
        </label>
      </div>
      {list.isPending && <PageLoading />}
      {list.isError && <PageError message={list.error.message} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.results.length === 0 && <EmptyState title="Topilmadi" />}
      {list.isSuccess && list.data.results.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-[15px]">
            <thead className="text-left text-ink-muted">
              <tr>
                <th className="p-3 font-semibold">Ism</th>
                <th className="p-3 font-semibold">Telefon</th>
                <th className="p-3 font-semibold">Rol</th>
                <th className="p-3 font-semibold">Hudud</th>
                <th className="p-3 font-semibold">Bitimlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.data.results.map((u) => (
                <tr key={u.id}>
                  <td className="p-3">
                    <Link to={`/users/${u.id}`} className="font-semibold text-brand">
                      {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                    </Link>
                    {u.is_blocked && <span className="ml-2 rounded-lg bg-danger-soft px-2 text-[13px] text-danger">Bloklangan</span>}
                  </td>
                  <td className="p-3 tabular-nums">{u.phone}</td>
                  <td className="p-3">{ROLE[u.role]}</td>
                  <td className="p-3">{u.region}</td>
                  <td className="p-3 tabular-nums">{u.deals_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.isSuccess && <Pager offset={offset} count={list.data.count} onChange={setOffset} />}
    </div>
  );
};

/** F7.4: user card. Wallet adjustment and role change are admin-only. */
export const UserDetail: React.FC = () => {
  const { id = '' } = useParams();
  const detail = useUserDetail(id);
  const { data: me } = useMe();
  const isAdmin = me?.role === 'admin';

  if (detail.isPending) return <PageLoading />;
  if (detail.isError) return <PageError message={detail.error.message} onRetry={() => void detail.refetch()} />;
  const { user: u, wallet: w, entries, auctions, reports_against, audit } = detail.data;

  return (
    <div className="space-y-5">
      <Link to="/users" className="inline-flex min-h-touch items-center text-[15px] font-semibold text-brand">← Roʻyxatga qaytish</Link>
      <Title>{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.phone}</Title>
      <section className="rounded-2xl border border-line bg-surface p-4 text-[15px] space-y-1">
        <p className="tabular-nums">{u.phone} · {ROLE[u.role]}</p>
        <p>{[u.district, u.region].filter(Boolean).join(', ')}</p>
        <p className="text-ink-muted">
          Roʻyxatdan oʻtgan: {formatDateTime(u.created_at)} · Bitimlar: {u.deals_count} · Reyting:{' '}
          {u.rating_avg?.toFixed(1) ?? '—'} ({u.rating_count}) · Shikoyatlar: {reports_against}
        </p>
        {u.is_blocked && <Alert>Bloklangan: {u.blocked_reason}</Alert>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <BlockForm user={u} />
        {isAdmin && me?.id !== u.id && <RoleForm user={u} />}
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4 space-y-3">
        <h2 className="font-display text-[20px]">Hamyon</h2>
        <p className="text-[15px] tabular-nums">
          Mavjud: {formatSom(w.available)} · Asosiy: {formatSom(w.main_balance)} · Bonus: {formatSom(w.bonus_balance)} ·
          Band: {formatSom(w.held_amount)}
        </p>
        {isAdmin && <AdjustForm userId={u.id} />}
        <ul className="divide-y divide-line text-[15px]">
          {entries.map((e) => (
            <li key={e.id} className="flex justify-between gap-3 py-2">
              <span>
                {e.title}
                <span className="block text-[13px] text-ink-muted">{formatDateTime(e.created_at)} · {e.bucket}{e.note && ` · ${e.note}`}</span>
              </span>
              <span className="tabular-nums">{formatSom(e.amount, { signed: true })}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-[20px]">Auksionlar</h2>
        {auctions.length === 0 ? (
          <p className="text-[15px] text-ink-muted">Auksion yoʻq.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-[15px]">
            {auctions.map((a) => (
              <li key={a.id}>
                <Link to={`/auctions/${a.id}`} className="text-brand">{a.title || 'Nomsiz'}</Link> ·{' '}
                {AUCTION_STATUS[a.status ?? ''] ?? a.status}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-[20px]">Xodimlar amallari</h2>
        {audit.length === 0 ? (
          <p className="text-[15px] text-ink-muted">Yozuv yoʻq.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-[15px]">
            {audit.map((r, i) => (
              <li key={i}>
                {formatDateTime(r.created_at)} · {r.action} · {r.actor__phone}
                {r.after ? ` · ${JSON.stringify(r.after)}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

const BlockForm: React.FC<{ user: PanelUser }> = ({ user }) => {
  const block = useBlockUser(user.id);
  const [reason, setReason] = useState('');
  return (
    <form
      className="rounded-2xl border border-line bg-surface p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        block.mutate({ blocked: !user.is_blocked, reason: reason.trim() }, { onSuccess: () => setReason('') });
      }}
    >
      <h2 className="font-display text-[20px]">{user.is_blocked ? 'Blokdan chiqarish' : 'Bloklash'}</h2>
      {!user.is_blocked && (
        <Field label="Sabab (foydalanuvchiga koʻrinadi)">
          {(p) => <input {...p} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />}
        </Field>
      )}
      {block.isError && <Alert>{block.error.message}</Alert>}
      <Button type="submit" variant={user.is_blocked ? 'secondary' : 'danger'} disabled={block.isPending || (!user.is_blocked && !reason.trim())}>
        {user.is_blocked ? 'Blokdan chiqarish' : 'Bloklash'}
      </Button>
    </form>
  );
};

const RoleForm: React.FC<{ user: PanelUser }> = ({ user }) => {
  const setRole = useSetRole(user.id);
  const [role, setValue] = useState(user.role);
  return (
    <form
      className="rounded-2xl border border-line bg-surface p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setRole.mutate(role);
      }}
    >
      <h2 className="font-display text-[20px]">Rol</h2>
      <label htmlFor="role" className="sr-only">Rol</label>
      <select id="role" value={role} onChange={(e) => setValue(e.target.value as PanelUser['role'])} className={inputClass}>
        {Object.entries(ROLE).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      {setRole.isError && <Alert>{setRole.error.message}</Alert>}
      <Button type="submit" disabled={setRole.isPending || role === user.role}>Rolni saqlash</Button>
    </form>
  );
};

const AdjustForm: React.FC<{ userId: string }> = ({ userId }) => {
  const adjust = useAdjustWallet(userId);
  const [bucket, setBucket] = useState<'main' | 'bonus'>('main');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const value = Number(amount.replace(/[^\d-]/g, ''));
  const valid = Number.isInteger(value) && value !== 0 && note.trim() !== '';

  return (
    <form
      className="grid gap-2 sm:grid-cols-[auto_1fr_2fr_auto] items-end rounded-xl bg-page p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        adjust.mutate({ bucket, amount: value, note: note.trim() }, { onSuccess: () => { setAmount(''); setNote(''); } });
      }}
    >
      <div>
        <label htmlFor="adj-bucket" className="block text-[13px] font-semibold">Balans</label>
        <select id="adj-bucket" value={bucket} onChange={(e) => setBucket(e.target.value as 'main' | 'bonus')} className={inputClass}>
          <option value="main">Asosiy</option>
          <option value="bonus">Bonus</option>
        </select>
      </div>
      <div>
        <label htmlFor="adj-amount" className="block text-[13px] font-semibold">Summa (− yechish)</label>
        <input id="adj-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="adj-note" className="block text-[13px] font-semibold">Izoh (majburiy)</label>
        <input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </div>
      <Button type="submit" variant="primary" disabled={!valid || adjust.isPending}>Tuzatish</Button>
      {adjust.isError && <div className="sm:col-span-4"><Alert>{adjust.error.message}</Alert></div>}
      {adjust.isSuccess && <div className="sm:col-span-4"><Alert tone="success">Balans yangilandi.</Alert></div>}
    </form>
  );
};
