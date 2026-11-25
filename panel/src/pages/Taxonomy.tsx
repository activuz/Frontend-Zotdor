import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/http';
import type { components } from '../api/schema';
import {
  useTaxonomyList,
  useTaxonomySave,
  type AnimalClass,
  type AnimalType,
  type Breed,
  type Direction,
  type District,
  type TaxonomyKind,
} from '../api/panel';
import { EmptyState, PageError, PageLoading } from '../components/PageState';
import { Button } from '../components/Button';
import { Alert, inputClass } from '../components/Field';
import { Tabs, Title } from './common';

type Row = Direction | AnimalType | AnimalClass | Breed | District;
type Option = { id: number; name: string };

const KINDS: { value: TaxonomyKind; label: string }[] = [
  { value: 'directions', label: 'Yoʻnalishlar' },
  { value: 'animal-types', label: 'Hayvon turlari' },
  { value: 'classes', label: 'Toifalar' },
  { value: 'breeds', label: 'Zotlar' },
  { value: 'districts', label: 'Tumanlar' },
];

const SEX = [
  { id: 'any', name: 'Farqi yoʻq' },
  { id: 'male', name: 'Erkak' },
  { id: 'female', name: 'Urgʻochi' },
];

/** Admin-only reference data editor. Items are deactivated, never deleted (existing auctions use them). */
export const Taxonomy: React.FC = () => {
  const [kind, setKind] = useState<TaxonomyKind>('directions');
  return (
    <div>
      <Title>Toifalar va tumanlar</Title>
      <Tabs value={kind} options={KINDS} onChange={(v) => setKind(v as TaxonomyKind)} />
      <Editor key={kind} kind={kind} />
    </div>
  );
};

const Editor: React.FC<{ kind: TaxonomyKind }> = ({ kind }) => {
  const list = useTaxonomyList<Row>(kind);
  const types = useTaxonomyList<AnimalType>('animal-types');
  const directions = useTaxonomyList<Direction>('directions');
  const regions = useQuery({
    queryKey: ['regions'],
    queryFn: () => api<components['schemas']['Region'][]>('GET', '/reference/regions'),
    enabled: kind === 'districts',
  });
  const save = useTaxonomySave<Row>(kind);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  if (list.isPending) return <PageLoading />;
  if (list.isError) return <PageError message={list.error.message} onRetry={() => void list.refetch()} />;

  const typeName = (id: number) => types.data?.find((t) => t.id === id)?.name ?? id;
  const regionName = (id: number) => regions.data?.find((r) => r.id === id)?.name ?? id;
  const blank: Record<string, unknown> =
    kind === 'districts'
      ? { name: '', region: regions.data?.[0]?.id, lat: '', lng: '' }
      : kind === 'classes'
        ? { name: '', animal_type: types.data?.[0]?.id, sex: 'any', age_hint: '', sort: 0, is_active: true }
        : kind === 'breeds'
          ? { name: '', animal_type: types.data?.[0]?.id, sort: 0, is_active: true }
          : kind === 'animal-types'
            ? { name: '', slug: '', directions: [], sort: 0, is_active: true }
            : { name: '', slug: '', sort: 0, is_active: true };

  const describe = (r: Row): string => {
    if ('region' in r) return `${regionName(r.region)} · ${r.lat}, ${r.lng}`;
    if ('animal_type' in r) return String(typeName(r.animal_type));
    if ('directions' in r)
      return r.directions.map((d) => directions.data?.find((x) => x.id === d)?.name ?? d).join(', ');
    return 'slug' in r ? r.slug : '';
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => setEditing(blank)}>Yangi qoʻshish</Button>
      {editing && (
        <ItemForm
          kind={kind}
          value={editing}
          types={types.data ?? []}
          directions={directions.data ?? []}
          regions={regions.data ?? []}
          pending={save.isPending}
          error={save.isError ? save.error.message : undefined}
          onCancel={() => setEditing(null)}
          onSave={(v) => save.mutate(v, { onSuccess: () => setEditing(null) })}
        />
      )}
      {list.data.length === 0 ? (
        <EmptyState title="Roʻyxat boʻsh" />
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {list.data.map((r) => {
            const inactive = 'is_active' in r && r.is_active === false;
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2 text-[15px]">
                <span className={inactive ? 'text-ink-muted line-through' : ''}>
                  {r.name}
                  <span className="block text-[13px] text-ink-muted">{describe(r)}</span>
                </span>
                <span className="flex gap-2">
                  {'is_active' in r && (
                    <Button
                      className="px-3"
                      disabled={save.isPending}
                      onClick={() => save.mutate({ id: r.id, is_active: !r.is_active })}
                    >
                      {r.is_active === false ? 'Yoqish' : 'Oʻchirish'}
                    </Button>
                  )}
                  <Button className="px-3" onClick={() => setEditing({ ...r })}>
                    Tahrirlash
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const ItemForm: React.FC<{
  kind: TaxonomyKind;
  value: Record<string, unknown>;
  types: Option[];
  directions: Option[];
  regions: Option[];
  pending: boolean;
  error?: string;
  onCancel: () => void;
  onSave: (v: Record<string, unknown> & { id?: number }) => void;
}> = ({ kind, value, types, directions, regions, pending, error, onCancel, onSave }) => {
  const [v, setV] = useState(value);
  const set = (k: string, x: unknown) => setV((p) => ({ ...p, [k]: x }));
  const text = (k: string, label: string) => (
    <div>
      <label htmlFor={`f-${k}`} className="block text-[15px] font-semibold mb-1">{label}</label>
      <input id={`f-${k}`} value={String(v[k] ?? '')} onChange={(e) => set(k, e.target.value)} className={inputClass} />
    </div>
  );
  const select = (k: string, label: string, options: { id: number | string; name: string }[], numeric = true) => (
    <div>
      <label htmlFor={`f-${k}`} className="block text-[15px] font-semibold mb-1">{label}</label>
      <select
        id={`f-${k}`}
        value={String(v[k] ?? '')}
        onChange={(e) => set(k, numeric ? Number(e.target.value) : e.target.value)}
        className={inputClass}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
  const selected = (v.directions as number[] | undefined) ?? [];

  return (
    <form
      className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-brand bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const { id, ...rest } = v;
        if (kind !== 'districts' && kind !== 'directions' && kind !== 'animal-types') delete rest.slug;
        if ('sort' in rest) rest.sort = Number(rest.sort) || 0;
        onSave({ ...rest, id: typeof id === 'number' ? id : undefined });
      }}
    >
      {text('name', 'Nomi')}
      {(kind === 'directions' || kind === 'animal-types') && text('slug', 'Slug (lotin harflar)')}
      {(kind === 'classes' || kind === 'breeds') && select('animal_type', 'Hayvon turi', types)}
      {kind === 'classes' && select('sex', 'Jinsi', SEX, false)}
      {kind === 'classes' && text('age_hint', 'Yosh boʻyicha izoh')}
      {kind === 'districts' && select('region', 'Viloyat', regions)}
      {kind === 'districts' && text('lat', 'Kenglik (lat)')}
      {kind === 'districts' && text('lng', 'Uzunlik (lng)')}
      {kind !== 'districts' && text('sort', 'Tartib raqami')}
      {kind === 'animal-types' && (
        <fieldset className="sm:col-span-2">
          <legend className="text-[15px] font-semibold mb-1">Yoʻnalishlar</legend>
          <div className="flex flex-wrap gap-3">
            {directions.map((d) => (
              <label key={d.id} className="flex items-center gap-2 min-h-touch text-[15px]">
                <input
                  type="checkbox"
                  checked={selected.includes(d.id)}
                  onChange={(e) =>
                    set('directions', e.target.checked ? [...selected, d.id] : selected.filter((x) => x !== d.id))
                  }
                  className="w-5 h-5 accent-brand"
                />
                {d.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="sm:col-span-2 space-y-2">
        {error && <Alert>{error}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={pending || !String(v.name ?? '').trim()}>
            Saqlash
          </Button>
          <Button onClick={onCancel}>Bekor qilish</Button>
        </div>
      </div>
    </form>
  );
};
