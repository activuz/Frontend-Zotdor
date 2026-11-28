import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, MapPin } from 'lucide-react';
import { useMe, useRegions, type Region } from '../auth/api';
import { useWallet } from '../wallet/api';
import { commissionFor, usePublicConfig, useTaxonomy, type PublicConfig } from '../reference/api';
import { useAuction, useMyAuctions, type AuctionDetail } from '../auctions/api';
import { formatDateTime, formatDuration, formatSom } from '../../lib/format';
import { mediaUrl } from '../../api/http';
import { useNow } from '../../lib/useNow';
import { EmptyState, PageError, PageLoading } from '../../components/ui/PageState';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Alert, Field, inputClass, MoneyInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { CameraStep } from './Camera';
import { LocationPicker } from '../location/LocationPicker';
import { MapView } from '../location/MapView';
import { useCreateDraft, useDeleteDraft, useSaveDraft, useSubmitAuction, type SubmitResult } from './api';
import { flushDraft, pendingPatch, saveDraftLater, useDraftSync } from './draftSync';
import { inAppUploads, pendingBackgroundSubmit, submitInBackground, useUploads } from './uploads';

/** A value the server has not accepted yet (undefined = not in the pending patch). */
function pick<T>(pending: T | null | undefined, server: T | null | undefined): T | null {
  return pending !== undefined ? (pending ?? null) : (server ?? null);
}

/* ------------------------------------------------------------------ start screen */

export const SellStartPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const mine = useMyAuctions();
  const wallet = useWallet();
  const create = useCreateDraft();
  const drafts = mine.data?.filter((a) => a.status === 'draft' || a.status === 'rejected') ?? [];

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="font-display text-[28px] text-ink">Auksion ochish</h1>
      <p className="text-[15px] text-ink-muted">
        Molingiz haqida maʼlumot kiritasiz, vaqtni belgilaysiz va telefon kamerasi bilan rasm hamda video olasiz.
        Xaridorlar taklif beradi, gʻolibni oʻzingiz tanlaysiz.
      </p>
      {wallet.data?.has_debt && (
        <Alert>
          Qarzni yoping: {formatSom(-wallet.data.main_balance)}. Shundan keyin yangi auksion ocha olasiz.{' '}
          <Link to="/wallet" className="font-semibold underline">
            Hamyonga oʻtish
          </Link>
        </Alert>
      )}
      {create.isError && <Alert>{create.error.message}</Alert>}
      <Button
        variant="primary"
        className="w-full"
        disabled={create.isPending}
        onClick={() =>
          create.mutate(
            { district_id: me?.district?.id ?? null, start_now: true },
            { onSuccess: (a) => navigate(`/sell/${a.id}`) },
          )
        }
      >
        {create.isPending ? 'Yaratilmoqda…' : 'Yangi auksion boshlash'}
      </Button>

      {mine.isPending && <PageLoading />}
      {mine.isError && <PageError message={mine.error.message} onRetry={() => void mine.refetch()} />}
      {drafts.length > 0 && (
        <section aria-labelledby="drafts-title">
          <h2 id="drafts-title" className="font-display text-[20px] text-ink">
            Davom ettirish
          </h2>
          <ul className="mt-2 space-y-2">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link
                  to={`/sell/${d.id}`}
                  className="flex items-center justify-between gap-3 min-h-touch rounded-2xl border border-line bg-surface px-4 py-3 hover:border-brand"
                >
                  <span className="text-[15px] text-ink">{d.title || 'Nomsiz qoralama'}</span>
                  <span className={`text-[13px] font-semibold ${d.status === 'rejected' ? 'text-danger' : 'text-ink-muted'}`}>
                    {d.status === 'rejected' ? 'Rad etilgan' : 'Qoralama'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ wizard */

const STEPS = [
  { key: 'details', label: 'Maʼlumotlar' },
  { key: 'time', label: 'Vaqt' },
  { key: 'media', label: 'Media' },
  { key: 'review', label: 'Koʻrib chiqish' },
] as const;
type StepKey = (typeof STEPS)[number]['key'];

export const SellWizardPage: React.FC = () => {
  const { id = '' } = useParams();
  const auction = useAuction(id);
  const config = usePublicConfig();
  const [result, setResult] = useState<SubmitResult | null>(null);

  if (result) return <SubmitOutcome result={result} onFix={() => setResult(null)} />;
  if (auction.isPending || config.isPending) return <PageLoading />;
  if (auction.isError) return <PageError message={auction.error.message} onRetry={() => void auction.refetch()} />;
  if (config.isError) return <PageError message={config.error.message} onRetry={() => void config.refetch()} />;
  const a = auction.data;
  if (!a.is_owner) return <EmptyState title="Bu qoralama sizniki emas" />;
  if (a.status !== 'draft' && a.status !== 'rejected')
    return <EmptyState title="Auksion allaqachon yuborilgan" action={{ to: `/a/${a.id}`, label: 'Auksionni ochish' }} />;

  return <Wizard key={a.id} auction={a} config={config.data} onSubmitted={setResult} />;
};

const Wizard: React.FC<{ auction: AuctionDetail; config: PublicConfig; onSubmitted: (r: SubmitResult) => void }> = ({
  auction,
  config,
  onSubmitted,
}) => {
  const [params, setParams] = useSearchParams();
  const raw = params.get('step');
  const step: StepKey = STEPS.some((s) => s.key === raw) ? (raw as StepKey) : 'details';
  const go = (s: StepKey) => {
    setParams({ step: s }, { replace: false });
    window.scrollTo(0, 0);
  };
  const index = STEPS.findIndex((s) => s.key === step);
  const sync = useDraftSync(auction.id);

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <h1 className="font-display text-[28px] text-ink">Auksion ochish</h1>
      {auction.status === 'rejected' && auction.owner?.rejection_reason && (
        <Alert>Avvalgi urinish rad etildi: {auction.owner.rejection_reason}</Alert>
      )}
      <ol className="grid grid-cols-4 gap-1" aria-label="Bosqichlar">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => go(s.key)}
              aria-current={i === index ? 'step' : undefined}
              className={`w-full min-h-touch rounded-xl px-1 text-[13px] font-semibold ${i === index ? 'bg-ink text-white' : i < index ? 'bg-brand-soft text-ink' : 'bg-surface text-ink-muted border border-line'}`}
            >
              {i + 1}. {s.label}
            </button>
          </li>
        ))}
      </ol>
      {sync.error && sync.step && (
        <Alert>
          Maʼlumotlar saqlanmadi: {sync.error}{' '}
          {sync.step !== step && (
            <button type="button" className="font-semibold underline" onClick={() => go(sync.step as StepKey)}>
              Tuzatish
            </button>
          )}
        </Alert>
      )}
      {sync.saving && (
        <p role="status" className="text-[13px] text-ink-muted">
          Saqlanmoqda…
        </p>
      )}
      {step === 'details' && <DetailsStep auction={auction} onNext={() => go('time')} />}
      {step === 'time' && <TimeStep auction={auction} config={config} onNext={() => go('media')} />}
      {step === 'media' && (
        <div className="space-y-4">
          <CameraStep auction={auction} config={config} />
          <Button variant="secondary" className="w-full" onClick={() => go('review')}>
            Davom etish
          </Button>
        </div>
      )}
      {step === 'review' && <ReviewStep auction={auction} config={config} onGo={go} onSubmitted={onSubmitted} />}
      <DeleteDraft auctionId={auction.id} />
    </div>
  );
};

/* ------------------------------------------------------------------ step 1 */

const CONTACT_RE = /(\+?\d[\d\s()-]{6,}\d)|(@[a-z0-9_]{4,})|(t\.me\/)/i;

const DetailsStep: React.FC<{ auction: AuctionDetail; onNext: () => void }> = ({ auction: a, onNext }) => {
  const taxonomy = useTaxonomy();
  const regions = useRegions();
  const queryClient = useQueryClient();
  // Values the server has not accepted yet (a reload, or a rejected save) win over the server's.
  const [p] = useState(() => pendingPatch(a.id) ?? {});
  const ageInit = p.age_months !== undefined ? p.age_months : a.age_months;
  const [direction, setDirection] = useState<number | null>(pick(p.direction_id, a.direction?.id));
  const [type, setType] = useState<number | null>(pick(p.animal_type_id, a.animal_type?.id));
  const [cls, setCls] = useState<number | null>(pick(p.animal_class_id, a.animal_class?.id));
  const [breed, setBreed] = useState<number | 'other' | null>(
    p.breed_id !== undefined || p.breed_other !== undefined
      ? (p.breed_id ?? (p.breed_other ? 'other' : null))
      : (a.breed?.id ?? (a.breed_other ? 'other' : null)),
  );
  const [breedOther, setBreedOther] = useState(p.breed_other ?? a.breed_other ?? '');
  const [years, setYears] = useState(ageInit != null ? Math.floor(ageInit / 12) : 0);
  const [months, setMonths] = useState(ageInit != null ? ageInit % 12 : 0);
  const weightInit = p.weight_kg !== undefined ? p.weight_kg : a.weight_kg;
  const [weight, setWeight] = useState<string>(weightInit ? String(weightInit) : '');
  const [estimated, setEstimated] = useState(p.weight_is_estimated ?? a.weight_is_estimated ?? true);
  const [price, setPrice] = useState<number | null>(pick(p.asking_price, a.asking_price));
  const [description, setDescription] = useState(p.description ?? a.description ?? '');
  const [district, setDistrict] = useState<number | null>(pick(p.district_id, a.district?.id));
  const [region, setRegion] = useState<number | null>(() => {
    if (p.district_id == null || p.district_id === a.district?.id) return a.region?.id ?? null;
    const cached = queryClient.getQueryData<Region[]>(['regions']);
    return cached?.find((r) => r.districts.some((d) => d.id === p.district_id))?.id ?? a.region?.id ?? null;
  });
  const [tried, setTried] = useState(false);

  if (taxonomy.isPending || regions.isPending) return <PageLoading />;
  if (taxonomy.isError) return <PageError message={taxonomy.error.message} onRetry={() => void taxonomy.refetch()} />;
  if (regions.isError) return <PageError message={regions.error.message} onRetry={() => void regions.refetch()} />;

  const types = taxonomy.data.animal_types.filter((t) => direction !== null && t.direction_ids.includes(direction));
  const typeObj = types.find((t) => t.id === type);
  const districts = regions.data.find((r) => r.id === region)?.districts ?? [];
  const ageMonths = years * 12 + months;
  const contactWarning = CONTACT_RE.test(description);

  const missing = {
    direction: direction === null,
    type: type === null,
    cls: cls === null,
    age: ageMonths === 0,
    price: price === null || price < 1000,
    district: district === null,
  };
  const invalid = Object.values(missing).some(Boolean);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (invalid) return;
    const ref = (list: { id: number; name: string }[] | undefined, id: number | null) =>
      list?.find((x) => x.id === id) ? { id: id as number, name: list.find((x) => x.id === id)!.name } : null;
    const regionObj = regions.data.find((r) => r.id === region);
    saveDraftLater(
      queryClient,
      a.id,
      'details',
      {
        direction_id: direction,
        animal_type_id: type,
        animal_class_id: cls,
        breed_id: typeof breed === 'number' ? breed : null,
        breed_other: breed === 'other' ? breedOther.trim() : '',
        age_months: ageMonths,
        weight_kg: weight ? Number(weight) : null,
        weight_is_estimated: estimated,
        asking_price: price,
        description,
        district_id: district,
      },
      {
        direction: ref(taxonomy.data.directions, direction),
        animal_type: ref(taxonomy.data.animal_types, type),
        animal_class: ref(typeObj?.classes, cls),
        breed: typeof breed === 'number' ? ref(typeObj?.breeds, breed) : null,
        breed_other: breed === 'other' ? breedOther.trim() : '',
        age_months: ageMonths,
        weight_kg: weight ? Number(weight) : null,
        weight_is_estimated: estimated,
        asking_price: price,
        description,
        region: regionObj ? { id: regionObj.id, name: regionObj.name } : null,
        district: ref(regionObj?.districts, district),
      },
    );
    onNext();
  };

  const err = (k: keyof typeof missing, text: string) => (tried && missing[k] ? text : undefined);
  const numSelect = (value: number | null, set: (v: number | null) => void, options: { id: number; name: string }[], props: object, placeholder: string) => (
    <select {...props} value={value ?? ''} onChange={(e) => set(e.target.value ? Number(e.target.value) : null)} className={inputClass}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Yoʻnalish" error={err('direction', 'Yoʻnalishni tanlang.')}>
        {(p) =>
          numSelect(direction, (v) => {
            setDirection(v);
            setType(null);
            setCls(null);
            setBreed(null);
          }, taxonomy.data.directions, p, 'Tanlang')
        }
      </Field>
      {direction !== null && (
        <Field label="Hayvon turi" error={err('type', 'Hayvon turini tanlang.')}>
          {(p) =>
            numSelect(type, (v) => {
              setType(v);
              setCls(null);
              setBreed(null);
            }, types, p, 'Tanlang')
          }
        </Field>
      )}
      {typeObj && (
        <>
          <Field label="Toifa" error={err('cls', 'Toifani tanlang.')}>
            {(p) => numSelect(cls, setCls, typeObj.classes, p, 'Tanlang')}
          </Field>
          <Field label="Zot (ixtiyoriy)">
            {(p) => (
              <select
                {...p}
                value={breed ?? ''}
                onChange={(e) => setBreed(e.target.value === 'other' ? 'other' : e.target.value ? Number(e.target.value) : null)}
                className={inputClass}
              >
                <option value="">Koʻrsatilmagan</option>
                {typeObj.breeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                <option value="other">Boshqa zot</option>
              </select>
            )}
          </Field>
          {breed === 'other' && (
            <Field label="Zot nomi">
              {(p) => <input {...p} value={breedOther} maxLength={64} onChange={(e) => setBreedOther(e.target.value)} className={inputClass} />}
            </Field>
          )}
        </>
      )}

      <fieldset>
        <legend className="block text-[15px] font-semibold text-ink mb-1">Yoshi</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="sr-only" htmlFor="age-years">Yil</label>
          <select id="age-years" value={years} onChange={(e) => setYears(Number(e.target.value))} className={inputClass}>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i} value={i}>{i} yil</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="age-months">Oy</label>
          <select id="age-months" value={months} onChange={(e) => setMonths(Number(e.target.value))} className={inputClass}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>{i} oy</option>
            ))}
          </select>
        </div>
        {tried && missing.age && <p className="mt-1 text-[13px] text-danger">Yoshini kiriting.</p>}
      </fieldset>

      <Field label="Vazni, kg (ixtiyoriy)">
        {(p) => (
          <input
            {...p}
            inputMode="numeric"
            value={weight}
            onChange={(e) => setWeight(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className={inputClass}
          />
        )}
      </Field>
      <label className="flex items-center gap-2 min-h-touch text-[15px] text-ink">
        <input type="checkbox" checked={estimated} onChange={(e) => setEstimated(e.target.checked)} className="w-5 h-5 accent-brand" />
        Vazni taxminiy
      </label>

      <Field label="Narx" hint="Siz kutayotgan narx. Takliflar shu narxga nisbatan baholanadi." error={err('price', 'Narxni kiriting.')}>
        {(p) => <MoneyInput {...p} value={price} onChange={setPrice} />}
      </Field>

      <Field label="Tavsif" hint="Sogʻligʻi, boqilishi, qoʻshimcha maʼlumotlar. Telefon raqam yozmang.">
        {(p) => (
          <textarea
            {...p}
            rows={5}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface p-3 text-[15px] text-ink focus:border-brand focus:outline-none"
          />
        )}
      </Field>
      {contactWarning && (
        <Alert tone="warning">
          Tavsifda telefon raqami yoki Telegram manzili boʻlmasin. Kontaktlar faqat bitimdan keyin ochiladi, aks holda
          eʼlon rad etiladi.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Viloyat">
          {(p) =>
            numSelect(region, (v) => {
              setRegion(v);
              setDistrict(null);
            }, regions.data, p, 'Tanlang')
          }
        </Field>
        <Field label="Tuman" error={err('district', 'Tumanni tanlang.')}>
          {(p) => numSelect(district, setDistrict, districts, { ...p, disabled: region === null }, 'Tanlang')}
        </Field>
      </div>

      <PinField
        auction={a}
        onPinned={(next) => {
          setRegion(next.region?.id ?? null);
          setDistrict(next.district?.id ?? null);
        }}
      />

      {tried && invalid && <Alert>Belgilangan maydonlarni toʻldiring.</Alert>}
      <Button type="submit" variant="primary" className="w-full">
        Saqlash va davom etish
      </Button>
    </form>
  );
};

/**
 * Optional map pin for the animal (BR-11a), like the "show on map" field of OLX or Avito.
 * Saved at once; the backend picks the district the pin is in, and the form follows it.
 */
const PinField: React.FC<{ auction: AuctionDetail; onPinned: (a: AuctionDetail) => void }> = ({
  auction: a,
  onPinned,
}) => {
  const { data: me } = useMe();
  const save = useSaveDraft(a.id);
  const [picking, setPicking] = useState(false);
  const pin = a.owner?.pin ?? null;
  const set = (point: { lat: number; lng: number } | null) =>
    save.mutate(point ?? { lat: null, lng: null }, {
      onSuccess: (next) => {
        setPicking(false);
        onPinned(next);
      },
    });

  return (
    <fieldset className="space-y-2 rounded-2xl border border-line bg-surface p-4">
      <legend className="px-1 text-[15px] font-semibold text-ink">Molning joylashuvi (ixtiyoriy)</legend>
      <p className="text-[13px] text-ink-muted">
        Xaritada belgilansa, xaridorlarga taxminiy hudud (~1,5 km) koʻrsatiladi va eʼlon “Yaqin atrofda” boʻlimida
        aniqroq saralanadi. Aniq nuqta faqat bitim tuzilgandan keyin xaridorga ochiladi.
      </p>
      {pin && (
        <MapView
          key={`${pin.lat},${pin.lng}`}
          mode="point"
          center={pin}
          zoom={14}
          interactive={false}
          className="h-40 rounded-xl"
          label="Belgilangan joylashuv xaritada"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setPicking(true)} disabled={save.isPending}>
          <MapPin className="w-4 h-4" aria-hidden="true" />
          {pin ? 'Oʻzgartirish' : 'Xaritada belgilash'}
        </Button>
        {!pin && me?.location && (
          <Button variant="ghost" onClick={() => me.location && set(me.location)} disabled={save.isPending}>
            Profildagi joylashuvim
          </Button>
        )}
        {pin && (
          <Button variant="ghost" onClick={() => set(null)} disabled={save.isPending}>
            Olib tashlash
          </Button>
        )}
      </div>
      {save.isError && !picking && <Alert>{save.error.message}</Alert>}
      <LocationPicker
        open={picking}
        title="Mol qayerda?"
        note="Xaridorlar faqat taxminiy hududni koʻradi. Tuman nuqtaga qarab avtomatik tanlanadi."
        initial={pin ?? me?.location ?? null}
        busy={save.isPending}
        error={picking && save.isError ? save.error.message : ''}
        onConfirm={set}
        onClose={() => setPicking(false)}
      />
    </fieldset>
  );
};

/* ------------------------------------------------------------------ step 2 */

const PRESETS = [10, 30, 60, 120, 180, 360, 720];

function toLocalInput(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60_000);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const TimeStep: React.FC<{ auction: AuctionDetail; config: PublicConfig; onNext: () => void }> = ({
  auction: a,
  config,
  onNext,
}) => {
  const queryClient = useQueryClient();
  const [p] = useState(() => pendingPatch(a.id) ?? {});
  const [startNow, setStartNow] = useState(p.start_now ?? a.start_now ?? true);
  const [startsAt, setStartsAt] = useState(toLocalInput(p.starts_at !== undefined ? p.starts_at : a.starts_at));
  const [duration, setDuration] = useState<number>(p.duration_minutes ?? a.duration_minutes ?? 60);
  const presets = PRESETS.filter((p) => p >= config.min_duration_min && p <= config.max_duration_min);
  const custom = !presets.includes(duration);

  const now = useNow(30_000);
  const startMs = startNow ? now : new Date(startsAt).getTime();
  const validStart = startNow || (!Number.isNaN(startMs) && startMs > now - 60_000);
  const validDuration = duration >= config.min_duration_min && duration <= config.max_duration_min;
  const end = new Date(startMs + duration * 60_000);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validStart || !validDuration) return;
    const patch = {
      start_now: startNow,
      starts_at: startNow ? null : new Date(startMs).toISOString(),
      duration_minutes: duration,
    };
    saveDraftLater(queryClient, a.id, 'time', patch, patch);
    onNext();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-[15px] font-semibold text-ink mb-1">Qachon boshlansin?</legend>
        <label className="flex items-center gap-2 min-h-touch text-[15px] text-ink">
          <input type="radio" name="start" checked={startNow} onChange={() => setStartNow(true)} className="w-5 h-5 accent-brand" />
          Eʼlon qilinishi bilan
        </label>
        <label className="flex items-center gap-2 min-h-touch text-[15px] text-ink">
          <input type="radio" name="start" checked={!startNow} onChange={() => setStartNow(false)} className="w-5 h-5 accent-brand" />
          Belgilangan vaqtda
        </label>
        {!startNow && (
          <>
            <label htmlFor="starts-at" className="sr-only">Boshlanish vaqti</label>
            <input
              id="starts-at"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={inputClass}
            />
            <p className="text-[13px] text-ink-muted">Koʻpi bilan {config.max_schedule_ahead_days} kun oldinga.</p>
            {!validStart && <p className="text-[13px] text-danger">Boshlanish vaqti oʻtib ketgan.</p>}
          </>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-[15px] font-semibold text-ink mb-2">Davomiyligi</legend>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={duration === p}
              onClick={() => setDuration(p)}
              className={`min-h-touch px-4 rounded-xl border text-[15px] font-semibold ${duration === p ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-surface text-ink-muted'}`}
            >
              {p < 60 ? `${p} daq` : `${p / 60} soat`}
            </button>
          ))}
        </div>
        <label htmlFor="duration" className="mt-3 block text-[15px] text-ink">
          Yoki daqiqada kiriting ({config.min_duration_min}–{config.max_duration_min})
        </label>
        <input
          id="duration"
          inputMode="numeric"
          value={custom ? String(duration || '') : ''}
          onChange={(e) => setDuration(Number(e.target.value.replace(/\D/g, '').slice(0, 4)))}
          className={inputClass}
        />
        {!validDuration && (
          <p className="mt-1 text-[13px] text-danger">
            Davomiylik {config.min_duration_min} daqiqadan {config.max_duration_min / 60} soatgacha boʻlsin.
          </p>
        )}
      </fieldset>

      {validStart && validDuration && (
        <p className="rounded-xl bg-brand-soft p-3 text-[17px] text-ink">
          {formatDuration(duration)} · {formatDateTime(end.toISOString())} da tugaydi
        </p>
      )}
      <Button type="submit" variant="primary" className="w-full" disabled={!validStart || !validDuration}>
        Saqlash va davom etish
      </Button>
    </form>
  );
};

/* ------------------------------------------------------------------ step 4 */

const ReviewStep: React.FC<{
  auction: AuctionDetail;
  config: PublicConfig;
  onGo: (s: StepKey) => void;
  onSubmitted: (r: SubmitResult) => void;
}> = ({ auction: a, config, onGo, onSubmitted }) => {
  const wallet = useWallet();
  const submit = useSubmitAuction(a.id);
  const sync = useDraftSync(a.id);
  const uploads = useUploads(a.id);
  const [later, setLater] = useState(() => pendingBackgroundSubmit(a.id));
  const [waitThenSubmit, setWaitThenSubmit] = useState(false);
  const [prepError, setPrepError] = useState('');
  const price = a.asking_price ?? 0;
  const hold = commissionFor(price, config.commission_rate_bp);
  const onDevice = uploads.filter((u) => u.state !== 'failed');
  const failedUploads = uploads.length - onDevice.length;
  const notFailed = (kind: 'photo' | 'video') =>
    a.media.filter((m) => m.kind === kind && m.status !== 'failed').length + onDevice.filter((u) => u.kind === kind).length;
  const photos = notFailed('photo');
  const videos = notFailed('video');
  const processing = a.media.some((m) => m.status === 'processing');
  const busy = onDevice.length > 0 || processing;
  const short = wallet.data ? Math.max(0, hold - wallet.data.available) : 0;
  const cover = a.media.find((m) => m.kind === 'photo' && m.status === 'ready');

  const publish = async () => {
    setPrepError('');
    try {
      await flushDraft(a.id);
    } catch (e) {
      setPrepError(e instanceof Error ? e.message : 'Maʼlumotlarni saqlab boʻlmadi.');
      return;
    }
    if (!busy) {
      submit.mutate(undefined, { onSuccess: onSubmitted });
    } else if (inAppUploads()) {
      if (await submitInBackground(a.id)) setLater(true);
      else setPrepError('Ilova eskirgan. Uni yangilang yoki fayllar yuklanishini kuting.');
    } else {
      setWaitThenSubmit(true);
    }
  };

  // Browser: the page itself waits for the queue and the video, then submits once.
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (!waitThenSubmit || busy || fired.current) return;
    fired.current = true;
    submit.mutate(undefined, {
      onSuccess: onSubmitted,
      onError: () => {
        fired.current = false;
        setWaitThenSubmit(false);
      },
    });
  }, [waitThenSubmit, busy, submit, onSubmitted]);

  const rows: [string, string, StepKey][] = [
    ['Mol', [a.animal_type?.name, a.animal_class?.name, a.breed?.name ?? a.breed_other].filter(Boolean).join(' · ') || '—', 'details'],
    ['Yoshi', a.age_label || '—', 'details'],
    ['Narx', price ? formatSom(price) : '—', 'details'],
    [
      'Joylashuv',
      ([a.district?.name, a.region?.name].filter(Boolean).join(', ') || '—') +
        (a.owner?.pin ? ' · xaritada belgilangan' : ''),
      'details',
    ],
    ['Vaqt', `${a.start_now ? 'Darhol' : a.starts_at ? formatDateTime(a.starts_at) : '—'} · ${a.duration_minutes ? formatDuration(a.duration_minutes) : '—'}`, 'time'],
    ['Media', `${photos} rasm, ${videos} video`, 'media'],
  ];

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        {cover && <img src={mediaUrl(cover.url || cover.thumb_url)} alt="" className="aspect-[4/3] w-full object-cover" />}
        <dl className="divide-y divide-line">
          {rows.map(([k, v, s]) => (
            <div key={k} className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="min-w-0">
                <dt className="text-[13px] text-ink-muted">{k}</dt>
                <dd className="text-[15px] text-ink">{v}</dd>
              </div>
              <Button variant="ghost" className="px-3" onClick={() => onGo(s)} aria-label={`${k}ni oʻzgartirish`}>
                Oʻzgartirish
              </Button>
            </div>
          ))}
        </dl>
      </section>

      {photos < config.photos_min || videos < config.videos_min ? (
        <Alert tone="warning">
          Kamida {config.photos_min} ta rasm va {config.videos_min} ta video kerak.
        </Alert>
      ) : null}
      {failedUploads > 0 && (
        <Alert>{failedUploads} ta faylni yuborib boʻlmadi. Media bosqichida qayta urining yoki oʻchiring.</Alert>
      )}
      {busy && !later && !waitThenSubmit && (
        <Alert tone="info">
          {onDevice.length > 0 ? `${onDevice.length} ta fayl yuborilmoqda.` : 'Video qayta ishlanmoqda.'} Kutish shart
          emas: “Eʼlon qilish”ni bossangiz, tayyor boʻlishi bilan eʼlon oʻzi yuboriladi.
        </Alert>
      )}
      {later && (
        <Alert tone="info">
          Fayllar yuklanib, video tayyor boʻlgach auksion avtomatik eʼlonga yuboriladi. Ilovani yopsangiz ham ish davom
          etadi, natija bildirishnoma bilan keladi.
        </Alert>
      )}
      {waitThenSubmit && (
        <Alert tone="info">
          Fayllar yuborilmoqda ({onDevice.length} ta qoldi). Tugashi bilan eʼlon avtomatik yuboriladi. Sahifani
          yopmang.
        </Alert>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4 space-y-1">
        <p className="text-[15px] text-ink">
          Eʼlon qilish uchun balansdan <strong className="tabular-nums">{formatSom(hold)}</strong> vaqtincha band
          qilinadi. Xaridor tanlansa, shu summa komissiya sifatida yechiladi; sotilmasa, qaytariladi.
        </p>
        {wallet.isSuccess && (
          <p className="text-[15px] text-ink-muted tabular-nums">Mavjud balans: {formatSom(wallet.data.available)}</p>
        )}
        {wallet.isError && <p className="text-[15px] text-danger">{wallet.error.message}</p>}
        {short > 0 && (
          <ButtonLink to={`/wallet?topup=${Math.max(short, config.topup_min)}`} className="mt-2 w-full">
            Balansni toʻldirish
          </ButtonLink>
        )}
      </section>

      {submit.isError && <Alert>{submit.error.message}</Alert>}
      {prepError && <Alert>{prepError}</Alert>}
      <Button
        variant="primary"
        className="w-full"
        disabled={
          submit.isPending ||
          short > 0 ||
          failedUploads > 0 ||
          Boolean(sync.error) ||
          later ||
          waitThenSubmit ||
          photos < config.photos_min ||
          videos < config.videos_min
        }
        onClick={() => void publish()}
      >
        {submit.isPending ? 'Tekshirilmoqda…' : 'Eʼlon qilish'}
      </Button>
    </div>
  );
};

/* ------------------------------------------------------------------ result */

const FIX_STEP: Record<string, StepKey> = {
  text_contacts: 'details',
  text_profanity: 'details',
  media_count: 'media',
  media_freshness: 'media',
  media_quality: 'media',
  media_duplicate: 'media',
};

const SubmitOutcome: React.FC<{ result: SubmitResult; onFix: () => void }> = ({ result, onFix }) => {
  const [, setParams] = useSearchParams();
  const a = result.auction;
  const problems = result.checks.filter((c) => c.result !== 'pass');

  if (result.outcome === 'published')
    return (
      <div className="max-w-xl mx-auto space-y-4 text-center py-8">
        <Check className="mx-auto w-12 h-12 text-success" aria-hidden="true" />
        <h1 className="font-display text-[28px] text-ink">Auksion eʼlon qilindi</h1>
        <p className="text-[17px] text-ink">
          {a.status === 'live' ? 'Auksion boshlandi.' : a.starts_at ? `Auksion ${formatDateTime(a.starts_at)} da boshlanadi.` : ''}
        </p>
        <ButtonLink to={`/a/${a.id}`} variant="primary">
          Auksionni ochish
        </ButtonLink>
      </div>
    );

  if (result.outcome === 'pending_review')
    return (
      <div className="max-w-xl mx-auto space-y-4 py-8">
        <h1 className="font-display text-[28px] text-ink">Moderatorga yuborildi</h1>
        <p className="text-[17px] text-ink">Moderator tekshiradi. Natija Telegram orqali keladi.</p>
        {problems.length > 0 && (
          <ul className="space-y-1 text-[15px] text-warning">
            {problems.map((c) => (
              <li key={c.check_name}>{c.message}</li>
            ))}
          </ul>
        )}
        <ButtonLink to={`/a/${a.id}`}>Auksionni ochish</ButtonLink>
      </div>
    );

  return (
    <div className="max-w-xl mx-auto space-y-4 py-8">
      <h1 className="font-display text-[28px] text-ink">Tuzatish kerak</h1>
      <p className="text-[15px] text-ink-muted">Eʼlon tekshiruvdan oʻtmadi. Quyidagilarni tuzatib, qayta yuboring.</p>
      <ul className="space-y-2">
        {problems.map((c) => (
          <li key={c.check_name} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3">
            <span className={`text-[15px] ${c.result === 'fail' ? 'text-danger' : 'text-warning'}`}>{c.message}</span>
            <Button
              className="shrink-0 px-3"
              onClick={() => {
                setParams({ step: FIX_STEP[c.check_name] ?? 'details' });
                onFix();
              }}
            >
              Tuzatish
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const DeleteDraft: React.FC<{ auctionId: string }> = ({ auctionId }) => {
  const navigate = useNavigate();
  const remove = useDeleteDraft(auctionId);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" className="w-full text-danger" onClick={() => setOpen(true)}>
        Qoralamani oʻchirish
      </Button>
      <Modal open={open} title="Qoralamani oʻchirasizmi?" onClose={() => setOpen(false)}>
        <p className="text-[15px] text-ink">Kiritilgan maʼlumotlar va olingan rasmlar oʻchiriladi.</p>
        {remove.isError && <div className="mt-3"><Alert>{remove.error.message}</Alert></div>}
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={() => setOpen(false)}>
            Ortga
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={remove.isPending}
            onClick={() => remove.mutate(undefined, { onSuccess: () => navigate('/sell', { replace: true }) })}
          >
            Oʻchirish
          </Button>
        </div>
      </Modal>
    </>
  );
};
