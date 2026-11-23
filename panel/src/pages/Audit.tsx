import React, { useState } from 'react';
import { useAuditLog } from '../api/panel';
import { formatDateTime } from '../lib/format';
import { EmptyState, PageError, PageLoading } from '../components/PageState';
import { inputClass } from '../components/Field';
import { Pager, Title } from './common';

const json = (v: unknown) => (v === null || v === undefined ? '' : JSON.stringify(v));

/** BR-62: every staff mutation, newest first. */
export const Audit: React.FC = () => {
  const [action, setAction] = useState('');
  const [offset, setOffset] = useState(0);
  const log = useAuditLog(action, offset);

  return (
    <div>
      <Title>Audit jurnali</Title>
      <label htmlFor="audit-action" className="sr-only">Amal boʻyicha filtr</label>
      <input
        id="audit-action"
        type="search"
        placeholder="Amal, masalan: auction, user.block, wallet"
        value={action}
        onChange={(e) => { setAction(e.target.value.trim()); setOffset(0); }}
        className={`${inputClass} mb-4 max-w-md`}
      />
      {log.isPending && <PageLoading />}
      {log.isError && <PageError message={log.error.message} onRetry={() => void log.refetch()} />}
      {log.isSuccess && log.data.results.length === 0 && <EmptyState title="Yozuvlar yoʻq" />}
      {log.isSuccess && log.data.results.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-[13px]">
            <thead className="text-left text-ink-muted">
              <tr>
                <th className="p-2 font-semibold">Vaqt</th>
                <th className="p-2 font-semibold">Xodim</th>
                <th className="p-2 font-semibold">Amal</th>
                <th className="p-2 font-semibold">Obyekt</th>
                <th className="p-2 font-semibold">Oldin → keyin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {log.data.results.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="p-2 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                  <td className="p-2 tabular-nums">{r.actor_phone}</td>
                  <td className="p-2">{r.action}</td>
                  <td className="p-2 break-all">{r.target_type} {r.target_id}</td>
                  <td className="p-2 break-all font-mono">
                    {json(r.before)}
                    {r.before ? ' → ' : ''}
                    {json(r.after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {log.isSuccess && <Pager offset={offset} count={log.data.count} onChange={setOffset} />}
    </div>
  );
};
