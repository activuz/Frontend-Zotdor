import React from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../../lib/format';
import { EmptyState, PageError, PageLoading } from '../../components/ui/PageState';
import { Button } from '../../components/ui/Button';
import { useMarkRead, useNotifications, type Notification } from './api';

/** In-app notifications (F8). Links are app paths produced by the backend. */
export const NotificationsPage: React.FC = () => {
  const list = useNotifications();
  const markRead = useMarkRead();
  const items = list.data?.pages.flatMap((p) => p.results) ?? [];
  const hasUnread = items.some((n) => !n.read_at);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] text-ink">Bildirishnomalar</h1>
        {hasUnread && (
          <Button variant="ghost" onClick={() => markRead.mutate(undefined)} disabled={markRead.isPending}>
            Hammasini oʻqilgan qilish
          </Button>
        )}
      </div>
      {list.isPending && <PageLoading />}
      {list.isError && <PageError message={list.error.message} onRetry={() => void list.refetch()} />}
      {list.isSuccess && items.length === 0 && <EmptyState title="Hozircha bildirishnoma yoʻq" />}
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((n) => (
            <Item key={n.id} n={n} onOpen={() => !n.read_at && markRead.mutate([n.id])} />
          ))}
        </ul>
      )}
      {list.hasNextPage && (
        <Button className="mt-3 w-full" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
          {list.isFetchingNextPage ? 'Yuklanmoqda…' : 'Koʻproq koʻrsatish'}
        </Button>
      )}
    </div>
  );
};

const Item: React.FC<{ n: Notification; onOpen: () => void }> = ({ n, onOpen }) => {
  const body = (
    <>
      <p className={`text-[15px] ${n.read_at ? 'text-ink' : 'font-semibold text-ink'}`}>
        {!n.read_at && <span className="sr-only">Yangi: </span>}
        {n.title}
      </p>
      {n.body && <p className="text-[15px] text-ink-muted">{n.body}</p>}
      <p className="text-[13px] text-ink-muted">{formatDateTime(n.created_at)}</p>
    </>
  );
  const cls = `block rounded-2xl border bg-surface p-3 ${n.read_at ? 'border-line' : 'border-brand'}`;
  return (
    <li>
      {n.link.startsWith('/') ? (
        <Link to={n.link} onClick={onOpen} className={`${cls} hover:border-brand`}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
};
