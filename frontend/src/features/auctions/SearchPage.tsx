import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useRegions } from '../auth/api';
import { useTaxonomy } from '../reference/api';
import { useFeed, type FeedFilters, type FeedSort } from './api';
import { AuctionGrid } from './AuctionCard';
import { EmptyState, PageError, PageLoading } from '../../components/ui/PageState';
import { Button } from '../../components/ui/Button';
import { inputClass, MoneyInput } from '../../components/ui/Field';

const SORTS: { value: FeedSort; label: string }[] = [
  { value: 'ending_soon', label: 'Tez tugaydi' },
  { value: 'nearest', label: 'Eng yaqin' },
  { value: 'most_active', label: 'Eng faol' },
  { value: 'newest', label: 'Eng yangi' },
  { value: 'price_asc', label: 'Arzonroq' },
  { value: 'price_desc', label: 'Qimmatroq' },
];

const STATUSES = [
  { value: 'all_open', label: 'Jonli va rejalashtirilgan' },
  { value: 'live', label: 'Faqat jonli' },
  { value: 'scheduled', label: 'Faqat rejalashtirilgan' },
  { value: 'ended', label: 'Tugaganlar' },
] as const;

const NUMERIC = ['direction', 'animal_type', 'animal_class', 'breed', 'region', 'district', 'price_min', 'price_max'] as const;

function readFilters(params: URLSearchParams): FeedFilters {
  const f: FeedFilters = {};
  for (const key of NUMERIC) {
    const v = Number(params.get(key));
    if (params.get(key) && Number.isFinite(v)) f[key] = v;
  }
  const q = params.get('q');
  if (q) f.q = q;
  const status = params.get('status');
  if (status && STATUSES.some((s) => s.value === status)) f.status = status as FeedFilters['status'];
  const sort = params.get('sort');
  if (sort && SORTS.some((s) => s.value === sort)) f.sort = sort as FeedSort;
  return f;
}

/** FR-07: search with all state in the URL so it can be shared and survives reload. */
export const SearchPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const [text, setText] = useState(filters.q ?? '');
  const [showFilters, setShowFilters] = useState(false);
  const feed = useFeed(filters);

  const update = (patch: Partial<Record<keyof FeedFilters, string | number | null | undefined>>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    setParams(next, { replace: true });
  };

  const items = feed.data?.pages.flatMap((p) => p.results) ?? [];
  const count = feed.data?.pages[0]?.count ?? 0;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[28px] text-ink">Qidiruv</h1>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: text.trim() });
        }}
        className="flex gap-2"
      >
        <label htmlFor="search-q" className="sr-only">
          Qidiruv soʻzi
        </label>
        <input
          id="search-q"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Masalan: buqa, Hisori, Samarqand"
          className={inputClass}
        />
        <Button type="submit" variant="primary" aria-label="Qidirish">
          <Search className="w-5 h-5" aria-hidden="true" />
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="filters">
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          Filtrlar
        </Button>
        <label htmlFor="sort" className="sr-only">
          Saralash
        </label>
        <select
          id="sort"
          value={filters.sort ?? 'ending_soon'}
          onChange={(e) => update({ sort: e.target.value })}
          className={`${inputClass} w-auto`}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {showFilters && <Filters filters={filters} update={update} onReset={() => setParams({}, { replace: true })} />}

      {feed.isPending && <PageLoading />}
      {feed.isError && <PageError message={feed.error.message} onRetry={() => void feed.refetch()} />}
      {feed.isSuccess && items.length === 0 && (
        <EmptyState title="Hech narsa topilmadi" text="Filtrlarni oʻzgartirib koʻring." />
      )}
      {feed.isSuccess && items.length > 0 && (
        <>
          <p className="text-[15px] text-ink-muted" aria-live="polite">
            {count} ta auksion
          </p>
          <AuctionGrid items={items} />
        </>
      )}
      {feed.hasNextPage && (
        <Button className="w-full" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
          {feed.isFetchingNextPage ? 'Yuklanmoqda…' : 'Koʻproq koʻrsatish'}
        </Button>
      )}
    </div>
  );
};

type Update = (patch: Partial<Record<keyof FeedFilters, string | number | null | undefined>>) => void;

const Filters: React.FC<{ filters: FeedFilters; update: Update; onReset: () => void }> = ({
  filters,
  update,
  onReset,
}) => {
  const taxonomy = useTaxonomy();
  const regions = useRegions();
  const types = (taxonomy.data?.animal_types ?? []).filter(
    (t) => !filters.direction || t.direction_ids.includes(filters.direction),
  );
  const type = taxonomy.data?.animal_types.find((t) => t.id === filters.animal_type);
  const region = regions.data?.find((r) => r.id === filters.region);

  const select = (
    id: string,
    label: string,
    value: number | undefined,
    options: { id: number; name: string }[],
    onChange: (v: string) => void,
  ) => (
    <div>
      <label htmlFor={id} className="block text-[15px] font-semibold text-ink mb-1">
        {label}
      </label>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">Hammasi</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section id="filters" className="rounded-2xl border border-line bg-surface p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label htmlFor="f-status" className="block text-[15px] font-semibold text-ink mb-1">
          Holati
        </label>
        <select
          id="f-status"
          value={filters.status ?? 'all_open'}
          onChange={(e) => update({ status: e.target.value === 'all_open' ? null : e.target.value })}
          className={inputClass}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {select('f-direction', 'Yoʻnalish', filters.direction, taxonomy.data?.directions ?? [], (v) =>
        update({ direction: v, animal_type: null, animal_class: null, breed: null }),
      )}
      {select('f-type', 'Hayvon turi', filters.animal_type, types, (v) =>
        update({ animal_type: v, animal_class: null, breed: null }),
      )}
      {type && select('f-class', 'Toifa', filters.animal_class, type.classes, (v) => update({ animal_class: v }))}
      {type && type.breeds.length > 0 && select('f-breed', 'Zot', filters.breed, type.breeds, (v) => update({ breed: v }))}
      {select('f-region', 'Viloyat', filters.region, regions.data ?? [], (v) => update({ region: v, district: null }))}
      {region && select('f-district', 'Tuman', filters.district, region.districts, (v) => update({ district: v }))}
      <div>
        <label htmlFor="f-min" className="block text-[15px] font-semibold text-ink mb-1">
          Narx, dan
        </label>
        <MoneyInput id="f-min" value={filters.price_min ?? null} onChange={(v) => update({ price_min: v })} />
      </div>
      <div>
        <label htmlFor="f-max" className="block text-[15px] font-semibold text-ink mb-1">
          Narx, gacha
        </label>
        <MoneyInput id="f-max" value={filters.price_max ?? null} onChange={(v) => update({ price_max: v })} />
      </div>
      <div className="flex items-end">
        <Button variant="ghost" onClick={onReset}>
          Filtrlarni tozalash
        </Button>
      </div>
    </section>
  );
};
